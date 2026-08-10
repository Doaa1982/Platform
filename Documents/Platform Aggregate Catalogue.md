# Platform Aggregate Catalogue

> Version: 1.1
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
> - Learning Asset Aggregate Design
> - Curriculum Aggregate Design
> - Lesson Revision Aggregate Design
> - Enrollment Aggregate Design
> - AI Collaboration Session Aggregate Design
> - AI / AIAssistantArchitecture (execution-layer AIOperation model)
>
> **Revision Note (v1.2):** Section 3's AI Collaboration Session row and Section 6's AI Recommendation row now point to `AI_Collaboration_Session_Aggregate_Design.md`, which formalizes this Aggregate's root, entities, and invariants and was previously not cross-referenced from this Catalogue. `Documents/AI /AIAssistantArchitecture.md` §96 reconciles this Aggregate against that document's `AIOperation` execution model — the two are related by granularity (Session groups correlated Operations), not in conflict.
>
> **Revision Note (v1.1):** This Catalogue previously omitted three Aggregate Roots that already had full, standalone Aggregate Design documents elsewhere in the corpus: **Learning Asset**, **Curriculum**, and **Lesson Revision**. All three have been added to Sections 3, 4, 5, 7, and 8 below. The Aggregate Dependencies diagram (Section 5) was also missing Enrollment entirely despite it already appearing in Section 3 — this has been corrected. Section 6's Ownership Rules table has been clarified regarding Transcript ownership, which spans two aggregates with different responsibilities (see the note under that section).

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
| Learning Product | Curriculum | Represents the pedagogical structure (units, sequencing, progression rules) of a Learning Product. Separate from Learning Product itself per Curriculum Aggregate Design. |
| Enrollment | Enrollment | Represents a learner's participation in a Learning Product. |
| Learning Asset Management | Learning Asset | Represents a reusable educational resource (video, PDF, audio, etc.) referenced by one or more Lesson Revisions. Owns the underlying file, technical metadata, and AI enrichment. |
| Learning Delivery | Lesson | Represents a deliverable learning experience; owns business identity and publication lifecycle. |
| Learning Delivery | Lesson Revision | Represents the instructional content of a Lesson at a specific point in time (sections, transcript, objectives, interactive events). Separate Aggregate Root from Lesson per Lesson Revision Aggregate Design. |
| Assessment | Assessment | Represents an assessable activity. |
| Assessment | Submission | Represents a learner's submitted work. |
| Certification | Certificate | Represents an awarded certificate. |
| Community | Discussion Thread | Represents a collaborative discussion. |
| AI | AI Collaboration Session | Represents an AI-assisted business session. Full aggregate design in AI Collaboration Session Aggregate Design; execution-layer detail in AI / AIAssistantArchitecture, §96. |

---

# 4. Aggregate Overview

```text
Identity

Workspace

Membership

Learning Product

Curriculum

Enrollment

Learning Asset

Lesson

Lesson Revision

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
Curriculum
      │
      ▼
Lesson
      │
      ▼
Lesson Revision
      │
      ▼
Assessment
      │
      ▼
Submission
      │
      ▼
Certificate

Enrollment

(depends on Membership + Learning Product; gates access to Lesson —
 see Enrollment Aggregate Design, Section 12, for the full relationship)

Learning Asset

(depends only on Workspace; referenced by Lesson Revision but does not
 depend on the Learning Product / Curriculum / Lesson chain above —
 see Learning Asset Aggregate Design)

AI Collaboration Session

(references all of the above according to Business Context, but owns none of them)
```

Note: This diagram shows the primary structural dependency chain. Enrollment and Learning Asset are shown separately because their dependencies branch off the main chain rather than extending it linearly — Enrollment depends on Membership and Learning Product but is not itself part of the Curriculum → Lesson → Assessment sequence, and Learning Asset is Workspace-scoped and reusable across many Lessons rather than owned by any single one.

---

# 6. Aggregate Ownership Rules

Every business object belongs to exactly one Aggregate.

Examples:

| Business Object | Owner Aggregate |
|-----------------|-----------------|
| Interactive Learning Event | Lesson Revision |
| Lesson Chapter | Lesson Revision |
| Learning Objective | Lesson Revision |
| Lesson Section | Lesson Revision |
| Publication State | Lesson |
| Current Published Revision Reference | Lesson |
| Assessment Question | Assessment |
| Learner Submission | Submission |
| Membership Role | Membership |
| Workspace Policy | Workspace |
| AI Recommendation | AI Collaboration Session (see AI Collaboration Session Aggregate Design, §7) |
| Curriculum Unit | Curriculum |
| Asset File / Technical Metadata | Learning Asset |

Ownership determines where business rules are enforced.

**Note on Transcript ownership:** Transcript appears as an owned object in two places for two different reasons, and this is intentional rather than a conflict. **Learning Asset** owns the raw, AI-generated transcript of the underlying media file (technical enrichment — see Learning Asset Aggregate Design, AI Metadata). **Lesson Revision** separately owns a transcript value object representing the curated, potentially teacher-edited transcript as it is presented within that specific lesson (see Lesson Revision Aggregate Design, Section 8). A Lesson Revision's transcript is typically initialized from its referenced Learning Asset's transcript but becomes independently editable instructional content from that point forward — editing it does not modify the underlying asset.

---

# 7. Cross-Aggregate References

Aggregates reference one another only through identifiers.

Example:

Lesson

- LearningProductId

Lesson Revision

- LessonId
- LearningAssetIds
- AI Collaboration Session (optional)
- Author MembershipId

Curriculum

- LearningProductId
- LessonId (through Curriculum Lesson)

Learning Asset

- WorkspaceId
- MembershipId (Owner)

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

Lesson Revision

Draft → Editing → Ready for Review → Approved → Published

Curriculum

Draft → Under Review → Published → Archived

Learning Asset

Uploaded → Processing → Ready → Archived

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