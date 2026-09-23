using Microsoft.EntityFrameworkCore;
using Platform.Api.Models;
using Platform.Domain;
using Platform.Infrastructure;

namespace Platform.Api.Services;

/// <summary>
/// Assignment — delivering one Learning Activity to learners: targeting
/// (always every active Enrollment in v1, INV-004 — no stored subset),
/// scheduling, attempt policy, and evaluation of the resulting Submissions.
///
/// Recipients are never stored (Assignment Aggregate Design INV-004) — every
/// method that needs "who is targeted" resolves it live from Enrollment via
/// <see cref="GetRecipientMembershipIdsAsync"/>. Assignment's own date-driven
/// state transitions (Scheduled→Published→Active→Closed) have no background
/// job behind them — <see cref="Assignment.PromoteIfDue"/> is called at the
/// top of every read/mutate path here, the same lazy-promotion pattern
/// already used elsewhere in this codebase (e.g. Invitation expiry).
/// </summary>
public class AssignmentService(PlatformDbContext db, LearnerAccess learnerAccess)
{
    private static readonly WorkspaceRoleName[] AuthorRoles =
        [WorkspaceRoleName.Owner, WorkspaceRoleName.Administrator, WorkspaceRoleName.Teacher];

    // ── Tutor: single assignment lifecycle ──────────────────────────────────

    public async Task<ProvisioningResult<AssignmentResponse>> GetAsync(
        string slug, Guid caller, Guid lessonId, Guid activityId, CancellationToken ct = default)
    {
        var ctx = await ResolveActivityAsync(slug, caller, lessonId, activityId, requireAuthor: false, ct);
        if (ctx.Error is not null) return Fail<AssignmentResponse>(ctx.Error.Value);

        var assignment = await db.Assignments.FirstOrDefaultAsync(a => a.LearningActivityId == activityId, ct);
        if (assignment is null) return Fail<AssignmentResponse>((ProvisioningError.NotFound, "This learning activity has no assignment yet."));

        if (assignment.PromoteIfDue(DateTime.UtcNow)) await db.SaveChangesAsync(ct);
        return ProvisioningResult<AssignmentResponse>.Success(Describe(assignment));
    }

    /// <summary>INV-001/INV-002 — one Assignment per Learning Activity, created empty (Draft) then configured.</summary>
    public async Task<ProvisioningResult<AssignmentResponse>> CreateAssignmentAsync(
        string slug, Guid caller, Guid lessonId, Guid activityId, CancellationToken ct = default)
    {
        var ctx = await ResolveActivityAsync(slug, caller, lessonId, activityId, requireAuthor: true, ct);
        if (ctx.Error is not null) return Fail<AssignmentResponse>(ctx.Error.Value);

        if (await db.Assignments.AnyAsync(a => a.LearningActivityId == activityId, ct))
            return Fail<AssignmentResponse>((ProvisioningError.Conflict, "This learning activity already has an assignment."));

        var assignment = Assignment.Create(ctx.Workspace!.Id, activityId, ctx.LearningProductId, ctx.MembershipId);
        db.Assignments.Add(assignment);
        await db.SaveChangesAsync(ct);
        return ProvisioningResult<AssignmentResponse>.Success(Describe(assignment));
    }

    public Task<ProvisioningResult<AssignmentResponse>> ConfigureAssignmentAsync(
        string slug, Guid caller, Guid lessonId, Guid activityId, ConfigureAssignmentRequest request, CancellationToken ct = default)
        => MutateAsync(slug, caller, lessonId, activityId, a => a.Configure(
            ParseAvailability(request.AvailabilityMode), request.ScheduledAvailabilityAt,
            ParseDueDateMode(request.DueDateMode), request.DueAt,
            request.SubmissionWindowStartAt, request.SubmissionWindowEndAt,
            ParseAttemptMode(request.AttemptMode), request.MaxAttempts,
            ParseEvaluationMethod(request.EvaluationMethod), request.NotifyOnPublish, request.NotifyOnFeedbackPublished), ct);

    /// <summary>INV-003 — publication is blocked until Configure() has run. Notifies every recipient only when this call itself lands the assignment on Published/Active (a Scheduled assignment's later lazy promotion is not separately notified — no background job exists to catch that moment).</summary>
    public async Task<ProvisioningResult<AssignmentResponse>> PublishAssignmentAsync(
        string slug, Guid caller, Guid lessonId, Guid activityId, CancellationToken ct = default)
    {
        var ctx = await ResolveActivityAsync(slug, caller, lessonId, activityId, requireAuthor: true, ct);
        if (ctx.Error is not null) return Fail<AssignmentResponse>(ctx.Error.Value);

        var assignment = await db.Assignments.FirstOrDefaultAsync(a => a.LearningActivityId == activityId, ct);
        if (assignment is null) return Fail<AssignmentResponse>((ProvisioningError.NotFound, "This learning activity has no assignment yet."));

        // Learning Activity BA §8 / Assignment Aggregate Design §8: a
        // Learning Activity has no independent publication lifecycle — it is
        // published only as part of its owning Lesson Revision. Without this
        // check, an Assignment could be published and delivered to every
        // enrolled learner against an activity whose Lesson Revision was
        // never published at all (still sitting in an unfinished Draft the
        // tutor hasn't shared with anyone). Superseded is fine — that
        // revision genuinely was published once; only Draft is blocked.
        var revisionStatus = await db.Set<LessonRevision>().AsNoTracking()
            .Where(r => r.Id == ctx.Activity!.LessonRevisionId)
            .Select(r => r.Status).FirstOrDefaultAsync(ct);
        if (revisionStatus == LessonRevisionStatus.Draft)
            return Fail<AssignmentResponse>((ProvisioningError.Conflict,
                "This activity's lesson has not been published yet. Publish the lesson revision before assigning it."));

        var now = DateTime.UtcNow;
        assignment.PromoteIfDue(now);
        try { assignment.Publish(now); }
        catch (InvalidOperationException ex) { return Fail<AssignmentResponse>((ProvisioningError.Conflict, ex.Message)); }

        if (assignment.NotifyOnPublish && assignment.Status is AssignmentStatus.Published or AssignmentStatus.Active)
            await NotifyAssignmentPublishedAsync(assignment, lessonId, ctx.Activity!.Title, ct);

        await db.SaveChangesAsync(ct);
        return ProvisioningResult<AssignmentResponse>.Success(Describe(assignment));
    }

