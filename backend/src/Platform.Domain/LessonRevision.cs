namespace Platform.Domain;

/// <summary>
/// Lesson Revision Aggregate Root.
///
/// The instructional content itself, and its evolution over time (Lesson
/// Revision Aggregate Design §19). Deliberately separate from Lesson: Lesson
/// owns business identity and publication, this owns what is actually taught.
///
/// The separation is what lets a tutor rewrite a lesson while learners keep
/// seeing the current version — the new revision sits in Draft until it is
/// published and supersedes the old one.
/// </summary>
public class LessonRevision
{
    public Guid Id { get; private set; }
    public Guid LessonId { get; private set; }

    /// <summary>1-based, increasing. Stable once assigned; supersession never renumbers.</summary>
    public int Version { get; private set; }

    public string Title { get; private set; } = string.Empty;

    /// <summary>The teaching material. Plain text or markdown; media comes with Learning Asset.</summary>
    public string? Body { get; private set; }

    /// <summary>Roughly how long this takes a learner, in minutes. The tutor's estimate.</summary>
    public int? EstimatedMinutes { get; private set; }

    /// <summary>Recorded (self-paced video) or a live session the tutor runs. Descriptive only — see <see cref="LessonDeliveryMode"/>.</summary>
    public LessonDeliveryMode DeliveryMode { get; private set; } = LessonDeliveryMode.Recorded;

    /// <summary>
    /// The video this revision teaches with, if any — a reference by identifier
    /// only (Learning Asset Aggregate Design INV-003). This revision never owns
    /// the file; the Learning Asset it points at does.
    /// </summary>
    public Guid? VideoAssetId { get; private set; }

    public LessonRevisionStatus Status { get; private set; }
    public Guid AuthoredByMembershipId { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }
    public DateTime? PublishedAt { get; private set; }

    private LessonRevision() { }

    internal static LessonRevision Draft(
        Guid lessonId, int version, string title, Guid authoredByMembershipId)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(title);
        var now = DateTime.UtcNow;

        return new LessonRevision
        {
            Id = Guid.NewGuid(),
            LessonId = lessonId,
            Version = version,
            Title = title.Trim(),
            Status = LessonRevisionStatus.Draft,
            AuthoredByMembershipId = authoredByMembershipId,
            CreatedAt = now,
            UpdatedAt = now
        };
    }

    /// <summary>
    /// Edits the content. Only a Draft may be edited — a published revision is
    /// what learners are currently reading, so changing it under them would
    /// make "revision" meaningless.
    /// </summary>
    public void Edit(string title, string? body, int? estimatedMinutes, LessonDeliveryMode deliveryMode)
    {
        RequireDraft();
        ArgumentException.ThrowIfNullOrWhiteSpace(title);
        if (estimatedMinutes is < 0)
            throw new ArgumentException("Estimated minutes cannot be negative.", nameof(estimatedMinutes));

        Title = title.Trim();
        Body = string.IsNullOrWhiteSpace(body) ? null : body.Trim();
        EstimatedMinutes = estimatedMinutes;
        DeliveryMode = deliveryMode;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>Attaches a video by reference. Draft-only, same reasoning as <see cref="Edit"/>.</summary>
    public void AttachVideo(Guid learningAssetId)
    {
        RequireDraft();
        if (learningAssetId == Guid.Empty)
            throw new ArgumentException("A video reference cannot be empty.", nameof(learningAssetId));
        VideoAssetId = learningAssetId;
        UpdatedAt = DateTime.UtcNow;
    }

    public void RemoveVideo()
    {
        RequireDraft();
        VideoAssetId = null;
        UpdatedAt = DateTime.UtcNow;
    }

    private void RequireDraft()
    {
        if (Status != LessonRevisionStatus.Draft)
            throw new InvalidOperationException(
                "Only a draft revision can be edited. Create a new revision to change published content.");
    }

    internal void Publish()
    {
        if (Status != LessonRevisionStatus.Draft)
            throw new InvalidOperationException("Only a draft revision can be published.");

        Status = LessonRevisionStatus.Published;
        PublishedAt = DateTime.UtcNow;
        UpdatedAt = PublishedAt.Value;
    }

    /// <summary>Replaced by a newer published revision. Kept, never deleted.</summary>
    internal void Supersede()
    {
        if (Status != LessonRevisionStatus.Published) return;
        Status = LessonRevisionStatus.Superseded;
        UpdatedAt = DateTime.UtcNow;
    }
}
