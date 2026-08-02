# Platform Aggregate Catalogue

> Version: 1.0
>
> Status: Draft
>
> Domain: Enterprise Domain Model
>
> Related Documents:
>
> - Bounded Context Map
> - Capability Model
> - Identity & Workspace Access
> - Learning Product Context
> - Learning Delivery Context
> - Assessment Context
> - AI Business Architecture

---

# 1. Purpose

The Platform Aggregate Catalogue defines the Aggregate Roots of the Learning Workspace Platform.

Each Aggregate represents a business consistency boundary and is owned by a single bounded context.

This document serves as the bridge between the Business Architecture and the implementation-oriented Domain Model.

---

# 2. Aggregate Design Principles

The platform follows these principles when identifying aggregates.

## AGG-001

Each Aggregate has exactly one Aggregate Root.

---

## AGG-002

Business invariants are enforced inside the Aggregate.

---

## AGG-003

Other Aggregates reference only the Aggregate Root identifier.

---

## AGG-004

Aggregates own their internal entities.

---

## AGG-005

Aggregates communicate through domain events rather than direct modification.

---

## AGG-006

Aggregates should be small enough to support transactional consistency while remaining cohesive.

---

# 3. Aggregate Catalogue

| Bounded Context | Aggregate Root | Purpose |
|-----------------|----------------|---------|
| Identity | Identity | Represents the global person identity used for authentication. |
| Workspace | Workspace | Represents an independent learning workspace. |
| Workspace Access | Membership | Represents a user's participation and permissions within a Workspace. |
| Learning Product | Learning Product | Represents a course, program, learning path, or other educational offering. |
| Learning Delivery | Lesson | Represents a deliverable learning experience. |
| Enrollment | Enrollment | Represents a learner's participation in a Learning Product. |
| Assessment | Assessment | Represents an assessable activity. |
| Assessment | Submission | Represents a learner's submitted work. |
| Certification | Certificate | Represents an awarded certificate. |
| Community | Discussion Thread | Represents a collaborative discussion. |
| AI | AI Collaboration Session | Represents an AI-assisted business session. |

---

# 4. Aggregate Overview

```text
Identity

Workspace

Membership

Learning Product

Lesson

Enrollment

Assessment

Submission

Certificate

Discussion Thread

AI Collaboration Session
```

Each Aggregate owns its internal consistency and lifecycle.

---

# 5. Aggregate Dependencies

```text
Identity
      │
      ▼
Membership
      │
      ▼
Workspace
      │
      ▼
Learning Product
      │
      ▼
Lesson
      │
      ▼
Assessment
      │
      ▼
Submission
      │
      ▼
Certificate

AI Collaboration Session

(references all of the above according to Business Context, but owns none of them)
```

---

# 6. Aggregate Ownership Rules

Every business object belongs to exactly one Aggregate.

Examples:

| Business Object | Owner Aggregate |
|-----------------|-----------------|
| Transcript | Lesson |
| Interactive Learning Event | Lesson |
| Lesson Chapter | Lesson |
| Learning Objective | Lesson |
| Assessment Question | Assessment |
| Learner Submission | Submission |
| Membership Role | Membership |
| Workspace Policy | Workspace |
| AI Recommendation | AI Collaboration Session |

Ownership determines where business rules are enforced.

---

# 7. Cross-Aggregate References

Aggregates reference one another only through identifiers.

Example:

Lesson

- LearningProductId

Assessment

- LessonId

Enrollment

- LearningProductId
- MembershipId

AI Collaboration Session

- MembershipId
- LessonId
- AssessmentId

The Aggregate itself is never embedded inside another Aggregate.

---

# 8. Aggregate Lifecycle Independence

Each Aggregate manages its own lifecycle.

Examples:

Lesson

Draft → Published → Archived

Assessment

Draft → Published → Closed

Enrollment

Invited → Active → Completed

AI Collaboration Session

Started → Active → Completed

Lifecycle transitions are independent even when Aggregates collaborate.

---

# 9. Aggregate Communication

Aggregates collaborate using Domain Events.

Example:

LessonPublished

↓

Assessment prepares availability

↓

Notification sends announcement

↓

Analytics updates metrics

↓

AI Collaboration Session refreshes context

No Aggregate modifies another Aggregate directly.

---

# 10. Future Evolution

New business domains should introduce new Aggregate Roots only when they establish a distinct consistency boundary.

Whenever possible, new functionality should extend existing Aggregates rather than creating additional ones.

The Aggregate Catalogue is expected to evolve as the platform expands while preserving clear ownership boundaries.