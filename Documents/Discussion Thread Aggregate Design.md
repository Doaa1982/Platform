# Discussion Thread Aggregate Design

> Version: 1.0
>
> Status: Draft
>
> Domain: Community
>
> Aggregate: Discussion Thread
>
> Author: Business Analysis Team (drafted to close a documented gap — see Learning Workspace Architecture Gap Review)
>
> Related Documents:
>
> - Communication Context
> - Learning Workspace Bounded Context Identification
> - Workspace Aggregate Design
> - Platform Aggregate Catalogue

---

# 1. Overview

The Discussion Thread Aggregate represents a collaborative, multi-participant discussion within a Learning Workspace's Community capability.

Like Certificate, Discussion Thread appears in the Platform Aggregate Catalogue as an Aggregate Root under a "Community" bounded context that has never itself received business-analysis-level documentation. Community appears only as a placeholder context name in Learning Workspace Bounded Context Identification (Section 4) and as a handful of examples inside Learning Workspace Capability Model (Section 2, implicit) and the Domain Event Model's "Community Events" (Section 10: DiscussionCreated, CommentAdded, AnnouncementPublished). This document supplies the first dedicated Aggregate Design.

---

# 2. Vision

Discussion Thread answers:

> "What is being discussed, by whom, and where does it live?"

It is distinct from Message and Conversation (Communication Context, Sections 4.1–4.2), which represent private or small-group communication. Discussion Thread is the Community-facing, typically many-to-many equivalent — a public or semi-public thread visible to some scope of Workspace Members.

---

# 3. Responsibilities

The Discussion Thread Aggregate is responsible for:

- Maintaining thread identity and topic.
- Managing thread participation scope (who may view/post).
- Managing the ordered collection of Comments within the thread.
- Managing thread status (Open, Locked, Archived).
- Managing moderation state (flagged content, moderator actions).

The Discussion Thread Aggregate is **not** responsible for:

- Private Messages or Conversations (Communication Context, owned separately).
- Announcements, which are one-to-many broadcast rather than participatory discussion (Communication Context, Section 4.3 — a related but distinct concept).
- Learning content itself — a Discussion Thread may be *attached to* a Lesson or Learning Product context (e.g., a course discussion board) but does not own that content.

---

# 4. Aggregate Root

```text
DiscussionThread
```

DiscussionThread is the Aggregate Root. It owns its Comments as child entities within its own transactional boundary, since Comments are tightly coupled to the thread's ordering and moderation state and are not independently referenced by other aggregates.

---

# 5. Aggregate Structure

```text
Discussion Thread (Aggregate Root)

├── Thread Metadata
├── Participation Scope
├── Comments
│      └── Comment (Entity)
├── Thread Status
└── Moderation State
```

---

# 6. Aggregate Responsibilities

The Discussion Thread Aggregate owns: thread identity, participation scope, the ordered Comment collection, status, and moderation state.

It does not own: Workspace identity, Membership, or the Learning Product/Lesson a thread may be contextually attached to (referenced by identifier only).

---

# 7. Entities

## Comment

Represents one contribution to the thread.

Each Comment has:

- Comment Id
- Author MembershipId
- Content
- Posted At
- Parent Comment Id (optional, for threaded replies)
- Status (Visible, Flagged, Removed)

---

# 8. Value Objects

## Thread Metadata

Contains: Title, Description, Created By (MembershipId), Created At, Context Reference (optional — e.g., a LessonId or LearningProductId this thread is attached to).

## Participation Scope

Contains: Visibility (Workspace-wide, Learning-Product-scoped, Cohort-scoped), Posting Permission (Open, Moderated, Read-Only).

## Moderation State

Contains: Flag Count, Last Moderated At, Moderated By.

---

# 9. Aggregate Relationships

```text
Workspace

↓

Discussion Thread

├── (optionally attached to)  →  Learning Product / Lesson

└── Comments (owned entities, authored by Membership references)
```

---

# 10. Relationship to Message, Conversation, and Announcement — the Core Distinction

```text
Message / Conversation (Communication Context):  private or small-group, addressed communication
Announcement (Communication Context):             one-to-many broadcast, non-participatory
Discussion Thread (Community):                    many-to-many, participatory, typically public within Workspace scope
```

This distinction was previously implicit — Communication Context's "Community Communication" category (Section 9) gestures at "Events, Discussions, Announcements" without separating ownership. This document establishes that Discussion Thread, while adjacent to Communication Context, belongs to the separate Community bounded context, consistent with its placement in the Platform Aggregate Catalogue and Bounded Context Identification's context list (which already lists Community Context separately from Communication Context, Section 4).

---

# 11. Domain Events

- DiscussionThreadCreated
- CommentAdded
- CommentRemoved
- CommentFlagged
- ThreadLocked
- ThreadArchived
- ThreadModerated

`DiscussionCreated`, `CommentAdded`, and `AnnouncementPublished` are already referenced in the Learning Workspace Domain Event Model, Section 10 (`AnnouncementPublished` belongs to Communication Context's Announcement, not this Aggregate — included there for completeness only).

---

# 12. Commands

- CreateDiscussionThread
- PostComment
- RemoveComment
- FlagComment
- LockThread
- ArchiveThread
- ModerateThread

---

# 13. Business Invariants

## INV-001

Every Discussion Thread belongs to exactly one Workspace.

---

## INV-002

Every Comment belongs to exactly one Discussion Thread and references exactly one authoring Membership.

---

## INV-003

Comments cannot be posted to a Locked or Archived thread.

---

## INV-004

A Discussion Thread's Participation Scope determines visibility and posting rights; enforcement of Membership-level eligibility against that scope is evaluated at read/write time, not cached on the thread.

---

## INV-005

Removing a Comment preserves an audit trail (soft removal, Status = Removed) rather than physically deleting it, consistent with the platform's general preference for preserving historical records (see Assessment Context, Rule 2, applied here by analogy).

---

# 14. State Machine

```text
Open

↓

Locked

↓

Archived
```

---

# 15. Aggregate References

The Discussion Thread Aggregate references other aggregates only by identifier: WorkspaceId, Context Reference (optional LessonId/LearningProductId), and each Comment's Author MembershipId.

---

# 16. Architectural Rationale

Discussion Thread owns its Comments internally (rather than modeling Comment as its own Aggregate Root) because Comments have no independent lifecycle or cross-aggregate reference need outside their parent thread — unlike, for example, Submission, which needed independence from Assessment precisely because of its own high-frequency, independently-referenced lifecycle (Assessment and Submission Aggregate Design, Section 17). Keeping Comment as a child entity avoids unnecessary aggregate proliferation for a genuinely small, tightly-coupled collection.

---

# 17. Future Evolution

- Reactions/upvotes on Comments.
- Cross-Workspace public community spaces (would require relaxing INV-001).
- AI-assisted moderation (AI Context, Section 4.4's "AI Assessment Assistant" role has a loose analogue here — a future "AI Community Moderator," already named in AI Context, Section 11).

---

# Summary

The Discussion Thread Aggregate is the authoritative owner of participatory, many-to-many Community discussion within a Workspace, distinct from Communication Context's private Messages/Conversations and broadcast Announcements. This document gives Community its first formal specification, closing another gap from Assessment & Submission Aggregate Design, Section 17.