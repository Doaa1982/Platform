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
    string? WhatYoullLearn = null);

public record LearnerQuestionRow(
    Guid Id, string Type, string Prompt,
    IReadOnlyList<string> Options, int? VideoTimestampSeconds, int Points);

public record SubmitAnswersRequest(IReadOnlyList<PreviewAnswer> Answers);
