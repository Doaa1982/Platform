using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Platform.Api.Models;
using Platform.Api.Services;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace Platform.Api.Controllers;

/// <summary>Tutor-facing: the workspace-wide Assignments dashboard and per-assignment grading queue.</summary>
[ApiController]
[Route("api/workspaces/{slug}/assignments")]
[Authorize]
public class AssignmentsOverviewController(AssignmentService assignments) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<AssignmentOverviewResponse>> GetOverview(string slug, CancellationToken ct)
        => Run(await assignments.GetOverviewAsync(slug, Caller(), ct));

    [HttpGet("lessons/{lessonId:guid}/activities/{activityId:guid}/submissions")]
    public async Task<ActionResult<AssignmentSubmissionsResponse>> GetSubmissions(
        string slug, Guid lessonId, Guid activityId, CancellationToken ct)
        => Run(await assignments.GetSubmissionsAsync(slug, Caller(), lessonId, activityId, ct));

    [HttpPost("lessons/{lessonId:guid}/activities/{activityId:guid}/submissions/{submissionId:guid}/begin-review")]
    public async Task<ActionResult<AssignmentSubmissionRow>> BeginReview(
        string slug, Guid lessonId, Guid activityId, Guid submissionId, CancellationToken ct)
        => Run(await assignments.BeginReviewAsync(slug, Caller(), lessonId, activityId, submissionId, ct));

    [HttpPost("lessons/{lessonId:guid}/activities/{activityId:guid}/submissions/{submissionId:guid}/evaluate")]
    public async Task<ActionResult<AssignmentSubmissionRow>> EvaluateSubmission(
        string slug, Guid lessonId, Guid activityId, Guid submissionId, [FromBody] EvaluateSubmissionRequest request, CancellationToken ct)
        => Run(await assignments.EvaluateSubmissionAsync(slug, Caller(), lessonId, activityId, submissionId, request, ct));

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
