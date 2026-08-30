using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Platform.Api.Models;
using Platform.Api.Services;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace Platform.Api.Controllers;

/// <summary>Uploading and serving Learning Assets — video, today.</summary>
[ApiController]
[Route("api/workspaces/{slug}/learning-assets")]
[Authorize]
public class LearningAssetsController(LearningAssetService assets) : ControllerBase
{
    /// <summary>500MB cap — comfortably above a recorded lesson, far below "someone's whole hard drive".</summary>
    [HttpPost]
    [RequestSizeLimit(500_000_000)]
    [RequestFormLimits(MultipartBodyLengthLimit = 500_000_000)]
    public async Task<ActionResult<LearningAssetResponse>> Upload(
        string slug, IFormFile file, [FromForm] string? title, [FromForm] string? category, CancellationToken ct)
    {
        if (file is null || file.Length == 0) return BadRequest(new { message = "No file was uploaded." });

        var parsedCategory = Enum.TryParse<Platform.Domain.LearningAssetCategory>(category, ignoreCase: true, out var c)
            ? c : Platform.Domain.LearningAssetCategory.Video;

        await using var stream = file.OpenReadStream();
        return Run(await assets.UploadAsync(slug, Caller(), file.FileName, file.ContentType, file.Length, stream, title, parsedCategory, ct));
    }

    /// <summary>A learner attaching their own completed work (e.g. a filled-out worksheet) to an Assignment Submission's Response — see LearningAssetService.UploadForSubmissionAsync.</summary>
    [HttpPost("submission")]
    [RequestSizeLimit(500_000_000)]
    [RequestFormLimits(MultipartBodyLengthLimit = 500_000_000)]
    public async Task<ActionResult<LearningAssetResponse>> UploadForSubmission(
        string slug, IFormFile file, CancellationToken ct)
    {
        if (file is null || file.Length == 0) return BadRequest(new { message = "No file was uploaded." });

        await using var stream = file.OpenReadStream();
        return Run(await assets.UploadForSubmissionAsync(slug, Caller(), file.FileName, file.ContentType, file.Length, stream, ct));
    }

    /// <summary>Streams the file back with range support, so a browser &lt;video&gt; element can seek.</summary>
    [HttpGet("{assetId:guid}/download")]
    public async Task<IActionResult> Download(string slug, Guid assetId, CancellationToken ct)
    {
        var result = await assets.ResolveDownloadAsync(slug, Caller(), assetId, ct);
        if (result.Error != ProvisioningError.None)
        {
            return result.Error switch
            {
                ProvisioningError.NotFound  => NotFound(new { message = result.Message }),
                ProvisioningError.Forbidden => StatusCode(StatusCodes.Status403Forbidden, new { message = result.Message }),
                _                           => BadRequest(new { message = result.Message }),
            };
        }

        var (path, contentType, fileName) = result.Value;
        return PhysicalFile(path, contentType, fileName, enableRangeProcessing: true);
    }

    [HttpDelete("{assetId:guid}")]
    public async Task<ActionResult<LearningAssetResponse>> Archive(string slug, Guid assetId, CancellationToken ct)
        => Run(await assets.ArchiveAsync(slug, Caller(), assetId, ct));

    private ActionResult<T> Run<T>(ProvisioningResult<T> r) => r.Error switch
    {
        ProvisioningError.None      => Ok(r.Value),
        ProvisioningError.NotFound  => NotFound(new { message = r.Message }),
        ProvisioningError.Conflict  => Conflict(new { message = r.Message }),
        ProvisioningError.Forbidden => StatusCode(StatusCodes.Status403Forbidden, new { message = r.Message }),
        _                           => BadRequest(new { message = r.Message }),
    };

    private Guid Caller()
    {
        var raw = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);
        return Guid.TryParse(raw, out var id) ? id : Guid.Empty;
    }
}
