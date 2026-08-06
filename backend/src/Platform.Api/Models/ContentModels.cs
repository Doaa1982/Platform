namespace Platform.Api.Models;

/// <summary>The whole curriculum of one product, as the studio edits it.</summary>
public record CurriculumResponse(
    Guid? Id,
    Guid LearningProductId,
    string ProductTitle,
    string ProductStatus,
    string? Title,
    string Status,
    bool CanAuthor,
    /// <summary>Why publication is refused right now, or null when it is allowed.</summary>
    string? PublicationBlocker,
    IReadOnlyList<CurriculumUnitRow> Units,
    /// <summary>Lessons in this product not yet placed in any unit.</summary>
    IReadOnlyList<LessonRow> UnplacedLessons);

public record CurriculumUnitRow(Guid Id, string Title, int Position, IReadOnlyList<LessonRow> Lessons);

public record LessonRow(
    Guid Id,
    string Title,
    string Status,
    int RevisionCount,
    /// <summary>Whether a draft revision is currently open for editing.</summary>
    bool HasOpenDraft,
    int? EstimatedMinutes);

/// <summary>The lesson a tutor is currently writing, with its editable draft.</summary>
public record LessonDetailResponse(
    Guid Id,
    string Title,
    string Status,
    LessonRevisionRow? CurrentRevision,
    LessonRevisionRow? DraftRevision,
    IReadOnlyList<LessonRevisionRow> History);

/// <summary>DeliveryMode is "Recorded" or "LiveSession" (LessonDeliveryMode).</summary>
public record LessonRevisionRow(
    Guid Id, int Version, string Title, string? Body,
    int? EstimatedMinutes, string DeliveryMode, string Status, DateTime UpdatedAt,
    Guid? VideoAssetId, LearningAssetResponse? Video);

public record SaveCurriculumRequest(string Title);
public record SaveUnitRequest(string Title);
public record CreateLessonRequest(string Title, Guid? UnitId);
public record SaveRevisionRequest(string Title, string? Body, int? EstimatedMinutes, string? DeliveryMode);
public record AttachVideoRequest(Guid LearningAssetId);
