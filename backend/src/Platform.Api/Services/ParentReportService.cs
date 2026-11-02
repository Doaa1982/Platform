using Microsoft.EntityFrameworkCore;
using Platform.Api.Email;
using Platform.Domain;
using Platform.Infrastructure;

namespace Platform.Api.Services;

/// <summary>
/// Sends every email a parent receives (Parent Progress Reports Business Analysis §8–§10): the
/// one-time confirmation, a result after each marked assignment or graded quiz, and the monthly
/// summary.
///
/// Called only AFTER the caller's own SaveChangesAsync succeeded, so a failed save never emails a
/// parent. Never throws: a parent email that fails is logged and recorded, and the tutor's or
/// learner's action it followed still succeeds. Every send — delivered or not — is recorded as a
/// <see cref="ParentReportDelivery"/>, and a report already attempted for the same contact, kind
/// and subject is never sent again.
///
/// No plan gating and no AI credits: email reports are on every plan, including Free.
/// </summary>
public class ParentReportService(
    PlatformDbContext db,
    TransactionalEmails emails,
    ParentLinkTokens links,
    EmailOptions emailOptions,
    TimeProvider clock,
    ILogger<ParentReportService> logger)
{
    private DateTime Now => clock.GetUtcNow().UtcDateTime;

    // ── Confirmation ─────────────────────────────────────────────────────────

    /// <summary>The welcome email with "Yes, send me updates". The contact must already be saved.</summary>
    public async Task SendConfirmationAsync(ParentContact contact, CancellationToken ct = default)
    {
        try
        {
            if (contact.Status != ParentContactStatus.PendingConfirmation) return;
            var key = $"v{contact.LinkVersion}";
            if (await AlreadyAttemptedAsync(contact.Id, ParentReportKind.Confirmation, key, ct)) return;

            var ctx = await LoadContextAsync(contact.WorkspaceId, contact.LearnerMembershipId, ct);
            if (ctx is null) return;

            var token = links.Issue(ParentLinkPurpose.Confirm, contact.Id, contact.LinkVersion, new DateTimeOffset(contact.ConfirmationExpiresAt, TimeSpan.Zero));
            var content = EmailTemplates.ParentConfirmation(
                contact.Language, contact.Name, ctx.LearnerFirstName, ctx.Workspace.Name, ctx.ReplyTo,
                Link("confirm", token), contact.ConfirmationExpiresAt - Now);
            await SendAndRecordAsync(contact, EmailTemplate.ParentConfirmation, ParentReportKind.Confirmation, key, content, ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex, "Could not send the parent confirmation for contact {ContactId}.", contact.Id);
        }
    }

    // ── Results ──────────────────────────────────────────────────────────────

    /// <summary>
    /// The tutor issued an assignment result (AssignmentService.EvaluateSubmissionAsync succeeded).
    /// Never before the tutor's decision — this is the only assignment trigger.
    /// </summary>
    public async Task AssignmentEvaluatedAsync(Guid submissionId, CancellationToken ct = default)
    {
        try
        {
            var submission = await db.Submissions.AsNoTracking().FirstOrDefaultAsync(s => s.Id == submissionId, ct);
            if (submission is not { AssignmentId: { } assignmentId, Status: SubmissionStatus.Evaluated }) return;

            var assignment = await db.Assignments.AsNoTracking().FirstOrDefaultAsync(a => a.Id == assignmentId, ct);
            if (assignment is null) return;

            var ctx = await LoadContextAsync(assignment.WorkspaceId, submission.MembershipId, ct);
            if (ctx is null || !ctx.Workspace.EmailParentsResults || ctx.Contacts.Count == 0) return;

            var activityTitle = await db.LearningActivities.AsNoTracking()
                .Where(a => a.Id == assignment.LearningActivityId).Select(a => a.Title).FirstOrDefaultAsync(ct) ?? "";
            var courseTitle = await CourseTitleAsync(assignment.LearningProductId, ct);

            foreach (var contact in ctx.Contacts)
            {
                var key = submission.Id.ToString("N");
                if (await AlreadyAttemptedAsync(contact.Id, ParentReportKind.AssignmentResult, key, ct)) continue;
                var content = EmailTemplates.ParentAssignmentResult(
                    contact.Language, contact.Name, ctx.LearnerFirstName, ctx.Workspace.Name, ctx.ReplyTo,
                    activityTitle, courseTitle, submission.AssignmentPassed, submission.Feedback, UnsubscribeLink(contact));
                await SendAndRecordAsync(contact, EmailTemplate.ParentAssignmentResult, ParentReportKind.AssignmentResult, key, content, ct);
            }
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex, "Could not send parent reports for assignment submission {SubmissionId}.", submissionId);
        }
    }

    /// <summary>
    /// A learner's quiz attempt was graded (lesson questions, lesson quiz, or an adaptive quiz).
    /// A tutor's later grade override sends nothing (V1): the delivery record for this
    /// submission already exists.
    /// </summary>
    public async Task QuizGradedAsync(Guid submissionId, CancellationToken ct = default)
    {
        try
        {
            var submission = await db.Submissions.AsNoTracking().FirstOrDefaultAsync(s => s.Id == submissionId, ct);
            if (submission is not { AssessmentId: { } assessmentId, Status: SubmissionStatus.Graded }) return;

            var assessment = await db.Assessments.AsNoTracking().FirstOrDefaultAsync(a => a.Id == assessmentId, ct);
            if (assessment is null) return;

            var ctx = await LoadContextAsync(assessment.WorkspaceId, submission.MembershipId, ct);
            if (ctx is null || !ctx.Workspace.EmailParentsResults || ctx.Contacts.Count == 0) return;

            var lesson = await db.Lessons.AsNoTracking()
                .Where(l => l.Id == assessment.LessonId).Select(l => new { l.Title, l.LearningProductId }).FirstOrDefaultAsync(ct);
            var quizTitle = !string.IsNullOrWhiteSpace(assessment.Title) ? assessment.Title : lesson?.Title ?? "";
            var courseTitle = lesson is null ? "" : await CourseTitleAsync(lesson.LearningProductId, ct);

            foreach (var contact in ctx.Contacts)
            {
                var key = submission.Id.ToString("N");
                if (await AlreadyAttemptedAsync(contact.Id, ParentReportKind.QuizResult, key, ct)) continue;
                // No feedback text: what the learner is shown after a quiz is a generated score line,
                // not something a tutor or the AI wrote, and the score is already in the email.
                var content = EmailTemplates.ParentQuizResult(
                    contact.Language, contact.Name, ctx.LearnerFirstName, ctx.Workspace.Name, ctx.ReplyTo,
                    quizTitle, courseTitle, submission.ScorePercent, submission.Passed, null, UnsubscribeLink(contact));
                await SendAndRecordAsync(contact, EmailTemplate.ParentQuizResult, ParentReportKind.QuizResult, key, content, ct);
            }
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex, "Could not send parent reports for quiz submission {SubmissionId}.", submissionId);
        }
    }

    // ── Monthly summary ──────────────────────────────────────────────────────

    /// <summary>
    /// Summaries of the calendar month (Africa/Cairo) before the one <paramref name="asOfUtc"/>
    /// falls in, for every workspace with the monthly switch on, to every confirmed parent of a
    /// learner who had activity that month. Safe to run any number of times: a summary already
    /// attempted for a parent and month is skipped. Returns how many emails were attempted.
    /// </summary>
    public async Task<int> SendMonthlySummariesAsync(DateTime asOfUtc, CancellationToken ct = default)
    {
        var (month, fromUtc, toUtc) = PreviousCairoMonth(asOfUtc);
        var (_, previousFromUtc, _) = PreviousCairoMonth(fromUtc.AddHours(1));
        var key = $"{month:yyyy-MM}";
        var attempted = 0;

        var workspaceIds = await db.Workspaces.AsNoTracking()
            .Where(w => w.EmailParentsMonthlySummary && w.Status != WorkspaceStatus.Archived && w.Status != WorkspaceStatus.Deleted)
            .Select(w => w.Id).ToListAsync(ct);

        foreach (var workspaceId in workspaceIds)
        {
            var learnerIds = await db.ParentContacts.AsNoTracking()
                .Where(c => c.WorkspaceId == workspaceId && c.Status == ParentContactStatus.Confirmed)
                .Select(c => c.LearnerMembershipId).Distinct().ToListAsync(ct);

            foreach (var learnerId in learnerIds)
            {
                try
                {
                    var ctx = await LoadContextAsync(workspaceId, learnerId, ct);
                    if (ctx is null || ctx.Contacts.Count == 0) continue;

                    var pending = new List<ParentContact>();
                    foreach (var c in ctx.Contacts)
                        if (!await AlreadyAttemptedAsync(c.Id, ParentReportKind.MonthlySummary, key, ct)) pending.Add(c);
                    if (pending.Count == 0) continue;

                    var figures = await MonthlyFiguresAsync(workspaceId, learnerId, fromUtc, toUtc, previousFromUtc, ct);
                    if (figures is null) continue; // no activity that month

                    foreach (var contact in pending)
                    {
                        var content = EmailTemplates.ParentMonthlySummary(
                            contact.Language, contact.Name, ctx.LearnerFirstName, ctx.Workspace.Name, ctx.ReplyTo,
                            month, figures with { LowestResult = LocalizeLowest(figures, contact.Language) }, UnsubscribeLink(contact));
                        await SendAndRecordAsync(contact, EmailTemplate.ParentMonthlySummary, ParentReportKind.MonthlySummary, key, content, ct);
                        attempted++;
                    }
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    logger.LogError(ex, "Could not send the {Month} parent summary for learner {MembershipId}.", key, learnerId);
                }
            }
        }
        return attempted;
    }

    /// <summary>
    /// Null when the learner had no activity: nothing completed and nothing missed. Assignments
    /// count in the month their result was issued; quizzes in the month they were graded; a missed
    /// assignment is one due that month, still visible, with no response from this learner.
    /// </summary>
    private async Task<ParentMonthlyFigures?> MonthlyFiguresAsync(
        Guid workspaceId, Guid learnerId, DateTime fromUtc, DateTime toUtc, DateTime previousFromUtc, CancellationToken ct)
    {
        var evaluated = await (
            from s in db.Submissions.AsNoTracking()
            join a in db.Assignments.AsNoTracking() on s.AssignmentId equals a.Id
            join act in db.LearningActivities.AsNoTracking() on a.LearningActivityId equals act.Id
            where s.MembershipId == learnerId && a.WorkspaceId == workspaceId
               && s.Status == SubmissionStatus.Evaluated && s.EvaluatedAt >= fromUtc && s.EvaluatedAt < toUtc
            select new { act.Title, s.AssignmentPassed }).ToListAsync(ct);

        var quizzes = await (
            from s in db.Submissions.AsNoTracking()
            join q in db.Assessments.AsNoTracking() on s.AssessmentId equals q.Id
            join l in db.Lessons.AsNoTracking() on q.LessonId equals l.Id
            where s.MembershipId == learnerId && q.WorkspaceId == workspaceId
               && s.Status == SubmissionStatus.Graded && s.GradedAt >= previousFromUtc && s.GradedAt < toUtc
            select new { Title = q.Title != "" ? q.Title : l.Title, s.ScorePercent, s.OverrideScorePercent, s.GradedAt }).ToListAsync(ct);
        var thisMonthQuizzes = quizzes.Where(q => q.GradedAt >= fromUtc).ToList();
        var lastMonthQuizzes = quizzes.Where(q => q.GradedAt < fromUtc).ToList();

        var enrolledProductIds = await db.Enrollments.AsNoTracking()
            .Where(e => e.MembershipId == learnerId && e.Status == EnrollmentStatus.Active)
            .Select(e => e.LearningProductId).ToListAsync(ct);
        var dueAssignments = await db.Assignments.AsNoTracking()
            .Where(a => a.WorkspaceId == workspaceId && enrolledProductIds.Contains(a.LearningProductId) && a.Visible
                     && a.Status != AssignmentStatus.Draft && a.Status != AssignmentStatus.Scheduled && a.Status != AssignmentStatus.Archived
                     && a.DueAt >= fromUtc && a.DueAt < toUtc)
            .Select(a => a.Id).ToListAsync(ct);
        var respondedTo = dueAssignments.Count == 0 ? [] : await db.Submissions.AsNoTracking()
            .Where(s => s.MembershipId == learnerId && s.AssignmentId != null && dueAssignments.Contains(s.AssignmentId.Value)
                     && (s.Status == SubmissionStatus.Submitted || s.Status == SubmissionStatus.UnderReview || s.Status == SubmissionStatus.Evaluated))
            .Select(s => s.AssignmentId!.Value).Distinct().ToListAsync(ct);
        var missed = dueAssignments.Count - respondedTo.Count;

        if (evaluated.Count == 0 && thisMonthQuizzes.Count == 0 && missed == 0) return null;

        static int Score(int raw, int? overridden) => overridden ?? raw;
        int? Average(IEnumerable<int> scores) { var list = scores.ToList(); return list.Count == 0 ? null : (int)Math.Round(list.Average(), MidpointRounding.AwayFromZero); }

        // Lowest result: the lowest quiz score, or a "Not passed" assignment (which ranks below any score).
        string? lowestTitle = null, lowestValue = null;
        var failed = evaluated.FirstOrDefault(e => e.AssignmentPassed == false);
        if (failed is not null) { lowestTitle = failed.Title; lowestValue = NotPassedMarker; }
        else if (thisMonthQuizzes.Count > 0)
        {
            var low = thisMonthQuizzes.MinBy(q => Score(q.ScorePercent, q.OverrideScorePercent))!;
            lowestTitle = low.Title;
            lowestValue = $"{Score(low.ScorePercent, low.OverrideScorePercent)}%";
        }

        return new ParentMonthlyFigures(
            evaluated.Count, thisMonthQuizzes.Count, missed,
            Average(thisMonthQuizzes.Select(q => Score(q.ScorePercent, q.OverrideScorePercent))),
            Average(lastMonthQuizzes.Select(q => Score(q.ScorePercent, q.OverrideScorePercent))),
            lowestTitle, lowestValue);
    }

    private const string NotPassedMarker = "\u0000not-passed";

    private static string? LocalizeLowest(ParentMonthlyFigures f, string language) =>
        f.LowestResult == NotPassedMarker ? EmailTemplates.ResultWord(language, false) : f.LowestResult;

    // ── Cairo calendar ───────────────────────────────────────────────────────

    private static readonly TimeZoneInfo Cairo = FindCairo();

    private static TimeZoneInfo FindCairo()
    {
        foreach (var id in new[] { "Africa/Cairo", "Egypt Standard Time" })
            if (TimeZoneInfo.TryFindSystemTimeZoneById(id, out var tz)) return tz;
        return TimeZoneInfo.CreateCustomTimeZone("Cairo-fallback", TimeSpan.FromHours(2), "Cairo", "Cairo");
    }

    /// <summary>The date in Cairo right now — the background job sends on the 1st.</summary>
    public static DateOnly CairoToday(DateTime utcNow) =>
        DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utcNow, DateTimeKind.Utc), Cairo));

    /// <summary>The Cairo calendar month before the one <paramref name="asOfUtc"/> falls in, as its first day and UTC bounds.</summary>
    public static (DateOnly Month, DateTime FromUtc, DateTime ToUtc) PreviousCairoMonth(DateTime asOfUtc)
    {
        var today = CairoToday(asOfUtc);
        var thisMonth = new DateOnly(today.Year, today.Month, 1);
        var previous = thisMonth.AddMonths(-1);
        DateTime ToUtc(DateOnly d) => TimeZoneInfo.ConvertTimeToUtc(d.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified), Cairo);
        return (previous, ToUtc(previous), ToUtc(thisMonth));
    }

    // ── Shared ───────────────────────────────────────────────────────────────

    private sealed record ReportContext(Workspace Workspace, string? ReplyTo, string LearnerFirstName, List<ParentContact> Contacts);

    /// <summary>The workspace, the learner's first name, and the learner's confirmed parents (only those may receive reports).</summary>
    private async Task<ReportContext?> LoadContextAsync(Guid workspaceId, Guid learnerMembershipId, CancellationToken ct)
    {
        var workspace = await db.Workspaces.AsNoTracking().FirstOrDefaultAsync(w => w.Id == workspaceId, ct);
        if (workspace is null) return null;

        var fullName = await (from m in db.Memberships.AsNoTracking()
                              join i in db.Identities.AsNoTracking() on m.IdentityId equals i.Id
                              where m.Id == learnerMembershipId && m.WorkspaceId == workspaceId
                              select i.FullName).FirstOrDefaultAsync(ct);
        if (fullName is null) return null;

        var contacts = await db.ParentContacts.AsNoTracking()
            .Where(c => c.WorkspaceId == workspaceId && c.LearnerMembershipId == learnerMembershipId && c.Status == ParentContactStatus.Confirmed)
            .ToListAsync(ct);

        return new ReportContext(workspace, await emails.WorkspaceOwnerEmailAsync(workspace, ct), FirstName(fullName), contacts);
    }

    public static string FirstName(string fullName)
    {
        var trimmed = fullName.Trim();
        var space = trimmed.IndexOf(' ');
        return space > 0 ? trimmed[..space] : trimmed;
    }

    private async Task<string> CourseTitleAsync(Guid productId, CancellationToken ct) =>
        await db.LearningProducts.AsNoTracking().Where(p => p.Id == productId).Select(p => p.Title).FirstOrDefaultAsync(ct) ?? "";

    private Task<bool> AlreadyAttemptedAsync(Guid contactId, ParentReportKind kind, string key, CancellationToken ct) =>
        db.ParentReportDeliveries.AsNoTracking().AnyAsync(d => d.ParentContactId == contactId && d.Kind == kind && d.SubjectKey == key, ct);

    private async Task SendAndRecordAsync(
        ParentContact contact, EmailTemplate template, ParentReportKind kind, string key, EmailContent content, CancellationToken ct)
    {
        DeliveryOutcome outcome;
        try { outcome = await emails.SendToParentAsync(template, contact.Email, contact.Name, content, ct); }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex, "Sending the {Template} email to parent contact {ContactId} threw.", template, contact.Id);
            outcome = DeliveryOutcome.Failed("email", ex.Message);
        }

        // Callers have already saved their own changes (see the class remarks), so this save holds only the record.
        db.ParentReportDeliveries.Add(ParentReportDelivery.Record(contact, kind, key, outcome.Delivered, outcome.Delivered ? null : outcome.Detail, Now));
        await db.SaveChangesAsync(ct);
    }

    private string UnsubscribeLink(ParentContact contact) =>
        Link("unsubscribe", links.Issue(ParentLinkPurpose.Unsubscribe, contact.Id, contact.LinkVersion, clock.GetUtcNow().Add(ParentLinkTokens.UnsubscribeLifetime)));

    private string Link(string action, string token) => $"{emailOptions.PublicBaseUrl.TrimEnd('/')}/parent/{action}/{token}";
}
