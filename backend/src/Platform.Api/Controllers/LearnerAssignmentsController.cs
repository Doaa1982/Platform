using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Platform.Api.Models;
using Platform.Api.Services;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace Platform.Api.Controllers;

/// <summary>Learner-facing: every Assignment targeting this learner, across every course they're enrolled in.</summary>
[ApiController]
[Route("api/workspaces/{slug}/learn/assignments")]
[Authorize]
public class LearnerAssignmentsController(AssignmentService assignments) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<LearnerAssignmentListResponse>> GetMine(string slug, CancellationToken ct)
        => Run(await assignments.GetMyAssignmentsAsync(slug, Caller(), ct));

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

/// <summary>Learner-facing: one Assignment's detail and this learner's own submissions against it.</summary>
[ApiController]
[Route("api/workspaces/{slug}/learn/lessons/{lessonId:guid}/activities/{activityId:guid}/assignment")]
[Authorize]
public class LearnerAssignmentController(AssignmentService assignments) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<LearnerAssignmentDetailResponse>> Get(string slug, Guid lessonId, Guid activityId, CancellationToken ct)
        => Run(await assignments.GetMyAssignmentAsync(slug, Caller(), lessonId, activityId, ct));

    [HttpPost("start")]
    public async Task<ActionResult<LearnerSubmissionRow>> Start(string slug, Guid lessonId, Guid activityId, CancellationToken ct)
        => Run(await assignments.StartSubmissionAsync(slug, Caller(), lessonId, activityId, ct));

    [HttpPost("submissions/{submissionId:guid}/respond")]
    public async Task<ActionResult<LearnerSubmissionRow>> Respond(
        string slug, Guid lessonId, Guid activityId, Guid submissionId, [FromBody] RecordAssignmentResponseRequest request, CancellationToken ct)
        => Run(await assignments.RecordResponseAsync(slug, Caller(), lessonId, activityId, submissionId, request, ct));

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
