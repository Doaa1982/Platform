# Workspace Aggregate Design

> Version: 1.0
>
> Status: Draft
>
> Domain: Workspace Management
>
> Aggregate: Workspace
>
> Author: Business Analysis Team (drafted to close a documented gap — see Learning Workspace Architecture Gap Review)
>
> Related Documents:
>
> - Workspace Context
> - Identity & Workspace Access Architecture
> - Workspace Access Context
> - Learning Product Aggregate Design
> - Learning Workspace Domain Language & Business Ontology
> - Learning Workspace Experience Architecture
> - Platform Aggregate Catalogue

---

# 1. Overview

The Workspace Aggregate represents the existence, identity, and configuration boundary of an independent Learning Workspace — the primary tenant entity of the platform.

Workspace Context has, until now, been documented only at the bounded-context / business-capability level (Workspace Context, this corpus). The Platform Aggregate Catalogue lists **Workspace** as an Aggregate Root and positions it as the second link in the platform's primary dependency chain (Section 5: Identity → Membership → **Workspace** → Learning Product → ...), but no aggregate-level design — root, entities, value objects, invariants, state machine — has previously existed for it. This document closes that gap, following the same pattern already applied to Learning Product, Enrollment, Curriculum, Learning Asset, and Lesson Revision.

Of the six Aggregate Roots identified as still missing formal Aggregate Design documents (Assessment & Submission Aggregate Design, Section 17, Summary), Workspace is addressed first because every other undocumented root — Membership, Certificate, Discussion Thread, AI Collaboration Session — as well as every aggregate already documented, ultimately depends on it. Identity, while equally foundational, already has extensive aggregate-level treatment inside Identity & Workspace Access Architecture (Section IX defines its Aggregate Ownership, lifecycle, and entity model in detail); Workspace does not have an equivalent, despite being referenced constantly throughout the corpus as the tenancy root.

---

# 2. Vision

A Workspace answers:

> "What is this independent educational business, and what are its boundaries?"

It is the tenant boundary of the entire platform. Every Membership, Learning Product, Learning Asset, AI configuration, and piece of Commerce activity exists inside exactly one Workspace and is invisible to every other Workspace (Workspace Context, Rule 1 — Workspace Isolation).

The Workspace Aggregate is intentionally narrow, matching the discipline already applied to Learning Product and Enrollment: it owns identity, ownership, lifecycle, and the boundary of configuration — not the content, members, or products that live inside that boundary. A Workspace can exist, be named, be owned, and be configured before it has a single Member, Learning Product, or piece of content.

---

# 3. Responsibilities

The Workspace Aggregate is responsible for:

- Maintaining Workspace identity (name, public identifier, description).
- Maintaining Workspace ownership (exactly one Workspace Owner at a time — see Section 10).
- Managing the Workspace's own lifecycle (Section 15).
- Managing Workspace-level configuration (language, timezone, regional settings, default behaviors, enabled capabilities).
- Managing the Workspace's branding configuration boundary (which specific brand assets are attached — the assets themselves may be simple value objects owned here, per Workspace Context Section 3.3, "Workspace Identity... Brand design belongs to the Experience domain" for anything beyond configuration values).
- Managing Workspace Entry Point registration (which domains/subdomains resolve to this Workspace — see Identity & Workspace Access Architecture, Section V).
- Managing which platform capabilities are enabled for this Workspace (per subscription tier, maturity level, or explicit configuration).

The Workspace Aggregate is **not** responsible for:

- Individual person identity or credentials (Identity Aggregate).
- Membership relationships, roles, invitations, or onboarding (Membership Aggregate / Workspace Access Context).
- Learning Products, Curricula, Lessons, or any instructional content (Learning Product, Curriculum, Lesson, Lesson Revision Aggregates).
- Learning Assets (Learning Asset Aggregate).
- Commerce — pricing, orders, payments, revenue (Commerce Context).
- AI behavior configuration details beyond the boundary flag of "AI enabled" — the AI Workspace Profile itself (teaching style, feedback style, knowledge sources) is owned by AI Context (AI Context, Section 5.2).
- Communication content or history (Communication Context).

---

# 4. Aggregate Root

```text
Workspace
```

