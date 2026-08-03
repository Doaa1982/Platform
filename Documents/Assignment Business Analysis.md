# Assignment Business Analysis

> Version: 1.3
>
> Status: Draft
>
> Domain: Learning Delivery
>
> Document Type: Business Analysis
>
> Author: Business Analysis Team
>
> Revision Note (v1.1): This document's Section 10 rule ("In Version 1, each Learning Activity creates one Assignment") is now the confirmed, platform-wide 1:1 cardinality rule. Learning Activity Assignment Business Analysis previously stated the opposite; it has been corrected to match (see its BA-007). Also see Assessment_Context.md v1.1, where the unrelated "Assignment" Assessment Type was renamed "Graded Task" to remove a naming collision with the Assignment concept defined in this document.
>
> Revision Note (v1.2): Resolved all five open-question clusters from the former Section 16 (Recipient Selection, Scheduling, Attempts, Submission Policies, Assignment Management) and formalized them as new Business Decisions BA-007 through BA-011 in Section 15. Section 10's Business Rules were extended accordingly, including a new Recipient Rules subsection tying Assignment targeting explicitly to Enrollment. Section 16 has been retitled "Version 1 Resolutions" and now records the answers rather than the open questions. Section 12's Notifications list gained two events (due date extended, attempts reset) reflecting the newly resolved rules.
>
> Revision Note (v1.3): Clarified in Section 14's Integration table that Submission is owned by Assessment Context, not Assignment/Learning Delivery — closing a gap where Submission had been independently modeled in Assessment Context (as the thinner "Assessment Attempt") and in Learning Activity Assignment Business Analysis (with a full lifecycle), without either document stating who actually owns the aggregate. See Assessment Context v1.2.
>
> Related Documents:
>
> - Learning Activity Business Analysis
> - Learning Product Context
> - Curriculum Aggregate Design
> - Lesson Aggregate Design
> - Assessment Context
> - Enrollment Aggregate Design
> - Lesson Revision Aggregate Design
> - Enrollment Domain (Future)
> - Progress Tracking Domain (Future)
> - Notification Domain (Future)

---

# 1. Business Vision

An Assignment represents the delivery of a Learning Activity to one or more learners.

While a Learning Activity defines **what learners should do**, an Assignment defines:

- who should complete it,
- when it becomes available,
- when it is due,
- how it should be completed,
- how it will be evaluated,
- and how completion contributes to the learner's progress.

Assignments separate educational content from learner delivery, allowing tutors to manage learning experiences without modifying the instructional design.

---

# 2. Business Problem

Creating a Learning Activity alone does not make it available to learners.

The platform must support assigning activities under different conditions while preserving the original instructional content.

Examples include:

- Assigning immediately after publishing a lesson.
- Scheduling work for a future date.
- Assigning only to specific learners.
- Defining due dates.
- Allowing multiple attempts.
- Controlling late submissions.
- Configuring evaluation policies.

Without Assignments, learning activities cannot be delivered consistently.

---

# 3. Business Objectives

The Assignment capability shall enable tutors to:

- Deliver Learning Activities to learners.
- Schedule assignments.
- Define assignment availability.
- Configure submission policies.
- Configure evaluation policies.
- Track assignment completion.
- Monitor learner progress.
- Manage assignment lifecycle independently from lesson authoring.

---

# 4. Business Concept

## Assignment

An Assignment is the instructional delivery of a Learning Activity.

It represents the agreement between the educator and learner regarding:

- what must be completed,
- by whom,
- within what timeframe,
- under which submission rules,
- and according to which evaluation policy.

Assignments never contain instructional content.

They reference Learning Activities.

---

# 5. Assignment Responsibilities

The Assignment is responsible for:

- learner targeting
- publication
- scheduling
- availability
- due dates
- submission rules
- attempt policy
- evaluation policy
- assignment status
- completion tracking

The Assignment is **not** responsible for:

- instructional content
- questions
- lesson structure
- AI-generated educational material
- learning assets

---

# 6. Business Actors

## Tutor

Creates Assignments.

Publishes Assignments.

Schedules Assignments.

Reviews learner progress.

Manages deadlines.

Reviews submissions.

---

## Student

Receives Assignments.

Views assignment details.

Completes assigned work.

Submits responses.

Reviews feedback.

---

## AI Assistant

