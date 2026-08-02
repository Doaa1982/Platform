# Workspace Access Context

**Version:** 1.1 (Draft)

**Bounded Context Type:** Supporting Domain

**Domain Classification:** Strategic Supporting Context

> **Revision Note (v1.1):** This document was previously titled "Membership Context." It has been renamed **Workspace Access Context** and its scope extended to explicitly include Onboarding and Workspace Sessions, aligning it with the canonical Identity/Workspace Access split defined in Identity & Workspace Access Architecture and reflected in the Bounded Context Map (v1.1) and Bounded Context Identification (v1.1). No prior content has been removed — "Membership," "Workspace Membership," and "Member" remain the core concepts owned by this context; only the context's name and boundary documentation have been clarified.

**Related Documents**

- Learning Workspace Domain Language & Business Ontology
- Identity & Workspace Access Architecture (canonical source for the Identity / Workspace Access boundary)
- Workspace Context
- Learning Workspace Capability Model
- Learning Workspace Value Streams

---

# 1. Context Purpose

## Definition

The Workspace Access Context manages the relationship between people and Learning Workspaces.

It answers:

> "Who belongs to this workspace, and what can they do inside it?"

---

# 2. Core Principle

## Global Identity, Local Membership

A person has one platform identity.

That person may have multiple workspace memberships.

Each membership is independent.

Example:

```
Person

Ahmed

↓

Platform Identity

↓

Memberships

├── English Academy
│      Role: Learner
│
├── Coding Academy
│      Role: Parent
│
└── Teacher Training Centre
       Role: Instructor
```

---

# 3. Business Responsibility

The Workspace Access Context owns:

- Workspace membership
- Membership lifecycle
- Workspace roles
- Access relationship
- Invitations
- Onboarding requests
- Workspace sessions
- Membership status

---

# 4. Core Concepts

---

# 4.1 Platform Identity (Reference Only — Owned by Identity Context)

## Definition

A Platform Identity represents a unique person recognised by the platform. This concept is owned entirely by **Identity Context**; it is described here only to clarify the boundary with Workspace Access Context.

It exists independently from any workspace.

---

## Responsibilities

Platform Identity manages:

- Authentication identity
- Personal profile
- Login information
- Global preferences

---

## Does Not Own

Platform Identity does not determine:

- Teaching role
- Learning role
- Permissions
- Workspace access

Those belong to Membership.

---

# 4.2 Workspace Membership

## Definition

A Workspace Membership represents a person's relationship with a specific Learning Workspace.

---

## Example

A person:

```
Sarah
```

may have:

```
Membership 1

Workspace:
English Academy

Role:
Teacher


Membership 2

Workspace:
Math Academy

Role:
Parent
```

---

## Responsibilities

Membership defines:

- Which workspace a person belongs to
- Their status
- Their relationship
- Their assigned roles

---

# 4.3 Member

## Definition

A Member is a person who has an active relationship with a Learning Workspace.

---

## Types of Members

Examples:

- Learner
- Parent
- Tutor
- Instructor
- Administrator
- Assistant
- Content Creator
- Finance Staff

---

Important:

A Member is not a permanent identity type.

It is a workspace-specific role.

---

# 4.4 Workspace Role

## Definition

A Workspace Role defines responsibilities and permissions within a workspace.

---

## Examples

```
Owner

Administrator

Teacher

Assistant Teacher

Learner

Parent

Finance Manager
```

---

## Business Rule

Roles belong to a workspace.

They do not belong to the person globally.

---

# 4.5 Invitation

## Definition

An Invitation represents an intention to create a workspace membership.

---

## Lifecycle

```
Created

↓

Sent

↓

Accepted

↓

Membership Created
```

or

```
Created

↓

Expired
```

---

# 4.6 Onboarding Request

## Definition

An Onboarding Request represents a person's intention to join a Workspace after accepting an Invitation, and exists before Workspace Membership is created.

Onboarding depends on Identity Resolution (determining whether the person already owns an Identity), which is performed by Identity Context. Onboarding never creates a Membership directly — see Identity & Workspace Access Architecture, Section II, for the full lifecycle.

---

# 4.7 Workspace Session

## Definition

A Workspace Session represents an authenticated Identity actively participating inside one specific Workspace. It is created only after Identity authentication succeeds and an active Workspace Membership is validated.

A Workspace Session always belongs to exactly one Workspace and activates that Workspace's branding, navigation, permissions, and AI configuration. See Identity & Workspace Access Architecture, Section II, for the full session lifecycle and creation rules.

---

# 5. Owned Data

The Workspace Access Context is the source of truth for:

| Data | Owner |
|-|-|
| Workspace Membership | Workspace Access Context |
| Member status | Workspace Access Context |
| Workspace roles | Workspace Access Context |
| Invitations | Workspace Access Context |
| Onboarding Requests | Workspace Access Context |
| Workspace Sessions | Workspace Access Context |

---

# 6. Data Not Owned

| Data | Owner Context |
|-|-|
| Person authentication | Identity Context |
| Learning progress | Learning Context |
| Grades | Assessment Context |
| Payments | Commerce Context |
| Messages | Communication Context |

---

# 7. Business Rules

---

## Rule 1 — Membership is Workspace Specific

A person's role in one workspace has no effect on another workspace.

Example:

A teacher in Workspace A is not automatically a teacher in Workspace B.

---

## Rule 2 — One Person Can Have Multiple Memberships

The platform supports multi-workspace participation.

---

## Rule 3 — Membership Must Have a Lifecycle

A membership can be:

```
Invited

↓

Active

↓

Suspended

↓

Removed
```

---

## Rule 4 — Roles Are Not Identity

A person is not:

"Teacher"

or

"Student"

globally.

They have roles within specific contexts.

---

# 8. Relationships

---

# Membership → Workspace

Relationship:

```
Workspace

has

Many Memberships
```

---

# Membership → Identity

Relationship:

```
Platform Identity

creates

Workspace Membership
```

---

# Membership → Learning Context

Example:

A learner membership allows participation in learning activities.

```
Membership

grants access to

Learning Experience
```

---

# Membership → Commerce Context

Example:

A member may purchase products.

```
Membership

may become

Customer
```

---

# 9. Permission Model

Permissions should be derived from:

```
Membership

+

Role

+

Workspace Policies
```

Not from identity alone.

---

Example:

Same person:

```
Platform Identity:
Mohamed
```

Workspace A:

```
Role:
Teacher

Permissions:
Create lessons
Grade students
```

Workspace B:

```
Role:
Parent

Permissions:
View child progress
```

---

# 10. Why This Context Is Important

Many platforms make this mistake:

```
User

has role

Teacher
```

This creates problems.

Because later:

- Teachers become students.
- Parents become learners.
- Tutors create their own academies.
- Organisations share staff.

The correct model is:

```
Person

has memberships

which contain roles

inside workspaces
```

---

# 11. Future Evolution

This context should support:

## Family Accounts

Example:

Parent manages multiple children.

---

## Organisation Membership

Example:

Company employees join corporate training.

---

## Multiple Roles

Example:

A person can be:

```
Teacher + Administrator
```

inside the same workspace.

---

## Temporary Roles

Example:

Guest instructor for one programme.

---

# 12. Architectural Notes

The Workspace Access Context provides the access relationship between people and workspaces.

It should not contain:

- learning logic;
- teaching logic;
- payment logic;
- communication logic.

Its responsibility is:

```
Who belongs here?

What is their relationship?

What role do they have?
```