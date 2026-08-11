using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Platform.Api.AI;
using Platform.Api.AI.Skills;
using Platform.Api.Models;
using Platform.Domain;
using Platform.Infrastructure;

namespace Platform.Api.Services;

/// <summary>
/// The interactive questions attached to one lesson's video.
///
/// Two AI-shaped operations live here:
///
///   SuggestQuestionsAsync — AI Interactive Video Lesson Generator §3/§7:
///     proposes timestamped checkpoints for the tutor to accept, edit or
///     remove. Nothing is persisted; a suggestion becomes real only once
///     accepted through AddQuestionAsync. Backed by a real model call via
///     <see cref="GenerateQuestionsSkill"/> (AISkillArchitecture.md).
///
///   PreviewAsync — Assessment and Submission Aggregate Design §10's "AI
///     Evaluation" method: grades a set of answers against the real answer
///     key a tutor authored. A preview only — Assessment INV-002 means an
///     unpublished assessment cannot receive a real Submission at all, so no
///     Submission is recorded here. Scoring is deterministic (a fixed answer
///     key is not an AI judgment call, AIC-005) — the AI part is the
///     narrative feedback, via <see cref="GradeAssessmentSkill"/>, which
///     reads what the learner actually wrote for OpenAnswer questions
///     instead of a generic "reviewed for participation" line. Falls back to
///     the old templated line if the model call fails, since a broken AI
///     narrative should never block a tutor from seeing their preview score.
/// </summary>
public class AssessmentService(
    PlatformDbContext db, EntitlementResolutionService entitlements,
    GenerateQuestionsSkill generateQuestions, GradeAssessmentSkill gradeAssessment)
{
    private static readonly WorkspaceRoleName[] AuthorRoles =
        [WorkspaceRoleName.Owner, WorkspaceRoleName.Administrator, WorkspaceRoleName.Teacher];

    // ── Reading ──────────────────────────────────────────────────────────────

    public async Task<ProvisioningResult<AssessmentResponse>> GetAsync(
        string slug, Guid caller, Guid lessonId, CancellationToken ct = default)
    {
        var ctx = await ResolveAsync(slug, caller, lessonId, requireAuthor: false, ct);
        if (ctx.Error is not null) return Fail<AssessmentResponse>(ctx.Error.Value);

        var assessment = await LoadAsync(ctx.TargetRevisionId, ct);
        return ProvisioningResult<AssessmentResponse>.Success(Describe(lessonId, assessment));
    }

    // ── Structure ────────────────────────────────────────────────────────────

    public Task<ProvisioningResult<AssessmentResponse>> SaveAsync(
        string slug, Guid caller, Guid lessonId, SaveAssessmentRequest request, CancellationToken ct = default)
        => MutateAsync(slug, caller, lessonId, (a, _) =>
        {
            a.Rename(request.Title);
            if (request.PassingThresholdPercent is { } threshold) a.SetPassingThreshold(threshold);
        }, ct, createIfMissing: true);

    public Task<ProvisioningResult<AssessmentResponse>> AddQuestionAsync(
        string slug, Guid caller, Guid lessonId, SaveQuestionRequest request, CancellationToken ct = default)
        => MutateAsync(slug, caller, lessonId, (a, _) =>
            a.AddQuestion(ParseType(request.Type), request.Prompt, request.Options, request.CorrectOptionIndex, request.AcceptedAnswers,
                           request.Explanation, request.VideoTimestampSeconds, request.Points),
            ct, createIfMissing: true, defaultTitle: true, notifyOnLiveEdit: true);

    public Task<ProvisioningResult<AssessmentResponse>> UpdateQuestionAsync(
        string slug, Guid caller, Guid lessonId, Guid questionId, SaveQuestionRequest request, CancellationToken ct = default)
        => MutateAsync(slug, caller, lessonId, (a, _) =>
            a.UpdateQuestion(questionId, ParseType(request.Type), request.Prompt, request.Options, request.CorrectOptionIndex, request.AcceptedAnswers,
                              request.Explanation, request.VideoTimestampSeconds, request.Points), ct, notifyOnLiveEdit: true);

    private static QuestionType ParseType(string type) =>
        Enum.TryParse<QuestionType>(type, out var parsed) ? parsed : QuestionType.MultipleChoice;

    public Task<ProvisioningResult<AssessmentResponse>> RemoveQuestionAsync(
        string slug, Guid caller, Guid lessonId, Guid questionId, CancellationToken ct = default)
        => MutateAsync(slug, caller, lessonId, (a, _) => a.RemoveQuestion(questionId), ct, notifyOnLiveEdit: true);

    public Task<ProvisioningResult<AssessmentResponse>> PublishAsync(
        string slug, Guid caller, Guid lessonId, CancellationToken ct = default)
        => MutateAsync(slug, caller, lessonId, (a, _) => a.Publish(), ct);

    public Task<ProvisioningResult<AssessmentResponse>> UnpublishAsync(
        string slug, Guid caller, Guid lessonId, CancellationToken ct = default)
        => MutateAsync(slug, caller, lessonId, (a, _) => a.Unpublish(), ct);

    // ── AI ────────────────────────────────────────────────────────────────────

    /// <summary>Caps how many checkpoints one request can ask for — roughly one per three minutes of video, AI doc §6: "AI should not randomly insert questions."</summary>
    private const int MaxSuggestedQuestions = 5;

    /// <summary>Rotated round-robin across chapters (AI Video-Grounded Questions Implementation Plan §5) — each chapter call has no memory of earlier ones, so rotation has to happen here instead of being left to the model.</summary>
    private static readonly string[] QuestionTypeRotation = ["MultipleChoice", "TrueFalse", "CompleteTheSentence", "OpenAnswer"];

    public async Task<ProvisioningResult<IReadOnlyList<SuggestedQuestion>>> SuggestQuestionsAsync(
        string slug, Guid caller, Guid lessonId, AiSuggestQuestionsRequest request, CancellationToken ct = default)
    {
        var ctx = await ResolveAsync(slug, caller, lessonId, requireAuthor: true, ct);
        if (ctx.Error is not null) return Fail<IReadOnlyList<SuggestedQuestion>>(ctx.Error.Value);

        if (!await HasAssessmentAiAsync(ctx.Workspace!.Id, ct))
            return Fail<IReadOnlyList<SuggestedQuestion>>((ProvisioningError.Forbidden,
                "AI-suggested checkpoints need the Professional plan or the AI Assessment pack. Upgrade to use this."));

        if (request.VideoDurationSeconds <= 0)
            return Fail<IReadOnlyList<SuggestedQuestion>>((ProvisioningError.Invalid, "A video duration is needed before checkpoints can be placed."));

        var revision = await LoadTargetRevisionAsync(ctx.Workspace!.Id, lessonId, ctx.TargetRevisionId, ct);
        var chapters = ParseChapters(revision);

        IReadOnlyList<SuggestedQuestion> suggestions;
        try
        {
            suggestions = chapters is { Count: > 0 }
                ? await SuggestFromChaptersAsync(ctx.LessonTitle ?? "Untitled lesson", chapters, request.VideoDurationSeconds, ct)
                : await generateQuestions.SuggestAsync(
                    ctx.LessonTitle ?? "Untitled lesson", revision?.Body, request.VideoDurationSeconds,
                    Math.Clamp(request.VideoDurationSeconds / 180, 1, MaxSuggestedQuestions), ct);
        }
        catch (InvalidOperationException ex)
        {
            // Model unavailable, misconfigured key, or unparseable output —
            // surfaced as a normal failure rather than a 500, so the tutor
            // sees a clear message instead of a crash.
            return Fail<IReadOnlyList<SuggestedQuestion>>((ProvisioningError.Conflict, $"AI question generation failed: {ex.Message}"));
        }

        return ProvisioningResult<IReadOnlyList<SuggestedQuestion>>.Success(suggestions);
    }

    /// <summary>
    /// One question per chapter, capped at MaxSuggestedQuestions — same cap
    /// today's duration-based path uses, so a long, heavily-chaptered video
    /// doesn't flood the tutor with more checkpoints than the duration-based
    /// path ever would. VideoTimestampSeconds is always the chapter's own
    /// real start time, never whatever the model returned (AI Video-Grounded
    /// Questions Implementation Plan §5).
    /// </summary>
    private async Task<IReadOnlyList<SuggestedQuestion>> SuggestFromChaptersAsync(
        string lessonTitle, IReadOnlyList<TranscriptChapter> chapters, int videoDurationSeconds, CancellationToken ct)
    {
        var results = new List<SuggestedQuestion>();
        var picked = chapters.Take(MaxSuggestedQuestions).ToList();

        for (var i = 0; i < picked.Count; i++)
        {
            var chapter = picked[i];
            var questionType = QuestionTypeRotation[i % QuestionTypeRotation.Length];
            var suggestion = await generateQuestions.SuggestForChapterAsync(
                lessonTitle, chapter.Title, chapter.Summary, questionType, ct);

            var timestamp = Math.Clamp((int)chapter.StartSeconds, 0, Math.Max(videoDurationSeconds - 1, 0));
            results.Add(suggestion with { VideoTimestampSeconds = timestamp });
        }

        return results;
    }

    /// <summary>The target revision itself, used both for AI context (Body, transcript chapters) — AsNoTracking, this never mutates it.</summary>
    private async Task<LessonRevision?> LoadTargetRevisionAsync(Guid workspaceId, Guid lessonId, Guid? revisionId, CancellationToken ct)
    {
        if (revisionId is null) return null;

        var lesson = await db.Lessons.Include(l => l.Revisions).AsNoTracking()
            .FirstOrDefaultAsync(l => l.Id == lessonId && l.WorkspaceId == workspaceId, ct);

        return lesson?.Revisions.FirstOrDefault(r => r.Id == revisionId);
    }

    /// <summary>
    /// Only trusts chapters when the transcript is actually Ready — a
    /// Processing/Failed transcript might still have stale
    /// TranscriptChaptersJson from a prior video sitting on the revision
    /// (shouldn't happen given ClearTranscript's discipline, but Ready is the
    /// authoritative check, not "is the JSON non-null").
    /// </summary>
    private static IReadOnlyList<TranscriptChapter>? ParseChapters(LessonRevision? revision)
    {
        if (revision?.TranscriptStatus != TranscriptStatus.Ready || string.IsNullOrWhiteSpace(revision.TranscriptChaptersJson))
            return null;

        try
        {
            return JsonSerializer.Deserialize<List<TranscriptChapter>>(revision.TranscriptChaptersJson);
        }
        catch (JsonException)
        {
            // Malformed stored JSON should never block question generation —
            // fall back to the duration-based path exactly as if there were
            // no chapters at all.
            return null;
        }
    }

    public async Task<ProvisioningResult<PreviewResult>> PreviewAsync(
        string slug, Guid caller, Guid lessonId, PreviewSubmitRequest request, CancellationToken ct = default)
    {
        var ctx = await ResolveAsync(slug, caller, lessonId, requireAuthor: true, ct);
        if (ctx.Error is not null) return Fail<PreviewResult>(ctx.Error.Value);

        if (!await HasAssessmentAiAsync(ctx.Workspace!.Id, ct))
            return Fail<PreviewResult>((ProvisioningError.Forbidden,
                "AI preview grading needs the Professional plan or the AI Assessment pack. Upgrade to use this."));

        var assessment = await LoadAsync(ctx.TargetRevisionId, ct);
        if (assessment is null || assessment.Questions.Count == 0)
            return Fail<PreviewResult>((ProvisioningError.Conflict, "This lesson has no questions to preview yet."));

        var byQuestion = request.Answers.ToDictionary(a => a.QuestionId, a => new SubmittedAnswer(a.SelectedOptionIndex, a.TextAnswer));

        (int ScorePercent, bool Passed, IReadOnlyList<QuestionGradeResult> PerQuestion) graded;
        try { graded = assessment.Grade(byQuestion); }
        catch (InvalidOperationException ex) { return Fail<PreviewResult>((ProvisioningError.Conflict, ex.Message)); }

        var correctCount = graded.PerQuestion.Count(q => q.Correct == true);
        var gradedCount = graded.PerQuestion.Count(q => q.Correct is not null);

        var openAnswers = graded.PerQuestion
            .Where(q => q.Correct is null)
            .Select(q => (Question: assessment.Questions.First(aq => aq.Id == q.QuestionId), Result: q))
            .Select(x => (x.Question.Prompt, Answer: byQuestion.TryGetValue(x.Question.Id, out var a) ? a.TextAnswer ?? "" : ""))
            .ToList();

        string feedback;
        try
        {
            feedback = await gradeAssessment.ReviewAsync(
                ctx.LessonTitle ?? "This lesson", graded.ScorePercent, graded.Passed,
                assessment.PassingThresholdPercent, openAnswers, ct);
        }
        catch (InvalidOperationException)
        {
            // Model unavailable/misconfigured — fall back to the deterministic
            // summary rather than failing a preview the score itself already
            // computed successfully.
            var openNote = openAnswers.Count > 0
                ? $" {openAnswers.Count} open-ended response{(openAnswers.Count == 1 ? "" : "s")} reviewed for participation, not scored."
                : "";
            feedback = gradedCount == 0
                ? $"Every question here is open-ended, so this was reviewed for participation only — nothing to score.{openNote}"
                : (graded.Passed
                    ? $"{correctCount} of {gradedCount} correct ({graded.ScorePercent}%) — at or above the {assessment.PassingThresholdPercent}% passing threshold.{openNote}"
                    : $"{correctCount} of {gradedCount} correct ({graded.ScorePercent}%) — below the {assessment.PassingThresholdPercent}% passing threshold.{openNote}");
        }

        return ProvisioningResult<PreviewResult>.Success(new PreviewResult(
            graded.ScorePercent, graded.Passed, assessment.PassingThresholdPercent, feedback,
            graded.PerQuestion.Select(q => new PreviewQuestionResult(q.QuestionId, q.Correct, q.CorrectAnswerDisplay)).ToList()));
    }

    /// <summary>Both simulated-AI surfaces are the Assessment domain's AI-assist tier — gated the same way (LIC-008).</summary>
    private Task<bool> HasAssessmentAiAsync(Guid workspaceId, CancellationToken ct) =>
        entitlements.HasEntitlementAsync(
            workspaceId, EntitlementResolutionService.AiKey(CapabilityDomain.Assessment),
            AiAssistanceLevel.Assist.ToString(), ct);

    // ── Plumbing ─────────────────────────────────────────────────────────────

    private async Task<Assessment?> LoadAsync(Guid? lessonRevisionId, CancellationToken ct, bool tracked = false)
    {
        if (lessonRevisionId is null) return null;
        var q = db.Assessments.Include(a => a.Questions).Where(a => a.LessonRevisionId == lessonRevisionId);
        return tracked ? await q.FirstOrDefaultAsync(ct) : await q.AsNoTracking().FirstOrDefaultAsync(ct);
    }

    private static AssessmentResponse Describe(Guid lessonId, Assessment? a) => new(
        Id: a?.Id,
        LessonId: lessonId,
        Title: a?.Title,
        Status: a?.Status.ToString() ?? "None",
        PassingThresholdPercent: a?.PassingThresholdPercent ?? 70,
        PublicationBlocker: a is null
            ? "This lesson has no interactive questions yet — add one to start."
            : a.PublicationBlocker(),
        Questions: a is null ? [] : a.Questions.OrderBy(q => q.Position)
            .Select(q => new QuestionRow(q.Id, q.Type.ToString(), q.Prompt, q.Options, q.CorrectOptionIndex, q.AcceptedAnswers, q.Explanation, q.VideoTimestampSeconds, q.Points, q.Position))
            .ToList());

    private async Task<ProvisioningResult<AssessmentResponse>> MutateAsync(
        string slug, Guid caller, Guid lessonId, Action<Assessment, Guid> mutate, CancellationToken ct,
        bool createIfMissing = false, bool defaultTitle = false, bool notifyOnLiveEdit = false)
    {
        var ctx = await ResolveAsync(slug, caller, lessonId, requireAuthor: true, ct);
        if (ctx.Error is not null) return Fail<AssessmentResponse>(ctx.Error.Value);
        if (ctx.TargetRevisionId is null)
            return Fail<AssessmentResponse>((ProvisioningError.Conflict, "This lesson has no revision to attach questions to yet."));

        var assessment = await LoadAsync(ctx.TargetRevisionId, ct, tracked: true);

        if (assessment is null)
        {
            if (!createIfMissing)
                return Fail<AssessmentResponse>((ProvisioningError.Conflict, "This lesson has no interactive questions yet."));

            assessment = Assessment.Create(ctx.Workspace!.Id, lessonId, ctx.TargetRevisionId.Value,
                defaultTitle ? $"{ctx.LessonTitle} — Interactive Questions" : ctx.LessonTitle!);
            db.Assessments.Add(assessment);
        }

        try { mutate(assessment, ctx.MembershipId); }
        catch (InvalidOperationException ex) { return Fail<AssessmentResponse>((ProvisioningError.Conflict, ex.Message)); }
        catch (ArgumentException ex) { return Fail<AssessmentResponse>((ProvisioningError.Invalid, ex.Message)); }

        // Lesson Editing & Publication UX, Scenario 4: editing questions on the
        // lesson's currently PUBLISHED revision, whose Assessment is itself
        // already Published (i.e. learners can already see it — this isn't a
        // separate draft revision nobody's been served yet), notifies every
        // learner who has engaged with this lesson at all.
        if (notifyOnLiveEdit && ctx.TargetRevisionId == ctx.CurrentRevisionId && assessment.Status == AssessmentStatus.Published)
            await NotifyQuestionsUpdatedAsync(ctx.Workspace!.Id, lessonId, ct);

        await db.SaveChangesAsync(ct);
        return await GetAsync(slug, caller, lessonId, ct);
    }

    /// <summary>
    /// One Notification per learner whose LessonProgress row exists for this
    /// lesson — that row is only ever created the moment a learner opens the
    /// lesson (LearningDeliveryService.EnsureProgressAsync), so its mere
    /// existence already means "started or completed" (Lesson Editing &amp;
    /// Publication UX, Scenario 4); a learner who never opened it has no row
    /// and is correctly left out.
    /// </summary>
    private async Task NotifyQuestionsUpdatedAsync(Guid workspaceId, Guid lessonId, CancellationToken ct)
    {
        var membershipIds = await (
            from progress in db.LessonProgresses.AsNoTracking()
            join enrollment in db.Enrollments.AsNoTracking() on progress.EnrollmentId equals enrollment.Id
            where progress.LessonId == lessonId
            select enrollment.MembershipId
        ).Distinct().ToListAsync(ct);

        const string title = "Lesson Updated";
        const string message = "The interactive questions for this lesson have been improved. Your learning progress has not changed.";

        foreach (var membershipId in membershipIds)
            db.Notifications.Add(Notification.Create(workspaceId, membershipId, NotificationKind.LessonQuestionsUpdated, lessonId, title, message));
    }

    private record Context(Workspace? Workspace, Guid MembershipId, string? LessonTitle, Guid? TargetRevisionId, Guid? CurrentRevisionId, (ProvisioningError Error, string Message)? Error);

    /// <summary>
    /// Resolves which revision's Assessment a request is about: the lesson's
    /// open draft if one exists (a new revision is being prepared), else its
    /// current published revision (a tutor may still be refining/publishing
    /// its quiz without having started a new content revision yet) — matching
    /// exactly what the frontend already gates editability on.
    /// </summary>
    private async Task<Context> ResolveAsync(string slug, Guid caller, Guid lessonId, bool requireAuthor, CancellationToken ct)
    {
        var normalised = slug.ToLowerInvariant().Trim();

        var workspace = await db.Workspaces.AsNoTracking().FirstOrDefaultAsync(w => w.Slug == normalised, ct);
        if (workspace is null) return new Context(null, Guid.Empty, null, null, null, (ProvisioningError.NotFound, "No such workspace."));

        var member = await db.Memberships.Include(m => m.Roles).AsNoTracking()
            .FirstOrDefaultAsync(m => m.WorkspaceId == workspace.Id && m.IdentityId == caller
                                   && m.Status == MembershipStatus.Active, ct);
        if (member is null) return new Context(null, Guid.Empty, null, null, null, (ProvisioningError.NotFound, "No such workspace."));

        if (requireAuthor && !member.Roles.Any(r => AuthorRoles.Contains(r.Name)))
            return new Context(null, member.Id, null, null, null, (ProvisioningError.Forbidden, "Only an owner, administrator or teacher can author content."));

        var lesson = await db.Lessons.Include(l => l.Revisions).AsNoTracking()
            .FirstOrDefaultAsync(l => l.Id == lessonId && l.WorkspaceId == workspace.Id, ct);
        if (lesson is null) return new Context(null, member.Id, null, null, null, (ProvisioningError.NotFound, "No such lesson."));

        var targetRevisionId = lesson.DraftRevision?.Id ?? lesson.CurrentRevisionId;
        return new Context(workspace, member.Id, lesson.Title, targetRevisionId, lesson.CurrentRevisionId, null);
    }

    private static ProvisioningResult<T> Fail<T>((ProvisioningError Error, string Message) e)
        => ProvisioningResult<T>.Fail(e.Error, e.Message);
}