May assist tutors by:

- suggesting due dates,
- estimating workload,
- recommending submission policies,
- recommending evaluation strategies.

AI never publishes Assignments automatically.

---

## Workspace Administrator

Defines workspace-level assignment policies.

---

# 7. Assignment Workflow

```text
Lesson Revision

↓

Learning Activity

↓

Create Assignment

↓

Configure Assignment

↓

Save Draft

↓

Publish Assignment

↓

Students Receive Assignment

↓

Students Complete Assignment

↓

Submission

↓

Evaluation

↓

Assignment Completed
```

---

# 8. Assignment Configuration

Every Assignment may define:

## Availability

- Publish immediately
- Scheduled publication
- Hidden until release

---

## Due Date

- No due date
- Fixed date
- Relative date (Future)

---

## Submission Window

- Start date
- End date

---

## Attempts

- Single attempt
- Multiple attempts
- Unlimited attempts

---

## Submission Policy

- Individual
- Group (Future)

---

## Evaluation Method

- Automatic
- Manual
- AI Assisted
- Hybrid

---

## Visibility

- Visible immediately
- Hidden until published

---

## Notifications

- Publish notification
- Reminder
- Due soon
- Overdue
- Feedback published

---

# 9. Assignment Lifecycle

```text
Draft

↓

Scheduled

↓

Published

↓

Active

↓

Closed

↓

Archived
```

---

# 10. Business Rules

## Assignment Rules

- Every Assignment references exactly one Learning Activity.
- A Learning Activity may have multiple Assignments in future versions.
- In Version 1, each Learning Activity creates one Assignment.
- Assignments cannot exist without a Learning Activity.
- Published Assignments may be edited (due date, attempt limit, visibility, target recipients). Editing an Assignment never creates a new Assignment version — see BA-009.
- The Learning Activity referenced by a published Assignment cannot be changed; changing instructional content requires a new Lesson Revision per BA-001.

---

## Availability Rules

- Learners cannot access unpublished Assignments.
- Scheduled Assignments become available automatically.
- Closing an Assignment prevents new submissions.
- Due dates may be extended after publication. Due date changes apply uniformly to all targeted learners in Version 1 — see BA-007.
- Assignments do not reopen automatically after closing.

---

## Submission Rules

- Submission behavior is controlled by Assignment policy.
- Attempt limits are enforced by the Assignment.
- Submission deadlines belong to the Assignment.
- Tutors may reset a learner's attempt count.
- Attempt limits may be increased after publication at any time. Attempt limits may not be decreased below the number of attempts a learner has already used.
- A Submitted attempt cannot be freely edited by the learner. Reopening a closed Submission uses the existing Return-for-Resubmission mechanism (see Learning Activity Assignment Business Analysis, Submission Lifecycle) rather than a separate reopening concept — see BA-008.

---

## Evaluation Rules

- Evaluation policy belongs to the Assignment.
- Different Assignments may evaluate the same Learning Activity differently.

---

## Recipient Rules

- An Assignment targets a set of learners drawn from the Learning Product's active Enrollments — see Enrollment Aggregate Design.
- The default target is every Membership with an active Enrollment in the Learning Product containing the Assignment's Learning Activity.
- Targeting a subset of enrolled learners (individuals or a defined group) is supported in Version 1.
- Targeting learners without an active Enrollment is not supported; Enrollment determines eligibility per BA-010.
- Collaborative group submission (a single shared Submission for a targeted group) remains Future scope and is distinct from group targeting, which is Version 1.

---

# 11. Assignment Status

For Tutors

- Draft
- Scheduled
- Published
- Active
- Closed
- Archived

For Students

- Locked
- Available
- In Progress
- Submitted
- Under Review
- Completed
- Overdue

---

# 12. Notifications

Typical Assignment events include:

- Assignment published
- Assignment reminder
- Assignment due soon
- Assignment overdue
- Assignment due date extended
- Assignment attempts reset
- Submission received
- Submission returned for resubmission
- Feedback published
- Assignment closed

---

# 13. Progress Contribution

Assignment completion may contribute to:

- Lesson completion
- Curriculum progress
- Learning Product completion
- Competency achievement (Future)
- Certificate eligibility (Future)

The exact contribution is determined by Curriculum rules rather than the Assignment itself.

---

# 14. Integration with Other Domains

