using Microsoft.EntityFrameworkCore;
using Platform.Api.Models;
using Platform.Domain;
using Platform.Infrastructure;

namespace Platform.Api.Services;

/// <summary>
/// Workspace-facing commercial subscription flow — Subscription Management
/// Architecture. Fixed Plan checkout only (Design-Your-Own-Plan is deferred):
/// a base Solo plan plus optional Capability Packs, resolved through
/// <see cref="ConfigurationService"/> exactly as a Design-Your-Own-Plan
/// selection would be (CR-003/CR-004 — both flow through the same engine, no
/// special-casing).
///
/// Per the 2026-08-09 correction, checkout stops at "invoice issued" —
/// there is no payment step here. Activation happens separately, through
/// <see cref="CommercialOpsService"/>, once an authorized Platform Operator
/// manually marks that invoice paid.
/// </summary>
public class CommercialSubscriptionService(
    PlatformDbContext db, ConfigurationService configuration, LicensingService licensing)
{
    /// <summary>Billing is a commercial decision about the Workspace, not an authoring one — Teacher is deliberately excluded here, unlike LearningProductService's AuthorRoles.</summary>
    private static readonly WorkspaceRoleName[] BillingRoles =
        [WorkspaceRoleName.Owner, WorkspaceRoleName.Administrator, WorkspaceRoleName.FinanceManager];

    public async Task<ProvisioningResult<SubscriptionSummary>> CheckoutAsync(
        string slug, Guid callerIdentityId, CheckoutRequest request, CancellationToken ct = default)
    {
        var ctx = await ResolveAsync(slug, callerIdentityId, requireBillingRole: true, ct);
        if (ctx.Error is not null) return Fail(ctx.Error.Value);

        if (!Enum.TryParse<BillingCycle>(request.BillingCycle, ignoreCase: true, out var billingCycle))
            return Fail((ProvisioningError.Invalid, $"\"{request.BillingCycle}\" is not a billing cycle."));

        var hasOpenSubscription = await db.Subscriptions.AsNoTracking()
            .AnyAsync(s => s.WorkspaceId == ctx.Workspace!.Id
                        && s.Status != SubscriptionStatus.Cancelled && s.Status != SubscriptionStatus.Expired, ct);
        if (hasOpenSubscription)
            return Fail((ProvisioningError.Conflict, "This workspace already has an active or pending subscription."));

        var configResult = await configuration.ResolveAsync(ctx.Workspace!.Id, request.PlanCode, request.PackCodes, billingCycle, ct);
        if (!configResult.Ok) return Fail((configResult.Error, configResult.Message!));
        var snapshot = configResult.Value!;

        // Read the invoice's display data back off the exact Version the snapshot
        // just pinned — not a fresh catalog lookup, so this can never drift from
        // what the snapshot actually priced (Pricing Snapshot Principle).
        var version = await db.CommercialProductVersions.AsNoTracking()
            .FirstAsync(v => v.Id == snapshot.ProductVersionId, ct);
        var product = await db.CommercialProducts.AsNoTracking()
            .FirstAsync(p => p.Id == version.ProductId, ct);

        var billingAccount = await db.BillingAccounts.FirstOrDefaultAsync(b => b.WorkspaceId == ctx.Workspace.Id, ct);
        if (billingAccount is null)
        {
            billingAccount = BillingAccount.Create(ctx.Workspace.Id);
            db.BillingAccounts.Add(billingAccount);
        }

        var subscription = Subscription.Create(ctx.Workspace.Id, billingAccount.Id, snapshot.Id, billingCycle);
        db.Subscriptions.Add(subscription);

        // Recommended invoice structure, Billing Architecture §66 — one line for the
        // base plan, one per selected add-on. Due in 7 days: there is no concrete
        // policy value in any source doc, so a short, reasonable default is used.
        var invoice = Invoice.Create(
            billingAccount.Id, subscription.Id, snapshot.Id,
            subscription.StartDate, subscription.CurrentPeriodEnd,
            dueDate: subscription.StartDate.AddDays(7), snapshot.PriceCurrency);

        invoice.AddLine(
            $"{product.Name} ({billingCycle})", InvoiceComponentType.BasePlan,
            billingCycle == BillingCycle.Annual ? version.AnnualPrice : version.MonthlyPrice);

        var packVersions = await db.CommercialPackVersions.AsNoTracking()
            .Where(v => snapshot.SelectedPackVersionIds.Contains(v.Id))
            .ToListAsync(ct);
        var packNamesById = await db.CommercialPacks.AsNoTracking()
            .Where(p => packVersions.Select(v => v.PackId).Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, p => p.Name, ct);

        foreach (var packVersion in packVersions)
        {
            invoice.AddLine(
                packNamesById.GetValueOrDefault(packVersion.PackId, "Add-on"),
                packVersion.ExtraTutorCapacity > 0 ? InvoiceComponentType.Capacity : InvoiceComponentType.CapabilityPack,
                billingCycle == BillingCycle.Annual ? packVersion.MonthlyPrice * 10m : packVersion.MonthlyPrice);
        }

        invoice.Issue();
        db.Invoices.Add(invoice);

        await db.SaveChangesAsync(ct);
        await licensing.RecomputeLicenseAsync(subscription.Id, ct);

        return ProvisioningResult<SubscriptionSummary>.Success(await BuildSummaryAsync(subscription, ct));
    }

    /// <summary>
    /// SUB-004: cancelling doesn't end access mid-period — the License stays
    /// Active until CancellationEffectiveDate. Reason is optional, customer-
    /// supplied, free text — recorded on the SubscriptionEvent audit trail
    /// (same mechanism CommercialOpsService uses for "InvoiceMarkedPaid" etc.)
    /// purely as a churn signal for Product Advisory (Product Advisory
    /// Architecture §72), never validated or required.
    /// </summary>
    public async Task<ProvisioningResult<SubscriptionSummary>> CancelAsync(
        string slug, Guid callerIdentityId, string? reason, CancellationToken ct = default)
    {
        var ctx = await ResolveAsync(slug, callerIdentityId, requireBillingRole: true, ct);
        if (ctx.Error is not null) return Fail(ctx.Error.Value);

        var subscription = await CurrentSubscriptionAsync(ctx.Workspace!.Id, tracked: true, ct);
        if (subscription is null) return Fail((ProvisioningError.NotFound, "This workspace has no subscription."));

        try { subscription.Cancel(); }
        catch (InvalidOperationException ex) { return Fail((ProvisioningError.Conflict, ex.Message)); }

        db.SubscriptionEvents.Add(SubscriptionEvent.Record(subscription.Id, "Cancelled", callerIdentityId, reason));

        await db.SaveChangesAsync(ct);
        await licensing.RecomputeLicenseAsync(subscription.Id, ct);

        return ProvisioningResult<SubscriptionSummary>.Success(await BuildSummaryAsync(subscription, ct));
    }

    /// <summary>
    /// §17-18: Downgrade is scheduled for period end, not immediate, and only
    /// after Impact Analysis confirms current usage fits the target plan.
    /// Only tutor-seat capacity is checked in this pass (§18's own worked
    /// example) — the same active-seats-plus-open-invitations count
    /// WorkspaceMemberService.CheckTutorCapacityAsync already enforces on
    /// invite, mirrored here rather than shared to avoid coupling this
    /// service to Workspace Access's internals for one query.
    /// </summary>
    public async Task<ProvisioningResult<SubscriptionSummary>> DowngradeAsync(
        string slug, Guid callerIdentityId, DowngradeRequest request, CancellationToken ct = default)
    {
        var ctx = await ResolveAsync(slug, callerIdentityId, requireBillingRole: true, ct);
        if (ctx.Error is not null) return Fail(ctx.Error.Value);

        var subscription = await CurrentSubscriptionAsync(ctx.Workspace!.Id, tracked: true, ct);
        if (subscription is null) return Fail((ProvisioningError.NotFound, "This workspace has no subscription."));

        var configResult = await configuration.ResolveAsync(
            ctx.Workspace.Id, request.PlanCode, request.PackCodes, subscription.BillingCycle, ct);
        if (!configResult.Ok) return Fail((configResult.Error, configResult.Message!));
        var snapshot = configResult.Value!;

        var tutorSeats = await db.Memberships
            .Where(m => m.WorkspaceId == ctx.Workspace.Id && m.Status == MembershipStatus.Active)
            .Where(m => m.Roles.Any(r => TutorSeatRoles.Contains(r.Name)))
            .CountAsync(ct);
        var openTutorInvites = await db.Invitations
            .Where(i => i.WorkspaceId == ctx.Workspace.Id && TutorSeatRoles.Contains(i.IntendedRole))
            .ToListAsync(ct);
        var pendingTutorSeats = openTutorInvites.Count(i => i.IsOpen());

        if (tutorSeats + pendingTutorSeats > snapshot.TutorCapacity)
            return Fail((ProvisioningError.Conflict,
                $"This workspace currently has {tutorSeats + pendingTutorSeats} tutor seat(s) in use "
                + $"(active or pending). The selected plan supports {snapshot.TutorCapacity}. "
                + "Remove a member or let a pending invitation lapse before downgrading."));

        try { subscription.ScheduleDowngrade(snapshot.Id); }
        catch (InvalidOperationException ex) { return Fail((ProvisioningError.Conflict, ex.Message)); }

        db.SubscriptionEvents.Add(SubscriptionEvent.Record(subscription.Id, "DowngradeScheduled", callerIdentityId,
            $"To {snapshot.PlanCode}, effective {subscription.PendingChangeEffectiveDate:yyyy-MM-dd}."));

        await db.SaveChangesAsync(ct);

        return ProvisioningResult<SubscriptionSummary>.Success(await BuildSummaryAsync(subscription, ct));
    }

    /// <summary>
    /// §15-16 / Billing Architecture §25-27: an Upgrade applies immediately
    /// and bills a prorated difference for the remainder of the current
    /// period, rather than waiting for period end like Downgrade. Rejected
    /// if the target isn't actually more expensive at the current billing
    /// cycle — that direction is Downgrade's job, which has its own Impact
    /// Analysis this path doesn't need (an upgrade can only ever grant more
    /// capacity, never less).
    /// </summary>
    public async Task<ProvisioningResult<SubscriptionSummary>> UpgradeAsync(
        string slug, Guid callerIdentityId, UpgradeRequest request, CancellationToken ct = default)
    {
        var ctx = await ResolveAsync(slug, callerIdentityId, requireBillingRole: true, ct);
        if (ctx.Error is not null) return Fail(ctx.Error.Value);

        var subscription = await CurrentSubscriptionAsync(ctx.Workspace!.Id, tracked: true, ct);
        if (subscription is null) return Fail((ProvisioningError.NotFound, "This workspace has no subscription."));

        var oldSnapshot = await db.ConfigurationSnapshots.AsNoTracking()
            .FirstAsync(s => s.Id == subscription.CurrentConfigurationSnapshotId, ct);

        var configResult = await configuration.ResolveAsync(
            ctx.Workspace.Id, request.PlanCode, request.PackCodes, subscription.BillingCycle, ct);
        if (!configResult.Ok) return Fail((configResult.Error, configResult.Message!));
        var newSnapshot = configResult.Value!;

        if (newSnapshot.PriceAmount <= oldSnapshot.PriceAmount)
            return Fail((ProvisioningError.Invalid,
                $"{newSnapshot.PlanCode} ({newSnapshot.PriceAmount} {newSnapshot.PriceCurrency}) is not more expensive than "
                + $"the current plan ({oldSnapshot.PriceAmount} {oldSnapshot.PriceCurrency}). Use Downgrade instead."));

        // §26: (Unused Old Plan Value) vs (Remaining New Plan Value) — this codebase's own
        // worked example computes the charge as New minus Old, not Old minus New as the
        // section header's operand order literally reads; the arithmetic below matches the
        // example, not the header. Period start is derived from CurrentPeriodEnd rather than
        // stored, since no Renew() exists yet to keep a running "period start" field honest
        // across multiple cycles (see Subscription.ApplyPendingChange's own remarks).
        var now = DateTime.UtcNow;
        var periodStart = subscription.BillingCycle == BillingCycle.Annual
            ? subscription.CurrentPeriodEnd.AddYears(-1) : subscription.CurrentPeriodEnd.AddMonths(-1);
        var totalDays = (subscription.CurrentPeriodEnd - periodStart).TotalDays;
        var remainingDays = Math.Clamp((subscription.CurrentPeriodEnd - now).TotalDays, 0, totalDays);
        var prorationFraction = totalDays > 0 ? remainingDays / totalDays : 0;
        var prorationAmount = Math.Round((newSnapshot.PriceAmount - oldSnapshot.PriceAmount) * (decimal)prorationFraction, 2);

        try { subscription.ApplyUpgrade(newSnapshot.Id); }
        catch (InvalidOperationException ex) { return Fail((ProvisioningError.Conflict, ex.Message)); }

        var billingAccount = await db.BillingAccounts.FirstOrDefaultAsync(b => b.WorkspaceId == ctx.Workspace.Id, ct);
        if (billingAccount is null)
            return Fail((ProvisioningError.Conflict, "This workspace has no billing account to invoice the upgrade against."));

        var invoice = Invoice.Create(
            billingAccount.Id, subscription.Id, newSnapshot.Id,
            billingPeriodStart: now, billingPeriodEnd: subscription.CurrentPeriodEnd,
            dueDate: now.AddDays(7), newSnapshot.PriceCurrency);
        invoice.AddLine(
            $"Upgrade proration: {oldSnapshot.PlanCode} → {newSnapshot.PlanCode}",
            InvoiceComponentType.Proration, prorationAmount);
        invoice.Issue();
        db.Invoices.Add(invoice);

        db.SubscriptionEvents.Add(SubscriptionEvent.Record(subscription.Id, "Upgraded", callerIdentityId,
            $"From {oldSnapshot.PlanCode} to {newSnapshot.PlanCode}, prorated {prorationAmount} {newSnapshot.PriceCurrency}."));

        await db.SaveChangesAsync(ct);
        await licensing.RecomputeLicenseAsync(subscription.Id, ct);

        return ProvisioningResult<SubscriptionSummary>.Success(await BuildSummaryAsync(subscription, ct));
    }

    /// <summary>The "Never mind" path for a Cancel itself, mirroring CancelPendingChangeAsync below — undoing is unconditional, no Impact Analysis needed (SUB-004: the Workspace never lost access, so there is nothing to re-check).</summary>
    public async Task<ProvisioningResult<SubscriptionSummary>> ReactivateAsync(
        string slug, Guid callerIdentityId, CancellationToken ct = default)
    {
        var ctx = await ResolveAsync(slug, callerIdentityId, requireBillingRole: true, ct);
        if (ctx.Error is not null) return Fail(ctx.Error.Value);

        var subscription = await CurrentSubscriptionAsync(ctx.Workspace!.Id, tracked: true, ct);
        if (subscription is null) return Fail((ProvisioningError.NotFound, "This workspace has no subscription."));

        try { subscription.Reactivate(); }
        catch (InvalidOperationException ex) { return Fail((ProvisioningError.Conflict, ex.Message)); }

        db.SubscriptionEvents.Add(SubscriptionEvent.Record(subscription.Id, "Reactivated", callerIdentityId, null));

        await db.SaveChangesAsync(ct);
        await licensing.RecomputeLicenseAsync(subscription.Id, ct);

        return ProvisioningResult<SubscriptionSummary>.Success(await BuildSummaryAsync(subscription, ct));
    }

    /// <summary>The "Never mind" path for a scheduled Downgrade — no Impact Analysis needed to undo, only to schedule.</summary>
    public async Task<ProvisioningResult<SubscriptionSummary>> CancelPendingChangeAsync(
        string slug, Guid callerIdentityId, CancellationToken ct = default)
    {
        var ctx = await ResolveAsync(slug, callerIdentityId, requireBillingRole: true, ct);
        if (ctx.Error is not null) return Fail(ctx.Error.Value);

        var subscription = await CurrentSubscriptionAsync(ctx.Workspace!.Id, tracked: true, ct);
        if (subscription is null) return Fail((ProvisioningError.NotFound, "This workspace has no subscription."));

        try { subscription.CancelPendingChange(); }
        catch (InvalidOperationException ex) { return Fail((ProvisioningError.Conflict, ex.Message)); }

        db.SubscriptionEvents.Add(SubscriptionEvent.Record(subscription.Id, "PendingChangeCancelled", callerIdentityId, null));
        await db.SaveChangesAsync(ct);

        return ProvisioningResult<SubscriptionSummary>.Success(await BuildSummaryAsync(subscription, ct));
    }

    /// <summary>Same TutorRoles set as WorkspaceMemberService — Owner/Administrator/Teacher/AssistantTeacher draw against tutor-capacity, Learner/Parent/FinanceManager don't.</summary>
    private static readonly List<WorkspaceRoleName> TutorSeatRoles =
        [WorkspaceRoleName.Owner, WorkspaceRoleName.Administrator, WorkspaceRoleName.Teacher, WorkspaceRoleName.AssistantTeacher];

    public async Task<ProvisioningResult<SubscriptionSummary>> GetCurrentAsync(
        string slug, Guid callerIdentityId, CancellationToken ct = default)
    {
        var ctx = await ResolveAsync(slug, callerIdentityId, requireBillingRole: false, ct);
        if (ctx.Error is not null) return Fail(ctx.Error.Value);

        var subscription = await CurrentSubscriptionAsync(ctx.Workspace!.Id, tracked: false, ct);
        if (subscription is null) return Fail((ProvisioningError.NotFound, "This workspace has no subscription."));

        return ProvisioningResult<SubscriptionSummary>.Success(await BuildSummaryAsync(subscription, ct));
    }

    // ── Shared ───────────────────────────────────────────────────────────────

    private Task<Subscription?> CurrentSubscriptionAsync(Guid workspaceId, bool tracked, CancellationToken ct)
    {
        IQueryable<Subscription> query = db.Subscriptions;
        if (!tracked) query = query.AsNoTracking();
        return query.Where(s => s.WorkspaceId == workspaceId)
                     .OrderByDescending(s => s.CreatedAt)
                     .FirstOrDefaultAsync(ct);
    }

    /// <summary>Internal rather than private — <see cref="CommercialOpsService"/> reuses this so a Platform Operator's action reports the same shape a Workspace member sees.</summary>
    internal async Task<SubscriptionSummary> BuildSummaryAsync(Subscription subscription, CancellationToken ct)
    {
        var snapshot = await db.ConfigurationSnapshots.AsNoTracking()
            .FirstAsync(s => s.Id == subscription.CurrentConfigurationSnapshotId, ct);

        var invoice = await db.Invoices.AsNoTracking()
            .Where(i => i.SubscriptionId == subscription.Id)
            .OrderByDescending(i => i.DueDate)
            .FirstOrDefaultAsync(ct);

        var license = await db.WorkspaceLicenses.AsNoTracking()
            .Include(l => l.Entitlements)
            .FirstOrDefaultAsync(l => l.WorkspaceId == subscription.WorkspaceId, ct);

        string? pendingPlanCode = null;
        if (subscription.PendingConfigurationSnapshotId is { } pendingId)
        {
            pendingPlanCode = (await db.ConfigurationSnapshots.AsNoTracking()
                .FirstOrDefaultAsync(s => s.Id == pendingId, ct))?.PlanCode;
        }

        return new SubscriptionSummary(
            SubscriptionId: subscription.Id,
            Status: subscription.Status.ToString(),
            PlanCode: snapshot.PlanCode,
            SelectedPackCodes: snapshot.SelectedPackCodes.ToList(),
            BillingCycle: subscription.BillingCycle.ToString(),
            StartDate: subscription.StartDate,
            CurrentPeriodEnd: subscription.CurrentPeriodEnd,
            RenewalDate: subscription.RenewalDate,
            CancellationEffectiveDate: subscription.CancellationEffectiveDate,
            PendingPlanCode: pendingPlanCode,
            PendingChangeEffectiveDate: subscription.PendingChangeEffectiveDate,
            CurrentInvoiceId: invoice?.Id,
            CurrentInvoiceStatus: invoice?.Status.ToString(),
            CurrentInvoiceDueDate: invoice?.DueDate,
            CurrentInvoiceAmount: invoice?.TotalAmount,
            CurrentInvoiceCurrency: invoice?.Currency,
            LicenseStatus: license?.Status.ToString() ?? LicenseStatus.Pending.ToString(),
            Entitlements: license?.Entitlements
                .Select(e => new EntitlementRow(e.Type.ToString(), e.Domain?.ToString(), e.Key, e.Value, e.Source.ToString()))
                .ToList() ?? []);
    }

    private record Context(Workspace? Workspace, Guid MembershipId, bool CanManageBilling,
                           (ProvisioningError Error, string Message)? Error);

    /// <summary>A non-member gets 404, never 403 — same reasoning as LearningProductService.ResolveAsync (Workspace Context, Rule 1).</summary>
    private async Task<Context> ResolveAsync(
        string slug, Guid callerIdentityId, bool requireBillingRole, CancellationToken ct)
    {
        var normalised = slug.ToLowerInvariant().Trim();

        var workspace = await db.Workspaces.AsNoTracking().FirstOrDefaultAsync(w => w.Slug == normalised, ct);
        if (workspace is null)
            return new Context(null, Guid.Empty, false, (ProvisioningError.NotFound, "No such workspace."));

        var caller = await db.Memberships
            .Include(m => m.Roles)
            .AsNoTracking()
            .FirstOrDefaultAsync(m => m.WorkspaceId == workspace.Id
                                   && m.IdentityId == callerIdentityId
                                   && m.Status == MembershipStatus.Active, ct);

        if (caller is null)
            return new Context(null, Guid.Empty, false, (ProvisioningError.NotFound, "No such workspace."));

        var canManageBilling = caller.Roles.Any(r => BillingRoles.Contains(r.Name));

        if (requireBillingRole && !canManageBilling)
            return new Context(null, caller.Id, false,
                (ProvisioningError.Forbidden, "Only an owner, administrator or finance manager can manage this workspace's subscription."));

        return new Context(workspace, caller.Id, canManageBilling, null);
    }

    private static ProvisioningResult<SubscriptionSummary> Fail((ProvisioningError Error, string Message) e)
        => ProvisioningResult<SubscriptionSummary>.Fail(e.Error, e.Message);
}
