namespace Platform.Domain;

/// <summary>
/// Workspace License Aggregate Root — Licensing &amp; Entitlements Architecture §6.
///
/// LIC-002: <see cref="Status"/> is derived from Subscription status and
/// commercial policy, never set independently — <see cref="Recompute"/> is the
/// only way it changes. Mapping used (§8, which explicitly claims to be the
/// authoritative restatement, over SubscriptionManagementArchitecture.md §28's
/// slightly different table):
///
///   Pending   → Pending
///   Active    → Active
///   PastDue   → Grace       (an overdue invoice must not immediately mean
///                             revoked access — Billing §20-21)
///   Grace     → Grace
///   Suspended → Restricted
///   Cancelled → Active until CancellationEffectiveDate, then Expired
///               (SUB-004 — cancelling doesn't end access mid-period)
///   Expired   → Expired
///
/// Owns the Workspace's <see cref="Entitlements"/> as a materialized set
/// (§17: "HasEntitlement reads the last resolved set; it does not re-run
/// resolution synchronously per request") — wholesale replaced by
/// <see cref="ReplaceEntitlements"/> whenever
/// <see cref="Platform.Api.Services.EntitlementResolutionService"/> recomputes it.
/// </summary>
public class WorkspaceLicense
{
    private readonly List<Entitlement> _entitlements = [];

    public Guid Id { get; private set; }
    public Guid WorkspaceId { get; private set; }
    public Guid SubscriptionId { get; private set; }
    public Guid ConfigurationSnapshotId { get; private set; }
    public LicenseStatus Status { get; private set; }
    public DateTime EffectiveFrom { get; private set; }
    public DateTime? EffectiveUntil { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }

    public IReadOnlyCollection<Entitlement> Entitlements => _entitlements.AsReadOnly();

    // Required by EF Core — not for application use
    private WorkspaceLicense() { }

    public static WorkspaceLicense Create(Guid workspaceId, Guid subscriptionId, Guid configurationSnapshotId)
    {
        if (workspaceId == Guid.Empty)
            throw new ArgumentException("A Workspace License belongs to exactly one Workspace.", nameof(workspaceId));
        if (subscriptionId == Guid.Empty)
            throw new ArgumentException("A Workspace License belongs to exactly one Subscription.", nameof(subscriptionId));
        if (configurationSnapshotId == Guid.Empty)
            throw new ArgumentException("A Workspace License must reference a Configuration Snapshot (LIC-001).", nameof(configurationSnapshotId));

        var now = DateTime.UtcNow;
        return new WorkspaceLicense
        {
            Id = Guid.NewGuid(),
            WorkspaceId = workspaceId,
            SubscriptionId = subscriptionId,
            ConfigurationSnapshotId = configurationSnapshotId,
            Status = LicenseStatus.Pending,
            EffectiveFrom = now,
            CreatedAt = now,
            UpdatedAt = now,
        };
    }

    /// <summary>
    /// Re-derives this license against its owning Subscription's current
    /// state. Takes the Subscription/Snapshot identifiers again (not just the
    /// status) so the same call also carries a Workspace forward onto a
    /// replacement Subscription — the WorkspaceId unique index means a
    /// Workspace has at most one License row across its whole history, reused
    /// rather than duplicated if it ever resubscribes.
    /// </summary>
    public LicenseStatus Recompute(
        Guid subscriptionId, Guid configurationSnapshotId,
        SubscriptionStatus subscriptionStatus, DateTime? cancellationEffectiveDate)
    {
        if (subscriptionId == Guid.Empty)
            throw new ArgumentException("A Workspace License belongs to exactly one Subscription.", nameof(subscriptionId));
        if (configurationSnapshotId == Guid.Empty)
            throw new ArgumentException("A Workspace License must reference a Configuration Snapshot (LIC-001).", nameof(configurationSnapshotId));

        SubscriptionId = subscriptionId;
        ConfigurationSnapshotId = configurationSnapshotId;

        Status = subscriptionStatus switch
        {
            SubscriptionStatus.Draft or SubscriptionStatus.Pending => LicenseStatus.Pending,
            SubscriptionStatus.Active => LicenseStatus.Active,
            SubscriptionStatus.PastDue or SubscriptionStatus.Grace => LicenseStatus.Grace,
            SubscriptionStatus.Suspended => LicenseStatus.Restricted,
            SubscriptionStatus.Cancelled => cancellationEffectiveDate is { } effectiveDate && DateTime.UtcNow >= effectiveDate
                ? LicenseStatus.Expired
                : LicenseStatus.Active,
            SubscriptionStatus.Expired => LicenseStatus.Expired,
            _ => throw new ArgumentOutOfRangeException(nameof(subscriptionStatus), subscriptionStatus, null),
        };

        EffectiveUntil = Status == LicenseStatus.Expired ? (EffectiveUntil ?? DateTime.UtcNow) : null;
        Touch();
        return Status;
    }

    public void ReplaceEntitlements(IEnumerable<ResolvedEntitlement> resolved)
    {
        _entitlements.Clear();
        var now = DateTime.UtcNow;
        foreach (var e in resolved)
            _entitlements.Add(Entitlement.Create(Id, e.Type, e.Domain, e.Key, e.Value, e.Source, e.SourceRefId, now, null));
        Touch();
    }

    private void Touch() => UpdatedAt = DateTime.UtcNow;
}
