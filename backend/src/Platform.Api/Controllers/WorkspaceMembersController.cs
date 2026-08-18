using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Platform.Api.Models;
using Platform.Api.Services;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace Platform.Api.Controllers;

/// <summary>
/// Member management inside one Workspace — the tutor's own surface.
///
/// Authority is Workspace-scoped and resolved per request from the caller's
/// Membership, never from a token claim, so a role removed a second ago is
/// gone immediately. This is the counterpart to AdminController, whose
/// authority deliberately comes from no Membership at all.
/// </summary>
[ApiController]
[Route("api/workspaces/{slug}")]
[Authorize]
public class WorkspaceMembersController(WorkspaceMemberService members) : ControllerBase
{
    /// <summary>GET /api/workspaces/{slug}/members — members and invitations.</summary>
    [HttpGet("members")]
    public async Task<ActionResult<WorkspaceMembersResponse>> List(string slug, CancellationToken ct)
        => Run(await members.ListAsync(slug, Caller(), ct));

    /// <summary>POST /api/workspaces/{slug}/invitations — invite someone in.</summary>
    [HttpPost("invitations")]
    public async Task<ActionResult<InvitationIssuedResponse>> Invite(
        string slug, [FromBody] InviteMemberRequest request, CancellationToken ct)
        => Run(await members.InviteAsync(slug, Caller(), request, ct));

    /// <summary>
    /// POST /api/workspaces/{slug}/invitations/bulk — invite many people at
    /// once (§4). Each recipient gets its own independent Invitation; a bad
    /// recipient is skipped, not a reason to fail the whole request (Rule 4).
    /// </summary>
    [HttpPost("invitations/bulk")]
    public async Task<ActionResult<BulkInvitationIssuedResponse>> InviteBulk(
        string slug, [FromBody] BulkInviteMemberRequest request, CancellationToken ct)
        => Run(await members.InviteBulkAsync(slug, Caller(), request, ct));

    /// <summary>
    /// POST /api/workspaces/{slug}/invitations/{invitationId}/resend — fresh
    /// token, reset expiry, same Invitation. Legal from Sent or Expired only (§9).
    /// </summary>
    [HttpPost("invitations/{invitationId:guid}/resend")]
    public async Task<ActionResult<InvitationIssuedResponse>> ResendInvitation(
        string slug, Guid invitationId, CancellationToken ct)
        => Run(await members.ResendInvitationAsync(slug, Caller(), invitationId, ct));

    /// <summary>
    /// POST /api/workspaces/{slug}/invitations/{invitationId}/cancel — legal
    /// before acceptance only (§9); once Accepted, use Membership Remove instead.
    /// </summary>
    [HttpPost("invitations/{invitationId:guid}/cancel")]
    public async Task<IActionResult> CancelInvitation(string slug, Guid invitationId, CancellationToken ct)
        => Run(await members.CancelInvitationAsync(slug, Caller(), invitationId, ct));

    /// <summary>
    /// Pending → Active. Acceptance already activates a Membership, so this is
    /// for the ones created another way, and for reversing an archive decision
    /// before it takes hold.
    /// </summary>
    [HttpPost("members/{membershipId:guid}/activate")]
    public async Task<IActionResult> Activate(string slug, Guid membershipId, CancellationToken ct)
        => Run(await members.ActivateAsync(slug, Caller(), membershipId, ct));

    [HttpPost("members/{membershipId:guid}/suspend")]
    public async Task<IActionResult> Suspend(string slug, Guid membershipId, CancellationToken ct)
        => Run(await members.SuspendAsync(slug, Caller(), membershipId, ct));

    [HttpPost("members/{membershipId:guid}/reinstate")]
    public async Task<IActionResult> Reinstate(string slug, Guid membershipId, CancellationToken ct)
        => Run(await members.ReinstateAsync(slug, Caller(), membershipId, ct));

    [HttpPost("members/{membershipId:guid}/archive")]
    public async Task<IActionResult> Archive(string slug, Guid membershipId, CancellationToken ct)
        => Run(await members.ArchiveAsync(slug, Caller(), membershipId, ct));

    /// <summary>Ends the relationship. Never touches the underlying Identity (INV-004).</summary>
    [HttpPost("members/{membershipId:guid}/remove")]
    public async Task<IActionResult> Remove(string slug, Guid membershipId, CancellationToken ct)
        => Run(await members.RemoveAsync(slug, Caller(), membershipId, ct));

    [HttpPost("members/{membershipId:guid}/roles")]
    public async Task<IActionResult> AssignRole(
        string slug, Guid membershipId, [FromBody] MemberRoleRequest request, CancellationToken ct)
        => Run(await members.AssignRoleAsync(slug, Caller(), membershipId, request.Role, ct));

    [HttpDelete("members/{membershipId:guid}/roles/{role}")]
    public async Task<IActionResult> RemoveRole(
        string slug, Guid membershipId, string role, CancellationToken ct)
        => Run(await members.RemoveRoleAsync(slug, Caller(), membershipId, role, ct));

    /// <summary>
    /// POST /api/workspaces/{slug}/members/{membershipId}/enroll — enrol an
    /// already-Active member into a Published course (§12.3). The "payment
    /// confirmed" action; never implicit.
    /// </summary>
    [HttpPost("members/{membershipId:guid}/enroll")]
    public async Task<ActionResult<WorkspaceMemberRow>> Enroll(
        string slug, Guid membershipId, [FromBody] EnrollMemberRequest request, CancellationToken ct)
        => Run(await members.EnrollMemberAsync(slug, Caller(), membershipId, request.LearningProductId, ct));

    // ── Helpers ──────────────────────────────────────────────────────────────

    private ActionResult<T> Run<T>(ProvisioningResult<T> result) => result.Error switch
    {
        ProvisioningError.None      => Ok(result.Value),
        ProvisioningError.NotFound  => NotFound(new { message = result.Message }),
        ProvisioningError.Conflict  => Conflict(new { message = result.Message }),
        ProvisioningError.Forbidden => StatusCode(StatusCodes.Status403Forbidden, new { message = result.Message }),
        _                           => BadRequest(new { message = result.Message }),
    };

    private IActionResult Run(ProvisioningResult<string> result) => result.Error switch
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
