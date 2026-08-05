# Tutor Workspace First-Time Experience Architecture

**Version:** 1.0  
**Status:** Draft  
**Domain:** Learning Workspace  
**Bounded Context:** Tutor Workspace  
**Audience:** Business Architects, Product Owners, UX Designers, Solution Architects, Engineering Teams

---

# 1. Purpose

This document defines the business architecture governing the first-time experience of a tutor entering a learning workspace after accepting a workspace provisioning invitation.

Its purpose is to transform a newly provisioned workspace member into a productive tutor while minimizing setup friction and ensuring every workspace is initialized consistently.

This architecture defines:

- business objectives
- business capabilities
- lifecycle
- onboarding stages
- business rules
- state transitions
- responsibilities

It intentionally avoids UI implementation details.

---

# 2. Scope

## Starts

After

- invitation accepted
- membership activated
- successful authentication
- workspace selected

## Ends

When the tutor enters the standard Tutor Workspace experience.

---

> **Note (2026-08-05):** "Starts" above is precisely where First Login Business Analysis ends —
> its Welcome screen is the hand-off point into this document's Stage 1. That document also
> establishes that Welcome is shown once per Workspace/Membership and bypassed on later visits
> (its Section 9), consistent with this document's own Section 13.
>
> **This document's lifecycle (Section 7, 11) is independent of, and runs in parallel with,
> Workspace Setup Business Analysis's `Created → Configuring → Private → Published → Active`
> publish lifecycle — the two are not the same state machine and "Ready to Teach" here does not
> imply Workspace status `Active` there, or vice versa.** A Workspace may sit in `Private` while
> its Owner has completed every stage below; an Owner may still be mid-onboarding while their
> Workspace is already `Published`. Nothing here should be read as replacing or sequencing
> against that document. See Technical Debt Backlog TD-015.
>
> Stage 4's specific resources (Course Library, Lesson Repository, Resource Library, Personal
> Calendar) are not yet modelled as aggregates elsewhere in the corpus, and this document does
> not map them onto the closest existing concepts (Curriculum Aggregate Design, Lesson Aggregate
> Design, Learning Asset Aggregate Design). "AI Workspace" is the exception — it corresponds to
> the AI Workspace Profile boundary flag already owned by Workspace Aggregate Design (§ referencing
> AI Context §5.2). Treat Stage 4 as target-state rather than buildable against the current
> domain model as written — see TD-015.

---

# 3. Business Objectives

The onboarding experience should:

- minimize time before teaching
- initialize the workspace consistently
- collect only missing information
- avoid duplicate data collection
- personalize the workspace
- prepare AI services
- create required default resources
- allow onboarding to resume after interruption

---

# 4. Business Principles

## 4.1 Progressive Enablement

A tutor should become productive as quickly as possible.

Only mandatory information should block progression.

Everything else should be configurable later.

---

## 4.2 Identity Before Workspace

Identity information belongs to the Identity Platform.

Workspace onboarding must reuse identity information rather than asking again.

---

## 4.3 Workspace-Specific Configuration

Personal information belongs to Identity.

Teaching preferences belong to the Workspace.

Examples

Identity

- Name
- Email
- Preferred Language

Workspace

- Biography
- Teaching Subjects
- Availability
- Teaching Preferences

---

## 4.4 Automatic Initialization

The platform creates all required workspace resources automatically.

Tutors should never need to manually create technical resources before teaching.

---

## 4.5 Resumable Experience

Every completed step is persisted.

If onboarding is interrupted, it resumes from the last completed stage.

---

# 5. Business Actors

## Primary

- Tutor

## Supporting

- Identity Platform
- Workspace Platform
- AI Assistant
- Workspace Provisioning Service
- Membership Service

---

# 6. Preconditions

The following conditions must already be satisfied.

- Invitation accepted
- Membership activated
- Workspace exists
- Tutor permissions assigned
- Authentication successful

---

# 7. High-Level Lifecycle

```
Invitation Accepted
        │
        ▼
Membership Activated
        │
        ▼
Authentication
        │
        ▼
Workspace Resolution
        │
        ▼
First Workspace Entry
        │
        ▼
Workspace Onboarding
        │
        ▼
Workspace Ready
        │
        ▼
Normal Tutor Experience
```

