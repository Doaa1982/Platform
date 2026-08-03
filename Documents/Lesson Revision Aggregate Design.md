# Lesson Revision Aggregate Design

> Version: 1.1
>
> Status: Draft
>
> Domain: Learning Delivery
>
> Aggregate: Lesson Revision
>
> Related Documents:
>
> - Lesson Aggregate Design
> - Learning Delivery Context
> - AI Authoring Assistant Architecture
> - AI Collaboration Architecture
> - Platform Aggregate Catalogue
> - Learning Activity Assignment Business Analysis
> - Assignment Business Analysis
>
> **Revision Note (v1.1):** Added **Learning Activity** as a formal Entity (Section 7), previously referenced as belonging to Lesson Revision in Learning Activity Assignment Business Analysis but absent from this document's own entity list — a gap identified in the Learning Workspace Architecture Gap Review. Added an explicit distinction from Interactive Learning Event (the two are easy to conflate but differ in timing, delivery mechanism, and governing invariant — see the comparison table in Section 7). Updated the Aggregate Structure diagram (Section 5), Aggregate Relationships diagram (Section 9), Domain Events (Section 13), Commands (Section 14), and added INV-010 (Section 15) accordingly.

---

# 1. Overview

The Lesson Revision Aggregate represents the complete instructional blueprint of a Lesson at a specific point in time.

While the Lesson Aggregate represents the stable business identity of a learning experience, the Lesson Revision Aggregate owns all instructional content that educators and AI collaboratively create, edit, review, and publish.

Every educational modification produces or updates a Lesson Revision rather than altering the Lesson Aggregate directly.

---

# 2. Vision

A Lesson Revision is the complete educational representation of a Lesson.

It contains everything required to deliver a learning experience, including instructional structure, learning assets, interactive activities, objectives, AI-generated content, and educational metadata.

The Lesson Revision Aggregate is the primary workspace for educators and AI during lesson authoring.

---

# 3. Responsibilities

The Lesson Revision Aggregate is responsible for:

- Managing instructional structure.
- Managing lesson sections.
- Managing learning asset references.
- Managing interactive learning events.
- Managing transcripts.
- Managing learning objectives.
- Managing generated summaries.
- Managing instructional metadata.
- Managing AI-generated educational content.
- Maintaining revision consistency.

---

# 4. Aggregate Root

```text
LessonRevision
```

LessonRevision is the Aggregate Root.

It owns every instructional component belonging to that revision.

---

# 5. Aggregate Structure

```text
Lesson Revision (Aggregate Root)

├── Sections
├── Learning Asset References
├── Transcript
├── Learning Objectives
├── Interactive Learning Events
├── Learning Activities
├── Lesson Summary
├── Keywords
├── Lesson Outline
├── Revision Metadata
└── AI Content
```

---

# 6. Aggregate Responsibilities

The Lesson Revision Aggregate owns:

- instructional content
- educational structure
- instructional sequence
- AI-generated lesson content
- learning objectives
- summaries
- transcripts
- interactive activities (both timeline-anchored Interactive Learning Events and assignable Learning Activities — see Section 7 for the distinction)
- attached learning resources

It does not own:

- Lesson identity
- publication lifecycle
- Workspace
- Learning Product
- Membership

Those belong to the Lesson Aggregate.

---

# 7. Entities

The following objects have identity within a Lesson Revision.

## Lesson Section

Represents a logical instructional section.

Examples:

- Introduction
- Topic
- Exercise
- Demonstration
- Summary

Each section has:

- Section Id
- Order
- Title
- Content Reference

---

## Learning Asset Reference

Represents a reference to reusable learning assets.

Examples:

- Video
- PDF
- Slide Deck
- Audio
- External URL
- Image

The aggregate references assets but does not own the underlying files.

---

## Interactive Learning Event

Represents learner interaction during lesson playback.

Examples:

