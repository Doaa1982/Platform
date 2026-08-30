namespace Platform.Domain;

/// <summary>One recorded answer within a Submission — the persisted counterpart to <see cref="SubmittedAnswer"/>.</summary>
public class SubmissionAnswer
{
    public Guid Id { get; private set; }
    public Guid SubmissionId { get; private set; }
    public Guid QuestionId { get; private set; }
    public int? SelectedOptionIndex { get; private set; }
    public string? TextAnswer { get; private set; }

    private SubmissionAnswer() { }

    internal static SubmissionAnswer Create(Guid submissionId, Guid questionId, int? selectedOptionIndex, string? textAnswer) => new()
    {
        Id = Guid.NewGuid(), SubmissionId = submissionId, QuestionId = questionId,
        SelectedOptionIndex = selectedOptionIndex, TextAnswer = textAnswer
    };
}

/// <summary>
/// One AssessedObjective's mastery level for this Submission, persisted at
/// grading time (Competency-Based Learning — Design Proposal §2 D2: scoped
/// to this one attempt, not a cross-time mastery record). Same ownership
/// shape as <see cref="SubmissionAnswer"/> — a child collection owned by
/// Submission, replaced wholesale each time this Submission is (re)graded.
/// </summary>
public class SubmissionCompetencyLevel
{
    public Guid Id { get; private set; }
    public Guid SubmissionId { get; private set; }
    public string Objective { get; private set; } = string.Empty;
    public CompetencyLevel Level { get; private set; }

    private SubmissionCompetencyLevel() { }

    internal static SubmissionCompetencyLevel Create(Guid submissionId, string objective, CompetencyLevel level) => new()
    {
        Id = Guid.NewGuid(), SubmissionId = submissionId, Objective = objective, Level = level
    };
}

/// <summary>
/// Submission Aggregate Root.
///
/// A Learner's attempt at one Target — an Assessment (a quiz) or, as of
/// v1.1, an Assignment (any other delivered Learning Activity) — never
/// both, never neither (Assessment and Submission Aggregate Design v1.1
/// §12 INV-001). The Assessment-target path is unchanged from before this
/// generalization: grading is always the same synchronous simulated-AI
/// method already built on <see cref="Assessment.Grade"/> (the same one
/// AssessmentService.PreviewAsync calls, ungraded), so it collapses to
/// InProgress → Graded, with no attempt limit enforced (INV-003) —
/// Assessment has no configured limit anywhere. The Assignment-target path
/// is not synchronous — a real gap exists between a learner's Response and
/// a tutor's Evaluation — so it passes through the fuller
/// Submitted → (optionally UnderReview) → Evaluated shape instead.
///
/// <see cref="Passed"/>/<see cref="ScorePercent"/>/<see cref="GradedAt"/>
/// remain Assessment-target-only and untouched by this generalization — a
/// separate <see cref="AssignmentPassed"/>/<see cref="Feedback"/>/
/// <see cref="EvaluatedAt"/> set exists for the Assignment-target path
/// instead of widening those, so every existing Assessment-target read site
/// keeps its original, non-nullable field shape.
/// </summary>
public class Submission
{
    private readonly List<SubmissionAnswer> _answers = [];
    private readonly List<SubmissionCompetencyLevel> _competencyLevels = [];

    public Guid Id { get; private set; }

    /// <summary>The Target when this Submission was started via <see cref="Start"/> — null for an Assignment-target Submission (INV-001).</summary>
    public Guid? AssessmentId { get; private set; }

    /// <summary>The Target when this Submission was started via <see cref="StartForAssignment"/> — null for an Assessment-target Submission (INV-001, v1.1).</summary>
    public Guid? AssignmentId { get; private set; }

    public Guid MembershipId { get; private set; }
    public Guid EnrollmentId { get; private set; }
    public SubmissionStatus Status { get; private set; }
    public int ScorePercent { get; private set; }
    public bool Passed { get; private set; }
    public DateTime StartedAt { get; private set; }
    public DateTime? GradedAt { get; private set; }

    // ── Assignment-target fields (v1.1) — untouched by the Assessment-target path above ──

