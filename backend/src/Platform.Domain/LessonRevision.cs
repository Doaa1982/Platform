namespace Platform.Domain;

/// <summary>
/// Lesson Revision Aggregate Root.
///
/// The instructional content itself, and its evolution over time (Lesson
/// Revision Aggregate Design §19). Deliberately separate from Lesson: Lesson
/// owns business identity and publication, this owns what is actually taught.
///
/// The separation is what lets a tutor rewrite a lesson while learners keep
/// seeing the current version — the new revision sits in Draft until it is
/// published and supersedes the old one.
/// </summary>
public class LessonRevision
{
    private readonly List<LessonResource> _resources = [];
    private readonly List<LearningActivity> _learningActivities = [];

    public Guid Id { get; private set; }
    public Guid LessonId { get; private set; }

    /// <summary>1-based, increasing. Stable once assigned; supersession never renumbers.</summary>
    public int Version { get; private set; }

    public string Title { get; private set; } = string.Empty;

    /// <summary>The teaching material. Plain text or markdown; media comes with Learning Asset.</summary>
    public string? Body { get; private set; }

    /// <summary>Roughly how long this takes a learner, in minutes. The tutor's estimate.</summary>
    public int? EstimatedMinutes { get; private set; }

    /// <summary>Recorded (self-paced video) or a live session the tutor runs. Descriptive only — see <see cref="LessonDeliveryMode"/>.</summary>
    public LessonDeliveryMode DeliveryMode { get; private set; } = LessonDeliveryMode.Recorded;

    /// <summary>
    /// The video this revision teaches with, if any — a reference by identifier
    /// only (Learning Asset Aggregate Design INV-003). This revision never owns
    /// the file; the Learning Asset it points at does.
    /// </summary>
    public Guid? VideoAssetId { get; private set; }

    /// <summary>
    /// An externally-hosted video, given by direct link instead of uploaded
    /// through Learning Asset. Mutually exclusive with <see cref="VideoAssetId"/> —
    /// setting one clears the other, since a revision has exactly one video.
    /// </summary>
    public string? VideoUrl { get; private set; }

    public LessonRevisionStatus Status { get; private set; }
    public Guid AuthoredByMembershipId { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }
    public DateTime? PublishedAt { get; private set; }

    /// <summary>AI-generated transcript of this revision's video (AI Capability Architecture §8, "Generate Transcript"). Null until a transcription job has ever run.</summary>
    public string? Transcript { get; private set; }
    public TranscriptStatus TranscriptStatus { get; private set; } = TranscriptStatus.None;
    /// <summary>Why the last transcription attempt failed, if TranscriptStatus is Failed. Null otherwise.</summary>
    public string? TranscriptError { get; private set; }
    public TranscriptSource TranscriptSource { get; private set; } = TranscriptSource.None;

    /// <summary>
    /// Speechmatics Auto Chapters for this transcript, as JSON
    /// (<c>[{title, summary, startSeconds, endSeconds}, ...]</c>) — real,
    /// deterministic chapter boundaries used to place quiz-checkpoint
    /// timestamps without an LLM guessing one (AI Video-Grounded Questions
    /// Implementation Plan §4). Null until a transcription with chapters has
    /// completed; a video too short for chaptering completes with this still
    /// null even though TranscriptStatus is Ready. Cleared alongside Transcript.
    /// </summary>
    public string? TranscriptChaptersJson { get; private set; }

    /// <summary>
    /// Raw ASR segments for this transcript, as JSON
    /// (<c>[{start, end, text}, ...]</c>) — finer-grained than
    /// <see cref="TranscriptChaptersJson"/>, one entry per sentence/phrase the
    /// speech-to-text engine detected. Used to snap an AI-suggested interactive
    /// checkpoint's timestamp to a real moment in the video instead of trusting
    /// a number the model guessed (AI Video-Grounded Questions Implementation
    /// Plan). Null when the provider doesn't expose segment-level timing (e.g.
    /// Speechmatics, which relies on <see cref="TranscriptChaptersJson"/>
    /// instead) or for a manually-entered transcript. Cleared alongside Transcript.
    /// </summary>
    public string? TranscriptSegmentsJson { get; private set; }