| Domain | Relationship |
|---------|--------------|
| Lesson Revision | Assignment references a Learning Activity created within a Lesson Revision. |
| Learning Activity | Defines the educational work delivered by the Assignment. |
| Submission | Stores learner responses to the Assignment. Owned by Assessment Context, not Assignment — see Assessment Context, Section 4.3. |
| Evaluation | Reviews learner submissions. |
| Enrollment | Determines eligible learners. |
| Progress Tracking | Consumes Assignment completion events. |
| Notifications | Publishes Assignment lifecycle events. |
| AI Collaboration | Assists tutors during Assignment configuration. |

---

# 15. Business Decisions

## BA-001

Assignments reference Learning Activities.

They never contain instructional content.

---

## BA-002

Assignments cannot exist without a Learning Activity.

---

## BA-003

Assignments manage learner delivery, not educational design.

---

## BA-004

Assignment policies are independent of Lesson authoring.

---

## BA-005

Assignment completion contributes to learner progress through Curriculum rules rather than Assignment rules.

---

## BA-006

AI assists tutors during Assignment configuration but does not publish Assignments automatically.

---

## BA-007

Due dates may be extended after publication.

In Version 1, an Assignment has a single due date applied uniformly to all targeted learners. Differentiated due dates per learner or cohort are deferred to the future release that relaxes the 1:1 Learning Activity → Assignment cardinality (see Learning Activity Assignment Business Analysis, BA-007).

Assignments do not reopen automatically after closing.

---

## BA-008

A Submitted attempt cannot be freely edited by the learner.

Reopening a closed Submission is not a separate concept — it uses the existing Return-for-Resubmission mechanism already defined in the Submission Lifecycle (see Learning Activity Assignment Business Analysis, Section 10).

---

## BA-009

Published Assignments may be edited. Editing an Assignment never creates a new Assignment version, unlike Lesson Revision.

This is intentional: Assignments never contain instructional content (BA-001), so their fields are operational parameters (due date, attempts, visibility, recipients) rather than content requiring rollback and version comparison. Historical changes are preserved through domain events (e.g., AssignmentDueDateExtended, AssignmentAttemptLimitChanged) rather than through aggregate versioning.

---

## BA-010

An Assignment's recipients are drawn from the Learning Product's active Enrollments. Enrollment is the single source of truth for who is eligible to receive an Assignment.

---

## BA-011

Tutors may reset a learner's attempt count at any time.

Attempt limits may be increased after publication without restriction. Attempt limits may not be decreased below the number of attempts a learner has already used, to avoid invalidating attempts already made.

---

# 16. Version 1 Resolutions (Formerly Open Business Questions)

The following questions were previously open. Each has now been resolved for Version 1 and formalized as a Business Decision in Section 15.

### Recipient Selection — Resolved (BA-010)

- Assignments target learners drawn from the Learning Product's active Enrollments.
- Individual and group targeting are supported in Version 1.
- Targeting "entire enrollments" is the default behavior when no subset is specified.

---

### Scheduling — Resolved (BA-007)

- Assignments do not reopen automatically after closing.
- Due dates may be extended after publication.
- Differentiated due dates per learner are deferred to a future release (tied to relaxing the 1:1 Learning Activity → Assignment cardinality).

---

### Attempts — Resolved (BA-011)

- Tutors may reset learner attempts.
- Attempt limits may be increased freely after publication; they may not be decreased below attempts already used.

---

### Submission Policies — Resolved (BA-008)

- Submitted attempts cannot be freely edited by the learner.
- Reopening a closed Submission reuses the existing Return-for-Resubmission mechanism rather than introducing a new concept.

---

### Assignment Management — Resolved (BA-009)

- Published Assignments may be edited (operational fields only, not the referenced Learning Activity).
- Editing does not create a new Assignment version — Assignments hold no instructional content requiring rollback.
- History is preserved through domain events, not aggregate versioning.

---

# Summary

Assignments are responsible for delivering Learning Activities to learners.

They manage scheduling, learner targeting, availability, submission policies, evaluation policies, and lifecycle management while remaining independent from instructional content.

This separation enables a clean distinction between **educational design** (Lesson Revision and Learning Activity) and **learning delivery** (Assignment), providing a scalable foundation for future capabilities such as differentiated assignments, cohort-specific scheduling, and advanced progress tracking.