    /// <summary>Which attempt this is for this learner against this Assignment (Submission Metadata, §8) — 1-based. Always 1 for an Assessment-target Submission (no attempt policy exists there to count against).</summary>
    public int AttemptNumber { get; private set; } = 1;

    /// <summary>Set by AssignmentService.ResetAttemptCountAsync (Assignment BA-011) — this attempt still exists as history (INV-005/INV-006's history-preservation ethos) but no longer counts toward the learner's attempt limit.</summary>
    public bool ExcludedFromAttemptCount { get; private set; }

    /// <summary>Assignment-target evidence (Response value object, §8) — free text. At least one of this or <see cref="ResponseLearningAssetId"/> is required before Submitted (INV-007).</summary>
    public string? ResponseText { get; private set; }

    /// <summary>Assignment-target evidence — an attached file, referenced by identifier only (AGG-003), same pattern as LessonResource.LearningAssetId.</summary>
    public Guid? ResponseLearningAssetId { get; private set; }

    public Guid? EvaluatorMembershipId { get; private set; }
    public AssignmentEvaluationMethod? EvaluationMethod { get; private set; }

    /// <summary>The Assignment-target counterpart of <see cref="Passed"/> — the Evaluator's own Pass/Fail judgment, since an Assignment has no Scoring Configuration to compare a score against (§10).</summary>
    public bool? AssignmentPassed { get; private set; }
    public string? Feedback { get; private set; }
    public DateTime? EvaluatedAt { get; private set; }

    public IReadOnlyCollection<SubmissionAnswer> Answers => _answers.AsReadOnly();

    /// <summary>Empty for a Submission with no AssessedObjective-tagged Questions — the backward-compatibility guarantee Competency-Based Learning §3 makes explicit.</summary>
    public IReadOnlyCollection<SubmissionCompetencyLevel> CompetencyLevels => _competencyLevels.AsReadOnly();

    private Submission() { }

    public static Submission Start(Guid assessmentId, Guid membershipId, Guid enrollmentId)
    {
        if (assessmentId == Guid.Empty)
            throw new ArgumentException("A Submission belongs to exactly one Assessment (INV-001).", nameof(assessmentId));
        if (membershipId == Guid.Empty)
            throw new ArgumentException("A Submission belongs to exactly one submitting Membership (INV-001).", nameof(membershipId));
        if (enrollmentId == Guid.Empty)
            throw new ArgumentException("A Submission is recorded against exactly one Enrollment.", nameof(enrollmentId));

        return new Submission
        {
            Id = Guid.NewGuid(),
            AssessmentId = assessmentId,
            MembershipId = membershipId,
            EnrollmentId = enrollmentId,
            Status = SubmissionStatus.InProgress,
            StartedAt = DateTime.UtcNow
        };
    }

    /// <summary>
    /// Starts an Assignment-target Submission (v1.1) — the counterpart of
    /// <see cref="Start"/> for a Learning Activity delivered without its own
    /// Assessment. <paramref name="attemptNumber"/> is supplied by the
    /// caller (AssignmentService), which counts this learner's prior
    /// non-excluded Submissions against the same Assignment first (INV-003)
    /// — this aggregate has no visibility into sibling Submissions itself.
    /// </summary>
    public static Submission StartForAssignment(Guid assignmentId, Guid membershipId, Guid enrollmentId, int attemptNumber)
    {
        if (assignmentId == Guid.Empty)
            throw new ArgumentException("A Submission belongs to exactly one Assignment (INV-001).", nameof(assignmentId));
        if (membershipId == Guid.Empty)
            throw new ArgumentException("A Submission belongs to exactly one submitting Membership (INV-001).", nameof(membershipId));
        if (enrollmentId == Guid.Empty)
            throw new ArgumentException("A Submission is recorded against exactly one Enrollment.", nameof(enrollmentId));
        if (attemptNumber <= 0)
            throw new ArgumentException("An attempt number must be positive.", nameof(attemptNumber));

        return new Submission
        {
            Id = Guid.NewGuid(),
            AssignmentId = assignmentId,
            MembershipId = membershipId,
            EnrollmentId = enrollmentId,
            AttemptNumber = attemptNumber,
            Status = SubmissionStatus.InProgress,
            StartedAt = DateTime.UtcNow
        };
    }

