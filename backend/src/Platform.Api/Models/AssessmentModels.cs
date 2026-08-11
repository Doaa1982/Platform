namespace Platform.Api.Models;

/// <summary>
/// One lesson's Assessment, as the studio edits it — either the in-video
/// Interactive checkpoints or the separate Standalone lesson quiz (see
/// AssessmentKind). Kind is always populated, even when Id is null (nothing
/// created yet) — the editor screen already knows which one it's showing,
/// but this lets the response confirm it.
/// </summary>
public record AssessmentResponse(
    Guid? Id,
    Guid LessonId,
    string? Title,
    string Status,
    string Kind,
    int PassingThresholdPercent,
    /// <summary>Why publication is refused right now, or null when it is allowed.</summary>
    string? PublicationBlocker,
    IReadOnlyList<QuestionRow> Questions);

/// <summary>
/// Type is one of "MultipleChoice" | "TrueFalse" | "CompleteTheSentence" |
/// "OpenAnswer" (Learning Delivery Context §4.1). Which of Options/
/// CorrectOptionIndex/AcceptedAnswers is populated depends on it.
/// </summary>
public record QuestionRow(
    Guid Id, string Type, string Prompt,
    IReadOnlyList<string> Options, int? CorrectOptionIndex, IReadOnlyList<string> AcceptedAnswers,
    string? Explanation, int? VideoTimestampSeconds, int Points, int Position);

public record SaveAssessmentRequest(string Title, int? PassingThresholdPercent);

public record SaveQuestionRequest(
    string Type, string Prompt,
    IReadOnlyList<string>? Options, int? CorrectOptionIndex, IReadOnlyList<string>? AcceptedAnswers,
    string? Explanation, int? VideoTimestampSeconds, int Points);

/// <summary>What the client already knows about the video before asking the AI to place checkpoints in it.</summary>
public record AiSuggestQuestionsRequest(int VideoDurationSeconds);

/// <summary>
/// Draft checkpoints for the tutor to Accept, Edit or Remove (AI Interactive
/// Video Lesson Generator §7 — "Teacher Review Experience"). Not persisted:
/// nothing exists until the tutor accepts a suggestion via AddQuestion.
/// </summary>
public record SuggestedQuestion(
    string Type, string Prompt,
    IReadOnlyList<string> Options, int? CorrectOptionIndex, IReadOnlyList<string> AcceptedAnswers,
    string? Explanation, int VideoTimestampSeconds, int Points);

/// <summary>How many draft questions to propose for the lesson's Standalone quiz (see AssessmentKind) — clamped server-side (1–10).</summary>
public record AiSuggestStandaloneQuestionsRequest(int QuestionCount);

/// <summary>
/// Draft questions for the Standalone quiz, for the tutor to Accept, Edit or
/// Remove — same review pattern as SuggestedQuestion, minus the video
/// timestamp: this quiz isn't placed on a timeline, so there's nothing to
/// place. Grounded in the lesson's text (title, body, transcript, tutor's
/// notes), not a video's timing.
/// </summary>
public record SuggestedStandaloneQuestion(
    string Type, string Prompt,
    IReadOnlyList<string> Options, int? CorrectOptionIndex, IReadOnlyList<string> AcceptedAnswers,
    string? Explanation, int Points);

/// <summary>SelectedOptionIndex for MultipleChoice/TrueFalse; TextAnswer for CompleteTheSentence/OpenAnswer.</summary>
public record PreviewAnswer(Guid QuestionId, int? SelectedOptionIndex, string? TextAnswer);
public record PreviewSubmitRequest(IReadOnlyList<PreviewAnswer> Answers);

/// <summary>
/// The result of simulated AI Evaluation (Assessment and Submission
/// Aggregate Design §10) against the answer key a tutor authored — a preview
/// only, not a recorded Submission (Assessment INV-002: an unpublished
/// assessment cannot receive real submissions at all).
/// </summary>
public record PreviewResult(
    int ScorePercent, bool Passed, int PassingThresholdPercent,
    string AiFeedback, IReadOnlyList<PreviewQuestionResult> PerQuestion);

/// <summary>Correct is null for a Question that isn't auto-gradable (OpenAnswer) — reviewed, not scored.</summary>
public record PreviewQuestionResult(Guid QuestionId, bool? Correct, string? CorrectAnswerDisplay);

/// <summary>
/// The single source of truth for how a QuestionType is presented — frontend
/// layers fetch this instead of hard-coding the enum's member names or labels.
/// </summary>
public record QuestionTypeOption(string Value, string Label, string Description);

// ── Tutor overview (gradebook) ──────────────────────────────────────────────
//
// Cross-course, read-only aggregation over data every submission already
// writes (Submission/SubmissionAnswer) — no new domain concept, just the
// first screen that actually surfaces it. Deliberately scoped to each
// lesson's CURRENT revision's Assessment only: a superseded revision's old
// Assessment/Submissions still exist (Lesson Revision Aggregate Design's
// "kept, never deleted"), but showing them here would mix a lesson's live
// gradebook with history a tutor isn't managing anymore.

/// <summary>
/// One row per Assessment on a lesson's current revision — a lesson may
/// contribute up to two rows now (Interactive and Standalone, see
/// AssessmentKind), each with its own submissions/scores.
/// </summary>
public record AssessmentOverviewRow(
    Guid AssessmentId, string Title, string Status, string Kind,
    Guid LessonId, string LessonTitle, Guid ProductId, string ProductTitle,
    int QuestionCount, int SubmissionCount,
    /// <summary>Null when SubmissionCount is 0 — no average exists yet, distinct from an average of 0.</summary>
    int? AverageScorePercent,
    /// <summary>Null when SubmissionCount is 0, same reasoning as AverageScorePercent.</summary>
    int? PassRatePercent);

public record AssessmentOverviewResponse(IReadOnlyList<AssessmentOverviewRow> Assessments);

/// <summary>
/// Per-question aggregate over every Graded submission this Assessment has
/// received. CorrectCount is null for OpenAnswer (never auto-graded, same
/// rule as Assessment.Grade). OptionCounts is populated only for
/// MultipleChoice/TrueFalse — index-aligned with the question's Options, so
/// the frontend can show which distractor learners actually pick most.
/// </summary>
public record QuestionStatsRow(
    Guid QuestionId, string Prompt, string Type, int Points,
    int TotalAnswered, int? CorrectCount, IReadOnlyList<int>? OptionCounts);

public record AssessmentSubmissionRow(
    Guid MembershipId, string LearnerName, string LearnerEmail,
    int ScorePercent, bool Passed, DateTime SubmittedAt);

public record AssessmentDetailResponse(
    Guid AssessmentId, string Title, string Status, int PassingThresholdPercent,
    Guid LessonId, string LessonTitle, Guid ProductId, string ProductTitle,
    IReadOnlyList<QuestionStatsRow> Questions, IReadOnlyList<AssessmentSubmissionRow> Submissions);
