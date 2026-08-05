# Identity & Workspace Access Architecture

**Version:** 2.1

**Status:** Draft

**Owner:** Business Architecture

**Document Type:** Core Business Architecture

> **Revision Note (v2.1):** Reconciled terminology with the Learning Workspace Domain Language & Business Ontology's rule that "Workspace Owner" is the preferred term when referring to business ownership of a Workspace, and "Tutor" is avoided for that purpose. This document previously used "Tutor" extensively as the business-owner role (GP-008, the "Enable Tutor-Owned Academies" goal, the Workspace definition table, and roughly a dozen narrative references to "the tutor's academy"), all of which have been renamed to "Workspace Owner." Left unchanged: role-list mentions of "Tutor" as a pedagogical role a Member may hold (e.g., "A Person may participate as: Learner, Tutor, Parent"), the "Tutor Portfolio" professional-growth concept (which documents teaching achievements, not business ownership), and "AI Tutor" as a product feature name — all of which are legitimate uses of "Tutor" under the terminology rule.

---

# Purpose

This document defines the business architecture governing how people establish digital identities, authenticate, gain access to Workspaces, participate in educational experiences, and develop long-term professional identities within the Learning Workspace Platform.

Unlike traditional Learning Management Systems (LMS), this platform intentionally separates **Identity** from **Workspace Access**.

Identity belongs to the individual.

Workspace Membership belongs to the Workspace.

Authentication belongs to the platform.

Learning experiences belong to the Workspace.

This separation enables every Workspace Owner to operate what appears to be an independent learning academy while sharing a common platform infrastructure.

---

# Relationship to Other Architecture Documents

This document should be read together with:

- Learning Workspace Architectural Principles
- Learning Workspace Experience Architecture
- Learning Workspace Capability Model
- Learning Workspace Domain Language & Business Ontology
- Learning Workspace Bounded Context Map
- Learning Product Context
- Learning Delivery Context

This document focuses specifically on **identity, authentication, workspace access, onboarding, and participation**.

---

# Business Goals

The Identity & Workspace Access Architecture exists to achieve the following business goals.

## Enable Workspace-Owner Academies

Every Workspace Owner should operate an independent academy with complete ownership of their learner relationships.

---

## Hide Platform Complexity

Learners should never need to understand the platform architecture.

The platform remains invisible throughout the educational experience.

---

## Eliminate Duplicate Accounts

A learner should own one digital identity regardless of the number of Workspaces they join.

---

## Preserve Workspace Independence

Although identities are shared globally, every Workspace behaves as an independent academy.

---

## Support Long-Term Professional Identity

A person's achievements, reputation, experience, certifications and professional history should remain with the individual throughout their lifetime.

---

# Guiding Principles

## GP-001 Identity Belongs to the Individual

Identity is never owned by a Workspace.

Identity remains with the individual regardless of organizations, tutors, employers or educational institutions.

---

## GP-002 Authentication Belongs to the Platform

Authentication is provided as shared platform infrastructure.

Workspaces never authenticate users directly.

---

## GP-003 Workspace Membership Belongs to the Workspace

Each Workspace owns its own learner relationships.

Membership is independent of Identity ownership.

---

## GP-004 The Platform is Invisible

Learners never enter the platform.

Learners always enter a Workspace.

The platform exists only as infrastructure.

---

## GP-005 One Identity — Many Workspace Memberships

A single Identity may participate in many Workspaces.

Each Workspace manages its own relationship with that Identity.

---

## GP-006 One Active Workspace Experience

A learner interacts with exactly one Workspace at a time.

Every educational interaction occurs inside an active Workspace Session.

---

## GP-007 Identity Never Leaks Across Workspaces

A Workspace never gains visibility into memberships belonging to other Workspaces.

Each Workspace only knows its own relationship with the learner.

---

## GP-008 Workspace Owner Owns the Educational Relationship

Workspace Owners own:

- Courses
- Learner relationships
- Communication
- AI configuration
- Branding
- Learning experience

The platform owns infrastructure only.

---

## GP-009 Credentials Never Belong to Workspaces

Passwords and authentication credentials belong only to the Identity.

Tutors never create, own, or know learner passwords.

---

## GP-010 Learning Begins Inside the Workspace

Authentication alone never starts learning.

Learning begins only after a Workspace Session has been established.

---

# High-Level Architecture

The platform separates infrastructure responsibilities from educational experiences.

```text
                    Learning Workspace Platform

 ┌────────────────────────────────────────────────────────────┐
 │                    Shared Infrastructure                    │
 ├────────────────────────────────────────────────────────────┤
 │ Identity                                                   │
 │ Authentication                                              │
 │ Credentials                                                 │
 │ External Login Providers                                    │
 │ Identity Resolution                                         │
 └────────────────────────────────────────────────────────────┘
                           │
                           ▼
 ┌────────────────────────────────────────────────────────────┐
 │                  Workspace Access Layer                     │
 ├────────────────────────────────────────────────────────────┤
 │ Invitations                                                 │
 │ Onboarding                                                  │
 │ Workspace Membership                                        │
 │ Enrollment                                                  │
 │ Workspace Session                                           │
 └────────────────────────────────────────────────────────────┘
                           │
                           ▼
 ┌────────────────────────────────────────────────────────────┐
 │                 Workspace Experience                        │
 ├────────────────────────────────────────────────────────────┤
 │ Dashboard                                                   │
 │ Courses                                                     │
 │ Interactive Lessons                                         │
 │ AI Tutor                                                    │
 │ Certificates                                                 │
 │ Communication                                                │
 │ Community                                                    │
 │ Assessments                                                  │
 └────────────────────────────────────────────────────────────┘
```

Only the **Workspace Experience** is visible to learners.

Everything above it is infrastructure.

---

# Core Business Concepts

| Concept | Description |
|----------|-------------|
| Person | A real human being participating in the platform. |
| Identity | The globally unique digital identity representing a Person. |
| Credential | Authentication mechanism belonging to an Identity. |
| Workspace | An independent learning academy operated by a Workspace Owner or organization. |
| Workspace Invitation | An invitation allowing a Person to join a Workspace. |
| Onboarding Request | A pending registration initiated from an invitation. |
| Identity Resolution | Business process that determines whether the person already has an Identity. |
| Workspace Membership | Business relationship between an Identity and a Workspace. |
| Enrollment | Registration into learning products within a Workspace. |
| Workspace Session | Active educational context inside a Workspace. |
| Workspace Experience | The complete branded learning environment delivered by a Workspace. |

---

# Identity vs Workspace Ownership

One of the most important architectural decisions is separating Identity ownership from educational ownership.

| Platform Owns | Workspace Owns |
|---------------|----------------|
| Identity | Membership |
| Credentials | Courses |
| Authentication | Learner Relationship |
| Passwords | Communication |
| External Login Providers | Branding |
| Identity Resolution | AI Configuration |
| Security | Learning Experience |

This separation allows a learner to participate in multiple Workspaces while each Workspace Owner experiences complete ownership of their own academy.

---

# Document Structure

## SECTION I — Identity

Defines the lifelong digital identity of a person.

Topics include:

- Person
- Identity
- Credentials
- Profile
- Professional Identity
- Reputation
- Verification

---

## SECTION II — Workspace Access

Defines how an Identity gains access to a Workspace.

Topics include:

- Workspace Invitation
- Onboarding Request
- Identity Resolution
- Workspace Membership
- Enrollment
- Workspace Session
- Workspace Access Lifecycle

---

## SECTION III — Professional Growth

Defines the long-term professional assets attached to an Identity.

Topics include:

- Tutor Portfolio
- Organization Portfolio
- Achievements
- Professional History
- Public Presence

---

## SECTION IV — Business Rules

Defines enterprise-wide rules governing identity, authentication, workspace participation, and educational ownership.

---

# SECTION I — Identity

---

# 1. Person

