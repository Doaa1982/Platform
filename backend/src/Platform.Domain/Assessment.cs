namespace Platform.Domain;

/// <summary>
/// One item a learner must respond to (Assessment and Submission Aggregate
/// Design §7) — a Question Event (Learning Delivery Context §4.1). Carries an
/// optional video placement — AI Interactive Video Lesson Generator §4's
/// Question Event Model ("VideoTimestamp") — so the same Question doubles as
/// a Timeline Event when its Assessment is attached to a lesson's video.
///
/// The answer key's shape depends on <see cref="Type"/>:
///   MultipleChoice / TrueFalse  — <see cref="Options"/> + <see cref="CorrectOptionIndex"/>.
///   CompleteTheSentence         — <see cref="AcceptedAnswers"/> (any one matches).
///   OpenAnswer                  — no answer key at all; not auto-gradable
///                                 (Learning Delivery Context §4.1 — reasoning
///                                 and reflection have no single right answer).
/// </summary>
public class Question
{
    private readonly List<string> _options = [];
    private readonly List<string> _acceptedAnswers = [];

    public Guid Id { get; private set; }
    public Guid AssessmentId { get; private set; }
    public string Prompt { get; private set; } = string.Empty;
    public QuestionType Type { get; private set; }

    /// <summary>MultipleChoice: tutor-authored. TrueFalse: always ["True", "False"]. Empty otherwise.</summary>
    public IReadOnlyList<string> Options => _options.AsReadOnly();
    public int? CorrectOptionIndex { get; private set; }

    /// <summary>CompleteTheSentence only: any one of these (case-insensitive, trimmed) counts as correct.</summary>
    public IReadOnlyList<string> AcceptedAnswers => _acceptedAnswers.AsReadOnly();

    /// <summary>Shown after answering, win or lose — AI doc §4's "Explanation". For OpenAnswer, doubles as model-answer guidance.</summary>
    public string? Explanation { get; private set; }

    /// <summary>Where in the lesson's video this checkpoint sits, in seconds. Null for a question with no video placement.</summary>
    public int? VideoTimestampSeconds { get; private set; }

    public int Points { get; private set; }
    public int Position { get; private set; }

    private Question() { }

    internal static Question Create(
        Guid assessmentId, QuestionType type, string prompt,
        IReadOnlyList<string>? options, int? correctOptionIndex, IReadOnlyList<string>? acceptedAnswers,
        string? explanation, int? videoTimestampSeconds, int points, int position)
    {
        var q = new Question { Id = Guid.NewGuid(), AssessmentId = assessmentId, Position = position };
        q.Apply(type, prompt, options, correctOptionIndex, acceptedAnswers, explanation, videoTimestampSeconds, points);
        return q;
    }

    internal void Edit(
        QuestionType type, string prompt,
        IReadOnlyList<string>? options, int? correctOptionIndex, IReadOnlyList<string>? acceptedAnswers,
        string? explanation, int? videoTimestampSeconds, int points)
        => Apply(type, prompt, options, correctOptionIndex, acceptedAnswers, explanation, videoTimestampSeconds, points);

    private void Apply(
        QuestionType type, string prompt,
        IReadOnlyList<string>? options, int? correctOptionIndex, IReadOnlyList<string>? acceptedAnswers,
        string? explanation, int? videoTimestampSeconds, int points)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(prompt);
        if (points <= 0)
            throw new ArgumentException("A question must be worth at least one point.", nameof(points));
        if (videoTimestampSeconds is < 0)
            throw new ArgumentException("A video timestamp cannot be negative.", nameof(videoTimestampSeconds));

        Type = type;
        Prompt = prompt.Trim();
        Explanation = string.IsNullOrWhiteSpace(explanation) ? null : explanation.Trim();
        VideoTimestampSeconds = videoTimestampSeconds;
        Points = points;

        _options.Clear();
        _acceptedAnswers.Clear();
        CorrectOptionIndex = null;

