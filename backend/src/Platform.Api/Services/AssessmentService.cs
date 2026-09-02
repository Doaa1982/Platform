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
    GenerateQuestionsSkill generateQuestions, GradeAssessmentSkill gradeAssessment,
    GenerateStandaloneQuestionsSkill generateStandaloneQuestions)
{
    private static readonly WorkspaceRoleName[] AuthorRoles =
        [WorkspaceRoleName.Owner, WorkspaceRoleName.Administrator, WorkspaceRoleName.Teacher];

    // ── Tutor overview (gradebook) ──────────────────────────────────────────
    //
    // Cross-course, workspace-wide — unlike every other method here, this
    // isn't scoped to one lessonId up front, so it uses its own
    // ResolveWorkspaceAsync rather than the lesson-scoped ResolveAsync below.

    public async Task<ProvisioningResult<AssessmentOverviewResponse>> GetOverviewAsync(
        string slug, Guid caller, CancellationToken ct = default)
    {
        var wctx = await ResolveWorkspaceAsync(slug, caller, ct);
        if (wctx.Error is not null) return Fail<AssessmentOverviewResponse>(wctx.Error.Value);

        var assessments = await db.Assessments.Include(a => a.Questions).AsNoTracking()
            .Where(a => a.WorkspaceId == wctx.Workspace!.Id)
            .ToListAsync(ct);
        if (assessments.Count == 0)
            return ProvisioningResult<AssessmentOverviewResponse>.Success(new AssessmentOverviewResponse([]));

        var lessonIds = assessments.Select(a => a.LessonId).Distinct().ToList();
        var lessons = await db.Lessons.AsNoTracking()
            .Where(l => lessonIds.Contains(l.Id)).ToDictionaryAsync(l => l.Id, ct);

        // Only the assessment on each lesson's CURRENT revision — a
        // superseded revision's own Assessment/Submissions are kept
        // (never deleted) but don't belong in a live gradebook.
        var current = assessments
            .Where(a => lessons.TryGetValue(a.LessonId, out var lesson) && lesson.CurrentRevisionId == a.LessonRevisionId)
            .ToList();

        var productIds = current.Select(a => lessons[a.LessonId].LearningProductId).Distinct().ToList();
        var products = await db.LearningProducts.AsNoTracking()
            .Where(p => productIds.Contains(p.Id)).ToDictionaryAsync(p => p.Id, ct);

        var assessmentIds = current.Select(a => a.Id).ToList();
        var submissions = assessmentIds.Count == 0 ? [] : await db.Submissions.AsNoTracking()
            .Where(s => s.AssessmentId != null && assessmentIds.Contains(s.AssessmentId.Value) && s.Status == SubmissionStatus.Graded)
            .ToListAsync(ct);
        var byAssessment = submissions.ToLookup(s => s.AssessmentId);

        var rows = current.Select(a =>
        {
            var lesson = lessons[a.LessonId];
            var product = products.GetValueOrDefault(lesson.LearningProductId);
            var subs = byAssessment[a.Id].ToList();
            return new AssessmentOverviewRow(
                a.Id, a.Title, a.Status.ToString(), a.Kind.ToString(),
                lesson.Id, lesson.Title, lesson.LearningProductId, product?.Title ?? "(unknown product)",
                a.Questions.Count, subs.Count,
                subs.Count == 0 ? null : (int)Math.Round(subs.Average(s => s.ScorePercent)),
                subs.Count == 0 ? null : (int)Math.Round(subs.Count(s => s.Passed) * 100.0 / subs.Count));
        })
        .OrderBy(r => r.ProductTitle).ThenBy(r => r.LessonTitle).ThenBy(r => r.Kind)
        .ToList();

        return ProvisioningResult<AssessmentOverviewResponse>.Success(new AssessmentOverviewResponse(rows));
    }

    public async Task<ProvisioningResult<AssessmentDetailResponse>> GetDetailAsync(
        string slug, Guid caller, Guid assessmentId, CancellationToken ct = default)
    {
        var wctx = await ResolveWorkspaceAsync(slug, caller, ct);
        if (wctx.Error is not null) return Fail<AssessmentDetailResponse>(wctx.Error.Value);

        var assessment = await db.Assessments.Include(a => a.Questions).AsNoTracking()
            .FirstOrDefaultAsync(a => a.Id == assessmentId && a.WorkspaceId == wctx.Workspace!.Id, ct);
        if (assessment is null) return Fail<AssessmentDetailResponse>((ProvisioningError.NotFound, "No such assessment."));

        var lesson = await db.Lessons.AsNoTracking().FirstOrDefaultAsync(l => l.Id == assessment.LessonId, ct);
        var product = lesson is null ? null : await db.LearningProducts.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == lesson.LearningProductId, ct);

        var submissions = await db.Submissions.Include(s => s.Answers).AsNoTracking()
            .Where(s => s.AssessmentId == assessmentId && s.Status == SubmissionStatus.Graded)
            .OrderByDescending(s => s.GradedAt)
            .ToListAsync(ct);

        var membershipIds = submissions.Select(s => s.MembershipId).Distinct().ToList();
        var memberships = membershipIds.Count == 0 ? [] : await db.Memberships.AsNoTracking()
            .Where(m => membershipIds.Contains(m.Id)).ToListAsync(ct);
        var identityIds = memberships.Select(m => m.IdentityId).ToList();
        var identities = identityIds.Count == 0 ? new Dictionary<Guid, Identity>() : await db.Identities.AsNoTracking()
            .Where(i => identityIds.Contains(i.Id)).ToDictionaryAsync(i => i.Id, ct);
        var identityByMembership = memberships.ToDictionary(m => m.Id, m => identities.GetValueOrDefault(m.IdentityId));

        var submissionRows = submissions.Select(s =>
        {
            var identity = identityByMembership.GetValueOrDefault(s.MembershipId);
            return new AssessmentSubmissionRow(
                s.Id, s.MembershipId, identity?.FullName ?? "(unknown)", identity?.Email ?? "(unknown)",
                s.EffectiveScorePercent, s.EffectivePassed, s.GradedAt ?? s.StartedAt,
                s.OverriddenAt is not null, s.OverrideNote);
        }).ToList();

        var questionRows = assessment.Questions.OrderBy(q => q.Position).Select(q =>
        {
            var answers = submissions.SelectMany(s => s.Answers).Where(a => a.QuestionId == q.Id).ToList();
            int? correctCount;
            IReadOnlyList<int>? optionCounts = null;

            switch (q.Type)
            {
                case QuestionType.MultipleChoice:
                case QuestionType.TrueFalse:
                    correctCount = answers.Count(a => a.SelectedOptionIndex == q.CorrectOptionIndex);
                    optionCounts = Enumerable.Range(0, q.Options.Count)
                        .Select(i => answers.Count(a => a.SelectedOptionIndex == i)).ToList();
                    break;
                case QuestionType.CompleteTheSentence:
                    correctCount = answers.Count(a => !string.IsNullOrWhiteSpace(a.TextAnswer)
                        && q.AcceptedAnswers.Any(acc => string.Equals(acc, a.TextAnswer!.Trim(), StringComparison.OrdinalIgnoreCase)));
                    break;
                default: // OpenAnswer — reviewed, never scored
                    correctCount = null;
                    break;
            }

            return new QuestionStatsRow(q.Id, q.Prompt, q.Type.ToString(), q.Points, answers.Count, correctCount, optionCounts);
        }).ToList();

        return ProvisioningResult<AssessmentDetailResponse>.Success(new AssessmentDetailResponse(
            assessment.Id, assessment.Title, assessment.Status.ToString(), assessment.PassingThresholdPercent,
            assessment.LessonId, lesson?.Title ?? "(unknown lesson)",
            lesson?.LearningProductId ?? Guid.Empty, product?.Title ?? "(unknown product)",
            questionRows, submissionRows));
    }

    /// <summary>
    /// A tutor's manual correction of an already-graded Assessment-target
    /// Submission — e.g. the auto-grader marked a legitimate synonym answer
    /// wrong. Workspace-scoped by joining through the owning Assessment,
    /// since Submission itself carries no WorkspaceId of its own.
    /// </summary>
    public async Task<ProvisioningResult<AssessmentSubmissionRow>> OverrideGradeAsync(
        string slug, Guid caller, Guid submissionId, OverrideGradeRequest request, CancellationToken ct = default)
    {
        var wctx = await ResolveWorkspaceAsync(slug, caller, ct);
        if (wctx.Error is not null) return Fail<AssessmentSubmissionRow>(wctx.Error.Value);

        var submission = await db.Submissions.FirstOrDefaultAsync(s => s.Id == submissionId, ct);
        if (submission is null || submission.AssessmentId is null)
            return Fail<AssessmentSubmissionRow>((ProvisioningError.NotFound, "No such submission."));

        var belongsToWorkspace = await db.Assessments.AsNoTracking()
            .AnyAsync(a => a.Id == submission.AssessmentId && a.WorkspaceId == wctx.Workspace!.Id, ct);
        if (!belongsToWorkspace)
            return Fail<AssessmentSubmissionRow>((ProvisioningError.NotFound, "No such submission."));

        try { submission.OverrideGrade(wctx.MembershipId, request.Passed, request.ScorePercent, request.Note); }
        catch (InvalidOperationException ex) { return Fail<AssessmentSubmissionRow>((ProvisioningError.Conflict, ex.Message)); }
        catch (ArgumentException ex) { return Fail<AssessmentSubmissionRow>((ProvisioningError.Invalid, ex.Message)); }

        await db.SaveChangesAsync(ct);

        var membership = await db.Memberships.AsNoTracking().FirstOrDefaultAsync(m => m.Id == submission.MembershipId, ct);
        var identity = membership is null ? null : await db.Identities.AsNoTracking().FirstOrDefaultAsync(i => i.Id == membership.IdentityId, ct);
        return ProvisioningResult<AssessmentSubmissionRow>.Success(new AssessmentSubmissionRow(
            submission.Id, submission.MembershipId, identity?.FullName ?? "(unknown)", identity?.Email ?? "(unknown)",
            submission.EffectiveScorePercent, submission.EffectivePassed, submission.GradedAt ?? submission.StartedAt,
            submission.OverriddenAt is not null, submission.OverrideNote));
    }

    private record WorkspaceContext(Workspace? Workspace, Guid MembershipId, (ProvisioningError Error, string Message)? Error);

    private async Task<WorkspaceContext> ResolveWorkspaceAsync(string slug, Guid caller, CancellationToken ct)
    {
        var normalised = slug.ToLowerInvariant().Trim();

        var workspace = await db.Workspaces.AsNoTracking().FirstOrDefaultAsync(w => w.Slug == normalised, ct);
        if (workspace is null) return new WorkspaceContext(null, Guid.Empty, (ProvisioningError.NotFound, "No such workspace."));

        var member = await db.Memberships.Include(m => m.Roles).AsNoTracking()
            .FirstOrDefaultAsync(m => m.WorkspaceId == workspace.Id && m.IdentityId == caller
                                   && m.Status == MembershipStatus.Active, ct);
        if (member is null) return new WorkspaceContext(null, Guid.Empty, (ProvisioningError.NotFound, "No such workspace."));

        if (!member.Roles.Any(r => AuthorRoles.Contains(r.Name)))
            return new WorkspaceContext(null, member.Id, (ProvisioningError.Forbidden, "Only an owner, administrator or teacher can view the gradebook."));

        return new WorkspaceContext(workspace, member.Id, null);
    }

    // ── Reading ──────────────────────────────────────────────────────────────

    /// <summary>
    /// kind trails ct (rather than sitting next to lessonId) purely so every
    /// existing positional call from AssessmentsController — all written
    /// before Kind existed — keeps compiling unchanged; StandaloneAssessmentsController
    /// is the only caller that ever passes AssessmentKind.Standalone.
    /// </summary>
    public async Task<ProvisioningResult<AssessmentResponse>> GetAsync(
        string slug, Guid caller, Guid lessonId, CancellationToken ct = default, AssessmentKind kind = AssessmentKind.Interactive)
    {
        var ctx = await ResolveAsync(slug, caller, lessonId, requireAuthor: false, ct);
        if (ctx.Error is not null) return Fail<AssessmentResponse>(ctx.Error.Value);

        var assessment = await LoadAsync(ctx.TargetRevisionId, kind, ct);
        return ProvisioningResult<AssessmentResponse>.Success(Describe(lessonId, kind, assessment));
    }

    // ── Structure ────────────────────────────────────────────────────────────

    public Task<ProvisioningResult<AssessmentResponse>> SaveAsync(
        string slug, Guid caller, Guid lessonId, SaveAssessmentRequest request, CancellationToken ct = default, AssessmentKind kind = AssessmentKind.Interactive)
        => MutateAsync(slug, caller, lessonId, kind, (a, _) =>
        {
            a.Rename(request.Title);
            if (request.PassingThresholdPercent is { } threshold) a.SetPassingThreshold(threshold);
            a.SetAttemptLimit(request.AttemptLimit);
        }, ct, createIfMissing: true);

    public Task<ProvisioningResult<AssessmentResponse>> AddQuestionAsync(
        string slug, Guid caller, Guid lessonId, SaveQuestionRequest request, CancellationToken ct = default, AssessmentKind kind = AssessmentKind.Interactive)
        => MutateAsync(slug, caller, lessonId, kind, (a, _) =>
            a.AddQuestion(ParseType(request.Type), request.Prompt, request.Options, request.CorrectOptionIndex, request.AcceptedAnswers,
                           request.Explanation, request.VideoTimestampSeconds, request.Points, request.AssessedObjective, ParseTierOrNull(request.DifficultyTier)),
            ct, createIfMissing: true, defaultTitle: true, notifyOnLiveEdit: true);

    public Task<ProvisioningResult<AssessmentResponse>> UpdateQuestionAsync(
        string slug, Guid caller, Guid lessonId, Guid questionId, SaveQuestionRequest request, CancellationToken ct = default, AssessmentKind kind = AssessmentKind.Interactive)
        => MutateAsync(slug, caller, lessonId, kind, (a, _) =>
            a.UpdateQuestion(questionId, ParseType(request.Type), request.Prompt, request.Options, request.CorrectOptionIndex, request.AcceptedAnswers,
                              request.Explanation, request.VideoTimestampSeconds, request.Points, request.AssessedObjective, ParseTierOrNull(request.DifficultyTier)),
            ct, notifyOnLiveEdit: true);

    private static QuestionType ParseType(string type) =>
        Enum.TryParse<QuestionType>(type, out var parsed) ? parsed : QuestionType.MultipleChoice;

    private static DifficultyTier? ParseTierOrNull(string? tier) =>
        tier is not null && Enum.TryParse<DifficultyTier>(tier, out var parsed) ? parsed : null;

    public Task<ProvisioningResult<AssessmentResponse>> RemoveQuestionAsync(
        string slug, Guid caller, Guid lessonId, Guid questionId, CancellationToken ct = default, AssessmentKind kind = AssessmentKind.Interactive)
        => MutateAsync(slug, caller, lessonId, kind, (a, _) => a.RemoveQuestion(questionId), ct, notifyOnLiveEdit: true);

    public Task<ProvisioningResult<AssessmentResponse>> PublishAsync(
        string slug, Guid caller, Guid lessonId, CancellationToken ct = default, AssessmentKind kind = AssessmentKind.Interactive)
        => MutateAsync(slug, caller, lessonId, kind, (a, _) => a.Publish(), ct);

    public Task<ProvisioningResult<AssessmentResponse>> UnpublishAsync(
        string slug, Guid caller, Guid lessonId, CancellationToken ct = default, AssessmentKind kind = AssessmentKind.Interactive)
        => MutateAsync(slug, caller, lessonId, kind, (a, _) => a.Unpublish(), ct);

    /// <summary>
    /// Opts a lesson's Standalone quiz into (or out of, or reconfigures)
    /// adaptive delivery (Adaptive Assessment — Design Proposal §3). Scoped
    /// to Standalone by its default kind, matching every other Standalone-
    /// only endpoint on this service — Assessment.ConfigureAdaptive itself
    /// also rejects Interactive, so this is defense in depth, not the only gate.
    /// </summary>
    public Task<ProvisioningResult<AssessmentResponse>> ConfigureAdaptiveAsync(
        string slug, Guid caller, Guid lessonId, AdaptiveConfigurationRequest request, CancellationToken ct = default, AssessmentKind kind = AssessmentKind.Standalone)
        => MutateAsync(slug, caller, lessonId, kind, (a, _) => a.ConfigureAdaptive(ParseAdaptiveConfiguration(request)),
            ct, createIfMissing: true, defaultTitle: true);

    private static AdaptiveConfiguration ParseAdaptiveConfiguration(AdaptiveConfigurationRequest r) => new(
        r.Enabled, r.QuestionsPerAttempt, ParseTier(r.StartingDifficulty), ParseTier(r.MinDifficulty), ParseTier(r.MaxDifficulty),
        (r.DifficultyPoints ?? new Dictionary<string, int>())
            .Where(kv => Enum.TryParse<DifficultyTier>(kv.Key, out _))
            .ToDictionary(kv => ParseTier(kv.Key), kv => kv.Value));

    private static DifficultyTier ParseTier(string tier) =>
        Enum.TryParse<DifficultyTier>(tier, out var parsed) ? parsed : DifficultyTier.Medium;

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
        var outputLanguage = await GetLessonLanguageAsync(ctx.LearningProductId, ct);

        IReadOnlyList<SuggestedQuestion> suggestions;
        try
        {
            suggestions = chapters is { Count: > 0 }
                ? await SuggestFromChaptersAsync(ctx.LessonTitle ?? "Untitled lesson", chapters, request.VideoDurationSeconds, outputLanguage, ctx.Workspace!.Id, ct, revision?.LearningObjectives)
                : await generateQuestions.SuggestAsync(
                    ctx.LessonTitle ?? "Untitled lesson", revision?.Body, revision?.Transcript, ParseSegments(revision),
                    request.VideoDurationSeconds, Math.Clamp(request.VideoDurationSeconds / 180, 1, MaxSuggestedQuestions),
                    outputLanguage, ctx.Workspace!.Id, ct, revision?.LearningObjectives);
        }
        catch (CreditsExhaustedException ex)
        {
            return ProvisioningResult<IReadOnlyList<SuggestedQuestion>>.FailCreditsExhausted(ex.Message, ex.Cost, ex.RemainingBalance);
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
        string lessonTitle, IReadOnlyList<TranscriptChapter> chapters, int videoDurationSeconds,
        string? outputLanguage, Guid workspaceId, CancellationToken ct, string? learningObjectives = null)
    {
        var results = new List<SuggestedQuestion>();
        var picked = chapters.Take(MaxSuggestedQuestions).ToList();

        for (var i = 0; i < picked.Count; i++)
        {
            var chapter = picked[i];
            var questionType = QuestionTypeRotation[i % QuestionTypeRotation.Length];
            var suggestion = await generateQuestions.SuggestForChapterAsync(
                lessonTitle, chapter.Title, chapter.Summary, questionType, outputLanguage, workspaceId, ct, learningObjectives);

            var timestamp = Math.Clamp((int)chapter.StartSeconds, 0, Math.Max(videoDurationSeconds - 1, 0));
            results.Add(suggestion with { VideoTimestampSeconds = timestamp });
        }

        return results;
    }

    /// <summary>Caps how many draft questions one request can ask for — the Standalone quiz has no video duration to derive a sensible count from, so the tutor asks for a count directly instead.</summary>
    private const int MaxSuggestedStandaloneQuestions = 10;

    public async Task<ProvisioningResult<IReadOnlyList<SuggestedStandaloneQuestion>>> SuggestStandaloneQuestionsAsync(
        string slug, Guid caller, Guid lessonId, AiSuggestStandaloneQuestionsRequest request, CancellationToken ct = default)
    {
        var ctx = await ResolveAsync(slug, caller, lessonId, requireAuthor: true, ct);
        if (ctx.Error is not null) return Fail<IReadOnlyList<SuggestedStandaloneQuestion>>(ctx.Error.Value);

        if (!await HasAssessmentAiAsync(ctx.Workspace!.Id, ct))
            return Fail<IReadOnlyList<SuggestedStandaloneQuestion>>((ProvisioningError.Forbidden,
                "AI-suggested questions need the Professional plan or the AI Assessment pack. Upgrade to use this."));

        var count = Math.Clamp(request.QuestionCount <= 0 ? 5 : request.QuestionCount, 1, MaxSuggestedStandaloneQuestions);

        var revision = await LoadTargetRevisionAsync(ctx.Workspace!.Id, lessonId, ctx.TargetRevisionId, ct);
        var outputLanguage = await GetLessonLanguageAsync(ctx.LearningProductId, ct);

        IReadOnlyList<SuggestedStandaloneQuestion> suggestions;
        try
        {
            suggestions = await generateStandaloneQuestions.SuggestAsync(
                ctx.LessonTitle ?? "Untitled lesson", revision?.Body, revision?.Transcript,
                revision?.WhatYoullLearn, revision?.LearningObjectives, revision?.Glossary,
                count, outputLanguage, ctx.Workspace!.Id, ct);
        }
        catch (CreditsExhaustedException ex)
        {
            return ProvisioningResult<IReadOnlyList<SuggestedStandaloneQuestion>>.FailCreditsExhausted(ex.Message, ex.Cost, ex.RemainingBalance);
        }
        catch (InvalidOperationException ex)
        {
            // Model unavailable, misconfigured key, or unparseable output —
            // surfaced as a normal failure rather than a 500, same as
            // SuggestQuestionsAsync's identical handling.
            return Fail<IReadOnlyList<SuggestedStandaloneQuestion>>((ProvisioningError.Conflict, $"AI question generation failed: {ex.Message}"));
        }

        return ProvisioningResult<IReadOnlyList<SuggestedStandaloneQuestion>>.Success(suggestions);
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

    /// <summary>
    /// Same "Ready + parseable" gating as <see cref="ParseChapters"/>, feeding
    /// the duration-based (no-chapters) fallback path with real ASR segment
    /// timing so GenerateQuestionsSkill can snap suggested checkpoints to an
    /// actual moment in the video instead of a number the model guessed.
    /// </summary>
    private static IReadOnlyList<TranscriptSegment>? ParseSegments(LessonRevision? revision)
    {
        if (revision?.TranscriptStatus != TranscriptStatus.Ready || string.IsNullOrWhiteSpace(revision.TranscriptSegmentsJson))
            return null;

        try
        {
            return JsonSerializer.Deserialize<List<TranscriptSegment>>(revision.TranscriptSegmentsJson);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    public async Task<ProvisioningResult<PreviewResult>> PreviewAsync(
        string slug, Guid caller, Guid lessonId, PreviewSubmitRequest request, CancellationToken ct = default, AssessmentKind kind = AssessmentKind.Interactive)
    {
        var ctx = await ResolveAsync(slug, caller, lessonId, requireAuthor: true, ct);
        if (ctx.Error is not null) return Fail<PreviewResult>(ctx.Error.Value);

        if (!await HasAssessmentAiAsync(ctx.Workspace!.Id, ct))
            return Fail<PreviewResult>((ProvisioningError.Forbidden,
                "AI preview grading needs the Professional plan or the AI Assessment pack. Upgrade to use this."));

        var assessment = await LoadAsync(ctx.TargetRevisionId, kind, ct);
        if (assessment is null || assessment.Questions.Count == 0)
            return Fail<PreviewResult>((ProvisioningError.Conflict, "This lesson has no questions to preview yet."));

        var byQuestion = request.Answers.ToDictionary(a => a.QuestionId, a => new SubmittedAnswer(a.SelectedOptionIndex, a.TextAnswer));

        (int ScorePercent, bool Passed, IReadOnlyList<QuestionGradeResult> PerQuestion, IReadOnlyList<CompetencyResult> CompetencyLevels) graded;
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
                assessment.PassingThresholdPercent, openAnswers, ctx.Workspace!.Id, ct);
        }
        catch (Exception ex) when (ex is InvalidOperationException or CreditsExhaustedException)
        {
            // Model unavailable/misconfigured, or out of AI credits — fall
            // back to the deterministic summary rather than failing a
            // preview the score itself already computed successfully.
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
            graded.PerQuestion.Select(q => new PreviewQuestionResult(q.QuestionId, q.Correct, q.CorrectAnswerDisplay)).ToList(),
            graded.CompetencyLevels.Select(c => new CompetencyResultRow(c.Objective, c.Level.ToString())).ToList()));
    }

    /// <summary>Both simulated-AI surfaces are the Assessment domain's AI-assist tier — gated the same way (LIC-008).</summary>
    private Task<bool> HasAssessmentAiAsync(Guid workspaceId, CancellationToken ct) =>
        entitlements.HasEntitlementAsync(
            workspaceId, EntitlementResolutionService.AiKey(CapabilityDomain.Assessment),
            AiAssistanceLevel.Assist.ToString(), ct);

    // ── Plumbing ─────────────────────────────────────────────────────────────

    private async Task<Assessment?> LoadAsync(Guid? lessonRevisionId, AssessmentKind kind, CancellationToken ct, bool tracked = false)
    {
        if (lessonRevisionId is null) return null;
        var q = db.Assessments.Include(a => a.Questions).Where(a => a.LessonRevisionId == lessonRevisionId && a.Kind == kind);
        return tracked ? await q.FirstOrDefaultAsync(ct) : await q.AsNoTracking().FirstOrDefaultAsync(ct);
    }

    private static AssessmentResponse Describe(Guid lessonId, AssessmentKind kind, Assessment? a) => new(
        Id: a?.Id,
        LessonId: lessonId,
        Title: a?.Title,
        Status: a?.Status.ToString() ?? "None",
        Kind: kind.ToString(),
        PassingThresholdPercent: a?.PassingThresholdPercent ?? 70,
        AttemptLimit: a?.AttemptLimit,
        PublicationBlocker: a is null
            ? (kind == AssessmentKind.Standalone
                ? "This lesson has no standalone quiz yet — add a question to start."
                : "This lesson has no interactive questions yet — add one to start.")
            : a.PublicationBlocker(),
        Questions: a is null ? [] : a.Questions.OrderBy(q => q.Position)
            .Select(q => new QuestionRow(q.Id, q.Type.ToString(), q.Prompt, q.Options, q.CorrectOptionIndex, q.AcceptedAnswers, q.Explanation, q.VideoTimestampSeconds, q.Points, q.Position, q.AssessedObjective, q.DifficultyTier?.ToString()))
            .ToList(),
        AdaptiveConfiguration: a?.AdaptiveConfiguration is null ? null : new AdaptiveConfigurationResponse(
            a.AdaptiveConfiguration.Enabled, a.AdaptiveConfiguration.QuestionsPerAttempt,
            a.AdaptiveConfiguration.StartingDifficulty.ToString(), a.AdaptiveConfiguration.MinDifficulty.ToString(), a.AdaptiveConfiguration.MaxDifficulty.ToString(),
            a.AdaptiveConfiguration.DifficultyPoints.ToDictionary(kv => kv.Key.ToString(), kv => kv.Value)));

    private async Task<ProvisioningResult<AssessmentResponse>> MutateAsync(
        string slug, Guid caller, Guid lessonId, AssessmentKind kind, Action<Assessment, Guid> mutate, CancellationToken ct,
        bool createIfMissing = false, bool defaultTitle = false, bool notifyOnLiveEdit = false)
    {
        var ctx = await ResolveAsync(slug, caller, lessonId, requireAuthor: true, ct);
        if (ctx.Error is not null) return Fail<AssessmentResponse>(ctx.Error.Value);
        if (ctx.TargetRevisionId is null)
            return Fail<AssessmentResponse>((ProvisioningError.Conflict, "This lesson has no revision to attach questions to yet."));

        var assessment = await LoadAsync(ctx.TargetRevisionId, kind, ct, tracked: true);

        if (assessment is null)
        {
            if (!createIfMissing)
                return Fail<AssessmentResponse>((ProvisioningError.Conflict,
                    kind == AssessmentKind.Standalone ? "This lesson has no standalone quiz yet." : "This lesson has no interactive questions yet."));

            var defaultSuffix = kind == AssessmentKind.Standalone ? " — Lesson Quiz" : " — Interactive Questions";
            assessment = Assessment.Create(ctx.Workspace!.Id, lessonId, ctx.TargetRevisionId.Value,
                defaultTitle ? $"{ctx.LessonTitle}{defaultSuffix}" : ctx.LessonTitle!, kind);
            db.Assessments.Add(assessment);
        }

        try { mutate(assessment, ctx.MembershipId); }
        catch (InvalidOperationException ex) { return Fail<AssessmentResponse>((ProvisioningError.Conflict, ex.Message)); }
        catch (ArgumentException ex) { return Fail<AssessmentResponse>((ProvisioningError.Invalid, ex.Message)); }

        // Lesson Editing & Publication UX, Scenario 4: editing questions on the
        // lesson's currently PUBLISHED revision, whose Assessment is itself
        // already Published (i.e. learners can already see it — this isn't a
        // separate draft revision nobody's been served yet), notifies every
        // learner who has engaged with this lesson at all. Same notification
        // either way — a learner doesn't need to know which kind changed,
        // just that this lesson's questions did.
        if (notifyOnLiveEdit && ctx.TargetRevisionId == ctx.CurrentRevisionId && assessment.Status == AssessmentStatus.Published)
            await NotifyQuestionsUpdatedAsync(ctx.Workspace!.Id, lessonId, ct);

        await db.SaveChangesAsync(ct);
        return await GetAsync(slug, caller, lessonId, ct, kind);
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

    private record Context(Workspace? Workspace, Guid MembershipId, string? LessonTitle, Guid LearningProductId, Guid? TargetRevisionId, Guid? CurrentRevisionId, (ProvisioningError Error, string Message)? Error);

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
        if (workspace is null) return new Context(null, Guid.Empty, null, Guid.Empty, null, null, (ProvisioningError.NotFound, "No such workspace."));

        var member = await db.Memberships.Include(m => m.Roles).AsNoTracking()
            .FirstOrDefaultAsync(m => m.WorkspaceId == workspace.Id && m.IdentityId == caller
                                   && m.Status == MembershipStatus.Active, ct);
        if (member is null) return new Context(null, Guid.Empty, null, Guid.Empty, null, null, (ProvisioningError.NotFound, "No such workspace."));

        if (requireAuthor && !member.Roles.Any(r => AuthorRoles.Contains(r.Name)))
            return new Context(null, member.Id, null, Guid.Empty, null, null, (ProvisioningError.Forbidden, "Only an owner, administrator or teacher can author content."));

        var lesson = await db.Lessons.Include(l => l.Revisions).AsNoTracking()
            .FirstOrDefaultAsync(l => l.Id == lessonId && l.WorkspaceId == workspace.Id, ct);
        if (lesson is null) return new Context(null, member.Id, null, Guid.Empty, null, null, (ProvisioningError.NotFound, "No such lesson."));

        var targetRevisionId = lesson.DraftRevision?.Id ?? lesson.CurrentRevisionId;
        return new Context(workspace, member.Id, lesson.Title, lesson.LearningProductId, targetRevisionId, lesson.CurrentRevisionId, null);
    }

    /// <summary>
    /// The Learning Product's own configured language, passed to AI skills as
    /// an explicit output-language instruction — see ContentStudioService's
    /// identical helper for the full rationale.
    /// </summary>
    private Task<string?> GetLessonLanguageAsync(Guid learningProductId, CancellationToken ct) =>
        db.LearningProducts.AsNoTracking()
            .Where(p => p.Id == learningProductId)
            .Select(p => p.DefaultLanguage)
            .FirstOrDefaultAsync(ct);

    private static ProvisioningResult<T> Fail<T>((ProvisioningError Error, string Message) e)
        => ProvisioningResult<T>.Fail(e.Error, e.Message);
}
