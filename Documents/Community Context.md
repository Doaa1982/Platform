# Community Context

**Version:** 1.0 (Draft)

**Bounded Context Type:** Supporting Domain

**Domain Classification:** Strategic Supporting Context

> **Origin Note:** Community Context was, until this document, the only bounded context in the corpus that Discussion Thread Aggregate Design explicitly stated "has never itself received business-analysis-level documentation" — it existed solely as a placeholder name in Learning Workspace Bounded Context Identification (Section 4), a short subsection in the Bounded Context Map (Section 5.16), and implicit examples in the Domain Event Model's "Community Events." This document supplies that missing business-analysis-level treatment, in the same template used by Assessment Context, Communication Context, and the other Strategic Supporting Contexts. It does not replace Discussion Thread Aggregate Design, which remains the aggregate-level specification.

**Related Documents**

- Learning Workspace Bounded Context Map (Section 5.16)
- Learning Workspace Bounded Context Identification
- Discussion Thread Aggregate Design
- Communication Context
- Platform Aggregate Catalogue

---

# 1. Context Purpose

## Definition

The Community Context manages participatory, many-to-many discussion and collaborative community spaces within a Workspace.

It answers:

> "What is being discussed, by whom, and where does it live?"

---

# 2. Business Responsibility

The Community Context owns:

- Discussion Threads
- Comments
- Thread moderation state
- Community participation scope

---

# 3. Core Principle

## Community Is Participatory, Not Addressed

Communication Context answers:

> "Who is this message for, and did it reach them?"

Community Context answers:

> "What conversation is open, and who can join it?"

---

Example:

A Message (Communication Context):

```
From: Sara (Teacher)
To: Ahmed's Parent

Ahmed's speaking session is tomorrow at 6 PM.
```

is addressed — it has a specific sender and specific recipient(s).

A Discussion Thread (Community Context):

```
Topic: Week 3 Speaking Practice — Share Your Recordings

Posted by: Sara (Teacher)
Open to: All learners in IELTS Speaking Cohort

[12 comments]
```

is participatory — anyone within its scope may join, at any time, without being individually addressed.

---

# 4. Core Concepts

---

# 4.1 Discussion Thread

## Definition

A Discussion Thread is a collaborative, multi-participant conversation with a defined topic and participation scope.

---

## Examples

- Course discussion board
- Cohort study group thread
- Workspace-wide announcement discussion
- Lesson-attached Q&A thread

---

## Responsibilities

A Discussion Thread contains:

- topic and metadata;
- participation scope;
- an ordered collection of Comments;
- status (Open, Locked, Archived);
- moderation state.

---

# 4.2 Comment

## Definition

A Comment is one contribution to a Discussion Thread.

---

## Examples

```
Ahmed:

Here is my recording for this week's task.

  ↳ Sara (Teacher):

    Good pacing — work on word stress next time.
```

---

## Responsibilities

Tracks:

- author;
- content;
- posted time;
- optional parent comment, for threaded replies;
- status (Visible, Flagged, Removed).

---

# 4.3 Participation Scope

## Definition

Participation Scope defines who may view and who may post within a Discussion Thread.

---

## Examples

```
Visibility:

Workspace-wide

Learning-Product-scoped

Cohort-scoped


Posting Permission:

Open

Moderated

Read-Only
```

---

# 4.4 Moderation

## Definition

Moderation is the set of actions taken to maintain the quality and safety of Community spaces.

---

## Examples

- Flagging a Comment
- Removing a Comment (soft removal, preserving audit history)
- Locking a Thread
- Archiving a Thread

---

# 5. Owned Data

The Community Context is the source of truth for:

| Data | Owner |
|-|-|
| Discussion Threads | Community Context |
| Comments | Community Context |
| Thread Moderation State | Community Context |
| Community Participation Scope | Community Context |

---

# 6. Data Not Owned

| Data | Owner |
|-|-|
| Private Messages and Conversations | Communication Context |
| Broadcast Announcements | Communication Context |
| Learner identity | Identity Context |
| Membership and roles | Workspace Access Context |
| Lesson or Learning Product content a thread may reference | Learning Delivery Context / Learning Product Context |

---

# 7. Business Rules

---

## Rule 1 — Community Participation Requires Active Membership

Only an active Workspace Member within a Thread's Participation Scope may post; enforcement is evaluated at read/write time, not cached on the thread (Discussion Thread Aggregate Design, INV-004).

---

## Rule 2 — Threads Are Attachable, Not Owning

A Discussion Thread may be contextually attached to a Lesson or Learning Product (e.g., a course discussion board), but it never owns that content — the reference is by identifier only.

---

## Rule 3 — Moderation Preserves History

Removing a Comment is a soft removal, not a deletion, preserving an audit trail consistent with the platform's general preference for preserving historical records (Assessment Context, Rule 2, applied here by analogy; Discussion Thread Aggregate Design, INV-005).

---

## Rule 4 — Community Is Distinct From Communication

Community Context does not own private Messages, Conversations, or broadcast Announcements — those belong to Communication Context. Communication Context handles addressed or one-to-many communication; Community Context handles participatory, typically public-within-Workspace discussion (Bounded Context Map, Section 5.16; Discussion Thread Aggregate Design, Section 10).

---

# 8. Relationships

---

# Community → Workspace

Relationship:

```
Workspace

scopes

Discussion Thread
```

---

# Community → Workspace Access

Relationship:

```
Workspace Member

participates in

Discussion Thread
```

---

# Community → Learning Product / Learning Delivery

Relationship:

```
Learning Product or Lesson

may be the attached context of

Discussion Thread
```

---

# Community → Communication

Relationship:

```
Community Communication category (Communication Context, Section 9)

is realised by

Community Context's Discussion Threads
```

---

# Community → AI Context

Relationship:

```
AI Community Moderator (future capability)

may assist

Moderation
```

---

# 9. Community Lifecycle

```
Open

↓

Locked

↓

Archived
```

Matches the state machine defined in Discussion Thread Aggregate Design, Section 14.

---

# 10. Future Evolution

The Community Context should support:

## Reactions and Upvotes

Lightweight engagement signals on Comments.

---

## Cross-Workspace Public Community Spaces

Would require relaxing the platform's default assumption that every Discussion Thread belongs to exactly one Workspace (Discussion Thread Aggregate Design, INV-001).

---

## AI-Assisted Moderation

An "AI Community Moderator" capability, already named as a future direction in AI Context, Section 11, and in Discussion Thread Aggregate Design, Section 17.

---

# 11. Architectural Notes

The Community Context manages participatory discussion structure and moderation.

It should not manage:

- addressed or broadcast communication;
- learner identity or membership;
- the content of the Lessons or Learning Products a thread may be attached to.

Its responsibility is:

```
What is being discussed?

By whom?

Under what participation rules?

How is it kept safe and on-topic?
```
