using Platform.Domain;

namespace Platform.Domain.Tests;

/// <summary>
/// Adaptive Assessment — Design Proposal: the §4a.1 Grade() subset-grading
/// bug and its §4a.2 fix, the §4a.5 staircase rule (including clamping),
/// the §4a.6 expectedAnswerSequence concurrency guard, and the §3
/// publish-time pool validation.
/// </summary>
public class AdaptiveAssessmentTests
{
    private static Assessment NewStandaloneAssessment(int passingThresholdPercent = 70)
    {
        var assessment = Assessment.Create(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "Adaptive Quiz", AssessmentKind.Standalone);
        assessment.SetPassingThreshold(passingThresholdPercent);
        return assessment;
    }

    private static Question AddQuestion(Assessment assessment, DifficultyTier? tier, bool correctIsOptionZero = true) =>
        assessment.AddQuestion(
            QuestionType.MultipleChoice, "2 + 2 = ?",
            options: ["4", "5"], correctOptionIndex: correctIsOptionZero ? 0 : 1, acceptedAnswers: null,
            explanation: null, videoTimestampSeconds: null, points: 1, assessedObjective: null, difficultyTier: tier);

    private static SubmittedAnswer Correct() => new(0, null);
    private static SubmittedAnswer Incorrect() => new(1, null);

    private static AdaptiveConfiguration BasicConfig(int questionsPerAttempt = 3, DifficultyTier startingDifficulty = DifficultyTier.Medium) => new(
        Enabled: true,
        QuestionsPerAttempt: questionsPerAttempt,
        StartingDifficulty: startingDifficulty,
        MinDifficulty: DifficultyTier.Easy,
        MaxDifficulty: DifficultyTier.Hard,
        DifficultyPoints: new Dictionary<DifficultyTier, int> { [DifficultyTier.Easy] = 1, [DifficultyTier.Medium] = 2, [DifficultyTier.Hard] = 3 });

    // ── §4a.1/§4a.2: Grade() subset grading ─────────────────────────────────

    [Fact]
    public void Grade_WithQuestionIdsToGrade_DoesNotPenalizeUnaskedQuestions()
    {
        var assessment = NewStandaloneAssessment();
        var asked = AddQuestion(assessment, null);
        AddQuestion(assessment, null); // never answered, never in questionIdsToGrade
        AddQuestion(assessment, null); // same

        var (scorePercent, passed, perQuestion, _) = assessment.Grade(
            new Dictionary<Guid, SubmittedAnswer> { [asked.Id] = Correct() },
            questionIdsToGrade: [asked.Id]);

        Assert.Equal(100, scorePercent); // not 33% — the two unasked questions must not count as wrong
        Assert.True(passed);
        Assert.Single(perQuestion);
    }

    [Fact]
    public void Grade_WithNullQuestionIdsToGrade_GradesEveryQuestion_SameAsBeforeThisFeature()
    {
        var assessment = NewStandaloneAssessment();
        var q1 = AddQuestion(assessment, null);
        var q2 = AddQuestion(assessment, null);

        // Only q1 answered; q2 omitted from the answer dictionary entirely.
        var (scorePercent, passed, perQuestion, _) = assessment.Grade(
            new Dictionary<Guid, SubmittedAnswer> { [q1.Id] = Correct() });

        Assert.Equal(50, scorePercent); // q2 counts as wrong — today's existing (non-adaptive) behavior, unchanged
        Assert.False(passed);
        Assert.Equal(2, perQuestion.Count);
    }

    // ── §4a.5 staircase + clamping ───────────────────────────────────────────

    [Fact]
    public void RecordAdaptiveAnswer_Correct_StepsUpOneTier()
    {
        var assessment = NewStandaloneAssessment();
        assessment.ConfigureAdaptive(BasicConfig());
        var easy = AddQuestion(assessment, DifficultyTier.Easy);
        AddQuestion(assessment, DifficultyTier.Medium);
        AddQuestion(assessment, DifficultyTier.Hard);
        AddQuestion(assessment, DifficultyTier.Medium);

        var submission = Submission.Start(assessment.Id, Guid.NewGuid(), Guid.NewGuid());
        var outcome = submission.RecordAdaptiveAnswer(assessment, expectedAnswerSequence: 0, easy.Id, Correct());

        var next = Assert.IsType<AdaptiveAnswerOutcome.NextQuestion>(outcome);
        Assert.Equal(DifficultyTier.Medium, next.Tier);
    }

