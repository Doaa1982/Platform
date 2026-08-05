# Experience Architecture

Version: 2.0

Status: Foundation

> **Revision Note (v2.0):** This document has been reconciled with the platform's core terminology. Version 1.0 used "Workspace" to mean a role-based user interface surface and "Business Domains" to mean top-level actors (Learner, Educational Provider, Organization). Both usages collided with established platform vocabulary, where **Workspace** exclusively means an independent tenant academy (see Workspace Context, Learning Workspace Domain Language & Business Ontology) and business responsibilities are owned by named **Bounded Contexts** (see Learning Workspace Bounded Context Map). This revision renames the UI-surface concept to **Portal** and replaces the invented "Business Domains" with references to the platform's actual Bounded Contexts. No structural ideas have been removed — only vocabulary that conflicted with the rest of the architecture.
>
> **Revision Note (v2.1):** Added "Application Strategy" (ADR-EA-001) resolving the "one app vs. two" question left open by Technical Debt Backlog TD-005. Confirms this document's own Portal/Application distinction — "the same Portal may be implemented across multiple platforms" (Design Philosophy, Technology Independent) — already implied the answer; the ADR makes it explicit.

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

> Note: This Portal is the presentation-layer home for the Platform Administrator actor defined in Platform Administrator Business Analysis — Workspace Provisioning, Invitation management, and platform-level Suspend/Reactivate/Archive on Identity and Workspace. See ADR-EA-001 for why it is treated as a separate Application rather than folded into the same Application as the other Portals.

---

# Architecture Decision: Application Strategy

## ADR-EA-001 — One Application Serves the Learner Portal and the Workspace Owner Portal

**Decision:** A single web Application implements both the Learner Portal and the Workspace Owner Portal. Which Portal (or both) a Member sees is resolved per Workspace, from that Member's Workspace-scoped role(s) on Membership — not by which Application they opened.

**Context:** Technical Debt Backlog TD-005 was raised during a "frontend architecture review — one app vs. two" and records no ruling, only the side effect it caused (moving roles off Identity so a Teacher-in-one-Workspace, Learner-in-another Member could be represented at all). This ADR is that ruling.

**Reasoning:**

- Identity is global and carries no role (Identity Aggregate Design); role lives entirely on Membership, scoped per Workspace (Membership Aggregate Design §7). The same Identity may hold Teacher in one Workspace and Learner in another. A hard Application split would require deciding, at the Application boundary, which Portal a person "is" — something the domain model deliberately does not decide globally.
- This document's own Design Philosophy already says Portal and Application are different layers ("Technology Independent... the same Portal may be implemented across multiple platforms," and the Architectural Flow: Bounded Context → Business Capability → **Portal** → **Application**). Two Portals mapping to one Application is consistent with that layering, not an exception to it.
- `GET /api/me` (Platform.Api, `MeController`) already returns every Workspace and the caller's role(s) in each in a single response — an API shape built for one client to switch Portal per Workspace, not for two separately-authenticated clients.
- The existing frontend build (`frontend/src/App.jsx`) already implements both Portals in one Application, selecting between them by role rather than by a separate build or deployment.

**Consequence:** Within the one Application, the Learner Portal and Workspace Owner Portal surfaces should still be code-split/lazy-loaded so a Learner-only session never downloads Workspace Owner Portal code (course authoring, analytics, etc.) — this gets most of the practical benefit people expect from "two apps" (smaller bundles, separated concerns) without contradicting the Identity/Membership model.

**Out of scope for this ADR — Administrator Portal and Organization Portal:** The Administrator Portal is platform-wide by definition (Platform Administrator Business Analysis, Section 1: "operates the platform itself, not any single Workspace"), unlike Learner and Workspace Owner Portals, which are always entered within one Workspace (Portals, above: "always within the context of a single Workspace"). That's a real architectural difference, not just a role difference, and is a reasonable candidate for its own separate Application — distinct auth surface, no reason for a Tutor's or Learner's bundle to ever carry platform-admin code. Organization Portal is similarly not addressed here (Organization Context is marked Future). Neither is decided by this ADR; both are named so they aren't mistaken for having been decided here.

---

## ADR-EA-002 — Platform Root: Who It's For, Since It Isn't Learners

**Decision:** `https://platform.com/` is a real, minimal public page whose only job is converting a Prospective Tutor into an applicant — not routing several kinds of visitor to several destinations. It is not a marketing site design exercise, and it is not a bare redirect either.

**Context:** ADR-WE-001 (IdentityAndWorkspaceAccess, "Workspace-First Entry") establishes that learners never begin their journey at a platform home page — they always arrive through a Workspace Entry Point. That rule is scoped to learners only. It says nothing about a Prospective Tutor, a returning user who lands here instead of their Workspace URL, or a Platform Administrator — and nothing else in the corpus fills that space. Logged as Technical Debt Backlog TD-013.

**Who lands here, and what they see:**

- **Prospective Tutor, no relationship with the platform yet.** The page's only call to action: "Become a Tutor" (or equivalent framing — "Start for free"), leading into the Tutor Signup Request (Platform Administrator Business Analysis, Section 7.1). This is the entire audience the root page is built to convert — see the Business Model Note, below.
- **Returning user with a session, who lands here instead of a Workspace URL** (bookmarked the root, cleared cookies and re-logged in, etc.). Resolved via the existing `GET /api/me`: exactly one Membership routes straight into that Workspace; more than one shows the existing Workspace picker (reused, not rebuilt); zero Memberships falls through to the same single call to action a new visitor sees.
- **Platform Administrator.** Deliberately **not** linked from this page. Consistent with ADR-EA-001's note that the Administrator Portal is a candidate for its own separate Application with its own auth surface — advertising an "Admin" entry point on a public page invites exactly the probing that surface should avoid. Admins reach sign-in by a known URL, not by browsing from the root.
- **A visitor who doesn't know what the platform is.** Needs minimal explanatory copy — framed as a pitch to a prospective Tutor, not a neutral description — before the call to action makes sense. Content, not a new business concept; out of scope here.

**Business Model Note — no Workspace discovery, by design, not by omission:** Earlier drafts of this ADR included a second call to action, "Find an Academy," for a Prospective Learner with no target academy in mind, treating platform-wide Workspace discovery as a Future feature merely not yet built. That has been corrected: this platform's paying customer is the Tutor, who brings their own students — the same shape as Shopify, whose root page (shopify.com) sells exclusively to merchants and provides no consumer-facing directory of Shopify stores at all. A shopper only ever reaches a specific store through that merchant's own link or domain, never through Shopify itself. This platform adopts the same posture deliberately: the root page never offers Workspace discovery, search, or a directory, in this or any future version, because doing so would put the platform in competition with its own paying customers for their students' attention. See Join Request Business Analysis, BA-007, which resolves the corresponding "where requesters find Workspaces" question the same way.

**Rules:**

- Un-authenticated content is exactly one call to action — Become a Tutor — plus minimal explanatory copy pitched at that Tutor. Not a full marketing site, and never a second, discovery-oriented call to action.
- The root page never lists or links a Platform Administrator entry point.
- The root page never offers a Workspace directory, search, or "browse academies" feature of any kind — this is a permanent product decision, not a deferred one.
- An authenticated visitor holding one or more Memberships is never shown the un-authenticated content; they are routed via the existing `GET /api/me` shape, not a new endpoint.

**Out of scope:** Visual design; the Platform Administrator's own sign-in surface (ADR-EA-001 named it as a candidate, not decided here either).

---
