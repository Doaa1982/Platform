# Learning Publication & Version Management

> **Bounded Context**
>
> **Domain:** Learning Workspace
>
> **Status:** Core Domain
>
> **Purpose:** Manage the lifecycle, publication, versioning, and safe evolution of educational content while preserving learner history, progress, grades, and trust.

---

# 1. Business Mission

Educational content continuously evolves.

Tutors improve explanations, replace videos, fix mistakes, regenerate AI-generated content, and redesign assessments.

The platform must allow continuous improvement **without breaking the learning experience of students already consuming published content.**

The mission of this bounded context is to safely manage content evolution by treating every published lesson as an immutable versioned educational product.

---

# 2. Vision

Every published lesson represents a permanent educational artifact.

Students always learn from a specific lesson version.

Future improvements create new versions rather than modifying history.

---

# 3. Business Goals

- Preserve student learning history.
- Allow tutors to continuously improve lessons.
- Prevent accidental breaking changes.
- Protect grades and certificates.
- Support intelligent publication decisions.
- Support AI-assisted publication workflows.
- Maintain complete publication audit history.
- Enable future analytics across lesson versions.

---

# 4. Responsibilities

This bounded context owns:

- Lesson Versioning
- Draft Management
- Publication Workflow
- Release Classification
- Impact Analysis
- Compatibility Analysis
- Migration Policies
- Publication Decisions
- Version Activation
- Version Retirement
- Publication Audit Trail

---

# 5. Out of Scope

This context does NOT own:

- Lesson Authoring
- Video Editing
- Quiz Authoring
- Assignment Authoring
- AI Lesson Generation
- Student Progress Tracking
- Enrollment
- Learning Delivery

These belong to other bounded contexts.

---

# 6. Ubiquitous Language

| Term | Definition |
|-------|------------|
| Lesson | Stable business identity representing an educational lesson |
| Lesson Version | Immutable published snapshot of a lesson |
| Draft Version | Editable version under construction |
| Publication | Business event that releases a lesson version |
| Active Version | Default version assigned to new students |
| Retired Version | Published version no longer assigned to new students |
| Superseded Version | Older version replaced by a newer one |
| Release Type | Classification describing the significance of a release |
| Impact Analysis | Analysis of educational changes between versions |
| Compatibility Analysis | Determines whether learners can safely migrate |
| Migration Policy | Rules describing how students move between versions |
| Publication Decision | Final publishing strategy selected by the tutor |
| Publication Report | Summary of publication analysis and decisions |
| Version Lineage | Parent-child relationship between lesson versions |

---

# 7. Core Aggregates

---

## Lesson

Represents the permanent identity of an educational lesson.

### Properties

| Property | Description |
|----------|-------------|
| LessonId | Unique lesson identifier |
| TutorId | Owner |
| CurrentPublishedVersionId | Current active version |
| Status | Lesson lifecycle status |

### Responsibilities

- Stable business identity
- Owns lesson versions
- Tracks active version

---

## LessonVersion

Represents one immutable published snapshot.

### Properties

| Property | Description |
|----------|-------------|
| VersionId | Version identifier |
| LessonId | Parent lesson |
| VersionNumber | Sequential version |
| ParentVersionId | Previous version |
| Status | Draft, Published, Retired |
| ReleaseType | Patch, Minor, Major |
| CreatedBy | Tutor |
| CreatedAt | Creation date |
| PublishedAt | Publication date |

### Rules

- Editable while Draft
- Immutable after Publication
- Never deleted
- Always traceable

---

## Publication

Represents a publishing event.

### Properties

| Property | Description |
|----------|-------------|
| PublicationId | Publication identifier |
| LessonVersionId | Published version |
| ReleaseType | Patch, Minor, Major |
| MigrationPolicy | Selected migration strategy |
| ImpactLevel | Low, Medium, High |
| CompatibilityScore | Safe migration percentage |
| PublishedBy | Tutor |
| PublishedAt | Date |
| DecisionReason | Optional explanation |

---

## ImpactReport

Automatically generated before publication.

### Properties

| Property | Description |
|----------|-------------|
| AddedVideos | Number added |
| RemovedVideos | Number removed |
| AssessmentChanges | Summary |
| ObjectiveChanges | Summary |
| CompletionRuleChanges | Summary |
| AIAssetChanges | Summary |
| AttachmentChanges | Summary |
| ResourceChanges | Summary |
| AffectedStudents | Count |
| CompatibilityScore | Calculated percentage |
| RecommendedPolicy | Suggested migration |