## Purpose

A **Person** represents a real human being participating in the Learning Workspace ecosystem.

The Person is the foundation of the Identity model.

Every digital identity, professional profile, membership, achievement, and educational history ultimately belongs to a Person.

The platform does not create people.

The platform creates **Identities** that represent people.

---

## Principles

A Person:

- exists independently of the platform
- may have one Identity
- may participate in multiple Workspaces
- owns their professional history
- owns their achievements
- owns their credentials
- never belongs to a Workspace

---

## Business Characteristics

A Person may participate as:

- Learner
- Tutor
- Parent (future)
- Organization Member
- Organization Administrator
- Reviewer
- Mentor
- Content Creator
- Marketplace Seller
- Platform Administrator

Roles describe participation.

They do not define Identity.

---

## Business Rules

| Rule | Description |
|-------|-------------|
| ID-001 | Every Identity represents exactly one Person. |
| ID-002 | A Person may participate in many Workspaces. |
| ID-003 | A Person never belongs to a Workspace directly. |
| ID-004 | Workspace relationships are established through Workspace Membership. |

---

# 2. Identity

## Purpose

Identity is the globally unique digital representation of a Person.

Identity provides continuity across every Workspace the Person joins throughout their lifetime.

Identity is independent from:

- Tutor
- Organization
- Workspace
- Employer
- Educational Institution

Identity remains valid even if every Workspace Membership is removed.

---

## Responsibilities

Identity is responsible for:

- Authentication
- Credentials
- Security
- Professional ownership
- Global profile
- Verification
- Professional reputation

Identity is NOT responsible for:

- Courses
- Enrollments
- Workspace branding
- Learning progress
- Tutor relationships

These belong to the Workspace.

---

## Identity Lifecycle

```text
Person

↓

Identity Created

↓

Credential Registered

↓

Identity Verified

↓

Professional Growth

↓

Identity Maintained

↓

Identity Archived
```

Identity exists independently from any Workspace.

---

## Business Rules

| Rule | Description |
|-------|-------------|
| ID-101 | Every Person owns one global Identity. |
| ID-102 | Identity is platform-owned infrastructure. |
| ID-103 | Identity never belongs to a Workspace. |
| ID-104 | Identity survives Workspace removal. |
| ID-105 | Identity may participate in many Workspaces. |

---

# 3. Credentials

## Purpose

Credentials authenticate an Identity.

Credentials never authenticate a Workspace Membership.

This distinction is fundamental to the architecture.

Authentication answers:

> Who are you?

Workspace Membership answers:

> Which academy are you entering?

---

## Supported Credential Types

### Email & Password

Primary authentication mechanism.

---

### Google Login

Future capability.

---

### Microsoft Login

Future capability.

---

### Apple Login

Future capability.

---

Multiple credentials may authenticate the same Identity.

---

## Credential Ownership

```text
Identity

├── Email + Password

├── Google

├── Microsoft

└── Apple
```

Credentials never belong to:

- Workspace
- Tutor
- Organization

---

## Password Ownership

Passwords belong exclusively to the Identity.

Tutors never:

- create passwords
- know passwords
- reset passwords manually

The learner owns their credentials.

---

## Password Creation

The password is created only once.

During the first successful onboarding of a new Identity.

Subsequent Workspace invitations reuse the existing Identity.

---

## Password Changes

Changing a password updates the Identity.

All future Workspace logins automatically use the new password.

No Workspace stores passwords.

---

## Business Rules

| Rule | Description |
|-------|-------------|
| ID-201 | Credentials belong to Identity. |
| ID-202 | Workspaces never own credentials. |
| ID-203 | One Identity may have multiple credentials. |
| ID-204 | Passwords are never shared with tutors. |
| ID-205 | Password reset updates the Identity, not the Workspace. |

---

# 4. Global Profile

## Purpose

The Global Profile represents personal information that belongs to the Person rather than to any individual Workspace.

This information is reusable across multiple Workspaces.

Typical examples include:

- Name
- Date of Birth
- Preferred Language
- Country
- Time Zone
- Avatar
- Accessibility Preferences

The Global Profile is intentionally minimal.

Educational information should remain Workspace-specific unless explicitly designed as global.

---

## Ownership

The Person owns their Global Profile.

Workspaces may request permission to use profile information but do not own it.

---

# 5. Professional Identity

Professional Identity represents the long-term educational and professional presence of the Person.

Unlike Workspace Membership, Professional Identity continues throughout the person's lifetime.

Professional Identity includes:

- Teaching experience
- Qualifications
- Skills
- Certifications
- Professional biography
- Public reputation
- Marketplace presence
- Portfolio

This section is inherited from Version 1 and remains largely unchanged.

---

# 6. Reputation

Reputation represents the accumulated trust established by an Identity over time.

Examples include:

- Reviews
- Ratings
- Recommendations
- Professional endorsements
- Teaching quality indicators

Reputation belongs to the Identity.

It is not owned by a Workspace.

---

# 7. Verification

Verification establishes trust in an Identity.

Examples include:

- Email verification
- Government ID verification
- Professional certificate verification
- Employment verification
- Tutor verification

Verification status follows the Identity across all Workspaces.

A verified tutor should not require re-verification when creating a new Workspace.

---

# Identity Summary

```text
Person
    │
    ▼
Identity
    │
    ├── Credentials
    ├── Global Profile
    ├── Verification
    ├── Reputation
    └── Professional Identity
```

Identity is global.

Identity is permanent.

Identity belongs to the individual.

Identity is independent from every Workspace.

# SECTION II — Workspace Access

---

# Overview

Workspace Access defines how an authenticated Identity gains access to a Workspace and participates in its educational experience.

Unlike Identity, which is global and lifelong, Workspace Access is owned by an individual Workspace.

Every Workspace independently decides:

- Who may join
- How invitations are issued
- Membership status
- Enrollment policies
- Permissions
- Learning participation

Workspace Access is therefore the bridge between the platform's shared Identity infrastructure and the Workspace Owner's independent academy.

---

# Workspace Access Principles

## WA-001

Identity is global.

Workspace Access is local.

---

## WA-002

Authentication never grants access by itself.

Authentication only proves who the person is.

Workspace Membership determines whether the authenticated Identity may enter the Workspace.

---

## WA-003

Every educational interaction requires an active Workspace Session.

---

## WA-004

Workspace Access belongs entirely to the Workspace.

The platform authenticates identities.

The Workspace authorizes participation.

---

# Workspace Access Lifecycle

```text
Workspace Owner Creates Invitation
          │
          ▼
Invitation Sent
          │
          ▼
Invitation Accepted
          │
          ▼
Onboarding Request
          │
          ▼
Identity Resolution
     ┌──────────────┐
     │              │
Existing      New Identity
Identity          │
     │             ▼
     │      Create Identity
     │             │
     └──────┬──────┘
            ▼
Authenticate Identity
            │
            ▼
Create Workspace Membership
            │
            ▼
Enrollment
            │
            ▼
Create Workspace Session
            │
            ▼
Workspace Experience
```

This lifecycle is the canonical business process governing learner entry into every Workspace.

---

# 1. Workspace Invitation

## Purpose

A Workspace Invitation is the formal business request inviting a Person to join a specific Workspace.

An invitation does not authenticate a learner.

An invitation does not create an Identity.

An invitation only authorizes the onboarding process.

---

## Invitation Ownership

A Workspace owns every invitation it issues.

Invitations are never shared across Workspaces.

---

## Invitation Information

Typical information includes:

- Invitation Identifier
- Invitation Token
- Workspace
- Intended Role
- Intended Learning Product (optional)
- Expiration Date
- Invitation Status
- Issued By
- Issued At

---

## Invitation States

```text
Draft

↓

Issued

↓

Delivered

↓

Accepted

↓

Expired

↓

Cancelled
```