- Multiple Choice Question
- True / False
- Complete the Sentence
- Reflection Prompt
- Poll
- Discussion Point

Each event includes:

- Event Id
- Timeline Position
- Trigger
- Interaction Type
- Feedback
- Navigation Rule

---

## Learning Activity

Represents a piece of educational work that extends the learning experience during or after instruction, as defined in Learning Activity Assignment Business Analysis. Every Learning Activity belongs to exactly one Lesson Revision and is created, edited, published, and versioned together with it — the same rule that already applies to every other entity in this section.

Examples:

- Homework
- Quiz
- Reading
- Video Activity
- Reflection
- Essay
- Coding Exercise
- Discussion
- File Upload
- Project

Each Learning Activity includes:

- Activity Id
- Activity Type
- Instructions / Content Reference
- Estimated Completion Time (optional)

**Distinction from Interactive Learning Event:** These two entities are easy to conflate — both represent learner interaction attached to a Lesson Revision, and their example lists overlap in places (e.g., "Discussion"). They are kept as separate entities because they differ in a way that has real structural consequences:

| | Interactive Learning Event | Learning Activity |
|---|---|---|
| Timing | Synchronous — occurs *during* playback at a specific Timeline Position | Asynchronous — completed *during or after* instruction, not tied to a playback moment |
| Delivery mechanism | Embedded directly in the lesson's timeline; answered in place | Delivered via a separate **Assignment** (Learning Delivery), with its own due date, attempt policy, submission window, and evaluation method |
| Governing invariant | Must reference a valid Learning Asset timeline when tied to time-based media (INV-003) | Referenced by exactly one Assignment when delivered (see Assignment Business Analysis, BA-002) |
| Typical granularity | A single micro-interaction (one question, one poll) | A complete deliverable unit of work (a full quiz, a whole essay, a project) |

A Learning Activity of type "Quiz" may internally be composed of several individual questions; whether those questions are modeled as Interactive Learning Events reused within the Activity, or as a separate question list owned by the Activity itself, is left for detailed data modeling and is not resolved by this document.

---

## AI Generated Content

Represents educational content proposed by AI.

Examples:

- Suggested explanation
- Generated examples
- Quiz suggestions
- Improved wording
- Teaching notes

AI-generated content remains editable by educators.

---

# 8. Value Objects

## Transcript

Represents the lesson transcript.

Generated by AI or manually edited.

---

## Learning Objectives

Represents instructional outcomes.

Examples:

- Explain...
- Apply...
- Analyze...

---

## Lesson Summary

Represents the educational summary.

---

## Keywords

Educational keywords.

---

## Revision Metadata

Contains:

- Revision Name
- Revision Notes
- Creation Timestamp
- Last Updated
- AI Participation Indicator

---

## Estimated Duration

Represents expected learner completion time.

---

## Difficulty

Represents lesson complexity.

---

## Language

Represents instructional language.

---

# 9. Aggregate Relationships

```text
Lesson

↓

Lesson Revision

├── Sections

├── Learning Asset References

├── Transcript

├── Interactive Learning Events

├── Learning Activities

├── Objectives

├── Summary

└── AI Generated Content
```

---

# 10. AI Collaboration

Lesson Revision is the primary collaboration surface for AI.

Examples:

Teacher requests:

Generate Transcript

↓

Transcript updated

Teacher requests:

Generate Objectives

↓

Objectives added

Teacher requests:

Generate Interactive Events

↓

Interactive Learning Events added

Teacher requests:

Improve Explanation

↓

Section updated

The AI never edits the Lesson Aggregate.

It collaborates exclusively through Lesson Revision.

---

# 11. Interactive Learning Events

Interactive Learning Events support timeline-based learning experiences.

Examples:

```text
00:45

↓

True / False

----------------

02:10

↓

Multiple Choice

----------------

05:30

↓

Reflection

----------------

08:20

↓

Complete Question
```

