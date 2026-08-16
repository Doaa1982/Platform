# Assessment and Submission Aggregate Design

> Version: 1.1
>
> Status: Draft
>
> Domain: Assessment
>
> Aggregate: Assessment, Submission
>
> Author: Business Analysis Team (drafted to close a documented gap — see Learning Workspace Architecture Gap Review); revised 2026-08-16 to generalize Submission beyond Assessment-only targets, closing a cross-document inconsistency the Assignment Aggregate Design and Learning Activity Assignment Business Analysis both exposed (§2, §7, §8, §9, §12, §14, §19)
>
> Related Documents:
>
> - Assessment Context
> - Platform Aggregate Catalogue
> - Enrollment Aggregate Design
> - Certificate Aggregate Design
> - Learning Delivery Context
> - Learning Workspace Domain Event Model
> - Learning Progress Tracking Business Analysis
> - Assignment Aggregate Design
> - Assignment Business Analysis
> - Learning Activity Assignment Business Analysis
> - PDF & Image Lesson Content Extraction — Design Proposal
>
> **Revision Note (v1.1):** Learning Activity Assignment Business Analysis states directly that "a Submission represents a learner's response to an Assignment," and that its own §10 Submission lifecycle is "the canonical lifecycle for the Submission aggregate, owned by Assessment Context." This document's v1.0, however, defined Submission as referencing an Assessment only (§8's Submission Metadata, INV-001, §19) — matching the code as built (`Submission.AssessmentId`, required, non-nullable). That was never contradicted until Assignment Aggregate Design formalized Assignment as its own Aggregate Root and, in its first draft, described Submission as referencing `AssignmentId` instead — introducing the opposite inconsistency in the other direction. Neither document was simply wrong; each described one real, needed case (an auto-graded quiz attempt; a homework-style response to a delivered Learning Activity) and generalized from it alone. §2, §7, §8, §9, §12, and §14 below resolve this: Submission now references exactly one of two targets, Assessment or Assignment, and everything specific to the existing quiz-grading path is preserved unchanged. This generalization is written at the Aggregate Design level only — the first concrete use of the Assignment-target path is scoped and implemented separately, as a deliberately narrower `HomeworkSubmission` bridge, in PDF & Image Lesson Content Extraction — Design Proposal, §11.
>
> **Revision Note (v1.0):** Original publication — see §17 for the six-Aggregate-Design gap this document itself closed.

---

# 1. Overview

The Assessment and Submission Aggregates together represent how the platform measures and records learner achievement.

This document has been cited by name — including specific section references — throughout the corpus since before it existed: Certificate Aggregate Design, the Learning Workspace Bounded Context Map, Discussion Thread Aggregate Design, Workspace Aggregate Design, Membership Aggregate Design, Identity Aggregate Design, and AI Collaboration Session Aggregate Design all reference "Assessment and Submission Aggregate Design, Section 10" or "Section 17" as settled fact. It was not, until now. This document supplies that missing foundation, using the same Aggregate Design template applied elsewhere in the corpus (Overview, Vision, Responsibilities, Aggregate Root, Structure, Entities, Value Objects, Relationships, Invariants, State Machine, Commands, Domain Events, Architectural Rationale, Future Evolution).

Assessment Context already provides business-analysis-level treatment of these concepts (definitions, business rules, relationships, lifecycle). This document does not replace that document — it completes it, in the same way Certificate Aggregate Design and Discussion Thread Aggregate Design each completed a business-analysis document that existed only as a Bounded Context Map subsection. Here, the underlying business-analysis document (Assessment Context) already exists in full; what was missing was the aggregate-level specification: Aggregate Roots, entities, invariants, and state machines for Assessment and Submission specifically.

As of v1.1, this document also reconciles Submission against a second business-analysis source that names it: Learning Activity Assignment Business Analysis, §10, which independently describes Submission as the canonical record of "a learner's response to an Assignment." §2 below explains how both sources are correct about the same Aggregate Root.

---

# 2. Vision