Workspace is the Aggregate Root. It owns its own identity, ownership record, lifecycle, and configuration boundary, and is referenced by identifier from every other aggregate in the platform — directly (Membership, Learning Product, Learning Asset) or transitively (Curriculum, Lesson, Enrollment, Assessment, Submission).

---

# 5. Aggregate Structure

```text
Workspace (Aggregate Root)

├── Workspace Identity
├── Ownership Record
├── Workspace Configuration
├── Branding Configuration
├── Entry Point Registry
├── Enabled Capabilities
└── Lifecycle State
```

Workspace is a shallow aggregate, consistent with the design discipline established for Learning Product and Enrollment (Learning Product Aggregate Design, Section 5; Enrollment Aggregate Design, Section 5). It is a tenancy and configuration root, not a container for the business activity that happens inside it.

---

# 6. Aggregate Responsibilities

The Workspace Aggregate owns:

- workspace identity and public identifier
- ownership (current Workspace Owner)
- lifecycle state
- configuration values (language, timezone, regional settings, pacing defaults)
- branding configuration values (logo reference, theme, color tokens, typography selection)
- registered Entry Points (domains, subdomains, invitation-link namespace)
- the set of platform capabilities currently enabled for this tenant

It does not own:

- Identity or credentials of any Person
- Membership records
- Learning Products, Curricula, Lessons, Learning Assets
- Commerce records
- AI behavioral configuration (only the "AI enabled" boundary flag)
- Communication content

Those belong to their respective aggregates and contexts, referenced here only by identifier or boundary flag.

---

# 7. Entities

## Entry Point

Represents a business endpoint through which a learner or Workspace Member enters this Workspace, per Identity & Workspace Access Architecture, Section V.

Each Entry Point has:

- Entry Point Id
- Entry Point Type (Custom Domain, Platform Subdomain, Invitation Link Namespace, Direct Workspace URL)
- Value (e.g., the domain string or subdomain slug)
- Status (Active, Pending Verification, Disabled)

A Workspace owns one or more Entry Points. Every Entry Point resolves to exactly one Workspace (Identity & Workspace Access Architecture, WE-003) — enforced here as INV-006 below.

> **Ownership boundary note:** Workspace Resolution itself — the *process* of matching an incoming request to a registered Entry Point — is owned by Workspace Access Context (Identity & Workspace Access Architecture, Section V, "Context Ownership" table). The Workspace Aggregate owns only the registry of Entry Points that process resolves against, not the resolution process itself.

---

## Enabled Capability

Represents one platform capability switched on or off for this Workspace, per Learning Workspace Capability Model and the maturity progression described in Learning Workspace Business Value Streams & Maturity Model (Section 10).

Each Enabled Capability has:

- Capability Id (referencing a capability from the Capability Model — e.g., "AI Content Intelligence," "Interactive Learning Authoring," "Team Management")
- Enabled (boolean)
- Enabled At

This is what allows a Workspace to progress through the Maturity Model levels (Solo Educator → Professional Tutor → Tutor Team → Academy → Educational Organisation) without changing the underlying Workspace Aggregate's structure — only which capabilities are switched on.

---

# 8. Value Objects

## Workspace Identity

Contains:

- Name
- Public Identifier (slug)
- Description
- Contact Information
- Visibility Setting (Private, Published)

Per Workspace Context, Section 3.3.

---

## Ownership Record

Contains:

- Owner MembershipId (the Membership, within this same Workspace, currently designated as owner)
- Ownership Assigned At

See Section 10 for the important distinction between this reference and Identity ownership.

---

## Workspace Configuration

Contains:

- Language Preference
- Timezone
- Regional Settings
- Default Pacing Model
- Default Learning Preferences

Per Workspace Context, Section 3.4.

---

## Branding Configuration

Contains:

- Logo Reference
- Theme
- Color Tokens
- Typography Selection
- Login Page Configuration Reference

Per Learning Workspace Experience Architecture, Section 13. Full brand *asset management* (file storage, versioning of uploaded logo files) may be delegated to Learning Asset Management Context in a future revision; today this value object holds configuration values and references only.

---

## Lifecycle State

One of the values defined in Section 15.

---

# 9. Aggregate Relationships

