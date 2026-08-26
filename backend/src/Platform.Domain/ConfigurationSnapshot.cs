namespace Platform.Domain;

/// <summary>
/// Configuration Snapshot Aggregate Root — Product Configuration Engine
/// Architecture §37-38. Immutable, insert-only (CPR-008): protects a past
/// commercial decision from later catalog changes, since Subscription and
/// WorkspaceLicense both reference it rather than re-deriving from the live
/// catalog.
///
/// Fixed-Plan-only for this pass (Design-Your-Own-Plan is deferred): the
/// values here are the base plan plus whichever optional Capability Packs and
/// extra tutor capacity were selected on top of it, already resolved by
/// <see cref="Platform.Api.Services.ConfigurationService"/>'s pipeline
/// (validate → resolve dependencies → resolve profiles via MAX → resolve
/// capacity additively → price). This aggregate only holds the result and
/// enforces that it is well-formed — the resolution logic itself needs the
/// catalog, which belongs in a service, not here.
/// </summary>
public class ConfigurationSnapshot
{
    private readonly List<string> _selectedPackCodes = [];
    private readonly List<Guid> _selectedPackVersionIds = [];

    public Guid Id { get; private set; }
    public Guid WorkspaceId { get; private set; }
    public string PlanCode { get; private set; } = string.Empty;

    /// <summary>The exact CommercialProductVersion this snapshot was priced/entitled against — the Pricing Snapshot Principle, made real: resolution never re-derives from whatever the catalog says now.</summary>
    public Guid ProductVersionId { get; private set; }

    public IReadOnlyList<string> SelectedPackCodes => _selectedPackCodes.AsReadOnly();

    /// <summary>Parallel to SelectedPackCodes, same index order — the exact CommercialPackVersion rows, so pack grants get the same point-in-time fidelity as the base plan.</summary>
    public IReadOnlyList<Guid> SelectedPackVersionIds => _selectedPackVersionIds.AsReadOnly();

    public int TutorCapacity { get; private set; }
    public int LearnerCapacity { get; private set; }
    public int VideoStorageGb { get; private set; }
    public int ResourceStorageGb { get; private set; }
    public int AiCreditsIncluded { get; private set; }

    public CapabilityProfileLevel LearningProfile { get; private set; }
    public CapabilityProfileLevel AssessmentProfile { get; private set; }
    public CapabilityProfileLevel AnalyticsProfile { get; private set; }
    public CapabilityProfileLevel BrandingProfile { get; private set; }

    public decimal PriceAmount { get; private set; }
    public string PriceCurrency { get; private set; } = string.Empty;

    public DateTime CreatedAt { get; private set; }

    // Required by EF Core — not for application use
    private ConfigurationSnapshot() { }

    public static ConfigurationSnapshot Create(
        Guid workspaceId,
        Guid productVersionId,
        string planCode,
        IEnumerable<string> selectedPackCodes,
        IEnumerable<Guid> selectedPackVersionIds,
        int tutorCapacity,
        int learnerCapacity,
        int videoStorageGb,
        int resourceStorageGb,
        int aiCreditsIncluded,
        CapabilityProfileLevel learningProfile,
        CapabilityProfileLevel assessmentProfile,
        CapabilityProfileLevel analyticsProfile,
        CapabilityProfileLevel brandingProfile,
        decimal priceAmount,
        string priceCurrency)
    {
        if (workspaceId == Guid.Empty)
            throw new ArgumentException("A Configuration Snapshot belongs to exactly one Workspace.", nameof(workspaceId));
        if (productVersionId == Guid.Empty)
            throw new ArgumentException("A Configuration Snapshot must reference the exact Commercial Product Version it was priced against.", nameof(productVersionId));
        ArgumentException.ThrowIfNullOrWhiteSpace(planCode);
        if (tutorCapacity <= 0)
            throw new ArgumentException("Tutor capacity must be at least one.", nameof(tutorCapacity));
        if (learnerCapacity <= 0)
            throw new ArgumentException("Learner capacity must be at least one.", nameof(learnerCapacity));
        if (videoStorageGb <= 0)
            throw new ArgumentException("Video storage capacity must be at least one gigabyte.", nameof(videoStorageGb));
        if (resourceStorageGb <= 0)
            throw new ArgumentException("Resource storage capacity must be at least one gigabyte.", nameof(resourceStorageGb));
        if (aiCreditsIncluded < 0)
            throw new ArgumentException("AI credits cannot be negative.", nameof(aiCreditsIncluded));
        if (priceAmount < 0)
            throw new ArgumentException("Price cannot be negative.", nameof(priceAmount));
        ArgumentException.ThrowIfNullOrWhiteSpace(priceCurrency);

        var snapshot = new ConfigurationSnapshot
        {
            Id = Guid.NewGuid(),
            WorkspaceId = workspaceId,
            PlanCode = planCode,
            ProductVersionId = productVersionId,
            TutorCapacity = tutorCapacity,
            LearnerCapacity = learnerCapacity,
            VideoStorageGb = videoStorageGb,
            ResourceStorageGb = resourceStorageGb,
            AiCreditsIncluded = aiCreditsIncluded,
            LearningProfile = learningProfile,
            AssessmentProfile = assessmentProfile,
            AnalyticsProfile = analyticsProfile,
            BrandingProfile = brandingProfile,
            PriceAmount = priceAmount,
            PriceCurrency = priceCurrency,
            CreatedAt = DateTime.UtcNow,
        };
        snapshot._selectedPackCodes.AddRange(selectedPackCodes);
        snapshot._selectedPackVersionIds.AddRange(selectedPackVersionIds);
        return snapshot;
    }

    /// <summary>
    /// The resolved profile for one domain. Collaboration has no dedicated
    /// plan-level field (no Solo tier prices a base Collaboration profile —
    /// only the Collaboration Pack's extra tutor capacity does), so it falls
    /// back to Foundation, the ladder's floor.
    /// </summary>
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
