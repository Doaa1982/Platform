namespace Platform.Domain;

/// <summary>
/// Commercial Product Version Aggregate Root — the actual priced/entitled
/// definition of a <see cref="CommercialProduct"/> at a point in time
/// (Commercial Domain Data Model §3's PRODUCT_VERSION). Insert-only, same
/// discipline as <see cref="ConfigurationSnapshot"/>: "editing a price"
/// means creating a new Draft Version and publishing it, never patching an
/// existing Version's numbers (CPR-008).
///
/// A standalone aggregate root — not an owned child collection of
/// CommercialProduct — because <see cref="ConfigurationSnapshot"/> (a
/// different aggregate entirely) references one specific Version directly
/// by id, and because "list every Draft version across all Products" is a
/// real admin query that shouldn't require loading every Product's full
/// child collection to answer.
/// </summary>
public class CommercialProductVersion
{
    public Guid Id { get; private set; }
    public Guid ProductId { get; private set; }
    public int VersionNumber { get; private set; }
    public CatalogStatus Status { get; private set; }

    public decimal MonthlyPrice { get; private set; }
    public decimal AnnualPrice { get; private set; }
    public string Currency { get; private set; } = string.Empty;

    public int TutorCapacityBase { get; private set; }
    public int TutorCapacityMax { get; private set; }
    public int AiCreditsIncluded { get; private set; }

    public CapabilityProfileLevel LearningProfile { get; private set; }
    public CapabilityProfileLevel AssessmentProfile { get; private set; }
    public CapabilityProfileLevel AnalyticsProfile { get; private set; }
    public CapabilityProfileLevel BrandingProfile { get; private set; }

    public DateTime CreatedAt { get; private set; }
    public DateTime? PublishedAt { get; private set; }
    public DateTime? RetiredAt { get; private set; }

    // Required by EF Core — not for application use
    private CommercialProductVersion() { }

    public static CommercialProductVersion Create(
        Guid productId, int versionNumber,
        decimal monthlyPrice, decimal annualPrice, string currency,
        int tutorCapacityBase, int tutorCapacityMax, int aiCreditsIncluded,
        CapabilityProfileLevel learningProfile, CapabilityProfileLevel assessmentProfile,
        CapabilityProfileLevel analyticsProfile, CapabilityProfileLevel brandingProfile)
    {
        if (productId == Guid.Empty)
            throw new ArgumentException("A Commercial Product Version belongs to exactly one Commercial Product.", nameof(productId));
        if (versionNumber <= 0)
            throw new ArgumentException("Version numbers start at 1.", nameof(versionNumber));
        if (monthlyPrice < 0 || annualPrice < 0)
            throw new ArgumentException("Price cannot be negative.");
        ArgumentException.ThrowIfNullOrWhiteSpace(currency);
        if (tutorCapacityBase <= 0)
            throw new ArgumentException("Tutor capacity must be at least one.", nameof(tutorCapacityBase));
        if (tutorCapacityMax < tutorCapacityBase)
            throw new ArgumentException("Max tutor capacity cannot be below the base.", nameof(tutorCapacityMax));
        if (aiCreditsIncluded < 0)
            throw new ArgumentException("AI credits cannot be negative.", nameof(aiCreditsIncluded));

        return new CommercialProductVersion
        {
            Id = Guid.NewGuid(),
            ProductId = productId,
            VersionNumber = versionNumber,
            Status = CatalogStatus.Draft,
            MonthlyPrice = monthlyPrice,
            AnnualPrice = annualPrice,
            Currency = currency,
            TutorCapacityBase = tutorCapacityBase,
            TutorCapacityMax = tutorCapacityMax,
            AiCreditsIncluded = aiCreditsIncluded,
            LearningProfile = learningProfile,
            AssessmentProfile = assessmentProfile,
            AnalyticsProfile = analyticsProfile,
            BrandingProfile = brandingProfile,
            CreatedAt = DateTime.UtcNow,
        };
    }

    public void Publish()
    {
        if (Status != CatalogStatus.Draft)
            throw new InvalidOperationException("Only a draft version can be published.");
        Status = CatalogStatus.Published;
        PublishedAt = DateTime.UtcNow;
    }

    /// <summary>CPR-009: retiring a Version never invalidates a ConfigurationSnapshot that already references it.</summary>
    public void Retire()
    {
        if (Status == CatalogStatus.Retired)
            throw new InvalidOperationException("This version is already retired.");
        Status = CatalogStatus.Retired;
        RetiredAt = DateTime.UtcNow;
    }

    /// <summary>Collaboration has no dedicated field here (see ConfigurationSnapshot.ProfileFor's matching remark) — falls back to Foundation, the ladder's floor.</summary>
    public CapabilityProfileLevel ProfileFor(CapabilityDomain domain) => domain switch
    {
        CapabilityDomain.Learning => LearningProfile,
        CapabilityDomain.Assessment => AssessmentProfile,
        CapabilityDomain.Analytics => AnalyticsProfile,
        CapabilityDomain.Branding => BrandingProfile,
        CapabilityDomain.Collaboration => CapabilityProfileLevel.Foundation,
        _ => throw new ArgumentOutOfRangeException(nameof(domain), domain, null),
    };
}
