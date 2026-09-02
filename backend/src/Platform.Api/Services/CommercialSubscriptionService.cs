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
    PlatformDbContext db, ConfigurationService configuration, LicensingService licensing, ICreditLedgerService credits)
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

        // §A7 (AICreditsCommercialContractAndImplementationPlan.md): a
        // one-time 200-credit trial grant, given the first time a workspace
        // ever subscribes — not on every checkout, so a workspace that
        // cancelled and comes back doesn't get a second trial. Checked here
        // (Subscription.Create is about to run below) rather than at bare
        // Workspace.Create, since a Workspace with no Subscription yet has no
        // WorkspaceLicense either, and nothing resolves an AI entitlement for
        // it — the trial would have nothing to attach to any earlier than this.
        var isFirstEverSubscription = !await db.Subscriptions.AsNoTracking()
            .AnyAsync(s => s.WorkspaceId == ctx.Workspace!.Id, ct);

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

        if (isFirstEverSubscription)
        {
            db.CreditLedgerEntries.Add(CreditLedgerEntry.Grant(
                ctx.Workspace.Id, CreditLedgerEntryType.TrialGrant, amount: 200,
                expiresAtUtc: DateTime.UtcNow.AddDays(30)));
        }

        if (snapshot.PriceAmount == 0)
        {
            // Nothing to collect — a 0-priced plan (and no paid add-ons selected)
            // has no Manual Commercial Activation step to wait on: there is no
            // invoice for a Platform Operator to ever mark paid, so activation
            // happens immediately instead, the same transition
            // CommercialOpsService.MarkInvoicePaidAsync would otherwise perform.
            subscription.Activate();
            db.SubscriptionEvents.Add(SubscriptionEvent.Record(
                subscription.Id, "FreePlanActivated", callerIdentityId,
                "No invoice — the resolved plan and add-ons total 0."));
        }
        else
        {
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
        }

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
    /// after Impact Analysis confirms current usage fits the target plan —
    /// tutor-seat capacity (§18's own worked example, active seats plus open
    /// invitations, the same count WorkspaceMemberService.CheckTutorCapacityAsync
    /// already enforces on invite, mirrored here rather than shared to avoid
    /// coupling this service to Workspace Access's internals for one query),
    /// plus learner capacity, video storage, and resource storage — the other
    /// three metered dimensions BuildSummaryAsync already aggregates for
    /// display, checked here too so a downgrade can't be scheduled against a
    /// plan the workspace is already over on any of them.
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

        var activeLearners = await db.Memberships
            .Where(m => m.WorkspaceId == ctx.Workspace.Id && m.Status == MembershipStatus.Active)
            .Where(m => m.Roles.Any(r => r.Name == WorkspaceRoleName.Learner))
            .CountAsync(ct);
        if (activeLearners > snapshot.LearnerCapacity)
            return Fail((ProvisioningError.Conflict,
                $"This workspace currently has {activeLearners} active learner(s). "
                + $"The selected plan supports {snapshot.LearnerCapacity}. "
                + "Remove a learner before downgrading."));

        var videoBytesUsed = await db.LearningAssets
            .Where(a => a.WorkspaceId == ctx.Workspace.Id && a.Category == LearningAssetCategory.Video && a.Status != LearningAssetStatus.Archived)
            .SumAsync(a => a.FileSizeBytes, ct);
        var videoGbUsed = videoBytesUsed / 1_000_000_000.0;
        if (videoGbUsed > snapshot.VideoStorageGb)
            return Fail((ProvisioningError.Conflict,
                $"This workspace is currently using {videoGbUsed:0.#}GB of video storage. "
                + $"The selected plan supports {snapshot.VideoStorageGb}GB. "
                + "Remove some video before downgrading."));

        var resourceBytesUsed = await db.LearningAssets
            .Where(a => a.WorkspaceId == ctx.Workspace.Id
                     && (a.Category == LearningAssetCategory.Resource || a.Category == LearningAssetCategory.Image)
                     && a.Status != LearningAssetStatus.Archived)
            .SumAsync(a => a.FileSizeBytes, ct);
        var resourceGbUsed = resourceBytesUsed / 1_000_000_000.0;
        if (resourceGbUsed > snapshot.ResourceStorageGb)
            return Fail((ProvisioningError.Conflict,
                $"This workspace is currently using {resourceGbUsed:0.#}GB of resource storage. "
                + $"The selected plan supports {snapshot.ResourceStorageGb}GB. "
                + "Remove some resources before downgrading."));

        // A decrease contradicts any outstanding request to pay more — void
        // that request's Invoice before scheduling the decrease.
        if (subscription.RequestedInvoiceId is { } staleInvoiceId)
        {
            var staleInvoice = await db.Invoices.FirstOrDefaultAsync(i => i.Id == staleInvoiceId, ct);
            staleInvoice?.Void();
        }

        try { subscription.ScheduleDowngrade(snapshot.Id); }
        catch (InvalidOperationException ex) { return Fail((ProvisioningError.Conflict, ex.Message)); }

        db.SubscriptionEvents.Add(SubscriptionEvent.Record(subscription.Id, "DowngradeScheduled", callerIdentityId,
            $"To {snapshot.PlanCode}, effective {subscription.PendingChangeEffectiveDate:yyyy-MM-dd}."));

        await db.SaveChangesAsync(ct);

        return ProvisioningResult<SubscriptionSummary>.Success(await BuildSummaryAsync(subscription, ct));
    }

    /// <summary>
    /// §15-16 / Billing Architecture §25-27: a price-increasing plan/pack
    /// change. Unlike the old immediate-apply behavior, this only *requests*
    /// the change and issues a prorated invoice for a Platform Operator to
    /// manually confirm (Manual Commercial Activation, §27a) — the workspace
    /// keeps its currently-confirmed plan's entitlements until then. Rejected
    /// if the target isn't actually more expensive at the current billing
    /// cycle — that direction is Downgrade's job, which has its own Impact
    /// Analysis this path doesn't need (an increase can only ever request more
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

        var billingAccount = await db.BillingAccounts.FirstOrDefaultAsync(b => b.WorkspaceId == ctx.Workspace.Id, ct);
        if (billingAccount is null)
            return Fail((ProvisioningError.Conflict, "This workspace has no billing account to invoice the upgrade against."));

        // A new request supersedes any prior one still awaiting confirmation —
        // "replace, don't stack," same convention ScheduleDowngrade already uses.
        if (subscription.RequestedInvoiceId is { } staleInvoiceId)
        {
            var staleInvoice = await db.Invoices.FirstOrDefaultAsync(i => i.Id == staleInvoiceId, ct);
            staleInvoice?.Void();
        }

        var invoice = Invoice.Create(
            billingAccount.Id, subscription.Id, newSnapshot.Id,
            billingPeriodStart: now, billingPeriodEnd: subscription.CurrentPeriodEnd,
            dueDate: now.AddDays(7), newSnapshot.PriceCurrency);
        invoice.AddLine(
            $"Plan change: {oldSnapshot.PlanCode} → {newSnapshot.PlanCode}",
            InvoiceComponentType.Proration, prorationAmount);
        invoice.Issue();
        db.Invoices.Add(invoice);

        try { subscription.RequestChange(newSnapshot.Id, invoice.Id); }
        catch (InvalidOperationException ex) { return Fail((ProvisioningError.Conflict, ex.Message)); }

        db.SubscriptionEvents.Add(SubscriptionEvent.Record(subscription.Id, "ChangeRequested", callerIdentityId,
            $"From {oldSnapshot.PlanCode} to {newSnapshot.PlanCode}, prorated {prorationAmount} {newSnapshot.PriceCurrency} — awaiting confirmation."));

        await db.SaveChangesAsync(ct);
        // Nothing about current entitlements changed — the request only takes
        // effect once a Platform Operator confirms the invoice (CommercialOpsService.MarkInvoicePaidAsync).

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

    /// <summary>The tutor's own "never mind" for an unconfirmed request — withdraws it and voids the tied Invoice before a Platform Operator ever acts on it.</summary>
    public async Task<ProvisioningResult<SubscriptionSummary>> CancelRequestedChangeAsync(
        string slug, Guid callerIdentityId, CancellationToken ct = default)
    {
        var ctx = await ResolveAsync(slug, callerIdentityId, requireBillingRole: true, ct);
        if (ctx.Error is not null) return Fail(ctx.Error.Value);

        var subscription = await CurrentSubscriptionAsync(ctx.Workspace!.Id, tracked: true, ct);
        if (subscription is null) return Fail((ProvisioningError.NotFound, "This workspace has no subscription."));

        if (subscription.RequestedInvoiceId is { } invoiceId)
        {
            var invoice = await db.Invoices.FirstOrDefaultAsync(i => i.Id == invoiceId, ct);
            invoice?.Void();
        }

        try { subscription.CancelRequestedChange(); }
        catch (InvalidOperationException ex) { return Fail((ProvisioningError.Conflict, ex.Message)); }

        db.SubscriptionEvents.Add(SubscriptionEvent.Record(subscription.Id, "RequestedChangeWithdrawn", callerIdentityId, null));
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

    /// <summary>
    /// Confirmed add-on history — every past Manual Commercial Activation
    /// that actually changed the selected Capability Packs, newest first.
    /// Read from SubscriptionEvent's before/after snapshot pair (see its own
    /// doc) since Subscription itself keeps no history of past snapshots.
    /// </summary>
    public async Task<ProvisioningResult<IReadOnlyList<SubscriptionHistoryEntry>>> GetHistoryAsync(
        string slug, Guid callerIdentityId, CancellationToken ct = default)
    {
        var ctx = await ResolveAsync(slug, callerIdentityId, requireBillingRole: false, ct);
        if (ctx.Error is not null)
            return ProvisioningResult<IReadOnlyList<SubscriptionHistoryEntry>>.Fail(ctx.Error.Value.Error, ctx.Error.Value.Message);

        var subscription = await CurrentSubscriptionAsync(ctx.Workspace!.Id, tracked: false, ct);
        if (subscription is null)
            return ProvisioningResult<IReadOnlyList<SubscriptionHistoryEntry>>.Success([]);

        var events = await db.SubscriptionEvents.AsNoTracking()
            .Where(e => e.SubscriptionId == subscription.Id
                     && e.PreviousConfigurationSnapshotId != null && e.NewConfigurationSnapshotId != null)
            .OrderByDescending(e => e.OccurredAt)
            .ToListAsync(ct);

        if (events.Count == 0)
            return ProvisioningResult<IReadOnlyList<SubscriptionHistoryEntry>>.Success([]);

        var snapshotIds = events
            .SelectMany(e => new[] { e.PreviousConfigurationSnapshotId!.Value, e.NewConfigurationSnapshotId!.Value })
            .Distinct().ToList();
        var snapshots = await db.ConfigurationSnapshots.AsNoTracking()
            .Where(s => snapshotIds.Contains(s.Id))
            .ToDictionaryAsync(s => s.Id, ct);

        var packNames = await db.CommercialPacks.AsNoTracking()
            .ToDictionaryAsync(p => p.Code.ToString(), p => p.Name, ct);

        var entries = new List<SubscriptionHistoryEntry>();
        foreach (var e in events)
        {
            if (!snapshots.TryGetValue(e.PreviousConfigurationSnapshotId!.Value, out var before)
                || !snapshots.TryGetValue(e.NewConfigurationSnapshotId!.Value, out var after))
                continue; // Snapshot rows are never deleted, but skip defensively rather than 500 on a gap.

            var addedPacks = after.SelectedPackCodes.Except(before.SelectedPackCodes).ToList();
            var removedPacks = before.SelectedPackCodes.Except(after.SelectedPackCodes).ToList();
            if (addedPacks.Count == 0 && removedPacks.Count == 0)
                continue; // A plan-only change (same packs before/after) isn't add-on history.

            entries.Add(new SubscriptionHistoryEntry(
                ConfirmedAt: e.OccurredAt,
                AddedPackNames: addedPacks.Select(c => packNames.GetValueOrDefault(c, c)).ToList(),
                RemovedPackNames: removedPacks.Select(c => packNames.GetValueOrDefault(c, c)).ToList(),
                TutorCapacityBefore: before.TutorCapacity, TutorCapacityAfter: after.TutorCapacity,
                LearnerCapacityBefore: before.LearnerCapacity, LearnerCapacityAfter: after.LearnerCapacity,
                VideoStorageGbBefore: before.VideoStorageGb, VideoStorageGbAfter: after.VideoStorageGb,
                ResourceStorageGbBefore: before.ResourceStorageGb, ResourceStorageGbAfter: after.ResourceStorageGb,
                AiCreditsIncludedBefore: before.AiCreditsIncluded, AiCreditsIncludedAfter: after.AiCreditsIncluded));
        }

        return ProvisioningResult<IReadOnlyList<SubscriptionHistoryEntry>>.Success(entries);
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

        // Current entitlements only (LIC-007: history is append-only, so a
        // superseded row stays in the table with EffectiveUntil set rather
        // than being deleted) — an unfiltered Include would surface stale,
        // closed rows alongside the live ones here.
        var license = await db.WorkspaceLicenses.AsNoTracking()
            .Include(l => l.Entitlements.Where(e => e.EffectiveUntil == null))
            .FirstOrDefaultAsync(l => l.WorkspaceId == subscription.WorkspaceId, ct);

        string? pendingPlanCode = null;
        if (subscription.PendingConfigurationSnapshotId is { } pendingId)
        {
            pendingPlanCode = (await db.ConfigurationSnapshots.AsNoTracking()
                .FirstOrDefaultAsync(s => s.Id == pendingId, ct))?.PlanCode;
        }

        string? requestedPlanCode = null;
        IReadOnlyList<string>? requestedPackCodes = null;
        if (subscription.RequestedConfigurationSnapshotId is { } requestedId)
        {
            var requestedSnapshot = await db.ConfigurationSnapshots.AsNoTracking()
                .FirstOrDefaultAsync(s => s.Id == requestedId, ct);
            requestedPlanCode = requestedSnapshot?.PlanCode;
            requestedPackCodes = requestedSnapshot?.SelectedPackCodes.ToList();
        }

        var aiCreditsRemaining = await credits.GetBalanceAsync(subscription.WorkspaceId, ct);

        // Actual consumption against the four metered capacity entitlements —
        // mirrors the sum queries WorkspaceMemberService/LearningAssetService
        // already run privately to gate invites/uploads, duplicated here
        // (rather than injecting those services) since each is a single
        // trivial aggregate against tables this service already queries.
        var usedByKey = new Dictionary<string, string>();
        if (license?.Entitlements is { Count: > 0 })
        {
            var activeTutors = await db.Memberships
                .Where(m => m.WorkspaceId == subscription.WorkspaceId && m.Status == MembershipStatus.Active)
                .Where(m => m.Roles.Any(r => TutorSeatRoles.Contains(r.Name)))
                .CountAsync(ct);
            var activeLearners = await db.Memberships
                .Where(m => m.WorkspaceId == subscription.WorkspaceId && m.Status == MembershipStatus.Active)
                .Where(m => m.Roles.Any(r => r.Name == WorkspaceRoleName.Learner))
                .CountAsync(ct);
            var videoBytesUsed = await db.LearningAssets
                .Where(a => a.WorkspaceId == subscription.WorkspaceId && a.Category == LearningAssetCategory.Video && a.Status != LearningAssetStatus.Archived)
                .SumAsync(a => a.FileSizeBytes, ct);
            var resourceBytesUsed = await db.LearningAssets
                .Where(a => a.WorkspaceId == subscription.WorkspaceId
                         && (a.Category == LearningAssetCategory.Resource || a.Category == LearningAssetCategory.Image)
                         && a.Status != LearningAssetStatus.Archived)
                .SumAsync(a => a.FileSizeBytes, ct);

            usedByKey[EntitlementResolutionService.TutorCapacityKey] = activeTutors.ToString();
            usedByKey[EntitlementResolutionService.LearnerCapacityKey] = activeLearners.ToString();
            usedByKey[EntitlementResolutionService.VideoStorageGbKey] = (videoBytesUsed / 1_000_000_000.0).ToString("0.#");
            usedByKey[EntitlementResolutionService.ResourceStorageGbKey] = (resourceBytesUsed / 1_000_000_000.0).ToString("0.#");
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
            RequestedPlanCode: requestedPlanCode,
            RequestedPackCodes: requestedPackCodes,
            CurrentInvoiceId: invoice?.Id,
            CurrentInvoiceStatus: invoice?.Status.ToString(),
            CurrentInvoiceDueDate: invoice?.DueDate,
            CurrentInvoiceAmount: invoice?.TotalAmount,
            CurrentInvoiceCurrency: invoice?.Currency,
            LicenseStatus: license?.Status.ToString() ?? LicenseStatus.Pending.ToString(),
            Entitlements: license?.Entitlements
                .Select(e => new EntitlementRow(e.Type.ToString(), e.Domain?.ToString(), e.Key, e.Value, e.Source.ToString(),
                    usedByKey.GetValueOrDefault(e.Key)))
                .ToList() ?? [],
            AiCreditsRemaining: aiCreditsRemaining);
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