    /// <summary>Records this learner's Response (Assessment and Submission Aggregate Design v1.1 §8) and moves to Submitted. INV-007: at least one of text or an attached asset is required.</summary>
    public void RecordResponse(string? text, Guid? attachedLearningAssetId)
    {
        if (AssignmentId is null)
            throw new InvalidOperationException("RecordResponse only applies to an Assignment-target Submission.");
        if (Status != SubmissionStatus.InProgress)
            throw new InvalidOperationException("Only an in-progress submission can record a response.");
        var trimmedText = string.IsNullOrWhiteSpace(text) ? null : text.Trim();
        if (trimmedText is null && attachedLearningAssetId is null)
            throw new ArgumentException("A response needs text, an attached file, or both before it can be submitted (INV-007).", nameof(text));

        ResponseText = trimmedText;
        ResponseLearningAssetId = attachedLearningAssetId;
        Status = SubmissionStatus.Submitted;
    }

    /// <summary>Marks a submitted Assignment-target response as being looked at by a tutor — optional and purely informational (Assessment and Submission Aggregate Design v1.1 §15); no business rule depends on it.</summary>
    public void BeginReview()
    {
        if (Status != SubmissionStatus.Submitted)
            throw new InvalidOperationException("Only a submitted response can enter review.");
        Status = SubmissionStatus.UnderReview;
    }

    /// <summary>
    /// Records a tutor's (or AI-assisted, tutor-confirmed) Evaluation of an
    /// Assignment-target Submission — INV-004: only from Submitted or
    /// UnderReview. INV-005: a Result Issued once is not silently
    /// overwritten; correcting it requires a fresh Submission/attempt, same
    /// discipline as the Assessment-target <see cref="Grade"/> below.
    /// </summary>
    public void EvaluateAssignmentResponse(Guid? evaluatorMembershipId, AssignmentEvaluationMethod method, bool? passed, string? feedback)
    {
        if (AssignmentId is null)
            throw new InvalidOperationException("EvaluateAssignmentResponse only applies to an Assignment-target Submission.");
        if (Status is not (SubmissionStatus.Submitted or SubmissionStatus.UnderReview))
            throw new InvalidOperationException("Only a submitted (or under-review) response can be evaluated.");

        EvaluatorMembershipId = evaluatorMembershipId;
        EvaluationMethod = method;
        AssignmentPassed = passed;
        Feedback = string.IsNullOrWhiteSpace(feedback) ? null : feedback.Trim();
        Status = SubmissionStatus.Evaluated;
        EvaluatedAt = DateTime.UtcNow;
    }

    /// <summary>Used by AssignmentService.ResetAttemptCountAsync (Assignment BA-011) — this attempt's history is kept (INV-006's history-preservation ethos), just no longer counted toward the attempt limit.</summary>
    public void ExcludeFromAttemptCount() => ExcludedFromAttemptCount = true;

    /// <summary>
    /// Records the given answers and grades them against the real Assessment
    /// (INV-004: evaluation only happens once submitted — here, submitting
    /// and evaluating are the same instant). Calls Assessment.Grade() exactly
    /// as the tutor's preview does; this is a persistence wrapper around that,
    /// not a second grading engine.
    /// </summary>
    public IReadOnlyList<QuestionGradeResult> Grade(Assessment assessment, IReadOnlyDictionary<Guid, SubmittedAnswer> answersByQuestionId)
    {
        if (Status == SubmissionStatus.Graded)
            throw new InvalidOperationException("This submission has already been graded (INV-005: a grade is immutable once issued).");

        var (scorePercent, passed, perQuestion, competencyLevels) = assessment.Grade(answersByQuestionId);

        _answers.Clear();
        foreach (var (questionId, answer) in answersByQuestionId)
            _answers.Add(SubmissionAnswer.Create(Id, questionId, answer.SelectedOptionIndex, answer.TextAnswer));

        _competencyLevels.Clear();
        foreach (var c in competencyLevels)
            _competencyLevels.Add(SubmissionCompetencyLevel.Create(Id, c.Objective, c.Level));

        ScorePercent = scorePercent;
        Passed = passed;
        Status = SubmissionStatus.Graded;
        GradedAt = DateTime.UtcNow;

        return perQuestion;
    }