```text
Workspace

├── Ownership Record  →  Membership (this Workspace's own Owner Membership)

├── Entry Points  →  (resolved by Workspace Access Context's Workspace Resolution process)

├── (referenced by)  →  Membership (every Membership belongs to exactly one Workspace)

├── (referenced by)  →  Learning Product

├── (referenced by)  →  Learning Asset

└── (configures)  →  AI Workspace Profile (AI Context — boundary flag only, detail owned elsewhere)
```

Workspace sits at the root of the platform's primary dependency chain (Platform Aggregate Catalogue, Section 5): every other aggregate either references Workspace directly or is scoped by a Learning Product / Membership that itself references Workspace.

---

# 10. Relationship to Identity and Membership — the Core Distinction

This section states explicitly, at the aggregate level, a boundary that has previously existed only as narrative principle across Identity & Workspace Access Architecture and Workspace Context — mirroring the same treatment given to Membership vs Enrollment (Enrollment Aggregate Design, Section 10) and Learning Product vs Curriculum (Learning Product Aggregate Design, Section 10).

```text
Identity answers:

"Who is this person, globally, across every Workspace?"


Membership answers:

"Does this person belong to this Workspace, and with what role?"


Workspace answers:

"What is this independent educational business, and who owns it?"
```

- Workspace does **not** reference Identity directly. Ownership of a Workspace is expressed through a Membership (Ownership Record → Owner MembershipId), because the person who owns the Workspace must also be a Member of it — ownership is a role held via Membership, not a direct Identity-to-Workspace link. This is consistent with Identity & Workspace Access Architecture's Ownership Matrix (Section IX), which places "Membership" under Workspace ownership and "Identity" under Platform ownership, with no direct Identity-to-Workspace row.
- A Workspace may exist with a Draft lifecycle state before any Membership other than the Owner's exists (Section 15) — mirroring how a Learning Product may exist before an active Curriculum (Learning Product Aggregate Design, INV-004).
- Removing or deactivating a Membership never deletes the Workspace, and archiving a Workspace never deletes the underlying Identity of any person who held Membership in it (Identity & Workspace Access Architecture, BR-ID-004, BR-MB-004) — Workspace's own lifecycle (Section 15) is independent of any single Membership's lifecycle, including the Owner's, though INV-005 below requires ownership to be reassigned before an Owner's Membership can be removed.

---

# 11. Relationship to Learning Product

Learning Product Aggregate Design (Section 1) establishes that a Learning Product belongs to exactly one Workspace and depends only on Workspace in the primary dependency chain. This document confirms the inverse: Workspace does not own or embed any Learning Product data — it is referenced only via WorkspaceId held on the Learning Product side (Learning Product Aggregate Design, Section 17), consistent with AGG-003.

Enabled Capabilities (Section 7) determine whether certain Learning Product types or features are available to be created at all — e.g., a Workspace at the "Solo Educator" maturity level may not have the "Team Management" capability enabled, which indirectly constrains multi-author Learning Products, but this constraint is enforced by checking the Enabled Capability flag, not by Workspace owning any Learning Product data directly.

---

# 12. Relationship to AI Context

Per AI Context, Section 3 ("AI Is Workspace-Native") and Section 5.2 ("Workspace AI Profile"), AI behavior is configured per-Workspace. The Workspace Aggregate owns only the boundary flag (whether AI is enabled for this Workspace at all, via Enabled Capability) — the actual Workspace AI Profile (teaching style, feedback style, knowledge sources, allowed actions) is owned entirely by AI Context and referenced by WorkspaceId, following the same reference-by-identifier discipline applied to Commerce Reference on Learning Product (Learning Product Aggregate Design, Section 8).

---

# 13. Domain Events

Representative events include:

- WorkspaceCreated
- WorkspaceConfigured
- WorkspaceOwnershipTransferred
- WorkspaceBrandUpdated
- WorkspaceEntryPointRegistered
- WorkspaceEntryPointDisabled
- WorkspaceCapabilityEnabled
- WorkspaceCapabilityDisabled
- WorkspacePublished
- WorkspaceSuspended
- WorkspaceArchived

`WorkspaceCreated`, `WorkspaceConfigured`, `WorkspaceBrandUpdated`, `WorkspacePublished`, and `WorkspaceArchived` are already referenced in the Learning Workspace Domain Event Model (Section 3) and Identity & Workspace Access Architecture (Section VII); the remainder are added here to give the Aggregate full event coverage, particularly around ownership transfer and capability management, which were previously undocumented at the event level.

