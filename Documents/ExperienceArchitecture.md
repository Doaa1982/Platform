# Experience Architecture

Version: 2.0

Status: Foundation

> **Revision Note (v2.0):** This document has been reconciled with the platform's core terminology. Version 1.0 used "Workspace" to mean a role-based user interface surface and "Business Domains" to mean top-level actors (Learner, Educational Provider, Organization). Both usages collided with established platform vocabulary, where **Workspace** exclusively means an independent tenant academy (see Workspace Context, Learning Workspace Domain Language & Business Ontology) and business responsibilities are owned by named **Bounded Contexts** (see Learning Workspace Bounded Context Map). This revision renames the UI-surface concept to **Portal** and replaces the invented "Business Domains" with references to the platform's actual Bounded Contexts. No structural ideas have been removed — only vocabulary that conflicted with the rest of the architecture.

---

# Purpose

The Experience Architecture defines how Members interact with the Learning Workspace Platform through role-appropriate user interfaces.

While Bounded Contexts define business rules and capabilities, Experience Architecture defines how those capabilities are presented through cohesive user experiences.

A Portal does not own business data or business rules.

Instead, it orchestrates capabilities from multiple Bounded Contexts into intuitive workflows that help users accomplish meaningful educational goals.

---

# Objectives

The Experience Architecture aims to:

- Provide consistent user experiences across all applications.
- Separate user experience from business logic.
- Encourage reusable business capabilities.
- Support multiple client applications.
- Enable future expansion without redesigning core Bounded Contexts.

---

# Design Philosophy

The platform follows four architectural layers:

```text
Learning Workspace Platform

↓

Bounded Contexts

↓

Business Capabilities

↓

Portal Layer

↓

Applications
```

Each layer has a distinct responsibility.

Business rules remain within Bounded Contexts.

Portals orchestrate those rules without duplicating them.

Applications provide the visual interface for each Portal.

---

# Core Principles

## Business First

Business rules always belong to Bounded Contexts.

Portals consume business capabilities but never redefine them.

---

## User-Centered

Portals are organised around user intentions rather than technical modules.

Examples include:

- Discover learning opportunities.
- Continue learning.
- Track progress.
- Communicate with tutors.
- Plan future learning.

---

## Composable

Every Portal is assembled from reusable capabilities provided by Bounded Contexts.

A single capability may appear in multiple Portals.

---

## Technology Independent

Experience Architecture is independent of:

- Web
- Mobile
- Desktop
- APIs
- UI Frameworks

The same Portal may be implemented across multiple platforms.

# Experience Model

Every Portal is composed of four elements.

```text
User Intention

↓

Portal

↓

Business Capabilities

↓

Bounded Contexts
```

---

## User Intention

A User Intention describes what the user wants to accomplish.

Examples include:

- Learn something new.
- Continue studying.
- Find a tutor.
- Join a community.
- Review progress.

Portals are designed around intentions rather than menus.

---

## Portal

A Portal provides a unified environment that helps users accomplish related goals.

Examples include:

- Learner Portal
- Workspace Owner Portal
- Organization Portal
- Administrator Portal

A Portal orchestrates multiple Business Capabilities. A Portal is a presentation-layer concept only — it must never be confused with a **Workspace** (the independent tenant academy defined in Workspace Context), which every Portal operates inside of.

---

## Business Capabilities

Business Capabilities provide reusable functionality.

Examples include:

- Marketplace
- Enrollment
- Learning Experience
- Analytics
- Communication
- AI Intelligence

Business Capabilities may support multiple Portals.

---

## Bounded Contexts

Bounded Contexts own business rules and business data.

Relevant contexts for the Portal Layer include:

- Membership Context (Learner, Workspace Owner, and other workspace roles)
- Workspace Context (Workspace identity and configuration)
- Learning Product Context
- Learning Delivery Context
- Enrollment Context
- AI Context (referred to here as AI Intelligence)
- Assessment Context
- Organization Context (future)

Bounded Contexts never depend on Portals.

---

# Architectural Flow

```text
Bounded Context

↓

Business Capability

↓

Portal

↓

Application
```

Each layer builds upon the previous layer without violating ownership boundaries.

# Portals

A Portal is the primary entry point through which a Member interacts with the Learning Workspace Platform, always within the context of a single Workspace.

Portals do not own business rules.

Instead, they coordinate multiple capabilities into a coherent user experience.

---

## Learner Portal

Purpose:

Support learners throughout their educational journey.

Examples:

- Dashboard
- Discover
- My Learning
- Calendar
- Messages
- Portfolio
- AI Companion

---

## Workspace Owner Portal

Purpose:

Support Workspace Owners in creating, delivering, and improving educational experiences.

> Note: "Workspace Owner" is the platform's standard term for the business-owning role, consistent with the Learning Workspace Domain Language & Business Ontology. "Tutor" refers only to the pedagogical/teaching role a Member may hold within a Workspace, not to business ownership.

Examples:

- Teaching Dashboard
- Learners
- Programs
- Courses
- Units
- Analytics
- Reviews
- AI Co-pilot

---

## Organization Portal

Purpose:

Support educational organizations in managing people, resources, quality, and operations.

Examples:

- Organization Dashboard
- Staff
- Teams
- Resources
- Reports
- Branding
- Organization Analytics

---

## Administrator Portal

Purpose:

Support platform-wide administration and governance.

Examples:

- User Management
- Moderation
- Marketplace Management
- System Configuration
- Platform Analytics
- Security

---
