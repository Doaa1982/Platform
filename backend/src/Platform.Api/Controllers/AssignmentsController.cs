using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Platform.Api.Models;
using Platform.Api.Services;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace Platform.Api.Controllers;

/// <summary>Tutor-facing: the Assignment delivering one Learning Activity — create, configure, and drive its lifecycle.</summary>
[ApiController]
[Route("api/workspaces/{slug}/lessons/{lessonId:guid}/activities/{activityId:guid}/assignment")]
[Authorize]
public class AssignmentsController(AssignmentService assignments) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<AssignmentResponse>> Get(string slug, Guid lessonId, Guid activityId, CancellationToken ct)
        => Run(await assignments.GetAsync(slug, Caller(), lessonId, activityId, ct));

    [HttpPost]
    public async Task<ActionResult<AssignmentResponse>> Create(string slug, Guid lessonId, Guid activityId, CancellationToken ct)
        => Run(await assignments.CreateAssignmentAsync(slug, Caller(), lessonId, activityId, ct));

    [HttpPut]
    public async Task<ActionResult<AssignmentResponse>> Configure(
        string slug, Guid lessonId, Guid activityId, [FromBody] ConfigureAssignmentRequest request, CancellationToken ct)
        => Run(await assignments.ConfigureAssignmentAsync(slug, Caller(), lessonId, activityId, request, ct));

    [HttpPost("publish")]
    public async Task<ActionResult<AssignmentResponse>> Publish(string slug, Guid lessonId, Guid activityId, CancellationToken ct)
        => Run(await assignments.PublishAssignmentAsync(slug, Caller(), lessonId, activityId, ct));

    [HttpPost("close")]
    public async Task<ActionResult<AssignmentResponse>> Close(string slug, Guid lessonId, Guid activityId, CancellationToken ct)
        => Run(await assignments.CloseAssignmentAsync(slug, Caller(), lessonId, activityId, ct));

    [HttpPost("archive")]
    public async Task<ActionResult<AssignmentResponse>> Archive(string slug, Guid lessonId, Guid activityId, CancellationToken ct)
        => Run(await assignments.ArchiveAssignmentAsync(slug, Caller(), lessonId, activityId, ct));

    /// <summary>A due date may only move later (Assignment BA-007).</summary>
    [HttpPost("due-date")]
    public async Task<ActionResult<AssignmentResponse>> ExtendDueDate(
        string slug, Guid lessonId, Guid activityId, [FromBody] ExtendAssignmentDueDateRequest request, CancellationToken ct)
        => Run(await assignments.ExtendDueDateAsync(slug, Caller(), lessonId, activityId, request.NewDueAt, ct));

    /// <summary>May be raised freely; refused below the most attempts any one learner has already used (INV-006).</summary>
    [HttpPost("attempt-limit")]
    public async Task<ActionResult<AssignmentResponse>> ChangeAttemptLimit(
        string slug, Guid lessonId, Guid activityId, [FromBody] ChangeAssignmentAttemptLimitRequest request, CancellationToken ct)
        => Run(await assignments.ChangeAttemptLimitAsync(slug, Caller(), lessonId, activityId, request.NewMaxAttempts, ct));

    /// <summary>Resets one learner's used-attempt count (Assignment BA-011) — their prior attempts are kept as history, just excluded from the limit.</summary>
    [HttpPost("attempts/{membershipId:guid}/reset")]
    public async Task<ActionResult<AssignmentResponse>> ResetAttemptCount(
        string slug, Guid lessonId, Guid activityId, Guid membershipId, CancellationToken ct)
        => Run(await assignments.ResetAttemptCountAsync(slug, Caller(), lessonId, activityId, membershipId, ct));

    [HttpPost("visibility")]
    public async Task<ActionResult<AssignmentResponse>> ChangeVisibility(
        string slug, Guid lessonId, Guid activityId, [FromBody] ChangeAssignmentVisibilityRequest request, CancellationToken ct)
        => Run(await assignments.ChangeVisibilityAsync(slug, Caller(), lessonId, activityId, request.Visible, ct));

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
