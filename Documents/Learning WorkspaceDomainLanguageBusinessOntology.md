# Learning Workspace Domain Language & Business Ontology

**Version:** 1.0 (Draft)

**Status:** Foundational Business Specification

**Author:** Product & Business Analysis

---

# 1. Introduction

## 1.1 Purpose

The **Learning Workspace Domain Language & Business Ontology** defines the official business vocabulary of the Learning Workspace Platform.

It establishes a shared language that is used consistently across:

- Business Analysis
- Product Management
- UX/UI Design
- Domain-Driven Design (DDD)
- Software Architecture
- APIs
- Database Design
- AI Services
- Documentation
- Customer Support

Every business concept used throughout the project must conform to the definitions contained in this document.

This document serves as the single source of truth for business terminology.

---

## 1.2 Why This Document Exists

Traditional Learning Management Systems (LMS) and tutoring platforms often suffer from inconsistent terminology.

For example:

- Tutor vs Teacher vs Instructor
- Student vs User vs Learner
- Course vs Class vs Programme
- Academy vs School vs Organisation

These inconsistencies introduce ambiguity into:

- Business requirements
- Product design
- Software architecture
- User experience
- Database modelling

This document eliminates ambiguity by defining one authoritative business language for the platform.

---

## 1.3 Scope

This document defines:

- Core business concepts
- Standard business terminology
- Business ownership
- Business responsibilities
- Relationships between concepts
- Business rules
- Lifecycle expectations
- Future evolution

This document does **not** define:

- Database schemas
- APIs
- UI layouts
- Technical implementation
- Security architecture

Those artefacts reference this document.

---

# 2. Core Philosophy

The following principles guide every business decision within the platform.

---

## Principle 1 — The Workspace is the Primary Business Entity

The platform exists to enable **Learning Workspaces**.

Every educational activity takes place inside a Learning Workspace.

Nothing educational exists independently of a workspace.

---

## Principle 2 — Every Workspace Represents an Independent Learning Business

Each Learning Workspace represents an independent educational business operating on the platform.

From the learner's perspective, every workspace behaves as its own dedicated learning platform.

The platform provides shared infrastructure while the workspace owns the learner experience.

---

## Principle 3 — Platform Owns Infrastructure, Workspace Owns Experience

The platform provides:

- Infrastructure
- Security
- Hosting
- Authentication
- Shared services

The workspace controls:

- Brand
- Learning experience
- Teaching philosophy
- Communication
- AI behaviour
- Business policies

---

## Principle 4 — Complete Workspace Isolation

Every workspace operates independently.

Its:

- members
- learning products
- branding
- AI configuration
- communication
- community
- analytics
- commerce
- policies

remain isolated from every other workspace unless explicit collaboration is enabled.

---

## Principle 5 — Global Identity, Local Membership

A person has one Platform Identity.

That identity may belong to multiple Learning Workspaces.

Each workspace membership is independent.

The workspace determines:

- permissions
- branding
- learning experience
- progress
- communication
- policies

---

## Principle 6 — Workspaces Must Scale with Their Business

A Learning Workspace may evolve from:

- Solo Tutor

to

- Tutoring Business

to

- Academy

to

- Learning Centre

to

- Educational Organisation

without changing its underlying business model.

---

# 3. Domain Hierarchy

```
Platform
│
├── Learning Workspace
│   ├── Identity
│   ├── Branding
│   ├── Members
│   ├── Learning Products
│   ├── Learning Resources
│   ├── Learning Operations
│   ├── Assessment
│   ├── AI
│   ├── Community
│   ├── Commerce
│   ├── Analytics
│   ├── Policies
│   ├── Automation
│   └── Integrations
│
└── Platform Services
```

---

# 4. Domain Concepts

---

# 4.1 Platform

## Definition

The Platform is the software infrastructure that enables independent Learning Workspaces to operate.

The Platform is **not** a learning institution.

It does not teach learners.

It enables educators and organisations to build and operate their own learning businesses.

---

## Purpose

Provide the shared infrastructure required for independent Learning Workspaces.

---

## Business Responsibilities

The Platform is responsible for:

- Authentication infrastructure
- User identity
- Security
- Hosting
- Compliance
- Billing infrastructure
- Marketplace infrastructure
- AI infrastructure
- Notification infrastructure
- Developer platform
- Platform administration

---

## The Platform Does Not Own

The Platform does **not** own:

- Courses
- Learning products
- Brands
- Academies
- Teaching philosophy
- Educational policies
- Learner experience

These belong to individual Learning Workspaces.

---

## Relationships

The Platform:

- Hosts Learning Workspaces
- Provides shared services
- Provides infrastructure
- Maintains global identity

---

# 4.2 Learning Workspace

> **Status:** Core Domain Concept

---

## Definition

A **Learning Workspace** is the primary business entity of the platform.

It represents an independent educational business that creates, delivers and manages learning experiences.

Every educational activity occurs inside exactly one Learning Workspace.

A Learning Workspace is the operational boundary that owns educational operations.

---

## Purpose

Provide educators and educational organisations with a fully isolated, configurable environment for operating their learning business.

---

## Business Responsibilities

A Learning Workspace owns:

- Identity
- Branding
- Members
- Memberships
- Learning Products
- Learning Resources
- Learning Operations
- Assessments
- Certificates
- Communication
- Community
- Commerce
- Analytics
- Policies
- Automation
- AI Configuration
- Integrations

---

## Business Ownership

Each Learning Workspace has exactly one Workspace Owner.

Operational responsibilities may be delegated to Workspace Members through role-based permissions.

Ownership remains singular.

Future versions may support ownership transfer.

---

## Business Rules

A Learning Workspace:

- exists independently of other workspaces
- owns all educational operations
- owns its own learner experience
- owns its own branding
- owns its own policies
- owns its own AI behaviour
- owns its own analytics
- owns its own commerce
- cannot access another workspace's private data
- may contain multiple educators
- may contain multiple teams
- may contain unlimited learning products

---

## Relationships

A Learning Workspace:

- contains Members
- offers Learning Products
- owns Learning Resources
- manages Learning Operations
- defines Workspace Policies
- configures AI
- generates Analytics
- publishes an Academy

---

## Lifecycle

```
Draft
    ↓
Configuring
    ↓
Private
    ↓
Published
    ↓
Active
    ↓
Growing
    ↓
Archived
    ↓
Deleted
```

---

## Future Evolution

A Learning Workspace may evolve into:

- Tutoring Business
- Learning Centre
- Academy
- Educational Company
- Multi-branch Organisation

without changing its core business identity.

---

# 5. Business Terminology Rules

The following terminology shall be used consistently throughout the project.

| Preferred Term | Avoid |
|---------------|-------|
| Learning Workspace | Tutor Platform |
| Workspace Owner | Tutor (when referring to business ownership) |
| Member | User inside a workspace |
| Workspace Membership | Student Account |
| Workspace Configuration | Tutor Settings |
| Workspace Dashboard | Tutor Dashboard |
| Learning Product | Course (when referring to commercial offerings) |
| Learning Operation | Teaching Process |
| Academy | Public Website |
| Platform Identity | User Account |

---

# 6. Design Principles

Every future business requirement should respect the following principles.

## Business First

The platform enables educational businesses rather than individual software features.

---

## Workspace Autonomy

Every workspace should feel like an independent learning platform.

---

## Shared Infrastructure

Infrastructure is shared.

Experience is not.

---

## Workspace Ownership

Every business asset belongs to a clearly defined owner.

Ownership must never be ambiguous.

---

## Isolation by Default

Business data, branding, communication, AI behaviour and policies are isolated between workspaces.

---

## Scalable Business Model

The business model must support growth from a single educator to a large educational organisation without changing the platform's core concepts.

---

# 7. Next Concepts to Define

The following concepts will be added in future revisions of this document.

1. Academy
2. Workspace Owner
3. Workspace Member
4. Membership
5. Learning Product
6. Learning Resource
7. Learning Operation
8. Workspace Policy
9. Workspace Capability
10. Workspace Configuration
11. Workspace Identity
12. AI Workspace Assistant
13. Educational Team
14. Learning Programme
15. Cohort
16. Community
17. Marketplace
18. Workspace Analytics
19. Workspace Automation
20. Workspace Governance

---
## Future Evolution

A Learning Workspace currently represents both the operational boundary and the public educational identity.

Future versions of the platform may introduce additional public-facing brands (e.g., Academies) within a single Learning Workspace if business requirements justify this separation.
# Document Status

**Current Version:** 1.0 (Draft)

This document establishes the foundational business language of the Learning Workspace Platform.

All future business documents—including the Product Vision, Product Blueprint, Domain Model, Bounded Contexts, Business Rules and User Journeys—shall reference and conform to the terminology and principles defined in this specification.