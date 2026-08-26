# Adaptive Assessment — Design Proposal

**Version:** 1.2 (v1.1 revised the proposal against actual `Platform.Domain`
code; v1.2 adds §4a, a complete code-level design closing the one gap v1.1
left open — see Revision Note and §4a below. Decisions D1–D4 unchanged
throughout.)
**Status:** Proposal
**Domain:** Assessment
**Closes:** `Assessment and Submission Aggregate Design.md`, §18 Future Evolution
— "AI adjusting Question difficulty within an in-progress Submission based
on prior Answers" (originally sourced from `Assessment Context.md` §10).

**Related Documents:**

- Assessment Context
- Assessment and Submission Aggregate Design
- AICreditsCommercialContractAndImplementationPlan (referenced in §6 — this
  proposal has no impact on it)

**Revision Note (v1.1):** The original v1.0 draft was written against the
prose Aggregate Design document only. Checking it against the actual
`Platform.Domain` code (`Submission.cs`, `Assessment.cs`,
`AssessmentEnums.cs`) surfaced three real corrections, folded in below and
marked **(v1.1)**: the state-machine claim in §4 was wrong about how much
new capability this needs, the auto-gradable Question Type list in §6 didn't
match the real enum, and neither v1.0 nor the base Aggregate Design document
mention `AssessmentKind` (Interactive vs. Standalone) at all, which turns
out to matter for scope. This is the reconciliation the base document's own
docs-vs-code drift (see `AICreditsCommercialContractAndImplementationPlan.md`
§1, which found the same pattern with `AiCreditsIncluded`) should have
prompted from the start — a lesson for the remaining proposals too.

---

# 1. Purpose

`Assessment and Submission Aggregate Design.md` §18 lists Adaptive
Assessment as deferred, undesigned Future Evolution. This proposal designs
it, as a discussion between product and engineering resolved four open
forks. It follows the same "Design Proposal" pattern already established by
`PDF and Image Lesson Content Extraction — Design Proposal.md` — a
standalone document that a future revision of the base Aggregate Design can
merge in once implementation is scheduled, rather than mutating the base
document ahead of that.

---

# 2. Decisions

## D1. Question Source: Pre-Authored Difficulty-Tagged Pool

**Not** live per-question AI generation. A tutor (or AI, via the existing
`GenerateLessonQuizSkill`/`GenerateStandaloneQuestionsSkill` pattern, at
authoring time — not during a live attempt) builds a pool of Questions per
Assessment, each tagged with a difficulty tier. "Adaptive" means selecting
from this pool at runtime, not writing new questions at runtime.