> **Ruling (2026-08-05, Technical Debt Backlog TD-008):** the arrows above read as a single sequence, which no Invitation actually follows — `Accepted`, `Expired` and `Cancelled` are mutually exclusive outcomes, not successive steps. An Invitation reaches exactly one of them.
>
> **Invitation Business Analysis §9 is normative** for the Invitation lifecycle. It reconciles this list with Workspace Access Context §4.5 as:
>
> ```text
> Created → Sent → { Accepted | Expired | Cancelled }
> ```
>
> The six states here are not wrong, only finer-grained: `Draft` is a sub-step of `Created`, and `Issued` / `Delivered` split `Sent` into queued-for-delivery and confirmed-delivered. Version 1 does not track that split separately, because nothing yet acts on the difference. This model is retained rather than rewritten precisely because that distinction will matter if delivery failures ever need their own visibility — at which point splitting `Sent` is a refinement, not a redesign.

---

## Business Rules

| Rule | Description |
|-------|-------------|
| WA-101 | Every Invitation belongs to one Workspace. |
| WA-102 | Invitations never create Identities directly. |
| WA-103 | Invitations may expire. |
| WA-104 | Invitations may be cancelled before acceptance. |
| WA-105 | Accepting an invitation starts the onboarding process. |

---

# 2. Onboarding Request

## Purpose

An Onboarding Request represents a learner's intention to join a Workspace after accepting an invitation.

It exists before Workspace Membership is created.

---

## Responsibilities

An Onboarding Request collects:

- Registration information
- Acceptance of policies
- Required profile information
- Consent
- Identity Resolution inputs

---

## Business Principle

Onboarding never creates Membership directly.

Identity Resolution must occur first.

---

## Lifecycle

```text
Created

↓

In Progress

↓

Identity Resolved

↓

Completed

↓

Closed
```

---

# 3. Identity Resolution

## Purpose

Identity Resolution determines whether the onboarding learner already owns an Identity or whether a new Identity must be created.

This prevents duplicate accounts while maintaining a single lifelong Identity.

---

## Resolution Inputs

Current supported inputs:

- Exact Email Match
- External Authentication Provider

Future matching strategies may be introduced without changing the business model.

---

## Resolution Outcomes

### Existing Identity

The learner already owns an Identity.

Authentication is required.

No new password is created.

---

### New Identity

No Identity exists.

The learner creates:

- Password
- Initial Credentials

The platform creates the Identity.

---

## Business Rules

| Rule | Description |
|-------|-------------|
| WA-201 | Identity Resolution always occurs before Membership creation. |
| WA-202 | Duplicate Identities are not permitted. |
| WA-203 | New Identities create their credentials during onboarding. |
| WA-204 | Existing Identities authenticate using existing credentials. |

---

# 4. Workspace Membership

## Purpose

Workspace Membership represents the formal business relationship between an Identity and a Workspace.

It authorizes participation within that Workspace.

Membership is owned by the Workspace.

Identity is not.

---

## Membership Responsibilities

Workspace Membership defines:

- Participation
- Permissions
- Workspace Role
- Membership Status
- Access Policies
- Workspace Preferences

Membership does not own:

- Credentials
- Password
- Authentication
- Global Identity

---

## Membership States

```text
Pending

↓

Active

↓

Suspended

↓

Archived

↓

Removed
```

---

## Membership Ownership

```text
Identity

─────────────► owned by Platform

Workspace Membership

─────────────► owned by Workspace
```

---

## Business Rules

| Rule | Description |
|-------|-------------|
| WA-301 | Membership belongs to exactly one Workspace. |
| WA-302 | Membership references one Identity. |
| WA-303 | Removing Membership never removes Identity. |
| WA-304 | Membership controls Workspace participation only. |

---

# 5. Workspace Enrollment

## Purpose

Enrollment registers a Workspace Member into one or more Learning Products.

Enrollment depends on Membership.

Membership does not depend on Enrollment.

A learner may become a Workspace Member before enrolling in any course.

---

## Examples

A learner may:

- Join a Workspace
- Browse available programs
- Purchase courses later

or

Join the Workspace as part of course enrollment.

---

## Business Rule

Membership grants Workspace participation.

Enrollment grants Learning Product participation.

These are separate business concepts.

---

# 6. Workspace Session

## Purpose

A Workspace Session represents an authenticated Identity actively participating inside one specific Workspace.

It is the operational context for every educational interaction.

---

## Session Creation

A Workspace Session is created only after:

1. Identity Authentication succeeds.
2. Workspace Membership is validated.
3. Workspace Access is authorized.

---

## Session Context

A Workspace Session activates:

- Branding
- Navigation
- Permissions
- AI Configuration
- Learning Products
- Communication
- Notifications
- Workspace Settings

---

## Session Scope

A Workspace Session always belongs to exactly one Workspace.

A learner never operates inside multiple Workspace contexts simultaneously.

---

## Session Flow

```text
Identity

↓

Authenticate

↓

Workspace Membership

↓

Create Workspace Session

↓

Workspace Experience
```

---

## Business Rules

| Rule | Description |
|-------|-------------|
| WA-401 | Every educational interaction occurs within an active Workspace Session. |
| WA-402 | A Workspace Session belongs to one Workspace only. |
| WA-403 | Workspace Sessions activate Workspace-specific branding and behavior. |
| WA-404 | Workspace Sessions never expose information from other Workspaces. |

---

# Workspace Access Summary

```text
Workspace Invitation
          │
          ▼
Onboarding Request
          │
          ▼
Identity Resolution
          │
          ▼
Identity Authentication
          │
          ▼
Workspace Membership
          │
          ▼
Enrollment
          │
          ▼
Workspace Session
          │
          ▼
Workspace Experience
```

Workspace Access is responsible for transforming a globally authenticated Identity into an active participant within a specific Workspace Owner's academy.

# SECTION III — Professional Growth

---

# Overview

Professional Growth represents the long-term professional assets accumulated by an Identity throughout its lifetime.

Unlike Workspace Membership, which belongs to a specific Workspace, Professional Growth belongs permanently to the Identity.

Professional Growth enables individuals to build a portable professional reputation that transcends individual tutors, organizations, and learning experiences.

The purpose of this section is to define the business concepts that support lifelong professional development.

---

# Professional Growth Principles

## PG-001

Professional Growth belongs to the Identity.

It is never owned by a Workspace.

---

## PG-002

Professional assets remain with the individual throughout their lifetime.

Leaving a Workspace never removes professional history.

---

## PG-003

Professional Growth aggregates achievements from multiple Workspaces.

Each Workspace contributes to the Identity's professional journey.

---

## PG-004

Professional Growth is cumulative.

Professional assets continue to evolve regardless of career changes, tutors, or organizations.

---

## PG-005

Workspaces contribute evidence.

Identity owns the resulting professional profile.

---

# Professional Growth Model

```text
Identity
    │
    ├── Professional Profile
    ├── Tutor Portfolio
    ├── Organization Portfolio
    ├── Achievements
    ├── Reputation
    ├── Verification
    ├── Professional History
    └── Public Presence
```

---

# 1. Professional Profile

## Purpose

The Professional Profile represents the long-term professional identity of a Person.

It provides a consolidated view of qualifications, experience, achievements, and expertise accumulated across all Workspaces.

Unlike a Workspace profile, the Professional Profile is global.

---

## Responsibilities

The Professional Profile may include:

- Biography
- Teaching philosophy
- Areas of expertise
- Languages
- Skills
- Qualifications
- Certifications
- Professional interests
- Experience summary

---

## Ownership

Professional Profile belongs exclusively to the Identity.

Workspaces may display selected information but never own or modify it without permission.

---

# 2. Tutor Portfolio

## Purpose

A Tutor Portfolio showcases the professional work of a tutor across multiple Workspaces.

It allows tutors to demonstrate their expertise independently of any single academy.

---

## Portfolio Contents

