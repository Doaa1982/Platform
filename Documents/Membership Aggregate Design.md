# Membership Aggregate Design

> Version: 1.0
>
> Status: Draft
>
> Domain: Workspace Access
>
> Aggregate: Membership
>
> Author: Business Analysis Team (drafted to close a documented gap — see Learning Workspace Architecture Gap Review)
>
> Related Documents:
>
> - Workspace Access Context
> - Identity & Workspace Access Architecture
> - Workspace Aggregate Design
> - Enrollment Aggregate Design
> - Platform Aggregate Catalogue

---

# 1. Overview

The Membership Aggregate represents the formal business relationship between an Identity and a Workspace — the record that authorizes a person to participate in, and hold roles within, one specific Workspace.

Workspace Access Context has previously documented Membership only at the bounded-context and business-architecture level (Workspace Access Context; Identity & Workspace Access Architecture, Section II). This document supplies the missing aggregate-level design — root, entities, value objects, invariants, state machine — following the same pattern already applied to Workspace, Learning Product, and Enrollment.

---

# 2. Vision

Membership answers:

> "Who belongs to this Workspace, and what can they do inside it?"

It is the second link in the platform's primary dependency chain (Platform Aggregate Catalogue, Section 5: Identity → **Membership** → Workspace → ...). A Membership converts a globally authenticated Identity into a locally authorized participant in exactly one Workspace, carrying that Workspace's roles, permissions, and status — while Identity itself remains entirely untouched by anything that happens here.

---

# 3. Responsibilities

The Membership Aggregate is responsible for:

- Recording the relationship between one Identity and one Workspace.
- Managing Membership status and its lifecycle (Section 15).
- Managing Workspace-scoped roles assigned to the Member.
- Managing Workspace-scoped permissions derived from role and Workspace policy.
- Managing Membership-level preferences (notification settings, display name within this Workspace, if distinct from Global Profile).
- Recording how the Membership originated (via Invitation, direct creation, etc.).

The Membership Aggregate is **not** responsible for:

- Authentication or credentials (Identity Aggregate).
- Global profile, reputation, or professional history (Identity Aggregate, per Identity & Workspace Access Architecture Section III).
- Enrollment into specific Learning Products (Enrollment Aggregate — Membership is a precondition for Enrollment, not a container of it).
- Workspace existence, ownership, or configuration (Workspace Aggregate — Membership only references Workspace, and may itself be referenced *as* the Workspace's Owner via Workspace's own Ownership Record).
- Invitations and Onboarding Requests prior to Membership's own creation (separate entities within Workspace Access Context, referenced but not owned here — see Section 11).

---

# 4. Aggregate Root

```text
Membership
```

Membership is the Aggregate Root. It references exactly one Identity and belongs to exactly one Workspace, and is referenced by identifier from Enrollment, Learning Product (Author), Lesson Revision (Author), Assignment, Submission, and Workspace's own Ownership Record.

---

# 5. Aggregate Structure

```text
Membership (Aggregate Root)

├── Membership Status
├── Workspace Roles
├── Permissions
├── Membership Metadata
└── Membership Preferences
```

---

# 6. Aggregate Responsibilities

The Membership Aggregate owns:

- membership status and its transitions
- role assignment within the Workspace
- derived permissions
- membership-level preferences
- membership origin metadata

It does not own:

- Identity, credentials, or global profile
- Enrollment records
- Workspace identity, ownership designation logic, or configuration (Membership only supplies the MembershipId that Workspace's Ownership Record points to; Workspace itself decides who its current owner is)
- Invitations or Onboarding Requests as their own lifecycle objects

---

# 7. Entities

## Workspace Role

Represents one role assignment held by this Membership within its Workspace.

Each Workspace Role has:

- Role Id
- Role Name (Owner, Administrator, Teacher, Assistant Teacher, Learner, Parent, Finance Manager, etc. — per Workspace Access Context, Section 4.4)
- Assigned At
- Assigned By (MembershipId of the actor who assigned it, when applicable)

A Membership may hold more than one Workspace Role simultaneously (Workspace Access Context, Section 11, "Multiple Roles" — Future scope for some combinations, already implicitly supported here as an entity collection).

---

# 8. Value Objects

## Membership Status

Values, per Identity & Workspace Access Architecture, Section II:

- Pending
- Active
- Suspended
- Archived
- Removed

---

## Permissions

Derived from Membership + Role + Workspace Policies (Workspace Access Context, Section 9). Represented here as the resolved, effective permission set for this Membership — not independently authored, but computed and cached against role and policy changes.

---

## Membership Metadata

Contains:

- Origin (Invitation, Direct Creation, Bulk Import — future)
- Created At
- Last Active At

---

## Membership Preferences

Contains:

- Notification Preferences (Workspace-scoped)
- Display Name (Workspace-scoped override of Global Profile name, optional)

---

# 9. Aggregate Relationships

```text
Identity

↓ (referenced by)

Membership

↓ (belongs to)

Workspace

↓ (precondition for)

Enrollment
```

---

# 10. Relationship to Identity and Enrollment — the Core Distinction

Restated at the aggregate level, consistent with Workspace Aggregate Design, Section 10, and Enrollment Aggregate Design, Section 10:

```text
Identity answers:            "Who is this person, globally?"
Membership answers:          "Does this person belong to this Workspace, with what role?"
Enrollment answers:          "Is this Member registered for this specific Learning Product?"
```

- Membership references Identity by identifier only (IdentityId) and never embeds or duplicates credential or profile data (Identity & Workspace Access Architecture, BR-MB-002, BR-MB-003).
- A Membership may exist with zero Enrollments (Enrollment Aggregate Design, Section 10) — joining a Workspace does not imply registering for any Learning Product.
- Removing a Membership never removes the underlying Identity (BR-MB-004); it also does not retroactively delete historical Enrollment records tied to that Membership (Enrollment Aggregate Design, INV-007), though it does suspend the Member's forward-looking access.

---

# 11. Relationship to Invitation and Onboarding Request

Invitation and Onboarding Request (Workspace Access Context, Sections 4.5–4.6) precede Membership's own existence and are modeled as separate objects within Workspace Access Context rather than as entities of the Membership Aggregate itself — Membership is *created* as the outcome of a successful Invitation-acceptance-and-Identity-Resolution sequence (Identity & Workspace Access Architecture, Section II lifecycle), but does not own or reference the Invitation or Onboarding Request going forward once created.

---

# 12. Domain Events

Representative events include:

- MembershipCreated
- MembershipActivated
- MembershipRoleAssigned
- MembershipRoleRemoved
- MembershipStatusChanged
- MembershipSuspended
- MembershipReinstated
- MembershipArchived
- MembershipRemoved
- MembershipPreferencesUpdated

`WorkspaceMembershipCreated`, `WorkspaceMembershipActivated`, `WorkspaceMembershipSuspended`, and `WorkspaceMembershipRemoved` are already referenced in Identity & Workspace Access Architecture, Section VII; the remainder are added here for full Aggregate event coverage.

---

# 13. Commands

- CreateMembership
- ActivateMembership
- AssignRole
- RemoveRole
- SuspendMembership
- ReinstateMembership
- ArchiveMembership
- RemoveMembership
- UpdateMembershipPreferences

---

# 14. Business Invariants

## INV-001

Every Membership belongs to exactly one Workspace and references exactly one Identity (Identity & Workspace Access Architecture, WA-301, WA-302).

---

## INV-002

Membership status transitions must follow the defined state machine (Section 15). Illegal transitions (e.g., Pending directly to Archived without passing through Active or Removed) are rejected.

---

## INV-003

A Membership cannot be created without a resolved Identity (Identity Resolution must complete first — Identity & Workspace Access Architecture, WA-201).

---

## INV-004

Removing a Membership never removes the referenced Identity (BR-MB-004).

---

## INV-005

A Workspace Role held by a Membership is scoped entirely to that Membership's own Workspace; it confers no permission in any other Workspace (Workspace Access Context, Rule 1).

---

## INV-006

If a Membership is currently designated as its Workspace's Owner (per Workspace Aggregate Design, Ownership Record), that Membership cannot be suspended, archived, or removed until ownership has first been transferred (Workspace Aggregate Design, INV-005).

---

# 15. State Machine

```text
Pending

↓

Active

↓

Suspended

↓

Active (reinstated)


Active or Pending

↓

Archived


Active

↓

Removed
```

Per Identity & Workspace Access Architecture, Section II ("Membership States") and Workspace Access Context, Section 4.2 ("Rule 3 — Membership Must Have a Lifecycle").

---

# 16. Aggregate References

The Membership Aggregate references other aggregates only by identifier:

- IdentityId
- WorkspaceId

---

# 17. Architectural Rationale

Membership is separated from Identity for the platform's most foundational reason (Identity & Workspace Access Architecture, GP-001–GP-003): Identity is global, permanent, and platform-owned; Membership is local, Workspace-scoped, and revocable without affecting the person's global standing. It is separated from Enrollment for the same reason Workspace is separated from Learning Product (Learning Product Aggregate Design, Section 18) — participation in a business (Workspace) is a distinct, lower-commitment fact than registration in one of its specific offerings (Learning Product, via Enrollment).

---

# 18. Future Evolution

- Multiple simultaneous roles with combined permission resolution (Workspace Access Context, Section 11).
- Temporary/guest roles with automatic expiry.
- Family account structures (a Parent Membership linked to multiple Learner Memberships).
- Organization-sponsored bulk Membership creation.

---

# Summary

The Membership Aggregate is the authoritative owner of the relationship between a global Identity and a specific Workspace — status, roles, and permissions — completing the second link in the platform's primary dependency chain and closing one more gap identified in Assessment & Submission Aggregate Design, Section 17.