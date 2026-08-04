# Assessment and Submission Aggregate Design

> Version: 1.0
>
> Status: Draft
>
> Domain: Assessment
>
> Aggregate: Assessment, Submission
>
> Author: Business Analysis Team (drafted to close a documented gap — see Learning Workspace Architecture Gap Review)
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

---

# 1. Overview

The Assessment and Submission Aggregates together represent how the platform measures and records learner achievement.

This document has been cited by name — including specific section references — throughout the corpus since before it existed: Certificate Aggregate Design, the Learning Workspace Bounded Context Map, Discussion Thread Aggregate Design, Workspace Aggregate Design, Membership Aggregate Design, Identity Aggregate Design, and AI Collaboration Session Aggregate Design all reference "Assessment and Submission Aggregate Design, Section 10" or "Section 17" as settled fact. It was not, until now. This document supplies that missing foundation, using the same Aggregate Design template applied elsewhere in the corpus (Overview, Vision, Responsibilities, Aggregate Root, Structure, Entities, Value Objects, Relationships, Invariants, State Machine, Commands, Domain Events, Architectural Rationale, Future Evolution).

Assessment Context already provides business-analysis-level treatment of these concepts (definitions, business rules, relationships, lifecycle). This document does not replace that document — it completes it, in the same way Certificate Aggregate Design and Discussion Thread Aggregate Design each completed a business-analysis document that existed only as a Bounded Context Map subsection. Here, the underlying business-analysis document (Assessment Context) already exists in full; what was missing was the aggregate-level specification: Aggregate Roots, entities, invariants, and state machines for Assessment and Submission specifically.

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

- Recording one learner's evidence (answers, files, responses) against a specific Assessment.
- Managing its own evaluation lifecycle independently of other Submissions against the same Assessment.
- Owning the Evaluation outcome and resulting Grade for that one attempt.
- Enforcing attempt-level rules (e.g., attempt limits) in collaboration with its referenced Assessment's configuration.

## Submission is **not** responsible for:

- Defining or changing the criteria it is evaluated against — those belong to Assessment and are referenced, not owned.
- Aggregating a learner's achievement across multiple Assessments or across a whole Learning Product — that is Enrollment's and, ultimately, Identity's Achievement entity (Identity Aggregate Design, Section 7).

---

# 4. Aggregate Roots

```text
Assessment
Submission
```

Assessment and Submission are modeled as two separate Aggregate Roots rather than one, because they change at different rates, are referenced independently by other aggregates, and have independent lifecycles. A single Assessment (e.g., a course final exam) may be referenced by thousands of Submissions, each with its own transactional boundary — grading one learner's Submission must never contend for a lock on the Assessment definition itself, or on any other learner's Submission. This mirrors the same reasoning already applied elsewhere in the corpus to split Lesson from Lesson Revision and Learning Product from Curriculum. The full rationale is expanded in Section 17.

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

├── Submission Metadata
├── Answers / Evidence
│      └── Answer (Entity)
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

Belongs to Submission. Represents one learner response to one Question.

Has: Answer Id, QuestionId, Response Content, Submitted At.

## Evaluation

Belongs to Submission. Represents the act of judging that Submission's Answers against the referenced Assessment's Rubric.

Has: Evaluation Id, Evaluator (MembershipId or "Automatic" or "AI"), Evaluation Method (Automatic, Teacher Evaluation, Peer Evaluation, AI Evaluation, Mixed Evaluation — per Assessment Context, Section 4.4), Evaluated At, Per-Criterion Scores.

---

# 8. Value Objects

## Assessment Metadata

Contains: Title, Description, Assessment Type (Quiz, Exam, Graded Task, Project, Interview, Presentation, Practical Task, Portfolio Review, AI Evaluation — per Assessment Context, Section 4.1), Assessment Template Reference (if derived from a reusable template, Assessment Context Section 4.2).

## Scoring Configuration

Contains: Passing Threshold, Attempt Limit (optional), Weighting.

## Submission Metadata

Contains: AssessmentId, Submitter MembershipId, Attempt Number, Started At, Submitted At.

## Grade

Contains: Score, Letter Grade or Competency Level (per Assessment Context, Section 4.6), Pass/Fail Determination against Assessment's Scoring Configuration.

---

# 9. Aggregate Relationships

```text
Lesson (Learning Delivery)

↓ (may require)

Assessment

↓ (referenced by, many)

Submission

↓ (authored by)

Membership
```

Assessment does not contain its Submissions; Submission references its Assessment by identifier only (AssessmentId), consistent with AGG-003 in the Platform Aggregate Catalogue.

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

---

# 11. Relationship to Enrollment and Certificate — the Core Distinction

```text
Submission answers:     "Did this learner meet the bar on this one Assessment?"
Enrollment answers:     "Has this learner completed the Learning Product overall?"
Certificate answers:    "Here is the formal, presentable record that either (or both) happened."
```

