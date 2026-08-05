# Learning Product Aggregate Design

> Version: 1.0
>
> Status: Draft
>
> Domain: Learning Product
>
> Aggregate: Learning Product
>
> Author: Business Analysis Team (drafted to close a documented gap — see Learning Workspace Architecture Gap Review)
>
> Related Documents:
>
> - Learning Product Context
> - Curriculum Aggregate Design
> - Enrollment Aggregate Design
> - Commerce Context
> - Learning Asset Aggregate Design
> - Platform Aggregate Catalogue
> - Learning Workspace Bounded Context Map

---

# 1. Overview

The Learning Product Aggregate represents the commercial and structural identity of an educational offering within a Learning Workspace.

Learning Product Context (the bounded context) has, until now, been documented only at the business-capability level. The Platform Aggregate Catalogue lists **Learning Product** as an Aggregate Root and Curriculum Aggregate Design already references a "Learning Product Aggregate Design" document in its Related Documents section — but no such document previously existed. This document closes that gap, in the same way Enrollment Aggregate Design, Learning Asset Aggregate Design, Curriculum Aggregate Design, and Lesson Revision Aggregate Design closed equivalent gaps for their own aggregates.

A Learning Product is not instructional content. It is the sellable, publishable business offering — a Course, Programme, Membership, or Package — that learners discover, purchase or enroll in, and progress through. The pedagogical structure inside a Learning Product is owned by the separate **Curriculum** Aggregate (per Curriculum Aggregate Design); the Learning Product Aggregate owns identity, packaging, offering-level metadata, and publication state.

---

# 2. Vision

A Learning Product answers:

> "What educational offering exists, and is it available to learners?"

It is the thing a Workspace Owner creates, names, describes, prices (via reference to Commerce), publishes, and retires. It is the thing an Enrollment registers a Member into. It is the thing a Curriculum gives pedagogical shape to.

The Learning Product Aggregate is intentionally thin. It does not contain lessons, units, sequencing rules, or learning assets — those are owned by Curriculum, Lesson, Lesson Revision, and Learning Asset respectively. Learning Product's job is to be the stable, referenceable business entity that ties a Workspace's commercial catalogue to its pedagogical structure without owning either in detail.

---

# 3. Responsibilities

The Learning Product Aggregate is responsible for:

- Maintaining Learning Product identity within a Workspace.
- Managing product metadata (title, description, thumbnail, category).
- Managing product type (Course, Programme, Membership, Package — see Section 7).
- Managing the product's publication lifecycle.
- Managing product-level audience and access configuration (target audience, prerequisites at a descriptive level).
- Referencing the Curriculum that defines its pedagogical structure.
- Referencing Commerce configuration (pricing, offers) by identifier.
- Coordinating which Curriculum is currently active for the product.

The Learning Product Aggregate is **not** responsible for:

- Pedagogical structure, sequencing, or progression rules (Curriculum Aggregate).
- Lesson content or instructional design (Lesson / Lesson Revision Aggregates).
- Learning Asset files or technical metadata (Learning Asset Aggregate).
- Pricing, orders, payments, or subscriptions (Commerce Context).
- Learner registration or access authorization (Enrollment Aggregate).
- Assessment design or grading (Assessment Context).

---

# 4. Aggregate Root

```text
LearningProduct
```

LearningProduct is the Aggregate Root. It owns its own identity, metadata, type, and publication lifecycle, and is referenced by identifier from Curriculum, Enrollment, Commerce, and Assignment.

---

# 5. Aggregate Structure

```text
Learning Product (Aggregate Root)

├── Product Metadata
├── Product Type
├── Publication State
├── Audience Descriptor
├── Active Curriculum Reference
├── Commerce Reference (optional)
└── Product Settings
```

Learning Product is intentionally a shallow aggregate, following the same design rationale as Enrollment (Section 19, Enrollment Aggregate Design) and Lesson (Section 19, Lesson Aggregate Design): it is a stable identity and coordination point, not a content container.

---

# 6. Aggregate Responsibilities

The Learning Product Aggregate owns:

- product identity
- product metadata
- product type
- publication state
- audience descriptor
- product-level settings (e.g., self-paced vs cohort-based, default language)
- the reference to its currently active Curriculum

