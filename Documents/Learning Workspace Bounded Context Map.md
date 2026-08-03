# Learning Workspace Bounded Context Map

**Version:** 1.4

**Document Type:** Domain Architecture Document

> **Revision Note (v1.1):** Section 5.2 "Identity & Membership Context" has been split into two contexts — **Identity Context** and **Workspace Access Context** — to align with the canonical split established in Identity & Workspace Access Architecture. Identity (authentication, credentials, global profile) is platform-owned infrastructure; Workspace Access (invitations, onboarding, membership, roles, sessions) is Workspace-owned. See Membership_Context.md, which has been reconciled to represent the Workspace Access Context specifically. Subsequent sections have been renumbered accordingly.
>
> **Revision Note (v1.2):** Former Section 5.8 "Interactive Learning Authoring Context" has been retired as a standalone bounded context. It was never reflected as a real ownership boundary in Lesson Revision Aggregate Design or the Platform Aggregate Catalogue, both of which assign interactive learning events to the Lesson / Lesson Revision aggregate under Learning Delivery Context. Interactive learning authoring is now documented as a capability of Learning Delivery Context. The Context Landscape Overview diagram (Section 3) and Core Domain composition (Section 4) have been updated accordingly. Sections renumbered from 5.8 onward.
>
> **Revision Note (v1.3):** Added a new Section 5.4 "Enrollment Context." Enrollment was previously referenced as a dependency throughout the corpus (Membership, Assignment, Assessment, Learning Delivery) and appears as an Aggregate Root in the Platform Aggregate Catalogue, but had no formal Bounded Context definition. It has been placed immediately after Workspace Access Context in both the landscape diagram and the numbered definitions, reflecting its dependency on an active Workspace Membership. All subsequent sections renumbered accordingly. A companion Enrollment Aggregate Design document has now been authored — see Enrollment_Aggregate_Design.md.
>
> **Revision Note (v1.4):** Renamed Section 5.5 "Tutor Workspace Experience Context" to **Workspace Owner Experience Context**, and updated its Owns list, the landscape diagram (Section 3), the Core Domain composition (Section 4), and the Multi-Tenant Workspace Boundary example (Section 7), to align with the Domain Language & Business Ontology's rule preferring "Workspace Owner" over "Tutor" for business ownership. Companion updates made to Identity & Workspace Access Architecture (v2.1) and Learning Workspace Capability Model (v1.2).

**Purpose:**

Defines the strategic relationships, ownership boundaries, and communication patterns between the bounded contexts of the Learning Workspace Platform.

---

# 1. Architecture Vision

The Learning Workspace Platform is a multi-tenant educational business operating system where every tutor, teacher, or education organisation can operate their own branded AI-powered learning environment.

The platform enables each workspace to:

- create educational products;
- manage reusable learning assets;
- deliver learning experiences;
- engage learners;
- generate revenue;
- use AI to improve teaching and operations.

---

# 2. Core Architectural Principle

## Bounded Context Ownership

Each bounded context owns a specific business capability and protects its own domain language.

A context should answer:

- What business responsibility does it own?
- What data is it the source of truth for?
- Which other contexts does it collaborate with?

---

# 3. Context Landscape Overview

```
                         Platform Administration
                                  |
                                  |
                                  v

                        Workspace Management
                                  |
                                  |
          +-----------------------+----------------------+
          |                                              |
          v                                              v

 Identity Context                              Workspace Owner Experience
          |                                              |
          v                                              |
 Workspace Access Context                                |
          |                                              |
          v                                              |
 Enrollment Context                                       |
          |                                              |
          +----------------------+-----------------------+
                                 |
                                 v

                    Learning Product Context
                                 |
             +-------------------+-------------------+
             |                                       |
             v                                       v

 Learning Asset Management              Commerce Context
             |
             |
             v

 Learning Delivery Context
             |
             | (includes Interactive Learning Events
             |  as a capability, not a separate context)
             v

 Assessment Context


Supporting Contexts:

- Scheduling Context
- Communication Context
- Analytics Context


AI Context provides intelligence across learning domains.
```

Note: Identity Context, Workspace Access Context, and Enrollment Context are shown as sequential boxes because each depends on the one before it (an authenticated Identity, then an active Workspace Membership, then a registered Enrollment), but they are three separate bounded contexts with distinct ownership — see sections 5.2, 5.3, and 5.4.

---

# 4. Core Domain

## AI-Powered Learning Workspace Experience

The core differentiation of the platform is not only delivering courses.

The platform enables educators to build and operate their own AI-powered learning businesses.

