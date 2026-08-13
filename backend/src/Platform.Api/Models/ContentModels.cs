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
    /// <summary>Whether a Learner must complete each lesson before the next one unlocks.</summary>
    bool RequiresSequentialCompletion,
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

/// <summary>
/// DeliveryMode is "Recorded" or "LiveSession" (LessonDeliveryMode). Video and
/// VideoUrl are mutually exclusive — at most one is populated at a time
/// (LessonRevision.AttachVideo/SetVideoUrl each clear the other).
///
/// QuestionCount/SubmissionCount describe this revision's own Assessment
/// (Assessment.cs — one Assessment per Lesson Revision) — so revision history
/// shows, at a glance, that an older revision's interactive questions and the
/// learner Submissions graded against them are still there, not lost when a
/// newer revision superseded it.
/// </summary>
public record LessonRevisionRow(
    Guid Id, int Version, string Title, string? Body,
    int? EstimatedMinutes, string DeliveryMode, string Status, DateTime UpdatedAt,
    Guid? VideoAssetId, LearningAssetResponse? Video, string? VideoUrl,
    int QuestionCount, int SubmissionCount,
    /// <summary>AI-generated transcript of this revision's video, once ready. Null while None/Processing/Failed.</summary>
    string? Transcript,
    /// <summary>"None" | "Processing" | "Ready" | "Failed" (TranscriptStatus).</summary>
    string TranscriptStatus,
    /// <summary>"None" | "Automatic" | "Manual" | "Imported" (TranscriptSource).</summary>
    string TranscriptSource,
    string? TranscriptError,
    /// <summary>Short learner-facing "what you'll learn" preview, AI-drafted and tutor-editable. Null until set.</summary>
    string? WhatYoullLearn,
    /// <summary>Bloom's-taxonomy-style "Learners will be able to..." statements, AI-drafted and tutor-editable. Null until set.</summary>
    string? LearningObjectives,
    /// <summary>Key terms and one-line definitions ("Term: Definition" per line), AI-drafted and tutor-editable. Null until set.</summary>
    string? Glossary,
    /// <summary>Suggested homework/practical exercises, one per line, AI-drafted and tutor-editable. Null until set.</summary>
    string? Homework,
    /// <summary>Supplementary files (slides, worksheets, handouts) attached to this revision — any number, unlike the single video slot.</summary>
    IReadOnlyList<LessonResourceRow> Resources);

/// <summary>One supplementary file attached to a Lesson Revision (LessonResource), with its Learning Asset's details inlined for display.</summary>
public record LessonResourceRow(Guid Id, LearningAssetResponse Asset);

public record SaveCurriculumRequest(string Title);
public record SaveUnitRequest(string Title);
public record CreateLessonRequest(string Title, Guid? UnitId);
/// <summary>Every unit id currently in the curriculum, once each, in the desired order.</summary>
public record ReorderUnitsRequest(IReadOnlyList<Guid> UnitIds);
/// <summary>Every lesson id currently in the unit, once each, in the desired order.</summary>
public record ReorderLessonsRequest(IReadOnlyList<Guid> LessonIds);
public record SetSequentialUnlockRequest(bool Enabled);
public record SaveRevisionRequest(string Title, string? Body, int? EstimatedMinutes, string? DeliveryMode, string? Transcript = null, string? WhatYoullLearn = null, string? LearningObjectives = null, string? Glossary = null, string? Homework = null);
public record AttachVideoRequest(Guid LearningAssetId);
public record AttachResourceRequest(Guid LearningAssetId);
public record SetVideoUrlRequest(string Url);

/// <summary>
/// Whatever the tutor currently has typed into the content form — not
/// reloaded from the saved revision, so this reflects unsaved edits and
/// works before a draft has ever been saved.
/// </summary>
public record AiSuggestBodyRequest(string Title, string? Body, int? EstimatedMinutes);
public record AiSuggestBodyResponse(string Body);

/// <summary>
/// Title/Body come from whatever the tutor currently has typed (unsaved or
/// not); the transcript, if any, is read server-side off the lesson's own
/// revision rather than trusted from the client — see "AI 'What You'll Learn'
/// - Implementation Plan" §3.
/// </summary>
public record AiSuggestWhatYoullLearnRequest(string Title, string? Body);
public record AiSuggestWhatYoullLearnResponse(string WhatYoullLearn);

/// <summary>Title/Body come from the tutor's current unsaved form state; the transcript, if any, is read server-side off the lesson's own revision, same as AiSuggestWhatYoullLearnRequest.</summary>
public record AiSuggestTitleRequest(string? Title, string? Body);
public record AiSuggestTitleResponse(string Title);

/// <summary>Title/Body come from the tutor's current unsaved form state; the transcript, if any, is read server-side off the lesson's own revision, same as AiSuggestWhatYoullLearnRequest.</summary>
public record AiSuggestLearningObjectivesRequest(string Title, string? Body);
public record AiSuggestLearningObjectivesResponse(string LearningObjectives);

/// <summary>Title/Body come from the tutor's current unsaved form state; the transcript, if any, is read server-side off the lesson's own revision, same as AiSuggestWhatYoullLearnRequest.</summary>
public record AiSuggestGlossaryRequest(string Title, string? Body);
public record AiSuggestGlossaryResponse(string Glossary);

/// <summary>Title/Body come from the tutor's current unsaved form state; the transcript, if any, is read server-side off the lesson's own revision, same as AiSuggestWhatYoullLearnRequest.</summary>
public record AiSuggestHomeworkRequest(string Title, string? Body);
public record AiSuggestHomeworkResponse(string Homework);
