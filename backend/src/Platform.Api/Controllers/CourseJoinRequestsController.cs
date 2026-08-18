using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Platform.Api.Models;
using Platform.Api.Services;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace Platform.Api.Controllers;

/// <summary>
/// Course Join Requests — the reviewer's side. Submission itself lives on
/// LearningDeliveryController (POST .../learn/products/{id}/join-request),
/// since it's part of the Learner delivery surface; this controller is only
/// the Owner/Administrator queue, mirroring JoinRequestsController's own split.
/// </summary>
[ApiController]
[Route("api/workspaces/{slug}/course-join-requests")]
[Authorize]
public class CourseJoinRequestsController(CourseJoinRequestService courseJoinRequests) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CourseJoinRequestRow>>> List(string slug, CancellationToken ct)
        => Run(await courseJoinRequests.ListForReviewAsync(slug, Caller(), ct));

    [HttpPost("{id:guid}/approve")]
    public async Task<IActionResult> Approve(string slug, Guid id, CancellationToken ct)
        => RunStatus(await courseJoinRequests.ApproveAsync(slug, Caller(), id, ct));

    [HttpPost("{id:guid}/decline")]
    public async Task<IActionResult> Decline(string slug, Guid id, CancellationToken ct)
        => RunStatus(await courseJoinRequests.DeclineAsync(slug, Caller(), id, ct));

    private ActionResult<T> Run<T>(ProvisioningResult<T> result) => result.Error switch
    {
        ProvisioningError.None      => Ok(result.Value),
        ProvisioningError.NotFound  => NotFound(new { message = result.Message }),
        ProvisioningError.Conflict  => Conflict(new { message = result.Message }),
        ProvisioningError.Forbidden => StatusCode(StatusCodes.Status403Forbidden, new { message = result.Message }),
        _                           => BadRequest(new { message = result.Message }),
    };

    private IActionResult RunStatus(ProvisioningResult<string> result) => result.Error switch
    {
        ProvisioningError.None      => Ok(new { status = result.Value }),
        ProvisioningError.NotFound  => NotFound(new { message = result.Message }),
        ProvisioningError.Conflict  => Conflict(new { message = result.Message }),
        ProvisioningError.Forbidden => StatusCode(StatusCodes.Status403Forbidden, new { message = result.Message }),
        _                           => BadRequest(new { message = result.Message }),
    };

    private Guid Caller()
    {
        var raw = User.FindFirstValue(ClaimTypes.NameIdentifier)
               ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);
        return Guid.TryParse(raw, out var id) ? id : Guid.Empty;
    }
}