    /// <summary>
    /// Short (~3 line) learner-facing preview of what this lesson teaches, shown
    /// before a learner starts it — AI-drafted, tutor-editable, optional. Distinct
    /// from <see cref="Body"/>, which only renders once a learner is already in
    /// the lesson.
    /// </summary>
    public string? WhatYoullLearn { get; private set; }

    /// <summary>
    /// Bloom's-taxonomy-style "Learners will be able to..." statements (AI
    /// Authoring Assistant Architecture Stage 5), AI-drafted and
    /// tutor-editable, optional. Distinct from <see cref="WhatYoullLearn"/> —
    /// this is the more formal instructional-design artifact; that one is
    /// the short marketing-style preview. Persisted and shown to learners,
    /// same visibility as WhatYoullLearn.
    /// </summary>
    public string? LearningObjectives { get; private set; }

    /// <summary>
    /// AI-extracted key terms and one-line definitions specific to this
    /// lesson (AI Capability Architecture §8, "Generate Glossary"/"Generate
    /// Keywords"), one "Term: Definition" per line, AI-drafted and
    /// tutor-editable, optional. Persisted and shown to learners, same
    /// visibility as WhatYoullLearn and LearningObjectives.
    /// </summary>
    public string? Glossary { get; private set; }

    /// <summary>
    /// AI-suggested homework and practical exercises tied to this lesson's
    /// content (AI Authoring Assistant Architecture Stage 8, "Supporting
    /// Resources"), one suggestion per line, AI-drafted and tutor-editable,
    /// optional. Persisted and shown to learners, same visibility as
    /// WhatYoullLearn, LearningObjectives, and Glossary.
    /// </summary>
    public string? Homework { get; private set; }

    /// <summary>
    /// Supplementary files (slides, worksheets, handouts) attached to this
    /// revision — any number, unlike the single mutually-exclusive video slot.
    /// Addable/removable regardless of Draft or Published status, same "safe
    /// metadata" treatment as WhatYoullLearn/Glossary/Homework — attaching a
    /// handout doesn't change what's being taught, so it doesn't need a new
    /// revision cycle the way the video or delivery mode does.
    /// </summary>
    public IReadOnlyCollection<LessonResource> Resources => _resources.AsReadOnly();

    /// <summary>
    /// The work this revision assigns to learners — Learning Activity
    /// Assignment Business Analysis BA-001/BA-003: owned and versioned
    /// together with this revision, no independent publication lifecycle.
    /// Unlike <see cref="Resources"/>, these are Draft-only to edit (BA §8:
    /// "Editing Learning Activities after publication requires creating a
    /// new Lesson Revision") — a Learning Activity is instructional design,
    /// not safe metadata.
    /// </summary>
    public IReadOnlyCollection<LearningActivity> LearningActivities => _learningActivities.AsReadOnly();

    /// <summary>
    /// When true, the lesson only completes once the learner also passes its
    /// Standalone Quiz — independently of, and in addition to, whatever else
    /// already gates completion (its video watched, its Interactive
    /// assessment passed). Applies to every lesson, not just Reading/video-less
    /// ones: LessonProgress.RecomputeCompletion treats this as a separate
    /// required condition, not a substitute assessment for the video-less
    /// case alone. Tutor-configurable per lesson, default false — every
    /// existing lesson keeps today's auto-complete behavior unless the tutor
    /// opts in. Not Draft-only: a completion policy isn't "what is taught,"
    /// so a tutor can flip it on an already-published lesson without
    /// starting a new revision.
    /// </summary>
    public bool RequireQuizToComplete { get; private set; }

    private LessonRevision() { }

    internal static LessonRevision Draft(
        Guid lessonId, int version, string title, Guid authoredByMembershipId)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(title);
        var now = DateTime.UtcNow;

