using Microsoft.EntityFrameworkCore;
using Platform.Api.Models;
using Platform.Domain;
using Platform.Infrastructure;

namespace Platform.Api.Services;

/// <summary>
/// The interactive questions attached to one lesson's video.
///
/// Two AI-shaped operations live here in simulated form — matching every
/// other "AI" surface already in this prototype (App.jsx's PSEUDO-AI HELPERS
/// remark): templated and deterministic rather than a live model call, but
/// shaped exactly like what the real thing would return.
///
///   SuggestQuestionsAsync — AI Interactive Video Lesson Generator §3/§7:
///     proposes timestamped checkpoints for the tutor to accept, edit or
///     remove. Nothing is persisted; a suggestion becomes real only once
///     accepted through AddQuestionAsync.
///
///   PreviewAsync — Assessment and Submission Aggregate Design §10's "AI
///     Evaluation" method: grades a set of answers against the real answer
///     key a tutor authored. A preview only — Assessment INV-002 means an
///     unpublished assessment cannot receive a real Submission at all, so no
///     Submission is recorded here.
/// </summary>
public class AssessmentService(PlatformDbContext db)
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

    // ── Simulated AI ─────────────────────────────────────────────────────────

    /// <summary>
    /// Instructional placement rules from AI Interactive Video Lesson
    /// Generator §6, rotating across all four Question Event types
    /// (Learning Delivery Context §4.1) rather than defaulting everything to
    /// multiple choice — each type is placed where AI Interactive Video
    /// Lesson Generator §5 says it fits best.
    /// </summary>
    private static readonly (double Fraction, QuestionType Type, string Prompt, string[]? Options, int? CorrectOptionIndex, string[]? AcceptedAnswers, string Explanation)[] Templates =
    [
        (0.2, QuestionType.MultipleChoice,
         "What is the main idea the video just explained?",
         ["The point just introduced", "A common misconception about it", "An unrelated topic", "Something covered later"], 0, null,
         "Multiple choice for knowledge checking, placed right after an explanation while it's fresh (§6, \"After Explanation\"; AI doc §5)."),

        (0.38, QuestionType.TrueFalse,
         "True or false: what the video just showed is the only correct way to think about this.",
         null, 1, null,
         "True/false for misconception detection (AI doc §5) — most single ideas admit more than one valid framing."),

        (0.55, QuestionType.OpenAnswer,
         "Before the video continues — what do you predict happens next, and why?",
         null, null, null,
         "Open answer for reasoning and prediction (AI doc §5), placed before the example (§6, \"Before Example\"). Reviewed for participation, not auto-scored."),

        (0.72, QuestionType.CompleteTheSentence,
         "Complete the sentence: the term the video just used for this idea is ______.",
         null, null, ["<edit: the actual term from the video>"],
         "Complete-the-sentence for vocabulary and terminology (AI doc §5) — replace the accepted answer with the term actually used before publishing."),

        (0.9, QuestionType.MultipleChoice,
         "Looking back at the whole video — which statement best summarizes it?",
         ["A correct summary of what was taught", "A summary of a different lesson", "A definition unrelated to the content", "A random restatement of the title"], 0, null,
         "A closing knowledge checkpoint, covering the video as a whole."),
    ];

    public async Task<ProvisioningResult<IReadOnlyList<SuggestedQuestion>>> SuggestQuestionsAsync(
        string slug, Guid caller, Guid lessonId, AiSuggestQuestionsRequest request, CancellationToken ct = default)
    {
        var ctx = await ResolveAsync(slug, caller, lessonId, requireAuthor: true, ct);
        if (ctx.Error is not null) return Fail<IReadOnlyList<SuggestedQuestion>>(ctx.Error.Value);

        if (request.VideoDurationSeconds <= 0)
            return Fail<IReadOnlyList<SuggestedQuestion>>((ProvisioningError.Invalid, "A video duration is needed before checkpoints can be placed."));

        // Roughly one checkpoint per three minutes of video, one to five total —
        // AI doc §6: "AI should not randomly insert questions."
        var count = Math.Clamp(request.VideoDurationSeconds / 180, 1, Templates.Length);

        var suggestions = Templates.Take(count).Select(t => new SuggestedQuestion(
            Type: t.Type.ToString(),
            Prompt: t.Prompt,
            Options: t.Type == QuestionType.TrueFalse ? ["True", "False"] : (t.Options ?? []),
            CorrectOptionIndex: t.CorrectOptionIndex,
            AcceptedAnswers: t.AcceptedAnswers ?? [],
            Explanation: t.Explanation,
            VideoTimestampSeconds: (int)(t.Fraction * request.VideoDurationSeconds),
            Points: 1
        )).ToList();

        return ProvisioningResult<IReadOnlyList<SuggestedQuestion>>.Success(suggestions);
    }

    public async Task<ProvisioningResult<PreviewResult>> PreviewAsync(
        string slug, Guid caller, Guid lessonId, PreviewSubmitRequest request, CancellationToken ct = default)
    {
        var ctx = await ResolveAsync(slug, caller, lessonId, requireAuthor: true, ct);
        if (ctx.Error is not null) return Fail<PreviewResult>(ctx.Error.Value);

        var assessment = await LoadAsync(ctx.TargetRevisionId, ct);
        if (assessment is null || assessment.Questions.Count == 0)
            return Fail<PreviewResult>((ProvisioningError.Conflict, "This lesson has no questions to preview yet."));

        var byQuestion = request.Answers.ToDictionary(a => a.QuestionId, a => new SubmittedAnswer(a.SelectedOptionIndex, a.TextAnswer));

        (int ScorePercent, bool Passed, IReadOnlyList<QuestionGradeResult> PerQuestion) graded;
        try { graded = assessment.Grade(byQuestion); }
        catch (InvalidOperationException ex) { return Fail<PreviewResult>((ProvisioningError.Conflict, ex.Message)); }

        var gradedCount = graded.PerQuestion.Count(q => q.Correct is not null);
        var correctCount = graded.PerQuestion.Count(q => q.Correct == true);
        var openCount = graded.PerQuestion.Count - gradedCount;
        var openNote = openCount > 0
            ? $" {openCount} open-ended response{(openCount == 1 ? "" : "s")} reviewed for participation, not scored."
            : "";

        var feedback = gradedCount == 0
            ? $"Simulated AI grading: every question here is open-ended, so this was reviewed for participation only — nothing to score.{openNote}"
            : (graded.Passed
                ? $"Simulated AI grading: {correctCount} of {gradedCount} correct ({graded.ScorePercent}%) — at or above the {assessment.PassingThresholdPercent}% passing threshold.{openNote}"
                : $"Simulated AI grading: {correctCount} of {gradedCount} correct ({graded.ScorePercent}%) — below the {assessment.PassingThresholdPercent}% passing threshold.{openNote}");

        return ProvisioningResult<PreviewResult>.Success(new PreviewResult(
            graded.ScorePercent, graded.Passed, assessment.PassingThresholdPercent, feedback,
            graded.PerQuestion.Select(q => new PreviewQuestionResult(q.QuestionId, q.Correct, q.CorrectAnswerDisplay)).ToList()));
    }

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