        switch (type)
        {
            case QuestionType.MultipleChoice:
                if (options is null || options.Count < 2)
                    throw new ArgumentException("A multiple-choice question needs at least two options.", nameof(options));
                if (correctOptionIndex is null || correctOptionIndex < 0 || correctOptionIndex >= options.Count)
                    throw new ArgumentException("The correct option index must point at one of the given options.", nameof(correctOptionIndex));
                _options.AddRange(options.Select(o => o.Trim()));
                CorrectOptionIndex = correctOptionIndex;
                break;

            case QuestionType.TrueFalse:
                _options.AddRange(["True", "False"]);
                if (correctOptionIndex is not (0 or 1))
                    throw new ArgumentException("A true/false question's correct answer must be True (0) or False (1).", nameof(correctOptionIndex));
                CorrectOptionIndex = correctOptionIndex;
                break;

            case QuestionType.CompleteTheSentence:
                var cleaned = (acceptedAnswers ?? []).Select(a => a.Trim()).Where(a => a.Length > 0).ToList();
                if (cleaned.Count == 0)
                    throw new ArgumentException("A complete-the-sentence question needs at least one accepted answer.", nameof(acceptedAnswers));
                _acceptedAnswers.AddRange(cleaned);
                break;

            case QuestionType.OpenAnswer:
                // No answer key by design — reasoning and reflection have no
                // single right answer (Learning Delivery Context §4.1).
                break;
        }
    }

    internal void MoveTo(int position) => Position = position;
}

/// <summary>One learner's response to one Question, offered up for simulated AI grading.</summary>
public readonly record struct SubmittedAnswer(int? SelectedOptionIndex, string? TextAnswer);

/// <summary>
/// One Question's outcome after grading. Correct is null for a Question that
/// is not auto-gradable (OpenAnswer) — reviewed, not scored, and excluded
/// from the score entirely rather than counted against the learner.
/// </summary>
public readonly record struct QuestionGradeResult(Guid QuestionId, bool? Correct, string? CorrectAnswerDisplay);

/// <summary>
/// Assessment Aggregate Root (Assessment and Submission Aggregate Design).
///
/// "What does it take to demonstrate this achievement?" — a reusable,
/// design-time definition owned by the tutor authoring a Lesson. Scoped here
/// to one Assessment per Lesson (the interactive questions that lesson's
/// video carries); Assessment Context's broader shape (standalone exams,
/// rubrics) is future evolution, not needed for lesson-embedded checkpoints.
///
/// Invariants enforced here:
///   INV-002: cannot receive submissions (be graded against) until Published —
///            enforced by refusing structural edits once Published, mirroring
///            Curriculum's RequireEditable.
/// </summary>
public class Assessment
{
    private readonly List<Question> _questions = [];

