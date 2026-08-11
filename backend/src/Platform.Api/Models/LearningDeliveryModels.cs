namespace Platform.Api.Models;

/// <summary>A Published product a Learner can open. Reported honestly: HasContent is false for a Published product with no published curriculum content yet.</summary>
public record LearnerProductRow(Guid Id, string Title, string? Description, string? Category, bool HasContent);

public record LearnerProductListResponse(IReadOnlyList<LearnerProductRow> Products);

/// <summary>Aggregate counts across all of this Learner's enrollments — Certificates has no backing data yet, so it isn't included here; the frontend renders that card as a static "not built" placeholder.</summary>
public record LearnerStatsResponse(
    int EnrolledProductsCount, int CompletedLessonsCount, int TotalLessonsCount, int PassedAssessmentsCount,
    int CompletedProductsCount, int TimeInvestedMinutes, LearnerContinueLearningRow? ContinueLearning);

/// <summary>The lesson most recently begun and not yet finished — null if there is none (every enrolled lesson is either untouched or already Completed).</summary>
public record LearnerContinueLearningRow(Guid ProductId, string ProductTitle, Guid LessonId, string LessonTitle);

/// <summary>The published curriculum of one product, as a Learner sees it — never a draft, never an unpublished unit or lesson.</summary>
public record LearnerCurriculumResponse(
    Guid ProductId, string ProductTitle,
    Guid? CurriculumId, string? CurriculumTitle,
    /// <summary>Whether each lesson's Locked flag below is actually enforced right now.</summary>
    bool RequiresSequentialCompletion,
    IReadOnlyList<LearnerUnitRow> Units);

public record LearnerUnitRow(string Title, int Position, IReadOnlyList<LearnerLessonRow> Lessons);

/// <summary>
/// ProgressStatus is "NotStarted" or "Completed" (LessonProgressStatus).
/// Locked is true only when the curriculum has sequential unlock on and the
/// lesson immediately before this one (in curriculum order) isn't Completed
/// yet — opening it is refused server-side, this is purely so the UI can
/// show that before the Learner clicks.
/// </summary>
public record LearnerLessonRow(Guid Id, string Title, int? EstimatedMinutes, string ProgressStatus, bool Locked);

/// <summary>
/// One lesson as a Learner is delivered it — the Published revision only, and
/// its questions with the answer key stripped (Type/Prompt/Options/
/// VideoTimestampSeconds/Points only; no CorrectOptionIndex, no
/// AcceptedAnswers, no Explanation — those are withheld until graded).
/// </summary>
public record LearnerLessonResponse(
    Guid Id, string Title, string? Body, string DeliveryMode,
    LearningAssetResponse? Video, string? VideoUrl,
    IReadOnlyList<LearnerQuestionRow> Questions,
    string ProgressStatus, bool VideoWatched,
    /// <summary>Short AI-drafted preview of what this lesson teaches, shown before the learner starts it. Null if the tutor hasn't set one.</summary>
    string? WhatYoullLearn = null,
    /// <summary>Bloom's-taxonomy-style "Learners will be able to..." statements, AI-drafted and tutor-editable. Null if the tutor hasn't set any.</summary>
    string? LearningObjectives = null,
    /// <summary>Key terms and one-line definitions ("Term: Definition" per line), AI-drafted and tutor-editable. Null if the tutor hasn't set any.</summary>
    string? Glossary = null,
    /// <summary>Suggested homework/practical exercises, one per line, AI-drafted and tutor-editable. Null if the tutor hasn't set any.</summary>
    string? Homework = null,
    /// <summary>The lesson's Standalone quiz (see AssessmentKind), if a tutor has published one — null if there is none, same "absent means doesn't exist" convention as WhatYoullLearn etc.</summary>
    LearnerStandaloneAssessmentSummary? StandaloneAssessment = null,
    /// <summary>Supplementary files (slides, worksheets, handouts) the tutor attached to this lesson — empty if none.</summary>
    IReadOnlyList<LearningAssetResponse>? Resources = null);

public record LearnerQuestionRow(
    Guid Id, string Type, string Prompt,
    IReadOnlyList<string> Options, int? VideoTimestampSeconds, int Points);

/// <summary>
/// The lesson's Standalone Assessment (a separate, non-video-synced quiz —
/// see AssessmentKind), from this learner's own point of view. Answer keys
/// are stripped from Questions exactly like the Interactive ones. Attempted
/// reflects this learner's own most recent Graded submission on it only.
/// </summary>
public record LearnerStandaloneAssessmentSummary(
    Guid AssessmentId, string Title, int PassingThresholdPercent,
    IReadOnlyList<LearnerQuestionRow> Questions,
    bool Attempted, int? ScorePercent, bool? Passed);

public record SubmitAnswersRequest(IReadOnlyList<PreviewAnswer> Answers);

/// <summary>A learner's question to the in-lesson AI Assistant (<see cref="Platform.Api.AI.Skills.LessonAssistantSkill"/>).</summary>
public record AskLessonAssistantRequest(string Question);

/// <summary>The Assistant's answer — grounded in this lesson's material only, never general knowledge.</summary>
public record AskLessonAssistantResponse(string Answer);

/// <summary>
/// A learner's request for a Studio-style practice quiz on the current
/// lesson. QuestionCount is clamped server-side (1–15); Difficulty is
/// "Easy"/"Medium"/"Hard" (case-insensitive, defaults to Medium if
/// unrecognised); Topic is an optional free-text focus within the lesson.
/// </summary>
public record GenerateLessonQuizRequest(int QuestionCount, string? Difficulty, string? Topic);

/// <summary>One self-check question — MultipleChoice only, ungraded, never persisted.</summary>
public record PracticeQuizQuestion(string Prompt, IReadOnlyList<string> Options, int CorrectOptionIndex, string? Explanation);

public record GenerateLessonQuizResponse(IReadOnlyList<PracticeQuizQuestion> Questions);

// ── Learner's own assessments overview ──────────────────────────────────────
//
// Every real (Published) Assessment across every product this learner is
// enrolled in, one row per lesson per Assessment (a lesson may have both an
// Interactive and a Standalone one — see AssessmentKind — which then
// contribute two separate rows) — not just the one they happen to be
// viewing right now. Built the same way LearnerCurriculumResponse's Locked
// flag is: a preview of what LearningDeliveryService already enforces
// server-side when a learner actually opens the lesson, not a new rule.

/// <summary>
/// One lesson's Assessment, from this learner's own point of view.
/// AssessmentStatus is always "Published" — a Draft assessment is never
/// learner-visible, same as GetLessonAsync. Attempted reflects this
/// learner's own most recent Graded submission only; ScorePercent/Passed/
/// SubmittedAt are null until Attempted is true.
/// </summary>
public record LearnerAssessmentRow(
    Guid LessonId, string LessonTitle, Guid ProductId, string ProductTitle,
    Guid AssessmentId, string Kind, int PassingThresholdPercent,
    bool Attempted, int? ScorePercent, bool? Passed, DateTime? SubmittedAt,
    /// <summary>Same rule as LearnerCurriculumResponse's per-lesson Locked — sequential unlock, previous lesson not yet Completed.</summary>
    bool Locked);

public record LearnerAssessmentsResponse(IReadOnlyList<LearnerAssessmentRow> Assessments);
