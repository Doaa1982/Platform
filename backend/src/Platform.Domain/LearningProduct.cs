namespace Platform.Domain;

/// <summary>
/// Learning Product Aggregate Root.
///
/// The commercial and organisational unit a learner enrols in — a course, a
/// programme, a track (Learning Product Aggregate Design §2). It is deliberately
/// shallow: it owns identity, metadata, settings and publication status, and
/// references its teaching content rather than containing it.
///
/// The distinction that matters (§10): a Learning Product is *what is offered*;
/// a Curriculum is *what is taught*. The Product's identity survives Curriculum
/// changes entirely (INV-005), which is why enrolment history stays coherent
/// when a tutor rewrites their material.
///
/// Invariants enforced here:
///   INV-001: belongs to exactly one Workspace.
///   INV-002: one identity, stable across its lifetime.
///   INV-004: may exist in Draft with no Curriculum and no commercial terms.
///   §16:     the ordered state machine.
///
/// NOT enforced, and deliberately visible:
///   INV-006: a Product cannot publish without an active, published Curriculum.
///            Curriculum is not implemented, so there is nothing to reference
///            and nothing to check. See <see cref="Publish"/>.
/// </summary>
public class LearningProduct
{
    private readonly List<string> _tags = [];

    public Guid Id { get; private set; }
    public Guid WorkspaceId { get; private set; }

    // ── Product Metadata (§8) ────────────────────────────────────────────────
    public string Title { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public string? Category { get; private set; }
    public IReadOnlyCollection<string> Tags => _tags.AsReadOnly();

    public LearningProductStatus Status { get; private set; }

    // ── Product Settings (§8) ────────────────────────────────────────────────
    public PacingModel Pacing { get; private set; }
    public string? DefaultLanguage { get; private set; }
    public EnrollmentMode EnrollmentMode { get; private set; }

    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }
    public DateTime? PublishedAt { get; private set; }

    /// <summary>
    /// The Membership that created it. Authorship traces through Membership,
    /// never directly to an Identity (Membership Aggregate Design §4).
    /// </summary>
    public Guid CreatedByMembershipId { get; private set; }

    // Required by EF Core — not for application use
    private LearningProduct() { }

    /// <summary>
    /// CreateLearningProduct (§14). Begins in Draft, which per INV-004 is a
    /// complete and valid state: no curriculum, no price, nothing but a title.
    /// A tutor should be able to write down an idea before building it.
    /// </summary>
    public static LearningProduct Create(
        Guid workspaceId,
        Guid createdByMembershipId,
        string title,
        string? description = null,
        PacingModel pacing = PacingModel.SelfPaced,
        EnrollmentMode enrollmentMode = EnrollmentMode.Open)
    {
        if (workspaceId == Guid.Empty)
            throw new ArgumentException("A Learning Product belongs to exactly one Workspace (INV-001).", nameof(workspaceId));
        if (createdByMembershipId == Guid.Empty)
            throw new ArgumentException("A Learning Product records the Membership that created it.", nameof(createdByMembershipId));
        ArgumentException.ThrowIfNullOrWhiteSpace(title);

        var now = DateTime.UtcNow;
        return new LearningProduct
        {
            Id = Guid.NewGuid(),
            WorkspaceId = workspaceId,
            CreatedByMembershipId = createdByMembershipId,
            Title = title.Trim(),
            Description = Clean(description),
            Status = LearningProductStatus.Draft,
            Pacing = pacing,
            EnrollmentMode = enrollmentMode,
            CreatedAt = now,
            UpdatedAt = now
        };
    }

    /// <summary>
    /// UpdateProductMetadata (§14). Permitted in any state short of Archived —
    /// fixing a typo in a published title must not require unpublishing.
    /// </summary>
    public void UpdateMetadata(string title, string? description, string? category, IEnumerable<string>? tags)
    {
        RequireNotArchived();
        ArgumentException.ThrowIfNullOrWhiteSpace(title);

        Title = title.Trim();
        Description = Clean(description);
        Category = Clean(category);

        _tags.Clear();
        if (tags is not null)
            _tags.AddRange(tags.Select(t => t.Trim()).Where(t => t.Length > 0).Distinct(StringComparer.OrdinalIgnoreCase));

        Touch();
    }

    /// <summary>UpdateProductSettings (§14).</summary>
    public void UpdateSettings(PacingModel pacing, EnrollmentMode enrollmentMode, string? defaultLanguage)
    {
        RequireNotArchived();
        Pacing = pacing;
        EnrollmentMode = enrollmentMode;
        DefaultLanguage = Clean(defaultLanguage);
        Touch();
    }

    // ── State machine (§16) ──────────────────────────────────────────────────

    /// <summary>Draft → UnderReview. Submitted for whatever review the Workspace applies.</summary>
    public void SubmitForReview() => Transition(LearningProductStatus.UnderReview, LearningProductStatus.Draft);

    /// <summary>UnderReview → Draft, when review sends it back.</summary>
    public void ReturnToDraft() => Transition(LearningProductStatus.Draft, LearningProductStatus.UnderReview);

    /// <summary>
    /// PublishLearningProduct (§14).
    ///
    /// INV-006 additionally requires an active, published Curriculum. Curriculum
    /// is not implemented, so that half cannot be checked and is not silently
    /// treated as satisfied — it is recorded in the backlog rather than assumed
    /// away. What is enforced here is the ordering and a non-empty title.
    /// </summary>
    public void Publish()
    {
        if (string.IsNullOrWhiteSpace(Title))
            throw new InvalidOperationException("A Learning Product needs a title before it can be published.");

        Transition(LearningProductStatus.Published, LearningProductStatus.Draft, LearningProductStatus.UnderReview);
        PublishedAt = DateTime.UtcNow;
    }

    /// <summary>Published → Draft. Withdrawn from offer without being archived.</summary>
    public void Unpublish() => Transition(LearningProductStatus.Draft, LearningProductStatus.Published);

    /// <summary>
    /// ArchiveLearningProduct (§14). Terminal.
    /// INV-007: archiving deletes no Curriculum, Lesson or historical Enrollment.
    /// </summary>
    public void Archive() => Transition(
        LearningProductStatus.Archived,
        LearningProductStatus.Draft, LearningProductStatus.UnderReview, LearningProductStatus.Published);

    private void Transition(LearningProductStatus target, params LearningProductStatus[] permittedFrom)
    {
        if (!permittedFrom.Contains(Status))
            throw new InvalidOperationException(
                $"A Learning Product that is {Status} cannot become {target}. Permitted from: {string.Join(", ", permittedFrom)} (Learning Product Aggregate Design, Section 16).");

        Status = target;
        Touch();
    }

    private void RequireNotArchived()
    {
        if (Status == LearningProductStatus.Archived)
            throw new InvalidOperationException("An archived Learning Product cannot be edited.");
    }

    private void Touch() => UpdatedAt = DateTime.UtcNow;

    private static string? Clean(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