    public Guid Id { get; private set; }
    public Guid WorkspaceId { get; private set; }
    public Guid LessonId { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public int PassingThresholdPercent { get; private set; } = 70;
    public AssessmentStatus Status { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }

    public IReadOnlyCollection<Question> Questions => _questions.AsReadOnly();

    private Assessment() { }

    public static Assessment Create(Guid workspaceId, Guid lessonId, string title)
    {
        if (workspaceId == Guid.Empty)
            throw new ArgumentException("An Assessment belongs to exactly one Workspace.", nameof(workspaceId));
        if (lessonId == Guid.Empty)
            throw new ArgumentException("An Assessment belongs to exactly one Lesson.", nameof(lessonId));
        ArgumentException.ThrowIfNullOrWhiteSpace(title);

        var now = DateTime.UtcNow;
        return new Assessment
        {
            Id = Guid.NewGuid(),
            WorkspaceId = workspaceId,
            LessonId = lessonId,
            Title = title.Trim(),
            Status = AssessmentStatus.Draft,
            CreatedAt = now,
            UpdatedAt = now
        };
    }

    public void Rename(string title)
    {
        RequireEditable();
        ArgumentException.ThrowIfNullOrWhiteSpace(title);
        Title = title.Trim();
        Touch();
    }

    public void SetPassingThreshold(int percent)
    {
        RequireEditable();
        if (percent is < 0 or > 100)
            throw new ArgumentException("A passing threshold must be between 0 and 100.", nameof(percent));
        PassingThresholdPercent = percent;
        Touch();
    }

    public Question AddQuestion(
        QuestionType type, string prompt,
        IReadOnlyList<string>? options, int? correctOptionIndex, IReadOnlyList<string>? acceptedAnswers,
        string? explanation = null, int? videoTimestampSeconds = null, int points = 1)
    {
        RequireEditable();
        var question = Question.Create(Id, type, prompt, options, correctOptionIndex, acceptedAnswers, explanation, videoTimestampSeconds, points, _questions.Count);
        _questions.Add(question);
        Touch();
        return question;
    }

    public void UpdateQuestion(
        Guid questionId, QuestionType type, string prompt,
        IReadOnlyList<string>? options, int? correctOptionIndex, IReadOnlyList<string>? acceptedAnswers,
        string? explanation, int? videoTimestampSeconds, int points)
    {
        RequireEditable();
        FindQuestion(questionId).Edit(type, prompt, options, correctOptionIndex, acceptedAnswers, explanation, videoTimestampSeconds, points);
        Touch();
    }

    public void RemoveQuestion(Guid questionId)
    {
        RequireEditable();
        _questions.RemoveAll(q => q.Id == questionId);
        var ordered = _questions.OrderBy(q => q.Position).ToList();
        for (var i = 0; i < ordered.Count; i++) ordered[i].MoveTo(i);
        Touch();
    }

    /// <summary>Why publication is refused right now, or null when it is allowed — returned rather than thrown, matching Curriculum.PublicationBlocker.</summary>
    public string? PublicationBlocker()
        => _questions.Count == 0 ? "An assessment needs at least one question before it can be published." : null;

    public void Publish()
    {
        RequireEditable();
        var blocker = PublicationBlocker();
        if (blocker is not null) throw new InvalidOperationException(blocker);
        Status = AssessmentStatus.Published;
        Touch();
    }

    public void Unpublish()
    {
        if (Status != AssessmentStatus.Published)
            throw new InvalidOperationException("Only a published assessment can be unpublished.");
        Status = AssessmentStatus.Draft;
        Touch();
    }

    /// <summary>
    /// Grades a set of answers against this Assessment's answer key. This is
    /// the "AI Evaluation" method (Assessment and Submission Aggregate Design
    /// §10) in its simulated form: deterministic and templated rather than a
    /// live model call, matching every other AI surface in this prototype —
    /// but scored against the real questions and answer keys a tutor authored.
    ///
    /// OpenAnswer questions are never auto-graded (Correct is null on their
    /// result) and are excluded from the score entirely — reviewed for
    /// participation, not held against the learner one way or the other.
    /// </summary>
    public (int ScorePercent, bool Passed, IReadOnlyList<QuestionGradeResult> PerQuestion) Grade(
        IReadOnlyDictionary<Guid, SubmittedAnswer> answersByQuestionId)
    {
        if (_questions.Count == 0)
            throw new InvalidOperationException("This assessment has no questions to grade against.");

        var earned = 0;
        var possible = 0;
        var results = new List<QuestionGradeResult>();

        foreach (var q in _questions.OrderBy(q => q.Position))
        {
            answersByQuestionId.TryGetValue(q.Id, out var answer);

            bool? correct;
            string? correctAnswerDisplay;

            switch (q.Type)
            {
                case QuestionType.MultipleChoice:
                case QuestionType.TrueFalse:
                    correct = answer.SelectedOptionIndex is { } idx && idx == q.CorrectOptionIndex;
                    correctAnswerDisplay = q.CorrectOptionIndex is { } ci && ci < q.Options.Count ? q.Options[ci] : null;
                    break;

                case QuestionType.CompleteTheSentence:
                    var given = (answer.TextAnswer ?? string.Empty).Trim();
                    correct = given.Length > 0 && q.AcceptedAnswers.Any(a => string.Equals(a, given, StringComparison.OrdinalIgnoreCase));
                    correctAnswerDisplay = string.Join(" / ", q.AcceptedAnswers);
                    break;

                default: // OpenAnswer — reviewed, not scored (Learning Delivery Context §4.1)
                    correct = null;
                    correctAnswerDisplay = null;
                    break;
            }

            if (correct is not null)
            {
                possible += q.Points;
                if (correct == true) earned += q.Points;
            }

            results.Add(new QuestionGradeResult(q.Id, correct, correctAnswerDisplay));
        }

        // No auto-gradable questions (an all-OpenAnswer quiz): nothing to fail, so a vacuous pass.
        var scorePercent = possible == 0 ? 100 : (int)Math.Round(earned * 100.0 / possible);
        return (scorePercent, scorePercent >= PassingThresholdPercent, results);
    }

    private Question FindQuestion(Guid questionId) =>
        _questions.FirstOrDefault(q => q.Id == questionId)
        ?? throw new InvalidOperationException("No such question in this assessment.");

    private void RequireEditable()
    {
        if (Status != AssessmentStatus.Draft)
            throw new InvalidOperationException(
                "A published assessment cannot be edited. Unpublish it first — a learner mid-attempt should not have questions change beneath them.");
    }

    private void Touch() => UpdatedAt = DateTime.UtcNow;
}
