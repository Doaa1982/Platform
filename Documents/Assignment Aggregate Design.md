# Assignment Aggregate Design

> Version: 1.1
>
> Status: Draft / Proposed
>
> Domain: Learning Delivery (Assignment Sub-Context)
>
> Related Documents:
>
> - Platform Aggregate Catalogue
> - Assignment Business Analysis
> - Learning Activity Assignment Business Analysis
> - Lesson Revision Aggregate Design
> - Assessment and Submission Aggregate Design
> - Enrollment Aggregate Design
> - Curriculum Aggregate Design
> - PDF & Image Lesson Content Extraction — Design Proposal
>
> **Revision Note (v1.1):** §8 and §15 originally stated, without qualification, that "a Submission references its Assignment by identifier only (`AssignmentId`)." That was imprecise — Assessment and Submission Aggregate Design v1.0 already defined Submission as referencing an Assessment (`AssessmentId`), which is still true and still the more common case (every quiz Submission today). Assessment and Submission Aggregate Design v1.1 resolves this by generalizing Submission to reference exactly one of Assessment or Assignment, never both — this document's §8 and §15 are corrected below to match, rather than left describing the Assignment-only version of a relationship that was never exclusively Assignment's.

---

# 1. Overview

The **Assignment Business Analysis** and **Learning Activity Assignment Business Analysis** documents (both at Version 1.3) fully specify the business concept, configuration surface, lifecycle, and business rules of Assignment. Both documents are mature: each has already gone through multiple revision cycles resolving open questions into numbered Business Decisions, and each explicitly states that Submission — though discussed extensively in both — is owned by the Assessment Context, not Learning Delivery, and is formalized separately in the **Assessment and Submission Aggregate Design**.

What neither document does is complete the step every other bounded context in this corpus has already completed: register Assignment as an Aggregate Root in the **Platform Aggregate Catalogue**, and formalize its root, structure, entities, value objects, invariants, and state machine in a dedicated Aggregate Design document, using the same template applied elsewhere (Overview, Vision, Responsibilities, Aggregate Root, Aggregate Structure, Entities, Value Objects, Aggregate Relationships, Business Invariants, State Machine, Commands, Domain Events, Architectural Rationale, Future Evolution, Aggregate References).

This document closes that gap. It does not re-derive or re-litigate anything already settled at the Business Analysis level — it formalizes what the two existing BA documents already agreed, at the level of precision an Aggregate Design requires. Every invariant, entity, and value object below is traceable to a specific passage or Business Decision in one of the two BA documents; where this document makes a structural choice the BA documents left implicit (for example, whether per-learner status is stored state or a computed view), that choice is called out explicitly as an Aggregate Design decision rather than presented as if the BA documents had already said it.

---

# 2. Vision

Assignment answers a narrower question than either Learning Activity or Submission: **given a Learning Activity that already exists, who gets it, when, under what rules, and how is it evaluated?**

- **Learning Activity** (owned by Lesson Revision) answers "what is the work" — it is instructional design, authored once as part of a lesson.
- **Assignment** answers "how is this work delivered" — targeting, timing, policy. It is a delivery and scheduling concern, not a content concern.
- **Submission** (owned by Assessment Context) answers "did this specific learner do the work, and how well" — the per-learner record of response and evaluation.

This mirrors the reconciliation already made in the Assessment and Submission Aggregate Design (§2), which distinguishes "what does it take" (Assessment) from "did this learner demonstrate it" (Submission). Assignment sits one layer upstream of that pair: it does not evaluate anything itself, and — per both BA documents' Version 1.3 revision notes — it does not own Submissions. It owns only the decision of *when and to whom* a Learning Activity is made available, and *under what policy* a Submission against it will later be evaluated.

---

# 3. Responsibilities

**Assignment is responsible for:**

- Referencing exactly one Learning Activity (Assignment Business Analysis, BA-002, BA-004 of Learning Activity BA).
- Targeting: determining which learners receive the Assignment, sourced from the Learning Product's active Enrollments (BA-010).
- Publication and scheduling: Draft, Scheduled, Published, Active, Closed, Archived states.
- Availability policy: immediate, scheduled, or hidden.
- Due date policy: none, fixed, or relative-to-availability.
- Submission window: start and end.
- Attempt policy: single, multiple (with a limit), or unlimited.
- Submission policy: individual (group submission is out of scope for V1).
- Evaluation method selection: automatic, manual, AI-assisted, or hybrid — a policy choice, not the evaluation itself.
- Visibility and notification configuration (publish, reminder, due-soon, overdue, feedback-published).
- Editing of its own operational fields after publication (due date extension, attempt limit changes) without creating a new version (BA-009).

