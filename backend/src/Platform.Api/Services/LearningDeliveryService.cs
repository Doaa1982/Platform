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

        var completedLessonIds = await db.LessonProgresses.AsNoTracking()
            .Where(p => enrollmentIds.Contains(p.EnrollmentId) && p.Status == LessonProgressStatus.Completed)
            .Select(p => p.LessonId)
            .ToListAsync(ct);

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
        // half-watched hasn't been "spent" yet, it's still in progress.
        var timeInvestedMinutes = completedLessonIds.Count == 0 ? 0 :
            (await db.Lessons.Include(l => l.Revisions).AsNoTracking()
                .Where(l => completedLessonIds.Contains(l.Id))
                .ToListAsync(ct))
            .Sum(l => l.CurrentRevision?.EstimatedMinutes ?? 0);

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
                new LearnerCurriculumResponse(product.Id, product.Title, null, null, []));

        var lessonIds = curriculum.Units.SelectMany(u => u.Lessons).Select(l => l.LessonId).Distinct().ToList();
        var lessons = lessonIds.Count == 0
            ? new Dictionary<Guid, Lesson>()
            : await db.Lessons.Include(l => l.Revisions).AsNoTracking()
                .Where(l => lessonIds.Contains(l.Id) && l.Status == LessonStatus.Published)
                .ToDictionaryAsync(l => l.Id, ct);

        var progress = await db.LessonProgresses.AsNoTracking()
            .Where(p => p.EnrollmentId == enrollment.Id).ToDictionaryAsync(p => p.LessonId, ct);

        var units = curriculum.Units.OrderBy(u => u.Position)
            .Select(u => new LearnerUnitRow(
                u.Title, u.Position,
                u.Lessons.OrderBy(l => l.Position)
                    .Where(l => lessons.ContainsKey(l.LessonId))
                    .Select(l => lessons[l.LessonId])
                    .Select(lesson => new LearnerLessonRow(
                        lesson.Id, lesson.Title, lesson.CurrentRevision?.EstimatedMinutes,
                        progress.TryGetValue(lesson.Id, out var pr) ? pr.Status.ToString() : "NotStarted"))
                    .ToList()))
            .Where(u => u.Lessons.Count > 0)
            .ToList();

        return ProvisioningResult<LearnerCurriculumResponse>.Success(
            new LearnerCurriculumResponse(product.Id, product.Title, curriculum.Id, curriculum.Title, units));
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

        var revision = lesson.CurrentRevision!;

        var enrollment = await EnsureEnrolledAsync(ctx.Workspace!.Id, lesson.LearningProductId, ctx.MembershipId, ct);
        var progress = await EnsureProgressAsync(enrollment.Id, lessonId, ct);

        LearningAssetResponse? video = null;
        if (revision.VideoAssetId is { } videoId)
        {
            var asset = await db.LearningAssets.AsNoTracking().FirstOrDefaultAsync(a => a.Id == videoId, ct);
            if (asset is not null) video = LearningAssetService.Describe(asset);
        }

        var assessment = await db.Assessments.Include(a => a.Questions).AsNoTracking()
            .FirstOrDefaultAsync(a => a.LessonRevisionId == lesson.CurrentRevisionId && a.Status == AssessmentStatus.Published, ct);

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
        var progress = await EnsureProgressAsync(enrollment.Id, lessonId, ct);

        var assessment = await db.Assessments.Include(a => a.Questions).AsNoTracking()
            .FirstOrDefaultAsync(a => a.LessonRevisionId == lesson.CurrentRevisionId && a.Status == AssessmentStatus.Published, ct);
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

        var assessment = await db.Assessments.Include(a => a.Questions)
            .FirstOrDefaultAsync(a => a.LessonRevisionId == lesson.CurrentRevisionId && a.Status == AssessmentStatus.Published, ct);
        if (assessment is null || assessment.Questions.Count == 0)
            return Fail<PreviewResult>((ProvisioningError.Conflict, "This lesson has no questions to answer."));

        var enrollment = await EnsureEnrolledAsync(ctx.Workspace!.Id, lesson.LearningProductId, ctx.MembershipId, ct);
        var progress = await EnsureProgressAsync(enrollment.Id, lessonId, ct);

        var submission = Submission.Start(assessment.Id, ctx.MembershipId, enrollment.Id);
        db.Submissions.Add(submission);

        var byQuestion = request.Answers.ToDictionary(a => a.QuestionId, a => new SubmittedAnswer(a.SelectedOptionIndex, a.TextAnswer));
        var perQuestion = submission.Grade(assessment, byQuestion);

        var hasVideo = lesson.CurrentRevision!.VideoAssetId is not null || lesson.CurrentRevision!.VideoUrl is not null;
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

    /// <summary>Same race, same fix, as <see cref="EnsureEnrolledAsync"/> — the unique index is (EnrollmentId, LessonId).</summary>
    private async Task<LessonProgress> EnsureProgressAsync(Guid enrollmentId, Guid lessonId, CancellationToken ct)
    {
        var progress = await db.LessonProgresses
            .FirstOrDefaultAsync(p => p.EnrollmentId == enrollmentId && p.LessonId == lessonId, ct);
        if (progress is not null) return progress;

        progress = LessonProgress.Start(enrollmentId, lessonId);
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