    public Task<ProvisioningResult<AssignmentResponse>> CloseAssignmentAsync(
        string slug, Guid caller, Guid lessonId, Guid activityId, CancellationToken ct = default)
        => MutateAsync(slug, caller, lessonId, activityId, a => a.Close(DateTime.UtcNow), ct);

    public Task<ProvisioningResult<AssignmentResponse>> ArchiveAssignmentAsync(
        string slug, Guid caller, Guid lessonId, Guid activityId, CancellationToken ct = default)
        => MutateAsync(slug, caller, lessonId, activityId, a => a.Archive(), ct);

    /// <summary>BA-007 — a due date may only move later.</summary>
    public Task<ProvisioningResult<AssignmentResponse>> ExtendDueDateAsync(
        string slug, Guid caller, Guid lessonId, Guid activityId, DateTime newDueAt, CancellationToken ct = default)
        => MutateAsync(slug, caller, lessonId, activityId, a => a.ExtendDueDate(newDueAt), ct);

    public Task<ProvisioningResult<AssignmentResponse>> ChangeVisibilityAsync(
        string slug, Guid caller, Guid lessonId, Guid activityId, bool visible, CancellationToken ct = default)
        => MutateAsync(slug, caller, lessonId, activityId, a => a.ChangeVisibility(visible), ct);

    /// <summary>INV-006 — the cross-aggregate check: the highest non-excluded attempt number any one learner has used against this Assignment, computed here (Assignment itself has no visibility into Submission).</summary>
    public async Task<ProvisioningResult<AssignmentResponse>> ChangeAttemptLimitAsync(
        string slug, Guid caller, Guid lessonId, Guid activityId, int newMaxAttempts, CancellationToken ct = default)
    {
        var ctx = await ResolveActivityAsync(slug, caller, lessonId, activityId, requireAuthor: true, ct);
        if (ctx.Error is not null) return Fail<AssignmentResponse>(ctx.Error.Value);

        var assignment = await db.Assignments.FirstOrDefaultAsync(a => a.LearningActivityId == activityId, ct);
        if (assignment is null) return Fail<AssignmentResponse>((ProvisioningError.NotFound, "This learning activity has no assignment yet."));

        var maxUsed = await db.Submissions.AsNoTracking()
            .Where(s => s.AssignmentId == assignment.Id && !s.ExcludedFromAttemptCount)
            .Select(s => (int?)s.AttemptNumber).MaxAsync(ct) ?? 0;

        assignment.PromoteIfDue(DateTime.UtcNow);
        try { assignment.ChangeAttemptLimit(newMaxAttempts, maxUsed); }
        catch (InvalidOperationException ex) { return Fail<AssignmentResponse>((ProvisioningError.Conflict, ex.Message)); }
        catch (ArgumentException ex) { return Fail<AssignmentResponse>((ProvisioningError.Invalid, ex.Message)); }

        await db.SaveChangesAsync(ct);
        return ProvisioningResult<AssignmentResponse>.Success(Describe(assignment));
    }

    /// <summary>BA-011 — the target learner's prior attempts are kept as history (ExcludeFromAttemptCount) rather than deleted, but no longer count toward their limit.</summary>
    public async Task<ProvisioningResult<AssignmentResponse>> ResetAttemptCountAsync(
        string slug, Guid caller, Guid lessonId, Guid activityId, Guid targetMembershipId, CancellationToken ct = default)
    {
        var ctx = await ResolveActivityAsync(slug, caller, lessonId, activityId, requireAuthor: true, ct);
        if (ctx.Error is not null) return Fail<AssignmentResponse>(ctx.Error.Value);

        var assignment = await db.Assignments.FirstOrDefaultAsync(a => a.LearningActivityId == activityId, ct);
        if (assignment is null) return Fail<AssignmentResponse>((ProvisioningError.NotFound, "This learning activity has no assignment yet."));

        var submissions = await db.Submissions
            .Where(s => s.AssignmentId == assignment.Id && s.MembershipId == targetMembershipId && !s.ExcludedFromAttemptCount)
            .ToListAsync(ct);
        foreach (var s in submissions) s.ExcludeFromAttemptCount();

        await db.SaveChangesAsync(ct);
        return ProvisioningResult<AssignmentResponse>.Success(Describe(assignment));
    }

