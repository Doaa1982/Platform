# Identity Aggregate Design

> Version: 1.0
>
> Status: Draft
>
> Domain: Identity
>
> Aggregate: Identity
>
> Author: Business Analysis Team (drafted to close a documented gap — see Learning Workspace Architecture Gap Review)
>
> Related Documents:
>
> - Identity & Workspace Access Architecture
> - Membership Aggregate Design
> - Workspace Aggregate Design
> - Platform Aggregate Catalogue

---

# 1. Overview

The Identity Aggregate represents the lifelong, platform-owned digital identity of a Person, independent of any Workspace.

Unlike the other five gaps identified in Assessment & Submission Aggregate Design (Section 17), Identity already has substantial aggregate-adjacent detail documented in Identity & Workspace Access Architecture — Section I defines its responsibilities, lifecycle, and business rules in depth, and Section IX provides an Aggregate Ownership table. This document does not restate that material wholesale; it reformats and completes it into the same Aggregate Design template used elsewhere in the corpus (root, entities, value objects, invariants, state machine), so Identity has a document structurally consistent with Workspace, Membership, Learning Product, and the rest.

---

# 2. Vision

Identity answers:

> "Who is this person, globally, across every Workspace they touch?"

It is the first link in the platform's primary dependency chain (Platform Aggregate Catalogue, Section 5). It is global, permanent, and platform infrastructure — never owned by, or dependent on, any individual Workspace (Identity & Workspace Access Architecture, GP-001, ID-102, ID-103).

---

# 3. Responsibilities

The Identity Aggregate is responsible for:

- Maintaining the Person's global, unique digital identity.
- Managing Credentials (Section 7).
- Managing the Global Profile (name, date of birth, preferred language, country, timezone, avatar, accessibility preferences).
- Managing Verification status.
- Managing Professional Identity, Reputation, and Professional History (Section III of Identity & Workspace Access Architecture — summarized here, not restated in full).

The Identity Aggregate is **not** responsible for:

- Workspace-specific roles, permissions, or status (Membership Aggregate).
- Learning progress, enrollments, or any Workspace-scoped educational data.
- Workspace branding or configuration.

---

# 4. Aggregate Root

```text
Identity
```

Identity is the Aggregate Root. It is referenced by identifier from Membership (IdentityId) and, indirectly, from every Workspace-scoped aggregate that traces authorship or actorship back through a Membership.

---

# 5. Aggregate Structure

```text
Identity (Aggregate Root)

├── Credentials
├── Global Profile
├── Verification
├── Professional Profile
└── Reputation
```

---

# 6. Aggregate Responsibilities

The Identity Aggregate owns: credentials, global profile, verification status, professional profile, reputation, professional history, and public presence (Identity & Workspace Access Architecture, Section III — "Professional Growth Model").

It does not own: Workspace Membership, roles, permissions, enrollments, or any Workspace-scoped data (ID-101–ID-105; the Ownership Matrix in Identity & Workspace Access Architecture, Section IX).

---

# 7. Entities

## Credential

Represents one authentication mechanism belonging to this Identity.

Each Credential has:

- Credential Id
- Credential Type (Email & Password, Google, Microsoft, Apple)
- Status (Active, Revoked)
- Registered At

Per Identity & Workspace Access Architecture, Section 3. An Identity may hold multiple Credentials (ID-203).

---

## Achievement

Represents one verified professional milestone, per Identity & Workspace Access Architecture, Section III.4.

Each Achievement has:

- Achievement Id
- Type (Course completion, Certification, Teaching milestone, etc.)
- Awarded At
- Source Workspace (reference only — the contributing Workspace, though the Achievement itself is Identity-owned per PG-001)

---

# 8. Value Objects

## Global Profile

Contains: Name, Date of Birth, Preferred Language, Country, Timezone, Avatar, Accessibility Preferences (Identity & Workspace Access Architecture, Section 4).