---

# 14. Commands

Representative commands include:

- CreateWorkspace
- UpdateWorkspaceIdentity
- TransferOwnership
- UpdateWorkspaceConfiguration
- UpdateBrandingConfiguration
- RegisterEntryPoint
- DisableEntryPoint
- EnableCapability
- DisableCapability
- PublishWorkspace
- SuspendWorkspace
- ArchiveWorkspace

---

# 15. State Machine

```text
Created

↓

Configuring

↓

Private

↓

Published

↓

Active

↓

Suspended

↓

Archived

↓

Deleted
```

This state machine reconciles the two slightly different lifecycle diagrams that previously existed independently — Workspace Context, Section 3.1 ("Created → Configuring → Active → Suspended → Archived → Deleted") and Learning Workspace Domain Language & Business Ontology, Section 4.2 ("Draft → Configuring → Private → Published → Active → Growing → Archived → Deleted"). This document adopts the more granular Ontology sequence as canonical for the Aggregate's formal state machine, since it distinguishes "Private" (configured but not yet publicly discoverable) from "Published" (publicly listed) — a distinction with real business consequence for Workspace Resolution (Identity & Workspace Access Architecture, Section V) that "Active" alone does not capture. "Growing" from the Ontology's version is treated as a business/maturity-model label (Learning Workspace Business Value Streams & Maturity Model, Section 10) rather than a distinct Aggregate lifecycle state, and is not included in the formal state machine above.

## What `Published → Active` means

> **Ruling (2026-08-05, Workspace Setup Business Analysis BA-002; Technical Debt Backlog TD-009):** this section justified splitting `Private` from `Published` but left `Active` without a stated meaning, which made the transition unimplementable except as a guess.

**`Active` is Owner-declared: the Workspace's Owner saying "we are open for business."** It is deliberately distinct from `Published`, which means only that the Workspace is publicly discoverable and resolvable by its Entry Points. Being findable and being open are different claims, and only the Owner can make the second one.

Two alternative readings were considered and rejected:

- **Automatic on publication** — would make `Active` carry no information `Published` does not already carry, leaving it vestigial. If the distinction ever proves worthless in practice, the correct response is to remove the state from this section, not to keep it as a no-op.
- **Driven by first real use** (a published Learning Product, or a first Enrollment) — would give `Active` real meaning, but at the cost of making Workspace depend on Learning Product and Enrollment, which Section 6 explicitly refuses.

Suspension, archival and deletion remain platform-driven and are not part of the Owner's lifecycle (Workspace Setup Business Analysis, Section 5).

---

# 16. Business Invariants

## INV-001

Every Workspace has exactly one Aggregate Root and exactly one identity.

---

## INV-002

Every Workspace has exactly one current Owner at any point in time (Workspace Context, Rule 2). Ownership may be transferred but never left unassigned.

---

## INV-003

The Workspace's designated Owner (Ownership Record → Owner MembershipId) must reference an Active Membership belonging to this same Workspace. A Workspace cannot designate an owner via a Membership belonging to a different Workspace.

---

## INV-004

A Workspace may exist in Created or Configuring state with zero Memberships other than the Owner's, zero Learning Products, and zero Entry Points registered.

---

## INV-005

Removing or suspending the Membership currently designated as Owner is not permitted unless ownership has first been transferred to another Active Membership within the same Workspace (TransferOwnership must precede or accompany any such removal).

---

## INV-006

Every registered Entry Point resolves to exactly one Workspace (Identity & Workspace Access Architecture, WE-003). No Entry Point value may be registered against more than one Workspace simultaneously.

---

## INV-007

A Workspace cannot transition to Published state without a complete Workspace Identity (Name and Public Identifier at minimum) and at least one registered, Active Entry Point.

---

## INV-008

Disabling a Capability does not delete data created while it was enabled (e.g., disabling "Team Management" does not delete existing Team records) — it only prevents new creation or access going forward. Data reconciliation on capability disablement is a policy decision left to the owning context (e.g., Team Management), not enforced by the Workspace Aggregate itself.

---

## INV-009

Archiving a Workspace does not delete Identities of Members who held Membership within it (Identity & Workspace Access Architecture, BR-ID-004), and does not delete historical Learning Product, Enrollment, or Commerce records — those retain independent lifecycles per their own aggregate designs, mirroring Learning Product Aggregate Design INV-007.