    // ── Tutor: dashboard & grading ───────────────────────────────────────────

    public async Task<ProvisioningResult<AssignmentOverviewResponse>> GetOverviewAsync(
        string slug, Guid caller, CancellationToken ct = default)
    {
        var wctx = await ResolveWorkspaceAsync(slug, caller, requireAuthor: true, ct);
        if (wctx.Error is not null) return Fail<AssignmentOverviewResponse>(wctx.Error.Value);

        var assignments = await db.Assignments.Where(a => a.WorkspaceId == wctx.Workspace!.Id).ToListAsync(ct);
        if (assignments.Count == 0) return ProvisioningResult<AssignmentOverviewResponse>.Success(new AssignmentOverviewResponse([]));

        var now = DateTime.UtcNow;
        var changed = false;
        foreach (var a in assignments) changed |= a.PromoteIfDue(now);
        if (changed) await db.SaveChangesAsync(ct);

        var activityContexts = await LoadActivityContextsAsync(assignments.Select(a => a.LearningActivityId).ToList(), ct);

        var productIds = assignments.Select(a => a.LearningProductId).Distinct().ToList();
        var recipientCounts = await db.Enrollments.AsNoTracking()
            .Where(e => productIds.Contains(e.LearningProductId) && e.Status == EnrollmentStatus.Active)
            .GroupBy(e => e.LearningProductId)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(g => g.Key, g => g.Count, ct);

        var assignmentIds = assignments.Select(a => a.Id).ToList();
        var submittedCounts = await db.Submissions.AsNoTracking()
            .Where(s => s.AssignmentId != null && assignmentIds.Contains(s.AssignmentId.Value))
            .GroupBy(s => s.AssignmentId!.Value)
            .Select(g => new { g.Key, Count = g.Select(s => s.MembershipId).Distinct().Count() })
            .ToDictionaryAsync(g => g.Key, g => g.Count, ct);

        var rows = new List<AssignmentOverviewRow>();
        foreach (var a in assignments)
        {
            if (!activityContexts.TryGetValue(a.LearningActivityId, out var actx)) continue;
            rows.Add(new AssignmentOverviewRow(
                a.Id, a.LearningActivityId, actx.ActivityTitle, actx.ActivityType,
                actx.LessonId, actx.LessonTitle, actx.ProductId, actx.ProductTitle,
                a.Status.ToString(), a.DueAt,
                recipientCounts.GetValueOrDefault(a.LearningProductId), submittedCounts.GetValueOrDefault(a.Id)));
        }

        return ProvisioningResult<AssignmentOverviewResponse>.Success(new AssignmentOverviewResponse(
            rows.OrderBy(r => r.ProductTitle).ThenBy(r => r.LessonTitle).ThenBy(r => r.ActivityTitle).ToList()));
    }

    public async Task<ProvisioningResult<AssignmentSubmissionsResponse>> GetSubmissionsAsync(
        string slug, Guid caller, Guid lessonId, Guid activityId, CancellationToken ct = default)
    {
        var ctx = await ResolveActivityAsync(slug, caller, lessonId, activityId, requireAuthor: true, ct);
        if (ctx.Error is not null) return Fail<AssignmentSubmissionsResponse>(ctx.Error.Value);

        var assignment = await db.Assignments.FirstOrDefaultAsync(a => a.LearningActivityId == activityId, ct);
        if (assignment is null) return Fail<AssignmentSubmissionsResponse>((ProvisioningError.NotFound, "This learning activity has no assignment yet."));

        if (assignment.PromoteIfDue(DateTime.UtcNow)) await db.SaveChangesAsync(ct);

        var recipientMembershipIds = await GetRecipientMembershipIdsAsync(assignment.LearningProductId, ct);
        var memberships = recipientMembershipIds.Count == 0 ? [] : await db.Memberships.AsNoTracking()
            .Where(m => recipientMembershipIds.Contains(m.Id)).ToListAsync(ct);
        var identityIds = memberships.Select(m => m.IdentityId).ToList();
        var identities = identityIds.Count == 0 ? new Dictionary<Guid, Identity>() : await db.Identities.AsNoTracking()
            .Where(i => identityIds.Contains(i.Id)).ToDictionaryAsync(i => i.Id, ct);

        var submissions = await db.Submissions.AsNoTracking().Where(s => s.AssignmentId == assignment.Id).ToListAsync(ct);
        var latestByMembership = submissions.GroupBy(s => s.MembershipId)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(s => s.StartedAt).First());

        var rows = memberships.Select(m =>
        {
            var identity = identities.GetValueOrDefault(m.IdentityId);
            latestByMembership.TryGetValue(m.Id, out var s);
            return new AssignmentSubmissionRow(
                m.Id, identity?.FullName ?? "(unknown)", identity?.Email ?? "(unknown)",
                s?.Id, s?.Status.ToString() ?? "NotStarted", s?.AttemptNumber ?? 0,
                s?.ResponseText, s?.ResponseLearningAssetId, s?.Feedback, s?.AssignmentPassed, s?.EvaluatedAt, s?.StartedAt);
        }).OrderBy(r => r.FullName).ToList();