    [Fact]
    public void RecordAdaptiveAnswer_Incorrect_StepsDownOneTier()
    {
        var assessment = NewStandaloneAssessment();
        assessment.ConfigureAdaptive(BasicConfig());
        var hard = AddQuestion(assessment, DifficultyTier.Hard);
        AddQuestion(assessment, DifficultyTier.Medium);
        AddQuestion(assessment, DifficultyTier.Easy);
        AddQuestion(assessment, DifficultyTier.Medium);

        var submission = Submission.Start(assessment.Id, Guid.NewGuid(), Guid.NewGuid());
        var outcome = submission.RecordAdaptiveAnswer(assessment, expectedAnswerSequence: 0, hard.Id, Incorrect());

        var next = Assert.IsType<AdaptiveAnswerOutcome.NextQuestion>(outcome);
        Assert.Equal(DifficultyTier.Medium, next.Tier);
    }

    [Fact]
    public void RecordAdaptiveAnswer_CorrectAtMaxDifficulty_ClampsAtMax()
    {
        var assessment = NewStandaloneAssessment();
        assessment.ConfigureAdaptive(BasicConfig());
        var hard1 = AddQuestion(assessment, DifficultyTier.Hard);
        var hard2 = AddQuestion(assessment, DifficultyTier.Hard);
        AddQuestion(assessment, DifficultyTier.Medium);
        AddQuestion(assessment, DifficultyTier.Easy);

        var submission = Submission.Start(assessment.Id, Guid.NewGuid(), Guid.NewGuid());
        var outcome = submission.RecordAdaptiveAnswer(assessment, expectedAnswerSequence: 0, hard1.Id, Correct());

        var next = Assert.IsType<AdaptiveAnswerOutcome.NextQuestion>(outcome);
        Assert.Equal(DifficultyTier.Hard, next.Tier); // already at MaxDifficulty — stays, doesn't overflow
        Assert.Equal(hard2.Id, next.QuestionId);
    }

    [Fact]
    public void RecordAdaptiveAnswer_IncorrectAtMinDifficulty_ClampsAtMin()
    {
        var assessment = NewStandaloneAssessment();
        assessment.ConfigureAdaptive(BasicConfig());
        var easy1 = AddQuestion(assessment, DifficultyTier.Easy);
        var easy2 = AddQuestion(assessment, DifficultyTier.Easy);
        AddQuestion(assessment, DifficultyTier.Medium);
        AddQuestion(assessment, DifficultyTier.Hard);

        var submission = Submission.Start(assessment.Id, Guid.NewGuid(), Guid.NewGuid());
        var outcome = submission.RecordAdaptiveAnswer(assessment, expectedAnswerSequence: 0, easy1.Id, Incorrect());

        var next = Assert.IsType<AdaptiveAnswerOutcome.NextQuestion>(outcome);
        Assert.Equal(DifficultyTier.Easy, next.Tier); // already at MinDifficulty — stays, doesn't underflow
        Assert.Equal(easy2.Id, next.QuestionId);
    }

    [Fact]
    public void RecordAdaptiveAnswer_NeverReturnsAnAlreadyUsedQuestion()
    {
        var assessment = NewStandaloneAssessment();
        assessment.ConfigureAdaptive(BasicConfig(questionsPerAttempt: 2));
        var medium1 = AddQuestion(assessment, DifficultyTier.Medium);
        var medium2 = AddQuestion(assessment, DifficultyTier.Medium);

        var submission = Submission.Start(assessment.Id, Guid.NewGuid(), Guid.NewGuid());
        // Incorrect steps Medium -> Easy, but no Easy questions exist, so clamp
        // logic aside, let's instead verify exclusion directly via SelectNextAdaptiveQuestion.
        var excluded = new HashSet<Guid> { medium1.Id };
        var picked = assessment.SelectNextAdaptiveQuestion(DifficultyTier.Medium, excluded);

        Assert.Equal(medium2.Id, picked);
    }

    [Fact]
    public void SelectNextAdaptiveQuestion_ReturnsNull_WhenTierExhausted()
    {
        var assessment = NewStandaloneAssessment();
        var only = AddQuestion(assessment, DifficultyTier.Hard);

        var picked = assessment.SelectNextAdaptiveQuestion(DifficultyTier.Hard, new HashSet<Guid> { only.Id });

        Assert.Null(picked);
    }

    // ── §4a.6: expectedAnswerSequence concurrency guard ─────────────────────

