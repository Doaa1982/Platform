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

    /// <summary>Re-sequences the curriculum's units. Draft-only, like every other structural change.</summary>
    [HttpPut("units/reorder")]
    public async Task<ActionResult<CurriculumResponse>> ReorderUnits(
        string slug, Guid productId, [FromBody] ReorderUnitsRequest request, CancellationToken ct)
        => Run(await studio.ReorderUnitsAsync(slug, Caller(), productId, request, ct));

    /// <summary>Re-sequences one unit's lessons. Draft-only, like every other structural change.</summary>
    [HttpPut("units/{unitId:guid}/lessons/reorder")]
    public async Task<ActionResult<CurriculumResponse>> ReorderLessons(
        string slug, Guid productId, Guid unitId, [FromBody] ReorderLessonsRequest request, CancellationToken ct)
        => Run(await studio.ReorderLessonsAsync(slug, Caller(), productId, unitId, request, ct));

    /// <summary>Turns sequential unlock on or off. Not gated by editability — a policy switch, not a structural one.</summary>
    [HttpPut("sequential-unlock")]
    public async Task<ActionResult<CurriculumResponse>> SetSequentialUnlock(
        string slug, Guid productId, [FromBody] SetSequentialUnlockRequest request, CancellationToken ct)
        => Run(await studio.SetSequentialUnlockAsync(slug, Caller(), productId, request, ct));

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

    /// <summary>Saves the open draft.</summary>
    [HttpPut("draft")]
    public async Task<ActionResult<LessonDetailResponse>> SaveDraft(
        string slug, Guid lessonId, [FromBody] SaveRevisionRequest request, CancellationToken ct)
        => Run(await studio.SaveDraftAsync(slug, Caller(), lessonId, request, ct));

    /// <summary>
    /// Title/Body/EstimatedMinutes only, applied straight to the currently
    /// published revision — Lesson Editing &amp; Publication UX, Scenario 3.
    /// </summary>
    [HttpPut("current/quick-edit")]
    public async Task<ActionResult<LessonDetailResponse>> QuickEditPublished(
        string slug, Guid lessonId, [FromBody] SaveRevisionRequest request, CancellationToken ct)
        => Run(await studio.QuickEditPublishedAsync(slug, Caller(), lessonId, request, ct));

    /// <summary>Opens a new draft on top of the published content.</summary>
    [HttpPost("revisions")]
    public async Task<ActionResult<LessonDetailResponse>> StartRevision(string slug, Guid lessonId, CancellationToken ct)
        => Run(await studio.StartRevisionAsync(slug, Caller(), lessonId, ct));

    /// <summary>Clones this lesson's current content into a brand-new, separate Lesson — Lesson Editing &amp; Publication UX, Scenario 5's "Create new draft".</summary>
    [HttpPost("duplicate")]
    public async Task<ActionResult<LessonDetailResponse>> Duplicate(string slug, Guid lessonId, CancellationToken ct)
        => Run(await studio.DuplicateLessonAsync(slug, Caller(), lessonId, ct));

    [HttpPost("publish")]
    public async Task<ActionResult<LessonDetailResponse>> Publish(string slug, Guid lessonId, CancellationToken ct)
        => Run(await studio.PublishLessonAsync(slug, Caller(), lessonId, ct));

    [HttpPost("unpublish")]
    public async Task<ActionResult<LessonDetailResponse>> Unpublish(string slug, Guid lessonId, CancellationToken ct)
        => Run(await studio.UnpublishLessonAsync(slug, Caller(), lessonId, ct));

    [HttpPost("archive")]
    public async Task<ActionResult<LessonDetailResponse>> Archive(string slug, Guid lessonId, CancellationToken ct)
        => Run(await studio.ArchiveLessonAsync(slug, Caller(), lessonId, ct));

    /// <summary>Attaches an uploaded video (a Learning Asset) to the lesson's open draft.</summary>
    [HttpPost("draft/video")]
    public async Task<ActionResult<LessonDetailResponse>> AttachVideo(
        string slug, Guid lessonId, [FromBody] AttachVideoRequest request, CancellationToken ct)
        => Run(await studio.AttachVideoAsync(slug, Caller(), lessonId, request.LearningAssetId, ct));

    /// <summary>Sets an externally-hosted video by direct link — the "URL" alternative to uploading.</summary>
    [HttpPut("draft/video-url")]
    public async Task<ActionResult<LessonDetailResponse>> SetVideoUrl(
        string slug, Guid lessonId, [FromBody] SetVideoUrlRequest request, CancellationToken ct)
        => Run(await studio.SetVideoUrlAsync(slug, Caller(), lessonId, request, ct));

    [HttpDelete("draft/video")]
    public async Task<ActionResult<LessonDetailResponse>> RemoveVideo(string slug, Guid lessonId, CancellationToken ct)
        => Run(await studio.RemoveVideoAsync(slug, Caller(), lessonId, ct));

    /// <summary>
    /// Starts AI transcription of the open revision's uploaded video. Returns
    /// immediately with TranscriptStatus "Processing" — the transcript itself
    /// lands asynchronously; poll GET (this lesson) to see when it's Ready.
    /// </summary>
    [HttpPost("transcript/generate")]
    public async Task<ActionResult<LessonDetailResponse>> GenerateTranscript(string slug, Guid lessonId, CancellationToken ct)
        => Run(await studio.GenerateTranscriptAsync(slug, Caller(), lessonId, ct));

    /// <summary>Drafts or improves lesson body content from whatever's currently typed in the form. Nothing is saved — the tutor still hits Save themselves.</summary>
    [HttpPost("draft/ai-suggest-body")]
    public async Task<ActionResult<AiSuggestBodyResponse>> SuggestBody(
        string slug, Guid lessonId, [FromBody] AiSuggestBodyRequest request, CancellationToken ct)
        => Run(await studio.SuggestBodyAsync(slug, Caller(), lessonId, request, ct));

    /// <summary>Drafts the short learner-facing "what you'll learn" preview, preferring a Ready transcript over the form's current title/body. Nothing is saved — the tutor still hits Save themselves.</summary>
    [HttpPost("draft/ai-suggest-what-youll-learn")]
    public async Task<ActionResult<AiSuggestWhatYoullLearnResponse>> SuggestWhatYoullLearn(
        string slug, Guid lessonId, [FromBody] AiSuggestWhatYoullLearnRequest request, CancellationToken ct)
        => Run(await studio.SuggestWhatYoullLearnAsync(slug, Caller(), lessonId, request, ct));

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
