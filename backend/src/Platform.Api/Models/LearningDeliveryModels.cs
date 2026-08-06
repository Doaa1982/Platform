namespace Platform.Api.Models;

/// <summary>A Published product a Learner can open. Reported honestly: HasContent is false for a Published product with no published curriculum content yet.</summary>
public record LearnerProductRow(Guid Id, string Title, string? Description, string? Category, bool HasContent);

public record LearnerProductListResponse(IReadOnlyList<LearnerProductRow> Products);

/// <summary>The published curriculum of one product, as a Learner sees it — never a draft, never an unpublished unit or lesson.</summary>
public record LearnerCurriculumResponse(
    Guid ProductId, string ProductTitle,
    Guid? CurriculumId, string? CurriculumTitle,
    IReadOnlyList<LearnerUnitRow> Units);

public record LearnerUnitRow(string Title, int Position, IReadOnlyList<LearnerLessonRow> Lessons);

/// <summary>ProgressStatus is "NotStarted" or "Completed" (LessonProgressStatus).</summary>
public record LearnerLessonRow(Guid Id, string Title, int? EstimatedMinutes, string ProgressStatus);

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
    string ProgressStatus, bool VideoWatched);

public record LearnerQuestionRow(
    Guid Id, string Type, string Prompt,
    IReadOnlyList<string> Options, int? VideoTimestampSeconds, int Points);

public record SubmitAnswersRequest(IReadOnlyList<PreviewAnswer> Answers);