        return ProvisioningResult<AssignmentSubmissionsResponse>.Success(new AssignmentSubmissionsResponse(Describe(assignment), rows));
    }

    public async Task<ProvisioningResult<AssignmentSubmissionRow>> BeginReviewAsync(
        string slug, Guid caller, Guid lessonId, Guid activityId, Guid submissionId, CancellationToken ct = default)
    {
        var ctx = await ResolveActivityAsync(slug, caller, lessonId, activityId, requireAuthor: true, ct);
        if (ctx.Error is not null) return Fail<AssignmentSubmissionRow>(ctx.Error.Value);

        var assignment = await db.Assignments.FirstOrDefaultAsync(a => a.LearningActivityId == activityId, ct);
        if (assignment is null) return Fail<AssignmentSubmissionRow>((ProvisioningError.NotFound, "This learning activity has no assignment yet."));

        var submission = await db.Submissions.FirstOrDefaultAsync(s => s.Id == submissionId && s.AssignmentId == assignment.Id, ct);
        if (submission is null) return Fail<AssignmentSubmissionRow>((ProvisioningError.NotFound, "No such submission."));

        try { submission.BeginReview(); }
        catch (InvalidOperationException ex) { return Fail<AssignmentSubmissionRow>((ProvisioningError.Conflict, ex.Message)); }

        await db.SaveChangesAsync(ct);
        return ProvisioningResult<AssignmentSubmissionRow>.Success(await DescribeSubmissionRowAsync(submission, ct));
    }

    /// <summary>INV-004/INV-005 — only from Submitted/UnderReview, and only once (a fresh Evaluation cannot overwrite Result Issued). Notifies the learner when configured.</summary>
    public async Task<ProvisioningResult<AssignmentSubmissionRow>> EvaluateSubmissionAsync(
        string slug, Guid caller, Guid lessonId, Guid activityId, Guid submissionId, EvaluateSubmissionRequest request, CancellationToken ct = default)
    {
        var ctx = await ResolveActivityAsync(slug, caller, lessonId, activityId, requireAuthor: true, ct);
        if (ctx.Error is not null) return Fail<AssignmentSubmissionRow>(ctx.Error.Value);

        var assignment = await db.Assignments.FirstOrDefaultAsync(a => a.LearningActivityId == activityId, ct);
        if (assignment is null) return Fail<AssignmentSubmissionRow>((ProvisioningError.NotFound, "This learning activity has no assignment yet."));

        var submission = await db.Submissions.FirstOrDefaultAsync(s => s.Id == submissionId && s.AssignmentId == assignment.Id, ct);
        if (submission is null) return Fail<AssignmentSubmissionRow>((ProvisioningError.NotFound, "No such submission."));

        var method = ParseEvaluationMethod(request.EvaluationMethod ?? assignment.EvaluationMethod.ToString());
        try { submission.EvaluateAssignmentResponse(ctx.MembershipId, method, request.Passed, request.Feedback); }
        catch (InvalidOperationException ex) { return Fail<AssignmentSubmissionRow>((ProvisioningError.Conflict, ex.Message)); }

        if (assignment.NotifyOnFeedbackPublished)
            await NotifyFeedbackPublishedAsync(submission, assignment, lessonId, ctx.Activity!.Title, ct);

        await db.SaveChangesAsync(ct);
        return ProvisioningResult<AssignmentSubmissionRow>.Success(await DescribeSubmissionRowAsync(submission, ct));
    }

    // ── Learner ───────────────────────────────────────────────────────────────

    public async Task<ProvisioningResult<LearnerAssignmentListResponse>> GetMyAssignmentsAsync(
        string slug, Guid caller, CancellationToken ct = default)
    {
        var ctx = await ResolveLearnerAsync(slug, caller, ct);
        if (ctx.Error is not null) return Fail<LearnerAssignmentListResponse>(ctx.Error.Value);

        var myProductIds = await db.Enrollments.AsNoTracking()
            .Where(e => e.MembershipId == ctx.MembershipId && e.Status == EnrollmentStatus.Active)
            .Select(e => e.LearningProductId).ToListAsync(ct);
        if (myProductIds.Count == 0) return ProvisioningResult<LearnerAssignmentListResponse>.Success(new LearnerAssignmentListResponse([]));

        var assignments = await db.Assignments.Where(a => myProductIds.Contains(a.LearningProductId)).ToListAsync(ct);
        var now = DateTime.UtcNow;
        var changed = false;
        foreach (var a in assignments) changed |= a.PromoteIfDue(now);
        if (changed) await db.SaveChangesAsync(ct);

        // Locked (Draft/Scheduled) and invisible (ChangeVisibility) assignments never appear in a learner's own list.
        var visible = assignments.Where(a => a.Visible && a.Status is not (AssignmentStatus.Draft or AssignmentStatus.Scheduled or AssignmentStatus.Archived)).ToList();
        if (visible.Count == 0) return ProvisioningResult<LearnerAssignmentListResponse>.Success(new LearnerAssignmentListResponse([]));

        var activityContexts = await LoadActivityContextsAsync(visible.Select(a => a.LearningActivityId).ToList(), ct);

        var assignmentIds = visible.Select(a => a.Id).ToList();
        var mySubmissions = await db.Submissions.AsNoTracking()
            .Where(s => s.AssignmentId != null && assignmentIds.Contains(s.AssignmentId.Value) && s.MembershipId == ctx.MembershipId)
            .ToListAsync(ct);
        var latestByAssignment = mySubmissions.GroupBy(s => s.AssignmentId!.Value)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(s => s.StartedAt).First());

        var rows = new List<LearnerAssignmentRow>();
        foreach (var a in visible)
        {
            if (!activityContexts.TryGetValue(a.LearningActivityId, out var actx)) continue;
            latestByAssignment.TryGetValue(a.Id, out var sub);
            rows.Add(new LearnerAssignmentRow(
                a.Id, a.LearningActivityId, actx.ActivityTitle, actx.ActivityType,
                actx.LessonId, actx.LessonTitle, actx.ProductId, actx.ProductTitle,
                a.DueAt, ComputeLearnerStatus(a, sub), sub?.Id));
        }

        return ProvisioningResult<LearnerAssignmentListResponse>.Success(new LearnerAssignmentListResponse(
            rows.OrderBy(r => r.DueAt ?? DateTime.MaxValue).ThenBy(r => r.ProductTitle).ToList()));
    }

    public async Task<ProvisioningResult<LearnerAssignmentDetailResponse>> GetMyAssignmentAsync(
        string slug, Guid caller, Guid lessonId, Guid activityId, CancellationToken ct = default)
    {
        var ctx = await ResolveLearnerAsync(slug, caller, ct);
        if (ctx.Error is not null) return Fail<LearnerAssignmentDetailResponse>(ctx.Error.Value);

        // The assignment-visibility rule (exists in this workspace, learner actively enrolled,
        // not Draft/Scheduled/hidden) lives in LearnerAccess so Learning Asset access evaluates
        // the very same code rather than a copy of it.
        var access = await learnerAccess.EvaluateAssignmentAccessAsync(ctx.WorkspaceId, ctx.MembershipId, activityId, ct);
        if (access.Promoted) await db.SaveChangesAsync(ct);
        if (access.Denied is { } denied) return Fail<LearnerAssignmentDetailResponse>(denied);
        var assignment = access.Assignment!;

        var activity = await db.LearningActivities.AsNoTracking().FirstOrDefaultAsync(a => a.Id == activityId, ct);
        if (activity is null) return Fail<LearnerAssignmentDetailResponse>((ProvisioningError.NotFound, "No such learning activity."));

        var effectiveAssessmentId = await ResolveEffectiveAssessmentIdAsync(activity, ct);

        // An archived file is never available to a learner (LearningAssetAccessPolicy), so the page stops offering it.
        var activityFileAssetId = activity.ActivityFileAssetId;
        if (activityFileAssetId is { } fileId
            && !await db.LearningAssets.AsNoTracking().AnyAsync(a => a.Id == fileId && a.Status != LearningAssetStatus.Archived, ct))
            activityFileAssetId = null;

        // Ordered by StartedAt, not AttemptNumber: ResetAttemptCountAsync
        // excludes a submission from the attempt count rather than
        // renumbering it, so a fresh attempt started after a reset can
        // legitimately reuse attempt number 1 — AttemptNumber alone is not
        // a reliable recency signal once that happens, and this list's
        // first element is what the caller treats as "the current attempt".
        var submissions = await db.Submissions.AsNoTracking()
            .Where(s => s.AssignmentId == assignment.Id && s.MembershipId == ctx.MembershipId)
            .OrderByDescending(s => s.StartedAt).ToListAsync(ct);

        return ProvisioningResult<LearnerAssignmentDetailResponse>.Success(new LearnerAssignmentDetailResponse(
            Describe(assignment), DescribeActivityForLearner(activity, effectiveAssessmentId, activityFileAssetId), submissions.Select(DescribeLearnerSubmission).ToList()));
    }

    /// <summary>INV-007/INV-002/INV-003. Resumes an already-in-progress attempt instead of starting a second one.</summary>
    public async Task<ProvisioningResult<LearnerSubmissionRow>> StartSubmissionAsync(
        string slug, Guid caller, Guid lessonId, Guid activityId, CancellationToken ct = default)
    {
        var ctx = await ResolveLearnerAsync(slug, caller, ct);
        if (ctx.Error is not null) return Fail<LearnerSubmissionRow>(ctx.Error.Value);

        // Same defense-in-depth WorkspaceId check as GetMyAssignmentAsync.
        var assignment = await db.Assignments
            .FirstOrDefaultAsync(a => a.LearningActivityId == activityId && a.WorkspaceId == ctx.WorkspaceId, ct);
        if (assignment is null) return Fail<LearnerSubmissionRow>((ProvisioningError.NotFound, "No such assignment."));

        var enrollment = await db.Enrollments
            .FirstOrDefaultAsync(e => e.LearningProductId == assignment.LearningProductId && e.MembershipId == ctx.MembershipId && e.Status == EnrollmentStatus.Active, ct);
        if (enrollment is null) return Fail<LearnerSubmissionRow>((ProvisioningError.Forbidden, "You are not enrolled in this course."));

        assignment.PromoteIfDue(DateTime.UtcNow);
        if (assignment.Status is not (AssignmentStatus.Published or AssignmentStatus.Active))
            return Fail<LearnerSubmissionRow>((ProvisioningError.Conflict, "This assignment isn't open for submissions right now."));

        var inProgress = await db.Submissions
            .FirstOrDefaultAsync(s => s.AssignmentId == assignment.Id && s.MembershipId == ctx.MembershipId && s.Status == SubmissionStatus.InProgress, ct);
        if (inProgress is not null)
        {
            await db.SaveChangesAsync(ct);
            return ProvisioningResult<LearnerSubmissionRow>.Success(DescribeLearnerSubmission(inProgress));
        }

        var priorAttempts = await db.Submissions.AsNoTracking()
            .Where(s => s.AssignmentId == assignment.Id && s.MembershipId == ctx.MembershipId && !s.ExcludedFromAttemptCount)
            .CountAsync(ct);
        if (assignment.MaxAttempts is { } max && priorAttempts >= max)
            return Fail<LearnerSubmissionRow>((ProvisioningError.Conflict, $"You've used all {max} attempt(s) allowed for this assignment."));

        Submission submission;
        try { submission = Submission.StartForAssignment(assignment.Id, ctx.MembershipId, enrollment.Id, priorAttempts + 1); }
        catch (ArgumentException ex) { return Fail<LearnerSubmissionRow>((ProvisioningError.Invalid, ex.Message)); }

        db.Submissions.Add(submission);
        await db.SaveChangesAsync(ct);
        return ProvisioningResult<LearnerSubmissionRow>.Success(DescribeLearnerSubmission(submission));
    }

    public async Task<ProvisioningResult<LearnerSubmissionRow>> RecordResponseAsync(
        string slug, Guid caller, Guid lessonId, Guid activityId, Guid submissionId, RecordAssignmentResponseRequest request, CancellationToken ct = default)
    {
        var ctx = await ResolveLearnerAsync(slug, caller, ct);
        if (ctx.Error is not null) return Fail<LearnerSubmissionRow>(ctx.Error.Value);

        var submission = await db.Submissions.FirstOrDefaultAsync(s => s.Id == submissionId && s.MembershipId == ctx.MembershipId, ct);
        if (submission is null) return Fail<LearnerSubmissionRow>((ProvisioningError.NotFound, "No such submission."));

        var activity = await db.LearningActivities.AsNoTracking().FirstOrDefaultAsync(a => a.Id == activityId, ct);
        if (activity is null) return Fail<LearnerSubmissionRow>((ProvisioningError.NotFound, "No such learning activity."));

        try { submission.RecordResponse(request.Text, request.AttachedLearningAssetId, activity.SubmissionMode); }
        catch (InvalidOperationException ex) { return Fail<LearnerSubmissionRow>((ProvisioningError.Conflict, ex.Message)); }
        catch (ArgumentException ex) { return Fail<LearnerSubmissionRow>((ProvisioningError.Invalid, ex.Message)); }

        await db.SaveChangesAsync(ct);
        return ProvisioningResult<LearnerSubmissionRow>.Success(DescribeLearnerSubmission(submission));
    }

    // ── Student-facing status (Assignment BA §11 — computed, never stored) ────

    private static string ComputeLearnerStatus(Assignment a, Submission? sub)
    {
        if (sub is null) return a.Status == AssignmentStatus.Closed ? "Overdue" : "Available";
        return sub.Status switch
        {
            SubmissionStatus.InProgress => "InProgress",
            SubmissionStatus.Submitted => "Submitted",
            SubmissionStatus.UnderReview => "UnderReview",
            SubmissionStatus.Evaluated => "Completed",
            _ => "Available"
        };
    }

    // ── Recipient resolution (INV-004 — always live, never stored) ───────────

    private async Task<List<Guid>> GetRecipientMembershipIdsAsync(Guid learningProductId, CancellationToken ct) =>
        await db.Enrollments.AsNoTracking()
            .Where(e => e.LearningProductId == learningProductId && e.Status == EnrollmentStatus.Active)
            .Select(e => e.MembershipId).ToListAsync(ct);

    private Task<bool> IsActivelyEnrolledAsync(Guid learningProductId, Guid membershipId, CancellationToken ct) =>
        learnerAccess.IsActivelyEnrolledAsync(learningProductId, membershipId, ct);

    // ── Notifications (reuses the existing minimal Notification entity — same calling convention as AssessmentService.NotifyQuestionsUpdatedAsync) ──

    private async Task NotifyAssignmentPublishedAsync(Assignment assignment, Guid lessonId, string activityTitle, CancellationToken ct)
    {
        var recipientIds = await GetRecipientMembershipIdsAsync(assignment.LearningProductId, ct);
        foreach (var membershipId in recipientIds)
            db.Notifications.Add(Notification.Create(
                assignment.WorkspaceId, membershipId, NotificationKind.AssignmentPublished, lessonId,
                "New assignment", $"\"{activityTitle}\" has been assigned to you.", assignment.Id));
    }

    private Task NotifyFeedbackPublishedAsync(Submission submission, Assignment assignment, Guid lessonId, string activityTitle, CancellationToken ct)
    {
        db.Notifications.Add(Notification.Create(
            assignment.WorkspaceId, submission.MembershipId, NotificationKind.AssignmentFeedbackPublished, lessonId,
            "Feedback published", $"Your submission for \"{activityTitle}\" has been evaluated.", assignment.Id));
        return Task.CompletedTask;
    }

    // ── Describe (entity → DTO) ──────────────────────────────────────────────

    private static AssignmentResponse Describe(Assignment a) => new(
        a.Id, a.LearningActivityId, a.LearningProductId, a.Status.ToString(),
        a.AvailabilityMode.ToString(), a.ScheduledAvailabilityAt,
        a.DueDateMode.ToString(), a.DueAt,
        a.SubmissionWindowStartAt, a.SubmissionWindowEndAt,
        a.AttemptMode.ToString(), a.MaxAttempts,
        a.EvaluationMethod.ToString(), a.Visible, a.NotifyOnPublish, a.NotifyOnFeedbackPublished,
        a.Configured,
        a.CreatedAt, a.UpdatedAt, a.PublishedAt, a.ClosedAt, a.ArchivedAt,
        a.PublicationBlocker());

    private static LearningActivityForLearnerResponse DescribeActivityForLearner(
        LearningActivity a, Guid? effectiveAssessmentId, Guid? activityFileAssetId) =>
        new(a.Id, a.Type.ToString(), a.Title, a.Instructions, effectiveAssessmentId, a.ExternalUrl, activityFileAssetId, a.SubmissionMode.ToString());

    /// <summary>
    /// A Quiz/QuestionSet Learning Activity delivers its own Lesson
    /// Revision's Standalone Assessment — resolved live rather than trusted
    /// from LearningActivity.AssessmentId, since there is no UI for a tutor
    /// to hand-pick/relink it (matches ContentStudioService.GetLessonAsync's
    /// identical resolution for the tutor-facing Activities list).
    /// </summary>
    private async Task<Guid?> ResolveEffectiveAssessmentIdAsync(LearningActivity activity, CancellationToken ct)
    {
        if (activity.Type is not (LearningActivityType.Quiz or LearningActivityType.QuestionSet)) return null;
        return await db.Assessments.AsNoTracking()
            .Where(a => a.LessonRevisionId == activity.LessonRevisionId && a.Kind == AssessmentKind.Standalone)
            .Select(a => (Guid?)a.Id).FirstOrDefaultAsync(ct);
    }

    private static LearnerSubmissionRow DescribeLearnerSubmission(Submission s) => new(
        s.Id, s.AttemptNumber, s.Status.ToString(), s.ResponseText, s.ResponseLearningAssetId,
        s.StartedAt, s.EvaluatedAt, s.AssignmentPassed, s.Feedback);

    private async Task<AssignmentSubmissionRow> DescribeSubmissionRowAsync(Submission s, CancellationToken ct)
    {
        var membership = await db.Memberships.AsNoTracking().FirstOrDefaultAsync(m => m.Id == s.MembershipId, ct);
        var identity = membership is null ? null : await db.Identities.AsNoTracking().FirstOrDefaultAsync(i => i.Id == membership.IdentityId, ct);
        return new AssignmentSubmissionRow(
            s.MembershipId, identity?.FullName ?? "(unknown)", identity?.Email ?? "(unknown)",
            s.Id, s.Status.ToString(), s.AttemptNumber,
            s.ResponseText, s.ResponseLearningAssetId, s.Feedback, s.AssignmentPassed, s.EvaluatedAt, s.StartedAt);
    }

    private record ActivityContextRow(Guid ActivityId, string ActivityTitle, string ActivityType, Guid LessonId, string LessonTitle, Guid ProductId, string ProductTitle);

    /// <summary>Batch-resolves LearningActivity → owning Lesson/Product titles, for dashboard-shaped listings (tutor overview, learner list) — the join chain is LearningActivity.LessonRevisionId → LessonRevision.LessonId → Lesson.LearningProductId.</summary>
    private async Task<Dictionary<Guid, ActivityContextRow>> LoadActivityContextsAsync(IReadOnlyCollection<Guid> activityIds, CancellationToken ct)
    {
        if (activityIds.Count == 0) return [];

        var activities = await db.LearningActivities.AsNoTracking().Where(a => activityIds.Contains(a.Id)).ToListAsync(ct);
        var revisionIds = activities.Select(a => a.LessonRevisionId).Distinct().ToList();
        var revisions = await db.Set<LessonRevision>().AsNoTracking().Where(r => revisionIds.Contains(r.Id)).ToDictionaryAsync(r => r.Id, ct);
        var lessonIds = revisions.Values.Select(r => r.LessonId).Distinct().ToList();
        var lessons = await db.Lessons.AsNoTracking().Where(l => lessonIds.Contains(l.Id)).ToDictionaryAsync(l => l.Id, ct);
        var productIds = lessons.Values.Select(l => l.LearningProductId).Distinct().ToList();
        var products = await db.LearningProducts.AsNoTracking().Where(p => productIds.Contains(p.Id)).ToDictionaryAsync(p => p.Id, ct);

        var result = new Dictionary<Guid, ActivityContextRow>();
        foreach (var a in activities)
        {
            if (!revisions.TryGetValue(a.LessonRevisionId, out var revision)) continue;
            if (!lessons.TryGetValue(revision.LessonId, out var lesson)) continue;
            var product = products.GetValueOrDefault(lesson.LearningProductId);
            result[a.Id] = new ActivityContextRow(a.Id, a.Title, a.Type.ToString(), lesson.Id, lesson.Title, lesson.LearningProductId, product?.Title ?? "(unknown product)");
        }
        return result;
    }

    // ── Parsing ───────────────────────────────────────────────────────────────

    private static AssignmentAvailabilityMode ParseAvailability(string v) =>
        Enum.TryParse<AssignmentAvailabilityMode>(v, ignoreCase: true, out var parsed) ? parsed : AssignmentAvailabilityMode.Immediate;
    private static AssignmentDueDateMode ParseDueDateMode(string v) =>
        Enum.TryParse<AssignmentDueDateMode>(v, ignoreCase: true, out var parsed) ? parsed : AssignmentDueDateMode.None;
    private static AssignmentAttemptMode ParseAttemptMode(string v) =>
        Enum.TryParse<AssignmentAttemptMode>(v, ignoreCase: true, out var parsed) ? parsed : AssignmentAttemptMode.Single;
    private static AssignmentEvaluationMethod ParseEvaluationMethod(string v) =>
        Enum.TryParse<AssignmentEvaluationMethod>(v, ignoreCase: true, out var parsed) ? parsed : AssignmentEvaluationMethod.Manual;

    // ── Mutation helper (tutor, single-Assignment operational edits) ─────────

    private async Task<ProvisioningResult<AssignmentResponse>> MutateAsync(
        string slug, Guid caller, Guid lessonId, Guid activityId, Action<Assignment> mutate, CancellationToken ct)
    {
        var ctx = await ResolveActivityAsync(slug, caller, lessonId, activityId, requireAuthor: true, ct);
        if (ctx.Error is not null) return Fail<AssignmentResponse>(ctx.Error.Value);

        var assignment = await db.Assignments.FirstOrDefaultAsync(a => a.LearningActivityId == activityId, ct);
        if (assignment is null) return Fail<AssignmentResponse>((ProvisioningError.NotFound, "This learning activity has no assignment yet."));

        assignment.PromoteIfDue(DateTime.UtcNow);
        try { mutate(assignment); }
        catch (InvalidOperationException ex) { return Fail<AssignmentResponse>((ProvisioningError.Conflict, ex.Message)); }
        catch (ArgumentException ex) { return Fail<AssignmentResponse>((ProvisioningError.Invalid, ex.Message)); }

        await db.SaveChangesAsync(ct);
        return ProvisioningResult<AssignmentResponse>.Success(Describe(assignment));
    }

    // ── Context resolution ───────────────────────────────────────────────────

    private record WorkspaceContext(Workspace? Workspace, Guid MembershipId, (ProvisioningError Error, string Message)? Error);

    private async Task<WorkspaceContext> ResolveWorkspaceAsync(string slug, Guid caller, bool requireAuthor, CancellationToken ct)
    {
        var normalised = slug.ToLowerInvariant().Trim();

        var workspace = await db.Workspaces.AsNoTracking().FirstOrDefaultAsync(w => w.Slug == normalised, ct);
        if (workspace is null) return new WorkspaceContext(null, Guid.Empty, (ProvisioningError.NotFound, "No such workspace."));

        var member = await db.Memberships.Include(m => m.Roles).AsNoTracking()
            .FirstOrDefaultAsync(m => m.WorkspaceId == workspace.Id && m.IdentityId == caller && m.Status == MembershipStatus.Active, ct);
        if (member is null) return new WorkspaceContext(null, Guid.Empty, (ProvisioningError.NotFound, "No such workspace."));

        if (requireAuthor && !member.Roles.Any(r => AuthorRoles.Contains(r.Name)))
            return new WorkspaceContext(null, member.Id, (ProvisioningError.Forbidden, "Only an owner, administrator or teacher can manage assignments."));

        return new WorkspaceContext(workspace, member.Id, null);
    }

    private record ActivityContext(Workspace? Workspace, Guid MembershipId, LearningActivity? Activity, Guid LearningProductId, (ProvisioningError Error, string Message)? Error);

    private async Task<ActivityContext> ResolveActivityAsync(string slug, Guid caller, Guid lessonId, Guid activityId, bool requireAuthor, CancellationToken ct)
    {
        var wctx = await ResolveWorkspaceAsync(slug, caller, requireAuthor, ct);
        if (wctx.Error is not null) return new ActivityContext(null, wctx.MembershipId, null, Guid.Empty, wctx.Error);

        var lesson = await db.Lessons.Include(l => l.Revisions).AsNoTracking()
            .FirstOrDefaultAsync(l => l.Id == lessonId && l.WorkspaceId == wctx.Workspace!.Id, ct);
        if (lesson is null) return new ActivityContext(null, wctx.MembershipId, null, Guid.Empty, (ProvisioningError.NotFound, "No such lesson."));

        var revisionIds = lesson.Revisions.Select(r => r.Id).ToHashSet();
        var activity = await db.LearningActivities.AsNoTracking().FirstOrDefaultAsync(a => a.Id == activityId, ct);
        if (activity is null || !revisionIds.Contains(activity.LessonRevisionId))
            return new ActivityContext(null, wctx.MembershipId, null, Guid.Empty, (ProvisioningError.NotFound, "No such learning activity."));

        return new ActivityContext(wctx.Workspace, wctx.MembershipId, activity, lesson.LearningProductId, null);
    }

    private record LearnerContext(Guid WorkspaceId, Guid MembershipId, (ProvisioningError Error, string Message)? Error);

    private async Task<LearnerContext> ResolveLearnerAsync(string slug, Guid caller, CancellationToken ct)
    {
        var resolved = await learnerAccess.ResolveLearnerAsync(slug, caller, ct);
        return new LearnerContext(resolved.Workspace?.Id ?? Guid.Empty, resolved.MembershipId, resolved.Error);
    }

    private static ProvisioningResult<T> Fail<T>((ProvisioningError Error, string Message) e)
        => ProvisioningResult<T>.Fail(e.Error, e.Message);
}
