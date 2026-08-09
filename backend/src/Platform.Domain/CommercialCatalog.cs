namespace Platform.Domain;

/// <summary>
/// A sellable Solo tier — the shape of one seed row for
/// <see cref="CommercialProduct"/>/<see cref="CommercialProductVersion"/>.
/// The catalog itself is database-backed (see those types); this record only
/// exists to describe the initial values <c>Program.cs</c> seeds on first
/// boot, sourced from <see cref="CommercialCatalog.Plans"/> below.
///
/// Prices are placeholders — no document states real V1 pricing ("actual
/// prices will be defined separately," Commercial Product Management §25).
/// </summary>
public sealed record SoloPlanDefinition
{
    public required string Code { get; init; }
    public required string Name { get; init; }
    public required decimal MonthlyPrice { get; init; }
    public required decimal AnnualPrice { get; init; }
    public required string Currency { get; init; }
    public required int TutorCapacityBase { get; init; }
    public required int TutorCapacityMax { get; init; }
    public required int AiCreditsIncluded { get; init; }
    public required CapabilityProfileLevel LearningProfile { get; init; }
    public required CapabilityProfileLevel AssessmentProfile { get; init; }
    public required CapabilityProfileLevel AnalyticsProfile { get; init; }
    public required CapabilityProfileLevel BrandingProfile { get; init; }
}

/// <summary>
/// An optional add-on. Per Commercial Product Management §20, "the pack
/// should not be implemented as a technical feature bundle — it is a
/// commercial bundle of entitlements": a pack's only effect is what it grants
/// through <see cref="DomainGrants"/>/<see cref="ExtraTutorCapacity"/>, resolved
/// the same way as the base plan (Licensing &amp; Entitlements §12's MAX rule for
/// profiles, additive for capacity).
/// </summary>
public sealed record CapabilityPackDefinition
{
    public required CapabilityPack Code { get; init; }
    public required string Name { get; init; }
    public required decimal MonthlyPrice { get; init; }
    public required string Currency { get; init; }

    /// <summary>Per-domain profile grant. A pack only affects the domains it lists (LIC-004 — no entitlement leakage into unrelated domains).</summary>
    public IReadOnlyDictionary<CapabilityDomain, CapabilityProfileLevel> DomainGrants { get; init; } =
        new Dictionary<CapabilityDomain, CapabilityProfileLevel>();

    public int ExtraTutorCapacity { get; init; }

    /// <summary>
    /// The one concrete dependency rule modeled in this pass (Product
    /// Configuration Engine §21's worked example): AI Assessment requires
    /// Assessment profile already at or above this level. Null for packs with
    /// no dependency.
    /// </summary>
    public (CapabilityDomain Domain, CapabilityProfileLevel MinLevel)? RequiresMinProfile { get; init; }
}

/// <summary>
/// Seed data only — read once at startup (<c>Program.cs</c>, if
/// <c>CommercialProducts</c> is empty) to populate the real, database-backed
/// catalog (<see cref="CommercialProduct"/>/<see cref="CommercialProductVersion"/>/
/// <see cref="CommercialPack"/>/<see cref="CommercialPackVersion"/>), then never
/// read again at request time. Studio and Academy families are confirmed
/// deferred (Decision Brief #2) and simply aren't seeded here; nothing about
/// the DB schema prevents adding them later.
/// </summary>
public static class CommercialCatalog
{
    public const string DefaultCurrency = "USD";

    public static readonly IReadOnlyList<SoloPlanDefinition> Plans =
    [
        new SoloPlanDefinition
        {
            Code = "solo-essential",
            Name = "Solo Essential",
            MonthlyPrice = 19m,
            AnnualPrice = 190m,
            Currency = DefaultCurrency,
            TutorCapacityBase = 1,
            TutorCapacityMax = 1,
            AiCreditsIncluded = 5_000,
            LearningProfile = CapabilityProfileLevel.Foundation,
            AssessmentProfile = CapabilityProfileLevel.Foundation,
            AnalyticsProfile = CapabilityProfileLevel.Foundation,
            BrandingProfile = CapabilityProfileLevel.Foundation,
        },
        new SoloPlanDefinition
        {
            Code = "solo-professional",
            Name = "Solo Professional",
            MonthlyPrice = 39m,
            AnnualPrice = 390m,
            Currency = DefaultCurrency,
            TutorCapacityBase = 1,
            TutorCapacityMax = 1,
            AiCreditsIncluded = 20_000,
            LearningProfile = CapabilityProfileLevel.Professional,
            AssessmentProfile = CapabilityProfileLevel.Professional,
            AnalyticsProfile = CapabilityProfileLevel.Professional,
            BrandingProfile = CapabilityProfileLevel.Professional,
        },
        new SoloPlanDefinition
        {
            Code = "solo-ai-plus",
            Name = "Solo AI+",
            MonthlyPrice = 79m,
            AnnualPrice = 790m,
            Currency = DefaultCurrency,
            TutorCapacityBase = 1,
            TutorCapacityMax = 2,
            AiCreditsIncluded = 75_000,
            LearningProfile = CapabilityProfileLevel.AiPlus,
            AssessmentProfile = CapabilityProfileLevel.AiPlus,
            AnalyticsProfile = CapabilityProfileLevel.AiPlus,
            // §39's own worked example keeps Branding at Professional even on
            // AI+ — branding isn't part of the AI value proposition, so it
            // doesn't ride along with the other three domains on this tier.
            BrandingProfile = CapabilityProfileLevel.Professional,
        },
    ];

    public static readonly IReadOnlyList<CapabilityPackDefinition> Packs =
    [
        new CapabilityPackDefinition
        {
            Code = CapabilityPack.AiAuthor,
            Name = "AI Author",
            MonthlyPrice = 9m,
            Currency = DefaultCurrency,
            DomainGrants = new Dictionary<CapabilityDomain, CapabilityProfileLevel>
            {
                [CapabilityDomain.Learning] = CapabilityProfileLevel.AiPlus,
            },
        },
        new CapabilityPackDefinition
        {
            Code = CapabilityPack.AiAssessment,
            Name = "AI Assessment",
            MonthlyPrice = 9m,
            Currency = DefaultCurrency,
            DomainGrants = new Dictionary<CapabilityDomain, CapabilityProfileLevel>
            {
                [CapabilityDomain.Assessment] = CapabilityProfileLevel.AiPlus,
            },
            // §21's worked example: AI Assessment depends on Assessment ≥ Professional.
            RequiresMinProfile = (CapabilityDomain.Assessment, CapabilityProfileLevel.Professional),
        },
        new CapabilityPackDefinition
        {
            Code = CapabilityPack.AiMentor,
            Name = "AI Mentor",
            MonthlyPrice = 9m,
            Currency = DefaultCurrency,
            DomainGrants = new Dictionary<CapabilityDomain, CapabilityProfileLevel>
            {
                [CapabilityDomain.Analytics] = CapabilityProfileLevel.AiPlus,
            },
        },
        new CapabilityPackDefinition
        {
            Code = CapabilityPack.Branding,
            Name = "Branding",
            MonthlyPrice = 5m,
            Currency = DefaultCurrency,
            DomainGrants = new Dictionary<CapabilityDomain, CapabilityProfileLevel>
            {
                [CapabilityDomain.Branding] = CapabilityProfileLevel.AiPlus,
            },
        },
        new CapabilityPackDefinition
        {
            Code = CapabilityPack.Collaboration,
            Name = "Collaboration",
            MonthlyPrice = 5m,
            Currency = DefaultCurrency,
            ExtraTutorCapacity = 1,
        },
    ];
}