These events are synchronized with learning assets.

---

# 12. Learning Asset References

Lesson Revision references reusable Learning Assets.

```text
Lesson Revision

↓

Video

↓

Image

↓

Worksheet

↓

Audio

↓

Simulation
```

Assets remain independent business objects.

---

# 13. Domain Events

Representative events include:

- LessonRevisionCreated
- LessonSectionAdded
- LessonSectionRemoved
- LessonSectionUpdated
- TranscriptGenerated
- TranscriptUpdated
- ObjectivesGenerated
- InteractiveLearningEventAdded
- InteractiveLearningEventUpdated
- LearningActivityAdded
- LearningActivityRemoved
- LearningActivityUpdated
- LearningAssetAttached
- LearningAssetDetached
- SummaryGenerated
- AIContentGenerated

---

# 14. Commands

Representative commands include:

- CreateLessonRevision
- AddSection
- RemoveSection
- ReorderSections
- AttachLearningAsset
- DetachLearningAsset
- GenerateTranscript
- GenerateObjectives
- GenerateInteractiveEvents
- AddLearningActivity
- RemoveLearningActivity
- UpdateLearningActivity
- GenerateSummary
- ImproveLesson
- UpdateTranscript
- UpdateObjectives

---

# 15. Business Invariants

## INV-001

Every Lesson Revision belongs to exactly one Lesson.

---

## INV-002

Every Section belongs to exactly one Lesson Revision.

---

## INV-003

Interactive Learning Events must reference a valid Learning Asset timeline when associated with time-based media.

---

## INV-004

Learning Asset References must reference existing Learning Assets.

---

## INV-005

Section ordering must remain unique within a Lesson Revision.

---

## INV-006

Interactive Learning Event ordering must remain deterministic.

---

## INV-007

Transcript timestamps must remain synchronized with associated media when timestamped transcripts are enabled.

---

## INV-008

AI-generated content remains editable before publication.

---

## INV-009

Removing a Learning Asset must invalidate or remove dependent Interactive Learning Events before the revision can be validated for publication.

---

## INV-010

Every Learning Activity belongs to exactly one Lesson Revision and is versioned together with it, consistent with Learning Activity Assignment Business Analysis (BA-001). A Learning Activity cannot exist independently of a Lesson Revision.

---

# 16. State Machine

```text
Draft

↓

Editing

↓

Ready for Review

↓

Approved

↓

Published
```

The Lesson Aggregate determines which revision is currently published.

The Lesson Revision manages its own preparation lifecycle.

---

# 17. Aggregate References

Lesson Revision references:

- LessonId
- LearningAssetIds
- AI Collaboration Session (optional)
- Author MembershipId

References are maintained by identifier only.

---

# 18. Future Evolution

The Lesson Revision Aggregate supports future capabilities including:

- Branching revisions
- Collaborative editing
- AI-assisted refinement
- Translation revisions
- Localization
- Content comparison
- Merge operations
- Review workflows
- Educational quality scoring
- Accessibility improvements
- Curriculum alignment analysis

---

# 19. Architectural Rationale

Separating Lesson from Lesson Revision enables a clear separation of concerns.

The Lesson Aggregate represents business identity and publication.

The Lesson Revision Aggregate represents instructional content and educational evolution.

This design:

- minimizes aggregate size,
- improves transactional consistency,
- enables sophisticated AI collaboration,
- supports version management,
- supports future collaborative authoring,
- simplifies publication workflows,
- preserves a stable lesson identity.

---

# Summary

The Lesson Revision Aggregate is the authoritative owner of all instructional content within the Learning Workspace Platform.

It provides the collaborative workspace where educators and AI create, refine, review, and evolve educational experiences while the Lesson Aggregate remains responsible for business identity and publication management.

Together, the Lesson and Lesson Revision aggregates establish a scalable, AI-native architecture for lesson authoring, publishing, and continuous instructional improvement.