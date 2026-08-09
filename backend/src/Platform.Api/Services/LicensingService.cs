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
/// </summary>
public class LicensingService(PlatformDbContext db, EntitlementResolutionService entitlements)
{
    public async Task<WorkspaceLicense> RecomputeLicenseAsync(Guid subscriptionId, CancellationToken ct = default)
    {
        var subscription = await db.Subscriptions.AsNoTracking()
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

        await db.SaveChangesAsync(ct);
        await entitlements.RecomputeAsync(license.Id, ct);

        return license;
    }
}
