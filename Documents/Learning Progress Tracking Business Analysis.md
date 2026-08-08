# Learning Progress Tracking Business Analysis

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
> - Identity & Membership
> - Learning Product Aggregate
> - Curriculum Aggregate
> - Lesson Aggregate
> - Lesson Revision Aggregate
> - Learning Activity Business Analysis
> - Enrollment Business Analysis
> - Assignment Business Analysis
> - Submission & Evaluation Business Analysis (Future)
> - Certificate Business Analysis (Future)

---

# 1. Business Vision

Learning Progress Tracking enables learners, tutors, and the platform to understand a learner's current educational journey.

Rather than simply measuring completion percentages, the platform continuously interprets learner interactions and presents meaningful learning progress based on the educational rules defined by the Curriculum.

Learning Progress provides operational insight into where a learner currently is, what has already been accomplished, and what remains to achieve the intended learning outcomes.

---

# 2. Business Problem

Educational platforms frequently reduce progress to simple percentages based on completed lessons or viewed content.

Such approaches fail to represent the actual learning journey because:

- different learning activities have different educational value,
- not every lesson is mandatory,
- assessments may determine completion,
- tutors may manually approve work,
- curricula define different completion rules.

The platform therefore requires a dedicated capability that interprets learner activity according to educational rules rather than simple completion counts.

---

# 3. Business Objectives

The Learning Progress capability shall enable the platform to:

- Track learner advancement.
- Present current learning position.
- Monitor lesson completion.
- Monitor curriculum completion.
- Support assignment completion tracking.
- Support AI recommendations.
- Support tutor monitoring.
- Support certification eligibility.
- Support learner motivation.
- Support educational analytics.

---

# 4. Business Concept

## Learning Progress

Learning Progress represents the learner's current educational state within an active Enrollment.

It reflects the learner's advancement through instructional content according to Curriculum rules.

Learning Progress is not the educational content itself.

It is the operational interpretation of learner participation.

---

## Progress vs Completion

Progress and Completion represent different business concepts.

### Progress

Represents the learner's current position within the learning journey.

Examples:

- Current lesson
- Current activity
- Completed lessons
- Active assignments
- Current milestone

Progress is continuous.

---

### Completion

Represents satisfaction of educational requirements.

Examples:

- Lesson completed
- Curriculum completed
- Learning Product completed
- Certificate eligible

Completion is achieved only when defined business rules have been satisfied.

---

# 5. Scope of Progress Tracking

The platform may track progress for multiple educational levels.

## Learning Product Progress

Represents overall learner advancement within a Learning Product.

---

## Curriculum Progress

Represents advancement through a Curriculum.

---

## Curriculum Unit Progress

Represents advancement through a Curriculum Unit.

---

## Lesson Progress

Represents advancement within an individual Lesson.

---

## Learning Activity Progress

Represents completion of activities contained within a Lesson Revision.

---

## Assignment Progress

Represents learner completion of assigned educational work.

---

# 6. Progress Sources

Learning Progress is derived from operational learning events.

Examples include:

- Enrollment activated
- Lesson opened
- Lesson completed
- Activity started
- Activity completed
- Assignment published
- Assignment started
- Submission created
- Submission evaluated
- Manual tutor approval

Progress does not invent information.

It interprets operational events.

---

# 7. Progress States

Learning Progress may exist in one of the following business states.

```text
Not Started

↓

Started

↓

In Progress

↓

Completed
```

Additional business states may include:

- Paused
- Blocked
- Behind Schedule
- Archived

---

# 8. Progress Rules

Progress calculations follow educational rules defined by the Curriculum.

Examples include:

- Required lessons only
- Optional lessons excluded
- Required assignments
- Minimum assessment score
- Tutor approval required
- Mandatory activity completion
- Sequential lesson unlock (a lesson requires the one immediately before it, in curriculum order, to be Completed — see BA-007)

Progress Tracking does not define these rules.

It evaluates them.

---

# 9. Completion Rules

Completion rules belong to educational design rather than operational tracking.

Examples:

## Lesson Completion

May require:

- Lesson viewed
- Required activities completed
- Required assessment passed

---

## Curriculum Completion

May require:

- All mandatory lessons completed
- Required assignments submitted
- Minimum overall score achieved

---

## Learning Product Completion

May require:

- Curriculum completed
- Certificate requirements satisfied

---

# 10. Progress Ownership

Learning Progress belongs to an Enrollment.

Progress does not belong directly to:

- Identity
- Membership
- Curriculum
- Lesson

Progress represents the current educational state of a learner participating in a specific Learning Product.

```
Membership
      │
      ▼
Enrollment
      │
      ▼
Learning Progress
```

---

# 11. Progress Consumers

Learning Progress is consumed by multiple platform capabilities.

## Learner Dashboard

Displays:

- Current lesson
- Overall progress
- Remaining work
- Learning milestones

---

## Tutor Dashboard

Displays:

- Learner progress
- Completion status
- At-risk learners
- Activity summaries

---

## AI Assistant

Uses progress to:

- Recommend next lessons
- Recommend revision
- Generate personalized learning paths
- Explain weak areas

---

## Certificate Domain

Determines eligibility.

---

## Analytics Domain

Produces reports and insights.

---

## Notification Domain

Triggers reminders and completion notifications.

---

# 12. Business Rules