---

# 8. Release Types

---

## Patch Release

Small cosmetic improvements that do not affect learning.

### Examples

- Typo corrections
- Grammar fixes
- Formatting
- Thumbnail changes
- Subtitle updates
- Metadata updates

### Default Recommendation

```
Update Everyone
```

---

## Minor Release

Educational improvements without fundamentally changing the lesson.

### Examples

- Better explanations
- Additional examples
- New optional resources
- Additional downloadable materials

### Default Recommendation

```
Update Not Started

or

Update In Progress

depending on compatibility analysis.
```

---

## Major Release

Educational changes affecting learning outcomes.

### Examples

- Replacing lesson videos
- Removing assessments
- Changing grading
- Changing completion rules
- Modifying learning objectives
- Reordering lesson structure

### Default Recommendation

```
Keep Existing Students
```

---

# 9. Migration Policies

Migration policies are implemented as business strategies.

| Policy | Description |
|---------|-------------|
| KeepExistingStudents | Existing students stay on current version |
| UpdateEveryone | Everyone moves to the new version |
| UpdateNotStarted | Only students who never started migrate |
| UpdateInProgress | Students currently learning migrate |
| UpdateIncomplete | Students who haven't completed migrate |
| ManualSelection | Tutor selects students |
| RuleBased | System evaluates custom business rules |

---

# 10. Publication Workflow

```text
Tutor

    │

    ▼

Create Draft Version

    │

    ▼

Edit Lesson

    │

    ▼

Run Impact Analysis

    │

    ▼

Run Compatibility Analysis

    │

    ▼

Generate Publication Recommendation

    │

    ▼

Tutor Reviews Recommendation

    │

    ▼

Select Migration Policy

    │

    ▼

Publish

    │

    ▼

Activate Version

    │

    ▼

Execute Student Migration

    │

    ▼

Send Notifications

    │

    ▼

Complete Audit
```

---

# 11. Publication Decision Engine

## Purpose

Analyze lesson changes and recommend the safest publication strategy.

---

## Inputs

- Previous Published Version
- Draft Version
- Student Progress
- Assessments
- AI Assets
- Enrollment Data

---

## Outputs

- Impact Level
- Compatibility Score
- Release Type
- Recommended Migration Policy
- Publication Warnings
- Publication Report

---

# 12. Impact Analysis

The system compares two lesson versions.

It detects changes such as:

- Videos Added
- Videos Removed
- Videos Replaced
- Quiz Changes
- Assignment Changes
- Learning Objective Changes
- Completion Rule Changes
- Resource Changes
- AI Asset Changes

---

## Impact Levels

### Low

Examples

- Thumbnail
- Description
- Typo
- Subtitle

Recommended

```
Update Everyone
```

---

### Medium

Examples

- Additional PDF
- Additional Example
- New Optional Video

Recommended

```
Update Not Started
```

---

### High

Examples

- Removed Quiz
- Changed Grading
- Deleted Video
- Changed Learning Objectives

Recommended

```
Keep Existing Students
```

---

# 13. Compatibility Analysis

Compatibility measures how safely students can migrate.

Example

```
Compatibility

96%
```

Meaning

Most learners can safely continue.

---

Example

```
Compatibility

18%
```

Meaning

Migration is not recommended.

---

# 14. Business Rules

## Rule 1

Published lesson versions are immutable.

---

## Rule 2

Only draft versions may be edited.

---

## Rule 3

Publishing always creates a new lesson version.

---

## Rule 4

Student progress references LessonVersion.

Never Lesson.

---

## Rule 5

Grades belong to LessonVersion.

---

## Rule 6

Certificates belong to LessonVersion.

---

## Rule 7

Migration never deletes historical records.

---

## Rule 8

Only one lesson version may be Active for new enrollments.

---

## Rule 9

Retired versions remain available to assigned learners until migration occurs.

---

## Rule 10

Publication always produces an audit record.

---

# 15. Domain Events

- LessonDraftCreated
- LessonVersionCreated
- LessonCompared
- ImpactAnalysisCompleted
- CompatibilityAnalysisCompleted
- ReleaseTypeDetermined
- MigrationPolicyRecommended
- MigrationPolicySelected
- LessonPublished
- LessonVersionActivated
- LessonVersionRetired
- StudentMigrationStarted
- StudentMigrated
- StudentMigrationCompleted
- PublicationCompleted
- PublicationFailed

