# Certificate Aggregate Design

> Version: 1.0
>
> Status: Draft
>
> Domain: Certification
>
> Aggregate: Certificate
>
> Author: Business Analysis Team (drafted to close a documented gap — see Learning Workspace Architecture Gap Review)
>
> Related Documents:
>
> - Assessment Context
> - Assessment and Submission Aggregate Design
> - Enrollment Aggregate Design
> - Identity & Workspace Access Architecture
> - Platform Aggregate Catalogue

---

# 1. Overview

The Certificate Aggregate represents formal, issued recognition of a learner's achievement within a Learning Workspace.

The Platform Aggregate Catalogue lists Certificate as an Aggregate Root under a "Certification" bounded context, but — unlike Assessment — that context has never received even business-analysis-level documentation; Certificate appears only as a referenced concept inside Assessment Context (Section 4.7) and Identity & Workspace Access Architecture (as part of Professional Growth's Achievement model). This document is therefore the first dedicated treatment of Certificate at any level, provided directly in Aggregate Design form to close the gap identified in Assessment & Submission Aggregate Design, Section 17.

---

# 2. Vision

Certificate answers:

> "What has this learner formally achieved, and can it be proven?"

A Certificate is evidence, not the achievement itself. The achievement is established by Enrollment completion (Enrollment Aggregate Design, Section 15, "Completed" status) and/or Assessment outcomes (Assessment and Submission Aggregate Design, Section 10). The Certificate Aggregate exists to formally record, timestamp, and make presentable that a defined set of requirements has been satisfied.

---

# 3. Responsibilities

The Certificate Aggregate is responsible for:

- Recording that a Certificate has been issued to a specific learner.
- Managing Certificate identity and its own lifecycle (issued, revoked).
- Referencing the achievement criteria that were satisfied.
- Managing Certificate presentation metadata (template, branding reference, issue date, expiry if applicable).
- Supporting verification of an issued Certificate's authenticity.

The Certificate Aggregate is **not** responsible for:

- Determining whether achievement criteria are met — that determination is made by Enrollment (product-level completion) or Submission/Evaluation (assessment-level achievement), and merely consumed here as a trigger.
- Evaluation, grading, or Assessment design (Assessment Aggregate).
- Professional Portfolio aggregation across a lifetime — Certificate is a discrete, issued record; Identity's Achievement entity (Identity Aggregate Design, Section 7) is what aggregates Certificates and other milestones into the lifelong professional history.

---

# 4. Aggregate Root

```text
Certificate
```

Certificate is the Aggregate Root. It references, by identifier, the Membership it was issued to, the Workspace that issued it, and the Learning Product and/or Assessment whose completion triggered it.

---

# 5. Aggregate Structure

```text
Certificate (Aggregate Root)

├── Certificate Metadata
├── Achievement Criteria Reference
├── Issuance Record
├── Presentation Configuration
└── Verification Data
```

---

# 6. Aggregate Responsibilities

The Certificate Aggregate owns: certificate identity, issuance state, presentation metadata, and verification data.

It does not own: the underlying achievement determination (Enrollment / Submission), Learning Product structure, or the recipient's broader professional history (Identity).

---

# 7. Entities

## Verification Record

Represents one instance of a third party verifying this Certificate's authenticity (e.g., an employer checking a public verification link).

Each Verification Record has:

- Verification Id
- Verified At
- Verifier Context (optional — anonymous by default)

---

# 8. Value Objects

## Certificate Metadata

Contains: Title, Description, Certificate Type (Course Completion, Skill Certificate, Programme Certificate, Professional Certificate — per Assessment Context, Section 4.7), Issued At, Expiry Date (optional).

## Achievement Criteria Reference

Contains: EnrollmentId (when triggered by product completion) and/or AssessmentId + SubmissionId (when triggered by assessment achievement), and a snapshot of the criteria description at time of issuance (so later changes to the Learning Product's requirements do not retroactively alter what an already-issued Certificate attests to).

## Issuance Record

Contains: Issued By (MembershipId or "Automatic"), WorkspaceId, Recipient MembershipId.

## Presentation Configuration

Contains: Template Reference, Branding Reference (per Workspace Aggregate Design, Branding Configuration), Public Verification URL.

---

# 9. Aggregate Relationships

```text
Enrollment (Completed) or Submission (Evaluated, criteria met)

↓ (triggers)

Certificate

↓ (referenced by, over time)

Identity's Achievement entity (Professional History)
```

---

# 10. Relationship to Enrollment and Assessment — the Core Distinction

```text
Enrollment / Assessment answer:     "Has the requirement been met?"
Certificate answers:                "Here is the formal, presentable record that it was."
```

- Enrollment Aggregate Design, Section 13, already states this precisely: "Certificate may require an Enrollment to be in 'Completed' status before it can be issued. Enrollment does not issue, own, or track certificates; it is referenced by identifier only." This document is the Certificate-side confirmation of that same boundary.
- A Certificate is issued once and is treated as a historical, largely immutable record (consistent with Assessment Context, Rule 2, applied here by analogy) — correcting an erroneous Certificate requires revocation and reissuance, not silent modification (see INV-004).

---

# 11. Domain Events

- CertificateIssued
- CertificateRevoked
- CertificateVerified
- DigitalCredentialPublished

`CertificateIssued`, `CertificateRevoked`, and `DigitalCredentialPublished` are already referenced in Identity & Workspace Access Architecture, Section VII, and the Learning Workspace Domain Event Model, Section 10 (`AchievementGranted`, which this document treats as the integration-event counterpart of `CertificateIssued`).

---

# 12. Commands

- IssueCertificate
- RevokeCertificate
- RecordVerification
- UpdatePresentationConfiguration

---

# 13. Business Invariants

## INV-001

A Certificate cannot be issued unless its referenced Enrollment is Completed and/or its referenced Submission is Evaluated with criteria satisfied (Assessment Context, Rule 4 — "Certificates Require Achievement Criteria").

---

## INV-002

Every Certificate references exactly one recipient Membership and exactly one issuing Workspace.

---

## INV-003

A Certificate's Achievement Criteria Reference is a snapshot at issuance time; later changes to the underlying Learning Product's or Assessment's requirements do not retroactively alter previously issued Certificates.

---

## INV-004

Once issued, a Certificate is not silently modified. Correction requires an explicit Revoke followed by a new Issue, preserving a full history of both.

---

## INV-005

A revoked Certificate remains queryable as a historical record but is no longer presented as currently valid via its Public Verification URL.

---

# 14. State Machine

```text
Issued

↓

Revoked
```

Optionally, for time-limited Certificates:

```text
Issued

↓

Expired
```

---

# 15. Aggregate References

The Certificate Aggregate references other aggregates only by identifier: WorkspaceId, Recipient MembershipId, EnrollmentId (optional), AssessmentId (optional), SubmissionId (optional).

---

# 16. Architectural Rationale

Certificate is kept separate from both Enrollment and Assessment for the same reason Submission is kept separate from Assessment (Assessment and Submission Aggregate Design, Section 17): it is a distinct artifact with its own lifecycle (issuance, revocation, verification) that would otherwise force Enrollment or Assessment to carry presentation and verification concerns unrelated to their core responsibilities.

---

# 17. Future Evolution

- Public digital credential formats (Open Badges, verifiable credentials) — referenced as "Digital Credential" in Identity & Workspace Access Architecture, Section VII.
- Competency-based Certificates tied to Assessment Context's future Competency-Based Learning model (Assessment Context, Section 11).
- Organization-level co-branded Certificates.

---

# Summary

The Certificate Aggregate is the authoritative owner of issued, presentable proof of achievement, referencing but never owning the Enrollment or Submission facts that triggered it. This document provides Certification's first formal specification in the corpus, closing one more gap from Assessment & Submission Aggregate Design, Section 17.