The Core Domain includes:

```
AI Content Intelligence

+

Interactive Learning Authoring

+

Workspace Owner Experience

+

Learning Asset Intelligence
```

Note: "Interactive Learning Authoring" here names a **capability** — delivered through Learning Delivery Context (specifically the Lesson Revision aggregate) and powered by AI Capability composition — not a separate bounded context. See Section 5.8 and the retirement note within it.

---

# 5. Bounded Context Definitions

---

# 5.1 Workspace Management Context

## Purpose

Manages the creation and configuration of independent Learning Workspaces.

---

## Owns

- Workspace identity
- Workspace settings
- Branding configuration
- Public portal configuration
- Workspace lifecycle

---

## Business Question

> "Who is the educational business represented by this workspace?"

---

# 5.2 Identity Context

## Purpose

Manages the lifelong, platform-owned digital identity of a person, independent of any Workspace.

---

## Owns

- Person identity
- Credentials and authentication
- External login providers
- Identity verification and resolution
- Global profile
- Professional identity, reputation, and portfolio

---

## Business Question

> "Who is this person, globally, across every Workspace they touch?"

---

## Does Not Own

Roles, permissions, and Workspace-specific membership belong to the Workspace Access Context (5.3), not Identity Context. Identity survives the removal of every Workspace Membership.

---

# 5.3 Workspace Access Context

## Purpose

Manages how an authenticated Identity gains access to, and participates in, a specific Workspace.

---

## Owns

- Workspace invitations
- Onboarding requests
- Workspace membership relationships
- Roles (Teacher, Learner, Parent, Administrator, etc.) — Workspace-scoped
- Permissions
- Workspace sessions

---

## Business Question

> "Who belongs to this Workspace, and what can they do inside it?"

---

## Does Not Own

Credentials, passwords, and authentication belong to Identity Context (5.2). Workspace Access Context authorizes participation; it never authenticates.

---

# 5.4 Enrollment Context

## Purpose

Registers an active Workspace Member into one or more Learning Products, distinct from Workspace membership itself.

---

## Owns

- Enrollment records
- Enrollment lifecycle (Invited → Active → Completed / Cancelled)
- Learner-to-Learning-Product registration
- Enrollment eligibility rules

---

## Business Question

> "Which Learning Products is this Member registered to participate in?"

---

## Does Not Own

Workspace participation itself belongs to Workspace Access Context (5.3) — a Member may hold an active Workspace Membership with zero Enrollments. Learning Product structure and content belong to Learning Product Context (5.6). Enrollment only records the registration relationship between a Membership and a Learning Product; see Identity & Workspace Access Architecture, Section II, for the business rule separating Membership from Enrollment.

---

# 5.5 Workspace Owner Experience Context

## Purpose

Creates the experience that makes each Workspace Owner feel they own their own teaching platform.

---

## Owns

- Workspace Owner dashboard experience
- Teaching workspace
- Workspace Owner analytics view
- Personal teaching environment
- Workspace customisation experience

---

## Business Question

> "How does the Workspace Owner operate their learning business?"

---

# 5.6 Learning Product Context

## Purpose

Defines educational offerings.

---

## Owns

- Courses
- Programmes
- Membership products
- Packages
- Product structure
- Product content strategy

---

## Business Question

> "What educational products are offered?"

---

# 5.7 Learning Asset Management Context

## Purpose

Manages reusable educational resources.

---

## Owns

- Videos
- Audio
- Documents
- Transcripts
- Question banks
- Worksheets
- Flashcards
- AI-generated assets

---

## Business Question

> "What educational knowledge and resources does this workspace own?"

---

# 5.8 Learning Delivery Context

## Purpose

Manages how learners experience education, including transforming content into interactive learning experiences.

---

## Owns

- Learning experiences
- Lessons
- Activities
- Learning flows
- Interactive learning events (video timelines, embedded questions, reflection activities, practice events, learning event structures)
- Learner progress

---

## Business Question

> "How does learning happen, and how do we turn content into active learning?"

---

## Retired: "Interactive Learning Authoring Context" (formerly Section 5.8)

Earlier versions of this document defined Interactive Learning Authoring as its own bounded context, owning interactive video timelines, embedded questions, reflection activities, practice events, and learning event structures. This was never reflected in Lesson Revision Aggregate Design or the Platform Aggregate Catalogue, both of which assign these same objects to the Lesson / Lesson Revision aggregate under Learning Delivery Context. That contradiction has been resolved by retiring the separate context: interactive learning authoring is a **capability** of Learning Delivery Context, exercised through the Lesson Revision aggregate and powered by AI Capability composition (see AI Capability Architecture, Section 10 — "Interactive Learning Capabilities"). Its owned objects have been merged into Learning Delivery Context's "Owns" list above.

