# Learning Workspace Bounded Context Map

**Version:** 1.0

**Document Type:** Domain Architecture Document

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

 Identity & Membership                         Tutor Workspace Experience
          |                                              |
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
             |
             v

 Interactive Learning Events
             |
             |
             v

 Assessment Context


Supporting Contexts:

- Scheduling Context
- Communication Context
- Analytics Context


AI Context provides intelligence across learning domains.
```

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

Tutor Workspace Experience

+

Learning Asset Intelligence
```

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

# 5.2 Identity & Membership Context

## Purpose

Manages people and their relationships with workspaces.

---

## Owns

- User identity
- Roles
- Permissions
- Membership relationships
- Teacher membership
- Learner membership
- Parent relationships

---

## Business Question

> "Who belongs to this learning environment?"

---

# 5.3 Tutor Workspace Experience Context

## Purpose

Creates the experience that makes each tutor feel they own their own teaching platform.

---

## Owns

- Tutor dashboard experience
- Teaching workspace
- Tutor analytics view
- Personal teaching environment
- Workspace customisation experience

---

## Business Question

> "How does the educator operate their learning business?"

---

# 5.4 Learning Product Context

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

# 5.5 Learning Asset Management Context

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

# 5.6 Learning Delivery Context

## Purpose

Manages how learners experience education.

---

## Owns

- Learning experiences
- Lessons
- Activities
- Learning flows
- Interactive learning events
- Learner progress

---

## Business Question

> "How does learning happen?"

---

# 5.7 Interactive Learning Authoring Context

## Purpose

Transforms content into interactive learning experiences.

---

## Owns

- Interactive video timelines
- Embedded questions
- Reflection activities
- Practice events
- Learning event structures

---

## Business Question

> "How do we turn content into active learning?"

---

# 5.8 Assessment Context

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

# 5.9 Scheduling Context

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

# 5.10 Commerce Context

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

# 5.11 Communication Context

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

# 5.12 Analytics Context

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

# 5.13 AI Context

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

 Tutor A           Tutor B

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