## PR-001

Learning Progress belongs to exactly one active Enrollment.

---

## PR-002

Progress calculations follow Curriculum rules.

---

## PR-003

Completion percentages are representations rather than business concepts.

---

## PR-004

Learning Progress never modifies Curriculum structure.

---

## PR-005

Operational learning events update Learning Progress.

---

## PR-006

Manual tutor overrides shall be recorded separately from calculated progress.

---

## PR-007

Completion does not necessarily imply mastery.

---

## PR-008

Mastery evaluation belongs to future Competency capabilities.

---

## PR-009

**Added 2026-08-08.** Learning Progress must record which Lesson Revision it reflects wherever that progress depends on revision-specific content (e.g. a video-watched flag). A completion signal recorded against one revision must not be silently treated as satisfied against a different, later revision — otherwise a tutor's Major-classified edit (Learning Publication & Version Management §20) can retroactively and incorrectly credit a learner for content they never consumed.

---

# 13. Relationship with Other Domains

| Domain | Relationship |
|----------|--------------|
| Enrollment | Owns Learning Progress |
| Curriculum | Defines completion rules |
| Lesson Revision | Defines instructional design |
| Learning Activity | Produces completion events |
| Assignment | Produces participation events |
| Submission | Produces learner evidence |
| Evaluation | Produces educational outcomes |
| Certificate | Consumes completion status |
| AI Tutor | Consumes progress insights |
| Analytics | Consumes aggregated progress |

---

# 14. Future Evolution

Future platform versions may introduce:

- Competency Progress
- Skill Progress
- Adaptive Learning Paths
- AI Learning Recommendations
- Learning Streaks
- Gamification
- Badges
- XP
- Predictive Learning Analytics

These capabilities extend Learning Progress without changing its core business responsibility.

---

# 15. Business Decisions

## BA-001

Learning Progress belongs to Enrollment.

---

## BA-002

Curriculum owns educational completion rules.

---

## BA-003

Learning Progress interprets operational learning events.

---

## BA-004

Progress Tracking does not own educational content.

---

## BA-005

Completion and Progress are different business concepts.

---

## BA-006

Progress Tracking serves learners, tutors, AI, analytics, and certification simultaneously.

---

## BA-007

**2026-08-08** — Sequential unlock is a Curriculum-level policy switch
(`RequiresSequentialCompletion`, off by default — see Curriculum Aggregate
Design §18), not a Learning Progress state of its own. Learning Delivery
enforces it at the moment a Learner tries to open, watch, or submit a
lesson: a locked lesson is refused outright (Forbidden) rather than
recorded as any kind of Progress — consistent with BA-003, since a refused
attempt is not an operational event to interpret. A locked lesson therefore
has no Learning Progress record at all until it unlocks.

---

## BA-008

**2026-08-08** — When a Lesson Revision changes via a Major-classified edit
(e.g. video replacement), a learner who is Started or In Progress on that
lesson stays on their starting revision until Completed; a Not Started
learner moves to the new revision immediately; a Completed learner's
progress is never re-evaluated (see Learning Publication & Version
Management §20, Rules 16–18). Enforcing this requires Learning Progress to
record which Lesson Revision it was recorded against (PR-009) — the current
`LessonProgress` model (Learning Delivery) references only `LessonId`, with
no revision reference, so a learner's video-watched state cannot yet be
tied to which video it reflects. This is a blocking gap for Rule 16, not a
future enhancement: without it, a tutor replacing a video and publishing
will silently carry forward "watched" for learners who watched the old one.

---

# 16. Open Business Questions

The following decisions remain under analysis.

## Progress Visibility

- Should learners always see percentages?
- Should tutors configure visibility?

---

## Manual Completion

- Can tutors manually complete lessons?
- Can manual completion override calculated progress?

---

## Recalculation

- What happens when a Curriculum changes?
- Should historical enrollments recalculate automatically?

---

## Lesson Revision

- Which Lesson Revision determines learner progress?
- How should progress behave when a learner changes to a newer Lesson Revision?

**Resolved 2026-08-06, amended 2026-08-08** — see Learning Publication & Version Management §19 (Rules 11–15) and §20 (Rules 16–18). A Lesson's current published revision determines progress for any learner who has not yet started the lesson; a tutor preparing a replacement (e.g. a new video) works in a Draft that does not affect any learner until it is published, so nothing changes out from under a learner who hasn't reached the lesson yet.

The original "no per-learner pinning" statement applies only to Patch and Minor changes. For a Major change (a replaced video), a learner already Started or In Progress on the lesson stays pinned to the revision they started on until they complete it — otherwise the tutor's video swap would silently and incorrectly count as watched a video the learner never saw. See BA-008 for the data-model gap this exposes.

---

## Optional Learning

- Should optional lessons affect progress?
- Should optional assignments affect completion?

---

## Cross-Curriculum Progress

- How should progress behave when a Learning Product contains multiple Curricula?

---

# Summary

Learning Progress is the operational capability responsible for interpreting learner participation throughout the educational journey.

It does not define educational rules or instructional content. Instead, it evaluates operational learning events according to Curriculum-defined completion rules, providing learners, tutors, AI services, analytics, and certification processes with a consistent and reliable view of educational advancement.

Learning Progress serves as the authoritative representation of a learner's current educational state within an active Enrollment.