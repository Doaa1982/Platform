# Certification Context

**Version:** 1.0 (Draft)

**Bounded Context Type:** Supporting Domain

**Domain Classification:** Strategic Supporting Context

> **Origin Note:** Certificate Aggregate Design stated plainly that Certification "has never received even business-analysis-level documentation" — it existed only as a referenced concept inside Assessment Context (Section 4.7) and Identity & Workspace Access Architecture, and as a short subsection in the Bounded Context Map (Section 5.15). This document supplies that missing business-analysis-level treatment. It does not replace Certificate Aggregate Design, which remains the aggregate-level specification and is the fuller source for issuance mechanics, invariants, and lifecycle. Identity & Workspace Access Architecture (Section VIII) refers to this same area as "Credential & Certification Context" when routing Certificate Events; this document uses **Certification Context**, matching the naming already established in the Bounded Context Map and the Platform Aggregate Catalogue.

**Related Documents**

- Learning Workspace Bounded Context Map (Section 5.15)
- Certificate Aggregate Design
- Assessment Context (Section 4.7)
- Enrollment Aggregate Design
- Identity & Workspace Access Architecture (Section III — Professional Growth)
- Platform Aggregate Catalogue

---

# 1. Context Purpose

## Definition

The Certification Context manages the issuance, presentation, and verification of formal recognition of learner achievement.

It answers:

> "How is learner achievement formally recognized and verified?"
>
> "What has this learner formally achieved, and can it be proven?"

---

# 2. Business Responsibility

The Certification Context owns:

- Certificates
- Certificate issuance records
- Certificate presentation and branding configuration references
- Certificate verification records

---

# 3. Core Principle

## Certification Proves Achievement; It Does Not Determine It

Enrollment Context and Assessment Context answer:

> "Has this requirement been met?"

Certification Context answers:

> "Here is the formal, presentable, and verifiable record that it was."

---

Example:

Achievement determination (Enrollment / Assessment):

```
Enrollment status: Completed
Submission grade: 92% (Passing Threshold: 70%)
```

is a fact recorded elsewhere.

Certification:

```
Certificate: IELTS Speaking Foundations — Course Completion
Issued to: Ahmed
Issued: 2026-03-14
Verify at: workspace.example/verify/c-8841
```

is the formal artifact built from that fact.

Certification Context does not recompute or own the underlying determination — it consumes Enrollment completion and/or Assessment outcomes purely as triggers (Bounded Context Map, Section 5.15, "Does Not Own").

---

# 4. Core Concepts

---

# 4.1 Certificate

## Definition

A Certificate is formal, issued recognition of a learner's achievement within a Workspace.

---

## Examples

- Course completion certificate
- Skill certificate
- Programme certificate
- Professional certificate

(per Assessment Context, Section 4.7)

---

## Responsibilities

A Certificate contains:

- recipient and issuing Workspace;
- the achievement criteria reference that triggered it (an Enrollment, an Assessment/Submission, or both);
- presentation metadata (template, branding reference);
- issuance and, where applicable, expiry or revocation state.

---

# 4.2 Achievement Criteria Reference

## Definition

A snapshot, taken at issuance time, of the requirement a Certificate attests was satisfied.

---

## Purpose

Ensures that later changes to a Learning Product's or Assessment's requirements never retroactively alter what an already-issued Certificate attests to (Certificate Aggregate Design, INV-003).

---

# 4.3 Verification Record

## Definition

A record of one instance of a third party checking a Certificate's authenticity — for example, an employer following a public verification link.

---

## Examples

```
Verified by: (anonymous, by default)
Verified at: 2026-06-02
```

---

# 4.4 Digital Credential

## Definition

A portable, publishable form of a Certificate, intended for presentation outside the Workspace (e.g., on a professional profile).

---

## Examples

- Open Badges format
- Verifiable credential format

Referenced as "Digital Credential" in Identity & Workspace Access Architecture, Section VII, and as `DigitalCredentialPublished` in Certificate Aggregate Design, Section 11.

---

# 5. Owned Data

The Certification Context is the source of truth for:

| Data | Owner |
|-|-|
| Certificate | Certification Context |
| Certificate Issuance Record | Certification Context |
| Certificate Presentation / Branding Reference | Certification Context |
| Certificate Verification Record | Certification Context |

---

# 6. Data Not Owned

| Data | Owner |
|-|-|
| Enrollment completion status | Enrollment Context |
| Assessment / Submission achievement outcome | Assessment Context |
| Recipient identity and Professional History aggregation | Identity Context |
| Workspace branding configuration itself | Workspace Management Context |

---

# 7. Business Rules

---

## Rule 1 — Certificates Require Achievement Criteria

A Certificate should only be issued when its referenced Enrollment is Completed and/or its referenced Submission is Evaluated with criteria satisfied (Assessment Context, Rule 4; Certificate Aggregate Design, INV-001).

---

## Rule 2 — Certificates Are Historical Records

Once issued, a Certificate is not silently modified. Correcting one requires explicit revocation followed by reissuance, preserving full history of both (Certificate Aggregate Design, INV-004) — the same historical-record principle Assessment Context applies to assessment results (Rule 2).

---

## Rule 3 — Certification Does Not Own Achievement Determination

Certification Context consumes Enrollment and Assessment outcomes as triggers; it does not determine or recompute whether achievement criteria are met (Bounded Context Map, Section 5.15).

---

## Rule 4 — Revocation Does Not Erase History

A revoked Certificate remains queryable as a historical record but is no longer presented as currently valid via its public verification surface (Certificate Aggregate Design, INV-005).

---

# 8. Relationships

---

# Certification → Enrollment

Relationship:

```
Enrollment (Completed)

may trigger

Certificate
```

---

# Certification → Assessment

Relationship:

```
Submission (Evaluated, criteria met)

may trigger

Certificate
```

---

# Certification → Identity

Relationship:

```
Certificate

is referenced by, over time, by

Identity's Achievement entity (Professional History)
```

---

# Certification → Workspace Management

Relationship:

```
Workspace Branding Configuration

is referenced by

Certificate Presentation Configuration
```

---

# 9. Certificate Lifecycle

```
Issued

↓

Revoked
```

Optionally, for time-limited Certificates:

```
Issued

↓

Expired
```

Matches the state machine defined in Certificate Aggregate Design, Section 14.

---

# 10. Future Evolution

The Certification Context should support:

## Public Digital Credential Formats

Open Badges and verifiable credential formats (Identity & Workspace Access Architecture, Section VII; Certificate Aggregate Design, Section 17).

---

## Competency-Based Certification

Certificates tied to Assessment Context's future Competency-Based Learning model (Assessment Context, Section 11).

---

## Organization-Level Co-Branded Certificates

For Workspaces operating under a parent Organization.

---

# 11. Architectural Notes

The Certification Context manages issuance, presentation, and verification of proof.

It should not manage:

- whether achievement criteria are met (Enrollment, Assessment);
- learner identity or lifetime professional aggregation (Identity);
- Workspace branding itself (Workspace Management).

Its responsibility is:

```
What was achieved (by reference)?

Who issued proof of it?

Can that proof be verified?
```