**Assignment is explicitly not responsible for:**

- Instructional content, questions, lesson structure, AI-generated content, or learning assets (Assignment BA, Business Concept section) — these belong to Learning Activity / Lesson Revision.
- Storing or evaluating learner responses — these belong to Submission, owned by Assessment Context (both BA documents, v1.3 revision notes).
- Determining Enrollment eligibility — Enrollment is the single source of truth (BA-010); Assignment only reads from it.
- Progress computation — progress contribution flows through Curriculum rules, not Assignment itself (Assignment BA, Progress Contribution section).

---

# 4. Aggregate Root

**Assignment** is the Aggregate Root.

It is a separate Aggregate Root from Learning Activity (owned by Lesson Revision) for the same reason Lesson is separated from Lesson Revision, and Assessment from Submission, elsewhere in this corpus:

- **Different change rate.** A Learning Activity is authored once, as part of lesson design, and changes only when the lesson content changes (Learning Activity BA-002, BA-003: authored during lesson design only, published together with the Lesson Revision, no independent lifecycle). An Assignment is configured, scheduled, extended, and closed repeatedly, on its own schedule, independent of any lesson edit.
- **Independent lifecycle.** Assignment has its own six-state lifecycle (Draft → Scheduled → Published → Active → Closed → Archived) that has nothing to do with Lesson Revision's own Draft → Editing → Ready for Review → Approved → Published lifecycle.
- **Avoiding lock contention.** A tutor extending a due date or resetting an attempt count should not contend with, or require re-versioning, the Lesson Revision the underlying Learning Activity belongs to.

It is also a separate root from Submission, consistent with both BA documents having already settled that Submission is owned by Assessment Context. Assignment does not contain its Submissions; a Submission references its Assignment by identifier only (`AssignmentId`), the same pattern Assessment and Submission Aggregate Design (§9) already applies between Assessment and Submission.

---

# 5. Aggregate Structure

The Assignment Aggregate is deliberately thin. It has no owned entities (see §6) — it is a single root carrying a set of configuration value objects and a lifecycle status. Its structure groups into:

- **Identity & Reference** — the Assignment's own Id, the Learning Activity it delivers, the Learning Product it belongs to (for Enrollment-sourced targeting), and the Membership that created it.
- **Scheduling** — Availability Policy, Due Date Policy, Submission Window.
- **Policy** — Attempt Policy, Submission Policy, Evaluation Policy.
- **Visibility & Notifications** — Visibility flag, Notification Settings.
- **Lifecycle State** — the current status in the Draft → Scheduled → Published → Active → Closed → Archived state machine, plus the timestamps that mark each transition.

---

# 6. Entities

Assignment owns **no child entities**.

This is a deliberate structural finding, not an omission, and it is worth stating explicitly since it departs from the pattern in Assessment (which owns Question and Rubric Criterion entities) and Submission (which owns Answer and Evaluation entities):

- Recipients are not stored as an owned collection inside Assignment. Per BA-010, they are resolved at read time from Enrollment, which is the single source of truth for eligibility. Storing a redundant recipient list inside Assignment would create a second source of truth that Enrollment changes (a learner enrolling or being removed) would have to keep in sync.
- Per-learner attempt usage is not stored inside Assignment. Assignment stores only the *policy* — the attempt limit — while the count of attempts actually used by a given learner lives in that learner's Submission (Submission Metadata already carries an Attempt Number field per Assessment and Submission Aggregate Design, §8). BA-011's "tutors may reset attempt counts anytime" is therefore a command that originates on Assignment (as the policy owner) but takes effect on the learner's Submission via a domain event (see §12).
- Differentiated due dates per recipient do not exist in V1. BA-007 is explicit that V1 has one due date applied to all targeted learners, with the differentiated case deferred to a future release that would relax the current 1:1 cardinality assumption. If that ships, it would introduce the first owned entity on this Aggregate (a per-recipient override), tracked here in §14 Future Evolution rather than modeled now.

