# Enrollment Aggregate Design

> Version: 1.0
>
> Status: Draft
>
> Domain: Enrollment
>
> Aggregate: Enrollment
>
> Author: Business Analysis Team (drafted to close a documented gap — see Learning Workspace Architecture Gap Review)
>
> Related Documents:
>
> - Platform Aggregate Catalogue
> - Identity & Workspace Access Architecture (Section II — Workspace Enrollment)
> - Workspace Access Context
> - Learning Product Context
> - Learning Delivery Context
> - Curriculum Aggregate Design
> - Commerce Context
> - Learning Workspace Domain Event Model
> - Learning Workspace Bounded Context Map

---

# 1. Overview

The Enrollment Aggregate represents a Workspace Member's registered participation in a specific Learning Product.

Enrollment is deliberately separate from Workspace Membership. Membership answers *"does this person belong to this Workspace?"* Enrollment answers a narrower question: *"is this Member currently registered to participate in this particular Learning Product?"*

A person may hold an active Workspace Membership with zero Enrollments — for example, a learner who has joined a Workspace and is browsing its catalogue but has not yet registered for any course. Conversely, no Enrollment can exist without an underlying active Membership.

---

# 2. Vision

Enrollment is the business record that turns "browsing a Workspace" into "participating in a Learning Product."

It answers:

- Who is registered for this Learning Product?
- How did they gain access (purchase, invitation, manual assignment, free enrollment)?
- Is their access currently active?
- When does their access begin, and does it expire?
- Has their participation been completed?

Enrollment does not itself deliver instruction, track lesson-by-lesson progress, or process payment. It is the gatekeeper that determines whether a Membership is currently authorized to participate in a Learning Product — every other capability (Learning Delivery, Assessment, Assignment) checks Enrollment before granting access.

---

# 3. Responsibilities

The Enrollment Aggregate is responsible for:

- Registering a Membership's participation in a Learning Product.
- Managing the Enrollment lifecycle (Invited → Active → Completed, with Cancelled / Expired / Suspended branches).
- Recording how the Enrollment originated (Enrollment Source).
- Enforcing enrollment eligibility rules.
- Determining current access authorization for a given Membership and Learning Product.
- Defining the access window, when one applies (e.g., time-limited or subscription-based access).
- Preserving historical enrollment records after access ends.

The Enrollment Aggregate is **not** responsible for:

- Workspace participation itself (Workspace Access Context).
- Payment processing, pricing, or subscriptions (Commerce Context).
- Learning Product structure or content (Learning Product Context).
- Lesson-by-lesson learner progress or completion percentage (Learning Delivery Context).
- Curriculum sequencing or completion rule definitions (Curriculum Aggregate).
- Certificate issuance (Assessment Context) — Enrollment may be *referenced* as an eligibility input, but does not issue certificates itself.

---

# 4. Aggregate Root

```text
Enrollment
```

Enrollment is the Aggregate Root. It owns its own status, lifecycle, source, and access window, and is referenced by identifier from every other aggregate that needs to check participation eligibility.

---

# 5. Aggregate Structure

```text
Enrollment (Aggregate Root)

├── Enrollment Status
├── Enrollment Source
├── Access Window
├── Enrollment Metadata
└── Cancellation / Expiry Reason (when applicable)
```

Enrollment is intentionally a small, shallow aggregate. It is a registration record, not a container for learning content or progress data.

---

# 6. Aggregate Responsibilities

The Enrollment Aggregate owns:

- enrollment status and its transitions
- enrollment source
- access window (start date, optional expiry)
- enrollment metadata (enrolled-at timestamp, enrolled-by actor, notes)

It does not own:

- Membership
- Workspace
- Learning Product structure
- Learning progress
- Payment or pricing data
- Certificates

Those belong to their respective aggregates, referenced here only by identifier.

---

# 7. Entities

Enrollment has no internal entities with independent identity in Version 1 — it is modeled as a single-record aggregate. This keeps the aggregate small and avoids duplicating progress-tracking responsibility that already belongs to Learning Delivery Context.

Future evolution (Section 18) may introduce an **Access Grant** entity to support re-enrollment scenarios (e.g., a lapsed subscription renewed later, producing a second grant under the same Enrollment record rather than a duplicate Enrollment).

---

# 8. Value Objects

## Enrollment Status

Represents where the Enrollment currently sits in its lifecycle.

Values:

- Invited
- Active
- Completed
- Cancelled
- Expired
- Suspended

---

## Enrollment Source

Represents how the Enrollment originated.

Examples:

- Purchase (triggered by Commerce Context's `PaymentCompleted`)
- Manual Assignment (a Workspace Owner or Administrator enrolls a Member directly)
- Invitation (bundled with a Workspace Invitation that specifies an intended Learning Product)
- Free Enrollment (no commercial transaction required)
- Bundle (included as part of a broader Learning Product package)
- Organization-Sponsored (future — enrolled via an Organization Portfolio relationship)

---

## Access Window

Represents the period during which the Enrollment grants active participation.

Contains:

- Start Date
- Expiry Date (optional — absent for perpetual access)

---

## Enrollment Metadata

Contains:

- Enrolled At (timestamp)
- Enrolled By (Membership Id of the actor who created the Enrollment, when manually assigned)
- Notes

---

# 9. Aggregate Relationships

```text
Workspace Access Context (Membership)

↓ (required precondition)

Enrollment

↓ (references)

Learning Product

↓ (gates access to)

Learning Delivery Context (Lesson participation)
```

Enrollment sits between Workspace Access and Learning Delivery: it depends on an active Membership, and Learning Delivery depends on an active Enrollment before granting lesson access.

---

# 10. Relationship to Membership — the Core Distinction

This is the single most important rule governing this aggregate, and it is restated here because it has historically been under-documented (see Identity & Workspace Access Architecture, Section II, Rule "Membership grants Workspace participation. Enrollment grants Learning Product participation.").

```text
Membership answers:

"Does this person belong to this Workspace?"


Enrollment answers:

"Is this Member registered for this specific Learning Product?"
```

- A Membership may exist with zero Enrollments.
- An Enrollment cannot exist without an active Membership.
- Removing a Membership does not retroactively delete Enrollment history, but it does suspend the Member's ability to access any associated Learning Product going forward — access enforcement checks both records.
- A Member may hold multiple Enrollments across multiple Learning Products within the same Workspace, each with independent status and lifecycle.

---

# 11. Relationship to Commerce

Payment and Enrollment are related but distinct business concepts (see Commerce Context, Rule 3 — "Payment Does Not Equal Enrolment").

```text
ProductPurchased

↓

PaymentCompleted

↓

EnrollmentCreated

↓

Learning Access Granted
```

Commerce Context publishes `PaymentCompleted`. Enrollment Context listens for that event and creates the Enrollment record with Source = Purchase. Enrollment Context owns the decision of when the record transitions to Active — a completed payment is the trigger, not a guarantee, since eligibility rules (Section 14) may still block activation (for example, a Learning Product that has reached capacity).

Free and manually assigned Enrollments follow the same lifecycle without a Commerce Context event as the trigger.

---

# 12. Relationship to Learning Delivery

Learning Delivery Context checks for an Active Enrollment before granting a learner access to a Lesson within the enrolled Learning Product. Enrollment does not track which Lessons have been completed — that remains owned by Learning Delivery's Learner Progress Model (see Learning Delivery Context, Section 9).

Enrollment's own "Completed" status represents completion of the *Learning Product as a whole*, and is set based on a signal received from Curriculum's completion rules (see Curriculum Aggregate Design, Completion Rules) — Enrollment does not calculate completion itself, it receives and records the outcome.

```text
Learning Delivery / Curriculum

↓ (completion rules satisfied)

CurriculumCompletionAchieved (event, referenced)

↓

Enrollment transitions to "Completed"
```

---

# 13. Relationship to Assessment and Certification

Assessment Context and the (proposed) Certification Context may reference an Enrollment's status as an eligibility input — for example, a Certificate may require an Enrollment to be in "Completed" status before it can be issued. Enrollment does not issue, own, or track certificates; it is referenced by identifier only.

---

# 14. Business Invariants

## INV-001

Every Enrollment references exactly one Membership and exactly one Learning Product.

---

## INV-002

An Enrollment cannot be created without an active Workspace Membership. If the underlying Membership is not Active, Enrollment creation must be rejected.

---

## INV-003

A Membership may exist with zero Enrollments. Membership and Enrollment lifecycles are independent (see Section 10).

---

## INV-004

A Membership may hold multiple Enrollments across different Learning Products, but at most one **currently active** Enrollment per (Membership, Learning Product) pair. Re-enrollment after Cancellation or Expiry creates a new Enrollment record or reactivates the existing one per Workspace policy — see Section 18, Access Grant.

---

## INV-005

Enrollment status transitions must follow the defined state machine (Section 15). Illegal transitions (for example, Invited directly to Completed) are rejected.

---

## INV-006

A completed Commerce payment does not automatically guarantee an Active Enrollment. Enrollment Context evaluates eligibility rules independently before activation.

---

## INV-007

Removing or suspending a Workspace Membership does not delete historical Enrollment records. Historical enrollment and completion data must be preserved for the learner's record, consistent with the platform's approach to Professional Growth and historical data (see Identity & Workspace Access Architecture, Professional History principles).

---

## INV-008

Enrollment access rights are Workspace-scoped. An Enrollment created within one Workspace never grants access to a Learning Product belonging to another Workspace, even for the same underlying Identity.

---

## INV-009

An Enrollment's "Completed" status is set only in response to a completion signal from Curriculum / Learning Delivery; Enrollment Context does not independently determine what constitutes completion.

---

# 15. State Machine

```text
Invited

↓

Active

↓

Completed


Active

↓

Suspended

↓

Active (reinstated)


Active or Invited

↓

Cancelled


Active

↓

Expired (access window elapsed)
```

- **Invited** — an Enrollment has been offered (e.g., via Workspace Invitation bundled with an intended Learning Product, or a Commerce order placed but payment pending) but the Member has not yet gained access.
- **Active** — the Member currently has authorized access to the Learning Product.
- **Completed** — the Learning Product's completion criteria have been satisfied (signal received from Curriculum).
- **Suspended** — access temporarily revoked (e.g., payment dispute, policy violation) without losing the Enrollment record; may be reinstated to Active.
- **Cancelled** — the Enrollment was terminated before completion, either by the Member, the Workspace Owner, or a failed/refunded payment.
- **Expired** — the Access Window's expiry date has elapsed without completion (relevant for time-limited or subscription-based access).

---

# 16. Commands

Representative commands include:

- CreateEnrollment
- ActivateEnrollment
- CompleteEnrollment
- SuspendEnrollment
- ReinstateEnrollment
- CancelEnrollment
- ExpireEnrollment
- ExtendAccessWindow

---

# 17. Domain Events

Representative domain events include:

- EnrollmentCreated
- EnrollmentActivated
- EnrollmentCompleted
- EnrollmentSuspended
- EnrollmentReinstated
- EnrollmentCancelled
- EnrollmentExpired
- AccessWindowExtended

`EnrollmentCreated`, `EnrollmentCancelled`, and `EnrollmentCompleted` are already referenced in the Learning Workspace Domain Event Model; the remainder are added here to give the full lifecycle defined in Section 15 complete event coverage.

The integration event `LearnerEnrolled` (per the Domain Event Model's Integration Events table) is published from `EnrollmentCreated` for consumption by Learning Delivery, Communication, and Analytics.

---

# 18. Future Evolution

The Enrollment Aggregate supports future capabilities including:

- **Access Grant entity** — supporting multiple discrete access periods under a single Enrollment record (e.g., renewed subscriptions), rather than requiring a new Enrollment per renewal.
- **Group / Cohort Enrollment** — enrolling multiple Memberships together as a cohort with shared scheduling (relevant to Assignment's "Assign to a cohort" scenario).
- **Waitlisting** — an Enrollment state prior to Invited, for capacity-constrained Learning Products.
- **Partial Refund Handling** — finer-grained interaction with Commerce Context for partial cancellations.
- **Organization-Sponsored Enrollment** — bulk enrollment initiated by an Organization Portfolio relationship rather than an individual Purchase.
- **Enrollment Transfer** — moving an Enrollment between Learning Products (e.g., course substitution) without losing historical continuity.

---

# 19. Architectural Rationale

Enrollment is defined as its own Aggregate Root, separate from Membership, Learning Product, and Learning Delivery, for the same reasons the platform separates Lesson from Lesson Revision and Learning Asset from Lesson Revision: each represents a distinct consistency boundary with its own lifecycle.

Specifically:

- **Separate from Membership** — Membership answers Workspace participation; Enrollment answers Learning Product participation. Conflating them would force every Workspace join to imply course registration, which contradicts the platform's own stated business flow (a learner may join a Workspace and browse before enrolling in anything).
- **Separate from Commerce** — a payment is a trigger, not the business fact itself. Modeling Enrollment separately from Order/Payment allows free, manual, and invitation-based enrollment to share one lifecycle without depending on Commerce Context existing at all.
- **Separate from Learning Delivery** — Enrollment answers "is this Member authorized to participate," while Learning Delivery answers "what has this Member done so far." Merging them would bloat the Enrollment aggregate with lesson-level progress data that changes far more frequently and belongs to a different consistency boundary.

This keeps Enrollment small, stable, and reusable as the single gate that every other capability — Learning Delivery, Assignment, Assessment, Certification — checks before granting participation.

---

# Summary

The Enrollment Aggregate is the authoritative record of a Workspace Member's registered participation in a specific Learning Product.

It sits deliberately between Workspace Access Context (which governs whether a person belongs to the Workspace at all) and Learning Delivery Context (which governs what a participating learner actually experiences), and never absorbs the responsibilities of either. By keeping Enrollment as a small, well-bounded aggregate — status, source, access window, and nothing else — the platform preserves a single, unambiguous gate that every downstream capability can check without needing to understand Commerce, Membership, or progress-tracking rules directly.
