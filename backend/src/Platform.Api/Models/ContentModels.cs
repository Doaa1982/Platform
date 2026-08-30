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
/// DeliveryMode is "Recorded", "LiveSession", or "Reading" (LessonDeliveryMode). Video and
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
    IReadOnlyList<LessonResourceRow> Resources,
    /// <summary>When true, a video-less lesson only completes once the learner passes its Standalone Quiz, instead of on open. Default false.</summary>
    bool RequireQuizToComplete,
    /// <summary>The work this revision assigns to learners (LearningActivity) — see LearningActivityRow.</summary>
    IReadOnlyList<LearningActivityRow> LearningActivities);

/// <summary>One supplementary file attached to a Lesson Revision (LessonResource), with its Learning Asset's details inlined for display.</summary>
public record LessonResourceRow(
    Guid Id, LearningAssetResponse Asset,
    /// <summary>Whether learners see this as a download, as opposed to being attached purely as AI-extraction source material.</summary>
    bool VisibleToLearners);

/// <summary>
/// One Learning Activity on a Lesson Revision (LearningActivityType — 14
/// values, e.g. "Quiz", "Homework", "Reading", "ExternalLearningTool").
/// AssessmentId is meaningful only for Type Quiz/QuestionSet; ExternalUrl
/// only for Type ExternalLearningTool. HasAssignment/AssignmentStatus let
/// the studio show, at a glance, whether this activity has already been
/// turned into a scheduled Assignment (INV-002: at most one).
/// </summary>
public record LearningActivityRow(
    Guid Id, string Type, string Title, string? Instructions, int Position,
    Guid? AssessmentId, string? ExternalUrl,
    bool HasAssignment, Guid? AssignmentId, string? AssignmentStatus);

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
/// <summary>VisibleToLearners defaults to true — every existing caller keeps today's "attaching means downloadable" behavior unless it explicitly opts out.</summary>
public record AttachResourceRequest(Guid LearningAssetId, bool VisibleToLearners = true);
public record SetResourceVisibilityRequest(bool VisibleToLearners);
public record SetRequireQuizToCompleteRequest(bool RequireQuizToComplete);
public record SetVideoUrlRequest(string Url);

/// <summary>Type is one of LearningActivityType's 14 names. AssessmentId only applies for Quiz/QuestionSet; ExternalUrl only for ExternalLearningTool — both ignored otherwise.</summary>
public record SaveLearningActivityRequest(string Type, string Title, string? Instructions, Guid? AssessmentId = null, string? ExternalUrl = null);
/// <summary>Every learning activity id currently on the revision, once each, in the desired order.</summary>
public record ReorderLearningActivitiesRequest(IReadOnlyList<Guid> ActivityIds);

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

/// <summary>
/// The merge of the five ai-suggest-* response shapes above, read straight
/// out of an uploaded PDF/image resource instead of from the tutor's typed
/// title/body/transcript. Every field is nullable — a source document may
/// not clearly support all of them, and a field it doesn't support is left
/// null rather than fabricated (same non-invention rule every ai-suggest-*
/// skill's prompt already states). Homework is deliberately not part of
/// this contract: the most assessment-authoring-flavored of the six
/// existing fields, and the one field this v1 leaves out (see the design
/// proposal's EXT-001). All-null is a valid, non-error result — it means
/// the model found nothing extractable (a blank scan, an unreadable page),
/// not that the request failed.
/// </summary>
public record ExtractResourceContentResponse(
    string? Title, string? Body, string? WhatYoullLearn, string? LearningObjectives, string? Glossary);

/// <summary>
/// The manual-entry fallback for <see cref="ExtractResourceContentResponse"/>:
/// a tutor pastes text themselves (e.g. copied out of a PDF reader, or from a
/// provider that can't read the file directly) instead of uploading the file
/// for AI to read. Structured through the same five-field prompt as
/// resource extraction, just text-in instead of attachment-in.
/// </summary>
public record StructurePastedContentRequest(string Text);