## Verification

Contains: Verification Type, Status, Verified At (Section 7 of Identity & Workspace Access Architecture).

## Professional Profile

Contains: Biography, Teaching Philosophy, Areas of Expertise, Languages, Skills, Qualifications (Section III.1).

## Reputation

Contains: aggregated trust signals — reviews, ratings, endorsements (Section III.5). Reputation is computed from evidence contributed by multiple Workspaces but owned and stored centrally here (PG-005).

---

# 9. Aggregate Relationships

```text
Person

↓

Identity

↓ (referenced by)

Membership (one per Workspace joined)
```

---

# 10. Relationship to Membership — the Core Distinction

Already stated authoritatively in Identity & Workspace Access Architecture (GP-001–GP-010) and restated at the aggregate level in Membership Aggregate Design, Section 10. Summarized here for completeness: Identity is global and platform-owned; Membership is local and Workspace-owned. Identity survives the removal of every Membership it has ever held (ID-104, BR-ID-004).

---

# 11. Domain Events

Representative events, per Identity & Workspace Access Architecture, Section VII:

- IdentityCreated
- IdentityAuthenticated
- IdentityVerificationCompleted
- CredentialRegistered
- CredentialRevoked
- PasswordChanged
- ExternalProviderLinked
- ProfessionalProfileUpdated
- AchievementAwarded
- ReputationUpdated

---

# 12. Commands

- CreateIdentity
- RegisterCredential
- RevokeCredential
- ChangePassword
- LinkExternalProvider
- UpdateGlobalProfile
- CompleteVerification
- UpdateProfessionalProfile
- RecordAchievement

---

# 13. Business Invariants

## INV-001

Every Person owns exactly one Identity (BR-ID-001).

---

## INV-002

Identity is globally unique across the platform (BR-ID-002).

---

## INV-003

Identity never belongs to, or is owned by, a Workspace (BR-ID-003).

---

## INV-004

Identity survives removal of every Workspace Membership it has held (BR-ID-004).

---

## INV-005

An Identity may hold multiple Credentials, but each Credential authenticates exactly one Identity (BR-CR-006, ID-203).

---

## INV-006

Passwords and credentials are never visible to, or modifiable by, any Workspace or Tutor (BR-CR-003, BR-CR-004).

---

## INV-007

Achievements and Reputation, once recorded, are immutable except through authorized correction processes (PG-007).

---

# 14. State Machine

```text
Person

↓

Identity Created

↓

Credential Registered

↓

Identity Verified

↓

Professional Growth

↓

Identity Maintained

↓

Identity Archived
```

Per Identity & Workspace Access Architecture, Section 2 ("Identity Lifecycle").

---

# 15. Aggregate References

The Identity Aggregate references no other aggregate directly. It is referenced by identifier (IdentityId) from Membership and, optionally, from Achievement's Source Workspace pointer (evidence only, not ownership).

---

# 16. Architectural Rationale

Identity is kept entirely independent of Workspace, Membership, and every Workspace-scoped aggregate, per the platform's foundational architectural decision (Identity & Workspace Access Architecture, ADR-001–ADR-003). This is the one separation in the entire corpus stated with the most repetition and emphasis, and this document's invariants (Section 13) exist to make that emphasis enforceable at the aggregate-design level rather than only as narrative principle.

---

# 17. Future Evolution

- Additional external Credential providers.
- Cross-Workspace organizational context sharing under explicit permission (AI Business Context Architecture, Section 21).
- Portable, exportable professional identity/portfolio formats.

---

# Summary

The Identity Aggregate is the authoritative, platform-owned root of a Person's lifelong digital presence — credentials, profile, verification, and professional growth — entirely independent of any Workspace. This document completes its aggregate-level specification, drawing on the extensive business-architecture detail already present in Identity & Workspace Access Architecture and reformatting it into the same structural template used across the rest of the Platform Aggregate Catalogue's roots.