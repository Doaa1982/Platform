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

    /// <summary>
    /// One of the source Lesson Revision's own Learning Objectives, copied at
    /// question-authoring time (Competency-Based Learning — Design Proposal
    /// §2 D1, §3) — free text, not a reference to a structured taxonomy
    /// entity (none exists in this domain). Null for a Question nobody has
    /// tagged; Assessment.Grade() excludes untagged Questions from its
    /// competency breakdown entirely rather than treating null as its own
    /// category.
    /// </summary>
    public string? AssessedObjective { get; private set; }

    /// <summary>
    /// This Question's tier within an adaptive pool (Adaptive Assessment —
    /// Design Proposal §3, §4a.3) — null for a Question that isn't part of
    /// one. Restricted to auto-gradable Types (§6/§4a's corrected invariant):
    /// OpenAnswer has no synchronous correctness signal for the staircase
    /// rule to act on, so it can never carry a tier.
    /// </summary>
    public DifficultyTier? DifficultyTier { get; private set; }

    private Question() { }

    internal static Question Create(
        Guid assessmentId, QuestionType type, string prompt,
        IReadOnlyList<string>? options, int? correctOptionIndex, IReadOnlyList<string>? acceptedAnswers,
        string? explanation, int? videoTimestampSeconds, int points, int position,
        string? assessedObjective = null, DifficultyTier? difficultyTier = null)
    {
        var q = new Question { Id = Guid.NewGuid(), AssessmentId = assessmentId, Position = position };
        q.Apply(type, prompt, options, correctOptionIndex, acceptedAnswers, explanation, videoTimestampSeconds, points, assessedObjective, difficultyTier);
        return q;
    }

    internal void Edit(
        QuestionType type, string prompt,
        IReadOnlyList<string>? options, int? correctOptionIndex, IReadOnlyList<string>? acceptedAnswers,
        string? explanation, int? videoTimestampSeconds, int points, string? assessedObjective = null, DifficultyTier? difficultyTier = null)
        => Apply(type, prompt, options, correctOptionIndex, acceptedAnswers, explanation, videoTimestampSeconds, points, assessedObjective, difficultyTier);

    private void Apply(
        QuestionType type, string prompt,
        IReadOnlyList<string>? options, int? correctOptionIndex, IReadOnlyList<string>? acceptedAnswers,
        string? explanation, int? videoTimestampSeconds, int points, string? assessedObjective = null, DifficultyTier? difficultyTier = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(prompt);
        if (points <= 0)
            throw new ArgumentException("A question must be worth at least one point.", nameof(points));
        if (videoTimestampSeconds is < 0)
            throw new ArgumentException("A video timestamp cannot be negative.", nameof(videoTimestampSeconds));
        if (difficultyTier is not null && type == QuestionType.OpenAnswer)
            throw new ArgumentException("An OpenAnswer question has no synchronous correctness signal, so it cannot belong to an adaptive pool.", nameof(difficultyTier));

        Type = type;
        Prompt = prompt.Trim();
        Explanation = string.IsNullOrWhiteSpace(explanation) ? null : explanation.Trim();
        VideoTimestampSeconds = videoTimestampSeconds;
        Points = points;
        AssessedObjective = string.IsNullOrWhiteSpace(assessedObjective) ? null : assessedObjective.Trim();
        DifficultyTier = difficultyTier;

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
/// One AssessedObjective's mastery level for one grading pass (Competency-
/// Based Learning — Design Proposal §3-4) — only objectives at least one
/// graded Question in this pass was tagged with appear at all.
/// </summary>
public readonly record struct CompetencyResult(string Objective, CompetencyLevel Level);

/// <summary>
/// Adaptive delivery settings for a Standalone Assessment (Adaptive
/// Assessment — Design Proposal §3, §4a.3) — Enabled defaults false so every
/// existing Assessment is unaffected until a tutor opts in.
/// DifficultyPoints maps a tier to the Points value a Question at that tier
/// is authored with (D3) — Easy/Medium/Hard need not all be present; a tier
/// missing from the map simply leaves a Question's own given Points
/// unmodified when authored at that tier.
/// </summary>
public sealed record AdaptiveConfiguration(
    bool Enabled,
    int QuestionsPerAttempt,
    DifficultyTier StartingDifficulty,
    DifficultyTier MinDifficulty,
    DifficultyTier MaxDifficulty,
    IReadOnlyDictionary<DifficultyTier, int> DifficultyPoints);

/// <summary>
/// Assessment Aggregate Root (Assessment and Submission Aggregate Design).
///
/// "What does it take to demonstrate this achievement?" — a reusable,
/// design-time definition owned by the tutor authoring a Lesson. Scoped here
/// to one Assessment per Lesson Revision (the interactive questions that
/// revision's video carries); Assessment Context's broader shape (standalone
/// exams, rubrics) is future evolution, not needed for lesson-embedded
/// checkpoints.
///
/// <see cref="LessonRevisionId"/> — not <see cref="LessonId"/> alone — is
/// what an Assessment is actually scoped to. This refines Assessment and
/// Submission Aggregate Design §19, which lists Assessment's only aggregate
/// reference as LessonId: that was written before this codebase had to
/// answer what happens to a Submission once its lesson gets a new revision.
/// Two other documents settle it in the other direction. Lesson Revision
/// Aggregate Design §7 models the timestamped questions a lesson's video
/// carries as an "Interactive Learning Event" that "belongs to exactly one
/// Lesson Revision... versioned together with it" — the same rule already
/// governing every other entity on that aggregate. And Learning Publication
/// & Version Management's Rule 4 ("Student progress references LessonVersion.
/// Never Lesson.") and Rule 5 ("Grades belong to LessonVersion.") both name
/// the version, not the lesson, as what a grade is permanently anchored to.
/// A Submission's grade traces to this Assessment, which is why this
/// Assessment has to be the version's, not the lesson's: otherwise a tutor
/// editing/republishing the same lesson-wide Assessment could silently
/// change what a past Submission was actually graded against. LessonId is
/// kept too, as a denormalized convenience for lesson-level lookups — it is
/// not the ownership key.
///
/// Invariants enforced here:
///   INV-002: cannot receive submissions (be graded against) until Published.
///
/// This used to also mean "cannot be structurally edited once Published,"
/// mirroring Curriculum's RequireEditable — Lesson Editing & Publication UX,
/// Scenario 4 (and Learning Publication & Version Management §19, Rule 11)
/// deliberately lifts that second part: a tutor may keep improving questions
/// on a Published Assessment directly (see AddQuestion/UpdateQuestion/
/// RemoveQuestion), with affected learners notified instead of the edit
/// being blocked. Publish/Unpublish still exist, and INV-002 above still
/// holds — they just no longer double as an editability gate.
/// </summary>
public class Assessment
{
    private readonly List<Question> _questions = [];

    public Guid Id { get; private set; }
    public Guid WorkspaceId { get; private set; }
    public Guid LessonId { get; private set; }
    public Guid LessonRevisionId { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public int PassingThresholdPercent { get; private set; } = 70;

    /// <summary>
    /// Null means unlimited retakes (the historical, still-default behavior).
    /// Assessment and Submission Aggregate Design §8 lists this as an
    /// optional Scoring Configuration field; it was never implemented until
    /// now, which combined with Grade() always disclosing the correct answer
    /// let a learner pass any quiz after one deliberately-wrong "scouting"
    /// attempt. Enforced by LearningDeliveryService before starting a new
    /// Assessment-target Submission — this aggregate has no visibility into
    /// how many a learner has already used.
    /// </summary>
    public int? AttemptLimit { get; private set; }

    public AssessmentStatus Status { get; private set; }

    /// <summary>Interactive (in-video checkpoints) or Standalone (a separate lesson quiz) — see AssessmentKind. Immutable once created: converting one into the other would silently repoint every past Submission's meaning.</summary>
    public AssessmentKind Kind { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }

    public IReadOnlyCollection<Question> Questions => _questions.AsReadOnly();

    /// <summary>Null for every Assessment that hasn't opted in — see ConfigureAdaptive. Adaptive Assessment — Design Proposal §3's v1.1 scope correction: only ever meaningful for Kind == Standalone.</summary>
    public AdaptiveConfiguration? AdaptiveConfiguration { get; private set; }

    private Assessment() { }

    public static Assessment Create(Guid workspaceId, Guid lessonId, Guid lessonRevisionId, string title, AssessmentKind kind)
    {
        if (workspaceId == Guid.Empty)
            throw new ArgumentException("An Assessment belongs to exactly one Workspace.", nameof(workspaceId));
        if (lessonId == Guid.Empty)
            throw new ArgumentException("An Assessment belongs to exactly one Lesson.", nameof(lessonId));
        if (lessonRevisionId == Guid.Empty)
            throw new ArgumentException("An Assessment belongs to exactly one Lesson Revision.", nameof(lessonRevisionId));
        ArgumentException.ThrowIfNullOrWhiteSpace(title);

        var now = DateTime.UtcNow;
        return new Assessment
        {
            Id = Guid.NewGuid(),
            WorkspaceId = workspaceId,
            LessonId = lessonId,
            LessonRevisionId = lessonRevisionId,
            Title = title.Trim(),
            Status = AssessmentStatus.Draft,
            Kind = kind,
            CreatedAt = now,
            UpdatedAt = now
        };
    }

    public void Rename(string title)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(title);
        Title = title.Trim();
        Touch();
    }

    public void SetPassingThreshold(int percent)
    {
        if (percent is < 0 or > 100)
            throw new ArgumentException("A passing threshold must be between 0 and 100.", nameof(percent));
        PassingThresholdPercent = percent;
        Touch();
    }

    /// <summary>Null clears the limit back to unlimited retakes.</summary>
    public void SetAttemptLimit(int? attemptLimit)
    {
        if (attemptLimit is <= 0)
            throw new ArgumentException("An attempt limit must be positive, or null for unlimited.", nameof(attemptLimit));
        AttemptLimit = attemptLimit;
        Touch();
    }

    /// <summary>
    /// Lesson Editing &amp; Publication UX, Scenario 4: interactive questions may
    /// be edited whether this Assessment is Draft or Published — no unpublish
    /// step, no new Lesson Version. This supersedes the original INV-002
    /// remark below, which used to gate all structural edits on Draft status;
    /// the platform now allows the edit and relies on notifying affected
    /// learners (AssessmentService) instead of blocking the tutor outright.
    /// Publish/Unpublish remain exactly what they were — the switch for
    /// whether a learner can see/attempt these questions at all — just no
    /// longer a precondition for changing them.
    /// </summary>
    public Question AddQuestion(
        QuestionType type, string prompt,
        IReadOnlyList<string>? options, int? correctOptionIndex, IReadOnlyList<string>? acceptedAnswers,
        string? explanation = null, int? videoTimestampSeconds = null, int points = 1, string? assessedObjective = null,
        DifficultyTier? difficultyTier = null)
    {
        var question = Question.Create(Id, type, prompt, options, correctOptionIndex, acceptedAnswers, explanation, videoTimestampSeconds,
            EffectivePoints(points, difficultyTier), _questions.Count, assessedObjective, difficultyTier);
        _questions.Add(question);
        Touch();
        return question;
    }

    public void UpdateQuestion(
        Guid questionId, QuestionType type, string prompt,
        IReadOnlyList<string>? options, int? correctOptionIndex, IReadOnlyList<string>? acceptedAnswers,
        string? explanation, int? videoTimestampSeconds, int points, string? assessedObjective = null, DifficultyTier? difficultyTier = null)
    {
        FindQuestion(questionId).Edit(type, prompt, options, correctOptionIndex, acceptedAnswers, explanation, videoTimestampSeconds,
            EffectivePoints(points, difficultyTier), assessedObjective, difficultyTier);
        Touch();
    }

    /// <summary>D3: a tier-tagged Question's Points comes from this adaptive pool's own DifficultyPoints map, not whatever the caller passed — unless that tier isn't in the map, in which case the caller's own value stands.</summary>
    private int EffectivePoints(int requestedPoints, DifficultyTier? difficultyTier) =>
        difficultyTier is { } tier && AdaptiveConfiguration?.DifficultyPoints.TryGetValue(tier, out var tierPoints) is true
            ? tierPoints
            : requestedPoints;

    /// <summary>
    /// Opts this Assessment into (or updates, or turns off) adaptive
    /// delivery (Adaptive Assessment — Design Proposal §3, §4a.3). Scoped to
    /// Standalone only (v1.1's scope correction): Interactive checkpoints are
    /// pinned to fixed video timestamps and can't be reordered or swapped
    /// without breaking the video sync they exist for.
    /// </summary>
    public void ConfigureAdaptive(AdaptiveConfiguration config)
    {
        if (config.Enabled)
        {
            if (Kind != AssessmentKind.Standalone)
                throw new InvalidOperationException("Adaptive delivery only applies to a Standalone assessment — Interactive checkpoints are pinned to fixed video timestamps.");
            if (config.QuestionsPerAttempt <= 0)
                throw new ArgumentException("Questions per attempt must be positive.", nameof(config));
            if (config.MinDifficulty > config.MaxDifficulty)
                throw new ArgumentException("MinDifficulty cannot be harder than MaxDifficulty.", nameof(config));
            if (config.StartingDifficulty < config.MinDifficulty || config.StartingDifficulty > config.MaxDifficulty)
                throw new ArgumentException("StartingDifficulty must fall within MinDifficulty..MaxDifficulty.", nameof(config));
        }

        AdaptiveConfiguration = config;
        Touch();
    }

    public void RemoveQuestion(Guid questionId)
    {
        _questions.RemoveAll(q => q.Id == questionId);
        var ordered = _questions.OrderBy(q => q.Position).ToList();
        for (var i = 0; i < ordered.Count; i++) ordered[i].MoveTo(i);
        Touch();
    }

    /// <summary>Why publication is refused right now, or null when it is allowed — returned rather than thrown, matching Curriculum.PublicationBlocker.</summary>
    public string? PublicationBlocker()
    {
        if (_questions.Count == 0)
            return "An assessment needs at least one question before it can be published.";

        return AdaptiveConfiguration is { Enabled: true } config ? AdaptivePoolBlocker(config) : null;
    }

    /// <summary>
    /// Adaptive Assessment — Design Proposal §3: the pool must survive the
    /// worst realistic path through it. That is NOT just "always correct"
    /// (climbs straight to MaxDifficulty) or "always incorrect" (drops
    /// straight to MinDifficulty) — a learner whose answers oscillate (right,
    /// wrong, right, wrong, …) bounces between two adjacent tiers and can
    /// revisit a middle tier roughly half the attempt's length, far more than
    /// either monotonic extreme ever touches it. This checks, per tier, the
    /// true worst case over every possible right/wrong sequence — not just
    /// the two monotonic ones.
    /// </summary>
    private string? AdaptivePoolBlocker(AdaptiveConfiguration config)
    {
        var poolCounts = _questions
            .Where(q => q.DifficultyTier is not null)
            .GroupBy(q => q.DifficultyTier!.Value)
            .ToDictionary(g => g.Key, g => g.Count());

        foreach (var targetTier in Enum.GetValues<DifficultyTier>())
        {
            var neededCount = MaxPossibleVisits(config, targetTier);
            var available = poolCounts.GetValueOrDefault(targetTier);
            if (available < neededCount)
                return $"This adaptive assessment needs at least {neededCount} {targetTier} question(s) to cover a learner whose " +
                       $"answers keep landing back on that difficulty, but the pool only has {available}.";
        }

        return null;
    }

    /// <summary>
    /// The most times a single attempt could land on <paramref name="targetTier"/>,
    /// over every possible sequence of right/wrong answers (not just the two
    /// monotonic extremes) — via a small backward dynamic program: from the
    /// last question back to the first, the worst case at each tier is that
    /// tier's own contribution plus whichever next step (right or wrong)
    /// leads to more future visits.
    /// </summary>
    private static int MaxPossibleVisits(AdaptiveConfiguration config, DifficultyTier targetTier)
    {
        var tiers = Enum.GetValues<DifficultyTier>();
        var bestFromHere = tiers.ToDictionary(t => t, t => t == targetTier ? 1 : 0);

        for (var step = config.QuestionsPerAttempt - 2; step >= 0; step--)
        {
            var next = new Dictionary<DifficultyTier, int>();
            foreach (var t in tiers)
            {
                var steppedUp = (DifficultyTier)Math.Clamp((int)t + 1, (int)config.MinDifficulty, (int)config.MaxDifficulty);
                var steppedDown = (DifficultyTier)Math.Clamp((int)t - 1, (int)config.MinDifficulty, (int)config.MaxDifficulty);
                next[t] = (t == targetTier ? 1 : 0) + Math.Max(bestFromHere[steppedUp], bestFromHere[steppedDown]);
            }
            bestFromHere = next;
        }

        return bestFromHere[config.StartingDifficulty];
    }

    public void Publish()
    {
        if (Status != AssessmentStatus.Draft)
            throw new InvalidOperationException("Only a draft assessment can be published.");
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
    ///
    /// Also computes a per-AssessedObjective competency breakdown
    /// (Competency-Based Learning — Design Proposal §3-4), over the exact
    /// same set of graded Questions the score itself is computed from — an
    /// untagged Question never contributes, and a Question excluded from
    /// scoring (OpenAnswer, or omitted via <paramref name="questionIdsToGrade"/>)
    /// is excluded from the breakdown for the same reason it's excluded from
    /// the score: no correct/incorrect signal exists for it.
    ///
    /// <paramref name="questionIdsToGrade"/> — Adaptive Assessment — Design
    /// Proposal §4a.1-4a.2: defaults to null, meaning "every Question on this
    /// Assessment," exactly today's behavior for every existing caller. An
    /// adaptive Submission passes the subset it actually presented, so a
    /// pool larger than one attempt's QuestionsPerAttempt doesn't silently
    /// count every unpresented Question as wrong (§4a.1's bug this parameter
    /// exists to close).
    /// </summary>
    public (int ScorePercent, bool Passed, IReadOnlyList<QuestionGradeResult> PerQuestion, IReadOnlyList<CompetencyResult> CompetencyLevels) Grade(
        IReadOnlyDictionary<Guid, SubmittedAnswer> answersByQuestionId, IReadOnlyCollection<Guid>? questionIdsToGrade = null)
    {
        if (_questions.Count == 0)
            throw new InvalidOperationException("This assessment has no questions to grade against.");

        var questionsToGrade = questionIdsToGrade is null
            ? _questions
            : _questions.Where(q => questionIdsToGrade.Contains(q.Id));

        var earned = 0;
        var possible = 0;
        var results = new List<QuestionGradeResult>();
        var competencyTally = new Dictionary<string, (int Correct, int Total)>();

        foreach (var q in questionsToGrade.OrderBy(q => q.Position))
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

                if (q.AssessedObjective is { } objective)
                {
                    var (priorCorrect, priorTotal) = competencyTally.GetValueOrDefault(objective);
                    competencyTally[objective] = (priorCorrect + (correct == true ? 1 : 0), priorTotal + 1);
                }
            }

            results.Add(new QuestionGradeResult(q.Id, correct, correctAnswerDisplay));
        }

        // No auto-gradable questions (an all-OpenAnswer quiz): nothing to fail, so a vacuous pass.
        var scorePercent = possible == 0 ? 100 : (int)Math.Round(earned * 100.0 / possible);
        var competencyLevels = competencyTally
            .Select(kvp => new CompetencyResult(kvp.Key, DetermineCompetencyLevel(kvp.Value.Correct, kvp.Value.Total)))
            .ToList();
        return (scorePercent, scorePercent >= PassingThresholdPercent, results, competencyLevels);
    }

    /// <summary>Competency-Based Learning — Design Proposal §4's exact thresholds. See CompetencyLevel's remarks for why Proficient never comes out of this rule.</summary>
    private static CompetencyLevel DetermineCompetencyLevel(int correct, int total)
    {
        var percent = correct * 100.0 / total;
        return percent >= 80 ? CompetencyLevel.Mastered
             : percent >= 50 ? CompetencyLevel.Developing
             : CompetencyLevel.NotYet;
    }

    /// <summary>
    /// Picks an unused Question at the given tier for an adaptive attempt
    /// (Adaptive Assessment — Design Proposal §4a.4) — random within the
    /// tier, so every attempt doesn't walk the same fixed order. Null means
    /// the pool ran out of that tier before QuestionsPerAttempt was reached —
    /// exactly what PublicationBlocker's adaptive check exists to prevent
    /// against a properly published Assessment, so a caller sees this as an
    /// invariant violation, not a normal outcome.
    /// </summary>
    public Guid? SelectNextAdaptiveQuestion(DifficultyTier tier, IReadOnlySet<Guid> excludeQuestionIds) =>
        _questions
            .Where(q => q.DifficultyTier == tier && !excludeQuestionIds.Contains(q.Id))
            .OrderBy(_ => Guid.NewGuid())
            .Select(q => (Guid?)q.Id)
            .FirstOrDefault();

    /// <summary>The tier a pool Question was authored at — used by Submission.RecordAdaptiveAnswer to run the staircase rule. Null for a Question that was never tagged (not part of any adaptive pool).</summary>
    public DifficultyTier? FindQuestionTier(Guid questionId) => FindQuestion(questionId).DifficultyTier;

    private Question FindQuestion(Guid questionId) =>
        _questions.FirstOrDefault(q => q.Id == questionId)
        ?? throw new InvalidOperationException("No such question in this assessment.");

    private void Touch() => UpdatedAt = DateTime.UtcNow;
}