    [Fact]
    public void RecordAdaptiveAnswer_WrongExpectedSequence_Throws()
    {
        var assessment = NewStandaloneAssessment();
        assessment.ConfigureAdaptive(BasicConfig());
        var q = AddQuestion(assessment, DifficultyTier.Medium);
        AddQuestion(assessment, DifficultyTier.Easy);
        AddQuestion(assessment, DifficultyTier.Hard);

        var submission = Submission.Start(assessment.Id, Guid.NewGuid(), Guid.NewGuid());

        Assert.Throws<InvalidOperationException>(() =>
            submission.RecordAdaptiveAnswer(assessment, expectedAnswerSequence: 1, q.Id, Correct()));
    }

    [Fact]
    public void RecordAdaptiveAnswer_DuplicateSubmitOfSameAnswer_SecondCallThrows()
    {
        var assessment = NewStandaloneAssessment();
        assessment.ConfigureAdaptive(BasicConfig());
        var q1 = AddQuestion(assessment, DifficultyTier.Medium);
        AddQuestion(assessment, DifficultyTier.Easy);
        AddQuestion(assessment, DifficultyTier.Hard);

        var submission = Submission.Start(assessment.Id, Guid.NewGuid(), Guid.NewGuid());
        submission.RecordAdaptiveAnswer(assessment, expectedAnswerSequence: 0, q1.Id, Correct());

        // A retried/racing request replaying sequence 0 again must be rejected, not double-counted.
        Assert.Throws<InvalidOperationException>(() =>
            submission.RecordAdaptiveAnswer(assessment, expectedAnswerSequence: 0, q1.Id, Correct()));
    }

    // ── Completion path ──────────────────────────────────────────────────────

    [Fact]
    public void RecordAdaptiveAnswer_ReachingQuestionsPerAttempt_CompletesAndGradesSubmission()
    {
        var assessment = NewStandaloneAssessment(passingThresholdPercent: 50);
        assessment.ConfigureAdaptive(BasicConfig(questionsPerAttempt: 2));
        var q1 = AddQuestion(assessment, DifficultyTier.Medium);
        var q2 = AddQuestion(assessment, DifficultyTier.Hard);

        var submission = Submission.Start(assessment.Id, Guid.NewGuid(), Guid.NewGuid());
        var first = submission.RecordAdaptiveAnswer(assessment, expectedAnswerSequence: 0, q1.Id, Correct());
        var next = Assert.IsType<AdaptiveAnswerOutcome.NextQuestion>(first);

        var second = submission.RecordAdaptiveAnswer(assessment, expectedAnswerSequence: 1, next.QuestionId, Correct());
        var complete = Assert.IsType<AdaptiveAnswerOutcome.Complete>(second);

        Assert.Equal(100, complete.ScorePercent);
        Assert.True(complete.Passed);
        Assert.Equal(SubmissionStatus.Graded, submission.Status);
        Assert.Equal(100, submission.ScorePercent);
        Assert.NotNull(submission.GradedAt);
        Assert.Equal(2, submission.Answers.Count);
    }

    [Fact]
    public void RecordAdaptiveAnswer_AfterGraded_Throws()
    {
        var assessment = NewStandaloneAssessment();
        assessment.ConfigureAdaptive(BasicConfig(questionsPerAttempt: 1));
        var q1 = AddQuestion(assessment, DifficultyTier.Medium);
        AddQuestion(assessment, DifficultyTier.Easy);

        var submission = Submission.Start(assessment.Id, Guid.NewGuid(), Guid.NewGuid());
        submission.RecordAdaptiveAnswer(assessment, expectedAnswerSequence: 0, q1.Id, Correct());

        Assert.Throws<InvalidOperationException>(() =>
            submission.RecordAdaptiveAnswer(assessment, expectedAnswerSequence: 1, q1.Id, Correct()));
    }

    // ── Invariants: auto-gradable-only pool, Standalone-only scope ─────────

    [Fact]
    public void Question_OpenAnswerWithDifficultyTier_Throws()
    {
        var assessment = NewStandaloneAssessment();

        Assert.Throws<ArgumentException>(() => assessment.AddQuestion(
            QuestionType.OpenAnswer, "Explain your reasoning.",
            options: null, correctOptionIndex: null, acceptedAnswers: null,
            explanation: null, videoTimestampSeconds: null, points: 1,
            assessedObjective: null, difficultyTier: DifficultyTier.Easy));
    }

