# Curriculum Aggregate Design

> Version: 1.0
>
> Status: Draft
>
> Domain: Learning Product
>
> Aggregate: Curriculum
>
> Related Documents:
>
> - Learning Product Aggregate Design
> - Lesson Aggregate Design
> - Lesson Revision Aggregate Design
> - Learning Asset Aggregate Design
> - Platform Aggregate Catalogue

---

# 1. Overview

The Curriculum Aggregate represents the pedagogical structure of a Learning Product.

A Curriculum defines how learners progress through educational experiences by organizing Lessons into logical instructional units, sequencing learning activities, defining prerequisites, and enforcing progression rules.

The Curriculum does not own instructional content. Instead, it references reusable Lesson Aggregates.

---

# 2. Vision

A Curriculum is responsible for transforming a collection of independent Lessons into a coherent learning journey.

It defines:

- what learners study,
- in which order,
- under which conditions,
- at what pace,
- and how completion is measured.

The Curriculum is independent of the Learning Product's commercial aspects and independent of the Lesson's instructional implementation.

---

# 3. Responsibilities

The Curriculum Aggregate is responsible for:

- Organizing Lessons into Curriculum Units.
- Managing lesson sequencing.
- Managing learning paths.
- Managing prerequisites.
- Managing release rules.
- Managing completion rules.
- Managing curriculum navigation.
- Defining learner progression.

The Curriculum Aggregate is **not** responsible for:

- Lesson content
- Lesson revisions
- Learning assets
- Assessments
- Enrollment
- Pricing
- Certificates

---

# 4. Aggregate Root

```text
Curriculum
```

The Curriculum Aggregate Root owns the complete pedagogical structure of a Learning Product.

---

# 5. Aggregate Structure

```text
Curriculum (Aggregate Root)

├── Curriculum Units
│
│      ├── Curriculum Lessons
│      │
│      └── Unit Rules
│
├── Curriculum Rules
│
├── Navigation Rules
│
├── Release Rules
│
└── Completion Rules
```

---

# 6. Aggregate Responsibilities

The Curriculum Aggregate owns:

- instructional organization
- unit hierarchy
- lesson sequencing
- learning progression
- curriculum navigation
- release scheduling
- completion requirements

The Curriculum does not own instructional resources.

---

# 7. Entities

## Curriculum Unit

Represents a logical instructional grouping.

Examples:

- Module
- Chapter
- Week
- Unit
- Phase

Each Curriculum Unit contains an ordered collection of Curriculum Lessons.

Curriculum Units exist only within a Curriculum.

---

## Curriculum Lesson

Represents a Lesson within a Curriculum.

Curriculum Lesson references a Lesson Aggregate while adding curriculum-specific behavior.

Examples of curriculum-specific information include:

- lesson order
- required or optional
- unlock conditions
- completion requirements
- estimated study time
- contribution to progress calculation

Curriculum Lesson is not the Lesson Aggregate itself.

---

# 8. Value Objects

## Curriculum Metadata

Contains:

- Title
- Description
- Version
- Language

---

## Navigation Rules

Examples:

- Sequential
- Free Navigation
- Adaptive Navigation

---

## Release Rules

Examples:

- Immediate
- Scheduled
- Drip Release
- Instructor Controlled

---

## Completion Rules

Examples:

- Minimum Progress
- Required Lessons
- Required Units
- Passing Score Requirements

---

## Progress Calculation

Defines how learner progress is calculated.

Examples:

- Lesson Completion
- Time Spent
- Assessment Completion
- Weighted Progress

---

# 9. Aggregate Relationships

```text
Learning Product

↓

Curriculum

↓

Curriculum Unit

↓

Curriculum Lesson

↓

references

↓

Lesson
```

The Curriculum references Lessons by identifier only.

---

# 10. Lesson Organization

A Lesson may appear:

- multiple times in one Curriculum (if allowed),
- in multiple Curricula,
- in multiple Learning Products.

Curriculum controls the context in which the Lesson is delivered.

---

# 11. Learning Progression

The Curriculum defines progression through instructional rules.

Examples include:

- lesson order
- prerequisite lessons
- prerequisite units
- optional learning paths
- mandatory lessons
- branching paths
- adaptive sequencing

---

# 12. Domain Events

Representative events include:

- CurriculumCreated
- CurriculumUpdated
- CurriculumPublished
- CurriculumArchived

- CurriculumUnitAdded
- CurriculumUnitRemoved
- CurriculumUnitReordered

- CurriculumLessonAdded
- CurriculumLessonRemoved
- CurriculumLessonMoved

- CurriculumRulesUpdated
- ReleaseRulesChanged
- CompletionRulesChanged

---

# 13. Commands

Representative commands include:

- CreateCurriculum
- RenameCurriculum
- PublishCurriculum
- ArchiveCurriculum

- AddCurriculumUnit
- RemoveCurriculumUnit
- ReorderCurriculumUnits

- AddLessonToUnit
- RemoveLessonFromUnit
- MoveLesson
- UpdateLessonSequence

- UpdateNavigationRules
- UpdateReleaseRules
- UpdateCompletionRules

---

# 14. Business Invariants

## INV-001

Every Curriculum belongs to exactly one Learning Product.

---

## INV-002

Every Curriculum Unit belongs to exactly one Curriculum.

---

## INV-003

Every Curriculum Lesson belongs to exactly one Curriculum Unit.

---

## INV-004

Every Curriculum Lesson references exactly one Lesson Aggregate.

---

## INV-005

Lesson ordering within a Curriculum Unit must be unique.

---

## INV-006

Curriculum Unit ordering within a Curriculum must be unique.

---

## INV-007

Prerequisite relationships must not create circular dependencies.

---

## INV-008

A published Curriculum must contain at least one Curriculum Unit.

---

## INV-009

Each Curriculum Unit must contain at least one Curriculum Lesson before publication.

---

## INV-010

Only published Lessons may be included in a published Curriculum.

---

## INV-011

Progress calculation rules must produce deterministic learner progress.

---

# 15. State Machine

```text
Draft

↓

Under Review

↓

Published

↓

Archived
```

Publication controls the pedagogical structure rather than the instructional content.

---

# 16. Aggregate References

The Curriculum Aggregate references:

- LearningProductId
- LessonId (through Curriculum Lesson)

No external Aggregate is embedded.

---

# 17. Architectural Rationale

The Curriculum Aggregate separates educational organization from instructional implementation.

This separation enables:

- Lesson reuse across products.
- Flexible learning pathways.
- Multiple curricula referencing the same Lesson.
- Independent evolution of lesson content.
- Stable pedagogical structure.
- Future adaptive learning capabilities.

Curriculum orchestrates learning.

Lesson delivers learning.

Lesson Revision defines instructional design.

Learning Asset provides educational resources.

---

# 18. Future Evolution

The Curriculum Aggregate supports future capabilities including:

- Adaptive learning paths
- Personalized curricula
- Competency-based progression
- Learning recommendations
- AI-assisted curriculum optimization
- Curriculum analytics
- Cross-curriculum lesson reuse
- Multi-language curricula
- Curriculum versioning
- Accreditation mapping

---

# Summary

The Curriculum Aggregate is the authoritative owner of the pedagogical structure within a Learning Product.

It transforms independent Lessons into a coherent educational journey by organizing them into Curriculum Units, sequencing learning experiences, enforcing progression rules, and defining learner navigation.

The Curriculum remains independent from Lesson content, Lesson Revisions, and Learning Assets, allowing each aggregate to evolve independently while collaborating through well-defined references.