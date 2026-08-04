# AI Collaboration Session Aggregate Design

> Version: 1.0
>
> Status: Draft
>
> Domain: Artificial Intelligence
>
> Aggregate: AI Collaboration Session
>
> Author: Business Analysis Team (drafted to close a documented gap — see Learning Workspace Architecture Gap Review)
>
> Related Documents:
>
> - AI Collaboration Architecture
> - AI Business Context Architecture
> - AI Capability Architecture
> - AI Authoring Assistant Architecture
> - Lesson Revision Aggregate Design
> - Platform Aggregate Catalogue

---

# 1. Overview

The AI Collaboration Session Aggregate represents the business interaction between a user and AI while completing a specific task, as defined narratively in AI Collaboration Architecture. Unlike Certificate and Discussion Thread, this Aggregate's *behavior* is already extensively documented (AI Collaboration Architecture, in full) — what has been missing is the aggregate-design formalization: root, entities, value objects, and invariants, in the structural form used elsewhere in the corpus. This document supplies that formalization without re-deriving the business rationale already well established in AI Collaboration Architecture.

---

# 2. Vision

An AI Collaboration Session answers:

> "What business task is this user and AI working on together, right now?"

Per AI Collaboration Architecture, Section 6, a session exists only for the duration of the work being performed and coordinates multiple AI Capabilities (AI Capability Architecture) toward a single business objective, while consuming AI Business Context (AI Business Context Architecture) and never bypassing user authority over the outcome.

---

# 3. Responsibilities

The AI Collaboration Session Aggregate is responsible for:

- Maintaining session identity and its lifecycle (Started → Active → Completed, per AI Collaboration Architecture, Section 6).
- Recording which AI Capabilities were invoked during the session.
- Recording generated Recommendations and their individual review lifecycle (AI Collaboration Architecture, Section 10).
- Maintaining Collaboration State (current task, accepted/rejected/pending recommendations, generated assets — AI Collaboration Architecture, Section 13).
- Referencing the Business Context it was assembled against (AI Business Context Architecture, Section 5).

The AI Collaboration Session Aggregate is **not** responsible for:

- Owning the business data it helps produce — a generated Lesson Revision, Learning Activity, or Assessment remains owned by its respective Aggregate once accepted (AI Collaboration Architecture, AICOL-BR-003; I-Assisted Learning Content Lifecycle, Section 4, "Domain Ownership Model").
- Defining AI Capabilities themselves (AI Capability Architecture — Session orchestrates, does not define, capabilities).
- Long-term AI Memory or Workspace AI Profile configuration (AI Context, Sections 5.2 and 5.4 — Session is task-scoped and short-lived; Memory and Profile are Workspace/learner-scoped and persistent).

---

# 4. Aggregate Root

```text
AICollaborationSession
```

AICollaborationSession is the Aggregate Root. It references, by identifier, the Identity/Membership initiating it, the Workspace it operates within, and optionally a Lesson, Assessment, or other business object it is currently working against (Platform Aggregate Catalogue, Section 7 — "AI Collaboration Session... LessonId, AssessmentId").

---

# 5. Aggregate Structure

```text
AI Collaboration Session (Aggregate Root)

├── Session Metadata
├── Business Context Snapshot Reference
├── Capability Invocations
│      └── Capability Invocation (Entity)
├── Recommendations
│      └── Recommendation (Entity)
└── Collaboration State
```

---

# 6. Aggregate Responsibilities

The AI Collaboration Session Aggregate owns: session identity, lifecycle, the record of which capabilities were invoked and when, the collection of Recommendations generated and their individual accept/reject/edit history, and current Collaboration State.

It does not own: the underlying business data referenced or eventually produced (Lesson Revision, Learning Activity, Assessment, etc.), AI Capability definitions, or persistent AI Memory/Workspace AI Profile.

---

# 7. Entities

## Capability Invocation

Represents one invocation of an AI Capability (AI Capability Architecture, Section 5) within this session.

Each Capability Invocation has:

- Invocation Id
- Capability Id (e.g., "Generate Transcript," "Suggest Learning Objectives")
- Requested At
- Completed At
- Result Reference (pointer to the generated Recommendation, if any)

Per AI Capability Architecture, Section 17 ("Capability Lifecycle").

---

## Recommendation

Represents one discrete AI-generated contribution offered for user review.

Each Recommendation has:

- Recommendation Id
- Type (Suggested Content, Suggested Improvement, Instructional Advice, Assessment Recommendation, Accessibility Recommendation, Translation Suggestion, Quality Review — per AI Collaboration Architecture, Section 11)
- Generated At
- Status (Requested, Generated, Presented, Reviewed, Accepted, Rejected, Edited, Regenerated — per AI Collaboration Architecture, Section 10)
- Content Reference (the generated content itself, or a pointer to it)

---

# 8. Value Objects

## Session Metadata

Contains: Task Description (the business goal, e.g., "Creating a lesson"), Started At, Ended At (nullable), Initiating MembershipId.

## Business Context Snapshot Reference

A reference to the assembled AI Business Context (AI Business Context Architecture, Section 5) at session start — Identity, Workspace, Membership, Learning Product, Lesson, Assessment, Curriculum, Policies context, per that document's model. Per AIBC-002, this is assembled by the platform, not manually by the user, and is treated here as a reference/snapshot rather than data this Aggregate owns independently.

## Collaboration State

Contains: Current Task, Pending Suggestion Count, Accepted Recommendation Ids, Rejected Recommendation Ids, Active Lesson/Assessment Reference (AI Collaboration Architecture, Section 13).

---

# 9. Aggregate Relationships