Enrollment Aggregate Design, Section 13, already establishes that Enrollment "does not own or track certificates; it is referenced by identifier only." This document establishes the reciprocal boundary from the Assessment side: Submission determines and records achievement at the individual-assessment level, but never issues, presents, or verifies proof of that achievement — that responsibility belongs entirely to Certificate (Certificate Aggregate Design, Section 3), which references a satisfying Submission by identifier only (AssessmentId + SubmissionId, per Certificate Aggregate Design, Section 8, "Achievement Criteria Reference").

---

# 12. Business Invariants

## INV-001

Every Submission references exactly one Assessment and exactly one submitting Membership.

---

## INV-002

An Assessment cannot receive Submissions until it is Published.

---

## INV-003

A Submission's Attempt Number is enforced against its Assessment's Attempt Limit (when configured); a Submission that would exceed the limit cannot be started.

---

## INV-004

A Submission may only be Evaluated once it has reached Submitted status; Evaluation cannot be recorded against an in-progress Submission.

---

## INV-005

Once a Submission reaches Result Issued, its Grade is not silently modified. Correcting it requires a new Evaluation, preserving the original as history (Assessment Context, Rule 2).

---

## INV-006

Closing an Assessment does not retroactively invalidate previously issued Grades on its existing Submissions.

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

---

# 16. Domain Events

- AssessmentCreated
- AssessmentPublished
- AssessmentClosed
- SubmissionStarted
- SubmissionEvaluated
- ResultIssued

`AssessmentCreated` and `AssessmentEvaluated` are already referenced in the Learning Workspace Domain Event Model, Section 10, as coarser integration events; this document's `SubmissionStarted`, `SubmissionEvaluated`, and `ResultIssued` are the aggregate-level detail underneath them. `AssessmentSubmitted` (Domain Event Model, Section 10) is this document's integration-event counterpart of `SubmissionStarted`/submission completion. `AchievementGranted` (Domain Event Model, Section 10) is triggered downstream of `ResultIssued` when the resulting Grade satisfies the Assessment's Passing Threshold, and is consumed by Certificate (Certificate Aggregate Design, Section 11 treats it as the counterpart of `CertificateIssued`).

---

# 17. Architectural Rationale

**Why Submission is independent from Assessment.** Submission needed independence from Assessment precisely because of its own high-frequency, independently-referenced lifecycle — a single popular Assessment may accumulate thousands of Submissions, each evaluated, corrected, and referenced (by Certificate, by Enrollment eligibility checks, by Identity's Achievement history) on its own schedule. Modeling Submission as a child entity of Assessment, the way Discussion Thread models Comment (Discussion Thread Aggregate Design, Section 16), would force every grading action to contend for the same Assessment-level consistency boundary. Keeping them as separate Aggregate Roots, connected only by AssessmentId, avoids that contention and matches AGG-006 (Platform Aggregate Catalogue, Section 2) — aggregates should be small enough to support transactional consistency while remaining cohesive.

**Summary — status of previously identified gaps.** At the time other documents in this corpus began citing this section, six Aggregate Roots from the Platform Aggregate Catalogue remained without dedicated Aggregate Design documentation: **Identity, Workspace, Membership, Certificate, Discussion Thread, and AI Collaboration Session**. Each of those documents, once written, described itself as closing "one more gap identified in Assessment & Submission Aggregate Design, Section 17" — this section is that original reference point, supplied retroactively. All six now have complete, structurally consistent Aggregate Design documents elsewhere in this corpus. AI Collaboration Session Aggregate Design, Section 17, went further and stated that with its own publication, "every Aggregate Root listed in the Platform Aggregate Catalogue... now has a corresponding, structurally consistent Aggregate Design document" — a claim that was not yet true, because this document, the one it was itself built on top of, did not exist. It is true now.

---

# 18. Future Evolution

- Competency-Based Learning: Grades expressed as mastery levels rather than only scores (Assessment Context, Section 11).
- Standards Alignment: Assessments mapped to external frameworks (Cambridge, CEFR, professional standards).
- Portfolio Assessment: Submissions composed of accumulated evidence rather than a single response (Assessment Context, Section 11).
- Adaptive Assessment: AI adjusting Question difficulty within an in-progress Submission based on prior Answers (Assessment Context, Section 10).

---

# 19. Aggregate References

Both Aggregates reference other aggregates only by identifier:

Assessment

- LessonId

Submission

- AssessmentId
- Submitter MembershipId

---

# Summary

The Assessment Aggregate is the authoritative owner of what it takes to demonstrate an achievement; the Submission Aggregate is the authoritative owner of whether one specific learner did. Neither owns Enrollment's product-level completion determination or Certificate's issuance and presentation — both are referenced by identifier only. This document supplies the aggregate-level specification that the rest of the corpus has cited as settled since before it was written, and closes the loop opened in Section 17: all six Aggregate Roots that depended on this document's existence now have one to depend on.
