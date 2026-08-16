# Student Workspace Access & Admission Architecture

> **Document status:** Business-level overview. For detailed lifecycles, field-level rules, and edge cases, the following documents are normative and take precedence over this one where they differ:
> - Invitation lifecycle, resend/cancel rules, and acceptance edge cases — **Invitation Business Analysis.md** §9 is normative for Invitation (see Technical Debt Backlog TD-008 for the reconciliation history).
> - Join Request lifecycle and edge cases — **Join Request Business Analysis.md**.
> - Membership fields, roles, and removal — **Membership Aggregate Design.md**.
> - Enrollment states, including enrollment offered via invitation — **Enrollment_Aggregate_Design.md**.
>
> **Terminology note:** This document uses **Student** and **Course/Class** as plain-language, tutor-facing terms. Elsewhere in the platform's domain model the same concepts are **Learner** and **Learning Product**. The terms are equivalent; see Section 17.
>
> **Change log:**
> - 2026-08-16 — added Section 12 (Workspace Admission vs. Course Enrollment), reconciled the Direct Invitation lifecycle with Invitation Business Analysis §9, and cross-referenced Membership removal and existing-member edge cases.
> - 2026-08-16 — resolved three open items: invitation authorization is out of scope for V1 (single tutor/Owner only; see Section 3.1 and Section 20), added a Pending Invitations view (Sections 13–14), and settled the batch course-assignment question as one course per bulk invite (Section 12.3).
> - 2026-08-16 — corrected Section 12.3's Invite + Enroll sequencing: the Enrollment record cannot be created until the Workspace Membership is active (Enrollment_Aggregate_Design INV-002), so it is created at acceptance time, not invite time. Flagged as an open dependency that capacity/eligibility handling for this specific trigger (vs. the Commerce/payment trigger INV-006 describes) is not yet confirmed with Enrollment_Aggregate_Design's owner.

## 1. Purpose

This document defines how students gain access to a tutor's workspace.

The platform supports **two distinct admission mechanisms**:

1. **Direct Invitation** — initiated by the tutor for specific students.
2. **Join Request** — initiated by a student using the workspace's public `/join` link or QR code.

These mechanisms must remain conceptually separate because they represent different business intentions and approval models.

The resulting outcome of either mechanism is a **Workspace Membership**.

This document also clarifies how workspace admission relates to course enrollment: they are separate business processes (Section 12), even though the product may combine them into a single convenience workflow for tutors.

---

# 2. Business Concept

A tutor's workspace is the boundary within which students become members and can subsequently participate in classes, courses, lessons, and other learning activities.

Student access follows this model:

```text
                    ┌──────────────────────┐
                    │      Workspace       │
                    └──────────┬───────────┘
                               │
                     Student Access
                               │
                ┌──────────────┴──────────────┐
                │                             │
        Direct Invitation              Join Request
        Tutor initiated                Student initiated
                │                             │
                ▼                             ▼
          Student accepts             Tutor approves
                │                             │
                └──────────────┬──────────────┘
                               ▼
                    Workspace Membership
                               │
                               ▼
                    Course / Class Enrollment
```

*Enrollment is shown here as a step that follows membership; Section 12 refines this — enrollment may be offered together with the invitation (via an Intended Learning Product) but only activates once membership exists.*

## Key Principle

**Workspace membership and course/class enrollment are different concepts.**

A student may be a member of a workspace without being enrolled in a particular class or course.

---

# 3. Student Access Methods

## 3.1 Direct Invitation

A tutor explicitly invites one or more students to join the workspace.

Examples:

- Invite one student by email.
- Invite multiple students by entering multiple email addresses.
- Upload a student list through CSV/Excel.
- Send invitations to a batch of students.

The tutor knows who is being invited.

### Business Flow

```text
Tutor
  │
  │ Invite student(s)
  ▼
Invitation
  │
  │ Send
  ▼
Student
  │
  │ Accept
  ▼
Workspace Membership
```

### Business Meaning

A direct invitation represents:

> "The tutor has explicitly invited this person to become a member of the workspace."

No separate tutor approval should be required after the invited student accepts the invitation.

> **Note:** A direct invitation may optionally be paired with a course enrollment as part of the "Invite & Enroll" convenience workflow. See Section 12 for how these two actions relate.

