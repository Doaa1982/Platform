namespace Platform.Domain;

/// <summary>
/// Commercial Pack Version Aggregate Root — the priced/entitled definition
/// of a <see cref="CommercialPack"/> at a point in time. Standalone
/// aggregate root, same reasoning as <see cref="CommercialProductVersion"/>:
/// referenced directly by id from <see cref="ConfigurationSnapshot"/>.
///
/// A pack grants at most one profile bump per domain (Learning/Assessment/
/// Analytics/Branding — fixed columns, same pattern as
/// <see cref="ConfigurationSnapshot"/>'s own four domain fields, since no
/// pack in this catalog has ever needed more than one domain grant at once)
/// and/or extra tutor capacity, and may declare the one kind of dependency
/// this pass supports (Product Configuration Engine §21's worked example:
/// a pack requiring a minimum profile on some domain before it can be added).
/// </summary>
public class CommercialPackVersion
{
    public Guid Id { get; private set; }
    public Guid PackId { get; private set; }
    public int VersionNumber { get; private set; }
    public CatalogStatus Status { get; private set; }

    public decimal MonthlyPrice { get; private set; }
    public string Currency { get; private set; } = string.Empty;

    public CapabilityProfileLevel? LearningGrant { get; private set; }
    public CapabilityProfileLevel? AssessmentGrant { get; private set; }
    public CapabilityProfileLevel? AnalyticsGrant { get; private set; }
    public CapabilityProfileLevel? BrandingGrant { get; private set; }

    public int ExtraTutorCapacity { get; private set; }
    public int ExtraLearnerCapacity { get; private set; }
    public int ExtraVideoStorageGb { get; private set; }
    public int ExtraResourceStorageGb { get; private set; }

    public CapabilityDomain? RequiresDomain { get; private set; }
    public CapabilityProfileLevel? RequiresMinLevel { get; private set; }

    public DateTime CreatedAt { get; private set; }
    public DateTime? PublishedAt { get; private set; }
    public DateTime? RetiredAt { get; private set; }

    // Required by EF Core — not for application use
    private CommercialPackVersion() { }

    public static CommercialPackVersion Create(
        Guid packId, int versionNumber, decimal monthlyPrice, string currency,
        CapabilityProfileLevel? learningGrant, CapabilityProfileLevel? assessmentGrant,
        CapabilityProfileLevel? analyticsGrant, CapabilityProfileLevel? brandingGrant,
        int extraTutorCapacity, int extraLearnerCapacity, int extraVideoStorageGb, int extraResourceStorageGb,
        CapabilityDomain? requiresDomain, CapabilityProfileLevel? requiresMinLevel)
    {
        if (packId == Guid.Empty)
            throw new ArgumentException("A Commercial Pack Version belongs to exactly one Commercial Pack.", nameof(packId));
        if (versionNumber <= 0)
            throw new ArgumentException("Version numbers start at 1.", nameof(versionNumber));
        ValidateFields(monthlyPrice, currency, extraTutorCapacity, extraLearnerCapacity, extraVideoStorageGb, extraResourceStorageGb, requiresDomain, requiresMinLevel);

        return new CommercialPackVersion
        {
            Id = Guid.NewGuid(),
            PackId = packId,
            VersionNumber = versionNumber,
            Status = CatalogStatus.Draft,
            MonthlyPrice = monthlyPrice,
            Currency = currency,
            LearningGrant = learningGrant,
            AssessmentGrant = assessmentGrant,
            AnalyticsGrant = analyticsGrant,
            BrandingGrant = brandingGrant,
            ExtraTutorCapacity = extraTutorCapacity,
            ExtraLearnerCapacity = extraLearnerCapacity,
            ExtraVideoStorageGb = extraVideoStorageGb,
            ExtraResourceStorageGb = extraResourceStorageGb,
            RequiresDomain = requiresDomain,
            RequiresMinLevel = requiresMinLevel,
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

    public void Retire()
    {
        if (Status == CatalogStatus.Retired)
            throw new InvalidOperationException("This version is already retired.");
        Status = CatalogStatus.Retired;
        RetiredAt = DateTime.UtcNow;
    }

    /// <summary>
    /// A correction to a Version nobody has actually bought yet, not a
    /// repricing event — same reasoning as <see cref="CommercialProductVersion.UpdateFields"/>.
    /// The caller (CatalogAdminService) is responsible for confirming no live
    /// Subscription references this Version before calling this.
    /// </summary>
    public void UpdateFields(
        decimal monthlyPrice, string currency,
        CapabilityProfileLevel? learningGrant, CapabilityProfileLevel? assessmentGrant,
        CapabilityProfileLevel? analyticsGrant, CapabilityProfileLevel? brandingGrant,
        int extraTutorCapacity, int extraLearnerCapacity, int extraVideoStorageGb, int extraResourceStorageGb,
        CapabilityDomain? requiresDomain, CapabilityProfileLevel? requiresMinLevel)
    {
        if (Status == CatalogStatus.Retired)
            throw new InvalidOperationException("A retired version cannot be edited.");
        ValidateFields(monthlyPrice, currency, extraTutorCapacity, extraLearnerCapacity, extraVideoStorageGb, extraResourceStorageGb, requiresDomain, requiresMinLevel);

        MonthlyPrice = monthlyPrice;
        Currency = currency;
        LearningGrant = learningGrant;
        AssessmentGrant = assessmentGrant;
        AnalyticsGrant = analyticsGrant;
        BrandingGrant = brandingGrant;
        ExtraTutorCapacity = extraTutorCapacity;
        ExtraLearnerCapacity = extraLearnerCapacity;
        ExtraVideoStorageGb = extraVideoStorageGb;
        ExtraResourceStorageGb = extraResourceStorageGb;
        RequiresDomain = requiresDomain;
        RequiresMinLevel = requiresMinLevel;
    }

    public CapabilityProfileLevel? Grant(CapabilityDomain domain) => domain switch
    {
        CapabilityDomain.Learning => LearningGrant,
        CapabilityDomain.Assessment => AssessmentGrant,
        CapabilityDomain.Analytics => AnalyticsGrant,
        CapabilityDomain.Branding => BrandingGrant,
        CapabilityDomain.Collaboration => null,
        _ => throw new ArgumentOutOfRangeException(nameof(domain), domain, null),
    };

    private static void ValidateFields(
        decimal monthlyPrice, string currency,
        int extraTutorCapacity, int extraLearnerCapacity, int extraVideoStorageGb, int extraResourceStorageGb,
        CapabilityDomain? requiresDomain, CapabilityProfileLevel? requiresMinLevel)
    {
        if (monthlyPrice < 0)
            throw new ArgumentException("Price cannot be negative.", nameof(monthlyPrice));
        ArgumentException.ThrowIfNullOrWhiteSpace(currency);
        if (extraTutorCapacity < 0)
            throw new ArgumentException("Extra tutor capacity cannot be negative.", nameof(extraTutorCapacity));
        if (extraLearnerCapacity < 0)
            throw new ArgumentException("Extra learner capacity cannot be negative.", nameof(extraLearnerCapacity));
        if (extraVideoStorageGb < 0)
            throw new ArgumentException("Extra video storage cannot be negative.", nameof(extraVideoStorageGb));
        if (extraResourceStorageGb < 0)
            throw new ArgumentException("Extra resource storage cannot be negative.", nameof(extraResourceStorageGb));
        if (requiresDomain is null != requiresMinLevel is null)
            throw new ArgumentException("A dependency needs both a domain and a minimum level, or neither.");
    }
}
