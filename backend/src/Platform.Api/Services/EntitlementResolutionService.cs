using Microsoft.EntityFrameworkCore;
using Platform.Domain;
using Platform.Infrastructure;

namespace Platform.Api.Services;

/// <summary>
/// Effective Entitlement Resolution — Licensing &amp; Entitlements Architecture
/// §11. Consumes a Workspace License's Configuration Snapshot (already the
/// MAX of base plan and packs — that's Product Configuration's job, §21-25)
/// and layers two things on top that only Licensing owns: Entitlement
/// Override precedence (§13 — an active override wins outright, no MAX) and
/// the License State Policy (§7 — Restricted/Expired reduce what's granted).
///
/// Writes a materialized Entitlement Set rather than resolving anything live
/// per request (§17) — call <see cref="RecomputeAsync"/> whenever something
/// that affects the result changes (license status, override applied/expired,
/// configuration snapshot). <see cref="HasEntitlementAsync"/> is the fast read
/// against that materialized set.
/// </summary>
public class EntitlementResolutionService(PlatformDbContext db)
{
    private static readonly CapabilityDomain[] ProfileDomains =
    [
        CapabilityDomain.Learning, CapabilityDomain.Assessment,
        CapabilityDomain.Analytics, CapabilityDomain.Branding,
    ];

    public async Task RecomputeAsync(Guid licenseId, CancellationToken ct = default)
    {
        var license = await db.WorkspaceLicenses
            .Include(l => l.Entitlements)
            .FirstOrDefaultAsync(l => l.Id == licenseId, ct);
        if (license is null) return;

        var snapshot = await db.ConfigurationSnapshots.AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == license.ConfigurationSnapshotId, ct)
            ?? throw new InvalidOperationException("A Workspace License must reference a Configuration Snapshot (LIC-001).");

        // Resolved against the exact Version the snapshot pinned at checkout time —
        // not a fresh catalog lookup — so a Platform Operator publishing a new price
        // later never drifts an already-open subscription's entitlements.
        var version = await db.CommercialProductVersions.AsNoTracking()
            .FirstOrDefaultAsync(v => v.Id == snapshot.ProductVersionId, ct)
            ?? throw new InvalidOperationException($"Configuration Snapshot references an unknown Product Version \"{snapshot.ProductVersionId}\".");

        var packVersions = await db.CommercialPackVersions.AsNoTracking()
            .Where(v => snapshot.SelectedPackVersionIds.Contains(v.Id))
            .ToListAsync(ct);

        var now = DateTime.UtcNow;
        var activeOverrides = await db.EntitlementOverrides.AsNoTracking()
            .Where(o => o.WorkspaceId == license.WorkspaceId && o.Status == OverrideStatus.Active)
            .ToListAsync(ct);
        activeOverrides = activeOverrides.Where(o => o.IsActive(now)).ToList();

        // Apply License State Policy (§11 step 7 — undefined in any source doc,
        // resolved here): Restricted/Expired force AI assistance to Manual;
        // Expired additionally grants nothing at all — HasEntitlementAsync
        // shortcuts on license status before ever looking at these rows, but
        // recording an empty set keeps "what does this license currently
        // grant" honest for anyone reading Entitlements directly too.
        var noAccess = license.Status == LicenseStatus.Expired;
        var restrictAi = license.Status is LicenseStatus.Restricted or LicenseStatus.Expired;

        var resolved = new List<ResolvedEntitlement>();

        if (!noAccess)
        {
            foreach (var domain in ProfileDomains)
            {
                var (profileValue, profileSource, profileRef) = ResolveProfile(version, packVersions, activeOverrides, domain);
                resolved.Add(new ResolvedEntitlement(
                    EntitlementType.CapabilityProfile, domain, ProfileKey(domain), profileValue.ToString(), profileSource, profileRef));

                var aiValue = restrictAi ? AiAssistanceLevel.Manual : AiLevelFor(profileValue);
                resolved.Add(new ResolvedEntitlement(
                    EntitlementType.AiAssistanceLevel, domain, AiKey(domain), aiValue.ToString(), profileSource, profileRef));
            }

            var (tutorValue, tutorSource, tutorRef) = ResolveScalar(TutorCapacityKey, snapshot.TutorCapacity.ToString(), activeOverrides);
            resolved.Add(new ResolvedEntitlement(EntitlementType.Capacity, null, TutorCapacityKey, tutorValue, tutorSource, tutorRef));

            var (creditsValue, creditsSource, creditsRef) = ResolveScalar(AiCreditsKey, snapshot.AiCreditsIncluded.ToString(), activeOverrides);
            resolved.Add(new ResolvedEntitlement(EntitlementType.UsageAllowance, null, AiCreditsKey, creditsValue, creditsSource, creditsRef));
        }