> **V1 scope — who can invite:** A workspace has a single tutor (its Owner), and only that tutor sends invitations. This document does not define an authorization/permission model for multiple inviters (e.g., co-teachers or assistants) because V1 does not need one. Extending invitation rights beyond the sole tutor is deferred to Future Extensions (Section 20).

---

# 4. Bulk Student Invitation

Bulk invitation is a first-class capability of the direct invitation mechanism.

It is not a separate admission model.

The following entry methods may be supported:

### 4.1 Multiple Email Addresses

The tutor can paste or enter multiple email addresses.

Example:

```text
john@example.com
sara@example.com
ali@example.com
maria@example.com
```

The platform creates an individual invitation for each valid recipient.

---

### 4.2 Student List Import

The tutor can upload a student list.

Example:

```text
Name              Email
--------------------------------
John Smith        john@example.com
Sara Ali          sara@example.com
Ali Hassan        ali@example.com
Maria Jones       maria@example.com
```

The imported records are converted into individual invitations.

---

### 4.3 Invitation Batch

When multiple invitations are created together, the platform should maintain a batch-level concept.

```text
Invitation Batch
│
├── Batch ID
├── Workspace ID
├── Created By
├── Created At
├── Source
├── Total Recipients
├── Sent
├── Accepted
├── Failed
└── Status
```

The batch provides operational visibility without changing the lifecycle of each individual invitation.

Each student still has an independent invitation.

If the batch was created via "Invite + Enroll" (Section 12.3), the same course is applied to every invitation in the batch as its Intended Learning Product — one course per batch, not per student (Section 12.3).

---

# 5. Open to Join Requests

The workspace already provides an **Open to join requests** feature.

The existing UI concept is:

> **Open to join requests**  
> Strangers with your `/join` link can ask to join. You still approve or decline each one.

This feature should remain separate from direct invitations.

## Business Meaning

A join request represents:

> "A person who is not yet a workspace member has requested access to the workspace."

Unlike a direct invitation, the student initiates the process.

---

# 6. Join Link

Each workspace may expose a join URL such as:

```text
http://localhost:3000/join/demo-academy
```

The join link allows a prospective student to reach the workspace's admission page.

The link itself does **not** automatically create workspace membership when open join requests are enabled.

Instead:

```text
Join Link
    │
    ▼
Join Page
    │
    ▼
Student submits request
    │
    ▼
Join Request
    │
    ▼
Tutor approves / declines
```

---

# 7. QR Code

The join URL can also be represented as a QR code.

The tutor can display or share the QR code in situations such as:

- Classroom
- Physical teaching environment
- Presentation
- Social media
- Printed material
- Tutor website
- Online session

The QR code is simply another way to access the workspace join page.

It does not introduce a separate business process.

```text
QR Code
   │
   ▼
Workspace Join URL
   │
   ▼
Join Request
```

### Recommended UI wording

Instead of:

> Scan to request to join

Prefer:

> **QR code for students**

or:

> **Scan to request access**

This makes the purpose clearer from the tutor's perspective.

---

# 8. Join Request Lifecycle

A join request should have its own lifecycle.

```text
Requested
    │
    ├──────────────► Approved
    │                    │
    │                    ▼
    │             Workspace Membership
    │
    └──────────────► Declined
```

Possible operational states:

```text
Pending
Approved
Declined
Expired
Cancelled
```

The exact lifecycle may be refined during detailed domain design.

---

# 9. Direct Invitation Lifecycle

Direct invitations have a different lifecycle from Join Requests.

This is the reconciled Version 1 lifecycle as specified in **Invitation Business Analysis.md §9** (normative for Invitation — see Technical Debt Backlog TD-008): an Invitation reaches exactly one of `Accepted`, `Expired`, or `Cancelled`, never more than one.

```text
Created
   │
   ├──────────────► Cancelled   (sender cancels before ever sending)
   │
   ▼
Sent  ◄─────────────┐
   │                 │ resend
   │                 │ (invalidates old token,
   │                 │  resets expiration)
   ├──────────────► Accepted
   │                    │
   │                    ▼
   │             Workspace Membership
   │
   ├──────────────► Expired
   │
   └──────────────► Cancelled   (sender cancels before acceptance)
```

Notes:

