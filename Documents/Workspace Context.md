# Workspace Context

**Version:** 1.0 (Draft)

**Bounded Context Type:** Core Domain

**Domain Classification:** Strategic Core

**Related Documents**

- Learning Workspace Domain Language & Business Ontology
- Learning Workspace Capability Model
- Learning Workspace Value Streams
- Learning Workspace Core Domain Analysis

---

# 1. Context Purpose

## Definition

The Workspace Context manages the existence and identity of an independent Learning Workspace.

It defines the business boundary within which educational operations take place.

A Learning Workspace represents an independent educational business operating on the platform.

---

# 2. Business Responsibility

The Workspace Context answers:

> "What is this educational business?"

It owns:

- Workspace existence
- Workspace identity
- Workspace lifecycle
- Workspace ownership
- Workspace configuration boundary
- Workspace operational status

---

# 3. Core Concepts

## 3.1 Workspace

### Definition

A Workspace is the primary business entity representing an independent educational organisation or educator business.

---

### Responsibilities

A Workspace:

- exists independently;
- owns business operations;
- defines its operational boundary;
- provides the root context for learning activities;
- controls access to workspace capabilities.

---

### Lifecycle

```
Created

↓

Configuring

↓

Active

↓

Suspended

↓

Archived

↓

Deleted
```

---

## 3.2 Workspace Owner

### Definition

The Workspace Owner is the person or organisation that owns and controls a Learning Workspace.

---

### Responsibilities

The Workspace Owner:

- creates the workspace;
- manages ownership;
- controls workspace-level decisions;
- assigns operational responsibilities.

---

### Business Rules

- Every workspace has exactly one owner.
- Ownership is separate from daily operational roles.
- A workspace owner may delegate permissions without transferring ownership.

---

## 3.3 Workspace Identity

### Definition

Workspace Identity represents how a workspace is recognised as a unique educational business.

---

### Includes

- Workspace name
- Public identifier
- Description
- Contact information
- Business profile
- Visibility settings

---

### Does Not Include

Brand design belongs to the Experience domain.

---

## 3.4 Workspace Configuration

### Definition

Workspace Configuration defines how a workspace behaves.

---

### Includes

- Language preferences
- Time zone
- Regional settings
- Learning preferences
- Default behaviours
- Enabled capabilities

---

### Example

Two workspaces may configure different defaults:

Workspace A:

```
Self-paced learning
Recorded lessons
Weekly assessments
```

Workspace B:

```
Live tutoring
Daily homework
Parent reports
```

Both use the same platform.

---

# 4. Owned Data

The Workspace Context is the source of truth for:

| Data | Owner |
|---|---|
| Workspace | Workspace Context |
| Workspace lifecycle | Workspace Context |
| Workspace owner | Workspace Context |
| Workspace identity | Workspace Context |
| Workspace status | Workspace Context |
| Workspace configuration | Workspace Context |

---

# 5. Data It Does NOT Own

The Workspace Context does not own:

| Data | Owning Context |
|---|---|
| Students | Membership Context |
| Teachers | Membership / Team Context |
| Courses | Learning Product Context |
| Lessons | Learning Delivery Context |
| Payments | Commerce Context |
| Messages | Communication Context |
| Reports | Analytics Context |

---

# 6. Business Rules

## Rule 1 — Workspace Isolation

A workspace cannot access another workspace's private business data.

---

## Rule 2 — Workspace Ownership

Every workspace must have one owner.

---

## Rule 3 — Workspace Independence

A workspace must be able to operate independently from other workspaces.

---

## Rule 4 — Capability Enablement

A workspace may have capabilities enabled or disabled depending on:

- business maturity;
- subscription;
- configuration;
- organisational needs.

---

## Rule 5 — Workspace First Principle

All business operations must belong to a workspace boundary.

---

# 7. Relationships With Other Contexts

## Workspace → Membership Context

The Workspace Context provides the boundary where memberships exist.

Relationship:

```
Workspace

contains

Workspace Memberships
```

---

## Workspace → Learning Product Context

A workspace owns the learning products it creates.

Relationship:

```
Workspace

creates

Learning Products
```

---

## Workspace → Commerce Context

A workspace owns its commercial activity.

Relationship:

```
Workspace

owns

Products
Orders
Revenue
```

---

## Workspace → AI Context

A workspace defines its AI environment.

Relationship:

```
Workspace

configures

AI Behaviour
Knowledge
Policies
```

---

# 8. Context Boundary

The Workspace Context should NOT become a "God Context".

It should not manage:

- learning logic;
- payment logic;
- assessment logic;
- communication logic.

Its responsibility is:

```
Who are we?

Who owns us?

What are our boundaries?

How do we operate?
```

---

# 9. Future Evolution

The Workspace Context should support future scenarios:

## Solo Tutor

```
One owner
One workspace
Few learners
```

---

## Tutoring Company

```
One workspace
Multiple teachers
Multiple teams
```

---

## Academy

```
One workspace
Multiple departments
Large learner population
```

---

## Educational Organisation

```
One workspace
Multiple operational units
Enterprise governance
```

---

# 10. Architectural Notes

The Workspace Context is expected to become a foundational context.

Other contexts should reference Workspace identity but should not duplicate workspace ownership logic.

The Workspace Context provides the tenant boundary for the entire platform.