Assessment and Submission together answer the question Assessment Context poses:

> "How do we know that learning has happened?"

Split across the two Aggregate Roots:

```text
Assessment answers:    "What does it take to demonstrate this achievement?"
Submission answers:    "Did this specific learner demonstrate it?"
```

An Assessment is a reusable, design-time definition — criteria, evaluation method, scoring approach (Assessment Context, Section 4.1). A Submission is one learner's evidence against that definition, produced at a specific point in time and evaluated once. Assessment Context uses the term "Assessment Attempt" for this same concept (Section 4.3); this document adopts **Submission** as the Aggregate Root name, matching the Platform Aggregate Catalogue (Section 3: "Submission | Represents a learner's submitted work") and the Aggregate Ownership Rules table (Section 6: "Learner Submission | Submission"). Assessment Attempt and Submission name the same business object; this document uses Submission throughout for consistency with the Catalogue, and treats "Assessment Attempt" as Assessment Context's business-facing synonym for it — the same kind of terminology reconciliation Assessment Context itself performed in its v1.1 revision note when it renamed "Assignment" to "Graded Task."

**What generalizes in v1.1, and what doesn't.** Submission's question — "did this specific learner demonstrate it?" — turns out not to be specific to Assessment. Learning Activity Assignment Business Analysis describes the same question asked of an Assignment-delivered Learning Activity that is not an Assessment at all: Homework, a Reading response, a File Upload, a Discussion post. What a learner submits, and what "demonstrating it" means, differs (per-question answers scored against Points Possible, versus a free-form response a tutor reviews) — but *that* a Submission is one learner's evidence, produced once, evaluated once, is the same shape either way. So:

- **Assessment does not change.** It remains the reusable, design-time definition of a quiz-shaped evaluation — Questions, Rubric, Scoring Configuration.
- **Submission generalizes to reference either an Assessment or an Assignment** — never both, never neither (§12, INV-001). Which one it references determines how it is answered and evaluated, not whether it is a Submission.
- **Assignment, per Assignment Aggregate Design §6, owns no entities of its own** — it does not own Submissions any more than Assessment does. Submission's independence from whichever Aggregate it targets (§4, §17) is exactly the same rationale in both directions.

---

# 3. Responsibilities

## Assessment is responsible for:

- Defining evaluation criteria, objectives, and scoring approach (Assessment Context, Section 4.1).
- Owning Questions and Rubrics used to structure evaluation.
- Managing its own publication lifecycle (Draft → Published → Closed, per Platform Aggregate Catalogue, Section 8).
- Defining completion requirements a Submission must satisfy.

## Assessment is **not** responsible for:

- Any individual learner's evidence or score — that is Submission's responsibility.
- Determining whether a Learning Product is complete — that is Enrollment's responsibility (Enrollment Aggregate Design, Section 15).
- Issuing proof of achievement — that is Certificate's responsibility (Certificate Aggregate Design, Section 3).

## Submission is responsible for:

- Recording one learner's evidence (answers, files, responses) against a specific Assessment, **or against a specific Assignment when the delivered Learning Activity is not itself an Assessment** (v1.1).
- Managing its own evaluation lifecycle independently of other Submissions against the same target.
- Owning the Evaluation outcome and resulting Grade for that one attempt.
- Enforcing attempt-level rules (e.g., attempt limits) in collaboration with its referenced Assessment's configuration, or its referenced Assignment's Attempt Policy (Assignment Aggregate Design, §7).

## Submission is **not** responsible for:

- Defining or changing the criteria it is evaluated against — those belong to Assessment or Assignment and are referenced, not owned.
- Aggregating a learner's achievement across multiple Assessments/Assignments or across a whole Learning Product — that is Enrollment's and, ultimately, Identity's Achievement entity (Identity Aggregate Design, Section 7).
- Determining an Assignment's delivery policy (availability, scheduling, recipients) — that remains entirely Assignment's responsibility (Assignment Aggregate Design, §3). Submission only records and evaluates what happens *after* delivery.