Examples include:

- Published courses
- Learning programs
- Interactive lessons
- Educational resources
- Teaching specialties
- Teaching methodologies
- Sample lessons
- Professional achievements
- Learner testimonials

---

## Principles

A Tutor Portfolio is portable.

Changing organizations or creating new Workspaces does not affect the tutor's portfolio.

---

# 3. Organization Portfolio

## Purpose

An Organization Portfolio represents the professional identity of educational organizations operating on the platform.

It aggregates organizational assets independently of individual tutors.

---

## Typical Information

- Organization profile
- Mission
- Accreditation
- Educational philosophy
- Programs
- Tutors
- Branches
- Achievements
- Public reputation

---

## Relationship

Organizations may own multiple Workspaces.

Each Workspace contributes to the organization's portfolio while remaining operationally independent.

---

# 4. Achievements

## Purpose

Achievements represent verified milestones accomplished by an Identity.

Achievements contribute to long-term professional growth.

---

## Examples

- Course completion
- Professional certification
- Teaching milestones
- Community contributions
- Educational awards
- AI teaching achievements
- Content publishing milestones

---

## Characteristics

Achievements are:

- Permanent
- Portable
- Verifiable
- Identity-owned

Achievements are never deleted when leaving a Workspace.

---

# 5. Reputation

## Purpose

Reputation reflects the trust established by an Identity through educational participation.

It evolves over time based on verified interactions.

---

## Reputation Sources

Examples include:

- Learner reviews
- Tutor evaluations
- Community participation
- Educational contributions
- Professional endorsements
- Verified accomplishments

---

## Principles

Reputation belongs to the Identity.

Individual Workspaces may contribute evidence but do not own the overall reputation.

---

# 6. Verification

## Purpose

Verification establishes trust in professional claims made by an Identity.

Verification improves confidence for learners, tutors, and organizations.

---

## Verification Types

Examples include:

- Email verification
- Identity verification
- Professional qualification verification
- Teaching credential verification
- Organization verification

---

## Principles

Verification follows the Identity across all Workspaces.

Verification should not be repeated unnecessarily when participating in additional Workspaces.

---

# 7. Professional History

## Purpose

Professional History represents the chronological record of significant educational and professional activities associated with an Identity.

---

## Examples

- Teaching experience
- Learning milestones
- Published educational content
- Professional roles
- Organizational affiliations
- Certifications earned
- Awards received

---

## Principles

Professional History is cumulative.

Historical records remain attached to the Identity even after Workspace Membership ends.

---

# 8. Public Presence

## Purpose

Public Presence defines how an Identity is presented outside individual Workspaces.

It supports discoverability, credibility, and professional networking.

---

## Examples

- Public tutor profile
- Public portfolio
- Professional biography
- Published learning products
- Public achievements
- Verified credentials

---

## Visibility

The Identity controls which information is publicly visible.

Workspaces cannot expose professional information beyond the permissions granted by the Identity.

---

# Domain Relationships

```text
Identity
    │
    ├── Professional Profile
    ├── Tutor Portfolio
    ├── Organization Portfolio
    ├── Achievements
    ├── Reputation
    ├── Verification
    ├── Professional History
    └── Public Presence
```

---

# Business Rules

| Rule | Description |
|-------|-------------|
| PG-001 | Professional Growth belongs to the Identity. |
| PG-002 | Professional assets are independent of Workspace Membership. |
| PG-003 | Leaving a Workspace never removes professional achievements. |
| PG-004 | Workspaces contribute evidence but do not own professional assets. |
| PG-005 | Reputation is accumulated across multiple Workspaces. |
| PG-006 | Verification is reusable across Workspaces when applicable. |
| PG-007 | Professional History is immutable once recorded, except through authorized correction processes. |
| PG-008 | Public visibility of professional information is controlled by the Identity. |

---

# Domain Events

Examples include:

- ProfessionalProfileUpdated
- TutorPortfolioPublished
- OrganizationPortfolioCreated
- AchievementAwarded
- ReputationUpdated
- IdentityVerified
- ProfessionalHistoryRecorded
- PublicProfilePublished

---

# Context Ownership

| Business Concept | Owning Context |
|------------------|----------------|
| Professional Profile | Identity Context |
| Tutor Portfolio | Identity Context |
| Organization Portfolio | Identity Context |
| Achievement | Identity Context |
| Reputation | Identity Context |
| Verification | Identity Context |
| Professional History | Identity Context |
| Public Presence | Identity Context |

---

# Summary

Professional Growth ensures that every Person builds a lifelong professional identity independent of any individual tutor, Workspace, or organization.

# SECTION IV — Workspace Access & Authentication Scenarios

---

# Overview

This section defines the canonical business scenarios governing how an Identity authenticates and gains access to a Workspace.

Unlike traditional LMS platforms, authentication and Workspace participation are treated as separate business concerns.

Authentication establishes **who the learner is**.

Workspace Access establishes **which academy the learner is entering**.

Only after both processes succeed can a Workspace Session be created.

---

# Scenario Overview

The platform supports several business scenarios.

| Scenario | Description |
|----------|-------------|
| SA-001 | First-time learner joins a Workspace |
| SA-002 | Existing learner joins another Workspace |
| SA-003 | Returning learner login |
| SA-004 | Forgot password |
| SA-005 | Invitation expired |
| SA-006 | Membership suspended |
| SA-007 | Membership removed |
| SA-008 | Invalid Workspace entry |
| SA-009 | Workspace not found |
| SA-010 | Authentication failure |

---

# SA-001 — First-Time Learner Joins a Workspace

## Description

The learner has never participated in the platform before.

No Identity exists.

The learner receives an invitation from a Workspace Owner.

---

## Business Flow

```text
Workspace Owner

↓

Create Invitation

↓

Invitation Sent

↓

Learner Opens Invitation

↓

Onboarding Request

↓

Identity Resolution

↓

No Identity Found

↓

Create Identity

↓

Create Password

↓

Authenticate

↓

Create Workspace Membership

↓

Create Enrollment (optional)

↓

Create Workspace Session

↓

Workspace Dashboard
```

---

## Business Outcome

The learner now owns

- one Identity
- one Credential
- one Workspace Membership

Future Workspaces will reuse the same Identity.

---

# SA-002 — Existing Learner Joins Another Workspace

## Description

The learner already owns a global Identity.

Another Workspace Owner invites the learner into a different Workspace.

---

## Business Flow

```text
Invitation

↓

Onboarding Request

↓

Identity Resolution

↓

Existing Identity Found

↓

Authenticate

↓

Create Workspace Membership

↓

Enrollment

↓

Workspace Session

↓

Workspace Dashboard
```

---

## Business Outcome

No new Identity.

No new password.

Only a new Workspace Membership.

---

# SA-003 — Returning Learner Login

## Description

The learner already belongs to the Workspace.

---

## Business Flow

```text
Workspace Entry Point

↓

Workspace Resolution

↓

Identity Authentication

↓

Validate Membership

↓

Create Workspace Session

↓

Workspace Dashboard
```

---

## Business Principle

Returning learners never repeat onboarding.

---

# SA-004 — Forgot Password

## Description

The learner forgets the Identity password.

---

## Business Flow

```text
Forgot Password

↓

Identity Verification

↓

Password Reset

↓

Credential Updated

↓

Login

↓

Workspace Session
```

---

## Business Rule

Passwords belong to Identity.

Workspace Membership remains unchanged.

---

# SA-005 — Invitation Expired

## Description

The learner attempts to use an expired invitation.

---

## Business Outcome

Workspace Membership is not created.

Identity is not modified.

The Workspace Owner must issue a new invitation.

---

# SA-006 — Membership Suspended

## Description

The learner successfully authenticates but their Workspace Membership is suspended.

---

## Business Flow

```text
Authenticate

↓

Membership Validation

↓

Suspended

↓

Access Denied
```

