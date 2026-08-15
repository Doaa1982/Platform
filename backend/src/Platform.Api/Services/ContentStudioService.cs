using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
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
    PlatformDbContext db, EntitlementResolutionService entitlements,
    TranscriptionQueue transcriptionQueue, ILearningAssetStorage assetStorage,
    GenerateLessonBodySkill generateLessonBody, GenerateWhatYoullLearnSkill generateWhatYoullLearn,
    GenerateLessonTitleSkill generateLessonTitle, GenerateLearningObjectivesSkill generateLearningObjectives,
    GenerateGlossarySkill generateGlossary, GenerateHomeworkSkill generateHomework)
{
    /// <summary>Speechmatics' supported input formats (AI Video Transcript Implementation Plan §4/§7) — checked against the uploaded file's extension before a job is ever submitted.</summary>
    private static readonly string[] SupportedTranscriptionExtensions =
        [".wav", ".mp3", ".aac", ".ogg", ".mpeg", ".amr", ".m4a", ".mp4", ".flac"];

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

        var lesson = await db.Lessons.Include(l => l.Revisions).ThenInclude(r => r.Resources).AsNoTracking()
            .FirstOrDefaultAsync(l => l.Id == lessonId && l.WorkspaceId == ctx.Workspace!.Id, ct);
        if (lesson is null) return Fail<LessonDetailResponse>((ProvisioningError.NotFound, "No such lesson."));

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

        var assessmentIds = assessmentsByRevision.Values.Select(a => a.Id).ToList();
        var submissionCounts = assessmentIds.Count == 0
            ? new Dictionary<Guid, int>()
            : await db.Submissions.AsNoTracking()
                .Where(s => assessmentIds.Contains(s.AssessmentId))
                .GroupBy(s => s.AssessmentId)
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
                    .Select(res => new LessonResourceRow(res.Id, LearningAssetService.Describe(assets[res.LearningAssetId]))).ToList());
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

        // Lesson Editing & Publication UX, Rule 13: a new revision is
        // pre-filled from the one it was started from — every field except
        // the video (VideoAssetId/VideoUrl are never copied; a tutor starting
        // a new revision because the video needs replacing is not asked to
        // re-author content that didn't change).
        if (previousRevision is not null)
            draft.Edit(previousRevision.Title, previousRevision.Body, previousRevision.EstimatedMinutes, previousRevision.DeliveryMode, previousRevision.WhatYoullLearn, previousRevision.LearningObjectives, previousRevision.Glossary, previousRevision.Homework);

        // Interactive questions are versioned together with their revision
        // (Lesson Revision Aggregate Design §7's "Interactive Learning Event");
        // the previous revision's own Assessment — and every Submission graded
        // against it — is left exactly as it was, referenced only by the
        // now-superseded revision's id.
        if (previousRevision is not null)
            await CloneAssessmentAsync(ctx.Workspace!.Id, lessonId, previousRevision.Id, draft.Id, ct);

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

        await CloneAssessmentAsync(ctx.Workspace!.Id, clone.Id, sourceRevision.Id, clone.DraftRevision!.Id, ct);

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
        string slug, Guid caller, Guid lessonId, Guid learningAssetId, CancellationToken ct = default)
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
            revision.AddResource(asset.Id);
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

    /// <summary>
    /// Kicks off AI transcription (AI Video Transcript Implementation Plan) for
    /// whichever revision is currently open for editing — the draft if one
    /// exists, else the published revision, same "target revision" rule
    /// AssessmentService uses for its own AI surfaces. Cross-aggregate (needs
    /// the Learning Asset's storage location), so this cannot go through
    /// MutateLessonAsync's single-aggregate mutate delegate. Returns as soon
    /// as the job is queued — the actual transcription runs on
    /// TranscriptionBackgroundService, not inside this request.
    /// </summary>
    public async Task<ProvisioningResult<LessonDetailResponse>> GenerateTranscriptAsync(
        string slug, Guid caller, Guid lessonId, CancellationToken ct = default)
    {
        var ctx = await ResolveAsync(slug, caller, requireAuthor: true, ct);
        if (ctx.Error is not null) return Fail<LessonDetailResponse>(ctx.Error.Value);

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

        TranscriptionJob job;
        if (revision.VideoAssetId is not null)
        {
            var asset = await db.LearningAssets.AsNoTracking()
                .FirstOrDefaultAsync(a => a.Id == revision.VideoAssetId && a.WorkspaceId == ctx.Workspace!.Id, ct);
            if (asset is null) return Fail<LessonDetailResponse>((ProvisioningError.NotFound, "No such learning asset."));

            var extension = Path.GetExtension(asset.OriginalFileName);
            if (!SupportedTranscriptionExtensions.Contains(extension, StringComparer.OrdinalIgnoreCase))
                return Fail<LessonDetailResponse>((ProvisioningError.Invalid,
                    $"\"{extension}\" videos aren't supported for transcription yet. Supported formats: {string.Join(", ", SupportedTranscriptionExtensions)}."));

            job = new TranscriptionJob(ctx.Workspace!.Id, lessonId, revision.Id, asset.OriginalFileName,
                FilePath: assetStorage.ResolvePath(asset.ObjectKey));
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

            var fileName = Path.GetFileName(uri.AbsolutePath);
            job = new TranscriptionJob(ctx.Workspace!.Id, lessonId, revision.Id, fileName, SourceUrl: revision.VideoUrl);
        }
        else
        {
            return Fail<LessonDetailResponse>((ProvisioningError.Conflict, "This revision has no video to transcribe yet."));
        }

        try { revision.BeginTranscription(); }
        catch (InvalidOperationException ex) { return Fail<LessonDetailResponse>((ProvisioningError.Conflict, ex.Message)); }

        await db.SaveChangesAsync(ct);

        transcriptionQueue.Enqueue(job);

        return await GetLessonAsync(slug, caller, lessonId, ct);
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

        try
        {
            var body = await generateLessonBody.SuggestAsync(request.Title, request.Body, request.EstimatedMinutes, ct);
            return ProvisioningResult<AiSuggestBodyResponse>.Success(new AiSuggestBodyResponse(body));
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

        try
        {
            var result = await generateWhatYoullLearn.SuggestAsync(request.Title, request.Body, transcript, ct);
            return ProvisioningResult<AiSuggestWhatYoullLearnResponse>.Success(new AiSuggestWhatYoullLearnResponse(result));
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

        try
        {
            var result = await generateLessonTitle.SuggestAsync(request.Title, request.Body, transcript, ct);
            return ProvisioningResult<AiSuggestTitleResponse>.Success(new AiSuggestTitleResponse(result));
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

        try
        {
            var result = await generateLearningObjectives.SuggestAsync(request.Title, request.Body, transcript, ct);
            return ProvisioningResult<AiSuggestLearningObjectivesResponse>.Success(new AiSuggestLearningObjectivesResponse(result));
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

        try
        {
            var result = await generateGlossary.SuggestAsync(request.Title, request.Body, transcript, ct);
            return ProvisioningResult<AiSuggestGlossaryResponse>.Success(new AiSuggestGlossaryResponse(result));
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

        try
        {
            var result = await generateHomework.SuggestAsync(request.Title, request.Body, transcript, ct);
            return ProvisioningResult<AiSuggestHomeworkResponse>.Success(new AiSuggestHomeworkResponse(result));
        }
        catch (InvalidOperationException ex)
        {
            return Fail<AiSuggestHomeworkResponse>((ProvisioningError.Conflict, $"AI content generation failed: {ex.Message}"));
        }
    }

    // ── Plumbing ─────────────────────────────────────────────────────────────

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

        if (curriculum is null)
        {
            if (!createIfMissing)
                return Fail<CurriculumResponse>((ProvisioningError.Conflict, "This product has no curriculum yet."));

            curriculum = Curriculum.Create(ctx.Workspace!.Id, productId, product.Title);
            db.Curricula.Add(curriculum);
        }

        try { mutate(curriculum, ctx); }
        catch (InvalidOperationException ex) { return Fail<CurriculumResponse>((ProvisioningError.Conflict, ex.Message)); }
        catch (ArgumentException ex) { return Fail<CurriculumResponse>((ProvisioningError.Invalid, ex.Message)); }

        await db.SaveChangesAsync(ct);
        return await GetAsync(slug, caller, productId, ct);
    }

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
