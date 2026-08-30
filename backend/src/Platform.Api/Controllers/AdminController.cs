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
    ProvisioningService provisioning,
    SignupRequestService signups,
    CommercialOpsService commercialOps) : ControllerBase
{
    // ── Tutor Signup Requests (§7.1) ─────────────────────────────────────────

    /// <summary>GET /api/admin/signup-requests — the application queue.</summary>
    [HttpGet("signup-requests")]
    public async Task<ActionResult<IReadOnlyList<SignupRequestRow>>> GetSignupRequests(CancellationToken ct)
        => Ok(await signups.ListAsync(ct));

    /// <summary>
    /// Approves an application — immediately ready for provisioning (§7.2).
    /// There is no payment gate to wait on any more (2026-08-24 correction):
    /// which plan the resulting Workspace ends up on, free or paid, is decided
    /// later and separately, at Subscription checkout.
    /// </summary>
    [HttpPost("signup-requests/{id:guid}/approve")]
    public async Task<IActionResult> ApproveSignup(Guid id, CancellationToken ct)
    {
        if (!TryGetIdentityId(out var reviewer))
            return Unauthorized(new { message = "Token does not carry a valid identity." });

        var result = await signups.ApproveAsync(id, reviewer, ct);
        return result.Ok ? Ok(new { status = result.Value }) : Problem(result);
    }

    /// <summary>Rejects an application (BA-007). A decision about the applicant, and terminal.</summary>
    [HttpPost("signup-requests/{id:guid}/reject")]
    public async Task<IActionResult> RejectSignup(
        Guid id, [FromBody] RejectSignupRequest request, CancellationToken ct)
    {
        if (!TryGetIdentityId(out var reviewer))
            return Unauthorized(new { message = "Token does not carry a valid identity." });

        var result = await signups.RejectAsync(id, reviewer, request, ct);
        return result.Ok ? Ok(new { status = result.Value }) : Problem(result);
    }

    /// <summary>
    /// POST /api/admin/signup-requests/{id}/provision — §7.2 for an approved applicant.
    ///
    /// Provisioning stays admin-initiated rather than firing automatically on
    /// payment (BA-004's Version 1 recommendation), but the application is
    /// recorded against the Workspace so it can only happen once.
    /// </summary>
    [HttpPost("signup-requests/{id:guid}/provision")]
    public async Task<ActionResult<InvitationIssuedResponse>> ProvisionForSignup(
        Guid id, [FromBody] ProvisionWorkspaceRequest request, CancellationToken ct)
    {
        if (!TryGetIdentityId(out var adminIdentityId))
            return Unauthorized(new { message = "Token does not carry a valid identity." });

        var provisioned = await provisioning.ProvisionAsync(request, adminIdentityId, ct);
        if (!provisioned.Ok) return Problem(provisioned);

        // Link the application to its Workspace. If this fails the Workspace
        // still exists, so the failure is surfaced rather than swallowed.
        var workspace = await db.Workspaces
            .FirstOrDefaultAsync(w => w.Slug == request.Slug.ToLowerInvariant().Trim(), ct);

        if (workspace is not null)
        {
            var linked = await signups.MarkProvisionedAsync(id, workspace.Id, ct);
            if (!linked.Ok) return Problem(linked);
        }

        return Ok(provisioned.Value);
    }

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

    // ── Commercial Domain — back-office actions ─────────────────────────────
    //
    // This platform does not collect payment (2026-08-09 correction) — these
    // are the manual, audited actions that stand in for a payment provider's
    // automation: an authorized Platform Operator recording that commercial
    // terms were satisfied, or that they weren't, outside this platform.

    /// <summary>GET /api/admin/subscriptions — every Workspace's commercial state, attention-needing statuses first.</summary>
    [HttpGet("subscriptions")]
    public async Task<ActionResult<IReadOnlyList<SubscriptionAdminRow>>> GetSubscriptions(CancellationToken ct)
        => Ok(await commercialOps.ListSubscriptionsAsync(ct));

    /// <summary>POST /api/admin/invoices/{id}/mark-paid — Manual Commercial Activation (§27a): the actual trigger for Active in this platform.</summary>
    [HttpPost("invoices/{id:guid}/mark-paid")]
    public async Task<ActionResult<SubscriptionSummary>> MarkInvoicePaid(
        Guid id, [FromBody] MarkInvoicePaidRequest request, CancellationToken ct)
    {
        if (!TryGetIdentityId(out var operatorIdentityId))
            return Unauthorized(new { message = "Token does not carry a valid identity." });

        var result = await commercialOps.MarkInvoicePaidAsync(id, operatorIdentityId, request.ReferenceNote, ct);
        return result.Ok ? Ok(result.Value) : Problem(result);
    }

    /// <summary>POST /api/admin/invoices/{id}/void — rejects an Invoice nobody confirmed paying; if it was tied to a requested plan/pack change, withdraws that request too.</summary>
    [HttpPost("invoices/{id:guid}/void")]
    public async Task<ActionResult<SubscriptionSummary>> VoidInvoice(
        Guid id, [FromBody] MarkInvoicePaidRequest request, CancellationToken ct)
    {
        if (!TryGetIdentityId(out var operatorIdentityId))
            return Unauthorized(new { message = "Token does not carry a valid identity." });

        var result = await commercialOps.VoidInvoiceAsync(id, operatorIdentityId, request.ReferenceNote, ct);
        return result.Ok ? Ok(result.Value) : Problem(result);
    }

    /// <summary>
    /// POST /api/admin/invoices/sweep-overdue — no scheduler exists in this
    /// codebase yet (§29's "Overdue Invoice" is date-driven, not payment-driven),
    /// so this is the explicit, operator-triggered equivalent: marks every
    /// issued invoice whose due date has passed Overdue and moves its
    /// Subscription into PastDue.
    /// </summary>
    [HttpPost("invoices/sweep-overdue")]
    public async Task<IActionResult> SweepOverdueInvoices(CancellationToken ct)
        => Ok(new { subscriptionsAffected = await commercialOps.SweepOverdueInvoicesAsync(ct) });

    /// <summary>
    /// POST /api/admin/subscriptions/sweep-renewals — same "no scheduler yet"
    /// reasoning as sweep-overdue: rolls forward every Active subscription
    /// whose current period has elapsed (applying a scheduled downgrade if
    /// one is due, otherwise a plain renewal), which is also what lets that
    /// period's AI credits actually get granted.
    /// </summary>
    [HttpPost("subscriptions/sweep-renewals")]
    public async Task<IActionResult> SweepDueRenewals(CancellationToken ct)
        => Ok(new { subscriptionsAffected = await commercialOps.SweepDueRenewalsAsync(ct) });

    /// <summary>Re-derives entitlements from the current Configuration Snapshot without changing subscription state — for when resolution logic gains a new key after a License was already materialized.</summary>
    [HttpPost("subscriptions/{id:guid}/recompute-entitlements")]
    public async Task<ActionResult<SubscriptionSummary>> RecomputeEntitlements(Guid id, CancellationToken ct)
        => await RunCommercialTransition(id, ct, commercialOps.RecomputeEntitlementsAsync);

    [HttpPost("subscriptions/{id:guid}/advance-to-grace")]
    public async Task<ActionResult<SubscriptionSummary>> AdvanceSubscriptionToGrace(Guid id, CancellationToken ct)
        => await RunCommercialTransition(id, ct, commercialOps.AdvanceToGraceAsync);

    [HttpPost("subscriptions/{id:guid}/suspend")]
    public async Task<ActionResult<SubscriptionSummary>> SuspendSubscription(Guid id, CancellationToken ct)
        => await RunCommercialTransition(id, ct, commercialOps.SuspendAsync);

    [HttpPost("subscriptions/{id:guid}/expire")]
    public async Task<ActionResult<SubscriptionSummary>> ExpireSubscription(Guid id, CancellationToken ct)
        => await RunCommercialTransition(id, ct, commercialOps.ExpireAsync);

    /// <summary>A Platform Operator applies a scheduled Downgrade once its PendingChangeEffectiveDate has arrived — same manual pattern as the transitions above.</summary>
    [HttpPost("subscriptions/{id:guid}/apply-pending-change")]
    public async Task<ActionResult<SubscriptionSummary>> ApplyPendingSubscriptionChange(Guid id, CancellationToken ct)
        => await RunCommercialTransition(id, ct, commercialOps.ApplyPendingChangeAsync);

    private async Task<ActionResult<SubscriptionSummary>> RunCommercialTransition(
        Guid subscriptionId, CancellationToken ct,
        Func<Guid, Guid, CancellationToken, Task<ProvisioningResult<SubscriptionSummary>>> transition)
    {
        if (!TryGetIdentityId(out var operatorIdentityId))
            return Unauthorized(new { message = "Token does not carry a valid identity." });

        var result = await transition(subscriptionId, operatorIdentityId, ct);
        return result.Ok ? Ok(result.Value) : Problem(result);
    }

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