---

## Business Rule

Authentication succeeds.

Authorization fails.

---

# SA-007 — Membership Removed

## Description

The learner previously belonged to the Workspace.

Membership has been permanently removed.

---

## Business Outcome

Identity continues to exist.

Credentials remain valid.

The learner simply no longer belongs to the Workspace.

---

# SA-008 — Invalid Workspace Entry

## Description

The learner attempts to enter a Workspace using an invalid or unknown Workspace Entry Point.

---

## Business Outcome

Workspace Resolution fails.

Authentication may still succeed.

No Workspace Session is created.

---

# SA-009 — Workspace Not Found

## Description

The requested Workspace no longer exists.

---

## Business Outcome

Identity remains valid.

No Membership changes occur.

The learner receives a Workspace unavailable message.

---

# SA-010 — Authentication Failure

## Description

The supplied credentials cannot authenticate the Identity.

---

## Business Outcome

Workspace Membership is never evaluated.

Workspace Session is never created.

---

# Business Decision Matrix

| Authentication | Membership | Result |
|---------------|------------|--------|
| Success | Active | Workspace Session Created |
| Success | Suspended | Access Denied |
| Success | Removed | Access Denied |
| Failure | Any | Authentication Failed |

---

# Authentication vs Authorization

Authentication answers:

> **Who is this person?**

Authorization answers:

> **May this person enter this Workspace?**

These responsibilities are intentionally separated.

---

# Workspace Session Creation Rules

A Workspace Session may only be created when all of the following conditions are true:

- Identity Authentication succeeded.
- Workspace Resolution succeeded.
- Workspace Membership exists.
- Membership is Active.
- Workspace Access Policy permits access.

---

# Scenario Relationships

```text
Workspace Entry Point
            │
            ▼
Workspace Resolution
            │
            ▼
Authentication
            │
            ▼
Workspace Membership Validation
            │
            ▼
Workspace Access Policy Evaluation
            │
            ▼
Workspace Session Creation
            │
            ▼
Workspace Experience
```

---

# Domain Events

Typical events generated during these scenarios include:

- InvitationAccepted
- OnboardingStarted
- IdentityResolved
- IdentityCreated
- IdentityAuthenticated
- WorkspaceMembershipCreated
- EnrollmentCreated
- WorkspaceSessionStarted
- PasswordResetRequested
- PasswordChanged
- MembershipSuspended
- WorkspaceAccessDenied

---

# Business Principles

- Authentication is global.
- Authorization is Workspace-specific.
- Membership determines participation.
- Identity determines authentication.
- Workspace Sessions exist only after successful authentication and authorization.
- Every educational experience begins inside an active Workspace Session.

---

# Summary

Workspace Access Scenarios define the operational behavior of the Learning Workspace Platform.

They ensure that every learner experiences a seamless, Workspace-first journey while preserving the platform's core architectural principles:

- One global Identity.
- Independent Workspace-Owner-owned Workspaces.
- Invisible platform infrastructure.
- Isolated Workspace experiences.
# SECTION V — Workspace Entry & Resolution Architecture

---

# Overview

The Learning Workspace Platform is designed around the principle that learners never enter the platform directly.

Instead, every learner begins their journey through a **Workspace Entry Point** that represents a specific Workspace Owner's academy.

This approach reinforces the platform's core philosophy:

> The platform is infrastructure.
>
> The Workspace is the destination.

Workspace Entry & Resolution Architecture defines how incoming requests are associated with the correct Workspace before authentication and educational participation begin.

---

# Business Objectives

Workspace Entry & Resolution exists to achieve the following goals:

- Present every Workspace as an independent learning academy.
- Hide the existence of the shared platform.
- Support custom branding and domains.
- Resolve the correct Workspace before authentication.
- Provide a consistent learner experience regardless of entry channel.
- Enable multiple entry methods without changing the business model.

---

# Architectural Principles

## WE-001

Learners enter a Workspace.

They do not enter the platform.

---

## WE-002

Every Workspace owns one or more Entry Points.

---

## WE-003

Every Entry Point resolves to exactly one Workspace.

---

## WE-004

Workspace Resolution occurs before authentication.

---

## WE-005

Workspace Resolution is transparent to the learner.

---

## WE-006

Authentication is global.

Experience is Workspace-specific.

---

# Workspace Entry Point

## Definition

A Workspace Entry Point is any business endpoint through which a learner enters a Workspace.

The Entry Point represents the public entrance to a Workspace Owner's academy.

It is part of the Workspace's business identity rather than the platform's infrastructure.

---

## Supported Entry Point Types

### Custom Domain

Example

```text
learn.englishacademy.com
```

---

### Platform Subdomain

Example

```text
englishacademy.learningworkspace.com
```

---

### Invitation Link

Example

```text
https://platform.com/invite/ABC123
```

---

### Direct Workspace URL

Example

```text
https://platform.com/workspaces/englishacademy
```

---

### Course Deep Link

Example

```text
https://platform.com/course/business-english
```

---

### Lesson Deep Link

Example

```text
https://platform.com/lesson/pronunciation-lesson-5
```

---

### QR Code

A QR code resolving directly to a Workspace or Learning Product.

---

### Mobile Deep Link

Future capability allowing native mobile applications to open directly inside a Workspace.

---

# Workspace Resolution

## Definition

Workspace Resolution is the business process responsible for determining the target Workspace from the incoming Entry Point.

Resolution occurs before authentication.

The learner is not required to understand how Workspace Resolution works.

---

## Resolution Inputs

Workspace Resolution may use:

- Domain Name
- Subdomain
- Invitation Token
- Workspace Identifier
- Course Identifier
- Lesson Identifier
- QR Token
- Mobile Deep Link

---

## Resolution Output

Workspace Resolution produces exactly one result:

```text
Resolved Workspace
```

or

```text
Workspace Not Found
```

---

# Workspace Resolution Flow

```text
Workspace Entry Point
            │
            ▼
Workspace Resolution
            │
            ▼
Workspace Located
            │
            ▼
Load Workspace Configuration
            │
            ▼
Display Workspace Login Experience
            │
            ▼
Authenticate Identity
            │
            ▼
Workspace Membership Validation
            │
            ▼
Workspace Session
            │
            ▼
Workspace Experience
```

---

# Workspace Configuration

Once a Workspace has been resolved, the platform loads the Workspace configuration.

Typical configuration includes:

- Logo
- Theme
- Colors
- Typography
- Language
- Branding
- AI Configuration
- Workspace Navigation
- Access Policies
- Welcome Experience

The learner should immediately perceive they have entered the Workspace Owner's own academy.

---

# Branding Experience

Workspace Resolution activates Workspace branding before authentication whenever possible.

Examples include:

- Login page
- Welcome page
- Invitation page
- Password reset page
- Email templates
- Notifications

Brand consistency reinforces academy ownership.

---

# Entry Scenarios

## Public Academy Visit

```text
Workspace URL

↓

Workspace Resolution

↓

Workspace Landing Page
```

---

## Invitation Entry

```text
Invitation Link

↓

Workspace Resolution

↓

Invitation Validation

↓

Onboarding
```

---

## Returning Learner

```text
Workspace URL

↓

Workspace Resolution

↓

Login

↓

Workspace Session

↓

Dashboard
```

---

## Deep Course Link

```text
Course URL

↓

Workspace Resolution

↓

Authentication

↓

Workspace Session

↓

Requested Course
```

---

## Mobile Deep Link

```text
Mobile App

↓

Workspace Resolution

↓

Workspace Session

↓

Learning Experience
```

---

# Business Rules

| Rule | Description |
|-------|-------------|
| WE-101 | Every Entry Point resolves to one Workspace. |
| WE-102 | Workspace Resolution occurs before authentication. |
| WE-103 | Branding is loaded immediately after Workspace Resolution. |
| WE-104 | Authentication does not determine the Workspace. |
| WE-105 | Entry Points may evolve without changing the Workspace model. |
| WE-106 | Deep links preserve Workspace context. |
| WE-107 | A learner never manually selects a Workspace after entering through a valid Entry Point. |

