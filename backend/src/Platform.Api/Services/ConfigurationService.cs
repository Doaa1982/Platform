using Platform.Api.Models;
using Platform.Domain;
using Platform.Infrastructure;

namespace Platform.Api.Services;

/// <summary>
/// Product Configuration Engine — Product Configuration Engine Architecture
/// §10, minimal version for this pass: Fixed Plan (a Solo tier) plus optional
/// Capability Pack / extra-capacity add-ons. Design-Your-Own-Plan is deferred,
/// so there is no persisted "still choosing" draft — a request is resolved
/// and priced in one step, following the authoritative processing order (§42):
/// load product → apply selections → resolve dependencies → resolve profiles
/// → resolve capacity → calculate price → produce snapshot.
///
/// §48's security constraint shapes the API here: the caller only ever
/// supplies catalog codes (plan code, pack codes), never raw entitlement
/// values — every value in the resulting <see cref="ConfigurationSnapshot"/>
/// is resolved against the current, Published catalog
/// (<see cref="CatalogQueryService"/>), not accepted from the client. The
/// resolved snapshot pins the exact <see cref="CommercialProductVersion"/>/
/// <see cref="CommercialPackVersion"/> rows used, so later catalog changes
/// (a Platform Operator publishing a new price) never drift a snapshot that
/// already exists — the Pricing Snapshot Principle, made real.
/// </summary>
public class ConfigurationService(PlatformDbContext db, CatalogQueryService catalogQuery)
{
    public async Task<ProvisioningResult<ConfigurationSnapshot>> ResolveAsync(
        Guid workspaceId, string planCode, IReadOnlyList<string>? packCodes, BillingCycle billingCycle,
        CancellationToken ct = default)
    {
        var found = await catalogQuery.FindPublishedProductAsync(planCode, ct);
        if (found is not { } resolvedProduct)
            return ProvisioningResult<ConfigurationSnapshot>.Fail(
                ProvisioningError.Invalid, $"\"{planCode}\" is not a Solo plan.");
        var (product, version) = resolvedProduct;

        var packs = new List<(CommercialPack Pack, CommercialPackVersion Version)>();
        foreach (var code in packCodes ?? [])
        {
            if (!Enum.TryParse<CapabilityPack>(code, ignoreCase: true, out var parsed))
                return ProvisioningResult<ConfigurationSnapshot>.Fail(
                    ProvisioningError.Invalid, $"\"{code}\" is not a Capability Pack.");

            var foundPack = await catalogQuery.FindPublishedPackAsync(parsed, ct);
            if (foundPack is not { } resolvedPack)
                return ProvisioningResult<ConfigurationSnapshot>.Fail(
                    ProvisioningError.Invalid, $"\"{code}\" is not a Capability Pack.");

            packs.Add(resolvedPack);
        }

        // ── Resolve Dependencies (§42 step 4 / §21's worked example) ──
        foreach (var (pack, packVersion) in packs)
        {
            if (packVersion.RequiresDomain is not { } domain || packVersion.RequiresMinLevel is not { } minLevel)
                continue;

            var basis = version.ProfileFor(domain);
            if (basis < minLevel)
                return ProvisioningResult<ConfigurationSnapshot>.Fail(
                    ProvisioningError.Invalid,
                    $"{pack.Name} requires {domain} at {minLevel} or above — this plan has {basis}. " +
                    "Choose a higher plan or a different pack.");
        }

        // ── Resolve Capability Profiles (§42 step 6, MAX rule, Licensing & Entitlements §12) ──
        var packVersions = packs.Select(p => p.Version).ToList();
        var learning = Max(version.LearningProfile, PackGrantFor(packVersions, CapabilityDomain.Learning));
        var assessment = Max(version.AssessmentProfile, PackGrantFor(packVersions, CapabilityDomain.Assessment));
        var analytics = Max(version.AnalyticsProfile, PackGrantFor(packVersions, CapabilityDomain.Analytics));
        var branding = Max(version.BrandingProfile, PackGrantFor(packVersions, CapabilityDomain.Branding));

        // ── Resolve Capacity (§42 step 8, additive — Licensing & Entitlements §14) ──
        var tutorCapacity = version.TutorCapacityBase + packVersions.Sum(v => v.ExtraTutorCapacity);
        if (tutorCapacity > version.TutorCapacityMax)
            return ProvisioningResult<ConfigurationSnapshot>.Fail(
                ProvisioningError.Invalid,
                $"{product.Name} supports at most {version.TutorCapacityMax} tutor(s) — the selected add-ons would need {tutorCapacity}.");

        // ── Calculate Price (§42 step 11) — placeholder pricing (Commercial Product Management §25) ──
        var isAnnual = billingCycle == BillingCycle.Annual;
        var basePrice = isAnnual ? version.AnnualPrice : version.MonthlyPrice;
        // Packs have no separate annual price; the plan's own annual discount convention
        // (10× monthly instead of 12×) is applied to pack add-ons too, for consistency.
        var packPrice = packVersions.Sum(v => isAnnual ? v.MonthlyPrice * 10m : v.MonthlyPrice);

        var snapshot = ConfigurationSnapshot.Create(
            workspaceId: workspaceId,
            productVersionId: version.Id,
            planCode: product.Code,
            selectedPackCodes: packs.Select(p => p.Pack.Code.ToString()),
            selectedPackVersionIds: packs.Select(p => p.Version.Id),
            tutorCapacity: tutorCapacity,
            aiCreditsIncluded: version.AiCreditsIncluded,
            learningProfile: learning,
            assessmentProfile: assessment,
            analyticsProfile: analytics,
            brandingProfile: branding,
            priceAmount: basePrice + packPrice,
            priceCurrency: version.Currency);

        db.ConfigurationSnapshots.Add(snapshot);
        return ProvisioningResult<ConfigurationSnapshot>.Success(snapshot);
    }

    private static CapabilityProfileLevel PackGrantFor(IEnumerable<CommercialPackVersion> packVersions, CapabilityDomain domain) =>
        packVersions.Select(v => v.Grant(domain) ?? CapabilityProfileLevel.Foundation)
                    .DefaultIfEmpty(CapabilityProfileLevel.Foundation)
                    .Max();

    private static CapabilityProfileLevel Max(CapabilityProfileLevel a, CapabilityProfileLevel b) => a > b ? a : b;
}
