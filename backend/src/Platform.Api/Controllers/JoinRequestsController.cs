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
/// Submission is anonymous by necessity: a stranger who has found a published
/// Workspace has no account yet, and requiring one would be circular (BA-003).
/// That is also what makes this the most exposed endpoint in the API, so it is
/// the one carrying a rate limit.
/// </summary>
[ApiController]
[Route("api")]
public class JoinRequestsController(JoinRequestService joinRequests, TokenService tokens) : ControllerBase
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
    /// Anonymous, and rate limited: this is the one endpoint that can create an
    /// Identity without any prior relationship (BA-003), so it is the surface
    /// worth guarding.
    /// </summary>
    [HttpPost("workspaces/{slug}/join")]
    [EnableRateLimiting(RateLimitPolicies.JoinRequests)]
    public async Task<ActionResult<LoginResponse>> Submit(
        string slug, [FromBody] SubmitJoinRequest request, CancellationToken ct)
        => Run(await joinRequests.SubmitAsync(slug, request, tokens, ct));

    /// <summary>GET /api/me/join-requests — the requester's own requests.</summary>
    [HttpGet("me/join-requests")]
    [Authorize]
    public async Task<ActionResult<IReadOnlyList<MyJoinRequest>>> Mine(CancellationToken ct)
        => Ok(await joinRequests.MineAsync(Caller(), ct));

    /// <summary>POST /api/me/join-requests/{id}/withdraw — take it back.</summary>
    [HttpPost("me/join-requests/{id:guid}/withdraw")]
    [Authorize]
    public async Task<IActionResult> Withdraw(Guid id, CancellationToken ct)
        => RunStatus(await joinRequests.WithdrawAsync(id, Caller(), ct));

    /// <summary>GET /api/workspaces/{slug}/join-requests — the reviewer's queue.</summary>
    [HttpGet("workspaces/{slug}/join-requests")]
    [Authorize]
    public async Task<ActionResult<IReadOnlyList<JoinRequestRow>>> List(string slug, CancellationToken ct)
        => Run(await joinRequests.ListAsync(slug, Caller(), ct));

    /// <summary>Approve — creates and activates the Membership.</summary>
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