---

# 8. First-Time Experience Stages

The onboarding experience consists of business stages.

Each stage contributes to workspace readiness.

---

## Stage 1 — Welcome

Purpose

Introduce the tutor to the workspace.

Business Outcomes

- Workspace identified
- Tutor role confirmed
- Permissions confirmed

---

## Stage 2 — Workspace Profile Completion

Purpose

Collect only workspace-specific information.

Typical Information

- Profile photo
- Biography
- Teaching languages
- Public profile visibility

Identity information must never be requested again.

---

## Stage 3 — Teaching Preferences

Purpose

Initialize teaching-related preferences.

Examples

- Subjects
- Grade levels
- Teaching style
- Preferred lesson language
- Time zone
- Calendar preferences
- Meeting provider

---

## Stage 4 — Workspace Initialization

Purpose

Create required workspace resources.

Examples

- Personal Draft Space
- Course Library
- Lesson Repository
- Resource Library
- Personal Calendar
- AI Workspace
- Notification Preferences

Creation is automatic.

---

## Stage 5 — AI Personalization

Purpose

Prepare AI services for the tutor.

Examples

- Preferred teaching style
- Content generation defaults
- Assessment preferences
- Lesson generation preferences
- AI memory initialization

---

## Stage 6 — Guided Orientation

Purpose

Introduce major workspace capabilities.

Examples

- Dashboard
- Courses
- Students
- Calendar
- AI Assistant
- Resources

This stage is optional.

---

## Stage 7 — Ready to Teach

Purpose

Transition into productive work.

Typical next actions

- Create first course
- Import existing content
- Invite students
- Browse workspace

At this stage onboarding is complete.

---

# 9. Workspace Initialization Responsibilities

During onboarding the platform creates default resources.

Examples

| Resource | Created Automatically |
|-----------|----------------------|
| Personal Draft Area | Yes |
| Personal Course Library | Yes |
| Lesson Repository | Yes |
| AI Workspace | Yes |
| Personal Calendar | Yes |
| Notification Settings | Yes |

The tutor never manually provisions these resources.

---

# 10. Business Rules

## BR-001

Workspace onboarding executes once per workspace membership.

---

## BR-002

Joining another workspace starts a new onboarding process for that workspace.

---

## BR-003

Identity data is shared across all workspaces.

Workspace preferences are isolated per workspace.

---

## BR-004

Workspace initialization is idempotent.

Running initialization multiple times must not duplicate resources.

---

## BR-005

Optional stages may be skipped.

Skipped stages remain accessible later.

---

## BR-006

Mandatory stages must complete before the workspace enters the Ready state.

---

## BR-007

The onboarding state is persisted after every completed stage.

---

## BR-008

Platform upgrades may introduce new onboarding stages.

Completed tutors should only receive newly introduced stages when required.

---

# 11. State Model

```
Not Started
      │
      ▼
Welcome
      │
      ▼
Profile Completion
      │
      ▼
Teaching Preferences
      │
      ▼
Workspace Initialization
      │
      ▼
AI Initialization
      │
      ▼
Orientation
      │
      ▼
Completed
```

---

# 12. Failure Scenarios

The platform must support recovery from:

- browser closed
- authentication timeout
- network interruption
- workspace disabled
- membership revoked
- initialization failure
- AI initialization failure

The onboarding state must remain recoverable.

---

# 13. Completion Criteria

A tutor is considered fully onboarded when:

- mandatory profile information is complete
- teaching preferences are initialized
- workspace resources exist
- AI services are initialized
- onboarding status equals Completed

Subsequent logins bypass onboarding and navigate directly to the Tutor Workspace Home.

---

# 14. Related Architecture Documents

- Identity & Workspace Access Architecture
- Identity and Membership Architecture
- Learning Workspace Experience Architecture
- Workspace Provisioning Architecture
- Tutor Workspace Lifecycle Architecture *(future)*
- Learning Resource Architecture
- Course Lifecycle Architecture

---

# 15. Future Evolution

The onboarding architecture is designed to evolve without breaking existing tutors.

Future enhancements may include:

- AI-assisted onboarding
- Workspace templates
- Organization-specific onboarding policies
- Role-specific onboarding extensions
- Marketplace integrations
- Credential verification
- Teaching certification workflows