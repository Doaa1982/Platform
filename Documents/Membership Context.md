# Membership Context

**Version:** 1.0 (Draft)

**Bounded Context Type:** Supporting Domain

**Domain Classification:** Strategic Supporting Context

**Related Documents**

- Learning Workspace Domain Language & Business Ontology
- Workspace Context
- Learning Workspace Capability Model
- Learning Workspace Value Streams

---

# 1. Context Purpose

## Definition

The Membership Context manages the relationship between people and Learning Workspaces.

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

The Membership Context owns:

- Workspace membership
- Membership lifecycle
- Workspace roles
- Access relationship
- Invitations
- Membership status

---

# 4. Core Concepts

---

# 4.1 Platform Identity

## Definition

A Platform Identity represents a unique person recognised by the platform.

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

# 5. Owned Data

The Membership Context is the source of truth for:

| Data | Owner |
|-|-|
| Workspace Membership | Membership Context |
| Member status | Membership Context |
| Workspace roles | Membership Context |
| Invitations | Membership Context |

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

The Membership Context provides the access relationship between people and workspaces.

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
