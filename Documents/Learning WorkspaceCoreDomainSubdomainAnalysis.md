# Learning Workspace Core Domain & Subdomain Analysis

**Version:** 1.0 (Draft)

**Status:** Foundational Domain-Driven Design (DDD) Specification

**Depends On**

- Learning Workspace Domain Language & Business Ontology
- Learning Workspace Capability Model

---

# 1. Purpose

## 1.1 Objective

This document identifies the business domains that make up the Learning Workspace Platform and classifies them according to Domain-Driven Design (DDD) principles.

The purpose is to distinguish:

- the business capabilities that create competitive advantage,
- the capabilities that support the business,
- and the capabilities that are generic infrastructure.

This classification guides:

- software architecture
- bounded contexts
- engineering investment
- product strategy
- long-term evolution

---

# 2. Domain Classification

The platform is divided into three categories.

## Core Domain

The business capabilities that make the platform unique.

These are the primary reason customers choose the platform.

The majority of engineering innovation should happen here.

---

## Supporting Domains

Business capabilities that are necessary for operating a Learning Workspace but are not unique to the platform.

These require good design but are not strategic differentiators.

---

## Generic Domains

Commodity capabilities that are common across many software products.

These should be purchased, integrated, or implemented using established patterns whenever possible.

---

# 3. Core Domain

The Core Domain represents the unique business value of the Learning Workspace Platform.

Unlike traditional LMS products, the platform's core business is **not course management**.

The core business is enabling educators and organisations to launch, operate, personalise and grow independent AI-powered learning businesses.

---

## Core Domain Statement

> The Core Domain of the platform is **Learning Workspace Management**.

A Learning Workspace is the primary business entity of the platform.

Everything else exists to support the successful operation of a Learning Workspace.

---

# 4. Core Subdomains

---

## 4.1 Workspace Identity

### Purpose

Represents the existence of an independent educational business.

### Responsibilities

- Workspace lifecycle
- Workspace identity
- Public profile
- Workspace discovery
- Ownership
- Visibility

### Strategic Importance

★★★★★

---

## 4.2 Workspace Experience

### Purpose

Creates a completely customised educational experience.

### Responsibilities

- Learner experience
- Tutor experience
- Parent experience
- Navigation
- Portal behaviour
- Branding integration
- Workspace personalisation

### Strategic Importance

★★★★★

---

## 4.3 Workspace Configuration

### Purpose

Allows every workspace to define how it operates.

### Responsibilities

- Educational philosophy
- Learning preferences
- Communication rules
- Workspace behaviour
- Regional settings
- Feature configuration

### Strategic Importance

★★★★★

---

## 4.4 Learning Product Management

### Purpose

Allows workspaces to design educational offerings.

### Responsibilities

- Learning products
- Programmes
- Courses
- Tutoring services
- Workshops
- Bootcamps
- Learning paths

### Strategic Importance

★★★★★

---

## 4.5 AI Workspace Intelligence

### Purpose

Provides workspace-specific AI capabilities.

### Responsibilities

- AI tutor
- AI teaching assistant
- AI assessment
- AI recommendations
- AI content generation
- AI workspace memory
- Workspace knowledge

### Strategic Importance

★★★★★

---

# 5. Supporting Domains

Supporting Domains are critical to operating a successful Learning Workspace but do not provide unique competitive advantage.

---

## Learning Delivery

Responsibilities

- Lessons
- Activities
- Homework
- Attendance
- Practice
- Progress

---

## Assessment

Responsibilities

- Quizzes
- Assignments
- Exams
- Rubrics
- Grades
- Certificates

---

## Scheduling

Responsibilities

- Timetables
- Events
- Bookings
- Calendars
- Deadlines

---

## Community

Responsibilities

- Forums
- Groups
- Clubs
- Challenges
- Discussions

---

## Communication

Responsibilities

- Messages
- Announcements
- Notifications
- Parent communication

---

## Analytics

Responsibilities

- Learning analytics
- Business analytics
- Reports
- KPIs

---

## Automation

Responsibilities

- Workflow
- Automation rules
- Scheduled tasks
- Event-driven actions

---

## Team Management

Responsibilities

- Staff
- Departments
- Teams
- Internal collaboration

---

# 6. Generic Domains

These domains should leverage existing industry solutions whenever practical.

---

## Identity & Authentication

Examples

- OAuth
- OpenID Connect
- SSO
- MFA

---

## Billing Infrastructure

Examples

- Platform subscriptions
- Tax calculation
- Platform invoices

---

## Payment Processing

Examples

- Stripe
- PayPal
- Adyen

---

## Email Infrastructure

Examples

- SMTP
- SendGrid
- Amazon SES

---

## File Storage

Examples

- Azure Blob Storage
- Amazon S3

---

## Search

Examples

- Elasticsearch
- OpenSearch

---

## Monitoring

Examples

- Logging
- Metrics
- Tracing

---

## API Infrastructure

Examples

- REST
- GraphQL
- Webhooks

---

# 7. Domain Investment Strategy

| Domain Type | Engineering Investment | Competitive Value |
|-------------|------------------------|-------------------|
| Core | Very High | Very High |
| Supporting | Medium | Medium |
| Generic | Low | Low |

---

# 8. Design Principles

## Build Core, Buy Generic

Engineering effort should focus on Core Domains.

Generic Domains should leverage mature external solutions whenever appropriate.

---

## Business First

Business concepts should drive technical architecture.

---

## Workspace-Centric Design

Every business capability must exist to strengthen the Learning Workspace.

---

## AI-Native

AI should be treated as a first-class business capability rather than an optional enhancement.

---

## Future-Proof

Core Domains must support growth from:

- Independent Tutor
- Tutoring Business
- Academy
- Learning Centre
- Educational Organisation

without changing the underlying domain model.

---

# 9. Relationship to Future Documents

This document directly drives:

- Bounded Context Identification
- Context Mapping
- Aggregate Design
- Entity Design
- Value Objects
- Domain Services
- Application Services
- Product Blueprint
- Software Architecture
