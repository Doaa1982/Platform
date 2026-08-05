namespace Platform.Domain;

/// <summary>
/// Lesson Aggregate Root.
///
/// The business identity and publication state of one lesson — not its content
/// (Lesson Aggregate Design §19). What is actually taught lives on
/// <see cref="LessonRevision"/>, so a tutor can rewrite a lesson without
/// disturbing what learners are currently reading.
///
/// Revisions are held here as an entity collection because they have no life
/// outside their Lesson: a revision of nothing is meaningless, and every rule
/// about which one is current is a rule about this Lesson. The aggregate
/// boundary the design draws is between *Lesson* and *content*, and that
/// boundary is honoured — Lesson never reasons about a revision's body.
///
/// Invariants enforced here:
///   INV-001: belongs to exactly one Learning Product.
///   INV-002: belongs to exactly one Workspace.
///   §8:      references exactly one current published revision, or none.
/// </summary>
public class Lesson
{
    private readonly List<LessonRevision> _revisions = [];

    public Guid Id { get; private set; }
    public Guid WorkspaceId { get; private set; }
    public Guid LearningProductId { get; private set; }

    /// <summary>The lesson's own name. A revision may title itself differently as it evolves.</summary>
    public string Title { get; private set; } = string.Empty;

    public LessonStatus Status { get; private set; }

    /// <summary>
    /// The revision learners currently see. Null until something is published —
    /// a Lesson can exist as an intention before any content is written.
    /// </summary>
    public Guid? CurrentRevisionId { get; private set; }

    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }

    public IReadOnlyCollection<LessonRevision> Revisions => _revisions.AsReadOnly();

    private Lesson() { }

    public static Lesson Create(Guid workspaceId, Guid learningProductId, string title, Guid authoredByMembershipId)
    {
        if (workspaceId == Guid.Empty)
            throw new ArgumentException("A Lesson belongs to exactly one Workspace (INV-002).", nameof(workspaceId));
        if (learningProductId == Guid.Empty)
            throw new ArgumentException("A Lesson belongs to exactly one Learning Product (INV-001).", nameof(learningProductId));
        ArgumentException.ThrowIfNullOrWhiteSpace(title);

        var now = DateTime.UtcNow;
        var lesson = new Lesson
        {
            Id = Guid.NewGuid(),
            WorkspaceId = workspaceId,
            LearningProductId = learningProductId,
            Title = title.Trim(),
            Status = LessonStatus.Draft,
            CreatedAt = now,
            UpdatedAt = now
        };

        // A lesson always starts with somewhere to write
        lesson._revisions.Add(LessonRevision.Draft(lesson.Id, 1, title, authoredByMembershipId));
        return lesson;
    }

    public void Rename(string title)
    {
        RequireNotArchived();
        ArgumentException.ThrowIfNullOrWhiteSpace(title);
        Title = title.Trim();
        Touch();
    }

    /// <summary>The revision currently open for editing, if any.</summary>
    public LessonRevision? DraftRevision =>
        _revisions.FirstOrDefault(r => r.Status == LessonRevisionStatus.Draft);

    public LessonRevision? CurrentRevision =>
        _revisions.FirstOrDefault(r => r.Id == CurrentRevisionId);

    /// <summary>
    /// Opens a new draft on top of the published content, so the current
    /// revision keeps serving learners while the next is written. Refuses a
    /// second concurrent draft — two people editing different drafts of the
    /// same lesson is a merge problem nobody asked for.
    /// </summary>
    public LessonRevision StartRevision(Guid authoredByMembershipId)
    {
        RequireNotArchived();

        if (DraftRevision is not null)
            throw new InvalidOperationException("This lesson already has a draft revision open.");

        var next = LessonRevision.Draft(Id, _revisions.Count + 1, Title, authoredByMembershipId);
        _revisions.Add(next);
        Touch();
        return next;
    }

    /// <summary>
    /// Publishes the open draft and retires whatever it replaces. This is the
    /// only way a Lesson becomes Published (§8).
    /// </summary>
    public void PublishDraft()
    {
        RequireNotArchived();

        var draft = DraftRevision
            ?? throw new InvalidOperationException("There is no draft revision to publish.");

        if (string.IsNullOrWhiteSpace(draft.Body))
            throw new InvalidOperationException("A lesson revision needs content before it can be published.");

        CurrentRevision?.Supersede();
        draft.Publish();

        CurrentRevisionId = draft.Id;
        Status = LessonStatus.Published;
        Touch();
    }

    /// <summary>
    /// Withdraws the lesson from learners without discarding its content. The
    /// current revision stays published so republishing does not require
    /// rewriting it.
    /// </summary>
    public void Unpublish()
    {
        if (Status != LessonStatus.Published)
            throw new InvalidOperationException("Only a published lesson can be unpublished.");

        Status = LessonStatus.Draft;
        Touch();
    }

    public void Archive()
    {
        if (Status == LessonStatus.Archived)
            throw new InvalidOperationException("This lesson is already archived.");

        Status = LessonStatus.Archived;
        Touch();
    }

    private void RequireNotArchived()
    {
        if (Status == LessonStatus.Archived)
            throw new InvalidOperationException("An archived lesson cannot be edited.");
    }

    private void Touch() => UpdatedAt = DateTime.UtcNow;
}
