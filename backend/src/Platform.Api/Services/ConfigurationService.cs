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
        // The Base/Max ceiling is only enforced on the Free plan. Every paid
        // plan lets a tutor keep stacking capacity add-ons with no upper
        // bound — the plan tier (AI level, branding, analytics) is the
        // upsell lever here, not raw storage/seat count, and Free needs its
        // own hard ceiling so it can't be grown into an enterprise-size
        // workspace for the price of a few add-ons (CommercialCatalog.FreePlanCode).
        var enforceCeiling = product.Code == CommercialCatalog.FreePlanCode;

        var tutorCapacity = version.TutorCapacityBase + packVersions.Sum(v => v.ExtraTutorCapacity);
        if (enforceCeiling && tutorCapacity > version.TutorCapacityMax)
            return ProvisioningResult<ConfigurationSnapshot>.Fail(
                ProvisioningError.Invalid,
                $"{product.Name} supports at most {version.TutorCapacityMax} tutor(s) — the selected add-ons would need {tutorCapacity}.");

        var learnerCapacity = version.LearnerCapacityBase + packVersions.Sum(v => v.ExtraLearnerCapacity);
        if (enforceCeiling && learnerCapacity > version.LearnerCapacityMax)
            return ProvisioningResult<ConfigurationSnapshot>.Fail(
                ProvisioningError.Invalid,
                $"{product.Name} supports at most {version.LearnerCapacityMax} learner(s) — the selected add-ons would need {learnerCapacity}.");

        var videoStorageGb = version.VideoStorageGbBase + packVersions.Sum(v => v.ExtraVideoStorageGb);
        if (enforceCeiling && videoStorageGb > version.VideoStorageGbMax)
            return ProvisioningResult<ConfigurationSnapshot>.Fail(
                ProvisioningError.Invalid,
                $"{product.Name} supports at most {version.VideoStorageGbMax}GB of video storage — the selected add-ons would need {videoStorageGb}GB.");

        var resourceStorageGb = version.ResourceStorageGbBase + packVersions.Sum(v => v.ExtraResourceStorageGb);
        if (enforceCeiling && resourceStorageGb > version.ResourceStorageGbMax)
            return ProvisioningResult<ConfigurationSnapshot>.Fail(
                ProvisioningError.Invalid,
                $"{product.Name} supports at most {version.ResourceStorageGbMax}GB of resource storage — the selected add-ons would need {resourceStorageGb}GB.");

        // ── Calculate Price (§42 step 11) — placeholder pricing (Commercial Product Management §25) ──
        var isAnnual = billingCycle == BillingCycle.Annual;
        var basePrice = isAnnual ? version.AnnualPrice : version.MonthlyPrice;
        // Packs have no separate annual price; the plan's own annual discount convention
        // (10× monthly instead of 12×) is applied to pack add-ons too, for consistency.
        var packPrice = packVersions.Sum(v => isAnnual ? v.MonthlyPrice * 10m : v.MonthlyPrice);

        // A credit allowance only means something where at least one domain
        // actually resolves above Foundation — Foundation always maps to
        // AiAssistanceLevel.Manual (EntitlementResolutionService.AiLevelFor),
        // which blocks every AI skill call outright. Granting credits nobody
        // can spend (e.g. Solo Essential alone, before any AI-enabling pack)
        // just misrepresents the plan. This is resolved per configuration,
        // not hardcoded per plan, so the same base plan correctly keeps its
        // credits once a pack raises any one domain above Foundation.
        var anyDomainHasAi = learning != CapabilityProfileLevel.Foundation
                           || assessment != CapabilityProfileLevel.Foundation
                           || analytics != CapabilityProfileLevel.Foundation
                           || branding != CapabilityProfileLevel.Foundation;
        var aiCreditsIncluded = anyDomainHasAi ? version.AiCreditsIncluded : 0;

        var snapshot = ConfigurationSnapshot.Create(
            workspaceId: workspaceId,
            productVersionId: version.Id,
            planCode: product.Code,
            selectedPackCodes: packs.Select(p => p.Pack.Code.ToString()),
            selectedPackVersionIds: packs.Select(p => p.Version.Id),
            tutorCapacity: tutorCapacity,
            learnerCapacity: learnerCapacity,
            videoStorageGb: videoStorageGb,
            resourceStorageGb: resourceStorageGb,
            aiCreditsIncluded: aiCreditsIncluded,
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
