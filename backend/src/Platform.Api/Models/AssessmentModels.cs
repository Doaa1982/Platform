namespace Platform.Api.Models;

/// <summary>The interactive questions attached to one lesson's video, as the studio edits it.</summary>
public record AssessmentResponse(
    Guid? Id,
    Guid LessonId,
    string? Title,
    string Status,
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
