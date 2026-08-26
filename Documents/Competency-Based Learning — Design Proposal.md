# Competency-Based Learning — Design Proposal

**Version:** 1.0
**Status:** Proposal
**Domain:** Assessment (with a dependency on Learning Delivery's existing
Learning Objectives)
**Closes:** `Assessment and Submission Aggregate Design.md`, §18 Future
Evolution — "Grades expressed as mastery levels rather than only scores"
(originally sourced from `Assessment Context.md` §11, and — as a scoring
question — flagged in `Adaptive Assessment — Design Proposal.md` §7 as
worth revisiting together with this item).

**Related Documents:**

- Assessment Context (§4.6 Grade already anticipates this — see §1 below)
- Assessment and Submission Aggregate Design
- Lesson Revision Aggregate Design (source of Learning Objectives)
- Curriculum Aggregate Design (§19 independently lists "competency-based
  progression" — explicitly out of scope here, see §6)

**Verification Note:** Checked §5's claim against the real code, prompted by
the same check turning up real corrections in the companion Adaptive
Assessment proposal. This one holds up: `PracticeQuizQuestion` (the actual
AI-generated question record, `Platform.Api/Models/LearningDeliveryModels.cs`)
is `(Prompt, Options, CorrectOptionIndex, Explanation)` — a flat record with
no `QuestionType` discrimination at all (AI-generated questions are always
multiple-choice-shaped today), confirming that adding one more property
(`AssessedObjective`) is exactly the small schema change §5 described, not
something more involved. No corrections needed to this document.

---

# 1. Purpose

Unlike Adaptive Assessment, this item wasn't undesigned so much as
half-designed and never finished: `Assessment Context.md` §4.6 already
gives Grade an example shape of "Score: 90%, Grade: A, Competency:
Mastered" — the base Aggregate Design's own Grade value object (§8) already
lists "Score, Letter Grade **or Competency Level**" as an alternative. What
was missing, and what this proposal resolves, is: a competency level of
*what*? Nothing in the domain today models a skill or competency as a
named, taggable thing. This proposal answers that with the smallest change
that realizes what §4.6 already sketched, rather than building the full
cross-aggregate system Curriculum §19 gestures at.

---

# 2. Decisions

## D1. Skill Source: Reuse Existing Learning Objectives

**Not** a new Skill/Competency taxonomy entity. Lesson Revision already has
Learning Objectives (`Lesson Revision Aggregate Design.md` §Learning
Objectives — free text, AI-generated via `GenerateLearningObjectivesSkill`
or tutor-edited, e.g. "Apply fraction addition to real-world problems").
A Question gains an optional tag naming which of its own Assessment's
source Lesson's Learning Objectives it tests.

Rationale: a real Skill taxonomy — a structured entity, reusable and
de-duplicated across lessons ("Fractions" meaning the same thing whether
tagged from Lesson 3 or Lesson 12) — is genuinely new modeling: an entity,
an authoring/curation workflow, likely a dedup pass so "Fractions" and
"Basic Fractions" don't fragment reporting. That's real scope, and it's
already independently listed as Curriculum's own future item (§19) rather
than something this proposal should absorb. Reusing Learning Objectives
gets the feature shipped now, using content that already exists, at the
cost of competency tags being lesson-scoped free text rather than a
platform-wide taxonomy — a Question in Lesson 3 and one in Lesson 12 that
both happen to teach fractions will not automatically be recognized as
"the same skill." That gap is the explicit trade for shipping now; §6
covers what closing it later would take.

## D2. Mastery Scope: Per-Submission, on Grade — Not a Persistent Record

Competency Level lives on Grade, exactly where §4.6 already put it in its
own example — one more piece of data produced when a Submission is graded,
scoped to that one attempt. **Not** a new aggregate tracking a learner's
mastery accumulated across their whole history.

Rationale: a persistent, cross-time mastery record ("across 5 lessons,
this learner has Mastered Fractions") is the version of competency-based
learning that's actually useful for reporting and progression decisions —
and it's real new aggregate-level modeling, naturally adjacent to
Identity's existing `Achievement` entity (already Identity-owned per
Identity Aggregate Design's PG-001), which would need to either grow a new
per-skill shape or gain a sibling concept next to it. That's a second,
separable proposal once this one's per-Submission version is live and
there's a real signal for what tutors actually want reported. Building the
persistent version first, before the per-attempt version exists to feed
it, would mean guessing at both problems at once.

---

# 3. Data Model Changes

Extends `Assessment and Submission Aggregate Design.md` §7–8. Additive
only — no existing field's meaning or behavior changes, and a Question
with no tag behaves exactly as today.

**Question (§7)** gains an optional field:

```text
Question
├── ... (unchanged: Question Id, Prompt, Question Type, Points Possible)
└── AssessedObjective   (nullable string — one of the source Lesson
                          Revision's own Learning Objectives, copied at
                          question-authoring time)
```

**Grade (§8)** gains a Competency Level *collection*, not a single value —
because a single Submission commonly answers questions spanning more than
one Learning Objective (a 10-question quiz might test three), so "the
Competency Level" isn't one thing for the whole Submission the way Score
is:

```text
Grade
├── ... (unchanged: Score, Letter Grade, Pass/Fail Determination)
└── CompetencyLevels   (list of: Objective → Level)
                        Level = Not Yet / Developing / Proficient / Mastered
```

Only objectives that at least one Answer in the Submission was tagged with
appear in the list — a Submission with no tagged Questions produces an
empty list and Grade behaves exactly as it does for every existing
Assessment today.

---

# 4. Determination Rule

Computed at the same point `Assessment.Grade()` already runs today (§10 of
the base document — synchronous, at submission time, no state-machine
change needed):

```text
For each distinct AssessedObjective among this Submission's Answers:
    % correct = (Answers correct for that Objective) / (Answers for that Objective)

    ≥ 80%  → Mastered
    50–79% → Developing
    < 50%  → Not Yet
```

Thresholds are illustrative defaults, not a hard commitment — worth a
tutor-facing configuration eventually, but not blocking a first version.

---

# 5. Authoring Integration — Zero New AI Cost

Same shape as Adaptive Assessment's D1+D2: this is an enrichment of an
existing AI Skill's structured output, not a new one. `GenerateQuestionsSkill`,
`GenerateLessonQuizSkill`, and `GenerateStandaloneQuestionsSkill` already
generate Questions from a Lesson's own material — including, already, its
Learning Objectives, per `LessonAssistantSkill`'s own system prompt listing
"Learning objectives" among the lesson material it's given. Adding
`AssessedObjective` to each generated Question's JSON shape is a schema
change to those skills' existing output, not a new `AiOrchestrator` call —
so, like Adaptive Assessment, **this adds no new entry to
`AICreditsCommercialContractAndImplementationPlan.md`'s price table.** A
tutor reviewing AI-generated questions (the same review step that already
exists per `Lesson Editing & Publication UX.md`) can also set or correct
the tag manually.

---

# 6. Explicitly Out of Scope for This Pass

- **A structured, platform-wide Skill/Competency taxonomy entity** (D1's
  alternative) — deferred to Curriculum's own §19 future item; this
  proposal's lesson-scoped free-text tags are a smaller, shippable first
  step, not a replacement for it.
- **Persistent, cross-time mastery tracking** (D2's alternative) — a
  second proposal once per-Submission Competency Level (this one) is live
  and there's real usage data on what tutors want rolled up, likely living
  near Identity's `Achievement` entity when it's tackled.
- **Tutor-configurable mastery thresholds** — §4's 80/50 split ships as a
  fixed default.
- **Certificate integration** ("Skill certificate," already listed as an
  example Certificate type in Assessment Context §4.7) — presupposes the
  persistent mastery record this pass deliberately doesn't build.

---

# 7. Status

**Proposal — Version 1.0.** Smaller in scope than Adaptive Assessment: no
new command, no new state, no new aggregate — a field on Question, a field
on Grade, and a threshold rule computed where grading already happens.
Ready to merge into `Assessment and Submission Aggregate Design.md` as a
future revision alongside the Adaptive Assessment proposal, once scheduled.
