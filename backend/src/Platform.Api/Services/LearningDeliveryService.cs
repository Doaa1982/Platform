using Microsoft.EntityFrameworkCore;
using Npgsql;
using Platform.Api.Models;
using Platform.Domain;
using Platform.Infrastructure;

namespace Platform.Api.Services;

/// <summary>
/// Learner-facing delivery: browsing Published products, opening a Published
/// Curriculum's lessons, watching a lesson's video, answering its questions
/// for real, and completion tracking.
///
/// Three aggregates outside Content Studio's own participate here, all
/// deliberately simplified from their full designs (see each class's own
/// remarks for what and why):
///   Enrollment      auto-created the moment a Learner opens a Published product
///   Submission      a real graded attempt, reusing Assessment.Grade() exactly as AssessmentService.PreviewAsync does
///   LessonProgress  the one concrete completion rule this app enforces
/// </summary>
public class LearningDeliveryService(PlatformDbContext db)
{
    // ── Products ─────────────────────────────────────────────────────────────

    public async Task<ProvisioningResult<LearnerProductListResponse>> GetMyProductsAsync(
        string slug, Guid caller, CancellationToken ct = default)
    {
        var ctx = await ResolveAsync(slug, caller, ct);
        if (ctx.Error is not null) return Fail<LearnerProductListResponse>(ctx.Error.Value);

        var products = await db.LearningProducts.AsNoTracking()
            .Where(p => p.WorkspaceId == ctx.Workspace!.Id && p.Status == LearningProductStatus.Published)
            .ToListAsync(ct);

        var rows = new List<LearnerProductRow>();
        foreach (var p in products)
        {
            var hasContent = await db.Curricula.AsNoTracking()
                .AnyAsync(c => c.LearningProductId == p.Id && c.Status == CurriculumStatus.Published, ct);
            rows.Add(new LearnerProductRow(p.Id, p.Title, p.Description, p.Category, hasContent));
        }

        return ProvisioningResult<LearnerProductListResponse>.Success(new LearnerProductListResponse(rows));
    }

