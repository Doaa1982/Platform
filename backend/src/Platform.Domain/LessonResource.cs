namespace Platform.Domain;

/// <summary>
/// A supplementary file a tutor attaches to a Lesson Revision — slides, a
/// worksheet, a handout — shown to learners as a download alongside the
/// lesson. Distinct from the video slot: a revision may carry any number of
/// these, not just one. References its Learning Asset by identifier only,
/// same reasoning as LessonRevision.VideoAssetId (Learning Asset Aggregate
/// Design INV-003) — this revision never owns the file's bytes.
/// </summary>
public class LessonResource
{
    public Guid Id { get; private set; }
    public Guid LessonRevisionId { get; private set; }
    public Guid LearningAssetId { get; private set; }

    /// <summary>Display order among this revision's resources — attachment order.</summary>
    public int Position { get; private set; }
    public DateTime CreatedAt { get; private set; }

    private LessonResource() { }

    internal static LessonResource Create(Guid lessonRevisionId, Guid learningAssetId, int position)
    {
        if (learningAssetId == Guid.Empty)
            throw new ArgumentException("A lesson resource must reference a learning asset.", nameof(learningAssetId));

        return new LessonResource
        {
            Id = Guid.NewGuid(),
            LessonRevisionId = lessonRevisionId,
            LearningAssetId = learningAssetId,
            Position = position,
            CreatedAt = DateTime.UtcNow
        };
    }
}
