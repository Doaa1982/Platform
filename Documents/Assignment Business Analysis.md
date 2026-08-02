# Assignment Business Analysis

> Version: 1.0
>
> Status: Draft
>
> Domain: Learning Delivery
>
> Document Type: Business Analysis
>
> Author: Business Analysis Team
>
> Related Documents:
>
> - Learning Activity Business Analysis
> - Learning Product Context
> - Curriculum Aggregate Design
> - Lesson Aggregate Design
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

---

## Availability Rules

- Learners cannot access unpublished Assignments.
- Scheduled Assignments become available automatically.
- Closing an Assignment prevents new submissions.

---

## Submission Rules

- Submission behavior is controlled by Assignment policy.
- Attempt limits are enforced by the Assignment.
- Submission deadlines belong to the Assignment.

---

## Evaluation Rules

- Evaluation policy belongs to the Assignment.
- Different Assignments may evaluate the same Learning Activity differently.

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
- Submission received
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
| Submission | Stores learner responses to the Assignment. |
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

# 16. Open Business Questions

The following decisions remain to be analyzed before domain design.

### Recipient Selection

- Can Assignments target individuals?
- Can Assignments target groups?
- Can Assignments target entire enrollments?

---

### Scheduling

- Can Assignments reopen automatically?
- Can due dates be extended after publication?
- Can learners receive different due dates?

---

### Attempts

- Can tutors reset learner attempts?
- Can attempt limits change after publication?

---

### Submission Policies

- Can submissions be edited after submission?
- Can tutors reopen closed submissions?

---

### Assignment Management

- Can published Assignments be edited?
- Should editing create a new Assignment version?
- Should Assignment history be retained?

---

# Summary

Assignments are responsible for delivering Learning Activities to learners.

They manage scheduling, learner targeting, availability, submission policies, evaluation policies, and lifecycle management while remaining independent from instructional content.

This separation enables a clean distinction between **educational design** (Lesson Revision and Learning Activity) and **learning delivery** (Assignment), providing a scalable foundation for future capabilities such as differentiated assignments, cohort-specific scheduling, and advanced progress tracking.