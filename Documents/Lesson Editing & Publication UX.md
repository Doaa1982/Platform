# Lesson Editing & Publication UX

> **Document Type:** UX Business Rules
>
> **Related Context:** Learning Publication & Version Management
>
> **Audience:** Product Owners, Business Analysts, UX Designers, Developers

---

# Purpose

The publication workflow should remain **simple for tutors** while still preserving the integrity of published educational content.

The platform should hide version management whenever possible and automatically create new lesson versions only when educational content fundamentally changes.

> **Design Principle**
>
> Tutors should think about **editing lessons**, not **managing versions**.

---

# User Experience Philosophy

Most tutors simply want to improve their lessons.

They should never have to think about:

- Version numbers
- Migration policies
- Publication workflows
- Student assignment strategies

Those are responsibilities of the platform.

The system automatically decides whether a change:

- Updates the current lesson
- Requires learner notification
- Creates a new lesson version

---

# Lesson States

```text
Draft
Published
```

Only two lesson states are exposed to tutors.

Internally, the system may maintain multiple lesson versions, but versioning is not part of the everyday tutor experience.

---

# Scenario 1 — Create New Lesson

When a tutor creates a new lesson, the lesson starts in **Draft** mode.

All lesson properties are editable.

### Available Actions

```text
[ Save Draft ]

[ Publish ]
```

### Business Rules

- Saving creates or updates the draft.
- Publishing creates the first published lesson version.
- Tutors are not shown version numbers.

---

# Scenario 2 — Editing a Draft Lesson

While a lesson is in Draft state, every field can be modified.

### Editable Fields

- Title
- Description
- Video
- Estimated Time
- Interactive Questions
- Attachments
- Resources
- Learning Objectives
- AI Settings
- Tags

### Available Actions

```text
[ Save Draft ]

[ Publish ]
```

### Business Rules

- Drafts are fully editable.
- Publishing makes the lesson immutable except for approved in-place updates.

---

# Scenario 3 — Editing a Published Lesson (Safe Metadata Updates)

Some changes do not alter the educational experience.

These changes may be applied directly to the current published lesson without creating a new version.

## Editable Fields

- Title
- Description / Lesson Content Metadata
- Estimated Time

## Available Action

```text
[ Save Changes ]
```

## Business Rules

- No new lesson version is created.
- No publication workflow is required.
- No migration policy is required.
- Changes are immediately visible.
- Existing students continue using the updated lesson.

---

# Scenario 4 — Editing Interactive Questions

Interactive questions may evolve independently of the lesson video.

Examples include:

- Improving wording
- Correcting mistakes
- Adding hints
- Improving distractors
- Updating explanations

## Available Action

```text
[ Save Changes ]
```

## Business Rules

- The current published lesson is updated.
- No new lesson version is created.
- No publication workflow is required.
- Existing students remain assigned to the lesson.
- Students who have started or completed the lesson receive a notification informing them that the interactive questions have been improved.

### Student Notification Example

```text
Lesson Updated

The interactive questions for this lesson have been improved.

Your learning progress has not changed.
```

### Additional Business Rule

Student attempts that were already completed remain unchanged.

Updated questions apply only to future attempts unless the tutor explicitly resets learner attempts.

---

# Scenario 5 — Replacing the Lesson Video

Replacing the lesson video fundamentally changes the learning experience.

The platform therefore treats this as a new educational version rather than a simple lesson update.

When the tutor attempts to replace the video, the platform displays a decision dialog.

---

## Replace Video Dialog

```text
You are replacing the lesson video.

Replacing the video creates a new learning version.

Choose how you would like to continue.
```

---

# Option 1 — Create New Lesson Version

```text
Create New Version

✓ Copy current lesson
✓ Upload the new video
✓ Students already partway through the lesson keep watching the current
  video until they finish it
✓ Students who haven't started the lesson yet, and new students, get
  the new version
```

### Business Rules

- A new lesson version is created immediately.
- The new version becomes the active version for anyone who has **not started**
  the lesson — new enrollments and existing students alike — as soon as it is
  published.
- A student who is already **Started or In Progress** on the lesson stays on
  the version they started with until they reach Completed. This is a fixed
  platform rule, not a tutor-configurable choice.
- A student who has already **Completed** the lesson is never affected by a
  later video replacement.
- Student history remains unchanged.

> **Resolved 2026-08-08** — see Learning Publication & Version Management §20
> (Rules 16–18). Earlier wording here implied existing students remain on the
> old version indefinitely regardless of their progress; the actual rule only
> protects students who are mid-lesson, and depends on Learning Progress
> recording which revision a student's progress belongs to (currently a gap —
> see Learning Progress Tracking Business Analysis, PR-009).

---

# Option 2 — Create New Draft

```text
Create New Draft

✓ Copy lesson information
✓ Remove video-related assets
✓ Open the lesson editor
✓ Publish when ready
```

### Business Rules

The platform creates a new draft lesson using the current lesson as a template.

The following information is copied:

- Title
- Description
- Learning Objectives
- Estimated Time
- Attachments
- Resources
- Tags
- AI Configuration

The following information is intentionally removed:

- Videos
- Video Transcript
- Interactive Questions
- Timeline Events
- AI Summary
- AI Flashcards
- AI Quiz Suggestions
- Captions

The tutor is redirected directly to the draft lesson editor.

This allows the tutor to rebuild all video-dependent content before publishing.

---

# Why Video Assets Are Removed

The following lesson assets depend on the uploaded video:

- Transcript
- Timeline
- Interactive Questions
- AI Summary
- Flashcards
- Quiz Suggestions
- Captions

Keeping these assets after replacing the video would create inconsistent educational content.

Therefore, they are regenerated for the new lesson.

---

# Tutor Experience

From the tutor's perspective, the workflow is intentionally simple.

```text
Create Lesson

↓

Save Draft

↓

Publish

↓

Later...

↓

Edit Lesson

↓

Save Changes
```

Only when the tutor replaces the instructional video does the platform introduce version management.

---

# Hidden System Responsibilities

Although the tutor experiences a simple editing workflow, the platform internally manages:

- Lesson Versions
- Publication History
- Version Lineage
- Student Assignments
- Audit Logs
- Notification Delivery
- Version Compatibility
- Migration Decisions

These responsibilities remain invisible unless required.

---

# UX Principles

## Keep Common Tasks Simple

Routine lesson improvements should never require understanding version management.

---

## Hide Technical Complexity

Versioning is a platform responsibility rather than a tutor responsibility.

---

## Protect Learner History

Published educational experiences should remain stable for enrolled learners.

---

## Create Versions Only When Necessary

New lesson versions are created only when educational content fundamentally changes.

---

## Preserve Trust

Learners should never unexpectedly lose progress or encounter a significantly different lesson without an intentional publication decision.

---

# Summary

The lesson editing experience follows a simple philosophy:

- Draft lessons are fully editable.
- Published lessons allow safe in-place updates for approved fields.
- Interactive question improvements update the current lesson and notify affected learners.
- Replacing the instructional video creates a new educational version through a guided workflow.
- Version management remains an implementation detail, allowing tutors to focus on teaching rather than content lifecycle management.