- There is no `Declined` state — an invitee who does not want to join simply lets the Invitation expire, or the sender cancels it. There is no `Failed` state at the Invitation level in Version 1; delivery failure is a Future concern (see Invitation Business Analysis §16).
- Cancel is only available before acceptance. Removing someone who has already become a Member is a Membership concern, not an Invitation one (Section 10).
- Resend invalidates the previous token and resets the expiration date — it does not create a second, parallel Invitation. At most one `Created`/`Sent` Invitation may exist per (invitee email, Workspace) pair.

The important distinction between the two admission mechanisms is:

| Mechanism | Initiated by | Tutor approval after request? |
|---|---|---|
| Direct Invitation | Tutor | No |
| Join Request | Student | Yes |

---

# 10. Workspace Membership

Both admission mechanisms eventually converge on the same business outcome:

```text
Workspace Membership
```

This should be the authoritative representation that the student belongs to the workspace.

The platform should not create two different types of membership depending on how the student joined.

```text
                 ┌──────────────────┐
                 │ Workspace Member │
                 └────────┬─────────┘
                          ▲
             ┌────────────┴────────────┐
             │                         │
       Invitation                 Join Request
       Accepted                  Approved
```

## 10.1 Membership Removal (Out of Scope Here)

This document covers admission only. Ending a membership is a separate concern, owned by `Membership.Remove` (Membership Aggregate Design §13), which is deliberately distinct from cancelling an outstanding Invitation (Section 9): Cancel undoes an offer that was never accepted, while Remove ends a relationship that already exists. Detailed removal/offboarding rules live in Membership Aggregate Design and Workspace_Access_Context, not here.

## 10.2 Existing-Member Edge Case

If an Invitation's or Join Request's target email already resolves to an Identity with an active Membership in the target Workspace, acceptance/approval is rejected as a no-op — the person is told they are already a member rather than a second Membership being silently created (Rule 2; detailed in Invitation Business Analysis, "Acceptance Edge Cases").

---

# 11. Separation from Enrollment

Workspace membership must not be confused with course or class enrollment.

For example:

```text
Student
   │
   ▼
Workspace Membership
   │
   ├── Arabic Beginners
   │       └── Enrollment
   │
   ├── Arabic Intermediate
   │       └── Enrollment
   │
   └── Conversation Club
           └── Enrollment
```

A student can therefore:

- Join the workspace.
- Remain a workspace member.
- Be enrolled in one or more classes.
- Later be enrolled in additional classes.

This separation allows the platform to support different teaching and enrollment models without coupling workspace admission to course enrollment.

This separation is formalized as an explicit product principle in Section 12, which also defines how the product may recombine admission and enrollment into a single convenience workflow without collapsing the underlying business concepts.

---

# 12. Workspace Admission vs. Course Enrollment — Separate but Combinable Actions

## 12.1 Core Distinction

Workspace admission and course enrollment are two different business processes and must remain conceptually separate, even though the product may expose them together through a single convenience workflow.

| Action | Meaning |
|---|---|
| Invite to Workspace | Give the student access to the tutor's workspace |
| Enroll in Course | Give the student access/participation in a particular course |
| Invite + Enroll | Convenience workflow that performs both actions together |

This extends the principle already established in Section 11 (workspace membership and course enrollment are different concepts) to the actions that produce them: inviting a student and enrolling a student are separate actions, even when the product lets a tutor trigger both at once.

## 12.2 Why the Distinction Matters

Keeping the actions separate at the business level — while allowing the UI to combine them — has several consequences:

- The invitation and join-request mechanisms described in Sections 3–9 remain unchanged and continue to produce only a Workspace Membership.
- Enrollment remains its own business process, governed by its own rules (course capacity, prerequisites, schedule, pricing, and so on), independent of how the student arrived at the workspace.
- A tutor can invite a student to the workspace without enrolling them in anything, enroll an existing workspace member into a course without re-inviting them, or do both in a single convenience step.
- Future design of classes, courses, enrollment, student groups, and permissions can build directly on this separation without needing to reconcile invitation logic with enrollment logic.

## 12.3 Invite + Enroll — Convenience Workflow

The product may offer a combined workflow so tutors are not forced to perform two separate actions when they already know which course the invited students belong to.

Example flow:

```text
Invite Students
    │
    ▼
Select students
☑ Sarah
☑ John
☑ Maria
    │
    ▼
○ Add to workspace only
● Enroll them in a course

Course:
[ Arabic Beginners ▼ ]

[ Send Invitations ]
```

