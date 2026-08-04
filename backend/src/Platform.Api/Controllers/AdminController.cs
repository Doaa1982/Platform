using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Platform.Api.Authorization;
using Platform.Api.Models;
using Platform.Api.Services;
using Platform.Domain;
using Platform.Infrastructure;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace Platform.Api.Controllers;

/// <summary>
/// Platform Administrator operations — the platform's first cross-Workspace
/// surface (Platform Administrator Business Analysis).
///
/// Every route requires an Active PlatformOperator grant, checked per request
/// against the database rather than from a token claim, so revoking a grant
/// takes effect immediately. Authority here deliberately does not come from any
/// Membership (BA-001): an admin acts on Workspaces they are not a member of,
/// including brand-new ones with no members at all.
/// </summary>
[ApiController]
[Route("api/admin")]
[Authorize(Policy = PlatformOperatorRequirement.PolicyName)]
public class AdminController(
    PlatformDbContext db,
    ProvisioningService provisioning) : ControllerBase
{
    /// <summary>
    /// GET /api/admin/workspaces
    /// The provisioning view (§9): every Workspace with its composed status.
    /// </summary>
    [HttpGet("workspaces")]
    public async Task<ActionResult<IReadOnlyList<ProvisioningRow>>> GetWorkspaces(CancellationToken ct)
        => Ok(await provisioning.GetProvisioningViewAsync(ct));

    /// <summary>
    /// POST /api/admin/workspaces
    /// Provisions a Workspace for a subscribed Tutor and invites them to own it (§7).
    /// The Workspace begins unowned; ownership transfers on acceptance.
    /// </summary>
    [HttpPost("workspaces")]
    public async Task<ActionResult<InvitationIssuedResponse>> Provision(
        [FromBody] ProvisionWorkspaceRequest request, CancellationToken ct)
    {
        if (!TryGetIdentityId(out var adminIdentityId))
            return Unauthorized(new { message = "Token does not carry a valid identity." });

        var result = await provisioning.ProvisionAsync(request, adminIdentityId, ct);
        return result.Ok ? Ok(result.Value) : Problem(result);
    }

    /// <summary>
    /// POST /api/admin/invitations/{id}/resend
    /// Issues a fresh token on the same Invitation and resets its expiry — it
    /// does not create a second, parallel Invitation (§10, Resend Rules).
    /// </summary>
    [HttpPost("invitations/{id:guid}/resend")]
    public async Task<ActionResult<InvitationIssuedResponse>> Resend(Guid id, CancellationToken ct)
    {
        var result = await provisioning.ResendAsync(id, ct);
        return result.Ok ? Ok(result.Value) : Problem(result);
    }

    /// <summary>
    /// POST /api/admin/invitations/{id}/cancel
    /// Withdraws an offer that was never accepted. Distinct from removing a
    /// Membership, which ends a relationship that already exists.
    /// </summary>
    [HttpPost("invitations/{id:guid}/cancel")]
    public async Task<IActionResult> Cancel(Guid id, CancellationToken ct)
    {
        var result = await provisioning.CancelAsync(id, ct);
        return result.Ok ? NoContent() : Problem(result);
    }

    /// <summary>
    /// POST /api/admin/workspaces/{id}/suspend — platform-level suspension.
    /// These commands existed on the aggregate from the start with nothing
    /// authorized to call them; this is the home the analysis identified.
    /// </summary>
    [HttpPost("workspaces/{id:guid}/suspend")]
    public Task<IActionResult> SuspendWorkspace(Guid id, CancellationToken ct)
        => MutateWorkspace(id, w => w.Suspend(), ct);

    [HttpPost("workspaces/{id:guid}/reinstate")]
    public Task<IActionResult> ReinstateWorkspace(Guid id, CancellationToken ct)
        => MutateWorkspace(id, w => w.Reinstate(), ct);

    [HttpPost("workspaces/{id:guid}/archive")]
    public Task<IActionResult> ArchiveWorkspace(Guid id, CancellationToken ct)
        => MutateWorkspace(id, w => w.Archive(), ct);

    /// <summary>GET /api/admin/identities — platform-wide Identity list.</summary>
    [HttpGet("identities")]
    public async Task<IActionResult> GetIdentities(CancellationToken ct)
    {
        var identities = await db.Identities.AsNoTracking()
            .OrderBy(i => i.Email)
            .Select(i => new { i.Id, i.Email, i.FullName, Status = i.Status.ToString(), i.CreatedAt })
            .ToListAsync(ct);

        return Ok(identities);
    }

    [HttpPost("identities/{id:guid}/suspend")]
    public Task<IActionResult> SuspendIdentity(Guid id, CancellationToken ct)
        => MutateIdentity(id, i => i.Suspend(), ct);

    [HttpPost("identities/{id:guid}/reactivate")]
    public Task<IActionResult> ReactivateIdentity(Guid id, CancellationToken ct)
        => MutateIdentity(id, i => i.Reactivate(), ct);

    // ── Helpers ──────────────────────────────────────────────────────────────

    private async Task<IActionResult> MutateWorkspace(Guid id, Action<Workspace> mutate, CancellationToken ct)
    {
        var workspace = await db.Workspaces.FirstOrDefaultAsync(w => w.Id == id, ct);
        if (workspace is null) return NotFound(new { message = "No such workspace." });

        try { mutate(workspace); }
        // The aggregate rejects illegal lifecycle moves; report rather than 500
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }

        await db.SaveChangesAsync(ct);
        return Ok(new { status = workspace.Status.ToString() });
    }

    private async Task<IActionResult> MutateIdentity(Guid id, Action<Identity> mutate, CancellationToken ct)
    {
        var identity = await db.Identities.FirstOrDefaultAsync(i => i.Id == id, ct);
        if (identity is null) return NotFound(new { message = "No such identity." });

        try { mutate(identity); }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }

        await db.SaveChangesAsync(ct);
        return Ok(new { status = identity.Status.ToString() });
    }

    private ObjectResult Problem<T>(ProvisioningResult<T> result) => result.Error switch
    {
        ProvisioningError.NotFound  => NotFound(new { message = result.Message }),
        ProvisioningError.Conflict  => Conflict(new { message = result.Message }),
        ProvisioningError.Forbidden => StatusCode(StatusCodes.Status403Forbidden, new { message = result.Message }),
        _                           => BadRequest(new { message = result.Message }),
    };

    private bool TryGetIdentityId(out Guid identityId)
    {
        var raw = User.FindFirstValue(ClaimTypes.NameIdentifier)
               ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);
        return Guid.TryParse(raw, out identityId);
    }
}