    /// <summary>
    /// Aggregate counts for the dashboard — across every Enrollment this
    /// Learner holds in the Workspace, not just one product. Certificates has
    /// no backing data yet (no Certificate aggregate exists), so it is
    /// deliberately absent here rather than reported as zero.
    /// </summary>
    public async Task<ProvisioningResult<LearnerStatsResponse>> GetStatsAsync(
        string slug, Guid caller, CancellationToken ct = default)
    {
        var ctx = await ResolveAsync(slug, caller, ct);
        if (ctx.Error is not null) return Fail<LearnerStatsResponse>(ctx.Error.Value);

        var enrollments = await db.Enrollments.AsNoTracking()
            .Where(e => e.WorkspaceId == ctx.Workspace!.Id && e.MembershipId == ctx.MembershipId)
            .Select(e => new { e.Id, e.LearningProductId })
            .ToListAsync(ct);

        var enrollmentIds = enrollments.Select(e => e.Id).ToList();
        var productIds = enrollments.Select(e => e.LearningProductId).Distinct().ToList();

        var completedProgress = await db.LessonProgresses.AsNoTracking()
            .Where(p => enrollmentIds.Contains(p.EnrollmentId) && p.Status == LessonProgressStatus.Completed)
            .Select(p => new { p.LessonId, p.LessonRevisionId })
            .ToListAsync(ct);
        var completedLessonIds = completedProgress.Select(p => p.LessonId).ToList();

        var curricula = await db.Curricula.Include(c => c.Units).ThenInclude(u => u.Lessons).AsNoTracking()
            .Where(c => productIds.Contains(c.LearningProductId) && c.Status == CurriculumStatus.Published)
            .ToListAsync(ct);

        var totalLessons = curricula.SelectMany(c => c.Units).SelectMany(u => u.Lessons)
            .Select(l => l.LessonId).Distinct().Count();

        // A product counts as completed only once every one of its published
        // lessons has been — an empty curriculum (no lessons yet) is not
        // "completed", just empty.
        var completedLessonIdSet = completedLessonIds.ToHashSet();
        var completedProducts = curricula.GroupBy(c => c.LearningProductId)
            .Count(g =>
            {
                var lessonIds = g.SelectMany(c => c.Units).SelectMany(u => u.Lessons)
                    .Select(l => l.LessonId).Distinct().ToList();
                return lessonIds.Count > 0 && lessonIds.All(completedLessonIdSet.Contains);
            });

        // Time invested only counts what's actually finished — a lesson
        // half-watched hasn't been "spent" yet, it's still in progress. Uses
        // each completion's pinned revision (§20), not the lesson's current
        // one, so a later video replacement can't retroactively change a
        // number the learner already earned.
        var completedRevisionIds = completedProgress.Select(p => p.LessonRevisionId).Distinct().ToList();
        var timeInvestedMinutes = completedRevisionIds.Count == 0 ? 0 :
            await db.Set<LessonRevision>().AsNoTracking()
                .Where(r => completedRevisionIds.Contains(r.Id))
                .SumAsync(r => r.EstimatedMinutes ?? 0, ct);

        // Distinct Assessments, not attempts — retaking one you've already
        // passed shouldn't inflate the count.
        var passedAssessments = await db.Submissions.AsNoTracking()
            .Where(s => s.MembershipId == ctx.MembershipId && s.Passed)
            .Select(s => s.AssessmentId).Distinct()
            .CountAsync(ct);

        // The lesson most recently begun that isn't finished yet — StartedAt
        // is set once, the first time a lesson is opened, so this points at
        // the newest thing the Learner started, not necessarily the last one
        // they viewed (LessonProgress carries no "last viewed" timestamp).
        var openProgress = await db.LessonProgresses.AsNoTracking()
            .Where(p => enrollmentIds.Contains(p.EnrollmentId) && p.Status != LessonProgressStatus.Completed)
            .OrderByDescending(p => p.StartedAt)
            .FirstOrDefaultAsync(ct);

        LearnerContinueLearningRow? continueLearning = null;
        if (openProgress is not null)
        {
            var lesson = await db.Lessons.AsNoTracking()
                .FirstOrDefaultAsync(l => l.Id == openProgress.LessonId && l.Status == LessonStatus.Published, ct);
            if (lesson is not null)
            {
                var product = await db.LearningProducts.AsNoTracking()
                    .FirstOrDefaultAsync(p => p.Id == lesson.LearningProductId, ct);
                if (product is not null)
                    continueLearning = new LearnerContinueLearningRow(product.Id, product.Title, lesson.Id, lesson.Title);
            }
        }

        return ProvisioningResult<LearnerStatsResponse>.Success(new LearnerStatsResponse(
            productIds.Count, completedLessonIds.Count, totalLessons, passedAssessments,
            completedProducts, timeInvestedMinutes, continueLearning));
    }

    // ── Curriculum ───────────────────────────────────────────────────────────

    public async Task<ProvisioningResult<LearnerCurriculumResponse>> GetCurriculumAsync(
        string slug, Guid caller, Guid productId, CancellationToken ct = default)
    {
        var ctx = await ResolveAsync(slug, caller, ct);
        if (ctx.Error is not null) return Fail<LearnerCurriculumResponse>(ctx.Error.Value);

        var product = await db.LearningProducts.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == productId && p.WorkspaceId == ctx.Workspace!.Id
                                    && p.Status == LearningProductStatus.Published, ct);
        if (product is null) return Fail<LearnerCurriculumResponse>((ProvisioningError.NotFound, "No such product."));

        // Opening a product's curriculum is the enrolment moment (Enrollment.cs remarks).
        var enrollment = await EnsureEnrolledAsync(ctx.Workspace!.Id, productId, ctx.MembershipId, ct);

        var curriculum = await db.Curricula.Include(c => c.Units).ThenInclude(u => u.Lessons).AsNoTracking()
            .FirstOrDefaultAsync(c => c.LearningProductId == productId && c.Status == CurriculumStatus.Published, ct);

        if (curriculum is null)
            return ProvisioningResult<LearnerCurriculumResponse>.Success(
                new LearnerCurriculumResponse(product.Id, product.Title, null, null, false, []));

        var lessonIds = curriculum.Units.SelectMany(u => u.Lessons).Select(l => l.LessonId).Distinct().ToList();
        var lessons = lessonIds.Count == 0
            ? new Dictionary<Guid, Lesson>()
            : await db.Lessons.Include(l => l.Revisions).AsNoTracking()
                .Where(l => lessonIds.Contains(l.Id) && l.Status == LessonStatus.Published)
                .ToDictionaryAsync(l => l.Id, ct);

