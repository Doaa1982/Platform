using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Platform.Api.Models;
using Platform.Api.Services;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace Platform.Api.Controllers;

/// <summary>Browsing Published products and their Published curriculum, as a Learner.</summary>
[ApiController]
[Route("api/workspaces/{slug}/learn")]
[Authorize]
public class LearningDeliveryController(LearningDeliveryService delivery, CourseJoinRequestService courseJoinRequests) : ControllerBase
{
    [HttpGet("products")]
    public async Task<ActionResult<LearnerProductListResponse>> GetProducts(string slug, CancellationToken ct)
        => Run(await delivery.GetMyProductsAsync(slug, Caller(), ct));

    /// <summary>Asks for access to one ApprovalRequired course. See CourseJoinRequestService.SubmitAsync.</summary>
    [HttpPost("products/{productId:guid}/join-request")]
    public async Task<IActionResult> RequestToJoin(
        string slug, Guid productId, [FromBody] SubmitCourseJoinRequest request, CancellationToken ct)
        => RunStatus(await courseJoinRequests.SubmitAsync(slug, Caller(), productId, request, ct));

    [HttpGet("products/{productId:guid}/curriculum")]
    public async Task<ActionResult<LearnerCurriculumResponse>> GetCurriculum(string slug, Guid productId, CancellationToken ct)
        => Run(await delivery.GetCurriculumAsync(slug, Caller(), productId, ct));

    [HttpGet("stats")]
    public async Task<ActionResult<LearnerStatsResponse>> GetStats(string slug, CancellationToken ct)
        => Run(await delivery.GetStatsAsync(slug, Caller(), ct));

    [HttpGet("assessments")]
    public async Task<ActionResult<LearnerAssessmentsResponse>> GetMyAssessments(string slug, CancellationToken ct)
        => Run(await delivery.GetMyAssessmentsAsync(slug, Caller(), ct));

    private ActionResult<T> Run<T>(ProvisioningResult<T> r) => r.Error switch
    {
        ProvisioningError.None      => Ok(r.Value),
        ProvisioningError.NotFound  => NotFound(new { message = r.Message }),
        ProvisioningError.Conflict  => Conflict(new { message = r.Message }),
        ProvisioningError.Forbidden => StatusCode(StatusCodes.Status403Forbidden, new { message = r.Message }),
        _                           => BadRequest(new { message = r.Message }),
    };

    private IActionResult RunStatus(ProvisioningResult<string> r) => r.Error switch
    {
        ProvisioningError.None      => Ok(new { status = r.Value }),
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

/// <summary>Watching one lesson's video and answering its questions, as a Learner.</summary>
[ApiController]
[Route("api/workspaces/{slug}/learn/lessons/{lessonId:guid}")]
[Authorize]
public class LearnerLessonsController(LearningDeliveryService delivery) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<LearnerLessonResponse>> Get(string slug, Guid lessonId, CancellationToken ct)
        => Run(await delivery.GetLessonAsync(slug, Caller(), lessonId, ct));

    [HttpPost("video-watched")]
    public async Task<ActionResult<LearnerLessonResponse>> MarkVideoWatched(string slug, Guid lessonId, CancellationToken ct)
        => Run(await delivery.MarkVideoWatchedAsync(slug, Caller(), lessonId, ct));

    /// <summary>Grades and persists a real Submission — see LearningDeliveryService.SubmitAssessmentAsync.</summary>
    [HttpPost("submit")]
    public async Task<ActionResult<PreviewResult>> Submit(
        string slug, Guid lessonId, [FromBody] SubmitAnswersRequest request, CancellationToken ct)
        => Run(await delivery.SubmitAssessmentAsync(slug, Caller(), lessonId, request, ct));

    /// <summary>Grades and persists a real Submission against the lesson's Standalone quiz — see LearningDeliveryService.SubmitStandaloneAssessmentAsync.</summary>
    [HttpPost("standalone-assessment/submit")]
    public async Task<ActionResult<PreviewResult>> SubmitStandalone(
        string slug, Guid lessonId, [FromBody] SubmitAnswersRequest request, CancellationToken ct)
        => Run(await delivery.SubmitStandaloneAssessmentAsync(slug, Caller(), lessonId, request, ct));

    /// <summary>The in-lesson AI Assistant — answers grounded in this lesson's own material only. See LearningDeliveryService.AskAssistantAsync.</summary>
    [HttpPost("ask")]
    public async Task<ActionResult<AskLessonAssistantResponse>> Ask(
        string slug, Guid lessonId, [FromBody] AskLessonAssistantRequest request, CancellationToken ct)
        => Run(await delivery.AskAssistantAsync(slug, Caller(), lessonId, request.Question, ct));

    /// <summary>Studio "Quiz" — an on-demand, ungraded self-check generated from this lesson. See LearningDeliveryService.GenerateLessonQuizAsync.</summary>
    [HttpPost("practice-quiz")]
    public async Task<ActionResult<GenerateLessonQuizResponse>> GenerateQuiz(
        string slug, Guid lessonId, [FromBody] GenerateLessonQuizRequest request, CancellationToken ct)
        => Run(await delivery.GenerateLessonQuizAsync(slug, Caller(), lessonId, request, ct));

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