---

# Domain Events

Typical events include:

- WorkspaceEntryRequested
- WorkspaceResolved
- WorkspaceResolutionFailed
- WorkspaceConfigurationLoaded
- WorkspaceLandingDisplayed
- WorkspaceLoginDisplayed

---

# Context Ownership

| Business Concept | Owning Context |
|------------------|----------------|
| Workspace Entry Point | Workspace Access Context |
| Workspace Resolution | Workspace Access Context |
| Workspace Configuration | Workspace Context |
| Branding | Workspace Context |
| Login Experience | Workspace Access Context |

---

# Relationship to Other Sections

Workspace Entry & Resolution Architecture precedes all other Workspace Access activities.

The complete flow is:

```text
Workspace Entry Point
            │
            ▼
Workspace Resolution
            │
            ▼
Workspace Access Policy
            │
            ▼
Invitation
            │
            ▼
Onboarding Request
            │
            ▼
Identity Resolution
            │
            ▼
Identity Authentication
            │
            ▼
Workspace Membership
            │
            ▼
Enrollment
            │
            ▼
Workspace Session
            │
            ▼
Workspace Experience
```

---

# Architectural Decisions

## ADR-WE-001 — Workspace-First Entry

Learners always begin their journey through a Workspace Entry Point rather than a platform home page.

---

## ADR-WE-002 — Invisible Platform

The platform infrastructure remains hidden from learners throughout the entry process.

---

## ADR-WE-003 — Resolution Before Authentication

The platform resolves the target Workspace before requesting authentication.

This allows authentication screens, branding, language, AI personality, and user experience to be tailored to the destination Workspace.

---

# Summary

Workspace Entry & Resolution Architecture establishes the first interaction between a learner and a Workspace Owner's academy.

By resolving the Workspace before authentication and loading its unique branding and configuration, the platform creates the perception of a dedicated learning environment while relying on a shared infrastructure.

# SECTION VII — Domain Events & Integration Events

---

# Overview

Domain Events capture significant business occurrences within the Learning Workspace Platform.

Unlike CRUD operations, Domain Events represent meaningful business milestones that have occurred and cannot be reversed.

They provide a consistent business language for communication between bounded contexts while preserving loose coupling.

Every Domain Event:

- represents something that has already happened
- is immutable
- belongs to one owning bounded context
- may trigger zero or more business reactions
- may optionally publish Integration Events

---

# Event Design Principles

## DE-001

Events describe facts.

Never intentions.

✔ WorkspaceMembershipCreated

✖ CreateWorkspaceMembership

---

## DE-002

Events are immutable.

Once published, an event can never be modified.

---

## DE-003

Every event has one owning bounded context.

---

## DE-004

Events describe business language.

Not implementation details.

---

## DE-005

Events should be understandable by business stakeholders.

---

# Event Categories

The platform organizes Domain Events into business categories.

```text
Identity Events

Workspace Access Events

Enrollment Events

Learning Events

Assessment Events

AI Events

Certificate Events

Community Events

Workspace Events

Organization Events
```

---

# Identity Domain Events

## IdentityCreated

### Description

A new Identity has been created.

---

### Published By

Identity Context

---

### Typical Consumers

- Workspace Access
- Notification
- Audit
- Analytics

---

## IdentityAuthenticated

Published whenever an Identity successfully authenticates.

---

## IdentityVerificationCompleted

Published when Identity verification succeeds.

---

## CredentialRegistered

Published after a new authentication credential is registered.

---

## PasswordChanged

Published when the Identity password changes.

---

## ExternalProviderLinked

Published when Google, Microsoft or Apple authentication is linked.

---

# Workspace Access Events

## WorkspaceInvitationCreated

Published when a Workspace Owner issues an invitation.

---

## WorkspaceInvitationAccepted

Published after the learner accepts an invitation.

---

## OnboardingStarted

Published when onboarding begins.

---

## IdentityResolved

Published after Identity Resolution completes.

---

## WorkspaceMembershipCreated

Published when Membership is successfully established.

---

## WorkspaceMembershipActivated

Membership becomes active.

---

## WorkspaceMembershipSuspended

Membership has been suspended.

---

## WorkspaceMembershipRemoved

Membership permanently ends.

---

## WorkspaceSessionStarted

A learner successfully enters a Workspace.

---

## WorkspaceSessionEnded

The learner leaves the Workspace.

---

## WorkspaceAccessDenied

Authentication succeeded.

Authorization failed.

---

# Enrollment Domain Events

## EnrollmentCreated

A learner has enrolled in a Learning Product.

---

## EnrollmentCancelled

Enrollment has ended.

---

## EnrollmentCompleted

Learning Product successfully completed.

---

# Learning Events

## LessonStarted

---

## LessonCompleted

---

## InteractiveLessonGenerated

Generated by AI.

---

## InteractiveQuestionCreated

Generated by AI.

---

## InteractiveQuestionAnswered

Learner answered an interactive question.

---

## LearningProgressUpdated

Progress recalculated.

---

# Assessment Events

## AssessmentStarted

---

## AssessmentSubmitted

---

## AssessmentGraded

---

## AssessmentPassed

---

## AssessmentFailed

---

# AI Domain Events

## LessonTranscriptGenerated

Video transcription completed.

---

## LessonTitleSuggested

AI suggested lesson title.

---

## LessonSummaryGenerated

---

## InteractiveLearningEventsGenerated

AI created interactive video events.

---

## AIQuestionsGenerated

Questions successfully generated.

---

## AIContentReviewed

AI review completed.

---

# Certificate Events

## CertificateIssued

---

## CertificateRevoked

---

## DigitalCredentialPublished

---

# Community Events

## DiscussionCreated

---

## CommentAdded

---

## AnnouncementPublished

---

# Workspace Events

## WorkspaceCreated

---

## WorkspacePublished

---

## WorkspaceArchived

---

## WorkspaceBrandUpdated

---

## WorkspaceAccessPolicyChanged

---

# Event Relationships

```text
WorkspaceInvitationAccepted

↓

OnboardingStarted

↓

IdentityResolved

↓

WorkspaceMembershipCreated

↓

EnrollmentCreated

↓

WorkspaceSessionStarted

↓

LessonStarted

↓

LessonCompleted

↓

AssessmentPassed

↓

CertificateIssued
```

---

# Event Ownership

| Event Category | Owning Context |
|----------------|----------------|
| Identity Events | Identity Context |
| Workspace Access Events | Workspace Access Context |
| Enrollment Events | Enrollment Context |
| Learning Events | Learning Delivery Context |
| AI Events | AI Context |
| Assessment Events | Assessment Context |
| Certificate Events | Credential & Certification Context |
| Community Events | Community Context |

---

# Integration Events

Not every Domain Event should leave its owning bounded context.

Integration Events are explicitly published for cross-context communication.

Examples include:

| Domain Event | Integration Event |
|--------------|------------------|
| WorkspaceMembershipCreated | MemberJoinedWorkspace |
| EnrollmentCreated | LearnerEnrolled |
| LessonCompleted | LearningProgressChanged |
| CertificateIssued | LearnerCertified |
| WorkspaceAccessPolicyChanged | WorkspaceConfigurationUpdated |

Integration Events should remain stable contracts between bounded contexts.

---

# Event Naming Convention

Events should always use the following format:

```text
<Entity><Past Tense Verb>
```

Examples:

- WorkspaceCreated
- IdentityResolved
- EnrollmentCompleted
- CertificateIssued
- LessonTranscriptGenerated

Avoid technical names such as:

- UserSaved
- DatabaseUpdated
- RecordInserted

---

# Event Lifecycle