        var progress = await db.LessonProgresses.AsNoTracking()
            .Where(p => p.EnrollmentId == enrollment.Id).ToDictionaryAsync(p => p.LessonId, ct);

        // Curriculum order — every placed lesson, regardless of its own
        // publish state, so a lesson the tutor temporarily unpublished still
        // occupies its place in the sequence rather than silently skipping.
        var orderedLessonIds = curriculum.Units.OrderBy(u => u.Position)
            .SelectMany(u => u.Lessons.OrderBy(l => l.Position))
            .Select(l => l.LessonId).ToList();

        bool IsLocked(Guid lessonId)
        {
            if (!curriculum.RequiresSequentialCompletion) return false;
            var index = orderedLessonIds.IndexOf(lessonId);
            if (index <= 0) return false;
            var previousLessonId = orderedLessonIds[index - 1];
            return !progress.TryGetValue(previousLessonId, out var pr) || pr.Status != LessonProgressStatus.Completed;
        }

        var units = curriculum.Units.OrderBy(u => u.Position)
            .Select(u => new LearnerUnitRow(
                u.Title, u.Position,
                u.Lessons.OrderBy(l => l.Position)
                    .Where(l => lessons.ContainsKey(l.LessonId))
                    .Select(l => lessons[l.LessonId])
                    .Select(lesson => new LearnerLessonRow(
                        lesson.Id, lesson.Title, lesson.CurrentRevision?.EstimatedMinutes,
                        progress.TryGetValue(lesson.Id, out var pr) ? pr.Status.ToString() : "NotStarted",
                        IsLocked(lesson.Id)))
                    .ToList()))
            .Where(u => u.Lessons.Count > 0)
            .ToList();

