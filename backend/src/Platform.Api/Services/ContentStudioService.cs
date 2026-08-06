using Microsoft.EntityFrameworkCore;
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
public class ContentStudioService(PlatformDbContext db)
{
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

        var lesson = await db.Lessons.Include(l => l.Revisions).AsNoTracking()
            .FirstOrDefaultAsync(l => l.Id == lessonId && l.WorkspaceId == ctx.Workspace!.Id, ct);
        if (lesson is null) return Fail<LessonDetailResponse>((ProvisioningError.NotFound, "No such lesson."));

        var assetIds = lesson.Revisions.Where(r => r.VideoAssetId is not null)
            .Select(r => r.VideoAssetId!.Value).Distinct().ToList();
        var assets = assetIds.Count == 0
            ? new Dictionary<Guid, LearningAsset>()
            : await db.LearningAssets.AsNoTracking().Where(a => assetIds.Contains(a.Id)).ToDictionaryAsync(a => a.Id, ct);

        LessonRevisionRow? Rev(LessonRevision? r) => r is null ? null : new LessonRevisionRow(
            r.Id, r.Version, r.Title, r.Body, r.EstimatedMinutes, r.DeliveryMode.ToString(), r.Status.ToString(), r.UpdatedAt,
            r.VideoAssetId,
            r.VideoAssetId is { } videoId && assets.TryGetValue(videoId, out var video) ? LearningAssetService.Describe(video) : null);

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
            draft.Edit(request.Title, request.Body, request.EstimatedMinutes, deliveryMode);
        }, ct);

    public Task<ProvisioningResult<LessonDetailResponse>> StartRevisionAsync(
        string slug, Guid caller, Guid lessonId, CancellationToken ct = default)
        => MutateLessonAsync(slug, caller, lessonId, l => l.StartRevision(Guid.Empty), ct, needsMembership: true);

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

    public Task<ProvisioningResult<LessonDetailResponse>> RemoveVideoAsync(
        string slug, Guid caller, Guid lessonId, CancellationToken ct = default)
        => MutateLessonAsync(slug, caller, lessonId, l =>
        {
            var draft = l.DraftRevision
                ?? throw new InvalidOperationException("This lesson has no open draft.");
            draft.RemoveVideo();
        }, ct);

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
        string slug, Guid caller, Guid lessonId, Action<Lesson> mutate, CancellationToken ct, bool needsMembership = false)
    {
        var ctx = await ResolveAsync(slug, caller, requireAuthor: true, ct);
        if (ctx.Error is not null) return Fail<LessonDetailResponse>(ctx.Error.Value);

        var lesson = await db.Lessons.Include(l => l.Revisions)
            .FirstOrDefaultAsync(l => l.Id == lessonId && l.WorkspaceId == ctx.Workspace!.Id, ct);
        if (lesson is null) return Fail<LessonDetailResponse>((ProvisioningError.NotFound, "No such lesson."));

        try
        {
            // StartRevision records who authored it, which only this layer knows
            if (needsMembership) lesson.StartRevision(ctx.MembershipId);
            else mutate(lesson);
        }
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
