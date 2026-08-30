namespace Platform.Domain;

/// <summary>
/// What kind of work a Learning Activity represents (Learning Activity
/// Assignment Business Analysis §7's "Supported Learning Activity Types").
/// Deliberately a flat classification, not a set of distinct schemas — see
/// <see cref="LearningActivity"/>'s own remarks for why. QuestionSet and Quiz
/// are the two types with real structured content today (they optionally
/// carry an <see cref="LearningActivity.AssessmentId"/>, reusing the existing
/// Assessment aggregate rather than reinventing question authoring);
/// ExternalLearningTool is the one type with a link instead of instructions
/// content. Every other type is delivered purely through free-text
/// Instructions plus whatever a learner submits back (Assessment and
/// Submission Aggregate Design v1.1's Response value object).
/// </summary>
public enum LearningActivityType
{
    QuestionSet, Quiz, Homework, Reading, VideoActivity, InteractiveLesson,
    Essay, FileUpload, Project, Discussion, CodingExercise, ReflectionJournal,
    AiPracticeSession, ExternalLearningTool
}

/// <summary>
/// A piece of educational work designed as part of a Lesson Revision
/// (Learning Activity Assignment Business Analysis §4) — "what learners
/// should do," authored once as instructional design. Owned by
/// <see cref="LessonRevision"/>, the same ownership shape as
/// <see cref="LessonResource"/>: cannot exist independently (BA-001),
/// versioned together with its revision, no independent publication
/// lifecycle of its own (BA-003) — its published/draft state is entirely
/// inherited from <see cref="LessonRevisionId"/>'s owning revision.
///
/// Kept deliberately thin: the Business Analysis document's own framing
/// (§2) calls for "a unified model capable of representing every assigned
/// learning experience... extensible for future activity types" — one
/// shape, not fourteen separate schemas. Most of the fourteen types in
/// <see cref="LearningActivityType"/> are told apart only by
/// <see cref="Type"/> and free-text <see cref="Instructions"/>; what a
/// learner submits back for any of them is the generic Response captured on
/// Submission (Assessment and Submission Aggregate Design v1.1), not a
/// type-specific structure here. The two exceptions are
/// <see cref="AssessmentId"/> (Quiz/QuestionSet, reusing the existing
/// Assessment aggregate for real question-and-answer-key content) and
/// <see cref="ExternalUrl"/> (ExternalLearningTool).
///
/// How this is delivered to learners — scheduling, targeting, attempts,
/// evaluation policy — is <see cref="Assignment"/>'s job entirely, not
/// this entity's (Assignment Aggregate Design §3).
/// </summary>
public class LearningActivity
{
    public Guid Id { get; private set; }
    public Guid LessonRevisionId { get; private set; }
    public LearningActivityType Type { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public string? Instructions { get; private set; }
    public int Position { get; private set; }

    /// <summary>Meaningful only when <see cref="Type"/> is QuestionSet or Quiz — the Standalone Assessment this activity delivers. Not required at creation: a tutor may author the activity shell first, then link/create the Assessment separately through the existing quiz-authoring flow.</summary>
    public Guid? AssessmentId { get; private set; }

    /// <summary>Meaningful only when <see cref="Type"/> is ExternalLearningTool.</summary>
    public string? ExternalUrl { get; private set; }

    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }

    private LearningActivity() { }

    internal static LearningActivity Create(
        Guid lessonRevisionId, LearningActivityType type, string title, string? instructions,
        int position, Guid? assessmentId, string? externalUrl)
    {
        var activity = new LearningActivity { Id = Guid.NewGuid(), LessonRevisionId = lessonRevisionId, Position = position, CreatedAt = DateTime.UtcNow };
        activity.Apply(type, title, instructions, assessmentId, externalUrl);
        return activity;
    }

    internal void Edit(LearningActivityType type, string title, string? instructions, Guid? assessmentId, string? externalUrl)
        => Apply(type, title, instructions, assessmentId, externalUrl);

    private void Apply(LearningActivityType type, string title, string? instructions, Guid? assessmentId, string? externalUrl)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(title);
        if (type == LearningActivityType.ExternalLearningTool && string.IsNullOrWhiteSpace(externalUrl))
            throw new ArgumentException("An External Learning Tool activity needs a link.", nameof(externalUrl));

        Type = type;
        Title = title.Trim();
        Instructions = string.IsNullOrWhiteSpace(instructions) ? null : instructions.Trim();
        AssessmentId = type is LearningActivityType.QuestionSet or LearningActivityType.Quiz ? assessmentId : null;
        ExternalUrl = type == LearningActivityType.ExternalLearningTool ? externalUrl!.Trim() : null;
        UpdatedAt = DateTime.UtcNow;
    }

    internal void MoveTo(int position)
    {
        Position = position;
        UpdatedAt = DateTime.UtcNow;
    }
}