        license.ReplaceEntitlements(resolved);
        await db.SaveChangesAsync(ct);
    }

    /// <summary>The raw materialized value for one Entitlement key, or null if the Workspace has no License yet or no such key resolved.</summary>
    public async Task<string?> GetEntitlementValueAsync(Guid workspaceId, string key, CancellationToken ct = default)
    {
        var license = await db.WorkspaceLicenses.AsNoTracking()
            .FirstOrDefaultAsync(l => l.WorkspaceId == workspaceId, ct);
        if (license is null || license.Status == LicenseStatus.Expired) return null;

        return await db.Set<Entitlement>().AsNoTracking()
            .Where(e => e.LicenseId == license.Id && e.Key == key)
            .Select(e => e.Value)
            .FirstOrDefaultAsync(ct);
    }

    /// <summary>LIC-008: the runtime read a caller should use — never a plan name check.</summary>
    public async Task<bool> HasEntitlementAsync(
        Guid workspaceId, string key, string? minValue = null, CancellationToken ct = default)
    {
        var value = await GetEntitlementValueAsync(workspaceId, key, ct);

        if (value is null) return false;
        if (minValue is null) return true;

        if (Enum.TryParse<CapabilityProfileLevel>(value, out var haveProfile) && Enum.TryParse<CapabilityProfileLevel>(minValue, out var needProfile))
            return haveProfile >= needProfile;
        if (Enum.TryParse<AiAssistanceLevel>(value, out var haveAi) && Enum.TryParse<AiAssistanceLevel>(minValue, out var needAi))
            return haveAi >= needAi;
        if (int.TryParse(value, out var haveNum) && int.TryParse(minValue, out var needNum))
            return haveNum >= needNum;

        return string.Equals(value, minValue, StringComparison.OrdinalIgnoreCase);
    }

    public static string ProfileKey(CapabilityDomain domain) => $"profile:{domain}";
    public static string AiKey(CapabilityDomain domain) => $"ai:{domain}";
    public const string TutorCapacityKey = "capacity:tutors";
    public const string AiCreditsKey = "credits:ai";

    /// <summary>
    /// Profile-type resolution (Licensing &amp; Entitlements §12-13): an active
    /// override on this domain's key wins outright; otherwise MAX(base plan,
    /// packs) — already how Product Configuration resolved the snapshot, so
    /// this is really "does an override beat what Configuration already decided."
    /// </summary>
    private static (CapabilityProfileLevel Value, EntitlementSource Source, Guid? SourceRefId) ResolveProfile(
        CommercialProductVersion version, IReadOnlyList<CommercialPackVersion> packVersions,
        IReadOnlyList<EntitlementOverride> activeOverrides, CapabilityDomain domain)
    {
        var overrideKey = ProfileKey(domain);
        var over = activeOverrides.FirstOrDefault(o => o.EntitlementKey == overrideKey);
        if (over is not null && Enum.TryParse<CapabilityProfileLevel>(over.Value, out var overrideValue))
            return (overrideValue, EntitlementSource.ManualOverride, over.Id);

        var baseValue = version.ProfileFor(domain);
        var packValue = packVersions.Select(v => v.Grant(domain) ?? CapabilityProfileLevel.Foundation)
                                     .DefaultIfEmpty(CapabilityProfileLevel.Foundation)
                                     .Max();
        return packValue > baseValue
            ? (packValue, EntitlementSource.CapabilityPack, null)
            : (baseValue, EntitlementSource.BaseProduct, null);
    }

    /// <summary>Non-profile resolution (capacity, usage allowance): override wins outright, else the snapshot's own already-additive value.</summary>
    private static (string Value, EntitlementSource Source, Guid? SourceRefId) ResolveScalar(
        string key, string baseValue, IReadOnlyList<EntitlementOverride> activeOverrides)
    {
        var over = activeOverrides.FirstOrDefault(o => o.EntitlementKey == key);
        return over is not null
            ? (over.Value, EntitlementSource.ManualOverride, over.Id)
            : (baseValue, EntitlementSource.BaseProduct, null);
    }

    /// <summary>Fixed lookup (decision: sidesteps the source docs' incomplete/self-contradictory per-capability AI matrix, §17).</summary>
    private static AiAssistanceLevel AiLevelFor(CapabilityProfileLevel profile) => profile switch
    {
        CapabilityProfileLevel.Foundation => AiAssistanceLevel.Manual,
        CapabilityProfileLevel.Professional => AiAssistanceLevel.Assist,
        CapabilityProfileLevel.AiPlus => AiAssistanceLevel.CoPilot,
        _ => throw new ArgumentOutOfRangeException(nameof(profile), profile, null),
    };
}
