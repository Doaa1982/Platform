using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Platform.Api.Models;
using Platform.Api.Services;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace Platform.Api.Controllers;

/// <summary>
/// Content Studio — the curriculum and lessons of one Learning Product.
///
/// Every response returns the whole curriculum, so the client never
/// re-derives structure after a change; lesson editing returns the whole
/// lesson for the same reason.
/// </summary>
[ApiController]
[Route("api/workspaces/{slug}/products/{productId:guid}/curriculum")]
[Authorize]
public class ContentStudioController(ContentStudioService studio) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<CurriculumResponse>> Get(string slug, Guid productId, CancellationToken ct)
        => Run(await studio.GetAsync(slug, Caller(), productId, ct));

    [HttpPost("units")]
    public async Task<ActionResult<CurriculumResponse>> AddUnit(
        string slug, Guid productId, [FromBody] SaveUnitRequest request, CancellationToken ct)
        => Run(await studio.AddUnitAsync(slug, Caller(), productId, request, ct));

    [HttpPut("units/{unitId:guid}")]
    public async Task<ActionResult<CurriculumResponse>> RenameUnit(
        string slug, Guid productId, Guid unitId, [FromBody] SaveUnitRequest request, CancellationToken ct)
        => Run(await studio.RenameUnitAsync(slug, Caller(), productId, unitId, request, ct));

    [HttpDelete("units/{unitId:guid}")]
    public async Task<ActionResult<CurriculumResponse>> RemoveUnit(
        string slug, Guid productId, Guid unitId, CancellationToken ct)
        => Run(await studio.RemoveUnitAsync(slug, Caller(), productId, unitId, ct));

    [HttpPost("lessons")]
    public async Task<ActionResult<CurriculumResponse>> CreateLesson(
        string slug, Guid productId, [FromBody] CreateLessonRequest request, CancellationToken ct)
        => Run(await studio.CreateLessonAsync(slug, Caller(), productId, request, ct));

    [HttpPost("units/{unitId:guid}/lessons/{lessonId:guid}")]
    public async Task<ActionResult<CurriculumResponse>> PlaceLesson(
        string slug, Guid productId, Guid unitId, Guid lessonId, CancellationToken ct)
        => Run(await studio.PlaceLessonAsync(slug, Caller(), productId, unitId, lessonId, ct));

    [HttpDelete("units/{unitId:guid}/lessons/{lessonId:guid}")]
    public async Task<ActionResult<CurriculumResponse>> UnplaceLesson(
        string slug, Guid productId, Guid unitId, Guid lessonId, CancellationToken ct)
        => Run(await studio.UnplaceLessonAsync(slug, Caller(), productId, unitId, lessonId, ct));

    /// <summary>Enforces INV-008 and INV-009 through the aggregate.</summary>
    [HttpPost("publish")]
    public async Task<ActionResult<CurriculumResponse>> Publish(string slug, Guid productId, CancellationToken ct)
        => Run(await studio.PublishCurriculumAsync(slug, Caller(), productId, ct));

    [HttpPost("unpublish")]
    public async Task<ActionResult<CurriculumResponse>> Unpublish(string slug, Guid productId, CancellationToken ct)
        => Run(await studio.UnpublishCurriculumAsync(slug, Caller(), productId, ct));

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

/// <summary>Writing one lesson. Separate route because a lesson outlives its placement.</summary>
[ApiController]
[Route("api/workspaces/{slug}/lessons/{lessonId:guid}")]
[Authorize]
public class LessonsController(ContentStudioService studio) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<LessonDetailResponse>> Get(string slug, Guid lessonId, CancellationToken ct)
        => Run(await studio.GetLessonAsync(slug, Caller(), lessonId, ct));

    /// <summary>Saves the open draft. A published revision is never edited in place.</summary>
    [HttpPut("draft")]
    public async Task<ActionResult<LessonDetailResponse>> SaveDraft(
        string slug, Guid lessonId, [FromBody] SaveRevisionRequest request, CancellationToken ct)
        => Run(await studio.SaveDraftAsync(slug, Caller(), lessonId, request, ct));

    /// <summary>Opens a new draft on top of the published content.</summary>
    [HttpPost("revisions")]
    public async Task<ActionResult<LessonDetailResponse>> StartRevision(string slug, Guid lessonId, CancellationToken ct)
        => Run(await studio.StartRevisionAsync(slug, Caller(), lessonId, ct));

    [HttpPost("publish")]
    public async Task<ActionResult<LessonDetailResponse>> Publish(string slug, Guid lessonId, CancellationToken ct)
        => Run(await studio.PublishLessonAsync(slug, Caller(), lessonId, ct));

    [HttpPost("unpublish")]
    public async Task<ActionResult<LessonDetailResponse>> Unpublish(string slug, Guid lessonId, CancellationToken ct)
        => Run(await studio.UnpublishLessonAsync(slug, Caller(), lessonId, ct));

    [HttpPost("archive")]
    public async Task<ActionResult<LessonDetailResponse>> Archive(string slug, Guid lessonId, CancellationToken ct)
        => Run(await studio.ArchiveLessonAsync(slug, Caller(), lessonId, ct));

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
