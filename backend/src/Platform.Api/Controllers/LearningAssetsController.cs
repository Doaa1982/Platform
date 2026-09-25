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
public class LearningAssetsController(
    LearningAssetService assets, ILearningAssetStorage storage, LearningAssetAccessPolicy accessPolicy,
    AssetAccessTokenService assetTokens, AssetAccessOptions assetOptions) : ControllerBase
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

        var download = result.Value;
        return new StoredObjectResult(
            storage, download.ObjectKey, download.ContentType, download.FileName, download.Length, download.ETag);
    }

    /// <summary>
    /// Authorises the caller for one asset and returns a short-lived URL a browser element can load without an
    /// Authorization header. The URL carries an asset-scoped token — never the session JWT. Denials here are
    /// explicit (403 for a member without access, 404 for a non-member or unknown asset).
    /// </summary>
    [HttpPost("{assetId:guid}/access")]
    public async Task<ActionResult<AssetAccessResponse>> Access(string slug, Guid assetId, [FromQuery] string? disposition, CancellationToken ct)
    {
        var decision = await accessPolicy.AuthorizeReadAsync(slug, Caller(), assetId, ct);
        if (decision.Denied is { } denied)
        {
            return denied.Error switch
            {
                ProvisioningError.NotFound  => NotFound(new { message = denied.Message }),
                ProvisioningError.Forbidden => StatusCode(StatusCodes.Status403Forbidden, new { message = denied.Message }),
                _                           => BadRequest(new { message = denied.Message }),
            };
        }

        var asset = decision.Asset!;

        // Video goes straight from the storage service to the browser when the provider can sign a URL — unless
        // Storage:VideoDelivery has been flipped to Proxy (TD-023's emergency lever: routes video bytes through
        // this API instead of straight to the storage edge, no rebuild needed). This is reached only after the
        // policy above has said yes — no URL is created for anyone who was refused.
        if (asset.Category == Platform.Domain.LearningAssetCategory.Video && storage.SupportsPresignedRead
            && assetOptions.VideoDelivery == VideoDeliveryMode.Presigned)
        {
            try
            {
                var presigned = await storage.CreatePresignedReadUrlAsync(
                    asset.ObjectKey, asset.ContentType, asset.OriginalFileName, assetOptions.PresignedReadLifetime,
                    inline: !string.Equals(disposition, "attachment", StringComparison.OrdinalIgnoreCase), ct);
                return Ok(new AssetAccessResponse(presigned.Url, presigned.ExpiresAt, "presigned"));
            }
            catch (StorageException)
            {
                return StatusCode(StatusCodes.Status503ServiceUnavailable, new { message = "The file storage is unavailable right now." });
            }
        }

        var lifetime = asset.Category == Platform.Domain.LearningAssetCategory.Video
            ? assetOptions.VideoProxyTokenLifetime : assetOptions.AssetTokenLifetime;
        var token = assetTokens.Issue(asset.Id, decision.WorkspaceId, Caller(), lifetime);

        var url = $"/api/workspaces/{Uri.EscapeDataString(slug)}/learning-assets/{asset.Id}/content?t={token}";
        if (string.Equals(disposition, "attachment", StringComparison.OrdinalIgnoreCase)) url += "&d=attachment";

        return Ok(new AssetAccessResponse(url, assetTokens.ExpiryFor(lifetime)));
    }

    /// <summary>
    /// Redeems an asset token. Anonymous by design (a browser element can't send a header), so the token is the
    /// only credential — and it is re-checked against the live authorization rules every time, so revoked
    /// access, archived assets and ended enrollments fail at once. EVERY failure (bad signature, expired, wrong
    /// asset, wrong workspace, revoked access, missing bytes) is the same empty 404 with the same headers.
    /// </summary>
    [AllowAnonymous]
    [HttpGet("{assetId:guid}/content")]
    public async Task<IActionResult> Content(string slug, Guid assetId, CancellationToken ct)
    {
        // Read here, not bound as action parameters: MVC logs a bound action's arguments at Trace, which would put the
        // token in a log line the moment someone turns that level up.
        var token = Request.Query["t"].ToString();
        var disposition = Request.Query["d"].ToString();

        Response.Headers.CacheControl = "private, no-store";
        Response.Headers["Referrer-Policy"] = "no-referrer";
        Response.Headers["X-Content-Type-Options"] = "nosniff";

        var claims = assetTokens.TryValidate(token);

        // The same authorization work runs whether or not the token verified (with a throwaway identity when it
        // did not), so a forged token is not noticeably quicker to answer than a revoked one.
        var decision = await accessPolicy.AuthorizeReadAsync(slug, claims?.IdentityId ?? Guid.NewGuid(), assetId, ct);

        if (claims is not { } c || c.AssetId != assetId || !decision.Allowed || c.WorkspaceId != decision.WorkspaceId)
            return OpaqueNotFound();

        var asset = decision.Asset!;
        var cacheable = await accessPolicy.IsSafeToCacheAsync(asset, ct);
        Response.Headers.CacheControl = cacheable ? "private, max-age=300" : "private, no-store";

        return new StoredObjectResult(
            storage, asset.ObjectKey, asset.ContentType, asset.OriginalFileName, asset.FileSizeBytes,
            etag: $"\"{asset.Id:N}-{asset.FileSizeBytes}\"",
            inline: !string.Equals(disposition, "attachment", StringComparison.OrdinalIgnoreCase),
            emptyNotFound: true);
    }

    /// <summary>
    /// A bare 404 with no body. Deliberately not NotFound(): under [ApiController] that becomes a ProblemDetails
    /// body carrying a per-request trace id, which is one more thing a caller could compare between failures.
    /// </summary>
    private IActionResult OpaqueNotFound()
    {
        Response.StatusCode = StatusCodes.Status404NotFound;
        return new EmptyResult();
    }

    /// <summary>
    /// Issues asset URLs for many Image-category assets at once (covers and logos on list screens) — one round trip
    /// instead of one per image. Each asset is authorized on its own. Anything that is not available to the caller —
    /// unknown, not permitted, archived, or not an Image — comes back as the same "unavailable" item, so the answer
    /// can't be used to probe ids or categories. Videos and resources are never issued here.
    /// </summary>
    [HttpPost("access-batch")]
    public async Task<ActionResult<AssetAccessBatchResponse>> AccessBatch(
        string slug, [FromBody] AssetAccessBatchRequest request, CancellationToken ct)
    {
        const int MaxBatch = 50;
        if (request?.AssetIds is not { Count: > 0 } requested)
            return BadRequest(new { message = "Name at least one asset." });
        if (requested.Count > MaxBatch)
            return BadRequest(new { message = $"A batch can name at most {MaxBatch} assets." });

        var reader = await accessPolicy.ResolveReaderAsync(slug, Caller(), ct);
        if (reader is null) return NotFound(new { message = "No such learning asset." });

        var items = new List<AssetAccessBatchItem>();
        foreach (var assetId in requested.Distinct())
        {
            var decision = await accessPolicy.AuthorizeAsync(reader, assetId, ct);
            if (!decision.Allowed || decision.Asset!.Category != Platform.Domain.LearningAssetCategory.Image)
            {
                items.Add(new AssetAccessBatchItem(assetId, false, null, null));
                continue;
            }

            var token = assetTokens.Issue(assetId, decision.WorkspaceId, Caller(), assetOptions.AssetTokenLifetime);
            items.Add(new AssetAccessBatchItem(assetId, true,
                $"/api/workspaces/{Uri.EscapeDataString(slug)}/learning-assets/{assetId}/content?t={token}",
                assetTokens.ExpiryFor(assetOptions.AssetTokenLifetime)));
        }
        return Ok(new AssetAccessBatchResponse(items));
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