Because Assignment has no owned entities, none of AGG-002's "invariants enforced inside the Aggregate" concern cross-entity consistency — they concern only the internal consistency of the root's own value objects and status.

---

# 7. Value Objects

**Availability Policy** — Mode (Immediate / Scheduled / Hidden), Scheduled Availability DateTime (when Mode = Scheduled).

**Due Date Policy** — Mode (None / Fixed / Relative), Fixed Due DateTime (when Mode = Fixed), Relative Offset (when Mode = Relative, expressed relative to Availability).

**Submission Window** — Start DateTime (optional), End DateTime (optional).

**Attempt Policy** — Mode (Single / Multiple / Unlimited), Max Attempts (when Mode = Multiple).

**Submission Policy** — Mode (Individual). Group submission is named in the BA as a future extension and is not modeled as an active mode in V1.

**Evaluation Policy** — Method (Automatic / Manual / AI-Assisted / Hybrid).

**Notification Settings** — flags for Publish, Reminder, Due-Soon, Overdue, and Feedback-Published notifications (Assignment BA, Notifications section).

None of these value objects are shared with, or referenced by, any other Aggregate — they are private configuration owned entirely by Assignment, consistent with AGG-004.

---

# 8. Aggregate Relationships

```text
Lesson Revision
      │  owns
      ▼
Learning Activity  (entity, owned by Lesson Revision)
      │  referenced by LearningActivityId
      ▼
Assignment
      │  referenced by AssignmentId — one of Submission's two possible Targets (v1.1)
      ▼
Submission  (owned by Assessment Context; Target is Assessment OR Assignment, never both —
             see Assessment and Submission Aggregate Design v1.1, §9, §12 INV-001)
      │  references Submitter MembershipId
      ▼
Membership

Enrollment
      │  read by Assignment at recipient-resolution time
      ▼
Assignment  (does not own or copy Enrollment data)
```

Assignment sits between Lesson Revision's Learning Activity and Submission, but does not itself belong to either chain structurally — it references Learning Activity by identifier only, per AGG-003, and is in turn referenced by Submission the same way. This is the same referencing discipline the Aggregate Catalogue already documents for every other cross-aggregate relationship (§7 of that Catalogue). **Corrected in v1.1:** the diagram previously showed Submission as though it referenced only Assignment; Assessment and Submission Aggregate Design v1.0 already had Submission referencing Assessment, and remains the more common path (every quiz Submission today). Submission references exactly one of the two — see the revision note above.

Assignment also relates to **Curriculum**: progress contribution flows through Curriculum's own rules, not through Assignment directly (Assignment BA, Progress Contribution section) — Assignment does not compute or store progress, it only emits the completion event Curriculum listens for.

---

# 9. Business Invariants

**INV-001.** Every Assignment references exactly one Learning Activity, and cannot be created without one (Assignment BA-002; Learning Activity BA-004).

**INV-002.** In V1, the relationship between Learning Activity and Assignment is 1:1 — a Learning Activity may have at most one Assignment (Learning Activity BA-007). This resolves what both BA documents' revision notes describe as a prior cross-document contradiction.

