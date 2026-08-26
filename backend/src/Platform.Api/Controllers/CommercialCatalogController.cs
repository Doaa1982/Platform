using Microsoft.AspNetCore.Mvc;
using Platform.Api.Models;
using Platform.Api.Services;
using Platform.Domain;

namespace Platform.Api.Controllers;

/// <summary>
/// The Solo product family's public catalog — no authentication required,
/// same as the public Landing/pricing pages: a prospective customer needs to
/// see plans and pricing before signing up for anything. Database-backed via
/// <see cref="CatalogQueryService"/> — always reflects whichever Version a
/// Platform Operator most recently published.
/// </summary>
[ApiController]
[Route("api/catalog")]
public class CommercialCatalogController(CatalogQueryService catalogQuery) : ControllerBase
{
    [HttpGet("plans")]
    public async Task<ActionResult<IReadOnlyList<PlanSummary>>> GetPlans(CancellationToken ct)
    {
        var products = await catalogQuery.ListPublishedProductsAsync(ct);
        return Ok(products.Select(p => Describe(p.Product, p.Version)).ToList());
    }

    [HttpGet("packs")]
    public async Task<ActionResult<IReadOnlyList<PackSummary>>> GetPacks(CancellationToken ct)
    {
        var packs = await catalogQuery.ListPublishedPacksAsync(ct);
        return Ok(packs.Select(p => Describe(p.Pack, p.Version)).ToList());
    }

    /// <summary>AI-credit top-up tiers — see CreditPackCatalog's remarks on why these are a static list rather than database-backed.</summary>
    [HttpGet("credit-packs")]
    public ActionResult<IReadOnlyList<CreditPackTier>> GetCreditPacks() => Ok(CreditPackCatalog.Tiers);

    internal static PlanSummary Describe(CommercialProduct product, CommercialProductVersion version)
    {
        // Same reasoning as ConfigurationService.ResolveAsync's aiCreditsIncluded
        // clamp: advertising credits on a plan whose base profile is Foundation
        // everywhere (Manual AI assistance on every domain) misrepresents what
        // the bare plan actually offers — a browsing prospect hasn't chosen any
        // pack yet, so this reflects the plan alone, not a resolved configuration.
        var anyDomainHasAi = version.LearningProfile != CapabilityProfileLevel.Foundation
                           || version.AssessmentProfile != CapabilityProfileLevel.Foundation
                           || version.AnalyticsProfile != CapabilityProfileLevel.Foundation
                           || version.BrandingProfile != CapabilityProfileLevel.Foundation;

        return new(
            Code: product.Code,
            Name: product.Name,
            MonthlyPrice: version.MonthlyPrice,
            AnnualPrice: version.AnnualPrice,
            Currency: version.Currency,
            TutorCapacityBase: version.TutorCapacityBase,
            TutorCapacityMax: version.TutorCapacityMax,
            LearnerCapacityBase: version.LearnerCapacityBase,
            LearnerCapacityMax: version.LearnerCapacityMax,
            VideoStorageGbBase: version.VideoStorageGbBase,
            VideoStorageGbMax: version.VideoStorageGbMax,
            ResourceStorageGbBase: version.ResourceStorageGbBase,
            ResourceStorageGbMax: version.ResourceStorageGbMax,
            AiCreditsIncluded: anyDomainHasAi ? version.AiCreditsIncluded : 0,
            LearningProfile: version.LearningProfile.ToString(),
            AssessmentProfile: version.AssessmentProfile.ToString(),
            AnalyticsProfile: version.AnalyticsProfile.ToString(),
            BrandingProfile: version.BrandingProfile.ToString());
    }

    internal static PackSummary Describe(CommercialPack pack, CommercialPackVersion version)
    {
        var grants = new Dictionary<string, string>();
        if (version.LearningGrant is { } l) grants[nameof(CapabilityDomain.Learning)] = l.ToString();
        if (version.AssessmentGrant is { } a) grants[nameof(CapabilityDomain.Assessment)] = a.ToString();
        if (version.AnalyticsGrant is { } n) grants[nameof(CapabilityDomain.Analytics)] = n.ToString();
        if (version.BrandingGrant is { } b) grants[nameof(CapabilityDomain.Branding)] = b.ToString();

        return new PackSummary(
            Code: pack.Code.ToString(),
            Name: pack.Name,
            MonthlyPrice: version.MonthlyPrice,
            Currency: version.Currency,
            DomainGrants: grants,
            ExtraTutorCapacity: version.ExtraTutorCapacity,
            ExtraLearnerCapacity: version.ExtraLearnerCapacity,
            ExtraVideoStorageGb: version.ExtraVideoStorageGb,
            ExtraResourceStorageGb: version.ExtraResourceStorageGb,
            RequiresMinProfile: version.RequiresDomain is { } domain
                ? $"{domain} >= {version.RequiresMinLevel}"
                : null);
    }
}
