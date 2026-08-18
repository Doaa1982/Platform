namespace Platform.Domain;

/// <summary>
/// One Learner's progress through one Lesson, scoped to their Enrollment
/// (Learning Progress Tracking Business Analysis PR-001: progress belongs to
/// exactly one active Enrollment, never directly to Curriculum, Lesson or
/// Identity). The full model leaves completion rules Curriculum-defined and
/// explicitly open (§9, §16) — this implements one concrete rule rather than
/// a general engine: a lesson completes once its video (if it has one) has
/// been watched to the end, its Published Interactive assessment (if it has
/// one, with questions) has a passing Submission, and — independently,
/// opt-in per lesson via RequireQuizToComplete — its Standalone quiz (if
/// that flag is on and a quiz exists) also has a passing Submission. A
/// lesson with none of those completes as soon as it is opened.
/// </summary>
public class LessonProgress
{
    public Guid Id { get; private set; }
    public Guid EnrollmentId { get; private set; }
    public Guid LessonId { get; private set; }

    /// <summary>
    /// Which Lesson Revision this progress reflects (PR-009). Set once, to
    /// whichever revision was current the moment this row was created, and
    /// never changed afterward — that single pin is what implements Learning
    /// Publication &amp; Version Management §20: a learner who is Started or
    /// In Progress stays served this revision through a later Major change
    /// (Rule 16) simply because nothing here moves it forward, while a
    /// learner with no row yet picks up whatever is current the moment they
    /// open the lesson (Rule 17), and a Completed row is never touched again
    /// regardless of subsequent publishes (Rule 18). <see cref="VideoWatched"/>
    /// and completion are therefore always evaluated against the video and
    /// Assessment this same revision carries, not the lesson's current one.
    /// </summary>
    public Guid LessonRevisionId { get; private set; }
    public LessonProgressStatus Status { get; private set; }
    public bool VideoWatched { get; private set; }
    public DateTime StartedAt { get; private set; }
    public DateTime? CompletedAt { get; private set; }

    private LessonProgress() { }

    public static LessonProgress Start(Guid enrollmentId, Guid lessonId, Guid lessonRevisionId)
    {
        if (enrollmentId == Guid.Empty)
            throw new ArgumentException("Progress belongs to exactly one Enrollment (PR-001).", nameof(enrollmentId));
        if (lessonId == Guid.Empty)
            throw new ArgumentException("Progress belongs to exactly one Lesson.", nameof(lessonId));
        if (lessonRevisionId == Guid.Empty)
            throw new ArgumentException("Progress is pinned to the Lesson Revision current when it started (PR-009).", nameof(lessonRevisionId));

        return new LessonProgress
        {
            Id = Guid.NewGuid(),
            EnrollmentId = enrollmentId,
            LessonId = lessonId,
            LessonRevisionId = lessonRevisionId,
            Status = LessonProgressStatus.NotStarted,
            StartedAt = DateTime.UtcNow
        };
    }

    public void MarkVideoWatched() => VideoWatched = true;

    /// <summary>
    /// Re-evaluates completion against the rules this app enforces. Safe to
    /// call any time something could have satisfied one of them (video
    /// watched, a Submission graded) — idempotent, and never un-completes a
    /// lesson. The Interactive assessment (hasGradableAssessment /
    /// hasPassingSubmission) and the Standalone quiz's RequireQuizToComplete
    /// gate (requiresQuiz / quizPassed) are independent conditions — a tutor
    /// may turn either on regardless of whether the lesson also has a video,
    /// so both must hold, not just whichever one a given caller happened to
    /// already have on hand.
    /// </summary>
    public void RecomputeCompletion(
        bool hasVideo, bool hasGradableAssessment, bool hasPassingSubmission,
        bool requiresQuiz = false, bool quizPassed = false)
    {
        if (Status == LessonProgressStatus.Completed) return;

        var videoSatisfied = !hasVideo || VideoWatched;
        var assessmentSatisfied = !hasGradableAssessment || hasPassingSubmission;
        var quizSatisfied = !requiresQuiz || quizPassed;

        if (videoSatisfied && assessmentSatisfied && quizSatisfied)
        {
            Status = LessonProgressStatus.Completed;
            CompletedAt = DateTime.UtcNow;
        }
    }
}