    /// <summary>
    /// Records one answer of an adaptive attempt, grades only that Question
    /// (reusing Assessment.Grade() — not a second grading engine, same as
    /// the batch Grade() above), steps the difficulty staircase, and either
    /// hands back the next Question to ask or finalizes the attempt
    /// (Adaptive Assessment — Design Proposal §4a.5).
    /// </summary>
    public AdaptiveAnswerOutcome RecordAdaptiveAnswer(
        Assessment assessment, int expectedAnswerSequence, Guid questionId, SubmittedAnswer answer)
    {
        if (Status == SubmissionStatus.Graded)
            throw new InvalidOperationException("This submission has already been graded (INV-005).");

        if (expectedAnswerSequence != _answers.Count)
            throw new InvalidOperationException(
                $"Expected to record answer #{_answers.Count}, caller expected #{expectedAnswerSequence} " +
                "— likely a duplicate or out-of-order request."); // §4a.6 — the concurrency guard

        if (assessment.AdaptiveConfiguration is not { Enabled: true } config)
            throw new InvalidOperationException("This assessment is not configured for adaptive delivery.");

        _answers.Add(SubmissionAnswer.Create(Id, questionId, answer.SelectedOptionIndex, answer.TextAnswer));

        var (_, _, thisResult, _) = assessment.Grade(
            new Dictionary<Guid, SubmittedAnswer> { [questionId] = answer },
            questionIdsToGrade: [questionId]);
        var wasCorrect = thisResult[0].Correct ?? false;

        if (_answers.Count >= config.QuestionsPerAttempt)
        {
            var presentedIds = _answers.Select(a => a.QuestionId).ToList();
            var allAnswers = _answers.ToDictionary(a => a.QuestionId, a => new SubmittedAnswer(a.SelectedOptionIndex, a.TextAnswer));
            var (scorePercent, passed, perQuestion, competencyLevels) = assessment.Grade(allAnswers, questionIdsToGrade: presentedIds);

            _competencyLevels.Clear();
            foreach (var c in competencyLevels)
                _competencyLevels.Add(SubmissionCompetencyLevel.Create(Id, c.Objective, c.Level));

            ScorePercent = scorePercent;
            Passed = passed;
            Status = SubmissionStatus.Graded;
            GradedAt = DateTime.UtcNow;
            return new AdaptiveAnswerOutcome.Complete(scorePercent, passed, perQuestion);
        }

        var currentTier = assessment.FindQuestionTier(questionId)
            ?? throw new InvalidOperationException("This question has no difficulty tier — it cannot belong to an adaptive pool.");
        var nextTier = StepTier(currentTier, wasCorrect, config.MinDifficulty, config.MaxDifficulty);
        var excludeIds = _answers.Select(a => a.QuestionId).ToHashSet();
        var nextQuestionId = assessment.SelectNextAdaptiveQuestion(nextTier, excludeIds)
            ?? throw new InvalidOperationException(
                "Adaptive pool exhausted at this difficulty — publish-time validation should have prevented this.");

        return new AdaptiveAnswerOutcome.NextQuestion(nextQuestionId, nextTier);
    }

    private static DifficultyTier StepTier(DifficultyTier current, bool wasCorrect, DifficultyTier min, DifficultyTier max)
    {
        var stepped = wasCorrect ? current + 1 : current - 1; // enum ordinal: Easy=0, Medium=1, Hard=2
        return (DifficultyTier)Math.Clamp((int)stepped, (int)min, (int)max);
    }
}

/// <summary>
/// What happens after one adaptive answer is recorded (Adaptive Assessment —
/// Design Proposal §4a.3) — either the attempt continues with another
/// Question, or QuestionsPerAttempt was just reached and the attempt is now
/// Graded, same shape Submission.Grade()'s batch path produces.
/// </summary>
public abstract record AdaptiveAnswerOutcome
{
    public sealed record NextQuestion(Guid QuestionId, DifficultyTier Tier) : AdaptiveAnswerOutcome;
    public sealed record Complete(int ScorePercent, bool Passed, IReadOnlyList<QuestionGradeResult> PerQuestion) : AdaptiveAnswerOutcome;
}
