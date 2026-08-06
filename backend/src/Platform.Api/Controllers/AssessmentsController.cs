using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Platform.Api.Models;
using Platform.Api.Services;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace Platform.Api.Controllers;

/// <summary>The interactive quiz attached to one lesson's video.</summary>
[ApiController]
[Route("api/workspaces/{slug}/lessons/{lessonId:guid}/assessment")]
[Authorize]
public class AssessmentsController(AssessmentService assessments) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<AssessmentResponse>> Get(string slug, Guid lessonId, CancellationToken ct)
        => Run(await assessments.GetAsync(slug, Caller(), lessonId, ct));

    [HttpPut]
    public async Task<ActionResult<AssessmentResponse>> Save(
        string slug, Guid lessonId, [FromBody] SaveAssessmentRequest request, CancellationToken ct)
        => Run(await assessments.SaveAsync(slug, Caller(), lessonId, request, ct));

    [HttpPost("questions")]
    public async Task<ActionResult<AssessmentResponse>> AddQuestion(
        string slug, Guid lessonId, [FromBody] SaveQuestionRequest request, CancellationToken ct)
        => Run(await assessments.AddQuestionAsync(slug, Caller(), lessonId, request, ct));

    [HttpPut("questions/{questionId:guid}")]
    public async Task<ActionResult<AssessmentResponse>> UpdateQuestion(
        string slug, Guid lessonId, Guid questionId, [FromBody] SaveQuestionRequest request, CancellationToken ct)
        => Run(await assessments.UpdateQuestionAsync(slug, Caller(), lessonId, questionId, request, ct));

    [HttpDelete("questions/{questionId:guid}")]
    public async Task<ActionResult<AssessmentResponse>> RemoveQuestion(
        string slug, Guid lessonId, Guid questionId, CancellationToken ct)
        => Run(await assessments.RemoveQuestionAsync(slug, Caller(), lessonId, questionId, ct));

    [HttpPost("publish")]
    public async Task<ActionResult<AssessmentResponse>> Publish(string slug, Guid lessonId, CancellationToken ct)
        => Run(await assessments.PublishAsync(slug, Caller(), lessonId, ct));

    [HttpPost("unpublish")]
    public async Task<ActionResult<AssessmentResponse>> Unpublish(string slug, Guid lessonId, CancellationToken ct)
        => Run(await assessments.UnpublishAsync(slug, Caller(), lessonId, ct));

    /// <summary>Simulated AI: proposes timestamped checkpoints. Nothing is persisted until accepted via AddQuestion.</summary>
    [HttpPost("ai-suggest")]
    public async Task<ActionResult<IReadOnlyList<SuggestedQuestion>>> SuggestQuestions(
        string slug, Guid lessonId, [FromBody] AiSuggestQuestionsRequest request, CancellationToken ct)
        => Run(await assessments.SuggestQuestionsAsync(slug, Caller(), lessonId, request, ct));

    /// <summary>Simulated AI grading against the authored answer key. A preview only — no Submission is recorded.</summary>
    [HttpPost("preview")]
    public async Task<ActionResult<PreviewResult>> Preview(
        string slug, Guid lessonId, [FromBody] PreviewSubmitRequest request, CancellationToken ct)
        => Run(await assessments.PreviewAsync(slug, Caller(), lessonId, request, ct));

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
