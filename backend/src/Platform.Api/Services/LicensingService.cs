using Microsoft.EntityFrameworkCore;
using Platform.Domain;
using Platform.Infrastructure;

namespace Platform.Api.Services;

/// <summary>
/// Derives a Workspace's License from its Subscription — LIC-002: License
/// state is never set independently. Call <see cref="RecomputeLicenseAsync"/>
/// after every Subscription state change (Manual Commercial Activation, an
/// overdue sweep, cancellation, ...); it upserts the one License row a
/// Workspace holds across its whole history and then asks
/// <see cref="EntitlementResolutionService"/> to recompute what it grants.
///
/// This is also the single chokepoint that funds a billing period's AI
/// credits (AICreditsCommercialContractAndImplementationPlan.md Phase 4 —
/// closing the gap Phase 0-3 left open, where the Configuration Snapshot's
/// AiCreditsIncluded was resolved into a display-only entitlement value but
/// never actually written to the credit ledger). Every Subscription state
/// change already routes through here, so granting once per period —
/// guarded by <see cref="Subscription.CreditsGrantedThroughUtc"/> so a
/// later recompute for the same period never double-grants — covers first
/// activation, PastDue/Grace recovery, and a period rollover
/// (<see cref="Subscription.Renew"/> / <see cref="Subscription.ApplyPendingChange"/>)
/// without a separate call at each site.
/// </summary>
public class LicensingService(PlatformDbContext db, EntitlementResolutionService entitlements)
{
    public async Task<WorkspaceLicense> RecomputeLicenseAsync(Guid subscriptionId, CancellationToken ct = default)
    {
        var subscription = await db.Subscriptions
            .FirstOrDefaultAsync(s => s.Id == subscriptionId, ct)
            ?? throw new InvalidOperationException("No such subscription.");

        var license = await db.WorkspaceLicenses
            .FirstOrDefaultAsync(l => l.WorkspaceId == subscription.WorkspaceId, ct);

        if (license is null)
        {
            license = WorkspaceLicense.Create(
                subscription.WorkspaceId, subscription.Id, subscription.CurrentConfigurationSnapshotId);
            db.WorkspaceLicenses.Add(license);
        }

        license.Recompute(
            subscription.Id, subscription.CurrentConfigurationSnapshotId,
            subscription.Status, subscription.CancellationEffectiveDate);

        await GrantPeriodCreditsIfDueAsync(license, subscription, ct);

        await db.SaveChangesAsync(ct);
        await entitlements.RecomputeAsync(license.Id, ct);

        return license;
    }

    /// <summary>
    /// Grants this period's AiCreditsIncluded exactly once, only while the
    /// License is genuinely Active — deliberately not extended to Grace or
    /// Restricted in this pass (an overdue-but-not-yet-suspended workspace
    /// still resolves normal AI entitlement levels per
    /// EntitlementResolutionService, but whether it should also keep
    /// accruing fresh credits during that window is an unresolved commercial
    /// policy question left for a later pass, not guessed here).
    /// </summary>
    private async Task GrantPeriodCreditsIfDueAsync(WorkspaceLicense license, Subscription subscription, CancellationToken ct)
    {
        if (license.Status != LicenseStatus.Active) return;
        if (subscription.CreditsGrantedThroughUtc == subscription.CurrentPeriodEnd) return;

        var aiCreditsIncluded = await db.ConfigurationSnapshots.AsNoTracking()
            .Where(s => s.Id == subscription.CurrentConfigurationSnapshotId)
            .Select(s => s.AiCreditsIncluded)
            .FirstOrDefaultAsync(ct);

        if (aiCreditsIncluded > 0)
        {
            db.CreditLedgerEntries.Add(CreditLedgerEntry.Grant(
                subscription.WorkspaceId, CreditLedgerEntryType.SubscriptionGrant, aiCreditsIncluded,
                expiresAtUtc: subscription.CurrentPeriodEnd));
        }

        subscription.MarkCreditsGranted();
    }
}
