using Microsoft.EntityFrameworkCore;
using Platform.Api.Models;
using Platform.Domain;
using Platform.Infrastructure;

namespace Platform.Api.Services;

/// <summary>
/// Platform-Operator-facing commercial back-office actions. Every method here
/// exists because the 2026-08-09 correction ("this platform does not collect
/// payment") replaced payment-provider automation with manual, audited,
/// back-office action — and because no scheduler exists in this codebase yet
/// (the same "lazy, on-demand" spirit as <c>ProvisioningService</c>'s
/// invitation expiry, just explicit here instead of triggered by a read).
///
/// Every mutation records a <see cref="SubscriptionEvent"/> — the Manual
/// Commercial Activation audit trail (§27a) that stands in for a payment
/// transaction record.
/// </summary>
public class CommercialOpsService(
    PlatformDbContext db, CommercialSubscriptionService subscriptions, LicensingService licensing)
{
    /// <summary>Manual Commercial Activation (§27a): the actual trigger for Active in this platform.</summary>
    public async Task<ProvisioningResult<SubscriptionSummary>> MarkInvoicePaidAsync(
        Guid invoiceId, Guid operatorIdentityId, string? referenceNote, CancellationToken ct = default)
    {
        var invoice = await db.Invoices.FirstOrDefaultAsync(i => i.Id == invoiceId, ct);
        if (invoice is null) return Fail(ProvisioningError.NotFound, "No such invoice.");

        var subscription = await db.Subscriptions.FirstOrDefaultAsync(s => s.Id == invoice.SubscriptionId, ct);
        if (subscription is null) return Fail(ProvisioningError.NotFound, "No such subscription.");

        var activation = SubscriptionEvent.Record(subscription.Id, "InvoiceMarkedPaid", operatorIdentityId, referenceNote);

        try
        {
            invoice.MarkPaid(activation.Id);
            subscription.Activate();
        }
        catch (InvalidOperationException ex) { return Fail(ProvisioningError.Conflict, ex.Message); }

        db.SubscriptionEvents.Add(activation);
        await db.SaveChangesAsync(ct);
        await licensing.RecomputeLicenseAsync(subscription.Id, ct);

        return ProvisioningResult<SubscriptionSummary>.Success(await subscriptions.BuildSummaryAsync(subscription, ct));
    }

    /// <summary>
    /// An issued Invoice whose due date has passed without being marked paid
    /// (§29, "Overdue Invoice") — the date-driven equivalent of a payment
    /// failure. Idempotent: a Subscription already past Active is left alone
    /// rather than re-thrown at.
    /// </summary>
    public async Task<int> SweepOverdueInvoicesAsync(CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var overdue = await db.Invoices
            .Where(i => i.Status == InvoiceStatus.Issued && i.DueDate < now)
            .ToListAsync(ct);

        var affectedSubscriptionIds = new List<Guid>();

        foreach (var invoice in overdue)
        {
            invoice.MarkOverdue();

            var subscription = await db.Subscriptions.FirstOrDefaultAsync(s => s.Id == invoice.SubscriptionId, ct);
            if (subscription is not { Status: SubscriptionStatus.Active }) continue;

            subscription.RecordOverdueInvoice();
            db.SubscriptionEvents.Add(SubscriptionEvent.Record(subscription.Id, "InvoiceOverdue", triggeredByIdentityId: null, referenceNote: null));
            affectedSubscriptionIds.Add(subscription.Id);
        }

        await db.SaveChangesAsync(ct);

        foreach (var subscriptionId in affectedSubscriptionIds)
            await licensing.RecomputeLicenseAsync(subscriptionId, ct);

        return affectedSubscriptionIds.Count;
    }

    public Task<ProvisioningResult<SubscriptionSummary>> AdvanceToGraceAsync(
        Guid subscriptionId, Guid operatorIdentityId, CancellationToken ct = default)
        => TransitionAsync(subscriptionId, operatorIdentityId, "AdvancedToGrace", s => s.AdvanceToGrace(), ct);

    public Task<ProvisioningResult<SubscriptionSummary>> SuspendAsync(
        Guid subscriptionId, Guid operatorIdentityId, CancellationToken ct = default)
        => TransitionAsync(subscriptionId, operatorIdentityId, "Suspended", s => s.Suspend(), ct);

    public Task<ProvisioningResult<SubscriptionSummary>> ExpireAsync(
        Guid subscriptionId, Guid operatorIdentityId, CancellationToken ct = default)
        => TransitionAsync(subscriptionId, operatorIdentityId, "Expired", s => s.Expire(), ct);

    /// <summary>
    /// Every Workspace's commercial state, for the admin console's
    /// Subscriptions table — attention-needing statuses first (§9's ordering
    /// convention, same reasoning as the Workspaces provisioning view: an
    /// unresolved PastDue/Grace/Suspended row is outstanding work). Bulk-loads
    /// Subscriptions and their Invoices in two queries and joins in memory —
    /// same "one query for the whole page" style as
    /// <c>LearningProductService.ListAsync</c> — rather than one Invoice query
    /// per Subscription.
    /// </summary>
    public async Task<IReadOnlyList<SubscriptionAdminRow>> ListSubscriptionsAsync(CancellationToken ct = default)
    {
        var subscriptions = await db.Subscriptions.AsNoTracking().ToListAsync(ct);
        var subscriptionIds = subscriptions.Select(s => s.Id).ToList();

        var latestInvoiceBySubscription = (await db.Invoices.AsNoTracking()
            .Where(i => subscriptionIds.Contains(i.SubscriptionId))
            .ToListAsync(ct))
            .GroupBy(i => i.SubscriptionId)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(i => i.DueDate).First());

        var workspaces = await db.Workspaces.AsNoTracking()
            .Where(w => subscriptions.Select(s => s.WorkspaceId).Contains(w.Id))
            .ToDictionaryAsync(w => w.Id, ct);

        var snapshotIds = subscriptions.Select(s => s.CurrentConfigurationSnapshotId).ToList();
        var planCodeBySnapshot = await db.ConfigurationSnapshots.AsNoTracking()
            .Where(s => snapshotIds.Contains(s.Id))
            .ToDictionaryAsync(s => s.Id, s => s.PlanCode, ct);

        var attentionOrder = new Dictionary<SubscriptionStatus, int>
        {
            [SubscriptionStatus.Suspended] = 0,
            [SubscriptionStatus.Grace] = 1,
            [SubscriptionStatus.PastDue] = 2,
        };

        return subscriptions
            .OrderBy(s => attentionOrder.GetValueOrDefault(s.Status, 9))
            .ThenByDescending(s => s.CreatedAt)
            .Select(s =>
            {
                var workspace = workspaces.GetValueOrDefault(s.WorkspaceId);
                var invoice = latestInvoiceBySubscription.GetValueOrDefault(s.Id);
                return new SubscriptionAdminRow(
                    SubscriptionId: s.Id,
                    WorkspaceSlug: workspace?.Slug ?? "",
                    WorkspaceName: workspace?.Name ?? "(unknown workspace)",
                    Status: s.Status.ToString(),
                    PlanCode: planCodeBySnapshot.GetValueOrDefault(s.CurrentConfigurationSnapshotId, ""),
                    BillingCycle: s.BillingCycle.ToString(),
                    CurrentPeriodEnd: s.CurrentPeriodEnd,
                    CancellationEffectiveDate: s.CancellationEffectiveDate,
                    CurrentInvoiceId: invoice?.Id,
                    CurrentInvoiceStatus: invoice?.Status.ToString(),
                    CurrentInvoiceDueDate: invoice?.DueDate,
                    CurrentInvoiceTotal: invoice?.TotalAmount);
            })
            .ToList();
    }

    private async Task<ProvisioningResult<SubscriptionSummary>> TransitionAsync(
        Guid subscriptionId, Guid operatorIdentityId, string eventType, Action<Subscription> transition, CancellationToken ct)
    {
        var subscription = await db.Subscriptions.FirstOrDefaultAsync(s => s.Id == subscriptionId, ct);
        if (subscription is null) return Fail(ProvisioningError.NotFound, "No such subscription.");

        try { transition(subscription); }
        catch (InvalidOperationException ex) { return Fail(ProvisioningError.Conflict, ex.Message); }

        db.SubscriptionEvents.Add(SubscriptionEvent.Record(subscription.Id, eventType, operatorIdentityId, null));
        await db.SaveChangesAsync(ct);
        await licensing.RecomputeLicenseAsync(subscription.Id, ct);

        return ProvisioningResult<SubscriptionSummary>.Success(await subscriptions.BuildSummaryAsync(subscription, ct));
    }

    private static ProvisioningResult<SubscriptionSummary> Fail(ProvisioningError error, string message) =>
        ProvisioningResult<SubscriptionSummary>.Fail(error, message);
}