        return ProvisioningResult<LearnerCurriculumResponse>.Success(
            new LearnerCurriculumResponse(
                product.Id, product.Title, curriculum.Id, curriculum.Title,
                curriculum.RequiresSequentialCompletion, units));
    }

    // ── Lesson delivery ──────────────────────────────────────────────────────

    public async Task<ProvisioningResult<LearnerLessonResponse>> GetLessonAsync(
        string slug, Guid caller, Guid lessonId, CancellationToken ct = default)
    {
        var ctx = await ResolveAsync(slug, caller, ct);
        if (ctx.Error is not null) return Fail<LearnerLessonResponse>(ctx.Error.Value);

        var lesson = await db.Lessons.Include(l => l.Revisions).AsNoTracking()
            .FirstOrDefaultAsync(l => l.Id == lessonId && l.WorkspaceId == ctx.Workspace!.Id
                                    && l.Status == LessonStatus.Published, ct);
        if (lesson is null) return Fail<LearnerLessonResponse>((ProvisioningError.NotFound, "No such lesson."));

        var enrollment = await EnsureEnrolledAsync(ctx.Workspace!.Id, lesson.LearningProductId, ctx.MembershipId, ct);

        if (await IsLessonLockedAsync(lesson.LearningProductId, lessonId, enrollment.Id, ct))
            return Fail<LearnerLessonResponse>((ProvisioningError.Forbidden, "Complete the previous lesson first."));

        var progress = await EnsureProgressAsync(enrollment.Id, lessonId, lesson.CurrentRevisionId!.Value, ct);

        // Served from the revision this progress is pinned to (Learning
        // Publication & Version Management §20), not necessarily the lesson's
        // current one — a learner Started/In Progress on an earlier revision
        // keeps seeing it through a later Major change.
        var revision = lesson.Revisions.First(r => r.Id == progress.LessonRevisionId);

        LearningAssetResponse? video = null;
        if (revision.VideoAssetId is { } videoId)
        {
            var asset = await db.LearningAssets.AsNoTracking().FirstOrDefaultAsync(a => a.Id == videoId, ct);
            if (asset is not null) video = LearningAssetService.Describe(asset);
        }

        var assessment = await db.Assessments.Include(a => a.Questions).AsNoTracking()
            .FirstOrDefaultAsync(a => a.LessonRevisionId == progress.LessonRevisionId && a.Status == AssessmentStatus.Published, ct);

        var questions = assessment is null ? [] : assessment.Questions.OrderBy(q => q.Position)
            .Select(q => new LearnerQuestionRow(q.Id, q.Type.ToString(), q.Prompt, q.Options, q.VideoTimestampSeconds, q.Points))
            .ToList();

        var hasVideo = revision.VideoAssetId is not null || revision.VideoUrl is not null;

        // A lesson with no video and no gradable assessment completes the moment it's opened.
        var hasGradableAssessment = assessment is not null && assessment.Questions.Count > 0;
        if (!hasVideo && !hasGradableAssessment)
        {
            progress.RecomputeCompletion(hasVideo: false, hasGradableAssessment: false, hasPassingSubmission: false);
            await db.SaveChangesAsync(ct);
        }

        return ProvisioningResult<LearnerLessonResponse>.Success(new LearnerLessonResponse(
            lesson.Id, revision.Title, revision.Body, revision.DeliveryMode.ToString(), video, revision.VideoUrl,
            questions, progress.Status.ToString(), progress.VideoWatched));
    }

    // ── Interaction ──────────────────────────────────────────────────────────

    public async Task<ProvisioningResult<LearnerLessonResponse>> MarkVideoWatchedAsync(
        string slug, Guid caller, Guid lessonId, CancellationToken ct = default)
    {
        var ctx = await ResolveAsync(slug, caller, ct);
        if (ctx.Error is not null) return Fail<LearnerLessonResponse>(ctx.Error.Value);

        var lesson = await db.Lessons.AsNoTracking()
            .FirstOrDefaultAsync(l => l.Id == lessonId && l.WorkspaceId == ctx.Workspace!.Id
                                    && l.Status == LessonStatus.Published, ct);
        if (lesson is null) return Fail<LearnerLessonResponse>((ProvisioningError.NotFound, "No such lesson."));

        var enrollment = await EnsureEnrolledAsync(ctx.Workspace!.Id, lesson.LearningProductId, ctx.MembershipId, ct);

        if (await IsLessonLockedAsync(lesson.LearningProductId, lessonId, enrollment.Id, ct))
            return Fail<LearnerLessonResponse>((ProvisioningError.Forbidden, "Complete the previous lesson first."));

        var progress = await EnsureProgressAsync(enrollment.Id, lessonId, lesson.CurrentRevisionId!.Value, ct);

        var assessment = await db.Assessments.Include(a => a.Questions).AsNoTracking()
            .FirstOrDefaultAsync(a => a.LessonRevisionId == progress.LessonRevisionId && a.Status == AssessmentStatus.Published, ct);
        var hasGradableAssessment = assessment is not null && assessment.Questions.Count > 0;
        var hasPassing = hasGradableAssessment && await HasPassingSubmissionAsync(assessment!.Id, ctx.MembershipId, ct);

        progress.MarkVideoWatched();
        progress.RecomputeCompletion(hasVideo: true, hasGradableAssessment, hasPassing);
        await db.SaveChangesAsync(ct);

        return await GetLessonAsync(slug, caller, lessonId, ct);
    }

    /// <summary>
    /// Grades and persists a real Submission (Submission.cs remarks) — not the
    /// tutor's ephemeral preview. Returns the identical PreviewResult shape
    /// AssessmentService.PreviewAsync does, so the frontend renders both the
    /// same way; this one is real and updates LessonProgress.
    /// </summary>
    public async Task<ProvisioningResult<PreviewResult>> SubmitAssessmentAsync(
        string slug, Guid caller, Guid lessonId, SubmitAnswersRequest request, CancellationToken ct = default)
    {
        var ctx = await ResolveAsync(slug, caller, ct);
        if (ctx.Error is not null) return Fail<PreviewResult>(ctx.Error.Value);

        var lesson = await db.Lessons.Include(l => l.Revisions).AsNoTracking()
            .FirstOrDefaultAsync(l => l.Id == lessonId && l.WorkspaceId == ctx.Workspace!.Id
                                    && l.Status == LessonStatus.Published, ct);
        if (lesson is null) return Fail<PreviewResult>((ProvisioningError.NotFound, "No such lesson."));

        var enrollment = await EnsureEnrolledAsync(ctx.Workspace!.Id, lesson.LearningProductId, ctx.MembershipId, ct);

        if (await IsLessonLockedAsync(lesson.LearningProductId, lessonId, enrollment.Id, ct))
            return Fail<PreviewResult>((ProvisioningError.Forbidden, "Complete the previous lesson first."));

        var progress = await EnsureProgressAsync(enrollment.Id, lessonId, lesson.CurrentRevisionId!.Value, ct);

        // Graded against the Assessment on the revision this progress is
        // pinned to (§20) — a learner mid-lesson on an older revision answers
        // that revision's questions, not whatever the tutor published since.
        var assessment = await db.Assessments.Include(a => a.Questions)
            .FirstOrDefaultAsync(a => a.LessonRevisionId == progress.LessonRevisionId && a.Status == AssessmentStatus.Published, ct);
        if (assessment is null || assessment.Questions.Count == 0)
            return Fail<PreviewResult>((ProvisioningError.Conflict, "This lesson has no questions to answer."));

        var submission = Submission.Start(assessment.Id, ctx.MembershipId, enrollment.Id);
        db.Submissions.Add(submission);

        var byQuestion = request.Answers.ToDictionary(a => a.QuestionId, a => new SubmittedAnswer(a.SelectedOptionIndex, a.TextAnswer));
        var perQuestion = submission.Grade(assessment, byQuestion);

        var pinnedRevision = lesson.Revisions.First(r => r.Id == progress.LessonRevisionId);
        var hasVideo = pinnedRevision.VideoAssetId is not null || pinnedRevision.VideoUrl is not null;
        progress.RecomputeCompletion(hasVideo, hasGradableAssessment: true, hasPassingSubmission: submission.Passed);

        await db.SaveChangesAsync(ct);

        var gradedCount = perQuestion.Count(q => q.Correct is not null);
        var correctCount = perQuestion.Count(q => q.Correct == true);
        var openCount = perQuestion.Count - gradedCount;
        var openNote = openCount > 0
            ? $" {openCount} open-ended response{(openCount == 1 ? "" : "s")} reviewed for participation, not scored."
            : "";
        var feedback = gradedCount == 0
            ? $"Every question here is open-ended, so this was reviewed for participation only — nothing to score.{openNote}"
            : (submission.Passed
                ? $"{correctCount} of {gradedCount} correct ({submission.ScorePercent}%) — at or above the {assessment.PassingThresholdPercent}% passing threshold.{openNote}"
                : $"{correctCount} of {gradedCount} correct ({submission.ScorePercent}%) — below the {assessment.PassingThresholdPercent}% passing threshold.{openNote}");

        return ProvisioningResult<PreviewResult>.Success(new PreviewResult(
            submission.ScorePercent, submission.Passed, assessment.PassingThresholdPercent, feedback,
            perQuestion.Select(q => new PreviewQuestionResult(q.QuestionId, q.Correct, q.CorrectAnswerDisplay)).ToList()));
    }

    private async Task<bool> HasPassingSubmissionAsync(Guid assessmentId, Guid membershipId, CancellationToken ct)
        => await db.Submissions.AsNoTracking()
            .AnyAsync(s => s.AssessmentId == assessmentId && s.MembershipId == membershipId && s.Passed, ct);

    /// <summary>
    /// Whether this lesson is locked under the curriculum's sequential-unlock
    /// setting — true only when that setting is on, this is not the first
    /// lesson in curriculum order, and the lesson immediately before it isn't
    /// Completed for this enrollment yet. A lesson the published curriculum
    /// doesn't place anywhere is never locked — there is no "previous lesson"
    /// to have finished. This is the actual enforcement; GetCurriculumAsync's
    /// per-lesson Locked flag is only a preview of it for the UI.
    /// </summary>
    private async Task<bool> IsLessonLockedAsync(Guid learningProductId, Guid lessonId, Guid enrollmentId, CancellationToken ct)
    {
        var curriculum = await db.Curricula.Include(c => c.Units).ThenInclude(u => u.Lessons).AsNoTracking()
            .FirstOrDefaultAsync(c => c.LearningProductId == learningProductId && c.Status == CurriculumStatus.Published, ct);
        if (curriculum is null || !curriculum.RequiresSequentialCompletion) return false;

        var orderedLessonIds = curriculum.Units.OrderBy(u => u.Position)
            .SelectMany(u => u.Lessons.OrderBy(l => l.Position))
            .Select(l => l.LessonId).ToList();

        var index = orderedLessonIds.IndexOf(lessonId);
        if (index <= 0) return false;

        var previousLessonId = orderedLessonIds[index - 1];
        var previousProgress = await db.LessonProgresses.AsNoTracking()
            .FirstOrDefaultAsync(p => p.EnrollmentId == enrollmentId && p.LessonId == previousLessonId, ct);

        return previousProgress?.Status != LessonProgressStatus.Completed;
    }

    // ── Plumbing ─────────────────────────────────────────────────────────────

    /// <summary>
    /// Auto-creation races: two near-simultaneous requests for the same
    /// (product, membership) — e.g. React re-firing an effect, or a learner
    /// opening the same course in two tabs — can both see "no enrollment yet"
    /// and both try to insert one. The unique index (LearningProductId,
    /// MembershipId) is what actually prevents the duplicate; this just
    /// means the loser of that race reads back the winner's row instead of
    /// surfacing a 500.
    /// </summary>
    private async Task<Enrollment> EnsureEnrolledAsync(Guid workspaceId, Guid learningProductId, Guid membershipId, CancellationToken ct)
    {
        var enrollment = await db.Enrollments
            .FirstOrDefaultAsync(e => e.LearningProductId == learningProductId && e.MembershipId == membershipId, ct);
        if (enrollment is not null) return enrollment;

        enrollment = Enrollment.Create(workspaceId, learningProductId, membershipId);
        db.Enrollments.Add(enrollment);
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex))
        {
            db.Entry(enrollment).State = EntityState.Detached;
            enrollment = await db.Enrollments
                .FirstAsync(e => e.LearningProductId == learningProductId && e.MembershipId == membershipId, ct);
        }
        return enrollment;
    }

    /// <summary>
    /// Same race, same fix, as <see cref="EnsureEnrolledAsync"/> — the unique
    /// index is (EnrollmentId, LessonId). <paramref name="currentRevisionId"/>
    /// is only used the first time: a brand-new row pins to whatever is
    /// current right now (Rule 17); an existing row already carries its own
    /// pin and this parameter is ignored (Rule 16/18).
    /// </summary>
    private async Task<LessonProgress> EnsureProgressAsync(
        Guid enrollmentId, Guid lessonId, Guid currentRevisionId, CancellationToken ct)
    {
        var progress = await db.LessonProgresses
            .FirstOrDefaultAsync(p => p.EnrollmentId == enrollmentId && p.LessonId == lessonId, ct);
        if (progress is not null) return progress;

        progress = LessonProgress.Start(enrollmentId, lessonId, currentRevisionId);
        db.LessonProgresses.Add(progress);
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex))
        {
            db.Entry(progress).State = EntityState.Detached;
            progress = await db.LessonProgresses
                .FirstAsync(p => p.EnrollmentId == enrollmentId && p.LessonId == lessonId, ct);
        }
        return progress;
    }

    private static bool IsUniqueViolation(DbUpdateException ex) =>
        ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation };

    private record Context(Workspace? Workspace, Guid MembershipId, (ProvisioningError Error, string Message)? Error);

    private async Task<Context> ResolveAsync(string slug, Guid caller, CancellationToken ct)
    {
        var normalised = slug.ToLowerInvariant().Trim();

        var workspace = await db.Workspaces.AsNoTracking().FirstOrDefaultAsync(w => w.Slug == normalised, ct);
        if (workspace is null) return new Context(null, Guid.Empty, (ProvisioningError.NotFound, "No such workspace."));

        var member = await db.Memberships.Include(m => m.Roles).AsNoTracking()
            .FirstOrDefaultAsync(m => m.WorkspaceId == workspace.Id && m.IdentityId == caller
                                   && m.Status == MembershipStatus.Active, ct);
        // Non-members get 404 so status codes cannot map which workspaces exist
        if (member is null) return new Context(null, Guid.Empty, (ProvisioningError.NotFound, "No such workspace."));

        if (!member.Roles.Any(r => r.Name == WorkspaceRoleName.Learner))
            return new Context(null, member.Id, (ProvisioningError.Forbidden, "Only a Learner in this workspace can access this."));

        return new Context(workspace, member.Id, null);
    }

    private static ProvisioningResult<T> Fail<T>((ProvisioningError Error, string Message) e)
        => ProvisioningResult<T>.Fail(e.Error, e.Message);
}