Rationale: keeps tutor content review in the loop (nothing reaches a
learner that wasn't authored/approved ahead of time), and — combined with
D2 — means this feature adds zero new AI provider calls.

## D2. Selection Logic: Deterministic Rule, No AI Call

A staircase rule, not an AI decision: correct answer → next question one
difficulty tier up; incorrect → one tier down (clamped to the pool's
min/max configured tiers). Ordinary C# logic inside the Submission
command handler — no new AI Skill, no `AiOrchestrator` call, no entry
needed in the AI credit price table.

Rationale: the alternative (AI picks the next question) was considered and
rejected — it would mean one AI call per question instead of per attempt
(a real, recurring cost on every single adaptive question a learner
answers), for adaptivity a simple statistical rule already provides.

## D3. Scoring: Difficulty-Weighted Points

`Points Possible` (already a field on Question, §7 of the base document)
becomes tier-driven instead of uniform: Easy = 1pt, Medium = 2pt, Hard =
3pt (exact values configurable per Assessment, these are defaults). Grade
is computed the same way the base document's §10 Achievement Determination
already works — points earned over points possible — except points possible
is now the sum of *this learner's actual path* through the pool, not a
fixed Assessment-wide total.

Rationale: two learners taking the same adaptive Assessment see different
Questions; raw percent-correct would let a learner routed to easy
questions outscore one routed to hard questions on the same material.
Weighting keeps scores comparable without inventing a new Grade shape.
Considered and deferred: mastery-threshold scoring ("Mastered / Not Yet"
instead of a score) — that's Future Evolution item #2, Competency-Based
Learning, from the same §18 list this proposal is closing one item of.
Building that now would mean redesigning scoring twice; flagged in §7
below as something to revisit if/when #2 is tackled.

## D4. Stop Condition: Fixed Question Count

An adaptive Assessment still asks a tutor-configured number of questions
per attempt (e.g. 10) — same shape as a non-adaptive quiz today. Only the
*difficulty* of those N questions adapts, not the attempt's length.

Rationale: a dynamic, confidence-based stop condition (end early once the
algorithm is statistically sure of the learner's level) was considered and
rejected for v1 — unpredictable attempt length is worse UX, harder to
communicate to a learner mid-attempt, and adds real complexity for a
signal (stopping confidence) nothing in the current system needs yet.

---

# 3. Data Model Changes

Extends `Assessment and Submission Aggregate Design.md` §7–8. No new
Aggregate Root — this lives entirely inside the existing Assessment and
Submission aggregates.

**Question (§7)** gains a `DifficultyTier` field (Easy / Medium / Hard).
`Points Possible` becomes derived from tier (D3) rather than freely set,
for Questions belonging to an adaptive Assessment specifically —
non-adaptive Assessments keep today's freely-set Points Possible unchanged.

**New value object: `AdaptiveConfiguration`**, attached to Assessment
alongside the existing Scoring Configuration (§8):

```text
AdaptiveConfiguration
├── Enabled                (bool — off by default; existing Assessments unaffected)
├── QuestionsPerAttempt    (int — D4)
├── StartingDifficulty     (Easy / Medium / Hard)
├── MinDifficulty / MaxDifficulty   (clamp bounds for the staircase rule)
└── DifficultyPoints       (map: Easy/Medium/Hard → Points Possible, D3)
```

**(v1.1) Scope correction: Standalone assessments only.** The real code
(`AssessmentEnums.cs`) has an `AssessmentKind` this proposal's v1.0 draft
never accounted for — `Interactive` (in-video checkpoint questions, each
pinned to a `VideoTimestampSeconds`, part of `Question`'s actual shape
today) versus `Standalone` (a separate quiz, taken in one sitting). Adaptive
selection doesn't make sense for `Interactive`: those questions are fixed
to specific points in a video timeline and can't be reordered or swapped
without breaking the video sync they exist for. `AdaptiveConfiguration`
below applies only to `AssessmentKind.Standalone`.

**(v1.1) `Points`, not "Points Possible."** The real `Question` entity
(`Assessment.cs`) already has an `int Points` field (must be > 0) — the
base Aggregate Design document's "Points Possible" naming doesn't match the
implemented property name. D3's difficulty-tier point values map onto this
existing field directly; no new field needed for the point value itself,
only for `DifficultyTier`.

**Publish-time validation:** Assessment's Draft → Published transition
(§13 state machine) gains a new precondition when `AdaptiveConfiguration.Enabled`
is true — the pool must contain enough Questions at each difficulty tier to
satisfy `QuestionsPerAttempt` under the worst realistic path (e.g. a learner
who answers every question correctly and climbs to Hard must not run out of
Hard questions before reaching the configured count). This is a content
completeness check, the same category of validation Draft → Published
already presumably performs for non-adaptive Assessments.

---

# 4. State Machine Impact

**(v1.1 — corrected.)** v1.0 of this proposal claimed the existing `Started`
state already anticipated adaptive's multi-round-trip interaction and that
no new capability was needed. Checked against the real `Submission.cs`,
that's not accurate, and the correction matters for scoping this work:

The **implemented** Submission is even more collapsed than the prose
Aggregate Design document's four-state model describes. There is no
separate `Started`/`Submitted`/`Evaluated`/`Result Issued` sequence in code
— `SubmissionStatus` is just `InProgress → Graded`, and `Submission.Grade()`
is a single atomic operation: it takes the *entire* `answersByQuestionId`
dictionary as one parameter, clears any existing answers, and records all
of them in the same call that computes the score. There is currently no
method on `Submission` that records one answer at a time while remaining
`InProgress` — every Assessment-target Submission today is genuinely
"answer everything, then submit everything," not merely "graded
synchronously the instant a batch submit arrives" the way v1.0 characterized
it.

**What this actually requires:** a new capability on the `Submission`
aggregate itself — something like `Submission.RecordAnswer(questionId,
response)`, appending one `SubmissionAnswer` at a time while `Status`
stays `InProgress`, distinct from today's `Grade()` which remains the
batch/final path used once `QuestionsPerAttempt` (D4) answers have
accumulated. No new `SubmissionStatus` value is needed — `InProgress` already
covers "attempt underway, not yet complete" whether that's instantaneous
(today's quizzes) or spans several round trips (adaptive) — but this is
genuinely new domain-model surface, not just new use of an idle state.
Flagging this as the single most important correction in this revision: it
changes this proposal from "wire up existing capability" to "add one new
method to a currently-atomic aggregate," which is a real, if still modest,
increase in scope over what v1.0 implied.

---

# 5. New Command

`RecordAdaptiveAnswer(SubmissionId, QuestionId, ResponseContent)` —
distinct from whatever batch "submit all answers" command the non-adaptive
path uses today (§15 Commands in the base document). Per call, this:

1. Records one Answer against the in-progress Submission.
2. Evaluates it immediately against the answer key — only possible today
   for auto-gradable Question Types (see §6's constraint below).
3. Applies the D2 staircase rule to pick the next difficulty tier.
4. Selects an unused Question at that tier from the Assessment's pool and
   returns its id — or, once `QuestionsPerAttempt` Answers have been
   recorded, signals attempt completion and triggers the existing
   Submitted → Evaluated transition.

---

# 6. New Invariants

**A Submission's Answers may only reference Questions the adaptive rule
actually selected for it.** Prevents a client from answering a Question it
was never presented — the pool exists server-side; the client only ever
sees the one Question it was just given.

**Adaptive Assessments are restricted to auto-gradable Question Types for
v1. (v1.1 — corrected list.)** v1.0 said "Multiple Choice" only, citing
Question Types that turned out not to match the real `QuestionType` enum
(`AssessmentEnums.cs`: `MultipleChoice, TrueFalse, CompleteTheSentence,
OpenAnswer` — not the base Aggregate Design document's "Multiple Choice,
Free Response, File Upload, Practical Task," which doesn't correspond to
any enum in code). The correct constraint: any type with an automatic
answer key — `MultipleChoice`, `TrueFalse`, `CompleteTheSentence` — is
eligible, since the staircase rule (D2) just needs an immediate right/wrong
signal, and the code's own comment on `QuestionType.OpenAnswer` confirms
it's "not auto-gradable" by design (reasoning/reflection has no single
right answer). In practice this is close to moot for v1 anyway: AI-generated
question pools (`PracticeQuizQuestion` in `LearningDeliveryModels.cs`) are
always multiple-choice-shaped today regardless, so the wider enum mostly
matters if a tutor hand-authors a `TrueFalse`/`CompleteTheSentence`
question into an adaptive pool directly. Adaptive `OpenAnswer` is out of
scope here, not designed away — see §7.

---

# 7. Explicitly Out of Scope for This Pass

- **Free Response / non-auto-gradable adaptive questions.** Blocked on
  having some synchronous correctness signal (e.g. AI-scored short answer
  fast enough to gate the next question) that doesn't exist today.
- **Dynamic, mastery-confidence-based stop condition** — deferred per D4.
- **Mastery-threshold scoring** — deferred per D3; revisit scoring together
  with Future Evolution item #2 (Competency-Based Learning) if/when that's
  tackled, rather than redesigning Grade twice.

---

# 8. AI / Commercial Impact

**None.** D1 + D2 together mean this feature adds no new AI provider call,
no new AI Skill, and requires no change to `AICreditsCommercialContractAndImplementationPlan.md`'s
skill price table (Part A2) — question pool authoring already goes through
the existing `GenerateLessonQuizSkill`/`GenerateStandaloneQuestionsSkill`
pricing, and adaptive selection at attempt-time is plain domain logic with
zero marginal AI cost. Worth stating explicitly since it's the natural
question given this was designed the same session as the AI credit
architecture — the deterministic-rule choice (D2) is what keeps it that
way, not an oversight.

---

# 4a. Concrete Design — Closing the §4 Gap (v1.2)

Designed directly against the real `Assessment.cs`/`Submission.cs`, not
sketched in the abstract. Reading `Assessment.Grade()`'s actual body first
surfaced a real bug this proposal would otherwise have shipped with —
covered in §4a.1 before the fix that avoids it.

## 4a.1 The Bug §4 Would Have Shipped: Grading Against the Whole Pool

`Assessment.Grade()` today iterates `_questions.OrderBy(q => q.Position)` —
**every** Question belonging to the Assessment, not just the ones a
particular answer dictionary covers; a missing entry for any of them is
treated as a wrong answer (`possible += q.Points`, `earned` unchanged).
That's correct for today's non-adaptive quizzes, where `_questions` *is*
the fixed set every learner answers. It is silently wrong for an adaptive
Assessment: per D1, the pool (`_questions`) is deliberately larger than
`QuestionsPerAttempt` — a learner who answers 10 questions out of a
40-question pool would, under today's `Grade()` unchanged, be scored
against all 40, with the 30 they were never shown counted as wrong. Final
scores would be capped near `QuestionsPerAttempt / PoolSize`, regardless of
how well the learner actually did. This would not fail loudly — it would
just silently produce wrong grades.

## 4a.2 The Fix: One Backward-Compatible Parameter

```csharp
// Assessment.cs — additive, optional parameter; every existing caller
// (AssessmentService, Submission.Grade()) is untouched and behaves exactly
// as today, since questionIdsToGrade defaults to null → grade every Question.
public (int ScorePercent, bool Passed, IReadOnlyList<QuestionGradeResult> PerQuestion) Grade(
    IReadOnlyDictionary<Guid, SubmittedAnswer> answersByQuestionId,
    IReadOnlyCollection<Guid>? questionIdsToGrade = null)
{
    var questionsToGrade = questionIdsToGrade is null
        ? _questions
        : _questions.Where(q => questionIdsToGrade.Contains(q.Id));

    // ...unchanged loop, now over questionsToGrade.OrderBy(q => q.Position)
    // instead of _questions.OrderBy(q => q.Position)...
}
```

This is the smallest possible fix — one nullable parameter, no behavior
change for any existing caller — and it's what makes reusing `Grade()` for
adaptive scoring safe rather than a second grading engine.

## 4a.3 New Domain Types

```csharp
// AssessmentEnums.cs
public enum DifficultyTier { Easy, Medium, Hard }  // ordinal order matters — see 4a.5's staircase step

// Assessment.cs
public sealed record AdaptiveConfiguration(
    bool Enabled,
    int QuestionsPerAttempt,          // D4
    DifficultyTier StartingDifficulty,
    DifficultyTier MinDifficulty,
    DifficultyTier MaxDifficulty,
    IReadOnlyDictionary<DifficultyTier, int> DifficultyPoints);  // D3 — maps onto Question.Points, §3

// Question gains (nullable — null for non-adaptive Assessments' Questions):
public DifficultyTier? DifficultyTier { get; private set; }

// Submission.cs — discriminated result, since RecordAdaptiveAnswer can end
// an attempt or continue it
public abstract record AdaptiveAnswerOutcome
{
    public sealed record NextQuestion(Guid QuestionId, DifficultyTier Tier) : AdaptiveAnswerOutcome;
    public sealed record Complete(int ScorePercent, bool Passed, IReadOnlyList<QuestionGradeResult> PerQuestion) : AdaptiveAnswerOutcome;
}
```

## 4a.4 Assessment.SelectNextAdaptiveQuestion

```csharp
// Assessment.cs — pure query over the pool; Submission has no Question
// data of its own to pick from, so selection lives where the pool does.
public Guid? SelectNextAdaptiveQuestion(DifficultyTier tier, IReadOnlySet<Guid> excludeQuestionIds) =>
    _questions
        .Where(q => q.DifficultyTier == tier && !excludeQuestionIds.Contains(q.Id))
        .OrderBy(_ => Guid.NewGuid())   // random within-tier pick — avoids the
        .Select(q => (Guid?)q.Id)       // same question order on every attempt
        .FirstOrDefault();
```

A `null` result means the pool ran out of that tier before
`QuestionsPerAttempt` was reached — exactly the case §3's publish-time pool
validation exists to prevent. `RecordAdaptiveAnswer` (§4a.5) treats it as
an invariant violation, not a normal outcome, since it should never happen
against a properly validated Assessment.

## 4a.5 Submission.RecordAdaptiveAnswer

```csharp
// Submission.cs — the new capability §4 identified as missing. Records one
// answer, grades only that one question (reusing the fixed Grade() from
// 4a.2 — not a second grading engine), applies the staircase rule, and
// either returns the next question or finalizes the attempt.
public AdaptiveAnswerOutcome RecordAdaptiveAnswer(
    Assessment assessment, int expectedAnswerSequence, Guid questionId, SubmittedAnswer answer)
{
    if (Status == SubmissionStatus.Graded)
        throw new InvalidOperationException("This submission has already been graded (INV-005).");

    if (expectedAnswerSequence != _answers.Count)
        throw new InvalidOperationException(
            $"Expected to record answer #{_answers.Count}, caller expected #{expectedAnswerSequence} " +
            "— likely a duplicate or out-of-order request."); // see 4a.6

    if (assessment.AdaptiveConfiguration is not { Enabled: true } config)
        throw new InvalidOperationException("This assessment is not configured for adaptive delivery.");

    _answers.Add(SubmissionAnswer.Create(Id, questionId, answer.SelectedOptionIndex, answer.TextAnswer));

    var (_, _, thisResult) = assessment.Grade(
        new Dictionary<Guid, SubmittedAnswer> { [questionId] = answer },
        questionIdsToGrade: [questionId]);
    var wasCorrect = thisResult[0].Correct ?? false;

    if (_answers.Count >= config.QuestionsPerAttempt)
    {
        var presentedIds = _answers.Select(a => a.QuestionId).ToList();
        var allAnswers = _answers.ToDictionary(a => a.QuestionId, a => new SubmittedAnswer(a.SelectedOptionIndex, a.TextAnswer));
        var (scorePercent, passed, perQuestion) = assessment.Grade(allAnswers, questionIdsToGrade: presentedIds);

        ScorePercent = scorePercent;
        Passed = passed;
        Status = SubmissionStatus.Graded;
        GradedAt = DateTime.UtcNow;
        return new AdaptiveAnswerOutcome.Complete(scorePercent, passed, perQuestion);
    }

    var currentTier = assessment.FindQuestionTier(questionId); // small new helper, mirrors existing FindQuestion
    var nextTier = StepTier(currentTier, wasCorrect, config.MinDifficulty, config.MaxDifficulty);
    var excludeIds = _answers.Select(a => a.QuestionId).ToHashSet();
    var nextQuestionId = assessment.SelectNextAdaptiveQuestion(nextTier, excludeIds)
        ?? throw new InvalidOperationException(
            "Adaptive pool exhausted at this difficulty — §3's publish-time validation should have prevented this.");

    return new AdaptiveAnswerOutcome.NextQuestion(nextQuestionId, nextTier);
}

private static DifficultyTier StepTier(DifficultyTier current, bool wasCorrect, DifficultyTier min, DifficultyTier max)
{
    var stepped = wasCorrect ? current + 1 : current - 1; // enum ordinal: Easy=0, Medium=1, Hard=2
    return (DifficultyTier)Math.Clamp((int)stepped, (int)min, (int)max);
}
```

**First question bootstrap:** `Submission.Start()` itself is unchanged —
the caller (API layer) calls `assessment.SelectNextAdaptiveQuestion(config.StartingDifficulty,
excludeQuestionIds: [])` once, immediately after `Start()`, to get question
#1. No change needed to `Start()`'s signature.

## 4a.6 Concurrency: Why an Application-Level Sequence Check, Not a DB Concurrency Token

Checked `Platform.Infrastructure` first rather than assuming: there is no
`RowVersion`/`ConcurrencyCheck` convention anywhere in this codebase today.
Introducing one just for this feature would be a new pattern, not a
consistent one. `expectedAnswerSequence` — the client echoes back the
answer count it last observed (0 for the first answer, 1 for the second,
…) — gives the same practical protection without a schema/EF change: a
retried or racing request with a stale count is rejected outright rather
than silently corrupting answer order or double-stepping the difficulty
staircase. If a genuine RowVersion convention gets adopted elsewhere in the
codebase later, this can layer on top of it; it doesn't need to wait for
that.

## 4a.7 One Known Cosmetic Gap

`Grade()`'s `PerQuestion` results are ordered by `Question.Position` (§4a.2,
unchanged from today), not by the order an adaptive learner actually
answered them. For non-adaptive quizzes these are the same order; for
adaptive, a per-question feedback UI listing results in Position order
would not match the learner's actual path through the pool. Not a
correctness bug — the scores are right — but worth a UI-layer fix (sort
`PerQuestion` by the Submission's own `Answers` order when rendering
adaptive results) rather than a domain-model one.

---

# 9. Status

**Proposal — Version 1.2.** Decisions (D1–D4) unchanged from v1.0. §4a now
gives a complete, code-level design for the one gap v1.1 flagged as open:
exact signatures for `Assessment.Grade()`'s backward-compatible extension,
`Submission.RecordAdaptiveAnswer`, the new domain types, and the
concurrency approach — plus a real scoring bug (§4a.1) that direct
implementation from v1.1 would have shipped. Ready to merge into
`Assessment and Submission Aggregate Design.md` as v1.2 whenever
implementation is scheduled; no further design gaps identified.
