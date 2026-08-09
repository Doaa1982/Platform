namespace Platform.Domain;

/// <summary>
/// One resolved entitlement, ready to be recorded onto a
/// <see cref="WorkspaceLicense"/> — the shape
/// <see cref="Platform.Api.Services.EntitlementResolutionService"/> builds and
/// hands to <see cref="WorkspaceLicense.ReplaceEntitlements"/>. A plain
/// value type rather than exposing <see cref="Entitlement"/> construction
/// directly, so the aggregate stays the only thing that creates its own children.
/// </summary>
public readonly record struct ResolvedEntitlement(
    EntitlementType Type,
    CapabilityDomain? Domain,
    string Key,
    string Value,
    EntitlementSource Source,
    Guid? SourceRefId);

/// <summary>
/// One entry in a Workspace's effective Entitlement Set (Licensing &amp;
/// Entitlements §9/§11) — child of <see cref="WorkspaceLicense"/>, wholesale
/// replaced on every recompute (§17: a materialized view, not resolved live
/// per request). <see cref="Value"/> stays a string rather than a strict type
/// so both profile levels ("Professional") and numeric capacity ("2") fit the
/// same column, matching how the source data model handles this across every
/// entitlement-shaped field.
/// </summary>
public class Entitlement
{
    public Guid Id { get; private set; }
    public Guid LicenseId { get; private set; }
    public EntitlementType Type { get; private set; }

    /// <summary>Null for entitlement types that aren't domain-scoped (e.g. Capacity — Tutor Capacity applies platform-wide, not per capability domain).</summary>
    public CapabilityDomain? Domain { get; private set; }

    public string Key { get; private set; } = string.Empty;
    public string Value { get; private set; } = string.Empty;

    /// <summary>Which source determined this value — LIC-003: every effective entitlement must be attributable to exactly one.</summary>
    public EntitlementSource Source { get; private set; }
    public Guid? SourceRefId { get; private set; }

    public DateTime EffectiveFrom { get; private set; }
    public DateTime? EffectiveUntil { get; private set; }

    // Required by EF Core — not for application use
    private Entitlement() { }

    internal static Entitlement Create(
        Guid licenseId, EntitlementType type, CapabilityDomain? domain, string key, string value,
        EntitlementSource source, Guid? sourceRefId, DateTime effectiveFrom, DateTime? effectiveUntil)
    {
        if (licenseId == Guid.Empty)
            throw new ArgumentException("An Entitlement belongs to exactly one Workspace License.", nameof(licenseId));
        ArgumentException.ThrowIfNullOrWhiteSpace(key);
        ArgumentException.ThrowIfNullOrWhiteSpace(value);

        return new Entitlement
        {
            Id = Guid.NewGuid(),
            LicenseId = licenseId,
            Type = type,
            Domain = domain,
            Key = key,
            Value = value,
            Source = source,
            SourceRefId = sourceRefId,
            EffectiveFrom = effectiveFrom,
            EffectiveUntil = effectiveUntil,
        };
    }
}