```text
Membership (initiator)

↓

AI Collaboration Session

├── Capability Invocations  →  AI Capability (AI Capability Architecture — definitions, not owned here)

├── Recommendations  →  (once Accepted) →  Lesson Revision / Learning Activity / Assessment (ownership transfers per AICOL-BR-003)

└── Business Context Snapshot Reference  →  Workspace, Learning Product, Lesson, Assessment (referenced, not owned)
```

---

# 10. Relationship to Business Aggregates — the Core Distinction

```text
AI Collaboration Session answers:   "What is AI and the user working on, right now, together?"
Lesson Revision / Assessment etc.:  "What is the resulting, owned business content?"
```

This is the same ownership-transfer pattern already stated narratively across AI Collaboration Architecture (AICOL-BR-003), AI Authoring Assistant Architecture (AIA-002, AIA-005), and I-Assisted Learning Content Lifecycle (Section 4) — restated here as a formal invariant (Section 13, INV-004) because none of those documents previously expressed it as an aggregate-level rule. An AI Collaboration Session may generate a Recommendation whose content, once Accepted, becomes indistinguishable from manually authored content inside the owning Aggregate (e.g., a Lesson Revision's Section); the Session retains only a historical record that AI contributed it, not ongoing ownership.

---

# 11. Domain Events

- AICollaborationSessionStarted
- AICollaborationSessionCompleted
- AICapabilityRequested (AI Capability Architecture, Section 19)
- AIRecommendationGenerated
- AIRecommendationAccepted
- AIRecommendationRejected
- AIRecommendationEdited
- AIRecommendationRegenerated
- AICollaborationContextUpdated

All already referenced in AI Collaboration Architecture, Section 18, and AI Capability Architecture, Section 19; consolidated here for Aggregate-level completeness.

---

# 12. Commands

- StartAICollaborationSession
- RequestAICapability
- ReviewRecommendation
- AcceptRecommendation
- RejectRecommendation
- EditRecommendation
- RegenerateRecommendation
- UpdateCollaborationContext
- CloseAICollaborationSession

---

# 13. Business Invariants

## INV-001

Every AI Collaboration Session references exactly one initiating Membership and exactly one Workspace (AI Business Context Architecture, AIBC-004 — context never crosses Workspace boundaries).

---

## INV-002

Every AI capability invocation within a session must pass Permission Validation before Business Context is assembled and the capability is executed (AI Capability Architecture, Section 17; AI Business Architecture, AI-BR-001, AI-BR-006).

---

## INV-003

A Recommendation never becomes permanent business content until explicitly Accepted or Applied by the user (AI Collaboration Architecture, Section 10; AI-003).

---

## INV-004

Once a Recommendation is Accepted, ownership of the resulting content transfers to the target business Aggregate (Lesson Revision, Learning Activity, Assessment, etc.); the AI Collaboration Session retains a historical reference to the Recommendation but no ongoing ownership or edit rights over the accepted content (AICOL-BR-003).

---

## INV-005

AI never publishes or finalizes business content directly; the final business action (e.g., publishing a Lesson Revision) always belongs to a user-issued command outside this Aggregate's own command set, unless Workspace policy has explicitly configured automation (AI-BR-005, AIA-006).

---

## INV-006

A session's Business Context Snapshot Reference never exposes information the initiating Identity is not authorized to access (AIBC-003).

---

# 14. State Machine

```text
Started

↓

Active

↓

Completed
```

Per AI Collaboration Architecture, Section 6. "Active" persists across multiple Capability Invocations and Recommendation review cycles (Section 9, "Collaboration Scope") until the business task is completed or abandoned (AICOL-BR-006).

---

# 15. Aggregate References

The AI Collaboration Session Aggregate references other aggregates only by identifier: MembershipId, WorkspaceId, and optionally LessonId / AssessmentId / LearningProductId, per the Platform Aggregate Catalogue's Section 7 reference list for this aggregate.

---

# 16. Architectural Rationale

AI Collaboration Session is kept separate from every business Aggregate it touches for the same reason stated across AI Business Architecture and AI Collaboration Architecture repeatedly: "Capabilities do not own business data" (AIC-005) and "AI never bypasses the user's authority" (AICOL-002). Making Session its own Aggregate Root — rather than embedding collaboration state inside, say, Lesson Revision — keeps the AI orchestration concern (which capabilities ran, what was suggested, what was decided) fully separable from the instructional-content concern that Lesson Revision already owns, mirroring the same reasoning that keeps Submission separate from Assessment (Assessment and Submission Aggregate Design, Section 17).

---

# 17. Future Evolution

Per AI Collaboration Architecture, Section 20: multi-educator collaborative sessions, cross-domain sessions, specialized assistants sharing one session, real-time collaborative authoring, and Workspace-defined collaboration policies — all of which would extend this Aggregate's Collaboration State and Capability Invocation entity without altering its core structure.

---

# Summary

The AI Collaboration Session Aggregate is the authoritative owner of one bounded episode of human-AI collaboration — which capabilities were invoked, what was recommended, and what the user decided — while explicitly never owning the resulting business content itself, which transfers to its proper Aggregate upon acceptance. This document completes the aggregate-level specification for AI Context's own listed Aggregate Root, closing the last of the six gaps identified in Assessment & Submission Aggregate Design, Section 17.

With this document, every Aggregate Root listed in the Platform Aggregate Catalogue (Section 3) — Identity, Workspace, Membership, Learning Product, Curriculum, Enrollment, Learning Asset, Lesson, Lesson Revision, Assessment, Submission, Certificate, Discussion Thread, and AI Collaboration Session — now has a corresponding, structurally consistent Aggregate Design document.