---

## INV-010

Workspace configuration and branding changes apply only within that Workspace's own Workspace Sessions and never affect any other Workspace (Identity & Workspace Access Architecture, BR-WS-004, BR-WS-005).

---

# 17. Aggregate References

The Workspace Aggregate references other aggregates only by identifier:

- Owner MembershipId

No external aggregate is embedded inside the Workspace Aggregate. Notably, Workspace does **not** hold a list of Membership, Learning Product, or Learning Asset identifiers — those aggregates each hold a WorkspaceId pointing back to their owning Workspace, consistent with AGG-003 and avoiding an unbounded, ever-growing collection inside the Workspace Aggregate itself.

---

# 18. Architectural Rationale

Separating Workspace from Membership, Identity, Learning Product, and AI configuration follows the same reasoning already established throughout this corpus:

- **Separate from Identity** — Identity is platform-owned, global, and lifelong; Workspace is tenant-owned and bounded. Conflating them would violate the platform's foundational separation (Identity & Workspace Access Architecture, GP-001 through GP-010) and make every Workspace deletion a threat to a person's global identity.
- **Separate from Membership** — following the same logic as Enrollment vs Membership (Enrollment Aggregate Design, Section 19): Workspace answers "does this business exist and who owns it," Membership answers "who belongs to it." A Workspace with zero non-owner Memberships is a valid, common state (a newly created Workspace before its first invitation is sent).
- **Separate from Learning Product** — following the same logic as Learning Product vs Curriculum (Learning Product Aggregate Design, Section 18): the tenancy boundary should be stable and creatable independently of any specific commercial offering existing inside it yet.
- **Separate from AI configuration detail** — Workspace owns only the boundary flag; the rich AI Workspace Profile changes independently and far more frequently than the tenancy identity itself, and is better owned by AI Context, which already models it (AI Context, Section 5.2).

This keeps Workspace small, stable, and the correct root reference point for every other aggregate in the platform — exactly as the Platform Aggregate Catalogue's dependency diagram (Section 5) already implies, but had not yet formalized at the aggregate-design level.

---

# 19. Future Evolution

The Workspace Aggregate supports future capabilities including:

- **Ownership transfer workflows with multi-party confirmation** — today TransferOwnership is modeled as a single command; future versions may require confirmation from both outgoing and incoming owners.
- **Multiple Entry Points per custom domain with SSL/verification state tracking** — the Entry Point entity's Status value is intentionally minimal today (Active, Pending Verification, Disabled) and may grow more detailed.
- **Organization-owned Workspaces** — where Ownership Record points to an Organization Portfolio relationship rather than a single Owner Membership (Identity & Workspace Access Architecture, Section III, "Organization Portfolio"), requiring INV-002 and INV-003 to be relaxed or extended.
- **Multi-branch / multi-site Workspaces** — referenced in Learning Workspace Business Value Streams & Maturity Model, Level 4/5, as a future capability that may require Workspace to reference sub-boundary entities.
- **Public-facing Academy as a concept separate from Workspace** — Learning Workspace Domain Language & Business Ontology's own "Future Evolution" note (Section 6) flags this as a possible future split, which would affect Workspace Identity's Visibility Setting and Entry Point Registry here.

---

# Summary

The Workspace Aggregate is the authoritative owner of the platform's fundamental tenancy boundary — identity, ownership, lifecycle, configuration, branding configuration, entry-point registration, and enabled-capability tracking for one independent Learning Workspace.

It deliberately owns none of the business activity that happens inside that boundary — Identity, Membership, Learning Products, Learning Assets, Commerce, and AI behavioral detail are all owned elsewhere and referenced only by identifier or boundary flag — following the same shallow-aggregate discipline already established by Learning Product, Enrollment, and Curriculum.

This closes another gap in the set identified in Assessment & Submission Aggregate Design (Section 17): of the six previously undocumented Aggregate Roots (Identity, Workspace, Membership, Certificate, Discussion Thread, AI Collaboration Session), Workspace — the root of the entire dependency chain — is now formally specified. Membership, Identity, Certificate, Discussion Thread, and AI Collaboration Session remain candidates for the same treatment.