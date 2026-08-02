# AI Business Context Architecture

> Version: 1.0
>
> Status: Draft
>
> Domain: Artificial Intelligence
>
> Related Documents:
>
> - Artificial Intelligence Business Architecture
> - AI Authoring Assistant Architecture
> - Identity & Workspace Access Architecture
> - Learning Product Context
> - Learning Delivery Context
> - Assessment Context

---

# 1. Overview

The AI Business Context Architecture defines how Artificial Intelligence understands the business environment in which a request is made.

Rather than processing isolated prompts, AI operates using structured business context that represents the current user, Workspace, educational content, permissions, and business objectives.

Business Context ensures that AI recommendations are relevant, secure, explainable, and consistent across the Learning Workspace Platform.

---

# 2. Vision

AI should understand the same business environment that a human collaborator would naturally understand.

When a teacher asks AI to assist, the assistant should already know:

- who is asking,
- which Workspace they are working in,
- which lesson they are editing,
- the educational goals,
- the learner audience,
- and the permissions that govern the request.

The teacher should not have to repeatedly explain information that already exists within the platform.

---

# 3. Objectives

The AI Business Context Architecture aims to:

- Improve recommendation quality.
- Eliminate repetitive prompts.
- Respect Workspace boundaries.
- Respect user permissions.
- Standardize AI behavior.
- Enable reusable AI capabilities.
- Support future AI assistants through a common context model.

---

# 4. Guiding Principles

## AIBC-001

AI consumes structured business context rather than relying solely on natural language prompts.

---

## AIBC-002

Business Context is assembled by the platform.

Users should not manually reconstruct information already known by the system.

---

## AIBC-003

Business Context is permission-aware.

Only information the requesting Identity is authorized to access may be included.

---

## AIBC-004

Business Context is Workspace-scoped.

Context never crosses Workspace boundaries unless explicitly supported by a future business capability.

---

## AIBC-005

Business Context is extensible.

New domains may contribute additional context without changing existing AI capabilities.

---

# 5. Business Context Model

Every AI request operates within a Business Context.

```text
AI Business Context

├── Identity Context
├── Workspace Context
├── Membership Context
├── Learning Product Context
├── Lesson Context
├── Assessment Context
├── Curriculum Context
├── Organization Context
├── Personal Preferences
├── Workspace Policies
└── AI Conversation Context
```

Each context contributes business knowledge relevant to the request.

---

# 6. Identity Context

Identity Context answers:

> Who is requesting AI assistance?

Typical information includes:

- Identity Identifier
- Display Name
- Preferred Language
- Roles
- Permissions
- Authentication Status

Identity Context determines who AI is collaborating with.

---

# 7. Workspace Context

Workspace Context answers:

> Which academy is the request being made within?

Typical information includes:

- Workspace
- Branding
- Workspace Language
- Workspace Configuration
- AI Policies
- Educational Philosophy
- Available Features

AI should adapt recommendations to the current Workspace.

---

# 8. Membership Context

Membership Context answers:

> What is the user's role inside this Workspace?

Examples:

- Teacher
- Learner
- Teaching Assistant
- Administrator
- Observer

Permissions are evaluated using Membership rather than Identity alone.

---

# 9. Learning Product Context

When applicable, AI receives information about the Learning Product.

Examples:

- Course
- Program
- Learning Path
- Module
- Unit
- Lesson hierarchy
- Learning objectives
- Intended audience

This enables AI to generate recommendations aligned with the overall learning experience.

---

# 10. Lesson Context

Lesson Context is central to authoring scenarios.

Examples include:

- Lesson title
- Lesson description
- Transcript
- Chapters
- Interactive Learning Events
- Existing questions
- Objectives
- Summary
- Attachments
- Resources

AI should enhance the existing lesson rather than regenerate it.

---

# 11. Assessment Context

Assessment-related requests include:

- assessment type
- grading strategy
- rubric
- learning outcomes
- existing questions
- learner attempts (when permitted)

This context enables meaningful assessment assistance.

---

# 12. Curriculum Context

Curriculum Context provides instructional guidance.

Examples:

- curriculum
- subject
- grade
- educational standards
- competency framework
- learning outcomes

AI recommendations should align with the selected curriculum whenever applicable.

---

# 13. Organization Context

For organization-owned Workspaces, AI may consider:

- organization policies
- terminology
- teaching standards
- branding
- governance requirements

Organization Context is optional and only available when applicable.

---

# 14. Workspace Policies

AI must respect Workspace policies.

Examples:

- AI enabled features
- publishing approval requirements
- permitted AI capabilities
- supported languages
- assessment policies

Policies influence AI behavior without changing AI capabilities.

---

# 15. AI Conversation Context

AI conversations should maintain continuity.

Conversation Context may include:

- previous requests
- accepted recommendations
- rejected recommendations
- current authoring session
- unresolved suggestions

This enables natural collaboration without requiring repetitive prompts.

---

# 16. Context Assembly

Business Context is assembled by the platform before invoking an AI capability.

```text
User Request

↓

Permission Validation

↓

Collect Identity Context

↓

Collect Workspace Context

↓

Collect Business Context

↓

Validate Policies

↓

Invoke AI Capability
```

The requesting user does not manually assemble context.

---

# 17. Context Lifecycle

```text
User Action

↓

Business Context Created

↓

AI Request

↓

AI Recommendation

↓

User Decision

↓

Context Updated

↓

Next AI Request
```

Business Context evolves as work progresses.

---

# 18. Business Rules

| Rule | Description |
|------|-------------|
| AIBC-001 | Every AI request operates within a Business Context. |
| AIBC-002 | Context must respect Workspace boundaries. |
| AIBC-003 | Context must respect user permissions. |
| AIBC-004 | Context should be reused across a continuous authoring session. |
| AIBC-005 | AI capabilities should consume Business Context rather than reconstruct it independently. |
| AIBC-006 | New domains may contribute additional context without modifying existing AI capabilities. |

---

# 19. Domain Events

Examples include:

- AIBusinessContextCreated
- AIBusinessContextUpdated
- AIConversationStarted
- AIConversationEnded
- AIRequestPrepared
- AIContextValidated

---

# 20. Related Business Domains

| Domain | Relationship |
|---------|--------------|
| Identity | Provides requester identity. |
| Workspace Access | Provides Workspace and Membership context. |
| Learning Product | Provides product structure and objectives. |
| Learning Delivery | Provides lesson and activity context. |
| Assessment | Provides assessment context. |
| Organization | Provides organizational policies. |
| Artificial Intelligence | Consumes assembled Business Context. |

---

# 21. Future Evolution

Future versions of the Business Context Architecture may incorporate:

- Cross-workspace organizational context (where business rules allow).
- Long-term educator preferences.
- Institutional teaching frameworks.
- AI memory strategies.
- Personalized assistant behavior.
- Multi-agent shared context.
- External knowledge sources governed by organizational policy.

---

# Summary

The AI Business Context Architecture establishes the shared business understanding required for all AI capabilities within the Learning Workspace Platform.

By assembling structured, permission-aware, Workspace-scoped context before every AI interaction, the platform enables consistent, relevant, and secure collaboration between users and AI while avoiding repetitive prompts and preserving the autonomy of each Workspace.