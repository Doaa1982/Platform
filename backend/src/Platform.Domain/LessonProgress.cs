namespace Platform.Domain;

/// <summary>
/// One Learner's progress through one Lesson, scoped to their Enrollment
/// (Learning Progress Tracking Business Analysis PR-001: progress belongs to
/// exactly one active Enrollment, never directly to Curriculum, Lesson or
/// Identity). The full model leaves completion rules Curriculum-defined and
/// explicitly open (§9, §16) — this implements one concrete rule rather than
/// a general engine: a lesson completes once its video (if it has one) has
/// been watched to the end and its Published assessment (if it has one, with
/// questions) has a passing Submission. A lesson with neither completes as
/// soon as it is opened.
/// </summary>
public class LessonProgress
{
    public Guid Id { get; private set; }
    public Guid EnrollmentId { get; private set; }
    public Guid LessonId { get; private set; }
    public LessonProgressStatus Status { get; private set; }
    public bool VideoWatched { get; private set; }
    public DateTime StartedAt { get; private set; }
    public DateTime? CompletedAt { get; private set; }

    private LessonProgress() { }

    public static LessonProgress Start(Guid enrollmentId, Guid lessonId)
    {
        if (enrollmentId == Guid.Empty)
            throw new ArgumentException("Progress belongs to exactly one Enrollment (PR-001).", nameof(enrollmentId));
        if (lessonId == Guid.Empty)
            throw new ArgumentException("Progress belongs to exactly one Lesson.", nameof(lessonId));

        return new LessonProgress
        {
            Id = Guid.NewGuid(),
            EnrollmentId = enrollmentId,
            LessonId = lessonId,
            Status = LessonProgressStatus.NotStarted,
            StartedAt = DateTime.UtcNow
        };
    }

    public void MarkVideoWatched() => VideoWatched = true;

    /// <summary>
    /// Re-evaluates completion against the one rule this app enforces. Safe
    /// to call any time something could have satisfied it (video watched, a
    /// Submission graded) — idempotent, and never un-completes a lesson.
    /// </summary>
    public void RecomputeCompletion(bool hasVideo, bool hasGradableAssessment, bool hasPassingSubmission)
    {
        if (Status == LessonProgressStatus.Completed) return;

        var videoSatisfied = !hasVideo || VideoWatched;
        var assessmentSatisfied = !hasGradableAssessment || hasPassingSubmission;

        if (videoSatisfied && assessmentSatisfied)
        {
            Status = LessonProgressStatus.Completed;
            CompletedAt = DateTime.UtcNow;
        }
    }
}
