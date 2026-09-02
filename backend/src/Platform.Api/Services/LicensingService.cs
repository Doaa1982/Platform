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
/// guarded by <see cref="Subscription.CreditsGrantedThroughUtc"/>, itself
/// made safe under concurrent/retried callers by the advisory lock taken
/// below — covers first activation, PastDue/Grace recovery, and a period
/// rollover (<see cref="Subscription.Renew"/> / <see cref="Subscription.ApplyPendingChange"/>)
/// without a separate call at each site.
/// </summary>
public class LicensingService(PlatformDbContext db, EntitlementResolutionService entitlements)
{
    public async Task<WorkspaceLicense> RecomputeLicenseAsync(Guid subscriptionId, CancellationToken ct = default)
    {
        // Same execution-strategy requirement as CreditLedgerService.TryDebitAsync
        // (PlatformDbContext has EnableRetryOnFailure, which forbids a bare
        // BeginTransactionAsync).
        var strategy = db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            await using var tx = await db.Database.BeginTransactionAsync(ct);

            var subscription = await db.Subscriptions
                .FirstOrDefaultAsync(s => s.Id == subscriptionId, ct)
                ?? throw new InvalidOperationException("No such subscription.");

            // Serializes concurrent recomputes for the same Workspace so a
            // retried renewal webhook or a sweep racing an admin action can
            // never both pass the "already granted this period?" check below
            // and double-grant credits (V1 Launch Readiness Report, P0-1).
            // Same lock key CreditLedgerService.TryDebitAsync already takes,
            // so a grant and a debit for the same Workspace are mutually
            // exclusive too, not just grant-vs-grant.
            await db.Database.ExecuteSqlInterpolatedAsync(
                $"SELECT pg_advisory_xact_lock(hashtext({subscription.WorkspaceId.ToString()}))", ct);

            // Re-read the grant-tracking fields under the lock: another
            // transaction may have committed a grant for this exact period
            // between the unlocked fetch above and acquiring the lock.
            await db.Entry(subscription).ReloadAsync(ct);

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
            await tx.CommitAsync(ct);

            await entitlements.RecomputeAsync(license.Id, ct);

            return license;
        });
    }

    /// <summary>
    /// Grants (or tops up) this period's AiCreditsIncluded, only while the
    /// License is genuinely Active — deliberately not extended to Grace or
    /// Restricted in this pass (an overdue-but-not-yet-suspended workspace
    /// still resolves normal AI entitlement levels per
    /// EntitlementResolutionService, but whether it should also keep
    /// accruing fresh credits during that window is an unresolved commercial
    /// policy question left for a later pass, not guessed here).
    ///
    /// A fresh period (CurrentPeriodEnd has moved since the last grant) is
    /// granted the current snapshot's full AiCreditsIncluded from zero. A
    /// recompute within the *same* period — the case that matters here is a
    /// mid-period Upgrade's <see cref="Subscription.ApplyRequestedChange"/>,
    /// which swaps in a richer snapshot without moving CurrentPeriodEnd —
    /// only tops up the difference against what this period already granted,
    /// so an upgrading customer sees the higher tier's credits immediately
    /// instead of waiting for the next renewal. Never claws back: a lower
    /// figure for the same period (not a normal flow — Downgrade always
    /// takes effect at a period rollover, never mid-period) is simply a
    /// no-op rather than a negative grant.
    /// </summary>
    private async Task GrantPeriodCreditsIfDueAsync(WorkspaceLicense license, Subscription subscription, CancellationToken ct)
    {
        if (license.Status != LicenseStatus.Active) return;

        var isNewPeriod = subscription.CreditsGrantedThroughUtc != subscription.CurrentPeriodEnd;
        var alreadyGrantedThisPeriod = isNewPeriod ? 0 : subscription.CreditsGrantedThisPeriodAmount;

        var aiCreditsIncluded = await db.ConfigurationSnapshots.AsNoTracking()
            .Where(s => s.Id == subscription.CurrentConfigurationSnapshotId)
            .Select(s => s.AiCreditsIncluded)
            .FirstOrDefaultAsync(ct);

        var due = Math.Max(0, aiCreditsIncluded - alreadyGrantedThisPeriod);
        if (!isNewPeriod && due == 0) return; // nothing changed since the last time this period was touched

        if (due > 0)
        {
            db.CreditLedgerEntries.Add(CreditLedgerEntry.Grant(
                subscription.WorkspaceId, CreditLedgerEntryType.SubscriptionGrant, due,
                expiresAtUtc: subscription.CurrentPeriodEnd));
        }

        subscription.RecordCreditsGranted(alreadyGrantedThisPeriod + due);
    }
}