---

# 4. Aggregate Roots

```text
Assessment
Submission
```

Assessment and Submission are modeled as two separate Aggregate Roots rather than one, because they change at different rates, are referenced independently by other aggregates, and have independent lifecycles. A single Assessment (e.g., a course final exam) may be referenced by thousands of Submissions, each with its own transactional boundary — grading one learner's Submission must never contend for a lock on the Assessment definition itself, or on any other learner's Submission. This mirrors the same reasoning already applied elsewhere in the corpus to split Lesson from Lesson Revision and Learning Product from Curriculum. The full rationale is expanded in Section 17.

The same reasoning holds, unchanged, for Submission's relationship to Assignment (v1.1): an Assignment delivering Homework to a whole cohort must not contend for a lock every time one learner's response is submitted or evaluated.

---

# 5. Aggregate Structure — Assessment

```text
Assessment (Aggregate Root)

├── Assessment Metadata
├── Questions
│      └── Question (Entity)
├── Rubric
│      └── Rubric Criterion (Entity)
├── Scoring Configuration
└── Publication State
```

---

# 6. Aggregate Structure — Submission

```text
Submission (Aggregate Root)

├── Submission Metadata  (Target: AssessmentId or AssignmentId — exactly one, v1.1)
├── Answers / Evidence
│      ├── Answer (Entity — Assessment-target only, per-Question)
│      └── Response (Value Object — Assignment-target only, free-form, v1.1)
├── Evaluation
├── Grade
└── Submission Status
```

---

# 7. Entities

## Question

Belongs to Assessment. Represents one item a learner must respond to.