    [Fact]
    public void ConfigureAdaptive_OnInteractiveAssessment_Throws()
    {
        var assessment = Assessment.Create(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "Video Checkpoints", AssessmentKind.Interactive);

        Assert.Throws<InvalidOperationException>(() => assessment.ConfigureAdaptive(BasicConfig()));
    }

    [Fact]
    public void ConfigureAdaptive_OnStandaloneAssessment_Succeeds()
    {
        var assessment = NewStandaloneAssessment();

        assessment.ConfigureAdaptive(BasicConfig());

        Assert.NotNull(assessment.AdaptiveConfiguration);
        Assert.True(assessment.AdaptiveConfiguration!.Enabled);
    }

    // ── §3: publish-time pool validation ─────────────────────────────────────

    [Fact]
    public void PublicationBlocker_InsufficientHardQuestions_BlocksPublish()
    {
        var assessment = NewStandaloneAssessment();
        // StartingDifficulty = Hard (already at Max), QuestionsPerAttempt = 3:
        // an all-correct learner just stays at Hard the whole attempt (Hard, Hard, Hard),
        // needing 3 distinct Hard questions — only 2 exist here. Easy/Medium each need
        // just 1 at this Starting/N combination, and the pool has exactly 1 of each, so
        // this isolates the shortfall to Hard specifically.
        AddQuestion(assessment, DifficultyTier.Easy);
        AddQuestion(assessment, DifficultyTier.Medium);
        AddQuestion(assessment, DifficultyTier.Hard);
        AddQuestion(assessment, DifficultyTier.Hard);
        assessment.ConfigureAdaptive(BasicConfig(questionsPerAttempt: 3, startingDifficulty: DifficultyTier.Hard));

        var blocker = assessment.PublicationBlocker();

        Assert.NotNull(blocker);
        Assert.Contains("Hard", blocker);
    }

    [Fact]
    public void PublicationBlocker_SufficientPoolForWorstCasePath_AllowsPublish()
    {
        var assessment = NewStandaloneAssessment();
        // Same shape as the test above, but with 3 Hard questions — exactly enough
        // for a learner who answers every question correctly and sits at Hard throughout.
        AddQuestion(assessment, DifficultyTier.Easy);
        AddQuestion(assessment, DifficultyTier.Medium);
        for (var i = 0; i < 3; i++) AddQuestion(assessment, DifficultyTier.Hard);
        assessment.ConfigureAdaptive(BasicConfig(questionsPerAttempt: 3, startingDifficulty: DifficultyTier.Hard));

        var blocker = assessment.PublicationBlocker();

        Assert.Null(blocker);
        assessment.Publish(); // should not throw
        Assert.Equal(AssessmentStatus.Published, assessment.Status);
    }

    [Fact]
    public void PublicationBlocker_OscillatingAnswers_CanExceedEitherMonotonicExtreme()
    {
        // Regression test for a real bug: checking only "always correct" and "always
        // incorrect" paths is not enough. Starting = Medium, Min = Easy, Max = Hard,
        // QuestionsPerAttempt = 3: a learner who alternates right/wrong bounces between
        // adjacent tiers (e.g. Medium -> Hard -> Medium, or Medium -> Easy -> Medium),
        // landing on Medium twice — one more time than either monotonic path ever does.
        // A pool with only 1 of each tier satisfies both monotonic extremes but must
        // still be blocked, because a real learner's answers are never guaranteed
        // monotonic. (Every tier is actually short by one here — Easy, Medium, and
        // Hard each need 2 — so which tier's name lands in the message first is an
        // implementation detail; what matters is that this now blocks at all.)
        var assessment = NewStandaloneAssessment();
        AddQuestion(assessment, DifficultyTier.Easy);
        AddQuestion(assessment, DifficultyTier.Medium);
        AddQuestion(assessment, DifficultyTier.Hard);
        assessment.ConfigureAdaptive(BasicConfig(questionsPerAttempt: 3, startingDifficulty: DifficultyTier.Medium));

        var blocker = assessment.PublicationBlocker();

        Assert.NotNull(blocker);
        Assert.Contains("at least 2", blocker);
    }

    [Fact]
    public void PublicationBlocker_NonAdaptiveAssessment_UnaffectedByAdaptiveRules()
    {
        var assessment = NewStandaloneAssessment();
        AddQuestion(assessment, null); // no tier at all — an ordinary, non-adaptive question

        Assert.Null(assessment.PublicationBlocker());
    }
}
