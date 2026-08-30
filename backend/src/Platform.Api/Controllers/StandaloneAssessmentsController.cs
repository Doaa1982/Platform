using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Platform.Api.Models;
using Platform.Api.Services;
using Platform.Domain;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace Platform.Api.Controllers;

/// <summary>
/// A lesson's Standalone quiz — a second, separate Assessment from the
/// in-video Interactive one (see AssessmentKind), with its own title,
/// passing threshold and questions, graded as its own Submission. Every
/// route here is the same shape as AssessmentsController's, just pinned to
/// AssessmentKind.Standalone; the two never share an Assessment row.
///
/// ai-suggest here is grounded in the lesson's text (title, body,
/// transcript, tutor's notes) via <see cref="GenerateStandaloneQuestionsSkill"/>,
/// not a video timestamp — AssessmentsController's ai-suggest places
/// checkpoints on the video's timeline, which has no meaning for a quiz
/// that isn't synced to playback, so the two use different skills entirely.
/// </summary>
[ApiController]
[Route("api/workspaces/{slug}/lessons/{lessonId:guid}/standalone-assessment")]
[Authorize]
public class StandaloneAssessmentsController(AssessmentService assessments) : ControllerBase
{
    private const AssessmentKind Kind = AssessmentKind.Standalone;

    [HttpGet]
    public async Task<ActionResult<AssessmentResponse>> Get(string slug, Guid lessonId, CancellationToken ct)
        => Run(await assessments.GetAsync(slug, Caller(), lessonId, ct, Kind));

    [HttpPut]
    public async Task<ActionResult<AssessmentResponse>> Save(
        string slug, Guid lessonId, [FromBody] SaveAssessmentRequest request, CancellationToken ct)
        => Run(await assessments.SaveAsync(slug, Caller(), lessonId, request, ct, Kind));

    [HttpPost("questions")]
    public async Task<ActionResult<AssessmentResponse>> AddQuestion(
        string slug, Guid lessonId, [FromBody] SaveQuestionRequest request, CancellationToken ct)
        => Run(await assessments.AddQuestionAsync(slug, Caller(), lessonId, request, ct, Kind));

    [HttpPut("questions/{questionId:guid}")]
    public async Task<ActionResult<AssessmentResponse>> UpdateQuestion(
        string slug, Guid lessonId, Guid questionId, [FromBody] SaveQuestionRequest request, CancellationToken ct)
        => Run(await assessments.UpdateQuestionAsync(slug, Caller(), lessonId, questionId, request, ct, Kind));

    [HttpDelete("questions/{questionId:guid}")]
    public async Task<ActionResult<AssessmentResponse>> RemoveQuestion(
        string slug, Guid lessonId, Guid questionId, CancellationToken ct)
        => Run(await assessments.RemoveQuestionAsync(slug, Caller(), lessonId, questionId, ct, Kind));

    /// <summary>Opts this quiz into (or out of, or reconfigures) adaptive delivery. See AssessmentService.ConfigureAdaptiveAsync.</summary>
    [HttpPut("adaptive")]
    public async Task<ActionResult<AssessmentResponse>> ConfigureAdaptive(
        string slug, Guid lessonId, [FromBody] AdaptiveConfigurationRequest request, CancellationToken ct)
        => Run(await assessments.ConfigureAdaptiveAsync(slug, Caller(), lessonId, request, ct, Kind));

    [HttpPost("publish")]
    public async Task<ActionResult<AssessmentResponse>> Publish(string slug, Guid lessonId, CancellationToken ct)
        => Run(await assessments.PublishAsync(slug, Caller(), lessonId, ct, Kind));

    [HttpPost("unpublish")]
    public async Task<ActionResult<AssessmentResponse>> Unpublish(string slug, Guid lessonId, CancellationToken ct)
        => Run(await assessments.UnpublishAsync(slug, Caller(), lessonId, ct, Kind));

    /// <summary>AI-drafted questions grounded in the lesson's text, for the tutor to Accept, Edit or Remove. Nothing is persisted until accepted via AddQuestion.</summary>
    [HttpPost("ai-suggest")]
    public async Task<ActionResult<IReadOnlyList<SuggestedStandaloneQuestion>>> SuggestQuestions(
        string slug, Guid lessonId, [FromBody] AiSuggestStandaloneQuestionsRequest request, CancellationToken ct)
        => Run(await assessments.SuggestStandaloneQuestionsAsync(slug, Caller(), lessonId, request, ct));

    /// <summary>Simulated AI grading against the authored answer key. A preview only — no Submission is recorded.</summary>
    [HttpPost("preview")]
    public async Task<ActionResult<PreviewResult>> Preview(
        string slug, Guid lessonId, [FromBody] PreviewSubmitRequest request, CancellationToken ct)
        => Run(await assessments.PreviewAsync(slug, Caller(), lessonId, request, ct, Kind));

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