Has: Question Id, Prompt, Question Type (Multiple Choice, Free Response, File Upload, Practical Task, per Assessment Context Section 4.1's Assessment Types), Points Possible.

## Rubric Criterion

Belongs to Assessment, within its Rubric. Represents one dimension of quality being evaluated (Assessment Context, Section 4.5).

Has: Criterion Id, Name, Performance Levels (e.g., Excellent / Good / Developing / Needs Improvement).

## Answer

Belongs to Submission, **when its target is an Assessment**. Represents one learner response to one Question.

Has: Answer Id, QuestionId, Response Content, Submitted At.

**Does not apply to Assignment-target Submissions** (v1.1) — an Assignment-delivered Learning Activity like Homework has no Question collection to answer against; its evidence is the Response value object below instead. A Submission has either Answers or a Response, never both, matching which target it references.

## Evaluation

Belongs to Submission, **either target**. Represents the act of judging that Submission's evidence — Answers against the referenced Assessment's Rubric, or a Response against the referenced Assignment's Evaluation Policy (v1.1) — against Points Possible or Assessment/Assignment-defined criteria.

Has: Evaluation Id, Evaluator (MembershipId or "Automatic" or "AI"), Evaluation Method (Automatic, Teacher Evaluation, Peer Evaluation, AI Evaluation, Mixed Evaluation — per Assessment Context, Section 4.4, for Assessment-target Submissions; Automatic, Manual, AI-Assisted, or Hybrid — per Assignment Aggregate Design, §7's Evaluation Policy — for Assignment-target Submissions), Evaluated At, Per-Criterion Scores (Assessment-target) or Feedback text and Pass/Fail (Assignment-target, v1.1 — a free-form Response is not always meaningfully scored per-criterion the way a Rubric-graded Assessment is).

---

# 8. Value Objects

## Assessment Metadata

Contains: Title, Description, Assessment Type (Quiz, Exam, Graded Task, Project, Interview, Presentation, Practical Task, Portfolio Review, AI Evaluation — per Assessment Context, Section 4.1), Assessment Template Reference (if derived from a reusable template, Assessment Context Section 4.2).

## Scoring Configuration

Contains: Passing Threshold, Attempt Limit (optional), Weighting.

## Submission Metadata

Contains: **exactly one of** AssessmentId **or** AssignmentId (the Target, v1.1 — see INV-001), Submitter MembershipId, Attempt Number, Started At, Submitted At.

## Response (v1.1, Assignment-target only)

Contains: Text Response (optional), Attached Learning Asset reference (optional, by identifier only, consistent with AGG-003 — an uploaded file, referenced the same way `LessonResource` already references its `LearningAssetId`). At least one of the two must be present for a Submission to be submitted (§12, INV-007).

## Grade

Contains: Score, Letter Grade or Competency Level (per Assessment Context, Section 4.6), Pass/Fail Determination against Assessment's Scoring Configuration, **or against the reviewing Evaluation's Pass/Fail outcome for an Assignment-target Submission (v1.1)** — an Assignment has no Scoring Configuration of its own to compare against; the Evaluator's judgment is the determination.

---

# 9. Aggregate Relationships

```text
Lesson (Learning Delivery)

↓ (may require)

Assessment                              Assignment (v1.1)
                                         ↑ (delivers)
                                         Learning Activity (owned by Lesson Revision)

↓ (referenced by, many)                 ↓ (referenced by, many)

                    Submission
                    (references exactly one of Assessment or Assignment)

                          ↓ (authored by)

                       Membership
```

Assessment does not contain its Submissions; Assignment does not contain its Submissions either (Assignment Aggregate Design, §6, §8) — a Submission references its target by identifier only (AssessmentId or AssignmentId, never both), consistent with AGG-003 in the Platform Aggregate Catalogue. This is the same referencing discipline in both directions; v1.1 does not weaken it, it extends it to a second target type.

---

# 10. Achievement Determination and Grading

This is the section other documents in the corpus cite directly (Certificate Aggregate Design, Section 2; Learning Workspace Bounded Context Map, Section 5.15) as the source of truth for how assessment-level achievement is determined.

Achievement, at the assessment level, is determined as follows:

1. A Submission is Evaluated, producing per-criterion scores against the referenced Assessment's Rubric (or an automatic/AI score against its Questions' Points Possible).
2. Those scores are aggregated into a Grade, per the Assessment's Scoring Configuration (Section 8, above).
3. The Grade is compared against the Assessment's Passing Threshold. If met or exceeded, the Submission's achievement criteria are considered satisfied.
4. This satisfaction is what Certificate Aggregate Design, Section 9, refers to as "Submission (Evaluated, criteria met)" — one of the two possible triggers (alongside Enrollment completion) for Certificate issuance.

Evaluation Method is deliberately decoupled from this determination: whether a Grade was produced by Teacher Evaluation, Peer Evaluation, AI Evaluation, or an Automatic method (Assessment Context, Section 4.4 and Rule 3 — "Evaluation Method Is Flexible") does not change how achievement is determined once the Grade exists. Assessment and Submission do not distinguish "AI-graded achievement" from "teacher-graded achievement" — both produce an ordinary Grade, subject to the same Passing Threshold comparison.

Consistent with Assessment Context, Rule 2 ("Assessment Results Are Historical Records"), a Grade is not silently altered after Result Issued (see INV-005). Correcting a Grade requires a new Evaluation, preserving the original as history — the same pattern Certificate Aggregate Design applies to correcting an issued Certificate (INV-004 there) and Enrollment Aggregate Design applies to its own status transitions.

**For an Assignment-target Submission (v1.1),** the same four-step shape applies with one substitution: step 1 and 2 collapse into a single Evaluation producing a Pass/Fail (or, for Evaluation Methods that don't resolve to a binary outcome, Feedback only, with no Grade) — there is no per-criterion Rubric to aggregate unless the tutor has attached one via a future Rubric-based Evaluation Method (Learning Activity Assignment Business Analysis's Evaluation types list this as a supported mode; not built in v1, see §18). Step 3's comparison is against the Evaluator's own judgment rather than a Scoring Configuration threshold, since Assignment owns no Scoring Configuration (Assignment Aggregate Design, §7). Step 4 is unaffected — an Evaluated, criteria-met Assignment-target Submission is exactly as valid a Certificate trigger as an Assessment-target one, since Certificate Aggregate Design references "Submission (Evaluated, criteria met)" generically, not Assessment-target specifically.

---

# 11. Relationship to Enrollment and Certificate — the Core Distinction

```text
Submission answers:     "Did this learner meet the bar on this one Assessment (or Assignment, v1.1)?"
Enrollment answers:     "Has this learner completed the Learning Product overall?"
Certificate answers:    "Here is the formal, presentable record that either (or both) happened."
```

Enrollment Aggregate Design, Section 13, already establishes that Enrollment "does not own or track certificates; it is referenced by identifier only." This document establishes the reciprocal boundary from the Assessment side: Submission determines and records achievement at the individual-assessment (or individual-assignment) level, but never issues, presents, or verifies proof of that achievement — that responsibility belongs entirely to Certificate (Certificate Aggregate Design, Section 3), which references a satisfying Submission by identifier only (AssessmentId + SubmissionId, per Certificate Aggregate Design, Section 8, "Achievement Criteria Reference"). Whether Certificate Aggregate Design's reference needs a parallel AssignmentId + SubmissionId path is out of scope here — no Assignment-target Submission has yet been wired into any Certificate trigger; flagged for that document's own future revision if and when it is.

---

# 12. Business Invariants

## INV-001

Every Submission references exactly one Target — either an Assessment or an Assignment, never both, never neither (v1.1, generalized from "exactly one Assessment") — and exactly one submitting Membership.

---

## INV-002

An Assessment cannot receive Submissions until it is Published. **An Assignment cannot receive Submissions until it has reached Published or Active status (v1.1, mirrors Assignment Aggregate Design INV-007).**

---

## INV-003

A Submission's Attempt Number is enforced against its target's Attempt Limit when configured — the Assessment's Scoring Configuration, or the Assignment's Attempt Policy (v1.1, Assignment Aggregate Design §7); a Submission that would exceed the limit cannot be started.

---

## INV-004

A Submission may only be Evaluated once it has reached Submitted status; Evaluation cannot be recorded against an in-progress Submission. **This applies identically to both targets; it does not require Submitted and Evaluated to be temporally distinct — an Assessment-target Submission may reach both in the same instant when grading is synchronous (§14's note), while an Assignment-target Submission's grading is not usually synchronous (v1.1).**

---

## INV-005

Once a Submission reaches Result Issued, its Grade is not silently modified. Correcting it requires a new Evaluation, preserving the original as history (Assessment Context, Rule 2).

---

## INV-006

Closing an Assessment does not retroactively invalidate previously issued Grades on its existing Submissions. **Closing or Archiving an Assignment does not retroactively invalidate previously issued Evaluations on its existing Submissions either (v1.1) — matches BA-009's own principle that operational Assignment changes never rewrite history.**

---

## INV-007 (v1.1)

An Assignment-target Submission must carry at least one of Text Response or an attached Learning Asset reference before it can transition to Submitted — an empty Response cannot be submitted for evaluation. No equivalent constraint is needed for Assessment-target Submissions, since Answers are validated per-Question by the existing Assessment.Grade() path.

---

# 13. State Machine — Assessment

```text
Draft

↓

Published

↓

Closed
```

Matches the lifecycle already declared in Platform Aggregate Catalogue, Section 8.

---

# 14. State Machine — Submission

```text
Started

↓

Submitted

↓

Evaluated

↓

Result Issued
```

The Platform Aggregate Catalogue's Section 8 lifecycle listing covered Assessment but did not separately enumerate Submission's lifecycle; this document supplies it, derived from the Assessment Attempt lifecycle already implicit in Assessment Context, Section 9 ("Attempt Started → Submitted → Evaluated → Result Issued").

**Two targets, two paces through the same four states (v1.1).** An Assessment-target Submission's grading is synchronous today (Assessment.Grade() runs the instant answers are submitted), so it passes through Submitted and Evaluated/Result Issued in the same transaction — the "collapsed to two states" note on the as-built `SubmissionStatus` enum describes this specific case, not a different state machine. An Assignment-target Submission's grading is not synchronous — a real gap exists between a learner submitting a Homework response and a tutor (or AI-assisted, tutor-confirmed) Evaluation being recorded — so it passes through Submitted, optionally an interim Under Review point while a tutor has opened but not yet finished reviewing it, and only then Evaluated/Result Issued. Both are the same four-state lifecycle; only the elapsed time between states differs, exactly as this section's own state machine already allows.

---

# 15. Commands

- CreateAssessment
- ConfigureAssessment
- PublishAssessment
- CloseAssessment
- StartSubmission
- SubmitWork
- EvaluateSubmission
- IssueResult
- **RecordAssignmentResponse (v1.1)** — the Assignment-target equivalent of SubmitWork: attaches a Response (Text and/or an uploaded Learning Asset) and transitions Submitted.
- **BeginAssignmentReview (v1.1, optional)** — marks an Assignment-target Submission Under Review; purely informational, no business rule depends on it.

---

# 16. Domain Events

- AssessmentCreated
- AssessmentPublished
- AssessmentClosed
- SubmissionStarted
- SubmissionEvaluated
- ResultIssued
- **SubmissionSubmittedForReview (v1.1)** — the Assignment-target counterpart of SubmissionStarted reaching Submitted; consumed by the delivering Assignment (for tutor-facing "N submissions awaiting review" counts) and, per PDF & Image Lesson Content Extraction — Design Proposal §11, by Lesson Progress when the delivering Lesson Revision has `RequireHomeworkToComplete` set.

`AssessmentCreated` and `AssessmentEvaluated` are already referenced in the Learning Workspace Domain Event Model, Section 10, as coarser integration events; this document's `SubmissionStarted`, `SubmissionEvaluated`, and `ResultIssued` are the aggregate-level detail underneath them. `AssessmentSubmitted` (Domain Event Model, Section 10) is this document's integration-event counterpart of `SubmissionStarted`/submission completion. `AchievementGranted` (Domain Event Model, Section 10) is triggered downstream of `ResultIssued` when the resulting Grade satisfies the Assessment's Passing Threshold, and is consumed by Certificate (Certificate Aggregate Design, Section 11 treats it as the counterpart of `CertificateIssued`). Whether `AchievementGranted` should also fire for an Evaluated, criteria-met Assignment-target Submission is left to Certificate Aggregate Design's own future revision (§11 above).

---

# 17. Architectural Rationale

**Why Submission is independent from Assessment.** Submission needed independence from Assessment precisely because of its own high-frequency, independently-referenced lifecycle — a single popular Assessment may accumulate thousands of Submissions, each evaluated, corrected, and referenced (by Certificate, by Enrollment eligibility checks, by Identity's Achievement history) on its own schedule. Modeling Submission as a child entity of Assessment, the way Discussion Thread models Comment (Discussion Thread Aggregate Design, Section 16), would force every grading action to contend for the same Assessment-level consistency boundary. Keeping them as separate Aggregate Roots, connected only by AssessmentId, avoids that contention and matches AGG-006 (Platform Aggregate Catalogue, Section 2) — aggregates should be small enough to support transactional consistency while remaining cohesive.

**Why Submission generalizes to a second target instead of Assignment getting its own parallel Submission-like Aggregate (v1.1).** The alternative to this section's generalization was inventing a second Aggregate Root — something like "AssignmentResponse" — parallel to Submission but independent of it. That was rejected: Learning Activity Assignment Business Analysis already treats Submission as the single concept covering both cases (its own §10 explicitly generalizes past quiz attempts — "Answers, Uploaded files, Text responses, Code, External links, AI conversation history, Rich media"), and a learner's Submission history, achievement record, and Certificate eligibility (§11 above) are all more coherent as one Aggregate type with two target kinds than as two Aggregate types a learner's history would have to merge across. The cost of generalizing is a nullable-target field and a target-kind branch in a few places (Answers vs. Response, §7; Scoring Configuration vs. Evaluation Policy comparison, §10) — smaller than the cost of a parallel Aggregate that duplicates Submission's entire lifecycle, invariants, and event model under a different name.

**Summary — status of previously identified gaps.** At the time other documents in this corpus began citing this section, six Aggregate Roots from the Platform Aggregate Catalogue remained without dedicated Aggregate Design documentation: **Identity, Workspace, Membership, Certificate, Discussion Thread, and AI Collaboration Session**. Each of those documents, once written, described itself as closing "one more gap identified in Assessment & Submission Aggregate Design, Section 17" — this section is that original reference point, supplied retroactively. All six now have complete, structurally consistent Aggregate Design documents elsewhere in this corpus. AI Collaboration Session Aggregate Design, Section 17, went further and stated that with its own publication, "every Aggregate Root listed in the Platform Aggregate Catalogue... now has a corresponding, structurally consistent Aggregate Design document" — a claim that was not yet true, because this document, the one it was itself built on top of, did not exist. It is true now. A seventh root, Assignment, was added to the Catalogue after all of the above (Platform Aggregate Catalogue, Revision Note v1.3) with its own Aggregate Design document; this document's v1.1 revision is what keeps that addition consistent with Submission rather than leaving two documents quietly disagreeing about what Submission references.

---

# 18. Future Evolution

- Competency-Based Learning: Grades expressed as mastery levels rather than only scores (Assessment Context, Section 11).
- Standards Alignment: Assessments mapped to external frameworks (Cambridge, CEFR, professional standards).
- Portfolio Assessment: Submissions composed of accumulated evidence rather than a single response (Assessment Context, Section 11).
- Adaptive Assessment: AI adjusting Question difficulty within an in-progress Submission based on prior Answers (Assessment Context, Section 10).
- **Rubric-based evaluation for Assignment-target Submissions (v1.1).** Learning Activity Assignment Business Analysis lists Rubric-based as a supported Evaluation Method; this document's v1.1 generalization only wires through Pass/Fail-or-Feedback (§10). Extending Rubric Criterion (§7) to be attachable to an Assignment, not just an Assessment, would close this — deferred until a concrete Assignment-delivered Learning Activity actually needs it.
- **Migrating the `HomeworkSubmission` v1 bridge onto this generalized model.** PDF & Image Lesson Content Extraction — Design Proposal §11 deliberately does not build against `AssignmentId` yet, since Assignment itself has no implementation. Once Assignment ships, `HomeworkSubmission` rows are expected to migrate to Assignment-target Submissions with no change to their own recorded evidence.

---

# 19. Aggregate References

Both Aggregates reference other aggregates only by identifier:

Assessment

- LessonId

Submission

- **AssessmentId (nullable, v1.1) or AssignmentId (nullable, v1.1) — exactly one set, never both (INV-001)**
- Submitter MembershipId

---

# Summary

The Assessment Aggregate is the authoritative owner of what it takes to demonstrate an achievement; the Submission Aggregate is the authoritative owner of whether one specific learner did. Neither owns Enrollment's product-level completion determination or Certificate's issuance and presentation — both are referenced by identifier only. This document supplies the aggregate-level specification that the rest of the corpus has cited as settled since before it was written, and closes the loop opened in Section 17: all six Aggregate Roots that depended on this document's existence now have one to depend on.

**v1.1** extends that foundation to a seventh: Assignment. Submission was already the platform's answer to "did this learner demonstrate it" for Assessment-target work; Learning Activity Assignment Business Analysis had already said, independently, that the same question and the same Aggregate applied to Assignment-delivered work like Homework. Generalizing Submission's Target from "exactly one Assessment" to "exactly one Assessment or Assignment" resolves that without inventing a second Aggregate, without changing the existing quiz-grading path's behavior at all, and without leaving two documents — this one and Assignment Aggregate Design — quietly disagreeing about what Submission points to.
