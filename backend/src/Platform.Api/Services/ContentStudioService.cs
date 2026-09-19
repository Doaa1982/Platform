using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Platform.Api.AI;
using Platform.Api.AI.Skills;
using Platform.Api.Models;
using Platform.Domain;
using Platform.Infrastructure;

namespace Platform.Api.Services;

/// <summary>
/// Content Studio — building the curriculum of one Learning Product.
///
/// The three aggregates involved keep their documented boundaries:
///   Curriculum      the shape — units and their ordered lessons
///   Lesson          a lesson's identity and publication (Lesson §19)
///   LessonRevision  what is actually taught, and how it evolves
///
/// A Curriculum is created lazily, the first time a tutor adds anything. A
/// product with no curriculum and a product with an empty one are different
/// things, and only the first should be the starting state.
/// </summary>
public class ContentStudioService(
    PlatformDbContext db, EntitlementResolutionService entitlements, ICreditLedgerService credits,
    TranscriptionQueue transcriptionQueue, ILearningAssetStorage assetStorage,
    TranscriptEnhancementQueue transcriptEnhancementQueue, TranscriptEnhancementOptions transcriptEnhancementOptions,
    GenerateLessonBodySkill generateLessonBody, GenerateWhatYoullLearnSkill generateWhatYoullLearn,
    GenerateLessonTitleSkill generateLessonTitle, GenerateLearningObjectivesSkill generateLearningObjectives,
    GenerateGlossarySkill generateGlossary, GenerateHomeworkSkill generateHomework,
    ExtractLessonContentFromResourceSkill extractLessonContent)
{
    /// <summary>Supported input formats for whichever IAudioTranscriptionProvider is active (AI Video Transcript Implementation Plan §4/§7; both Deepgram and Speechmatics accept all of these directly) — checked against the uploaded file's extension before a job is ever submitted.</summary>
    private static readonly string[] SupportedTranscriptionExtensions =
        [".wav", ".mp3", ".aac", ".ogg", ".mpeg", ".amr", ".m4a", ".mp4", ".flac"];

    /// <summary>
    /// Claude Messages API's own limits for a document/image content block
    /// (checked 2026-08-16) — this Platform's general upload cap (500MB) is
    /// far looser, so extraction needs its own pre-flight check rather than
    /// trusting the upload path already caught an oversized file.
    /// </summary>
    private const long MaxExtractionPdfBytes = 32 * 1024 * 1024;
    private const long MaxExtractionImageBytes = 10 * 1024 * 1024;

    private static readonly Dictionary<string, string> SupportedExtractionContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        ["application/pdf"] = "application/pdf",
        ["image/png"] = "image/png",
        ["image/jpeg"] = "image/jpeg",
        ["image/jpg"] = "image/jpeg",
        ["image/gif"] = "image/gif",
        ["image/webp"] = "image/webp"
    };

    /// <summary>
    /// Same pattern as the frontend's videoEmbed.js — a YouTube link has no
    /// direct media file to download, so it's rejected here rather than
    /// silently trying (and failing) to GET it as a video file.
    /// </summary>
    private static readonly Regex YouTubeUrlPattern = new(
        @"(?:youtube(?:-nocookie)?\.com/(?:watch\?(?:.*&)?v=|embed/|shorts/)|youtu\.be/)[A-Za-z0-9_-]{11}",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly WorkspaceRoleName[] AuthorRoles =
        [WorkspaceRoleName.Owner, WorkspaceRoleName.Administrator, WorkspaceRoleName.Teacher];

    // ── Reading ──────────────────────────────────────────────────────────────

    public async Task<ProvisioningResult<CurriculumResponse>> GetAsync(
        string slug, Guid caller, Guid productId, CancellationToken ct = default)
    {
        var ctx = await ResolveAsync(slug, caller, requireAuthor: false, ct);
        if (ctx.Error is not null) return Fail<CurriculumResponse>(ctx.Error.Value);

        var product = await db.LearningProducts.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == productId && p.WorkspaceId == ctx.Workspace!.Id, ct);
        if (product is null) return Fail<CurriculumResponse>((ProvisioningError.NotFound, "No such learning product."));

        var curriculum = await LoadCurriculumAsync(productId, ct);
        var lessons = await LoadLessonsAsync(productId, ct);

        var placed = curriculum?.AllLessonIds.ToHashSet() ?? [];

        return ProvisioningResult<CurriculumResponse>.Success(new CurriculumResponse(
            Id:                 curriculum?.Id,
            LearningProductId:  product.Id,
            ProductTitle:       product.Title,
            ProductStatus:      product.Status.ToString(),
            Title:              curriculum?.Title,
            Status:             curriculum?.Status.ToString() ?? "None",
            CanAuthor:          ctx.CanAuthor,
            // Two different nulls, deliberately not coalesced: a null from
            // PublicationBlocker() means "nothing is blocking", while a null
            // curriculum means "there is nothing to block yet". Treating them
            // alike told a tutor to add a unit to a curriculum they had already
            // published.
            PublicationBlocker: curriculum is null
                                ? "This product has no curriculum yet — add a unit to start one."
                                : curriculum.PublicationBlocker(),
            RequiresSequentialCompletion: curriculum?.RequiresSequentialCompletion ?? false,
            Units: curriculum is null ? [] : curriculum.Units.OrderBy(u => u.Position)
                .Select(u => new CurriculumUnitRow(u.Id, u.Title, u.Position,
                    u.Lessons.OrderBy(l => l.Position)
                     .Select(l => Describe(lessons.GetValueOrDefault(l.LessonId)))
                     .Where(l => l is not null).Select(l => l!).ToList()))
                .ToList(),
            UnplacedLessons: lessons.Values
                .Where(l => !placed.Contains(l.Id) && l.Status != LessonStatus.Archived)
                .Select(l => Describe(l)!).ToList()));
    }

    private static LessonRow? Describe(Lesson? l) => l is null ? null : new LessonRow(
        Id:               l.Id,
        Title:            l.Title,
        Status:           l.Status.ToString(),
        RevisionCount:    l.Revisions.Count,
        HasOpenDraft:     l.DraftRevision is not null,
        EstimatedMinutes: l.CurrentRevision?.EstimatedMinutes ?? l.DraftRevision?.EstimatedMinutes);

    public async Task<ProvisioningResult<LessonDetailResponse>> GetLessonAsync(
        string slug, Guid caller, Guid lessonId, CancellationToken ct = default)
    {
        var ctx = await ResolveAsync(slug, caller, requireAuthor: false, ct);
        if (ctx.Error is not null) return Fail<LessonDetailResponse>(ctx.Error.Value);

        var lesson = await db.Lessons.Include(l => l.Revisions).ThenInclude(r => r.Resources)
            .Include(l => l.Revisions).ThenInclude(r => r.LearningActivities).AsNoTracking()
            .FirstOrDefaultAsync(l => l.Id == lessonId && l.WorkspaceId == ctx.Workspace!.Id, ct);
        if (lesson is null) return Fail<LessonDetailResponse>((ProvisioningError.NotFound, "No such lesson."));

        var activityIds = lesson.Revisions.SelectMany(r => r.LearningActivities).Select(a => a.Id).ToList();
        var assignmentByActivity = activityIds.Count == 0
            ? new Dictionary<Guid, Assignment>()
            : await db.Assignments.AsNoTracking()
                .Where(a => activityIds.Contains(a.LearningActivityId)).ToDictionaryAsync(a => a.LearningActivityId, ct);

        var assetIds = lesson.Revisions.Where(r => r.VideoAssetId is not null)
            .Select(r => r.VideoAssetId!.Value)
            .Concat(lesson.Revisions.SelectMany(r => r.Resources).Select(res => res.LearningAssetId))
            .Distinct().ToList();
        var assets = assetIds.Count == 0
            ? new Dictionary<Guid, LearningAsset>()
            : await db.LearningAssets.AsNoTracking().Where(a => assetIds.Contains(a.Id)).ToDictionaryAsync(a => a.Id, ct);

        // A revision may carry up to two Assessments now (Assessment.cs
        // remarks: one Interactive, one Standalone) — loaded here purely to
        // show each past revision's question/submission counts in revision
        // history, proof that superseding a revision never drops its
        // questions or the Submissions graded against them. Revision history
        // only ever showed the Interactive one's counts (what the "Questions"
        // tab itself reflects), so that's preserved here rather than trying
        // to fit two assessments into LessonRevisionRow's single count pair.
        var revisionIds = lesson.Revisions.Select(r => r.Id).ToList();
        var assessmentsByRevision = await db.Assessments.Include(a => a.Questions).AsNoTracking()
            .Where(a => revisionIds.Contains(a.LessonRevisionId) && a.Kind == AssessmentKind.Interactive)
            .ToDictionaryAsync(a => a.LessonRevisionId, ct);

        // A Quiz/QuestionSet Learning Activity delivers this revision's own
        // Standalone Assessment — resolved live here rather than trusting
        // whatever LearningActivity.AssessmentId happens to hold, since
        // there is no UI for a tutor to hand-pick/relink it and the two are
        // authored on different tabs at different times (Assessment and
        // Submission Aggregate Design's Response/Assessment target split
        // has no manual-linking step for this codebase's 1:1 revision
        // shape — INV-002 already guarantees at most one).
        var standaloneAssessmentIdByRevision = await db.Assessments.AsNoTracking()
            .Where(a => revisionIds.Contains(a.LessonRevisionId) && a.Kind == AssessmentKind.Standalone)
            .ToDictionaryAsync(a => a.LessonRevisionId, a => a.Id, ct);

        var assessmentIds = assessmentsByRevision.Values.Select(a => a.Id).ToList();
        var submissionCounts = assessmentIds.Count == 0
            ? new Dictionary<Guid, int>()
            : await db.Submissions.AsNoTracking()
                .Where(s => s.AssessmentId != null && assessmentIds.Contains(s.AssessmentId.Value))
                .GroupBy(s => s.AssessmentId!.Value)
                .Select(g => new { g.Key, Count = g.Count() })
                .ToDictionaryAsync(g => g.Key, g => g.Count, ct);

        LessonRevisionRow? Rev(LessonRevision? r)
        {
            if (r is null) return null;
            assessmentsByRevision.TryGetValue(r.Id, out var a);
            var submissionCount = a is not null && submissionCounts.TryGetValue(a.Id, out var sc) ? sc : 0;
            return new LessonRevisionRow(
                r.Id, r.Version, r.Title, r.Body, r.EstimatedMinutes, r.DeliveryMode.ToString(), r.Status.ToString(), r.UpdatedAt,
                r.VideoAssetId,
                r.VideoAssetId is { } videoId && assets.TryGetValue(videoId, out var video) ? LearningAssetService.Describe(video) : null,
                r.VideoUrl, a?.Questions.Count ?? 0, submissionCount,
                r.Transcript, r.TranscriptStatus.ToString(), r.TranscriptSource.ToString(), r.TranscriptError, r.WhatYoullLearn, r.LearningObjectives, r.Glossary, r.Homework,
                r.Resources.OrderBy(res => res.Position).Where(res => assets.ContainsKey(res.LearningAssetId))
                    .Select(res => new LessonResourceRow(res.Id, LearningAssetService.Describe(assets[res.LearningAssetId]), res.VisibleToLearners)).ToList(),
                r.RequireQuizToComplete,
                r.LearningActivities.OrderBy(la => la.Position).Select(la =>
                {
                    assignmentByActivity.TryGetValue(la.Id, out var assignment);
                    var effectiveAssessmentId = la.Type is LearningActivityType.Quiz or LearningActivityType.QuestionSet
                        ? standaloneAssessmentIdByRevision.GetValueOrDefault(r.Id)
                        : (Guid?)null;
                    return new LearningActivityRow(
                        la.Id, la.Type.ToString(), la.Title, la.Instructions, la.Position, effectiveAssessmentId, la.ExternalUrl,
                        la.ActivityFileAssetId, la.SubmissionMode.ToString(),
                        assignment is not null, assignment?.Id, assignment?.Status.ToString());
                }).ToList(),
                r.EnhancedTranscript, r.EnhancementStatus.ToString(), r.EnhancementProvider, r.EnhancementModel,
                r.EnhancementPromptVersion, r.EnhancementRequestedAt, r.EnhancementCompletedAt, r.EnhancementError,
                r.EnhancementVersion, r.EnhancementReviewItemsJson);
        }

        return ProvisioningResult<LessonDetailResponse>.Success(new LessonDetailResponse(
            Id:              lesson.Id,
            Title:           lesson.Title,
            Status:          lesson.Status.ToString(),
            CurrentRevision: Rev(lesson.CurrentRevision),
            DraftRevision:   Rev(lesson.DraftRevision),
            History:         lesson.Revisions.OrderByDescending(r => r.Version).Select(r => Rev(r)!).ToList()));
    }

    // ── Curriculum structure ─────────────────────────────────────────────────

    public Task<ProvisioningResult<CurriculumResponse>> AddUnitAsync(
        string slug, Guid caller, Guid productId, SaveUnitRequest request, CancellationToken ct = default)
        => MutateAsync(slug, caller, productId, (c, _) => c.AddUnit(request.Title), ct, createIfMissing: true);

    public Task<ProvisioningResult<CurriculumResponse>> RenameUnitAsync(
        string slug, Guid caller, Guid productId, Guid unitId, SaveUnitRequest request, CancellationToken ct = default)
        => MutateAsync(slug, caller, productId, (c, _) => c.RenameUnit(unitId, request.Title), ct);

    public Task<ProvisioningResult<CurriculumResponse>> RemoveUnitAsync(
        string slug, Guid caller, Guid productId, Guid unitId, CancellationToken ct = default)
        => MutateAsync(slug, caller, productId, (c, _) => c.RemoveUnit(unitId), ct);

    public Task<ProvisioningResult<CurriculumResponse>> PlaceLessonAsync(
        string slug, Guid caller, Guid productId, Guid unitId, Guid lessonId, CancellationToken ct = default)
        => MutateAsync(slug, caller, productId, (c, _) => c.AddLessonToUnit(unitId, lessonId), ct);

    public Task<ProvisioningResult<CurriculumResponse>> UnplaceLessonAsync(
        string slug, Guid caller, Guid productId, Guid unitId, Guid lessonId, CancellationToken ct = default)
        => MutateAsync(slug, caller, productId, (c, _) => c.RemoveLessonFromUnit(unitId, lessonId), ct);

    public Task<ProvisioningResult<CurriculumResponse>> ReorderUnitsAsync(
        string slug, Guid caller, Guid productId, ReorderUnitsRequest request, CancellationToken ct = default)
        => MutateAsync(slug, caller, productId, (c, _) => c.ReorderUnits(request.UnitIds), ct);

    public Task<ProvisioningResult<CurriculumResponse>> ReorderLessonsAsync(
        string slug, Guid caller, Guid productId, Guid unitId, ReorderLessonsRequest request, CancellationToken ct = default)
        => MutateAsync(slug, caller, productId, (c, _) => c.ReorderLessonsInUnit(unitId, request.LessonIds), ct);

    public Task<ProvisioningResult<CurriculumResponse>> SetSequentialUnlockAsync(
        string slug, Guid caller, Guid productId, SetSequentialUnlockRequest request, CancellationToken ct = default)
        => MutateAsync(slug, caller, productId, (c, _) => c.SetSequentialUnlock(request.Enabled), ct, createIfMissing: true);

    public Task<ProvisioningResult<CurriculumResponse>> PublishCurriculumAsync(
        string slug, Guid caller, Guid productId, CancellationToken ct = default)
        => MutateAsync(slug, caller, productId, (c, _) => c.Publish(), ct);

    public Task<ProvisioningResult<CurriculumResponse>> UnpublishCurriculumAsync(
        string slug, Guid caller, Guid productId, CancellationToken ct = default)
        => MutateAsync(slug, caller, productId, (c, _) => c.Unpublish(), ct);

    /// <summary>
    /// Creates a lesson and, when a unit is named, places it there in one step —
    /// the overwhelmingly common case, and two round trips for it would invite
    /// half-done state if the second failed.
    /// </summary>
    public Task<ProvisioningResult<CurriculumResponse>> CreateLessonAsync(
        string slug, Guid caller, Guid productId, CreateLessonRequest request, CancellationToken ct = default)
        => MutateAsync(slug, caller, productId, (c, ctx) =>
        {
            var lesson = Lesson.Create(ctx.Workspace!.Id, productId, request.Title, ctx.MembershipId);
            db.Lessons.Add(lesson);
            if (request.UnitId is not null) c.AddLessonToUnit(request.UnitId.Value, lesson.Id);
        }, ct, createIfMissing: true);

    // ── Lesson content ───────────────────────────────────────────────────────

    public Task<ProvisioningResult<LessonDetailResponse>> SaveDraftAsync(
        string slug, Guid caller, Guid lessonId, SaveRevisionRequest request, CancellationToken ct = default)
        => MutateLessonAsync(slug, caller, lessonId, l =>
        {
            var draft = l.DraftRevision
                ?? throw new InvalidOperationException("This lesson has no open draft. Start a new revision first.");
            var deliveryMode = Enum.TryParse<LessonDeliveryMode>(request.DeliveryMode, out var parsed) ? parsed : LessonDeliveryMode.Recorded;
            draft.Edit(request.Title, request.Body, request.EstimatedMinutes, deliveryMode, request.WhatYoullLearn, request.LearningObjectives, request.Glossary, request.Homework);
            
            if (!string.IsNullOrWhiteSpace(request.Transcript) && request.Transcript != draft.Transcript)
            {
                draft.SetManualTranscript(request.Transcript);
            }
            
            l.Rename(request.Title);
        }, ct);

    /// <summary>
    /// Cross-aggregate (Lesson + Assessment), so — like <see cref="AttachVideoAsync"/> —
    /// it cannot go through MutateLessonAsync's single-aggregate mutate delegate.
    /// Carries the previous revision's Assessment forward as a starting point for
    /// the new draft (see the remark inline below) rather than leaving the tutor
    /// to re-author every question from a blank slate.
    /// </summary>
    public async Task<ProvisioningResult<LessonDetailResponse>> StartRevisionAsync(
        string slug, Guid caller, Guid lessonId, CancellationToken ct = default)
    {
        var ctx = await ResolveAsync(slug, caller, requireAuthor: true, ct);
        if (ctx.Error is not null) return Fail<LessonDetailResponse>(ctx.Error.Value);

        var lesson = await db.Lessons.Include(l => l.Revisions)
            .FirstOrDefaultAsync(l => l.Id == lessonId && l.WorkspaceId == ctx.Workspace!.Id, ct);
        if (lesson is null) return Fail<LessonDetailResponse>((ProvisioningError.NotFound, "No such lesson."));

        // Read before StartRevision runs — it doesn't touch CurrentRevisionId
        // (only PublishDraft does), but capturing the revision itself (not
        // just its id) here rather than relying on that keeps this correct
        // even if that changes, and gives us its field values to copy below.
        var previousRevision = lesson.CurrentRevision;

        LessonRevision draft;
        try { draft = lesson.StartRevision(ctx.MembershipId); }
        catch (InvalidOperationException ex) { return Fail<LessonDetailResponse>((ProvisioningError.Conflict, ex.Message)); }

        // Lesson Editing & Publication UX, Rule 13 (revised): a new revision
        // is pre-filled from the one it was started from — every field,
        // including the video/transcript and attached resources — so a tutor
        // starting a new revision to add an activity or fix a typo isn't
        // forced to re-author or re-attach content that didn't change.
        if (previousRevision is not null)
        {
            draft.Edit(previousRevision.Title, previousRevision.Body, previousRevision.EstimatedMinutes, previousRevision.DeliveryMode, previousRevision.WhatYoullLearn, previousRevision.LearningObjectives, previousRevision.Glossary, previousRevision.Homework);
            draft.CopyContentFrom(previousRevision);
        }

        // Interactive questions are versioned together with their revision
        // (Lesson Revision Aggregate Design §7's "Interactive Learning Event");
        // the previous revision's own Assessment — and every Submission graded
        // against it — is left exactly as it was, referenced only by the
        // now-superseded revision's id.
        if (previousRevision is not null)
        {
            await CloneAssessmentAsync(ctx.Workspace!.Id, lessonId, previousRevision.Id, draft.Id, ct);
            await CloneLearningActivitiesAsync(previousRevision.Id, draft, ct);
            await CloneResourcesAsync(previousRevision.Id, draft, ct);
        }

        await db.SaveChangesAsync(ct);
        return await GetLessonAsync(slug, caller, lessonId, ct);
    }

    /// <summary>
    /// The tutor's other option when replacing a video: a genuinely separate
    /// new Lesson (its own curriculum entry, own identity, own history from
    /// here on), rather than a new revision of the same one. Cloned from the
    /// source lesson's current revision — every field except the video,
    /// same as <see cref="StartRevisionAsync"/> — and its interactive
    /// questions. The source lesson is not touched at all: no new revision,
    /// no status change, nothing. Deliberately left unplaced in any
    /// Curriculum Unit — placing it would require the Curriculum itself to
    /// be editable (Curriculum.RequireEditable), which may not be true if
    /// it's Published, and the tutor can place it themselves either way
    /// (the same "Not yet in a unit" path any newly created lesson uses).
    /// </summary>
    public async Task<ProvisioningResult<LessonDetailResponse>> DuplicateLessonAsync(
        string slug, Guid caller, Guid lessonId, CancellationToken ct = default)
    {
        var ctx = await ResolveAsync(slug, caller, requireAuthor: true, ct);
        if (ctx.Error is not null) return Fail<LessonDetailResponse>(ctx.Error.Value);

        var source = await db.Lessons.Include(l => l.Revisions)
            .FirstOrDefaultAsync(l => l.Id == lessonId && l.WorkspaceId == ctx.Workspace!.Id, ct);
        if (source is null) return Fail<LessonDetailResponse>((ProvisioningError.NotFound, "No such lesson."));

        var sourceRevision = source.CurrentRevision ?? source.DraftRevision;
        if (sourceRevision is null)
            return Fail<LessonDetailResponse>((ProvisioningError.Conflict, "This lesson has no content yet to copy."));

        var clone = Lesson.Create(ctx.Workspace!.Id, source.LearningProductId, $"{sourceRevision.Title} (New Version)", ctx.MembershipId);
        db.Lessons.Add(clone);

        clone.DraftRevision!.Edit(clone.DraftRevision!.Title, sourceRevision.Body, sourceRevision.EstimatedMinutes, sourceRevision.DeliveryMode, sourceRevision.WhatYoullLearn, sourceRevision.LearningObjectives, sourceRevision.Glossary, sourceRevision.Homework);
        clone.DraftRevision!.CopyContentFrom(sourceRevision);

        await CloneAssessmentAsync(ctx.Workspace!.Id, clone.Id, sourceRevision.Id, clone.DraftRevision!.Id, ct);
        await CloneLearningActivitiesAsync(sourceRevision.Id, clone.DraftRevision!, ct);
        await CloneResourcesAsync(sourceRevision.Id, clone.DraftRevision!, ct);

        await db.SaveChangesAsync(ct);
        return await GetLessonAsync(slug, caller, clone.Id, ct);
    }

    /// <summary>
    /// Copies a revision's Assessments onto another revision — used by both
    /// StartRevisionAsync and DuplicateLessonAsync. A revision may carry up
    /// to two (Assessment.cs remarks: one Interactive, one Standalone), so
    /// every one it actually has is cloned, not just the first found —
    /// dropping the Standalone one silently on a new revision would be a
    /// real, easy-to-miss data-loss bug now that Kind exists.
    /// </summary>
    private async Task CloneAssessmentAsync(Guid workspaceId, Guid targetLessonId, Guid sourceRevisionId, Guid targetRevisionId, CancellationToken ct)
    {
        var sources = await db.Assessments.Include(a => a.Questions)
            .Where(a => a.LessonRevisionId == sourceRevisionId).ToListAsync(ct);

        foreach (var source in sources)
        {
            var clone = Assessment.Create(workspaceId, targetLessonId, targetRevisionId, source.Title, source.Kind);
            if (source.PassingThresholdPercent != 70) clone.SetPassingThreshold(source.PassingThresholdPercent);
            foreach (var q in source.Questions.OrderBy(q => q.Position))
                clone.AddQuestion(q.Type, q.Prompt, q.Options, q.CorrectOptionIndex, q.AcceptedAnswers, q.Explanation, q.VideoTimestampSeconds, q.Points);
            db.Assessments.Add(clone);
        }
    }

    /// <summary>
    /// Copies a revision's Learning Activities onto a newly-started draft —
    /// used by both StartRevisionAsync and DuplicateLessonAsync, same
    /// reasoning as <see cref="CloneAssessmentAsync"/>. Not the Assignment
    /// that may deliver each one, though — a new revision's activities start
    /// with no Assignment of their own (INV-002's 1:1 still holds against
    /// the *new* activity id, which is a fresh Guid); a tutor re-schedules
    /// delivery for the new revision explicitly.
    /// </summary>
    private async Task CloneLearningActivitiesAsync(Guid sourceRevisionId, LessonRevision targetRevision, CancellationToken ct)
    {
        var sources = await db.LearningActivities.AsNoTracking()
            .Where(a => a.LessonRevisionId == sourceRevisionId).OrderBy(a => a.Position).ToListAsync(ct);

        foreach (var source in sources)
            targetRevision.AddLearningActivity(
                source.Type, source.Title, source.Instructions, source.AssessmentId, source.ExternalUrl,
                source.ActivityFileAssetId, source.SubmissionMode);
    }

    /// <summary>
    /// Copies a revision's attached Resources (slides, worksheets, handouts)
    /// onto a newly-started draft — used by both StartRevisionAsync and
    /// DuplicateLessonAsync, same reasoning as <see cref="CloneLearningActivitiesAsync"/>.
    /// Resources aren't Draft-only to add (<see cref="AddResourceAsync"/>
    /// targets DraftRevision ?? CurrentRevision), but each one still lives on
    /// one specific revision row — without this, a brand-new draft would
    /// start with none of the previous revision's attachments.
    /// </summary>
    private async Task CloneResourcesAsync(Guid sourceRevisionId, LessonRevision targetRevision, CancellationToken ct)
    {
        var sources = await db.LessonResources.AsNoTracking()
            .Where(r => r.LessonRevisionId == sourceRevisionId).OrderBy(r => r.Position).ToListAsync(ct);

        foreach (var source in sources)
            targetRevision.AddResource(source.LearningAssetId, source.VisibleToLearners);
    }

    /// <summary>
    /// Lesson Editing &amp; Publication UX, Scenario 3 / Learning Publication &amp;
    /// Version Management §19 Rule 11: Title, Body and EstimatedMinutes are
    /// safe to change on the currently published revision directly — no new
    /// revision, no republish.
    /// </summary>
    public Task<ProvisioningResult<LessonDetailResponse>> QuickEditPublishedAsync(
        string slug, Guid caller, Guid lessonId, SaveRevisionRequest request, CancellationToken ct = default)
        => MutateLessonAsync(slug, caller, lessonId, l =>
        {
            var current = l.CurrentRevision
                ?? throw new InvalidOperationException("This lesson has no published revision to edit.");
            current.QuickEditPublished(request.Title, request.Body, request.EstimatedMinutes, request.WhatYoullLearn, request.LearningObjectives, request.Glossary, request.Homework);
            l.Rename(request.Title);
        }, ct);

    public Task<ProvisioningResult<LessonDetailResponse>> PublishLessonAsync(
        string slug, Guid caller, Guid lessonId, CancellationToken ct = default)
        => MutateLessonAsync(slug, caller, lessonId, l => l.PublishDraft(), ct);

    public Task<ProvisioningResult<LessonDetailResponse>> UnpublishLessonAsync(
        string slug, Guid caller, Guid lessonId, CancellationToken ct = default)
        => MutateLessonAsync(slug, caller, lessonId, l => l.Unpublish(), ct);

    public Task<ProvisioningResult<LessonDetailResponse>> RepublishLessonAsync(
        string slug, Guid caller, Guid lessonId, CancellationToken ct = default)
        => MutateLessonAsync(slug, caller, lessonId, l => l.Republish(), ct);

    public Task<ProvisioningResult<LessonDetailResponse>> ArchiveLessonAsync(
        string slug, Guid caller, Guid lessonId, CancellationToken ct = default)
        => MutateLessonAsync(slug, caller, lessonId, l => l.Archive(), ct);

    /// <summary>
    /// Attaches an uploaded video to the lesson's open draft (Learning Asset
    /// Aggregate Design INV-003: by identifier only). Cross-aggregate, so it
    /// cannot go through MutateLessonAsync's single-aggregate mutate delegate.
    /// </summary>
    public async Task<ProvisioningResult<LessonDetailResponse>> AttachVideoAsync(
        string slug, Guid caller, Guid lessonId, Guid learningAssetId, CancellationToken ct = default)
    {
        var ctx = await ResolveAsync(slug, caller, requireAuthor: true, ct);
        if (ctx.Error is not null) return Fail<LessonDetailResponse>(ctx.Error.Value);

        var lesson = await db.Lessons.Include(l => l.Revisions)
            .FirstOrDefaultAsync(l => l.Id == lessonId && l.WorkspaceId == ctx.Workspace!.Id, ct);
        if (lesson is null) return Fail<LessonDetailResponse>((ProvisioningError.NotFound, "No such lesson."));

        var asset = await db.LearningAssets
            .FirstOrDefaultAsync(a => a.Id == learningAssetId && a.WorkspaceId == ctx.Workspace!.Id, ct);
        if (asset is null) return Fail<LessonDetailResponse>((ProvisioningError.NotFound, "No such learning asset."));

        try
        {
            asset.RequireAttachable();
            var draft = lesson.DraftRevision
                ?? throw new InvalidOperationException("This lesson has no open draft. Start a new revision first.");
            draft.AttachVideo(asset.Id);
        }
        catch (InvalidOperationException ex) { return Fail<LessonDetailResponse>((ProvisioningError.Conflict, ex.Message)); }

        await db.SaveChangesAsync(ct);
        return await GetLessonAsync(slug, caller, lessonId, ct);
    }

    /// <summary>Sets an externally-hosted video by direct link — the "URL" alternative to uploading (LessonRevision.SetVideoUrl clears any uploaded asset).</summary>
    public Task<ProvisioningResult<LessonDetailResponse>> SetVideoUrlAsync(
        string slug, Guid caller, Guid lessonId, SetVideoUrlRequest request, CancellationToken ct = default)
        => MutateLessonAsync(slug, caller, lessonId, l =>
        {
            var draft = l.DraftRevision
                ?? throw new InvalidOperationException("This lesson has no open draft.");
            draft.SetVideoUrl(request.Url);
        }, ct);

    public Task<ProvisioningResult<LessonDetailResponse>> RemoveVideoAsync(
        string slug, Guid caller, Guid lessonId, CancellationToken ct = default)
        => MutateLessonAsync(slug, caller, lessonId, l =>
        {
            var draft = l.DraftRevision
                ?? throw new InvalidOperationException("This lesson has no open draft.");
            draft.RemoveVideo();
        }, ct);

    /// <summary>
    /// Attaches an uploaded supplementary file to whichever revision is
    /// currently open for editing — the draft if one exists, else the
    /// published revision, same "target revision" rule GenerateTranscriptAsync
    /// uses. Cross-aggregate (needs the Learning Asset), so — like
    /// <see cref="AttachVideoAsync"/> — it cannot go through MutateLessonAsync's
    /// single-aggregate mutate delegate.
    /// </summary>
    public async Task<ProvisioningResult<LessonDetailResponse>> AddResourceAsync(
        string slug, Guid caller, Guid lessonId, Guid learningAssetId, bool visibleToLearners, CancellationToken ct = default)
    {
        var ctx = await ResolveAsync(slug, caller, requireAuthor: true, ct);
        if (ctx.Error is not null) return Fail<LessonDetailResponse>(ctx.Error.Value);

        var lesson = await db.Lessons.Include(l => l.Revisions).ThenInclude(r => r.Resources)
            .FirstOrDefaultAsync(l => l.Id == lessonId && l.WorkspaceId == ctx.Workspace!.Id, ct);
        if (lesson is null) return Fail<LessonDetailResponse>((ProvisioningError.NotFound, "No such lesson."));

        var asset = await db.LearningAssets
            .FirstOrDefaultAsync(a => a.Id == learningAssetId && a.WorkspaceId == ctx.Workspace!.Id, ct);
        if (asset is null) return Fail<LessonDetailResponse>((ProvisioningError.NotFound, "No such learning asset."));

        try
        {
            asset.RequireAttachable();
            var revision = lesson.DraftRevision ?? lesson.CurrentRevision
                ?? throw new InvalidOperationException("This lesson has no revision to attach a resource to yet.");
            revision.AddResource(asset.Id, visibleToLearners);
        }
        catch (InvalidOperationException ex) { return Fail<LessonDetailResponse>((ProvisioningError.Conflict, ex.Message)); }

        await db.SaveChangesAsync(ct);
        return await GetLessonAsync(slug, caller, lessonId, ct);
    }

    /// <summary>Removes a resource from whichever revision it's attached to — cross-aggregate for the same reason as <see cref="AddResourceAsync"/>.</summary>
    public async Task<ProvisioningResult<LessonDetailResponse>> RemoveResourceAsync(
        string slug, Guid caller, Guid lessonId, Guid resourceId, CancellationToken ct = default)
    {
        var ctx = await ResolveAsync(slug, caller, requireAuthor: true, ct);
        if (ctx.Error is not null) return Fail<LessonDetailResponse>(ctx.Error.Value);

        var lesson = await db.Lessons.Include(l => l.Revisions).ThenInclude(r => r.Resources)
            .FirstOrDefaultAsync(l => l.Id == lessonId && l.WorkspaceId == ctx.Workspace!.Id, ct);
        if (lesson is null) return Fail<LessonDetailResponse>((ProvisioningError.NotFound, "No such lesson."));

        var revision = lesson.Revisions.FirstOrDefault(r => r.Resources.Any(res => res.Id == resourceId));
        if (revision is null) return Fail<LessonDetailResponse>((ProvisioningError.NotFound, "No such resource."));

        revision.RemoveResource(resourceId);

        await db.SaveChangesAsync(ct);
        return await GetLessonAsync(slug, caller, lessonId, ct);
    }

    // ── Learning Activities ──────────────────────────────────────────────────
    //
    // Draft-only to add/edit/remove/reorder (LessonRevision.RequireDraft, per
    // Learning Activity Assignment BA §8) — unlike Resources, a Learning
    // Activity is instructional design, not safe metadata. Written as
    // standalone methods rather than through MutateLessonAsync because that
    // helper's query doesn't load the LearningActivities navigation (only
    // Add needs no prior state; Update/Remove/Reorder do), same reasoning
    // AddResourceAsync/RemoveResourceAsync already follow for Resources.

    private static LearningActivityType ParseActivityType(string type) =>
        Enum.TryParse<LearningActivityType>(type, ignoreCase: true, out var parsed)
            ? parsed
            : throw new ArgumentException($"\"{type}\" is not a recognized learning activity type.", nameof(type));

    private static LearningActivitySubmissionMode ParseSubmissionMode(string mode) =>
        Enum.TryParse<LearningActivitySubmissionMode>(mode, ignoreCase: true, out var parsed)
            ? parsed
            : throw new ArgumentException($"\"{mode}\" is not a recognized submission mode.", nameof(mode));

    public async Task<ProvisioningResult<LessonDetailResponse>> AddLearningActivityAsync(
        string slug, Guid caller, Guid lessonId, SaveLearningActivityRequest request, CancellationToken ct = default)
    {
        var ctx = await ResolveAsync(slug, caller, requireAuthor: true, ct);
        if (ctx.Error is not null) return Fail<LessonDetailResponse>(ctx.Error.Value);

        var lesson = await db.Lessons.Include(l => l.Revisions).ThenInclude(r => r.LearningActivities)
            .FirstOrDefaultAsync(l => l.Id == lessonId && l.WorkspaceId == ctx.Workspace!.Id, ct);
        if (lesson is null) return Fail<LessonDetailResponse>((ProvisioningError.NotFound, "No such lesson."));

        try
        {
            var draft = lesson.DraftRevision
                ?? throw new InvalidOperationException("This lesson has no open draft. Start a new revision first.");
            draft.AddLearningActivity(
                ParseActivityType(request.Type), request.Title, request.Instructions, request.AssessmentId, request.ExternalUrl,
                request.ActivityFileAssetId, ParseSubmissionMode(request.SubmissionMode));
        }
        catch (InvalidOperationException ex) { return Fail<LessonDetailResponse>((ProvisioningError.Conflict, ex.Message)); }
        catch (ArgumentException ex) { return Fail<LessonDetailResponse>((ProvisioningError.Invalid, ex.Message)); }

        await db.SaveChangesAsync(ct);
        return await GetLessonAsync(slug, caller, lessonId, ct);
    }

    public async Task<ProvisioningResult<LessonDetailResponse>> UpdateLearningActivityAsync(
        string slug, Guid caller, Guid lessonId, Guid activityId, SaveLearningActivityRequest request, CancellationToken ct = default)
    {
        var ctx = await ResolveAsync(slug, caller, requireAuthor: true, ct);
        if (ctx.Error is not null) return Fail<LessonDetailResponse>(ctx.Error.Value);

        var lesson = await db.Lessons.Include(l => l.Revisions).ThenInclude(r => r.LearningActivities)
            .FirstOrDefaultAsync(l => l.Id == lessonId && l.WorkspaceId == ctx.Workspace!.Id, ct);
        if (lesson is null) return Fail<LessonDetailResponse>((ProvisioningError.NotFound, "No such lesson."));

        try
        {
            var draft = lesson.DraftRevision
                ?? throw new InvalidOperationException("This lesson has no open draft. Start a new revision first.");
            draft.UpdateLearningActivity(
                activityId, ParseActivityType(request.Type), request.Title, request.Instructions, request.AssessmentId, request.ExternalUrl,
                request.ActivityFileAssetId, ParseSubmissionMode(request.SubmissionMode));
        }
        catch (InvalidOperationException ex) { return Fail<LessonDetailResponse>((ProvisioningError.Conflict, ex.Message)); }
        catch (ArgumentException ex) { return Fail<LessonDetailResponse>((ProvisioningError.Invalid, ex.Message)); }

        await db.SaveChangesAsync(ct);
        return await GetLessonAsync(slug, caller, lessonId, ct);
    }

    public async Task<ProvisioningResult<LessonDetailResponse>> RemoveLearningActivityAsync(
        string slug, Guid caller, Guid lessonId, Guid activityId, CancellationToken ct = default)
    {
        var ctx = await ResolveAsync(slug, caller, requireAuthor: true, ct);
        if (ctx.Error is not null) return Fail<LessonDetailResponse>(ctx.Error.Value);

        var lesson = await db.Lessons.Include(l => l.Revisions).ThenInclude(r => r.LearningActivities)
            .FirstOrDefaultAsync(l => l.Id == lessonId && l.WorkspaceId == ctx.Workspace!.Id, ct);
        if (lesson is null) return Fail<LessonDetailResponse>((ProvisioningError.NotFound, "No such lesson."));

        try
        {
            var draft = lesson.DraftRevision
                ?? throw new InvalidOperationException("This lesson has no open draft. Start a new revision first.");
            draft.RemoveLearningActivity(activityId);
        }
        catch (InvalidOperationException ex) { return Fail<LessonDetailResponse>((ProvisioningError.Conflict, ex.Message)); }

        await db.SaveChangesAsync(ct);
        return await GetLessonAsync(slug, caller, lessonId, ct);
    }

    public async Task<ProvisioningResult<LessonDetailResponse>> ReorderLearningActivitiesAsync(
        string slug, Guid caller, Guid lessonId, ReorderLearningActivitiesRequest request, CancellationToken ct = default)
    {
        var ctx = await ResolveAsync(slug, caller, requireAuthor: true, ct);
        if (ctx.Error is not null) return Fail<LessonDetailResponse>(ctx.Error.Value);

        var lesson = await db.Lessons.Include(l => l.Revisions).ThenInclude(r => r.LearningActivities)
            .FirstOrDefaultAsync(l => l.Id == lessonId && l.WorkspaceId == ctx.Workspace!.Id, ct);
        if (lesson is null) return Fail<LessonDetailResponse>((ProvisioningError.NotFound, "No such lesson."));

        try
        {
            var draft = lesson.DraftRevision
                ?? throw new InvalidOperationException("This lesson has no open draft. Start a new revision first.");
            draft.ReorderLearningActivities(request.ActivityIds);
        }
        catch (InvalidOperationException ex) { return Fail<LessonDetailResponse>((ProvisioningError.Conflict, ex.Message)); }
        catch (ArgumentException ex) { return Fail<LessonDetailResponse>((ProvisioningError.Invalid, ex.Message)); }

        await db.SaveChangesAsync(ct);
        return await GetLessonAsync(slug, caller, lessonId, ct);
    }

    /// <summary>
    /// Reads an uploaded PDF/image resource with a multimodal model call and
    /// drafts the same five fields the ai-suggest-* endpoints draft
    /// individually — see <see cref="ExtractLessonContentFromResourceSkill"/>.
    /// Cross-aggregate for the same reason as <see cref="AddResourceAsync"/>
    /// (needs the Learning Asset's stored file), so this cannot go through
    /// MutateLessonAsync's single-aggregate delegate. Synchronous, not
    /// queued (PDF &amp; Image Lesson Content Extraction design proposal
    /// §4.5) — a single document is one model call, the same latency shape
    /// as every other ai-suggest-* request. Nothing is persisted — same
    /// contract as every ai-suggest-* endpoint; the tutor still hits Save
    /// themselves. An all-null response is a valid result (the document had
    /// nothing extractable), not an error.
    /// </summary>
    public async Task<ProvisioningResult<ExtractResourceContentResponse>> ExtractResourceContentAsync(
        string slug, Guid caller, Guid lessonId, Guid resourceId, CancellationToken ct = default)
    {
        var ctx = await ResolveAsync(slug, caller, requireAuthor: true, ct);
        if (ctx.Error is not null) return Fail<ExtractResourceContentResponse>(ctx.Error.Value);

        if (!await entitlements.HasEntitlementAsync(
                ctx.Workspace!.Id, EntitlementResolutionService.AiKey(CapabilityDomain.Learning),
                AiAssistanceLevel.Assist.ToString(), ct))
            return Fail<ExtractResourceContentResponse>((ProvisioningError.Forbidden,
                "AI content assistance needs the Professional plan or an AI-enabled Learning pack. Upgrade to use this."));

        var lesson = await db.Lessons.Include(l => l.Revisions).ThenInclude(r => r.Resources)
            .FirstOrDefaultAsync(l => l.Id == lessonId && l.WorkspaceId == ctx.Workspace!.Id, ct);
        if (lesson is null) return Fail<ExtractResourceContentResponse>((ProvisioningError.NotFound, "No such lesson."));

        var resource = lesson.Revisions.SelectMany(r => r.Resources).FirstOrDefault(res => res.Id == resourceId);
        if (resource is null) return Fail<ExtractResourceContentResponse>((ProvisioningError.NotFound, "No such resource."));

        var asset = await db.LearningAssets.AsNoTracking()
            .FirstOrDefaultAsync(a => a.Id == resource.LearningAssetId && a.WorkspaceId == ctx.Workspace!.Id, ct);
        if (asset is null) return Fail<ExtractResourceContentResponse>((ProvisioningError.NotFound, "No such learning asset."));

        if (!SupportedExtractionContentTypes.TryGetValue(asset.ContentType, out var mediaType))
            return Fail<ExtractResourceContentResponse>((ProvisioningError.Invalid,
                $"\"{asset.ContentType}\" can't be extracted — only PDF and image resources support this today. You can still attach it as a downloadable resource."));

        // Claude's own request-payload limits (checked 2026-08-16) — this
        // Platform's general upload cap (500MB) is far looser, so this needs
        // its own pre-flight check rather than trusting the upload path
        // already caught an oversized file. Failing here, before the model
        // is ever called, avoids burning a slow request only to be rejected
        // server-side by the provider.
        var maxBytes = mediaType == "application/pdf" ? MaxExtractionPdfBytes : MaxExtractionImageBytes;
        if (asset.FileSizeBytes > maxBytes)
            return Fail<ExtractResourceContentResponse>((ProvisioningError.Invalid,
                $"This file is larger than the {maxBytes / (1024 * 1024)} MB extraction can currently handle — you can still attach it as a downloadable resource."));

        try
        {
            await using var stored = await StorageTempFile.DownloadAsync(assetStorage, asset.ObjectKey, ct);
            var fileBytes = await File.ReadAllBytesAsync(stored.Path, ct);
            var extracted = await extractLessonContent.ExtractAsync(fileBytes, mediaType, ctx.Workspace!.Id, ct);
            return ProvisioningResult<ExtractResourceContentResponse>.Success(extracted);
        }
        catch (CreditsExhaustedException ex)
        {
            return ProvisioningResult<ExtractResourceContentResponse>.FailCreditsExhausted(ex.Message, ex.Cost, ex.RemainingBalance);
        }
        catch (InvalidOperationException ex)
        {
            return Fail<ExtractResourceContentResponse>((ProvisioningError.Conflict, $"AI content extraction failed: {ex.Message}"));
        }
        catch (NotSupportedException)
        {
            // IAiModelProvider.CompleteAsync's attachment overload throws
            // this by default (Provider Isolation) for any provider that
            // hasn't opted into multimodal support — today, every provider
            // except ClaudeModelProvider. Caught separately from
            // InvalidOperationException above since NotSupportedException
            // isn't one, and this is a configuration fact, not a per-request
            // failure — worth its own clear message rather than the generic
            // "AI content extraction failed" wording.
            return Fail<ExtractResourceContentResponse>((ProvisioningError.Conflict,
                "AI content extraction isn't available with the current AI provider — this workspace needs a provider that supports reading documents/images."));
        }
        catch (Exception ex) when (ex is IOException or StoredObjectNotFoundException)
        {
            return Fail<ExtractResourceContentResponse>((ProvisioningError.Conflict, $"Could not read the uploaded file: {ex.Message}"));
        }
    }

    /// <summary>Same character budget a ~15-page pasted document would plausibly run to — generous for manual paste while still bounding one model call's input.</summary>
    private const int MaxPastedContentChars = 50_000;

    /// <summary>
    /// The manual-entry fallback for <see cref="ExtractResourceContentAsync"/>:
    /// the tutor pastes text themselves (e.g. copied out of a PDF reader, or
    /// because the workspace's AI provider can't read files directly — see
    /// the NotSupportedException catch above) instead of uploading a file for
    /// AI to read. Text-only, so it goes through <see cref="IAiModelProvider"/>'s
    /// base <c>CompleteAsync</c> rather than the attachment overload — works
    /// with every provider, not just ones that opted into multimodal
    /// support. No resource/asset lookup needed since nothing is read off
    /// disk; still lesson-scoped so authorization and entitlement checks
    /// match every other draft/ai-suggest-* endpoint. Nothing is persisted —
    /// same contract as those endpoints, the tutor still hits Save.
    /// </summary>
    public async Task<ProvisioningResult<ExtractResourceContentResponse>> StructurePastedContentAsync(
        string slug, Guid caller, Guid lessonId, string pastedText, CancellationToken ct = default)
    {
        var ctx = await ResolveAsync(slug, caller, requireAuthor: true, ct);
        if (ctx.Error is not null) return Fail<ExtractResourceContentResponse>(ctx.Error.Value);

        if (string.IsNullOrWhiteSpace(pastedText))
            return Fail<ExtractResourceContentResponse>((ProvisioningError.Invalid, "Paste some text first."));

        if (pastedText.Length > MaxPastedContentChars)
            return Fail<ExtractResourceContentResponse>((ProvisioningError.Invalid,
                $"That's more than {MaxPastedContentChars:N0} characters — trim it down and try again."));

        if (!await entitlements.HasEntitlementAsync(
                ctx.Workspace!.Id, EntitlementResolutionService.AiKey(CapabilityDomain.Learning),
                AiAssistanceLevel.Assist.ToString(), ct))
            return Fail<ExtractResourceContentResponse>((ProvisioningError.Forbidden,
                "AI content assistance needs the Professional plan or an AI-enabled Learning pack. Upgrade to use this."));

        var lesson = await db.Lessons.AsNoTracking()
            .FirstOrDefaultAsync(l => l.Id == lessonId && l.WorkspaceId == ctx.Workspace!.Id, ct);
        if (lesson is null) return Fail<ExtractResourceContentResponse>((ProvisioningError.NotFound, "No such lesson."));

        try
        {
            var structured = await extractLessonContent.StructureFromTextAsync(pastedText, ctx.Workspace!.Id, ct);
            return ProvisioningResult<ExtractResourceContentResponse>.Success(structured);
        }
        catch (CreditsExhaustedException ex)
        {
            return ProvisioningResult<ExtractResourceContentResponse>.FailCreditsExhausted(ex.Message, ex.Cost, ex.RemainingBalance);
        }
        catch (InvalidOperationException ex)
        {
            return Fail<ExtractResourceContentResponse>((ProvisioningError.Conflict, $"AI content extraction failed: {ex.Message}"));
        }
    }

    /// <summary>Flips whether an already-attached resource is shown to learners as a download — see <see cref="LessonRevision.SetResourceVisibility"/>. Cross-aggregate for the same reason as <see cref="AddResourceAsync"/>.</summary>
    public async Task<ProvisioningResult<LessonDetailResponse>> SetResourceVisibilityAsync(
        string slug, Guid caller, Guid lessonId, Guid resourceId, bool visibleToLearners, CancellationToken ct = default)
    {
        var ctx = await ResolveAsync(slug, caller, requireAuthor: true, ct);
        if (ctx.Error is not null) return Fail<LessonDetailResponse>(ctx.Error.Value);

        var lesson = await db.Lessons.Include(l => l.Revisions).ThenInclude(r => r.Resources)
            .FirstOrDefaultAsync(l => l.Id == lessonId && l.WorkspaceId == ctx.Workspace!.Id, ct);
        if (lesson is null) return Fail<LessonDetailResponse>((ProvisioningError.NotFound, "No such lesson."));

        var revision = lesson.Revisions.FirstOrDefault(r => r.Resources.Any(res => res.Id == resourceId));
        if (revision is null) return Fail<LessonDetailResponse>((ProvisioningError.NotFound, "No such resource."));

        revision.SetResourceVisibility(resourceId, visibleToLearners);

        await db.SaveChangesAsync(ct);
        return await GetLessonAsync(slug, caller, lessonId, ct);
    }

    /// <summary>Sets whether the lesson also requires a passed Standalone Quiz to complete — see <see cref="LessonRevision.RequireQuizToComplete"/>. Applies to whichever revision is currently open for editing, same target-revision rule as <see cref="AddResourceAsync"/>.</summary>
    public async Task<ProvisioningResult<LessonDetailResponse>> SetRequireQuizToCompleteAsync(
        string slug, Guid caller, Guid lessonId, bool requireQuizToComplete, CancellationToken ct = default)
    {
        var ctx = await ResolveAsync(slug, caller, requireAuthor: true, ct);
        if (ctx.Error is not null) return Fail<LessonDetailResponse>(ctx.Error.Value);

        var lesson = await db.Lessons.Include(l => l.Revisions)
            .FirstOrDefaultAsync(l => l.Id == lessonId && l.WorkspaceId == ctx.Workspace!.Id, ct);
        if (lesson is null) return Fail<LessonDetailResponse>((ProvisioningError.NotFound, "No such lesson."));

        var revision = lesson.DraftRevision ?? lesson.CurrentRevision;
        if (revision is null) return Fail<LessonDetailResponse>((ProvisioningError.Conflict, "This lesson has no revision to set a completion policy on yet."));

        revision.SetRequireQuizToComplete(requireQuizToComplete);

        await db.SaveChangesAsync(ct);
        return await GetLessonAsync(slug, caller, lessonId, ct);
    }

    private static readonly string[] SupportedTranscriptionLanguages = ["auto", "en", "ar"];

    /// <summary>
    /// Kicks off AI transcription (AI Video Transcript Implementation Plan) for
    /// whichever revision is currently open for editing — the draft if one
    /// exists, else the published revision, same "target revision" rule
    /// AssessmentService uses for its own AI surfaces. Cross-aggregate (needs
    /// the Learning Asset's storage location), so this cannot go through
    /// MutateLessonAsync's single-aggregate mutate delegate. Returns as soon
    /// as the job is queued — the actual transcription runs on
    /// TranscriptionBackgroundService, not inside this request.
    /// <paramref name="language"/> null/"auto" defers to the provider's own Automatic Language
    /// Identification (SpeechmaticsOptions.Language); "en"/"ar" pins it. A tutor override exists
    /// because ALI has been observed to confidently mistranscribe a real, heavily code-switched
    /// lesson video entirely in the wrong language — the tutor who spoke it is the more reliable
    /// source of truth than a guess.
    /// </summary>
    public async Task<ProvisioningResult<LessonDetailResponse>> GenerateTranscriptAsync(
        string slug, Guid caller, Guid lessonId, string? language, CancellationToken ct = default)
    {
        var ctx = await ResolveAsync(slug, caller, requireAuthor: true, ct);
        if (ctx.Error is not null) return Fail<LessonDetailResponse>(ctx.Error.Value);

        if (language is not null && !SupportedTranscriptionLanguages.Contains(language, StringComparer.OrdinalIgnoreCase))
            return Fail<LessonDetailResponse>((ProvisioningError.Invalid,
                $"\"{language}\" isn't a supported transcription language. Use one of: {string.Join(", ", SupportedTranscriptionLanguages)}."));

        if (!await entitlements.HasEntitlementAsync(
                ctx.Workspace!.Id, EntitlementResolutionService.AiKey(CapabilityDomain.Learning),
                AiAssistanceLevel.Assist.ToString(), ct))
            return Fail<LessonDetailResponse>((ProvisioningError.Forbidden,
                "AI transcription needs the Professional plan or an AI-enabled Learning pack. Upgrade to use this."));

        var lesson = await db.Lessons.Include(l => l.Revisions)
            .FirstOrDefaultAsync(l => l.Id == lessonId && l.WorkspaceId == ctx.Workspace!.Id, ct);
        if (lesson is null) return Fail<LessonDetailResponse>((ProvisioningError.NotFound, "No such lesson."));

        var revision = lesson.DraftRevision ?? lesson.CurrentRevision;
        if (revision is null)
            return Fail<LessonDetailResponse>((ProvisioningError.Conflict, "This lesson has no revision to transcribe yet."));

        string fileNameForJob;
        string? objectKeyForJob = null;
        string? sourceUrlForJob = null;
        if (revision.VideoAssetId is not null)
        {
            var asset = await db.LearningAssets.AsNoTracking()
                .FirstOrDefaultAsync(a => a.Id == revision.VideoAssetId && a.WorkspaceId == ctx.Workspace!.Id, ct);
            if (asset is null) return Fail<LessonDetailResponse>((ProvisioningError.NotFound, "No such learning asset."));

            var extension = Path.GetExtension(asset.OriginalFileName);
            if (!SupportedTranscriptionExtensions.Contains(extension, StringComparer.OrdinalIgnoreCase))
                return Fail<LessonDetailResponse>((ProvisioningError.Invalid,
                    $"\"{extension}\" videos aren't supported for transcription yet. Supported formats: {string.Join(", ", SupportedTranscriptionExtensions)}."));

            fileNameForJob = asset.OriginalFileName;
            objectKeyForJob = asset.ObjectKey;
        }
        else if (revision.VideoUrl is not null)
        {
            if (YouTubeUrlPattern.IsMatch(revision.VideoUrl))
                return Fail<LessonDetailResponse>((ProvisioningError.Conflict,
                    "YouTube videos can't be transcribed yet — only an uploaded video or a direct video-file link is supported."));

            if (!Uri.TryCreate(revision.VideoUrl, UriKind.Absolute, out var uri))
                return Fail<LessonDetailResponse>((ProvisioningError.Invalid, "This video link isn't a valid URL."));

            var extension = Path.GetExtension(uri.AbsolutePath);
            if (!SupportedTranscriptionExtensions.Contains(extension, StringComparer.OrdinalIgnoreCase))
                return Fail<LessonDetailResponse>((ProvisioningError.Invalid,
                    $"This video link doesn't look like a supported video file. Supported formats: {string.Join(", ", SupportedTranscriptionExtensions)}."));

            fileNameForJob = Path.GetFileName(uri.AbsolutePath);
            sourceUrlForJob = revision.VideoUrl;
        }
        else
        {
            return Fail<LessonDetailResponse>((ProvisioningError.Conflict, "This revision has no video to transcribe yet."));
        }

        Guid jobId;
        try { jobId = revision.BeginTranscription(); }
        catch (InvalidOperationException ex) { return Fail<LessonDetailResponse>((ProvisioningError.Conflict, ex.Message)); }

        await db.SaveChangesAsync(ct);

        var languageOverride = language is null || language.Equals("auto", StringComparison.OrdinalIgnoreCase)
            ? null : language.ToLowerInvariant();
        var job = new TranscriptionJob(ctx.Workspace!.Id, lessonId, revision.Id, fileNameForJob, jobId,
            objectKeyForJob, sourceUrlForJob, languageOverride);

        transcriptionQueue.Enqueue(job);

        return await GetLessonAsync(slug, caller, lessonId, ct);
    }

    /// <summary>
    /// Starts a conservative, tutor-triggered AI enhancement pass over this
    /// revision's already-Ready raw transcript (AI Capability Architecture §8,
    /// "Enhance Transcript") — ASR-error correction only, never a rewrite.
    /// <see cref="LessonRevision.Transcript"/> itself is never touched; the
    /// result lands on the separate EnhancedTranscript field once the
    /// background job completes. Same "start job, enqueue, return
    /// immediately" shape as <see cref="GenerateTranscriptAsync"/> — the
    /// actual AI call and validation happen in
    /// <see cref="TranscriptEnhancementBackgroundService"/>, not this request.
    /// </summary>
    public async Task<ProvisioningResult<LessonDetailResponse>> EnhanceTranscriptAsync(
        string slug, Guid caller, Guid lessonId, CancellationToken ct = default)
    {
        var ctx = await ResolveAsync(slug, caller, requireAuthor: true, ct);
        if (ctx.Error is not null) return Fail<LessonDetailResponse>(ctx.Error.Value);

        if (!transcriptEnhancementOptions.Enabled)
            return Fail<LessonDetailResponse>((ProvisioningError.Forbidden, "Transcript enhancement is not enabled."));

        if (!await entitlements.HasEntitlementAsync(
                ctx.Workspace!.Id, EntitlementResolutionService.AiKey(CapabilityDomain.Learning),
                AiAssistanceLevel.Assist.ToString(), ct))
            return Fail<LessonDetailResponse>((ProvisioningError.Forbidden,
                "AI transcript enhancement needs the Professional plan or an AI-enabled Learning pack. Upgrade to use this."));

        var lesson = await db.Lessons.Include(l => l.Revisions)
            .FirstOrDefaultAsync(l => l.Id == lessonId && l.WorkspaceId == ctx.Workspace!.Id, ct);
        if (lesson is null) return Fail<LessonDetailResponse>((ProvisioningError.NotFound, "No such lesson."));

        var revision = lesson.DraftRevision ?? lesson.CurrentRevision;
        if (revision is null)
            return Fail<LessonDetailResponse>((ProvisioningError.Conflict, "This lesson has no revision to enhance yet."));

        if (revision.TranscriptStatus != TranscriptStatus.Ready || string.IsNullOrWhiteSpace(revision.Transcript))
            return Fail<LessonDetailResponse>((ProvisioningError.Conflict,
                "This lesson has no raw transcript yet — generate or write one first, then enhance it."));

        if (revision.Transcript!.Length > transcriptEnhancementOptions.MaxInputCharacters)
            return Fail<LessonDetailResponse>((ProvisioningError.Invalid,
                $"This transcript is too long to enhance ({revision.Transcript.Length} characters, limit " +
                $"{transcriptEnhancementOptions.MaxInputCharacters})."));

        // Every other AI feature in this app runs its model call inline in the
        // request and lets AiOrchestrator's CreditsExhaustedException surface
        // as a clean, structured 402 immediately. Enhancement instead queues
        // the model call onto a background job (see below) — without this
        // check, a workspace out of credits would get an immediate
        // "Processing" response and only discover it failed, with no
        // credits_exhausted structure for the frontend, once the background
        // job actually tried and failed. This is a best-effort pre-check, not
        // a reservation (see ICreditLedgerService.GetCurrentCostAsync) — the
        // real, atomic charge still happens inside the background job via
        // EnhanceTranscriptSkill's own AiOrchestrator.RunAsync call.
        var enhanceCost = await credits.GetCurrentCostAsync(AiSkillKeys.EnhanceTranscript, band: null, ct);
        if (enhanceCost is not null)
        {
            var balance = await credits.GetBalanceAsync(ctx.Workspace!.Id, ct);
            if (balance < enhanceCost)
                return ProvisioningResult<LessonDetailResponse>.FailCreditsExhausted(
                    $"Transcript enhancement needs {enhanceCost} AI credits; this workspace has {balance}.",
                    enhanceCost.Value, balance);
        }

        Guid jobId;
        try { jobId = revision.BeginEnhancement(); }
        catch (InvalidOperationException ex) { return Fail<LessonDetailResponse>((ProvisioningError.Conflict, ex.Message)); }

        await db.SaveChangesAsync(ct);

        var lessonContext = await BuildLessonEnhancementContextAsync(lesson, revision, ct);
        transcriptEnhancementQueue.Enqueue(new TranscriptEnhancementJob(
            ctx.Workspace!.Id, lessonId, revision.Id, jobId, revision.Transcript!, lessonContext));

        return await GetLessonAsync(slug, caller, lessonId, ct);
    }

    /// <summary>
    /// Assembles the "background only" lesson context EnhanceTranscriptSkill's
    /// prompt uses to resolve strongly-supported ASR corrections — subject/topic
    /// from the Learning Product and Lesson, plus whatever tutor-authored
    /// metadata already exists on this revision. No "Grade"/"Level" field exists
    /// anywhere in this domain today, so it's simply omitted rather than
    /// fabricated — every piece here is real data, never invented for this call.
    /// </summary>
    private async Task<string> BuildLessonEnhancementContextAsync(Lesson lesson, LessonRevision revision, CancellationToken ct)
    {
        var product = await db.LearningProducts.AsNoTracking()
            .Where(p => p.Id == lesson.LearningProductId)
            .Select(p => new { p.Title, p.Category })
            .FirstOrDefaultAsync(ct);

        return $"""
            Course/subject: {product?.Title ?? "(unknown)"}
            Category: {product?.Category ?? "(not specified)"}
            Lesson topic: {lesson.Title}
            What learners will learn: {revision.WhatYoullLearn ?? "(none)"}
            Learning objectives: {revision.LearningObjectives ?? "(none)"}
            Relevant terminology (glossary): {revision.Glossary ?? "(none)"}
            """;
    }

    /// <summary>
    /// Drafts or improves lesson body content (AI Capability Architecture §8),
    /// from whatever the tutor has currently typed — same "unsaved-form-state
    /// in, no DB round trip" shape as LearningProductService.SuggestDescriptionAsync.
    /// Doesn't touch the database at all; nothing is saved until the tutor
    /// hits Save Draft / Save changes themselves.
    /// </summary>
    public async Task<ProvisioningResult<AiSuggestBodyResponse>> SuggestBodyAsync(
        string slug, Guid caller, Guid lessonId, AiSuggestBodyRequest request, CancellationToken ct = default)
    {
        var ctx = await ResolveAsync(slug, caller, requireAuthor: true, ct);
        if (ctx.Error is not null) return Fail<AiSuggestBodyResponse>(ctx.Error.Value);

        if (!await entitlements.HasEntitlementAsync(
                ctx.Workspace!.Id, EntitlementResolutionService.AiKey(CapabilityDomain.Learning),
                AiAssistanceLevel.Assist.ToString(), ct))
            return Fail<AiSuggestBodyResponse>((ProvisioningError.Forbidden,
                "AI content assistance needs the Professional plan or an AI-enabled Learning pack. Upgrade to use this."));

        if (string.IsNullOrWhiteSpace(request.Title))
            return Fail<AiSuggestBodyResponse>((ProvisioningError.Invalid, "A title is needed before content can be drafted."));

        var lesson = await db.Lessons.Include(l => l.Revisions).AsNoTracking()
            .FirstOrDefaultAsync(l => l.Id == lessonId && l.WorkspaceId == ctx.Workspace!.Id, ct);
        if (lesson is null) return Fail<AiSuggestBodyResponse>((ProvisioningError.NotFound, "No such lesson."));

        var revision = lesson.DraftRevision ?? lesson.CurrentRevision;
        var transcript = revision?.TranscriptStatus == TranscriptStatus.Ready ? revision.Transcript : null;
        var outputLanguage = await GetLessonLanguageAsync(lesson.LearningProductId, ct);

        try
        {
            var body = await generateLessonBody.SuggestAsync(
                request.Title, request.Body, transcript, request.EstimatedMinutes, outputLanguage, ctx.Workspace!.Id, ct);
            return ProvisioningResult<AiSuggestBodyResponse>.Success(new AiSuggestBodyResponse(body));
        }
        catch (CreditsExhaustedException ex)
        {
            return ProvisioningResult<AiSuggestBodyResponse>.FailCreditsExhausted(ex.Message, ex.Cost, ex.RemainingBalance);
        }
        catch (InvalidOperationException ex)
        {
            return Fail<AiSuggestBodyResponse>((ProvisioningError.Conflict, $"AI content generation failed: {ex.Message}"));
        }
    }

    /// <summary>
    /// Drafts the ~3-line learner-facing "what you'll learn" preview (AI
    /// "What You'll Learn" - Implementation Plan §3). Title/Body come from
    /// the tutor's current unsaved form state, same as SuggestBodyAsync; the
    /// transcript, if the revision has one Ready, is read straight off the
    /// lesson so a client can't spoof or skip it. Doesn't touch the
    /// database — nothing is saved until the tutor hits Save themselves.
    /// </summary>
    public async Task<ProvisioningResult<AiSuggestWhatYoullLearnResponse>> SuggestWhatYoullLearnAsync(
        string slug, Guid caller, Guid lessonId, AiSuggestWhatYoullLearnRequest request, CancellationToken ct = default)
    {
        var ctx = await ResolveAsync(slug, caller, requireAuthor: true, ct);
        if (ctx.Error is not null) return Fail<AiSuggestWhatYoullLearnResponse>(ctx.Error.Value);

        if (!await entitlements.HasEntitlementAsync(
                ctx.Workspace!.Id, EntitlementResolutionService.AiKey(CapabilityDomain.Learning),
                AiAssistanceLevel.Assist.ToString(), ct))
            return Fail<AiSuggestWhatYoullLearnResponse>((ProvisioningError.Forbidden,
                "AI content assistance needs the Professional plan or an AI-enabled Learning pack. Upgrade to use this."));

        if (string.IsNullOrWhiteSpace(request.Title))
            return Fail<AiSuggestWhatYoullLearnResponse>((ProvisioningError.Invalid, "A title is needed before a preview can be drafted."));

        var lesson = await db.Lessons.Include(l => l.Revisions).AsNoTracking()
            .FirstOrDefaultAsync(l => l.Id == lessonId && l.WorkspaceId == ctx.Workspace!.Id, ct);
        if (lesson is null) return Fail<AiSuggestWhatYoullLearnResponse>((ProvisioningError.NotFound, "No such lesson."));

        var revision = lesson.DraftRevision ?? lesson.CurrentRevision;
        var transcript = revision?.TranscriptStatus == TranscriptStatus.Ready ? revision.Transcript : null;
        var outputLanguage = await GetLessonLanguageAsync(lesson.LearningProductId, ct);

        try
        {
            var result = await generateWhatYoullLearn.SuggestAsync(request.Title, request.Body, transcript, outputLanguage, ctx.Workspace!.Id, ct);
            return ProvisioningResult<AiSuggestWhatYoullLearnResponse>.Success(new AiSuggestWhatYoullLearnResponse(result));
        }
        catch (CreditsExhaustedException ex)
        {
            return ProvisioningResult<AiSuggestWhatYoullLearnResponse>.FailCreditsExhausted(ex.Message, ex.Cost, ex.RemainingBalance);
        }
        catch (InvalidOperationException ex)
        {
            return Fail<AiSuggestWhatYoullLearnResponse>((ProvisioningError.Conflict, $"AI content generation failed: {ex.Message}"));
        }
    }

    /// <summary>
    /// Proposes a sharper lesson title grounded in Body (or Transcript, read
    /// server-side, if no body exists yet) — not a "fill a blank" skill like
    /// the others, since a lesson always has some title by the time a tutor
    /// is in the editor. Doesn't touch the database — nothing is saved until
    /// the tutor hits Save themselves.
    /// </summary>
    public async Task<ProvisioningResult<AiSuggestTitleResponse>> SuggestTitleAsync(
        string slug, Guid caller, Guid lessonId, AiSuggestTitleRequest request, CancellationToken ct = default)
    {
        var ctx = await ResolveAsync(slug, caller, requireAuthor: true, ct);
        if (ctx.Error is not null) return Fail<AiSuggestTitleResponse>(ctx.Error.Value);

        if (!await entitlements.HasEntitlementAsync(
                ctx.Workspace!.Id, EntitlementResolutionService.AiKey(CapabilityDomain.Learning),
                AiAssistanceLevel.Assist.ToString(), ct))
            return Fail<AiSuggestTitleResponse>((ProvisioningError.Forbidden,
                "AI content assistance needs the Professional plan or an AI-enabled Learning pack. Upgrade to use this."));

        var lesson = await db.Lessons.Include(l => l.Revisions).AsNoTracking()
            .FirstOrDefaultAsync(l => l.Id == lessonId && l.WorkspaceId == ctx.Workspace!.Id, ct);
        if (lesson is null) return Fail<AiSuggestTitleResponse>((ProvisioningError.NotFound, "No such lesson."));

        var revision = lesson.DraftRevision ?? lesson.CurrentRevision;
        var transcript = revision?.TranscriptStatus == TranscriptStatus.Ready ? revision.Transcript : null;

        if (string.IsNullOrWhiteSpace(request.Body) && string.IsNullOrWhiteSpace(transcript))
            return Fail<AiSuggestTitleResponse>((ProvisioningError.Invalid,
                "Write some lesson content (or wait for the transcript to finish) before asking AI to suggest a title."));

        var outputLanguage = await GetLessonLanguageAsync(lesson.LearningProductId, ct);

        try
        {
            var result = await generateLessonTitle.SuggestAsync(request.Title, request.Body, transcript, outputLanguage, ctx.Workspace!.Id, ct);
            return ProvisioningResult<AiSuggestTitleResponse>.Success(new AiSuggestTitleResponse(result));
        }
        catch (CreditsExhaustedException ex)
        {
            return ProvisioningResult<AiSuggestTitleResponse>.FailCreditsExhausted(ex.Message, ex.Cost, ex.RemainingBalance);
        }
        catch (InvalidOperationException ex)
        {
            return Fail<AiSuggestTitleResponse>((ProvisioningError.Conflict, $"AI title generation failed: {ex.Message}"));
        }
    }

    /// <summary>
    /// Drafts Bloom's-taxonomy-style learning objectives (AI Authoring
    /// Assistant Architecture Stage 5). Same source pattern as
    /// SuggestWhatYoullLearnAsync — transcript read server-side, preferred
    /// over the form's current Body. Doesn't touch the database — nothing is
    /// saved until the tutor hits Save themselves.
    /// </summary>
    public async Task<ProvisioningResult<AiSuggestLearningObjectivesResponse>> SuggestLearningObjectivesAsync(
        string slug, Guid caller, Guid lessonId, AiSuggestLearningObjectivesRequest request, CancellationToken ct = default)
    {
        var ctx = await ResolveAsync(slug, caller, requireAuthor: true, ct);
        if (ctx.Error is not null) return Fail<AiSuggestLearningObjectivesResponse>(ctx.Error.Value);

        if (!await entitlements.HasEntitlementAsync(
                ctx.Workspace!.Id, EntitlementResolutionService.AiKey(CapabilityDomain.Learning),
                AiAssistanceLevel.Assist.ToString(), ct))
            return Fail<AiSuggestLearningObjectivesResponse>((ProvisioningError.Forbidden,
                "AI content assistance needs the Professional plan or an AI-enabled Learning pack. Upgrade to use this."));

        if (string.IsNullOrWhiteSpace(request.Title))
            return Fail<AiSuggestLearningObjectivesResponse>((ProvisioningError.Invalid, "A title is needed before objectives can be drafted."));

        var lesson = await db.Lessons.Include(l => l.Revisions).AsNoTracking()
            .FirstOrDefaultAsync(l => l.Id == lessonId && l.WorkspaceId == ctx.Workspace!.Id, ct);
        if (lesson is null) return Fail<AiSuggestLearningObjectivesResponse>((ProvisioningError.NotFound, "No such lesson."));

        var revision = lesson.DraftRevision ?? lesson.CurrentRevision;
        var transcript = revision?.TranscriptStatus == TranscriptStatus.Ready ? revision.Transcript : null;
        var outputLanguage = await GetLessonLanguageAsync(lesson.LearningProductId, ct);

        try
        {
            var result = await generateLearningObjectives.SuggestAsync(request.Title, request.Body, transcript, outputLanguage, ctx.Workspace!.Id, ct);
            return ProvisioningResult<AiSuggestLearningObjectivesResponse>.Success(new AiSuggestLearningObjectivesResponse(result));
        }
        catch (CreditsExhaustedException ex)
        {
            return ProvisioningResult<AiSuggestLearningObjectivesResponse>.FailCreditsExhausted(ex.Message, ex.Cost, ex.RemainingBalance);
        }
        catch (InvalidOperationException ex)
        {
            return Fail<AiSuggestLearningObjectivesResponse>((ProvisioningError.Conflict, $"AI content generation failed: {ex.Message}"));
        }
    }

    /// <summary>
    /// Extracts a glossary of key terms (AI Capability Architecture §8).
    /// Same source pattern as SuggestLearningObjectivesAsync — transcript
    /// read server-side, preferred over the form's current Body. Doesn't
    /// touch the database — nothing is saved until the tutor hits Save
    /// themselves.
    /// </summary>
    public async Task<ProvisioningResult<AiSuggestGlossaryResponse>> SuggestGlossaryAsync(
        string slug, Guid caller, Guid lessonId, AiSuggestGlossaryRequest request, CancellationToken ct = default)
    {
        var ctx = await ResolveAsync(slug, caller, requireAuthor: true, ct);
        if (ctx.Error is not null) return Fail<AiSuggestGlossaryResponse>(ctx.Error.Value);

        if (!await entitlements.HasEntitlementAsync(
                ctx.Workspace!.Id, EntitlementResolutionService.AiKey(CapabilityDomain.Learning),
                AiAssistanceLevel.Assist.ToString(), ct))
            return Fail<AiSuggestGlossaryResponse>((ProvisioningError.Forbidden,
                "AI content assistance needs the Professional plan or an AI-enabled Learning pack. Upgrade to use this."));

        if (string.IsNullOrWhiteSpace(request.Title))
            return Fail<AiSuggestGlossaryResponse>((ProvisioningError.Invalid, "A title is needed before a glossary can be drafted."));

        var lesson = await db.Lessons.Include(l => l.Revisions).AsNoTracking()
            .FirstOrDefaultAsync(l => l.Id == lessonId && l.WorkspaceId == ctx.Workspace!.Id, ct);
        if (lesson is null) return Fail<AiSuggestGlossaryResponse>((ProvisioningError.NotFound, "No such lesson."));

        var revision = lesson.DraftRevision ?? lesson.CurrentRevision;
        var transcript = revision?.TranscriptStatus == TranscriptStatus.Ready ? revision.Transcript : null;
        var outputLanguage = await GetLessonLanguageAsync(lesson.LearningProductId, ct);

        try
        {
            var result = await generateGlossary.SuggestAsync(request.Title, request.Body, transcript, outputLanguage, ctx.Workspace!.Id, ct);
            return ProvisioningResult<AiSuggestGlossaryResponse>.Success(new AiSuggestGlossaryResponse(result));
        }
        catch (CreditsExhaustedException ex)
        {
            return ProvisioningResult<AiSuggestGlossaryResponse>.FailCreditsExhausted(ex.Message, ex.Cost, ex.RemainingBalance);
        }
        catch (InvalidOperationException ex)
        {
            return Fail<AiSuggestGlossaryResponse>((ProvisioningError.Conflict, $"AI content generation failed: {ex.Message}"));
        }
    }

    /// <summary>
    /// Suggests homework/practical exercises (AI Authoring Assistant
    /// Architecture Stage 8). Same source pattern as SuggestGlossaryAsync —
    /// transcript read server-side, preferred over the form's current Body.
    /// Doesn't touch the database — nothing is saved until the tutor hits
    /// Save themselves.
    /// </summary>
    public async Task<ProvisioningResult<AiSuggestHomeworkResponse>> SuggestHomeworkAsync(
        string slug, Guid caller, Guid lessonId, AiSuggestHomeworkRequest request, CancellationToken ct = default)
    {
        var ctx = await ResolveAsync(slug, caller, requireAuthor: true, ct);
        if (ctx.Error is not null) return Fail<AiSuggestHomeworkResponse>(ctx.Error.Value);

        if (!await entitlements.HasEntitlementAsync(
                ctx.Workspace!.Id, EntitlementResolutionService.AiKey(CapabilityDomain.Learning),
                AiAssistanceLevel.Assist.ToString(), ct))
            return Fail<AiSuggestHomeworkResponse>((ProvisioningError.Forbidden,
                "AI content assistance needs the Professional plan or an AI-enabled Learning pack. Upgrade to use this."));

        if (string.IsNullOrWhiteSpace(request.Title))
            return Fail<AiSuggestHomeworkResponse>((ProvisioningError.Invalid, "A title is needed before homework can be drafted."));

        var lesson = await db.Lessons.Include(l => l.Revisions).AsNoTracking()
            .FirstOrDefaultAsync(l => l.Id == lessonId && l.WorkspaceId == ctx.Workspace!.Id, ct);
        if (lesson is null) return Fail<AiSuggestHomeworkResponse>((ProvisioningError.NotFound, "No such lesson."));

        var revision = lesson.DraftRevision ?? lesson.CurrentRevision;
        var transcript = revision?.TranscriptStatus == TranscriptStatus.Ready ? revision.Transcript : null;
        var outputLanguage = await GetLessonLanguageAsync(lesson.LearningProductId, ct);

        try
        {
            var result = await generateHomework.SuggestAsync(request.Title, request.Body, transcript, outputLanguage, ctx.Workspace!.Id, ct);
            return ProvisioningResult<AiSuggestHomeworkResponse>.Success(new AiSuggestHomeworkResponse(result));
        }
        catch (CreditsExhaustedException ex)
        {
            return ProvisioningResult<AiSuggestHomeworkResponse>.FailCreditsExhausted(ex.Message, ex.Cost, ex.RemainingBalance);
        }
        catch (InvalidOperationException ex)
        {
            return Fail<AiSuggestHomeworkResponse>((ProvisioningError.Conflict, $"AI content generation failed: {ex.Message}"));
        }
    }

    // ── Plumbing ─────────────────────────────────────────────────────────────

    /// <summary>
    /// The Learning Product's own configured language (Learning Product
    /// Aggregate Design §8's DefaultLanguage), passed to AI skills as an
    /// explicit output-language instruction instead of leaving the model to
    /// infer it purely from the source content — a small local model's own
    /// English bias otherwise tends to win even when a transcript is
    /// correctly grounded in, say, Arabic. Null when the tutor hasn't set
    /// one, in which case every skill falls back to matching the source.
    /// </summary>
    private Task<string?> GetLessonLanguageAsync(Guid learningProductId, CancellationToken ct) =>
        db.LearningProducts.AsNoTracking()
            .Where(p => p.Id == learningProductId)
            .Select(p => p.DefaultLanguage)
            .FirstOrDefaultAsync(ct);

    private async Task<Curriculum?> LoadCurriculumAsync(Guid productId, CancellationToken ct, bool tracked = false)
    {
        var q = db.Curricula.Include(c => c.Units).ThenInclude(u => u.Lessons)
                  .Where(c => c.LearningProductId == productId && c.Status != CurriculumStatus.Archived);
        return tracked ? await q.FirstOrDefaultAsync(ct) : await q.AsNoTracking().FirstOrDefaultAsync(ct);
    }

    private async Task<Dictionary<Guid, Lesson>> LoadLessonsAsync(Guid productId, CancellationToken ct)
        => await db.Lessons.Include(l => l.Revisions).AsNoTracking()
            .Where(l => l.LearningProductId == productId)
            .ToDictionaryAsync(l => l.Id, ct);

    private async Task<ProvisioningResult<CurriculumResponse>> MutateAsync(
        string slug, Guid caller, Guid productId,
        Action<Curriculum, Context> mutate, CancellationToken ct, bool createIfMissing = false)
    {
        var ctx = await ResolveAsync(slug, caller, requireAuthor: true, ct);
        if (ctx.Error is not null) return Fail<CurriculumResponse>(ctx.Error.Value);

        var product = await db.LearningProducts.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == productId && p.WorkspaceId == ctx.Workspace!.Id, ct);
        if (product is null) return Fail<CurriculumResponse>((ProvisioningError.NotFound, "No such learning product."));

        var curriculum = await LoadCurriculumAsync(productId, ct, tracked: true);
        var created = false;

        if (curriculum is null)
        {
            if (!createIfMissing)
                return Fail<CurriculumResponse>((ProvisioningError.Conflict, "This product has no curriculum yet."));

            curriculum = Curriculum.Create(ctx.Workspace!.Id, productId, product.Title);
            db.Curricula.Add(curriculum);
            created = true;
        }

        try { mutate(curriculum, ctx); }
        catch (InvalidOperationException ex) { return Fail<CurriculumResponse>((ProvisioningError.Conflict, ex.Message)); }
        catch (ArgumentException ex) { return Fail<CurriculumResponse>((ProvisioningError.Invalid, ex.Message)); }

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (created && IsUniqueViolation(ex))
        {
            // Lost the race to create this product's curriculum (INV-003,
            // enforced by curricula's unique-per-active-product index) —
            // another request created it a moment earlier. Same fix as
            // LearningDeliveryService's EnsureEnrolledAsync/EnsureProgressAsync:
            // drop this attempt and re-apply the same mutation onto the
            // winner's row, rather than failing the tutor's click outright.
            db.Entry(curriculum).State = EntityState.Detached;
            curriculum = await LoadCurriculumAsync(productId, ct, tracked: true)
                ?? throw new InvalidOperationException("Lost a curriculum-creation race but no curriculum exists to adopt.");

            try { mutate(curriculum, ctx); }
            catch (InvalidOperationException ex2) { return Fail<CurriculumResponse>((ProvisioningError.Conflict, ex2.Message)); }
            catch (ArgumentException ex2) { return Fail<CurriculumResponse>((ProvisioningError.Invalid, ex2.Message)); }

            await db.SaveChangesAsync(ct);
        }

        return await GetAsync(slug, caller, productId, ct);
    }

    private static bool IsUniqueViolation(DbUpdateException ex) =>
        ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation };

    private async Task<ProvisioningResult<LessonDetailResponse>> MutateLessonAsync(
        string slug, Guid caller, Guid lessonId, Action<Lesson> mutate, CancellationToken ct)
    {
        var ctx = await ResolveAsync(slug, caller, requireAuthor: true, ct);
        if (ctx.Error is not null) return Fail<LessonDetailResponse>(ctx.Error.Value);

        var lesson = await db.Lessons.Include(l => l.Revisions)
            .FirstOrDefaultAsync(l => l.Id == lessonId && l.WorkspaceId == ctx.Workspace!.Id, ct);
        if (lesson is null) return Fail<LessonDetailResponse>((ProvisioningError.NotFound, "No such lesson."));

        try { mutate(lesson); }
        catch (InvalidOperationException ex) { return Fail<LessonDetailResponse>((ProvisioningError.Conflict, ex.Message)); }
        catch (ArgumentException ex) { return Fail<LessonDetailResponse>((ProvisioningError.Invalid, ex.Message)); }

        await db.SaveChangesAsync(ct);
        return await GetLessonAsync(slug, caller, lessonId, ct);
    }

    private record Context(Workspace? Workspace, Guid MembershipId, bool CanAuthor,
                           (ProvisioningError Error, string Message)? Error);

    private async Task<Context> ResolveAsync(string slug, Guid caller, bool requireAuthor, CancellationToken ct)
    {
        var normalised = slug.ToLowerInvariant().Trim();

        var workspace = await db.Workspaces.AsNoTracking().FirstOrDefaultAsync(w => w.Slug == normalised, ct);
        if (workspace is null) return new Context(null, Guid.Empty, false, (ProvisioningError.NotFound, "No such workspace."));

        var member = await db.Memberships.Include(m => m.Roles).AsNoTracking()
            .FirstOrDefaultAsync(m => m.WorkspaceId == workspace.Id && m.IdentityId == caller
                                   && m.Status == MembershipStatus.Active, ct);

        // Non-members get 404 so status codes cannot map which workspaces exist
        if (member is null) return new Context(null, Guid.Empty, false, (ProvisioningError.NotFound, "No such workspace."));

        var canAuthor = member.Roles.Any(r => AuthorRoles.Contains(r.Name));
        if (requireAuthor && !canAuthor)
            return new Context(null, member.Id, false,
                (ProvisioningError.Forbidden, "Only an owner, administrator or teacher can author content."));

        return new Context(workspace, member.Id, canAuthor, null);
    }

    private static ProvisioningResult<T> Fail<T>((ProvisioningError Error, string Message) e)
        => ProvisioningResult<T>.Fail(e.Error, e.Message);
}