It does not own:

- Curriculum structure (units, lessons, sequencing, completion rules)
- Lesson or Lesson Revision content
- Learning Asset files
- Pricing or commercial terms
- Enrollment records
- Assessment definitions

Those belong to their respective aggregates, referenced here only by identifier.

---

# 7. Entities

## Product Offering Type

Represents the packaging model of the Learning Product. This is modeled as an entity rather than a simple enum because each type carries distinct structural implications for how Curriculum and Enrollment behave against it.

Examples, consistent with Learning Product Context Section 3.1 and the Capability Model:

- Course
- Programme
- Membership
- Package (bundle of other Learning Products)
- Private Tutoring Package

Each Product Offering Type has:

- Type Id
- Type Name
- Access Model (fixed-duration, perpetual, subscription — informs but does not own Commerce or Enrollment Access Window behavior)
- Whether the type supports bundling (relevant to Package)

---

## Audience Descriptor

Represents the intended learner audience for the product.

Contains:

- Target Learner Level (e.g., Beginner, Intermediate, Advanced)
- Prerequisite Description (free text or reference to prerequisite Learning Products — descriptive only; enforcement of prerequisites, if any, belongs to Curriculum or Enrollment eligibility rules)
- Language

This is distinct from Curriculum's prerequisite/navigation rules (Curriculum Aggregate Design, Section 8), which govern lesson-level sequencing rather than product-level audience fit.

---

# 8. Value Objects

## Product Metadata

Contains:

- Title
- Description
- Thumbnail
- Category
- Tags
- Creation Timestamp
- Last Updated

---

## Publication Status

Possible values, aligned with the Aggregate Lifecycle pattern used by Lesson and Curriculum:

- Draft
- Under Review
- Published
- Archived

---

## Active Curriculum Reference

A single identifier pointing to the currently active Curriculum for this Learning Product.

A Learning Product references exactly one active Curriculum at a time. Multiple Curricula may exist historically against the same Learning Product (e.g., a "2025 Edition" and a "2026 Edition"), but only one is active — mirroring how Lesson references exactly one Current Published Revision (Lesson Aggregate Design, Section 8) while multiple Lesson Revisions may exist.

---

## Commerce Reference

Contains:

- PriceId or OfferId (optional — a Learning Product may exist unpublished with no commercial terms attached yet)

Commerce Context owns the referenced Price/Offer entirely; Learning Product holds only the identifier, consistent with Commerce Context Rule 1 ("Commerce Does Not Own Products" — the inverse is also true: Learning Product does not own Commerce).

---

## Product Settings

Contains:

