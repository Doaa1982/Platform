using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Platform.Api.Models;
using Platform.Api.Services;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace Platform.Api.Controllers;

/// <summary>
/// Join Requests — the only inbound path to Membership.
///
/// Submission is anonymous and account-free (§11): a stranger who has found a
/// published Workspace files a name, email and message, nothing more. That is
/// also what makes this the most exposed endpoint in the API, so it is the
/// one carrying a rate limit.
/// </summary>
[ApiController]
[Route("api")]
public class JoinRequestsController(JoinRequestService joinRequests) : ControllerBase
{
    /// <summary>
    /// GET /api/workspaces/{slug}/join — what a stranger sees before asking.
    /// Anonymous. Reports a non-discoverable Workspace as not found.
    /// </summary>
    [HttpGet("workspaces/{slug}/join")]
    [EnableRateLimiting(RateLimitPolicies.PublicRead)]
    public async Task<ActionResult<JoinPreview>> Preview(string slug, CancellationToken ct)
        => Run(await joinRequests.PreviewAsync(slug, ct));

    /// <summary>
    /// POST /api/workspaces/{slug}/join — ask to join.
    ///
    /// Anonymous, and rate limited. Files interest data only — no Identity is
    /// created here, so this stays the lightest-weight surface in the API even
    /// though it is reachable by anyone (§11).
    /// </summary>
    [HttpPost("workspaces/{slug}/join")]
    [EnableRateLimiting(RateLimitPolicies.JoinRequests)]
    public async Task<ActionResult<JoinRequestReceipt>> Submit(
        string slug, [FromBody] SubmitJoinRequest request, CancellationToken ct)
        => Run(await joinRequests.SubmitAsync(slug, request, ct));

    /// <summary>
    /// GET /api/join-requests/status/{token} — the Join Request Status Link
    /// (§16, "Checking back without an Identity" — TD-018). Not workspace-scoped
    /// in the route: the token itself resolves everything, the same shape as
    /// InvitationsController's GET /api/invite/{token}.
    /// </summary>
    [HttpGet("join-requests/status/{token}")]
    [EnableRateLimiting(RateLimitPolicies.PublicRead)]
    public async Task<ActionResult<JoinRequestStatusResponse>> Status(string token, CancellationToken ct)
        => Run(await joinRequests.GetStatusAsync(token, ct));

    /// <summary>GET /api/workspaces/{slug}/join-requests — the reviewer's queue.</summary>
    [HttpGet("workspaces/{slug}/join-requests")]
    [Authorize]
    public async Task<ActionResult<IReadOnlyList<JoinRequestRow>>> List(string slug, CancellationToken ct)
        => Run(await joinRequests.ListAsync(slug, Caller(), ct));

    /// <summary>Approve — issues a real Invitation to the request's email.</summary>
    [HttpPost("workspaces/{slug}/join-requests/{id:guid}/approve")]
    [Authorize]
    public async Task<IActionResult> Approve(string slug, Guid id, CancellationToken ct)
        => RunStatus(await joinRequests.ApproveAsync(slug, Caller(), id, ct));

    /// <summary>Decline — creates nothing, and carries no reason (BA-006).</summary>
    [HttpPost("workspaces/{slug}/join-requests/{id:guid}/decline")]
    [Authorize]
    public async Task<IActionResult> Decline(string slug, Guid id, CancellationToken ct)
        => RunStatus(await joinRequests.DeclineAsync(slug, Caller(), id, ct));

    // ── Helpers ──────────────────────────────────────────────────────────────

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