**INV-003.** An Assignment cannot transition out of Draft into Scheduled or Published without an Availability Policy and an Evaluation Policy configured. (Structural formalization of the "Configure → Save Draft → Publish" workflow step ordering in Assignment BA's Assignment Workflow.)

**INV-004.** Recipients are never stored on the Assignment itself; they are resolved from the Learning Product's active Enrollments at the point of need (Assignment BA-010).

**INV-005.** A published Assignment's operational fields (due date, attempt limit, availability, notifications) may be edited without creating a new version of the Assignment — unlike Lesson Revision, history is preserved through domain events, not aggregate versioning (Assignment BA-009).

**INV-006.** Attempt limits may be increased freely but may not be decreased below the number of attempts a learner has already used (Assignment BA-011). Because per-learner attempt usage is tracked on Submission, not Assignment, enforcing this invariant requires Assignment to consult Submission state at the moment a limit decrease is requested — this is a cross-aggregate check, not a same-transaction invariant, and is enforced via application-service coordination rather than inside the Assignment Aggregate boundary alone.

**INV-007.** A Submission may not be entered against an Assignment that has not reached Published or Active status (formalization of the "Students Receive" step in Assignment BA's Assignment Workflow occurring only after Publish).

**INV-008.** AI Assistance may suggest or pre-fill Assignment configuration but may never transition an Assignment into Published status (Assignment BA-006; Learning Activity BA-006).

---

# 10. State Machine

```text
Draft
  │  publish (Availability = Scheduled, future date)
  ▼
Scheduled
  │  scheduled Availability date reached
  ▼
Draft
  │  publish (Availability = Immediate)
  ▼
Published
  │  submission window opens
  ▼
Active
  │  due date / submission window end reached
  ▼
Closed
  │  tutor archives (or automatic retention policy)
  ▼
Archived
```

Notes:

- Draft transitions directly to Published when Availability = Immediate, skipping Scheduled entirely; it transitions to Scheduled first only when Availability = Scheduled with a future date.
- Published and Active are kept distinct because "visible to targeted learners" (Published) and "currently accepting submissions" (Active) are not always the same moment — a Submission Window with a future Start DateTime can leave an Assignment Published-but-not-yet-Active.
- Closed does not permanently block submissions: BA-008 establishes that a submitted attempt can be reopened via "Return-for-Resubmission" rather than a separate concept, which is a Submission-side operation, not an Assignment state transition. An Assignment can remain Closed while an individual learner's Submission is reopened for resubmission.
- This tutor-facing lifecycle is distinct from, and drives, the student-facing status shown to each learner (Locked / Available / In Progress / Submitted / Under Review / Completed / Overdue, per Assignment BA's Assignment Status section). The student-facing status is **not separately stored state on the Assignment** — it is an Aggregate Design decision, not something either BA document specifies directly, that this status is computed per learner by combining the Assignment's own lifecycle status, its Due Date Policy, and that learner's Submission status (owned by Assessment Context). Storing it directly on Assignment would duplicate state that already exists, correctly owned, on Submission and would require Assignment to maintain one record per learner — the same anti-pattern §6 already rules out for attempt counts and recipients.

---

# 11. Commands

- `CreateAssignment` (LearningActivityId, LearningProductId, CreatorMembershipId)
- `ConfigureAssignment` (Availability Policy, Due Date Policy, Submission Window, Attempt Policy, Submission Policy, Evaluation Policy, Notification Settings)
- `PublishAssignment`
- `CloseAssignment`
- `ArchiveAssignment`
- `ExtendDueDate` (New Due DateTime) — must not move the due date earlier than the current one, consistent with BA-007's "due dates may be extended"
- `ChangeAttemptLimit` (New Max Attempts) — enforces INV-006
- `ResetAttemptCount` (Target MembershipId) — Assignment-initiated per BA-011, takes effect on the target learner's Submission
- `ChangeVisibility` (Visibility)
- `UpdateNotificationSettings` (Notification Settings)

---

# 12. Domain Events

- `AssignmentCreated`
- `AssignmentConfigured`
- `AssignmentScheduled`
- `AssignmentPublished`
- `AssignmentActivated`
- `AssignmentClosed`
- `AssignmentArchived`
- `AssignmentDueDateExtended` (already named in Assignment BA-009)
- `AssignmentAttemptLimitChanged` (already named in Assignment BA-009)
- `AssignmentAttemptCountReset` — consumed by the Submission aggregate to clear that learner's used-attempt count

Consumers, per Assignment BA's Integration table and Progress Contribution section:

- `AssignmentPublished` → Notification Context sends the publish announcement; Assessment Context prepares to accept Submissions against this Assignment.
- `AssignmentClosed` → Curriculum evaluates whether this contributes to progress completion for affected learners.
- `AssignmentAttemptLimitChanged` / `AssignmentAttemptCountReset` → Submission aggregate updates the affected learner's attempt bookkeeping.

---

# 13. Architectural Rationale

**Why Assignment is a new Aggregate Root, not an extension of an existing one.** The Aggregate Catalogue's own Future Evolution guidance (§10) cautions that "new functionality should extend existing Aggregates rather than creating additional ones" unless a distinct consistency boundary is established. Assignment meets that bar: it has an independent lifecycle (§10 above) that shares no state or transaction boundary with Learning Activity's authoring lifecycle or Submission's per-learner evaluation lifecycle. Folding Assignment into Learning Activity would force every scheduling operation (extend a due date, reset an attempt count) to load and lock the entire Lesson Revision the activity belongs to; folding it into Submission would require an Assignment to exist once per learner rather than once per delivery, contradicting BA-002 and BA-010.

**Why Assignment owns no entities.** Every candidate for an owned entity — recipients, per-learner attempt counts, per-learner status — already has a correctly-owning aggregate elsewhere (Enrollment, Submission, Submission again). Duplicating any of them inside Assignment would create a second source of truth with no mechanism to keep it consistent with the original, which both AGG-002 and the precedent set by Assessment and Submission Aggregate Design (§9: "Assessment does not contain its Submissions") argue against.

**Why this document exists now.** At the time this document was written, Assignment had complete, mature Business Analysis documentation — Assignment Business Analysis and Learning Activity Assignment Business Analysis, both at Version 1.3, with every open question resolved into numbered Business Decisions — but did not appear in the Platform Aggregate Catalogue and had no Aggregate Design document, unlike every other Aggregate Root the Catalogue lists. This mirrors the gap the Assessment and Submission Aggregate Design (§17) describes having existed, and closed, for Identity, Workspace, Membership, Certificate, Discussion Thread, and AI Collaboration Session. It is closed here for Assignment.

---

# 14. Future Evolution

- **Differentiated due dates per recipient.** Deferred by BA-007. Would relax the current model's assumption that Due Date Policy applies uniformly to all targeted learners, and would likely introduce the first owned entity on this Aggregate (a per-recipient override), rather than a change to the shared Due Date Policy value object.
- **Group submission policy.** Named in Assignment BA's Submission Policy configuration as a future mode; not active in V1.
- **Standalone Learning Activities / Activity Library / Activity reuse across lessons.** All explicitly out of scope for V1 per Learning Activity BA-005 and its Closing Summary table. If any of these ship, Assignment's `CreateAssignment` command would need to accept a Learning Activity that no longer belongs to exactly one Lesson Revision, which would revisit INV-001 and INV-002 above.
- **Parent actor.** Named as a future Business Actor in Learning Activity BA; would likely extend Notification Settings and read-access rules rather than change Assignment's structure.

---

# 15. Aggregate References

**Assignment references:**

- `LearningActivityId` (entity owned by Lesson Revision)
- `LearningProductId` (for Enrollment-sourced recipient resolution)
- `CreatorMembershipId`

**Referenced by:**

- `Submission.AssignmentId` — **one of Submission's two possible Targets (corrected in v1.1)**; a Submission references either `AssessmentId` or `AssignmentId`, never both (Assessment and Submission Aggregate Design v1.1, §12 INV-001). Submission is owned by Assessment Context regardless of which target it points to; see that document's §19 for the reciprocal reference and §17 for why this generalized rather than splitting into a second Aggregate.

The Aggregate itself is never embedded inside another Aggregate, consistent with AGG-003 and AGG-004.

---

# Summary

Assignment is a thin, independent Aggregate Root that governs delivery — targeting, scheduling, and policy — for exactly one Learning Activity at a time (1:1 in V1). It owns no child entities: recipients, attempt usage, and per-learner status all remain correctly owned by Enrollment and Submission respectively, and Assignment references them only by identifier, consistent with the referencing discipline already established across this corpus. Its six-state lifecycle (Draft → Scheduled → Published → Active → Closed → Archived) is independent of both Lesson Revision's authoring lifecycle and Submission's per-learner evaluation lifecycle, which is precisely the separation of concern that justifies giving it its own Aggregate Root rather than folding it into either.

Every invariant, value object, and structural decision in this document traces back to a specific passage or numbered Business Decision in Assignment Business Analysis or Learning Activity Assignment Business Analysis, both already at Version 1.3 before this document was written. What was missing was not business understanding — it was the formal Aggregate Design layer connecting that understanding to the Platform Aggregate Catalogue, which this document now provides.

**v1.1** corrects one detail this document got imprecise the first time: §8 and §15 originally described Submission as referencing Assignment exclusively. Assessment and Submission Aggregate Design v1.1 generalizes Submission to reference either Assessment or Assignment — this document now matches that, rather than the two quietly disagreeing about the same relationship from opposite ends. The first concrete Assignment-delivered Learning Activity to actually use this path — Homework, gating completion of a Reading-mode lesson — is scoped in PDF & Image Lesson Content Extraction — Design Proposal, §11, as a deliberately narrower v1 bridge rather than a full build-out of Assignment itself.