```text
Business Action

↓

Business Decision

↓

Domain Event

↓

Business Reactions

↓

Optional Integration Event

↓

Other Bounded Contexts
```

---

# Event Consumers

Typical consumers include:

- Notification Service
- AI Automation
- Analytics
- Audit Trail
- Reporting
- Search Indexing
- Recommendation Engine
- Achievement Engine
- Certificate Service
- Marketplace
- Community

Each consumer reacts independently without changing the originating bounded context.

---

# Architectural Principles

- Every Domain Event belongs to one bounded context.
- Events describe completed business facts.
- Events are immutable.
- Events enable loose coupling between domains.
- Integration Events expose only information required by other contexts.
- Business workflows are coordinated through events rather than direct dependencies whenever possible.

---

# Summary

Domain Events form the business communication backbone of the Learning Workspace Platform.

# SECTION VIII — Enterprise Business Rules

---

# Overview

Enterprise Business Rules define the fundamental constraints governing Identity, Workspace Access, Authentication, Membership, and Workspace Participation.

Unlike configurable Workspace Access Policies, Enterprise Business Rules are platform-wide invariants.

These rules ensure architectural consistency across all bounded contexts and cannot be overridden by individual Workspaces.

Workspace policies configure behavior.

Enterprise Business Rules define what is fundamentally allowed.

---

# Rule Classification

Enterprise Business Rules are organized into the following categories:

- Identity Rules
- Credential Rules
- Workspace Rules
- Membership Rules
- Authentication Rules
- Session Rules
- Invitation Rules
- Enrollment Rules
- Workspace Experience Rules

---

# Identity Rules

## BR-ID-001

Every Person owns exactly one Identity.

Duplicate Identities representing the same person are not permitted.

---

## BR-ID-002

Identity is globally unique across the platform.

---

## BR-ID-003

Identity belongs to the platform infrastructure.

It never belongs to a Workspace.

---

## BR-ID-004

Identity survives Workspace removal.

Removing every Workspace Membership does not remove the Identity.

---

## BR-ID-005

Identity Resolution must complete before a new Identity can be created.

---

## BR-ID-006

Identity is immutable once created.

Core identifiers cannot be reassigned.

---

# Credential Rules

## BR-CR-001

Credentials belong exclusively to Identity.

---

## BR-CR-002

Passwords belong to Identity.

Never to a Workspace.

---

## BR-CR-003

Tutors never create learner passwords.

---

## BR-CR-004

Tutors never know learner passwords.

---

## BR-CR-005

Password reset affects Identity only.

Workspace Membership remains unchanged.

---

## BR-CR-006

An Identity may authenticate using multiple credential providers.

---

# Workspace Rules

## BR-WS-001

Every Workspace owns its own Memberships.

---

## BR-WS-002

Every Workspace owns exactly one active Workspace Access Policy.

---

## BR-WS-003

Workspace configuration never modifies Identity.

---

## BR-WS-004

Workspace branding is isolated from other Workspaces.

---

## BR-WS-005

Workspace configuration applies only within its own Workspace Session.

---

# Membership Rules

## BR-MB-001

Workspace Membership belongs to exactly one Workspace.

---

## BR-MB-002

Workspace Membership references exactly one Identity.

---

## BR-MB-003

Membership cannot exist without a valid Identity.

---

## BR-MB-004

Removing Membership never removes Identity.

---

## BR-MB-005

Membership status controls Workspace participation.

---

## BR-MB-006

A learner may hold Memberships in multiple independent Workspaces.

---

# Authentication Rules

## BR-AU-001

Authentication proves Identity.

It never grants Workspace participation.

---

## BR-AU-002

Authentication always precedes Workspace Session creation.

---

## BR-AU-003

Authentication is platform-wide.

Authorization is Workspace-specific.

---

## BR-AU-004

Successful authentication does not guarantee Workspace access.

---

# Session Rules

## BR-SE-001

Every educational interaction occurs within an active Workspace Session.

---

## BR-SE-002

A Workspace Session belongs to exactly one Workspace.

---

## BR-SE-003

Workspace Sessions never expose data from another Workspace.

---

## BR-SE-004

A Workspace Session requires:

- successful Workspace Resolution
- successful Identity Authentication
- active Workspace Membership

---

## BR-SE-005

Ending a Workspace Session does not affect Membership.

---

# Invitation Rules

## BR-IN-001

Every Invitation belongs to one Workspace.

---

## BR-IN-002

Invitations never create Membership directly.

---

## BR-IN-003

Invitation acceptance initiates onboarding.

---

## BR-IN-004

Expired Invitations cannot create Membership.

---

# Enrollment Rules

## BR-EN-001

Enrollment requires an active Workspace Membership.

---

## BR-EN-002

Membership may exist without Enrollment.

---

## BR-EN-003

Enrollment grants participation in Learning Products.

Membership grants participation in the Workspace.

---

# Workspace Experience Rules

## BR-EX-001

Learners always enter through a Workspace Entry Point.

---

## BR-EX-002

Workspace Resolution occurs before authentication.

---

## BR-EX-003

Workspace branding is established before Workspace Session creation.

---

## BR-EX-004

The platform never presents a global learner dashboard.

---

## BR-EX-005

The platform never exposes a Workspace switcher.

Workspace transitions occur only by entering another Workspace Entry Point.

---

## BR-EX-006

Each Workspace must appear to learners as an independent academy.

---

## BR-EX-007

The existence of shared platform infrastructure should remain transparent to learners whenever possible.

---

# Business Invariants

The following statements are considered architectural invariants.

These rules must remain true regardless of future feature development.

- One Person → One Identity.
- One Identity → Many Workspace Memberships.
- One Membership → One Workspace.
- One Workspace Session → One Workspace.
- Identity is global.
- Membership is local.
- Authentication is global.
- Authorization is Workspace-specific.
- Learning always occurs inside a Workspace Session.
- Workspace branding is isolated.
- Platform infrastructure remains invisible to learners.

---

# Rule Ownership

| Rule Category | Owning Context |
|---------------|----------------|
| Identity Rules | Identity Context |
| Credential Rules | Identity Context |
| Workspace Rules | Workspace Access Context |
| Membership Rules | Workspace Access Context |
| Authentication Rules | Identity Context |
| Session Rules | Workspace Access Context |
| Invitation Rules | Workspace Access Context |
| Enrollment Rules | Enrollment Context |
| Workspace Experience Rules | Workspace Experience Context |

---

# Relationship to Workspace Policies

Enterprise Business Rules and Workspace Access Policies serve different purposes.

| Enterprise Business Rules | Workspace Access Policies |
|---------------------------|---------------------------|
| Platform-wide | Workspace-specific |
| Mandatory | Configurable |
| Cannot be overridden | Can be customized |
| Define invariants | Define behavior |
| Stable | Business-configurable |

Example:

Enterprise Rule:

> Every Membership must reference a valid Identity.

Workspace Policy:

> Membership approval requires manual review.

The policy may change.

The rule cannot.

---

# Summary

Enterprise Business Rules establish the immutable foundation of the Learning Workspace Platform.

They ensure that Identity, Workspace Access, Membership, Authentication, and Workspace Experience behave consistently across all Workspaces while allowing Workspace Owners and organizations to customize their onboarding and operational policies through Workspace Access Policies.

# SECTION IX — Domain Relationships, Ownership & Architectural Boundaries

---

# Overview

This section provides the authoritative view of the business relationships, ownership boundaries, and architectural responsibilities within the Identity & Workspace Access domain.

Its purpose is to consolidate the concepts introduced throughout this document into a single reference architecture.

This section serves as the primary reference for:

- Domain Driven Design (DDD)
- Aggregate ownership
- Bounded Context ownership
- Business responsibilities
- Cross-context communication
- Future implementation

---

# Architectural Layers

The platform is organized into distinct architectural layers.

