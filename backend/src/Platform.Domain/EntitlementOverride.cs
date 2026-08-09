namespace Platform.Domain;

/// <summary>
/// Entitlement Override Aggregate Root — Licensing &amp; Entitlements
/// Architecture §16, confirmed in scope for V1 (Decision Brief #5): "the first
/// support escalation becomes a database hotfix instead of an audited,
/// reversible action" without this.
///
/// Modeled as a first-class entity rather than mutating the base
/// Configuration Snapshot. When active, it wins outright over any other
/// source for the same <see cref="EntitlementKey"/> — highest precedence
/// (§13), not combined via the MAX rule that applies between the base plan
/// and packs (§12).
///
/// LIC-006: must be time-bound or subject to explicit periodic review — a
/// permanent, unexplained override is an operational exception, not a normal
/// path, so <see cref="EffectiveUntil"/> is nullable but <see cref="Reason"/>
/// is required either way.
/// </summary>
public class EntitlementOverride
{
    public Guid Id { get; private set; }
    public Guid WorkspaceId { get; private set; }
    public string EntitlementKey { get; private set; } = string.Empty;
    public string Value { get; private set; } = string.Empty;
    public string Reason { get; private set; } = string.Empty;

    /// <summary>The Platform Operator's Identity — overrides are a back-office action, not something a Workspace grants itself.</summary>
    public Guid AppliedByIdentityId { get; private set; }

    public DateTime EffectiveFrom { get; private set; }
    public DateTime? EffectiveUntil { get; private set; }
    public OverrideStatus Status { get; private set; }

    // Required by EF Core — not for application use
    private EntitlementOverride() { }

    public static EntitlementOverride Create(
        Guid workspaceId, string entitlementKey, string value, string reason,
        Guid appliedByIdentityId, DateTime? effectiveUntil)
    {
        if (workspaceId == Guid.Empty)
            throw new ArgumentException("An Entitlement Override belongs to exactly one Workspace.", nameof(workspaceId));
        ArgumentException.ThrowIfNullOrWhiteSpace(entitlementKey);
        ArgumentException.ThrowIfNullOrWhiteSpace(value);
        ArgumentException.ThrowIfNullOrWhiteSpace(reason);
        if (appliedByIdentityId == Guid.Empty)
            throw new ArgumentException("An Entitlement Override must record who applied it.", nameof(appliedByIdentityId));
        if (effectiveUntil is { } until && until <= DateTime.UtcNow)
            throw new ArgumentException("An override's expiry must be in the future.", nameof(effectiveUntil));

        return new EntitlementOverride
        {
            Id = Guid.NewGuid(),
            WorkspaceId = workspaceId,
            EntitlementKey = entitlementKey.Trim(),
            Value = value.Trim(),
            Reason = reason.Trim(),
            AppliedByIdentityId = appliedByIdentityId,
            EffectiveFrom = DateTime.UtcNow,
            EffectiveUntil = effectiveUntil,
            Status = OverrideStatus.Active,
        };
    }

    public bool IsActive(DateTime asOf) =>
        Status == OverrideStatus.Active && EffectiveFrom <= asOf && (EffectiveUntil is null || EffectiveUntil > asOf);

    public void Revoke()
    {
        if (Status != OverrideStatus.Active)
            throw new InvalidOperationException("Only an active override can be revoked.");
        Status = OverrideStatus.Revoked;
    }
}