**V1 decision:** one course applies to the entire batch. When the tutor chooses "Enroll them in a course," the selected course is set as the Intended Learning Product on every Invitation created in that batch — there is no per-student course selection within a single bulk invite. A tutor who needs to enroll different groups of students into different courses runs the "Invite Students" flow separately per course (i.e., one batch per course, not one mixed batch). Per-student course assignment within a single batch is deferred to Future Extensions (Section 20) if it turns out to be needed.

Business meaning of this flow:

```text
Invite + Enroll
    │
    ├── Invite to Workspace   (always performed)
    │
    └── Enroll in Course      (performed only if the tutor opts in)
```

Under the hood, this convenience workflow does not introduce a new domain concept. It reuses fields/states that already exist for exactly this purpose:

1. An Invitation (Section 3) is created and sent for each selected student. Its optional **Intended Learning Product** field (Invitation Business Analysis §7, adopted from IdentityAndWorkspaceAccess §1) is set to the selected course if the tutor chose "Enroll them in a course," and left empty otherwise. No Enrollment record exists yet at this point.
2. When the student accepts the Invitation, the Workspace Membership is created and activated (Section 10).
3. Only once the Membership is Active does the Enrollment get created, in the **Invited** state (Enrollment_Aggregate_Design §"Status"), referencing the Intended Learning Product from step 1. This ordering is required, not just a convenience: Enrollment_Aggregate_Design INV-002 states an Enrollment cannot be created without an active Workspace Membership, so the Enrollment must not be created at invite time — only the Intended Learning Product field can exist before membership.
4. The Enrollment then moves from `Invited` toward `Active` subject to eligibility rules Enrollment_Aggregate_Design owns (§14, INV-006) — for example, course capacity. Reaching `Invited` is not a guarantee of `Active`.

> **Open dependency:** INV-006 states this explicitly for the Commerce/payment trigger ("a completed payment does not automatically guarantee an Active Enrollment"). It is a reasonable assumption that the same principle holds when activation is triggered by Invite + Enroll instead of payment, but Enrollment_Aggregate_Design does not say so directly, and what happens to an Invited Enrollment that fails eligibility (e.g., a full course) is not fully specified — capacity-based Waitlisting is listed there as Future Evolution (§18), not a built mechanism. This document does not attempt to resolve that; it should be confirmed with whoever owns Enrollment_Aggregate_Design before Invite + Enroll is built against a capacity-constrained course.

This document should not maintain its own description of the Enrollment mechanism beyond this sequencing; Invitation Business Analysis and Enrollment_Aggregate_Design are the source of truth for the field, the state, and the transition rules.

## 12.4 Principle Statement

> Workspace admission and course enrollment are separate business processes, while the product may provide a combined "Invite & Enroll" workflow for tutor convenience.

This principle should be treated as a foundational constraint for the subsequent design of classes, courses, enrollment, student groups, and permissions.

---

# 13. UI Structure

The workspace settings should present student access as a single business area.

## Student Access

### Invite Students

```text
Invite students

Send invitations directly to students.

[ Invite students ]
```

The invitation flow can then offer:

```text
Invite students

○ Enter email addresses
○ Import student list
```

After the tutor selects students, the flow may offer the "Invite + Enroll" convenience step described in Section 12.3, letting the tutor choose between admitting students to the workspace only, or admitting and enrolling them in a specific course in one action.

---

### Pending Invitations

The tutor needs somewhere to see outstanding invitations and act on them — Section 9 defines Cancel and Resend as core Invitation capabilities, so the UI must expose both, not just the "send" step.

```text
Pending Invitations

Name / Email          Course              Status     Sent
──────────────────────────────────────────────────────────
Sarah <sarah@…>        Arabic Beginners    Sent       2 days ago    [ Resend ] [ Cancel ]
John <john@…>           —                  Sent       2 days ago    [ Resend ] [ Cancel ]
Maria <maria@…>        Arabic Beginners    Expired    9 days ago    [ Resend ]
```

Behavior follows Section 9 directly:

- **Resend** is only available for `Sent` or `Expired` invitations. It invalidates the previous token and resets the expiration date rather than creating a second invitation.
- **Cancel** is only available for `Created` or `Sent` invitations (i.e., before acceptance). Once an invitation is `Accepted`, this view no longer shows it — the student is now a Workspace Member, and any further change is a Membership action (Section 10.1), not an Invitation one.
- The **Course** column reflects the Intended Learning Product set at invite time (Section 12.3), if any.

---

### Open to Join Requests

```text
Open to join requests

Anyone with your join link can request
access to this workspace.

You still approve or decline each request.

[ On / Off ]
```

When enabled:

```text
Join link

http://localhost:3000/join/demo-academy

[ Copy link ]    [ Show QR code ]
```

When disabled:

```text
Open to join requests

Turned off

Students cannot request to join using
the workspace join link.

You can still invite students directly.
```

---

# 14. Recommended Student Access Dashboard

The tutor should be able to see the two mechanisms independently.

```text
Student Access
────────────────────────────────────────

Invite Students
Send invitations directly to specific students.

[ Invite Students ]


Pending Invitations
Invitations sent but not yet accepted.

Pending: 2   Expired: 1

[ Manage Invitations ]


Join Requests
Students can request access using your
workspace join link.

Pending requests: 4

[ Review Requests ]


Open to Join Requests
Anyone with the join link can request access.

● Enabled

Join link:
http://localhost:3000/join/demo-academy

[ Copy Link ] [ Show QR Code ]
```

---

# 15. Domain Model

At the business level, the core concepts are:

```text
Workspace
    │
    ├── Invitation
    │       └── Invitation Batch
    │
    ├── Join Request
    │
    ├── Workspace Membership
    │
    └── Course Enrollment
```

### Invitation

Represents an explicit invitation issued by the tutor. Carries an optional **Intended Learning Product** field, which is how "Invite + Enroll" (Section 12) is represented without a separate merged concept.

### Invitation Batch

Groups multiple invitations created as one bulk operation.

### Join Request

Represents a request initiated by a prospective student.

### Workspace Membership

Represents the actual student's membership in the workspace.

### Course Enrollment

Represents a student's participation in a specific course or class. It is a separate concept from Workspace Membership, produced by its own business process (Section 12), and may be triggered independently or bundled with a workspace invitation via the "Invite + Enroll" convenience workflow.

---

# 16. Key Business Rules

## Rule 1 — Different intentions

An invitation and a join request must remain separate concepts.

```text
Invitation  = Tutor invites
Join Request = Student asks
```

---

## Rule 2 — One membership

Regardless of the admission method, a student should have one workspace membership.

The system must prevent duplicate active memberships. See Section 10.2 for the existing-member edge case (acceptance/approval is a no-op, not an error) when the invitee already has one.

---

## Rule 3 — Admission precedes enrollment

A student must become a workspace member before being treated as a workspace student for normal learning activities.

Enrollment is a subsequent business process.

---

## Rule 4 — Bulk invitation creates individual invitations

A bulk operation must not create one shared invitation representing multiple students.

Instead:

```text
Invitation Batch
      │
      ├── Invitation #1
      ├── Invitation #2
      ├── Invitation #3
      └── Invitation #4
```

Each invitation has its own status.

---

## Rule 5 — Join link does not equal membership

Possession of the `/join` link does not automatically make someone a member when join requests are enabled.

The student must submit a request and the tutor must approve it.

---

## Rule 6 — QR code does not create a new admission mechanism

The QR code is simply an alternative representation of the workspace join URL.

---

## Rule 7 — Turning off join requests does not invalidate direct invitations

The tutor may disable public join requests while continuing to invite students directly.

---

## Rule 8 — Existing members are not affected by disabling join requests

Turning off:

> Open to join requests

must prevent new join requests but must not remove existing workspace members.

---

## Rule 9 — Admission and enrollment actions are separate but combinable

"Invite to Workspace" and "Enroll in Course" are distinct business actions with distinct outcomes (Workspace Membership vs. Course Enrollment).

The product may offer an "Invite + Enroll" convenience workflow that triggers both actions together, but this must be implemented as a composition of the two underlying mechanisms that already exist for it — the Invitation's Intended Learning Product field and the Enrollment `Invited` status (Section 12.3) — not as a new, merged domain concept. Per Enrollment_Aggregate_Design INV-002, the Enrollment record itself must not be created until the corresponding Workspace Membership is active (see Rule 3) — before that, only the Invitation's Intended Learning Product field exists. Once created, the Enrollment reaching `Invited` does not guarantee it reaches `Active`; that is subject to Enrollment_Aggregate_Design's eligibility rules (Section 12.3).