---

# 16. Integration with Other Bounded Contexts

| Context | Receives |
|----------|----------|
| Learning Workspace | Active lesson version |
| Student Learning | Student-version assignments |
| Assessment | Assessment version |
| AI Services | AI regeneration requests |
| Notification | Publication notifications |
| Analytics | Version-aware metrics |
| Certificates | Version-specific eligibility |
| Search & Catalog | Active lesson version |

---

# 17. Design Principles

## Immutable Publication

Published educational content is never modified.

---

## Versioned Learning

Every learner studies a specific lesson version.

---

## History Preservation

Past learning history is permanent.

---

## Safe Evolution

Educational improvements never unexpectedly disrupt active learners.

---

## Intelligent Publication

The platform assists tutors by analyzing changes and recommending safe publication strategies.

---

## Business Before Technology

Publication decisions are driven by educational business rules rather than technical implementation details.

---

# 18. Future Evolution

This bounded context is designed to support future capabilities including:

- AI-powered publication recommendations
- Organization-wide publication policies
- Scheduled publications
- Multi-stage approval workflows
- Version rollback
- A/B lesson releases
- Cohort-specific lesson versions
- Automatic migration rules
- Predictive learner impact analysis
- Compliance and accreditation audits

---

# 19. Applied Decision — Editing a Published Lesson

**Decided:** 2026-08-06

Sections 8 and 11–13 describe a general-purpose engine that classifies each edit by analyzing what changed (Impact Analysis), scores how safely learners can migrate (Compatibility Analysis), and recommends a Release Type and Migration Policy per publication. That engine is not built, and is not being built now — it is genuinely future-scale work (§18 already lists it there). Instead, the platform has adopted a simpler, concrete rule: each field of a Lesson is classified once, in advance, rather than analyzed per edit.

## Field classification

| Field | Classification | Effect of editing it on a Published Lesson Version |
|---|---|---|
| Title | Patch | Edited directly on the current published Lesson Version. No new version, no republish. |
| Body / instructional content | Patch | Same as Title. |
| Estimated Duration | Patch | Same as Title. |
| Interactive Learning Events (questions) | Patch, with notice | Edited directly on the current published Lesson Version's Assessment, regardless of the Assessment's own publish state. No new Lesson Version is created. Every learner whose Learning Progress on this lesson is Started or Completed receives a Notification that the questions changed. |
| Video | Major | Requires a new Lesson Version (Draft). The tutor is told this before the edit proceeds. |
| Delivery Mode (Recorded / Live Session) | Major | Same as Video — it changes what the lesson fundamentally is, not a detail of it. |

## Rule 11

A Patch-classified field may be edited on the current published Lesson Version directly. This does not create a new Lesson Version and does not require republishing.

## Rule 12

A Major-classified field may only be changed by creating a new Lesson Version (Draft). The currently published Lesson Version — and every learner currently assigned to it — is unaffected until the tutor explicitly publishes the new one.

## Rule 13

A new Lesson Version's Draft is pre-filled from the Lesson Version it was started from — every field except the video. A tutor starting a new version because the video needs replacing is not asked to re-author content that didn't change.

## Rule 14

Editing Interactive Learning Events on a Published Lesson Version produces a Notification for every learner whose Learning Progress on that lesson is Started or Completed. A learner who has Not Started the lesson is not notified — there is nothing for them to reconsider yet.

## Rule 15

There is no per-learner "pinned to their original version" mechanism, and none is needed. Only one Lesson Version is ever a Lesson's current published one, and a new Draft never affects what is being served to anyone until the tutor explicitly publishes it. "Existing learners keep seeing the old version while a replacement is prepared" already holds for free in the gap between starting a new Draft and publishing it — Rule 9's "retired versions remain available to assigned learners until migration occurs" is satisfied without a distinct migration step, because until publication there is nothing to migrate away from.

This closes the question Learning Progress Tracking Business Analysis §16 left open under "Lesson Revision": which revision determines learner progress is always the Lesson's current published one — there is no scenario, under this decision, where two learners are served a different Lesson Version at the same moment.

---

# Summary

Learning Publication & Version Management ensures that educational content can continuously evolve without compromising learner trust, progress, grades, certificates, or historical records.

By modeling published lessons as immutable versioned educational products and supporting intelligent publication decisions, the platform provides a safe, scalable foundation for long-term content evolution across tutors, AI-generated assets, and learning experiences.