- Pacing Model (Self-Paced, Cohort-Based, Instructor-Led)
- Default Language
- Enrollment Mode Hint (Open, Invitation-Only, Approval-Required — descriptive; actual eligibility enforcement is Enrollment's responsibility per Enrollment Aggregate Design INV-002)

### Pacing Model — what each value means

> **Added 2026-08-05.** These three values were listed here, in Workspace Aggregate Design §8 ("Default Pacing Model") and in the AI Authoring Assistant Architecture without ever being defined. A Tutor choosing between them had no guidance, and two readers would reasonably disagree — is a weekly live class Cohort-Based or Instructor-Led? Defined here so the answer is the same everywhere.

The Pacing Model answers: **what determines when a learner moves from one thing to the next?**

| Value | What sets the pace | Typical shape |
| --- | --- | --- |
| **Self-Paced** | The learner | Enrol at any time, work through at whatever speed suits. No shared dates, no cohort, no waiting for anyone. |
| **Cohort-Based** | A shared schedule | A group starts together on a set date and moves through in step. Intakes are periodic rather than continuous, and a learner joining late has missed something. |
| **Instructor-Led** | The tutor, per learner | The tutor decides what happens next and when, usually in live sessions arranged with that learner. Closest to conventional one-to-one tutoring. |

The distinction between Cohort-Based and Instructor-Led is **whether the schedule is shared**: a cohort moves as a group whether or not the tutor is present for each step, while instructor-led is paced individually even if several learners are doing the same material.

**This is a descriptive setting, exactly like Enrollment Mode Hint.** It records the Tutor's intent and enforces nothing by itself. What would act on it — Curriculum sequencing, Scheduling's cohort dates, Enrollment's start conditions — belongs to those aggregates. A Learning Product with a Pacing Model of Cohort-Based does not thereby have cohorts; it declares that it is meant to.

---

# 9. Aggregate Relationships

```text
Workspace

↓

Learning Product

├── Active Curriculum Reference  →  Curriculum

├── Commerce Reference  →  Price / Offer (Commerce Context)

└── (referenced by)  →  Enrollment
```

Learning Product sits between Workspace and Curriculum in the platform's primary dependency chain (see Platform Aggregate Catalogue, Section 5). It depends only on Workspace; Curriculum depends on it in turn.

---

# 10. Relationship to Curriculum — the Core Distinction

This distinction mirrors the Membership/Enrollment split (Enrollment Aggregate Design, Section 10) and is restated here for the same reason: it has previously been under-documented, existing only implicitly across Learning Product Context and Curriculum Aggregate Design.

```text
Learning Product answers:

"What is being offered, and is it for sale / available?"


Curriculum answers:

"How is the learning structured and sequenced inside that offering?"
```

- A Learning Product may exist in Draft with no Curriculum attached yet — an educator can register a product's identity, pricing, and metadata before designing its instructional structure.
- A Curriculum cannot exist without referencing exactly one Learning Product (Curriculum Aggregate Design, INV-001).
- Publishing a Learning Product requires an active, published Curriculum (see INV-006 below) — but the two remain separate aggregates with independent lifecycles, consistent with Curriculum Aggregate Design's own state machine (Section 15) running independently of Learning Product's.
- A Learning Product may replace its active Curriculum over time (e.g., a full course redesign) without changing the Learning Product's own identity, business metadata, or Enrollment history — analogous to how Lesson keeps a stable identity while its Current Published Revision changes (Lesson Aggregate Design, Section 6).

---

# 11. Relationship to Commerce

Learning Product references Commerce by identifier only, per Commerce Context Rule 1.

```text
Learning Product

↓ (references)

Price / Offer (Commerce Context)

↓ (purchase triggers)

PaymentCompleted

↓

EnrollmentCreated (Enrollment Context)
```

Learning Product does not know payment status, order history, or subscription state. It exposes only whether it is currently published and therefore eligible to be commercially offered; Commerce Context decides independently whether and how it is priced.

---

# 12. Relationship to Enrollment

Enrollment Context registers a Membership's participation in a Learning Product (Enrollment Aggregate Design, Section 1). Learning Product is referenced by Enrollment by identifier only and has no visibility into individual Enrollment records — consistent with AGG-003 (Platform Aggregate Catalogue, Section 2).

A published Learning Product is a precondition for new Enrollments in the general case, though Workspace policy may permit manual/invitation-based Enrollment against an unpublished product (e.g., early access) — this is a Workspace Access Policy concern, not a Learning Product invariant, and is intentionally left flexible here.

---

# 13. Domain Events

Representative events include:

- LearningProductCreated
- LearningProductMetadataUpdated
- LearningProductTypeAssigned
- LearningProductPublished
- LearningProductArchived
- ActiveCurriculumChanged
- CommerceReferenceAttached
- CommerceReferenceRemoved
- ProductAudienceUpdated

`LearningProductCreated` and `LearningProductPublished` are already referenced in the Learning Workspace Domain Event Model (Section 5); the remainder are added here to give the Aggregate full event coverage.

---

# 14. Commands

Representative commands include:

- CreateLearningProduct
- UpdateProductMetadata
- AssignProductType
- SetActiveCurriculum
- AttachCommerceReference
- RemoveCommerceReference
- UpdateAudienceDescriptor
- PublishLearningProduct
- ArchiveLearningProduct

---

# 15. Business Invariants

## INV-001

Every Learning Product belongs to exactly one Workspace.

---

## INV-002

Every Learning Product has exactly one Aggregate Root and one identity, stable across its lifetime regardless of Curriculum changes.

---

## INV-003

A Learning Product may reference at most one active Curriculum at any time.

---

## INV-004

A Learning Product may exist in Draft status with no active Curriculum and no Commerce Reference.

---

## INV-005

Changing the active Curriculum does not alter the Learning Product's identity, metadata, or Enrollment history.

---

## INV-006

A Learning Product cannot transition to Published status unless it references an active Curriculum that is itself Published (per Curriculum Aggregate Design, INV-008 and INV-009, which require at least one populated Curriculum Unit before Curriculum publication).

---

## INV-007

Archiving a Learning Product does not delete or archive its referenced Curriculum, Lessons, or historical Enrollments; those retain independent lifecycles per their own aggregate designs.

---

## INV-008

A Learning Product's Commerce Reference, when present, must resolve to a Price or Offer owned by the same Workspace (no cross-Workspace commercial references, consistent with Workspace Isolation, Workspace Context Rule 1).

---

# 16. State Machine

```text
Draft

↓

Under Review

↓

Published

↓

Archived
```

Publication of the Learning Product is a distinct event from publication of its Curriculum — a Learning Product cannot publish without a published Curriculum (INV-006), but a Curriculum may be re-published (e.g., a new edition) without necessarily re-triggering the Learning Product's own state machine, since the Product's identity and publication status are independent of which specific Curriculum edition is currently active.

---

# 17. Aggregate References

The Learning Product Aggregate references other aggregates only by identifier:

- WorkspaceId
- Author MembershipId
- ActiveCurriculumId
- CommerceReferenceId (Price or Offer — optional)

No external aggregate is embedded inside the Learning Product Aggregate.

---

# 18. Architectural Rationale

Separating Learning Product from Curriculum follows the same reasoning already applied elsewhere in the platform's aggregate design (see Curriculum Aggregate Design, Section 17; Lesson Aggregate Design, Section 19; Enrollment Aggregate Design, Section 19):

- **Separate from Curriculum** — Learning Product answers commercial/offering identity; Curriculum answers pedagogical structure. Conflating them would force every instructional redesign to also be a commercial re-listing event, and would prevent a Workspace Owner from registering a product's identity and pricing before instructional design is complete.
- **Separate from Commerce** — as with Enrollment (Enrollment Aggregate Design, Section 19), a Learning Product should be definable, nameable, and structurable even before pricing exists (e.g., a free workshop still being drafted).
- **Separate from Enrollment** — Learning Product answers "what exists to be offered"; Enrollment answers "who is registered for it." This mirrors the Membership/Enrollment separation (Enrollment Aggregate Design, Section 10) one layer up the dependency chain.

This keeps Learning Product small, stable, and the correct anchor point for Curriculum, Commerce, and Enrollment to each independently reference — without any of them needing to understand one another directly.

---

# 19. Future Evolution

The Learning Product Aggregate supports future capabilities including:

- **Bundling** — a Package-type Learning Product referencing multiple constituent Learning Products (structural hook already present via Product Offering Type, Section 7).
- **Multiple simultaneous Curricula** — e.g., differentiated tracks (Beginner Curriculum vs Advanced Curriculum) under one Learning Product, which would relax INV-003's single active-Curriculum constraint.
- **Product versioning independent of Curriculum editions** — allowing commercial metadata (title, pricing tier) to version separately from instructional content.
- **Cross-Workspace product syndication** — a future marketplace capability referenced in Learning Workspace Capability Model (Section 2.15) and Identity & Workspace Access Architecture's Organization Portfolio concept.
- **Prerequisite Learning Products** — formal enforcement of the Audience Descriptor's Prerequisite Description as an eligibility rule consumed by Enrollment.

---

# Summary

The Learning Product Aggregate is the authoritative owner of a Learning Workspace's educational offering identity — its metadata, type, publication state, and the coordination point between commercial packaging (Commerce), pedagogical structure (Curriculum), and learner registration (Enrollment).

It deliberately owns none of those three domains in detail, following the same shallow-aggregate, reference-by-identifier discipline established by Enrollment, Lesson, and Curriculum elsewhere in the platform. This closes the last major structural gap in the primary dependency chain documented in the Platform Aggregate Catalogue (Section 5): Workspace → **Learning Product** → Curriculum → Lesson → Lesson Revision → Assessment → Submission → Certificate.