---

# 5.9 Assessment Context

## Purpose

Measures learner achievement.

---

## Owns

- Assessments
- Questions
- Rubrics
- Grades
- Certificates
- Achievement records

---

## Business Question

> "How do we prove learning happened?"

---

# 5.10 Scheduling Context

## Purpose

Manages time-based learning operations.

---

## Owns

- Sessions
- Availability
- Bookings
- Timetables
- Calendar events

---

## Business Question

> "When and where does learning happen?"

---

# 5.11 Commerce Context

## Purpose

Manages financial relationships.

---

## Owns

- Pricing
- Offers
- Orders
- Payments
- Subscriptions
- Invoices
- Revenue records

---

## Business Question

> "How does the learning business generate revenue?"

---

# 5.12 Communication Context

## Purpose

Manages communication between the learning business and its community.

---

## Owns

- Messages
- Conversations
- Announcements
- Templates
- Communication history

---

## Business Question

> "How does the learning business communicate?"

---

# 5.13 Analytics Context

## Purpose

Transforms operational data into insights.

---

## Owns

- Analytics models
- Reports
- Dashboards
- Insights

---

## Business Question

> "What is happening and what should we improve?"

---

# 5.14 AI Context

## Purpose

Provides workspace-aware intelligence and automation.

---

## Owns

- AI agents
- AI configuration
- AI workspace profile
- AI interaction history
- AI-generated suggestions

---

## Business Question

> "How can AI help this learning business create, teach, and grow?"

---

# 6. Context Relationships

---

# AI Context → Learning Domains

## Relationship Type

Supporting / Enabling

---

AI provides:

- content generation;
- transcription;
- lesson creation;
- question generation;
- learner assistance;
- business recommendations.

---

Flow:

```
AI Suggestion

↓

Human Approval

↓

Domain Ownership
```

---

# Learning Product → Learning Delivery

## Relationship Type

Upstream / Downstream

---

Learning Product defines:

```
What is offered
```

Learning Delivery defines:

```
How learners experience it
```

---

# Learning Asset → Learning Product

## Relationship Type

Reusable Content Relationship

---

Flow:

```
Learning Asset Library

↓

Product Content Strategy

↓

Learning Product
```

---

# Commerce → Learning Product

## Relationship Type

Commercial Relationship

---

Commerce manages:

```
How products are sold
```

Learning Product manages:

```
What products are
```

---

# Scheduling → Learning Delivery

## Relationship Type

Operational Support

---

Scheduling provides:

```
When learning occurs
```

Learning Delivery provides:

```
What happens during learning
```

---

# Assessment → Learning Delivery

## Relationship Type

Evaluation Relationship

---

Learning Delivery creates learning evidence.

Assessment measures achievement.

---

# Communication → All Business Contexts

## Relationship Type

Event-Based Communication

---

Examples:

```
Payment Completed

↓

Send Receipt
```

```
Session Scheduled

↓

Send Reminder
```

```
Lesson Completed

↓

Send Achievement Message
```

---

# 7. Multi-Tenant Workspace Boundary

The platform operates as:

```
One SaaS Platform

        |

        +----------------+

        |                |

 Workspace A       Workspace B

 Workspace Owner A  Workspace Owner B

 Own Content       Own Content

 Own Learners      Own Learners

 Own AI Profile    Own AI Profile

 Own Revenue       Own Revenue
```

---

# 8. Workspace-Native AI Model

Each workspace has its own AI identity.

Example:

```
Workspace:

Language Academy


AI Behaviour:

Friendly

Teaching Style:

Conversation-based

Feedback Style:

Encouraging
```

---

Another workspace:

```
Workspace:

Exam Preparation Academy


AI Behaviour:

Structured

Teaching Style:

Assessment-focused

Feedback Style:

Detailed
```

---

# 9. Strategic Architecture Flow

```
Workspace Creation

        |

        v

Workspace Identity

        |

        v

Learning Products

        |

        v

Learning Assets

        |

        v

Learning Experiences

        |

        v

Interactive Learning Events

        |

        v

Assessment & Achievement

        |

        v

Learner Success
```

AI supports every stage.

---

# 10. Final Architecture Principle

The Learning Workspace Platform is not:

```
A place to upload courses
```

It is:

```
An AI-powered operating system

where educators build,

deliver,

sell,

and improve

their own learning businesses.
```