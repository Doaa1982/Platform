# Student Workspace Access & Admission Architecture

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

Direct invitations have a different lifecycle.

```text
Created
   │
   ▼
Sent
   │
   ├──────────────► Accepted
   │                    │
   │                    ▼
   │             Workspace Membership
   │
   ├──────────────► Declined
   │
   ├──────────────► Expired
   │
   └──────────────► Failed
```

The important distinction is:

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

Business meaning of this flow:

```text
Invite + Enroll
    │
    ├── Invite to Workspace   (always performed)
    │
    └── Enroll in Course      (performed only if the tutor opts in)
```

Under the hood, this convenience workflow still produces the same two underlying outcomes as if the tutor had performed the actions separately:

1. An Invitation (Section 3) is created and sent for each selected student.
2. If the tutor chose "Enroll them in a course," a pending/queued Course Enrollment is associated with the invitation, to be activated once the student accepts the invitation and becomes a Workspace Member (Section 10).

The system must not create the course enrollment before the workspace membership exists — admission still precedes enrollment (Rule 3).

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

Represents an explicit invitation issued by the tutor.

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

The system must prevent duplicate active memberships.

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

The product may offer an "Invite + Enroll" convenience workflow that triggers both actions together, but this must be implemented as a composition of the two underlying actions, not as a new, merged domain concept. A queued course enrollment created through this workflow must not be activated until the corresponding workspace membership exists (see Rule 3).

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

All such mechanisms should ultimately resolve to the same concept:

```text
Workspace Membership
```

This keeps **identity, admission, membership, and enrollment** cleanly separated and allows the platform to evolve without redesigning the workspace access model.

The separation between admission actions and enrollment actions (Section 12) is likewise expected to hold as new access mechanisms are introduced: any future mechanism should be describable as producing a Workspace Membership, a Course Enrollment, or a convenience composition of the two — never a new merged concept.