```text
┌────────────────────────────────────────────┐
│           Workspace Experience             │
└────────────────────────────────────────────┘
                    ▲
                    │
┌────────────────────────────────────────────┐
│            Workspace Session               │
└────────────────────────────────────────────┘
                    ▲
                    │
┌────────────────────────────────────────────┐
│      Workspace Membership & Access         │
└────────────────────────────────────────────┘
                    ▲
                    │
┌────────────────────────────────────────────┐
│      Identity & Authentication             │
└────────────────────────────────────────────┘
                    ▲
                    │
┌────────────────────────────────────────────┐
│               Person                       │
└────────────────────────────────────────────┘
```

Each layer depends only on the layer below it.

---

# Core Domain Relationships

The fundamental business relationships are illustrated below.

```text
Person
    │
    │ owns
    ▼
Identity
    │
    ├───────────────┐
    │               │
owns Credentials    │
                    │
                    ▼
          Workspace Membership
                    │
                    ▼
             Enrollment
                    │
                    ▼
          Workspace Session
                    │
                    ▼
         Workspace Experience
                    │
                    ▼
         Learning Participation
```

---

# Workspace Entry Flow

Every learner enters the platform through a Workspace.

```text
Workspace Entry Point
            │
            ▼
Workspace Resolution
            │
            ▼
Workspace Access Policy
            │
            ▼
Identity Authentication
            │
            ▼
Membership Validation
            │
            ▼
Workspace Session
            │
            ▼
Workspace Experience
```

This sequence represents the canonical access path for every learner.

---

# Aggregate Ownership

| Aggregate | Owning Context |
|------------|----------------|
| Identity | Identity Context |
| Credential | Identity Context |
| Verification | Identity Context |
| Workspace Invitation | Workspace Access Context |
| Onboarding Request | Workspace Access Context |
| Workspace Membership | Workspace Access Context |
| Workspace Access Policy | Workspace Access Context |
| Workspace Session | Workspace Access Context |

Only the owning context may modify its aggregate.

Other contexts interact through published events or well-defined services.

---

# Bounded Context Responsibilities

## Identity Context

Responsible for:

- Identity lifecycle
- Credentials
- Authentication
- Identity verification
- Identity resolution
- External login providers

Does **not** manage:

- Membership
- Enrollment
- Workspace permissions

---

## Workspace Access Context

Responsible for:

- Invitations
- Onboarding
- Membership
- Workspace access policies
- Workspace sessions
- Authorization

Does **not** manage:

- Identity creation
- Passwords
- Credentials

---

## Enrollment Context

Responsible for:

- Enrollment
- Registration into Learning Products
- Enrollment lifecycle

Depends on:

- Active Workspace Membership

---

## Workspace Experience Context

Responsible for:

- Navigation
- Branding
- Workspace layout
- User interface composition
- Personalization
- Workspace configuration

Depends on:

- Active Workspace Session

---

## Learning Delivery Context

Responsible for:

- Lessons
- Interactive Learning Events
- Progress
- Assessments
- Learning activities

Depends on:

- Active Enrollment

---

## AI Context

Responsible for:

- Lesson generation
- Transcript generation
- Interactive question generation
- AI recommendations
- AI tutoring
- AI review

Consumes business events from multiple contexts.

---

# Context Dependency Model

```text
Identity
      │
      ▼
Workspace Access
      │
      ▼
Enrollment
      │
      ▼
Workspace Experience
      │
      ▼
Learning Delivery
      │
      ▼
Assessment
      │
      ▼
Certification
```

Dependencies flow downward.

Lower contexts never depend on higher contexts.

---

# Cross-Context Communication

Bounded Contexts communicate through Domain Events.

Example:

```text
IdentityCreated
            │
            ▼
Workspace Access

WorkspaceMembershipCreated
            │
            ▼
Enrollment

EnrollmentCreated
            │
            ▼
Learning Delivery

LessonCompleted
            │
            ▼
Assessment

AssessmentPassed
            │
            ▼
Certification
```

This architecture minimizes direct coupling.

---

# Ownership Matrix

| Business Concept | Platform | Workspace | Identity |
|------------------|----------|-----------|----------|
| Identity | ✓ | | |
| Credentials | ✓ | | |
| Authentication | ✓ | | |
| Invitation | | ✓ | |
| Membership | | ✓ | |
| Workspace Session | | ✓ | |
| Workspace Branding | | ✓ | |
| Learning Products | | ✓ | |
| Professional Profile | | | ✓ |
| Reputation | | | ✓ |
| Portfolio | | | ✓ |

Ownership determines who is responsible for maintaining and governing each concept.

---

# Lifecycle Relationships

```text
Person

↓

Identity

↓

Workspace Membership

↓

Enrollment

↓

Workspace Session

↓

Learning Activity

↓

Assessment

↓

Certification

↓

Professional Growth
```

This sequence represents the learner's long-term journey through the platform.

---

# Architectural Boundaries

## Platform Responsibility

The platform provides shared infrastructure.

Including:

- Identity
- Authentication
- Security
- Core services
- AI infrastructure
- Notifications
- Storage
- Audit
- Analytics

---

## Workspace Responsibility

Each Workspace owns its educational business.

Including:

- Branding
- Membership
- Learning Products
- Courses
- Lessons
- Communication
- Policies
- Learner experience

---

## Identity Responsibility

Each Identity owns personal professional assets.

Including:

- Credentials
- Professional profile
- Achievements
- Reputation
- Verification
- Career history

---

# Architectural Decision Summary

| ADR | Decision |
|------|----------|
| ADR-001 | One Person owns one global Identity. |
| ADR-002 | Identity is platform-owned. |
| ADR-003 | Membership is Workspace-owned. |
| ADR-004 | Learners always enter through a Workspace Entry Point. |
| ADR-005 | Workspace Resolution occurs before authentication. |
| ADR-006 | Authentication is global. |
| ADR-007 | Authorization is Workspace-specific. |
| ADR-008 | Workspace Sessions isolate educational experiences. |
| ADR-009 | The platform remains invisible to learners whenever possible. |
| ADR-010 | Workspaces operate as independent learning businesses on shared infrastructure. |

---

# Identity & Workspace Access in the Enterprise Architecture

The Identity & Workspace Access domain forms the foundation of the Learning Workspace Platform.

It establishes:

- who the learner is,
- how they authenticate,
- how they enter a Workspace,
- how participation is authorized,
- how Workspace Sessions are created,
- and how independent educational businesses coexist on a shared platform.

All higher-level domains—including Learning Products, Learning Delivery, AI Services, Assessments, Certification, Community, and Professional Growth—depend on this foundation while remaining independently evolvable.

---

# Summary

Identity & Workspace Access is the foundational business domain of the Learning Workspace Platform.

It separates global identity management from Workspace-specific participation, allowing every Workspace Owner, academy, or organization to operate as an independent educational business while sharing secure, scalable platform infrastructure.

This separation of concerns is a defining architectural characteristic of the platform and enables future scalability, multi-tenancy, AI integration, marketplace capabilities, and lifelong professional learning without compromising the autonomy of individual Workspaces.These rules form the authoritative governance layer for the platform and should be referenced by all bounded contexts, application services, and implementation components.They establish a shared business language across bounded contexts while preserving autonomy, enabling future scalability, workflow automation, AI orchestration, analytics, notifications, and event-driven integration without tightly coupling the platform's core domains.This architecture is a key differentiator of the Learning Workspace Platform, enabling every Workspace Owner to operate what appears to be an independent educational business without duplicating authentication, identity management, or core platform services.- Secure and reusable authentication.While Workspaces deliver educational experiences and contribute evidence of learning and teaching, the resulting professional assets belong permanently to the Identity, supporting continuous professional development across an entire career.It provides the business boundary that allows every Workspace Owner to operate an independent learning business while sharing the platform's underlying infrastructure.