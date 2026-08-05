# Workspace Access Channel Architecture

**Version:** 1.0  
**Status:** Draft  
**Domain:** Identity & Membership  
**Bounded Context:** Workspace Access  
**Audience:** Business Architects, Product Owners, Solution Architects, UX Designers, Engineering Teams

---

# 1. Purpose

This document defines the business architecture for all mechanisms through which users gain access to a workspace.

Rather than treating invitation links, QR codes, enrollment codes, or public workspace URLs as separate business concepts, the platform models them as different **Access Channels** that lead into a common membership and identity process.

The architecture provides a consistent and extensible approach for granting workspace access regardless of how the user entered the platform.

---

# 2. Business Goals

The architecture aims to:

- Support multiple workspace entry channels.
- Provide a consistent user experience regardless of entry method.
- Decouple access channels from membership processing.
- Allow future access mechanisms without changing core business logic.
- Centralize security, auditing, and validation.
- Support multiple onboarding journeys.
- Minimize duplication across invitation mechanisms.

---

# 3. Scope

## In Scope

- Invitation links
- Invitation QR codes
- Workspace join QR codes
- Enrollment codes
- Public workspace URLs
- Organization portals
- Marketplace enrollment
- Future access channels

## Out of Scope

- Authentication
- Membership lifecycle
- Workspace onboarding
- Course enrollment
- Learning experience

These are covered by separate architecture documents.

---

# 4. Core Business Concept

## Workspace Access Channel

A Workspace Access Channel is any business mechanism that enables a person to begin the process of joining or entering a workspace.

An Access Channel is **not** a membership.

An Access Channel is **not** an invitation.

An Access Channel is simply the entry point into the workspace access process.

---

# 5. Business Principles

## 5.1 Channel Independence

Business rules must not depend on whether access originated from:

- Email
- QR Code
- SMS
- Marketplace
- Mobile App
- Organization Portal

All channels ultimately execute the same membership process.

---

## 5.2 Single Membership Process

Regardless of the access channel used, membership creation follows a common business workflow.

Different channels may require different validation rules but must not duplicate membership logic.

---

## 5.3 Extensibility

New access channels should be introduced without modifying existing business workflows.

Examples include:

- NFC cards
- Biometric devices
- Learning kiosks
- Third-party integrations

---

## 5.4 Secure Access

Access channels never expose sensitive business information.

Tokens should reference server-side resources rather than embedding business data.

---

# 6. Access Channel Types

## 6.1 Invitation Link

Purpose

Provides direct access to a previously created invitation.

Characteristics

- Personalized
- Time limited
- Revocable
- Single or multiple use
- Usually delivered by email or messaging

Business Outcome

Invitation acceptance.

---

## 6.2 Invitation QR Code

Purpose

Represents an existing invitation as a scannable code.

Characteristics

- Represents the same invitation as the invitation link
- No duplicate invitation created
- Supports printed and in-person onboarding

Business Outcome

Invitation acceptance.

---

## 6.3 Workspace Join QR Code

Purpose

Allows a user to request membership to a workspace.

Characteristics

- No invitation exists
- Owner approval may be required
- Suitable for conferences, classrooms, events, posters

Business Outcome

Membership request.

---

## 6.4 Enrollment Code

Purpose

Allows users to manually enter a workspace.

Examples

ABCD-93XF

Business Outcome

Invitation lookup or membership request.

---

## 6.5 Public Workspace URL

Purpose

Expose a public workspace landing page.

Examples

learn.myplatform.com/math-academy

Business Outcome

View workspace information before joining.

---

## 6.6 Marketplace Entry

Purpose

Join a workspace through the platform marketplace.

Business Outcome

Purchase, subscription, or membership request.

---

## 6.7 Organization Portal

Purpose

Users access workspaces through their organization.

Examples

School Portal

University Portal

Corporate Learning Portal

Business Outcome

Automatic membership resolution.

---

# 7. Business Capability Map

Workspace Access

├── Invitation Management

├── Access Channel Resolution

├── Token Validation

├── Membership Resolution

├── Authentication

├── Authorization

├── Workspace Resolution

└── Workspace Onboarding

---

# 8. Business Flow

```
Access Channel

        │

        ▼

Resolve Channel

        │

        ▼

Validate Access

        │

        ▼

Authenticate User

        │

        ▼

Resolve Membership

        │

        ▼

Membership Exists?

      │          │

     Yes         No

      │          │

      ▼          ▼

Enter      Create Membership

Workspace         │

                  ▼

          Workspace Onboarding

                  │

                  ▼

           Tutor Home
```

---

# 9. Invitation QR Business Rules

## BR-001

Invitation QR Codes represent existing invitations.

They never create new invitations.

---

## BR-002

Invitation Links and Invitation QR Codes are interchangeable.

Both resolve to the same Invitation.

---

## BR-003

Revoking an invitation invalidates all associated access channels.

---

## BR-004

Invitation expiration affects every delivery channel equally.

---

# 10. Workspace Join QR Business Rules

## BR-005

Workspace Join QR Codes never represent invitations.

---

## BR-006

Scanning a Workspace Join QR starts a membership request.

---

## BR-007

Workspace owners determine whether approval is required.

---

## BR-008

Approved requests create memberships.

Rejected requests terminate the workflow.

---

# 11. Security Principles

Access Channels must never expose:

- Workspace identifiers
- Membership identifiers
- User identifiers
- Roles
- Permissions

Channels expose only opaque references.

Example

https://learn.platform.com/a/8M9XQ2N7

The server resolves the reference.

---

# 12. Audit Requirements

The platform records:

- Access channel used
- Device information
- Time
- Authentication status
- Membership outcome
- Workspace entered
- Failure reasons

---

# 13. Future Evolution

The architecture supports future channels including:

- NFC Cards
- Mobile Deep Links
- Digital Student IDs
- Smart Classroom Displays
- Partner Platforms
- Government Identity Providers
- Learning Marketplace Integrations

No changes to membership processing should be required.

---

# 14. Related Architecture Documents

- Identity & Workspace Access Architecture
- Identity & Membership Architecture
- Tutor Workspace First-Time Experience Architecture
- Tutor Workspace Lifecycle Architecture
- Workspace Provisioning Architecture
- Learning Workspace Experience Architecture

---

# 15. Architectural Summary

The platform separates **how users discover and access a workspace** from **how memberships are created and managed**.

Every Access Channel serves as an entry point into a common membership pipeline, enabling new access methods to be introduced without altering the underlying business processes.

This separation increases flexibility, simplifies maintenance, improves security, and supports future expansion of the platform ecosystem.