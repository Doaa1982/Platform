# Lesson Aggregate Design

> Version: 1.0
>
> Status: Draft
>
> Domain: Learning Delivery
>
> Aggregate: Lesson
>
> Related Documents:
>
> - Learning Delivery Context
> - Learning Product Context
> - AI Authoring Assistant Architecture
> - AI Collaboration Architecture
> - Platform Aggregate Catalogue

---

# 1. Overview

The Lesson Aggregate represents the smallest publishable learning experience within a Learning Product.

A Lesson is not a video, document, or assessment. Instead, it represents a complete educational experience composed of learning assets, instructional structure, interactive activities, and educational metadata.

The Lesson Aggregate provides the stable business identity of a lesson while delegating evolving instructional content to Lesson Revisions.

---

# 2. Design Goals

The Lesson Aggregate is designed to:

- Represent a reusable learning experience.
- Maintain a stable business identity.
- Support AI-assisted authoring.
- Support multiple published revisions.
- Enable collaborative editing.
- Minimize aggregate size.
- Maintain transactional consistency.
- Support future publishing workflows.

---

# 3. Aggregate Responsibilities

The Lesson Aggregate is responsible for:

- Maintaining lesson identity.
- Managing publication lifecycle.
- Managing lesson ownership.
- Managing lesson metadata.
- Managing lesson policies.
- Coordinating lesson revisions.
- Publishing specific lesson revisions.

The Lesson Aggregate is **not** responsible for storing editable educational content.

---

# 4. Aggregate Root

```text
Lesson
```

The Lesson Aggregate Root represents the permanent identity of the lesson throughout its lifetime.

---

# 5. Aggregate Structure

```text
Lesson (Aggregate Root)

├── Lesson Metadata
├── Publication State
├── Current Published Revision
├── Author
├── Workspace
├── Learning Product
└── Revision References
```

---

# 6. Lesson Revision Separation

Educational content evolves continuously.

Instead of embedding all editable content inside the Lesson Aggregate, the platform introduces a separate aggregate:

```text
Lesson

↓

Lesson Revision
```

The Lesson represents the business identity.

Lesson Revision represents the instructional content at a specific point in time.

This separation enables:

- Version history
- Draft revisions
- AI-assisted editing
- Rollback
- Publishing workflows
- Collaborative editing

without increasing the complexity of the Lesson Aggregate.

---

# 7. Lesson Aggregate Responsibilities

The Lesson Aggregate owns:

- Lesson identity
- Publication state
- Current published revision
- Ownership
- Workspace association
- Learning Product association
- Publication policy

It does **not** own:

- Transcript
- Chapters
- Interactive Learning Events
- Learning Objectives
- Learning Assets
- AI generated educational content

Those belong to Lesson Revision.

---

# 8. Entities

The Lesson Aggregate contains the following entities.

## Publication

Represents the publication state of the lesson.

Responsibilities include:

- current published revision
- publication timestamps
- publication history
- scheduled publication (future)

---

## Revision Reference

Represents a reference to a Lesson Revision.

The Lesson Aggregate references revisions but does not own their internal instructional content.

---

# 9. Value Objects

## Lesson Metadata

Contains:

- Title
- Description
- Thumbnail
- Language
- Estimated Duration

---

## Publication Status

Possible values include:

- Draft
- Under Review
- Published
- Archived

---

## Lesson Settings

Contains configurable lesson behavior.

Examples:

- learner navigation
- completion policy
- visibility
- AI assistance settings

---

## Difficulty

Represents instructional difficulty.

---

## Tags

Collection of lesson tags.

---

# 10. Relationships

The Lesson Aggregate references:

- Learning Product
- Workspace
- Membership (Author)
- Current Lesson Revision

The Lesson Aggregate never owns these objects.

---

# 11. What Belongs to Lesson Revision

Lesson Revision owns the instructional content.

```text
Lesson Revision

├── Sections
├── Learning Asset References
├── Transcript
├── Learning Objectives
├── Interactive Learning Events
├── Generated Summary
├── Keywords
├── AI Generated Suggestions
└── Revision Metadata
```

Lesson Revision evolves independently while Lesson remains stable.

---

# 12. Aggregate Relationships

```text
Learning Product

↓

Lesson

↓

Lesson Revision

├── Sections

├── Learning Asset References

├── Transcript

├── Interactive Learning Events

├── Objectives

└── Summary
```

---

# 13. Domain Events

Representative domain events include:

- LessonCreated
- LessonRenamed
- LessonPublished
- LessonArchived
- LessonRevisionCreated
- LessonRevisionPublished
- LessonRevisionDeprecated
- CurrentRevisionChanged

---

# 14. Commands

Representative commands include:

- CreateLesson
- RenameLesson
- PublishLesson
- ArchiveLesson
- CreateLessonRevision
- PublishLessonRevision
- ChangePublishedRevision

---

# 15. Business Invariants

## INV-001

Every Lesson belongs to exactly one Learning Product.

---

## INV-002

Every Lesson belongs to exactly one Workspace.

---

## INV-003

A Lesson always has exactly one Aggregate Root.

---

## INV-004

Only one Lesson Revision may be designated as the current published revision.

---

## INV-005

Publishing a Lesson always publishes a specific Lesson Revision.

---

## INV-006

A Lesson cannot reference a Lesson Revision belonging to another Lesson.

---

## INV-007

Only authorized Workspace Members may publish a Lesson.

---

## INV-008

A Lesson may contain multiple revisions but only one active published revision.

---

## INV-009

Archived Lessons cannot publish new revisions until restored.

---

# 16. State Machine

```text
Draft

↓

Under Review

↓

Published

↓

Archived
```

The publication state belongs to the Lesson Aggregate rather than individual revisions.

---

# 17. Aggregate References

The Lesson Aggregate references other aggregates only by identifier.

Examples:

- LearningProductId
- WorkspaceId
- MembershipId
- CurrentRevisionId

No external aggregate is embedded inside the Lesson Aggregate.

---

# 18. Future Evolution

The design intentionally supports future capabilities including:

- Collaborative authoring
- AI-assisted editing
- Approval workflows
- Scheduled publishing
- Multiple draft revisions
- Rollback to previous revisions
- Branching revisions
- Translation revisions
- Localization
- Audit history

These capabilities can be introduced without modifying the core Lesson Aggregate.

---

# 19. Architectural Rationale

Separating Lesson from Lesson Revision provides several architectural benefits:

- A stable business identity independent of content evolution.
- A smaller and more cohesive aggregate.
- Clear ownership boundaries.
- Better support for AI-assisted authoring.
- Improved scalability for collaborative editing.
- Simplified publishing workflows.
- Future-ready versioning and rollback capabilities.

The Lesson Aggregate remains focused on business identity and publication management, while Lesson Revision becomes the authoritative owner of all instructional content.

---

# Summary

The Lesson Aggregate represents the stable, publishable identity of a learning experience within the Learning Workspace Platform.

By separating instructional content into the Lesson Revision Aggregate, the platform supports AI-native authoring, collaborative editing, version management, and sophisticated publishing workflows while maintaining clear aggregate boundaries and transactional consistency.