---

# 17. Business Terminology

The platform should consistently use the following terminology.

| Term | Meaning |
|---|---|
| Workspace | Tutor's learning environment |
| Workspace Membership | Student's membership in the workspace |
| Invitation | Tutor-initiated request for a specific student to join |
| Invitation Batch | Group of invitations created through one bulk operation |
| Join Request | Student-initiated request to join |
| Join Link | URL used to access the workspace join page |
| QR Code | QR representation of the join link |
| Enrollment | Student's participation in a specific course/class |
| Invite to Workspace | Action of granting a student access to the workspace |
| Enroll in Course | Action of granting a student participation in a specific course |
| Invite & Enroll | Convenience workflow that performs both "Invite to Workspace" and "Enroll in Course" together |
| Student | This document's term for **Learner**, used elsewhere in the platform's domain model (Identity & Workspace Access documents) |
| Course / Class | This document's term for **Learning Product**, used elsewhere in the platform's domain model (Learning Product Aggregate Design) |

Avoid using **Invitation** as a generic term for all student access mechanisms.

---

# 18. End-to-End Access Model

The final business model is:

```text
                         WORKSPACE
                             │
                     Student Access
                             │
             ┌───────────────┴───────────────┐
             │                               │
             ▼                               ▼
      DIRECT INVITATION                JOIN REQUEST
       Tutor initiated                Student initiated
             │                               │
      ┌──────┴──────┐                        │
      │             │                        │
    Single        Bulk                  Join Link
      │             │                        │
      │       ┌─────┴─────┐                  │
      │       │           │                  │
      │     Emails      Import               │
      │       │           │                  │
      └───────┴─────┬─────┘                  │
                    │                        │
                    ▼                        ▼
              Invitation              Join Request
                    │                        │
        (optional: + Enroll in Course)       │
                    │                        │
                    │ Accept                 │ Approve
                    │                        │
                    └──────────┬─────────────┘
                               ▼
                    WORKSPACE MEMBERSHIP
                               │
                               ▼
                         ENROLLMENT
                       (direct, or activated
                      from a queued Invite +
                        Enroll selection)
                               │
                               ▼
                     LEARNING EXPERIENCE
```

---

# 19. Recommended Product Decision

The platform should support **both** mechanisms as complementary capabilities:

### Direct Invitation

Best when the tutor knows exactly who should have access.

**Tutor → Student**

### Open Join Requests

Best when the tutor wants prospective students to discover and request access.

**Student → Tutor**

### Bulk Invitation

Best when the tutor already has a group of students and needs to onboard them efficiently.

**Tutor → Many Students**

The three capabilities therefore solve different business problems and should not be merged into one generic "Join" mechanism.

In addition, the platform should support both **workspace invitation** and **course-specific enrollment** as distinct actions (Section 12), while offering an **"Invite + Enroll"** convenience workflow that composes them for tutors who already know which course their invited students belong to. This keeps the underlying business concepts clean — invitation, membership, and enrollment each remain independently meaningful — while still giving tutors the shortcut they expect in the UI.

---

# 20. Future Extensions

The architecture should leave room for future access mechanisms without changing the membership model.

Potential future mechanisms include:

- Class-specific invitation links
- Course enrollment links
- Organization-managed student provisioning
- Admin-created memberships
- Temporary access links
- Domain-based automatic admission
- SSO-based workspace access
- Multi-inviter authorization — a permission model for who besides the sole workspace tutor (Owner) may send invitations, e.g. co-teachers or assistants (Section 3.1)
- Per-student course assignment within a single bulk invitation batch, if one-course-per-batch (Section 12.3) proves insufficient

All such mechanisms should ultimately resolve to the same concept:

```text
Workspace Membership
```

This keeps **identity, admission, membership, and enrollment** cleanly separated and allows the platform to evolve without redesigning the workspace access model.

The separation between admission actions and enrollment actions (Section 12) is likewise expected to hold as new access mechanisms are introduced: any future mechanism should be describable as producing a Workspace Membership, a Course Enrollment, or a convenience composition of the two — never a new merged concept.