        return new LessonRevision
        {
            Id = Guid.NewGuid(),
            LessonId = lessonId,
            Version = version,
            Title = title.Trim(),
            Status = LessonRevisionStatus.Draft,
            AuthoredByMembershipId = authoredByMembershipId,
            CreatedAt = now,
            UpdatedAt = now
        };
    }

    /// <summary>
    /// Edits the content. Only a Draft may be edited — a published revision is
    /// what learners are currently reading, so changing it under them would
    /// make "revision" meaningless.
    /// </summary>
    public void Edit(string title, string? body, int? estimatedMinutes, LessonDeliveryMode deliveryMode,
        string? whatYoullLearn = null, string? learningObjectives = null, string? glossary = null, string? homework = null)
    {
        RequireDraft();
        ArgumentException.ThrowIfNullOrWhiteSpace(title);
        if (estimatedMinutes is < 0)
            throw new ArgumentException("Estimated minutes cannot be negative.", nameof(estimatedMinutes));

        Title = title.Trim();
        Body = string.IsNullOrWhiteSpace(body) ? null : body.Trim();
        EstimatedMinutes = estimatedMinutes;
        DeliveryMode = deliveryMode;
        WhatYoullLearn = string.IsNullOrWhiteSpace(whatYoullLearn) ? null : whatYoullLearn.Trim();
        LearningObjectives = string.IsNullOrWhiteSpace(learningObjectives) ? null : learningObjectives.Trim();
        Glossary = string.IsNullOrWhiteSpace(glossary) ? null : glossary.Trim();
        Homework = string.IsNullOrWhiteSpace(homework) ? null : homework.Trim();
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>Attaches an uploaded video by reference. Draft-only, same reasoning as <see cref="Edit"/>. Clears any external URL — one video source at a time.</summary>
    public void AttachVideo(Guid learningAssetId)
    {
        RequireDraft();
        if (learningAssetId == Guid.Empty)
            throw new ArgumentException("A video reference cannot be empty.", nameof(learningAssetId));
        VideoAssetId = learningAssetId;
        VideoUrl = null;
        ClearTranscript();
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>Sets an externally-hosted video by direct link. Draft-only. Clears any uploaded asset — one video source at a time.</summary>
    public void SetVideoUrl(string url)
    {
        RequireDraft();
        ArgumentException.ThrowIfNullOrWhiteSpace(url);
        VideoUrl = url.Trim();
        VideoAssetId = null;
        ClearTranscript();
        UpdatedAt = DateTime.UtcNow;
    }

    public void RemoveVideo()
    {
        RequireDraft();
        VideoAssetId = null;
        VideoUrl = null;
        ClearTranscript();
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Attaches a supplementary file by reference (Learning Asset Aggregate
    /// Design INV-003). Not Draft-only — see <see cref="Resources"/>.
    /// <paramref name="visibleToLearners"/> defaults to true so every
    /// existing call site keeps today's behavior (attaching a file makes it
    /// a student-facing download) without having to change its call shape.
    /// </summary>
    public LessonResource AddResource(Guid learningAssetId, bool visibleToLearners = true)
    {
        if (learningAssetId == Guid.Empty)
            throw new ArgumentException("A resource must reference a learning asset.", nameof(learningAssetId));

        var resource = LessonResource.Create(Id, learningAssetId, _resources.Count, visibleToLearners);
        _resources.Add(resource);
        UpdatedAt = DateTime.UtcNow;
        return resource;
    }

    public void RemoveResource(Guid resourceId)
    {
        _resources.RemoveAll(r => r.Id == resourceId);
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Flips whether an already-attached resource is shown to learners as a
    /// download — e.g. hiding a file that was only ever meant as AI
    /// extraction source material, or later deciding to share it. Unlike
    /// <see cref="RemoveResource"/>'s idempotent no-op, an unknown
    /// <paramref name="resourceId"/> here throws: the tutor asked to change
    /// a specific resource, and silently doing nothing would hide a bug
    /// rather than surface it.
    /// </summary>
    public void SetResourceVisibility(Guid resourceId, bool visibleToLearners)
    {
        var resource = _resources.FirstOrDefault(r => r.Id == resourceId)
            ?? throw new InvalidOperationException("This lesson revision has no resource with that id.");
        resource.SetVisibility(visibleToLearners);
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>See <see cref="RequireQuizToComplete"/>.</summary>
    public void SetRequireQuizToComplete(bool requireQuizToComplete)
    {
        RequireQuizToComplete = requireQuizToComplete;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>Adds a Learning Activity to this revision's instructional design. Draft-only — see <see cref="LearningActivities"/>.</summary>
    public LearningActivity AddLearningActivity(
        LearningActivityType type, string title, string? instructions, Guid? assessmentId = null, string? externalUrl = null)
    {
        RequireDraft();
        var activity = LearningActivity.Create(Id, type, title, instructions, _learningActivities.Count, assessmentId, externalUrl);
        _learningActivities.Add(activity);
        UpdatedAt = DateTime.UtcNow;
        return activity;
    }

    public void UpdateLearningActivity(Guid activityId, LearningActivityType type, string title, string? instructions, Guid? assessmentId, string? externalUrl)
    {
        RequireDraft();
        FindLearningActivity(activityId).Edit(type, title, instructions, assessmentId, externalUrl);
        UpdatedAt = DateTime.UtcNow;
    }

    public void RemoveLearningActivity(Guid activityId)
    {
        RequireDraft();
        _learningActivities.RemoveAll(a => a.Id == activityId);
        var ordered = _learningActivities.OrderBy(a => a.Position).ToList();
        for (var i = 0; i < ordered.Count; i++) ordered[i].MoveTo(i);
        UpdatedAt = DateTime.UtcNow;
    }

    public void ReorderLearningActivities(IReadOnlyList<Guid> orderedActivityIds)
    {
        RequireDraft();
        if (orderedActivityIds.Count != _learningActivities.Count || orderedActivityIds.Distinct().Count() != _learningActivities.Count)
            throw new ArgumentException("The given order must list every existing activity on this revision exactly once.", nameof(orderedActivityIds));

        for (var i = 0; i < orderedActivityIds.Count; i++)
            FindLearningActivity(orderedActivityIds[i]).MoveTo(i);
        UpdatedAt = DateTime.UtcNow;
    }

    private LearningActivity FindLearningActivity(Guid activityId) =>
        _learningActivities.FirstOrDefault(a => a.Id == activityId)
        ?? throw new InvalidOperationException("This lesson revision has no learning activity with that id.");

    // ── Transcript (AI Capability Architecture §8, "Generate Transcript") ──────
    //
    // Deliberately not Draft-only like the video/content edits above: a tutor
    // should be able to transcribe a video that's already published and live,
    // not just while still drafting it.

    /// <summary>Starts a transcription attempt. Refuses to start a second one while one is already running.</summary>
    public void BeginTranscription()
    {
        if (VideoAssetId is null && VideoUrl is null)
            throw new InvalidOperationException("This revision has no video to transcribe.");
        if (TranscriptStatus == TranscriptStatus.Processing)
            throw new InvalidOperationException("A transcription is already running for this revision.");

        TranscriptStatus = TranscriptStatus.Processing;
        TranscriptError = null;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>Records a successful transcription. Only valid while one is running — a stray completion for a job that was never started or already resolved is ignored rather than trusted. <paramref name="chaptersJson"/> and <paramref name="segmentsJson"/> are null when the provider detected none (e.g. the video was too short, or this provider doesn't expose that granularity) — a normal outcome, not a failure.</summary>
    public void CompleteTranscription(string text, string? chaptersJson = null, string? segmentsJson = null)
    {
        if (TranscriptStatus != TranscriptStatus.Processing) return;
        Transcript = text;
        TranscriptChaptersJson = chaptersJson;
        TranscriptSegmentsJson = segmentsJson;
        TranscriptStatus = TranscriptStatus.Ready;
        TranscriptSource = TranscriptSource.Automatic;
        TranscriptError = null;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Allows the tutor to manually provide the lesson source/transcript, bypassing
    /// the async video transcription process. Marks the transcript as Ready so AI
    /// assistance tools can use it immediately.
    /// </summary>
    public void SetManualTranscript(string text)
    {
        RequireDraft();
        ArgumentException.ThrowIfNullOrWhiteSpace(text);
        
        Transcript = text.Trim();
        TranscriptChaptersJson = null; // No auto-chapters for manual text
        TranscriptSegmentsJson = null; // No auto-segments for manual text
        TranscriptStatus = TranscriptStatus.Ready;
        TranscriptSource = TranscriptSource.Manual;
        TranscriptError = null;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>Records a failed transcription attempt. Same "only while Processing" guard as <see cref="CompleteTranscription"/>.</summary>
    public void FailTranscription(string reason)
    {
        if (TranscriptStatus != TranscriptStatus.Processing) return;
        TranscriptStatus = TranscriptStatus.Failed;
        TranscriptError = reason;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>The video changed underneath an existing transcript, so it no longer describes the current video — back to None rather than leaving stale text in place.</summary>
    private void ClearTranscript()
    {
        Transcript = null;
        TranscriptChaptersJson = null;
        TranscriptSegmentsJson = null;
        TranscriptStatus = TranscriptStatus.None;
        TranscriptSource = TranscriptSource.None;
        TranscriptError = null;
    }

    private void RequireDraft()
    {
        if (Status != LessonRevisionStatus.Draft)
            throw new InvalidOperationException(
                "Only a draft revision can be edited. Create a new revision to change published content.");
    }

    /// <summary>
    /// Lesson Editing &amp; Publication UX, Scenario 3: Title, Body and
    /// EstimatedMinutes are classified as safe metadata — a tutor may correct
    /// them on the currently published revision directly, no new revision, no
    /// republish (Learning Publication &amp; Version Management §19, Rule 11).
    /// DeliveryMode and the video are deliberately excluded — either one
    /// changes what the lesson fundamentally is (Rule 12's "Major" class),
    /// so those still go through <see cref="Lesson.StartRevision"/>.
    /// </summary>
    public void QuickEditPublished(string title, string? body, int? estimatedMinutes,
        string? whatYoullLearn = null, string? learningObjectives = null, string? glossary = null, string? homework = null)
    {
        if (Status != LessonRevisionStatus.Published)
            throw new InvalidOperationException("Only the currently published revision can be edited this way.");
        ArgumentException.ThrowIfNullOrWhiteSpace(title);
        if (estimatedMinutes is < 0)
            throw new ArgumentException("Estimated minutes cannot be negative.", nameof(estimatedMinutes));

        Title = title.Trim();
        Body = string.IsNullOrWhiteSpace(body) ? null : body.Trim();
        EstimatedMinutes = estimatedMinutes;
        WhatYoullLearn = string.IsNullOrWhiteSpace(whatYoullLearn) ? null : whatYoullLearn.Trim();
        LearningObjectives = string.IsNullOrWhiteSpace(learningObjectives) ? null : learningObjectives.Trim();
        Glossary = string.IsNullOrWhiteSpace(glossary) ? null : glossary.Trim();
        Homework = string.IsNullOrWhiteSpace(homework) ? null : homework.Trim();
        UpdatedAt = DateTime.UtcNow;
    }

    internal void Publish()
    {
        if (Status != LessonRevisionStatus.Draft)
            throw new InvalidOperationException("Only a draft revision can be published.");

        Status = LessonRevisionStatus.Published;
        PublishedAt = DateTime.UtcNow;
        UpdatedAt = PublishedAt.Value;
    }

    /// <summary>Replaced by a newer published revision. Kept, never deleted.</summary>
    internal void Supersede()
    {
        if (Status != LessonRevisionStatus.Published) return;
        Status = LessonRevisionStatus.Superseded;
        UpdatedAt = DateTime.UtcNow;
    }
}
