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
- how learners progress,
- and the learning rules that govern successful completion.

The Curriculum represents the educational structure of the learning experience together with the educational rules that define learner progression.

The Curriculum is independent of the Learning Product's commercial aspects and independent of the Lesson's instructional implementation.

---

# 3. Responsibilities

The Curriculum Aggregate is responsible for:

- Organizing Lessons into Curriculum Units.
- Managing lesson sequencing.
- Managing learning paths.
- Managing prerequisites.
- Managing release rules.
- Defining learning rules.
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

Learning Rules include:

- navigation rules,
- release rules,
- progression rules,
- completion rules,
- passing requirements.

These rules define educational expectations.

Operational domains consume these rules but do not modify them.---

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

# 8. Learning Rules and Value Objects

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

Examples include:

- Required lessons
- Required curriculum units
- Minimum progress threshold
- Minimum passing score
- Required assignments
- Tutor approval requirement

Completion Rules define educational expectations.

They do not determine whether an individual learner has satisfied those expectations.

That responsibility belongs to the Learning Progress Tracking capability.

---

## Progress Rules

Defines the educational rules used by the Progress Tracking capability when interpreting learner advancement.

Examples include:

- Progress based on completed lessons
- Progress based on required lessons only
- Progress based on completed learning activities
- Progress based on required assignments

The Curriculum defines these rules.

The Progress Tracking capability evaluates learner activity according to them.

Examples:

- Lesson Completion
- Time Spent
- Assessment Completion
- Weighted Progress

---

## Prerequisites

Defines the ordering dependency between two instructional elements: a lesson or unit that must reach a defined state (e.g. Completed) before another becomes available.

Prerequisites are the mechanism behind the "prerequisite lessons," "prerequisite units," and "branching paths" referenced in Section 11, and are what INV-007 (no circular dependencies) governs.

**V1 status:** not yet modeled as a general graph. Only the single-predecessor case is implemented today, as `RequiresSequentialCompletion` (see Section 18) — a Lesson may require the one immediately before it in curriculum order. There is no per-lesson or per-unit prerequisite list yet, so INV-007 does not currently apply; it becomes active once a general Prerequisite value object is introduced.

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

- at most once within a given Curriculum Unit (enforced — a Unit cannot contain the same Lesson twice),
- in more than one Curriculum Unit within the same Curriculum,
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

## INV-012

Every Curriculum belongs to exactly one Workspace.

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

- WorkspaceId
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

# 18. V1 Implementation Notes

The first working implementation narrows two of the above to a single concrete
behavior each. Recorded here so this document stays an accurate reference
alongside the richer model in the sections above, which remains the intended
direction rather than what exists today.

## Reordering (§12 Domain Events: CurriculumUnitReordered, CurriculumLessonMoved; §13 Commands: ReorderCurriculumUnits, MoveLesson)

Implemented as `Curriculum.ReorderUnits(orderedUnitIds)` and
`Curriculum.ReorderLessonsInUnit(unitId, orderedLessonIds)`. The caller
supplies the complete new order as a permutation of the current ids — there
is no single-position "move by one" command; a client wanting to move one
item builds the new full order and sends that. Positions stay dense,
zero-based integers (§7), the same scheme AddUnit/AddLesson already use.
Both require the Curriculum to be Draft (RequireEditable, §15) — the same
rule that already governs every other structural change, so a Learner
mid-course never has ordering shift beneath them.

## Sequential Unlock (§8 Navigation Rules: "Sequential")

Implemented as a single boolean, `Curriculum.RequiresSequentialCompletion`,
rather than the richer per-lesson prerequisite graph implied by §11 and
INV-007. When on, a Learner may not open a lesson until the lesson
immediately before it — in curriculum order, unit by unit — is Completed.
There is no concept yet of optional lessons, branching, or multiple
prerequisites; INV-007's circular-dependency concern does not yet apply,
since the only relationship is "the one lesson immediately before this one."

Unlike structural changes, toggling this setting is *not* gated by
RequireEditable — `SetSequentialUnlock` is a policy switch, not a structural
edit, so a tutor can turn it on or off while the Curriculum is Published.
Enforcement itself lives outside this aggregate, in the Learning Delivery
capability (see Learning Progress Tracking Business Analysis, BA-007), since
it depends on per-enrollment Lesson Progress this aggregate has no knowledge
of — this aggregate only records the setting.

## Published-Lesson Check on Publish (§14 INV-010)

Not yet implemented. `Curriculum.PublicationBlocker()` currently checks only
INV-008 (at least one Unit) and INV-009 (every Unit non-empty) — it does not
check that every referenced Lesson is itself Published. It cannot today,
because Curriculum holds only a `LessonId` and has no visibility into Lesson
state (§16 — no external aggregate is embedded). Enforcing INV-010 requires
either a cross-aggregate domain service that reads Lesson publication state
at the moment `Publish()` is called, or an application-layer check ahead of
it. Until one exists, INV-010 is the intended rule rather than an enforced
one, and a Curriculum can currently publish while referencing an unpublished
Lesson.

## Progress Rules (§8)

Not yet implemented beyond Sequential Unlock above. The richer catalogue in
§8 — progress based on required lessons only, weighted progress, time spent,
assessment completion — has no corresponding value object or field on
`Curriculum` today. `RequiresSequentialCompletion` is the only progress-
relevant rule the aggregate currently carries; the rest of §8 describes the
intended direction, not current state.

---

# 19. Future Evolution

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