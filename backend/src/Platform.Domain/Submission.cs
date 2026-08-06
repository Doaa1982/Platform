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
/// Submission Aggregate Root — simplified.
///
/// A Learner's graded attempt at one Assessment (Assessment and Submission
/// Aggregate Design §6-8). The documented state machine is Started →
/// Submitted → Evaluated → Result Issued, built to support asynchronous or
/// manual grading; here grading is always the same synchronous simulated-AI
/// method already built on <see cref="Assessment.Grade"/> (the same one
/// AssessmentService.PreviewAsync calls, ungraded), so this collapses to
/// InProgress → Graded. No attempt limit is enforced (INV-003) — Assessment
/// has no configured limit anywhere yet, so refusing a retake here would be
/// inventing a rule this app doesn't otherwise have.
/// </summary>
public class Submission
{
    private readonly List<SubmissionAnswer> _answers = [];

    public Guid Id { get; private set; }
    public Guid AssessmentId { get; private set; }
    public Guid MembershipId { get; private set; }
    public Guid EnrollmentId { get; private set; }
    public SubmissionStatus Status { get; private set; }
    public int ScorePercent { get; private set; }
    public bool Passed { get; private set; }
    public DateTime StartedAt { get; private set; }
    public DateTime? GradedAt { get; private set; }

    public IReadOnlyCollection<SubmissionAnswer> Answers => _answers.AsReadOnly();

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

        var (scorePercent, passed, perQuestion) = assessment.Grade(answersByQuestionId);

        _answers.Clear();
        foreach (var (questionId, answer) in answersByQuestionId)
            _answers.Add(SubmissionAnswer.Create(Id, questionId, answer.SelectedOptionIndex, answer.TextAnswer));

        ScorePercent = scorePercent;
        Passed = passed;
        Status = SubmissionStatus.Graded;
        GradedAt = DateTime.UtcNow;

        return perQuestion;
    }
}
