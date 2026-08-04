# Analytics Context

**Version:** 1.0 (Draft)

**Bounded Context Type:** Supporting Domain

**Domain Classification:** Strategic Supporting Context

> **Origin Note:** Analytics Context appeared in the Bounded Context Map (Section 5.13), Bounded Context Identification, the Domain Event Model (Section 14, and as a named consumer throughout), and Workspace Context (as the owner of "Reports"), but had never received the standalone business-analysis treatment that comparably-scoped Supporting Contexts — Communication, Scheduling, Commerce — each already have. This document supplies that treatment.

**Related Documents**

- Learning Workspace Bounded Context Map (Section 5.13)
- Learning Workspace Domain Event Model (Section 14)
- Workspace Context
- Workspace Owner Experience Context (Bounded Context Map, Section 5.5)
- Learning Workspace Bounded Context Identification

---

# 1. Context Purpose

## Definition

The Analytics Context transforms operational data generated across the platform into insights.

It answers:

> "What is happening, and what should we improve?"

---

# 2. Business Responsibility

The Analytics Context owns:

- Analytics models
- Reports
- Dashboards
- Insights

---

# 3. Core Principle

## Analytics Observes; It Does Not Own

Every other bounded context in the platform owns the business facts it produces — a Submission's grade belongs to Assessment, an Enrollment's status belongs to Enrollment, a Payment belongs to Commerce. Analytics Context owns none of these facts. It owns only the derived models, aggregations, and insights built by observing the domain events those contexts already publish (Learning Workspace Domain Event Model, Sections 1–14, "Consumers: Analytics").

---

Example:

An operational fact (owned elsewhere):

```
Submission evaluated: 62% (Assessment Context)
Submission evaluated: 58% (Assessment Context)
Submission evaluated: 65% (Assessment Context)
```

An Analytics insight (owned here):

```
Many learners fail at the same concept.
```

Analytics Context did not create the underlying Submissions — it noticed the pattern across them.

---

# 4. Core Concepts

---

# 4.1 Analytics Model

## Definition

A defined computation or aggregation applied to operational data from one or more contexts.

---

## Examples

- Completion rate by Learning Product
- Average time-to-grade by Assessment
- Learner engagement trend
- Revenue per Learning Product (sourced from Commerce Context)

---

# 4.2 Report

## Definition

A structured, point-in-time or scheduled presentation of one or more Analytics Models.

---

## Examples

```
Monthly Workspace Performance Report

Enrollments: 142
Completions: 98
Average Grade: 81%
Revenue: $4,200
```

---

# 4.3 Dashboard

## Definition

A live, continuously updated view of selected Analytics Models, scoped to an audience.

---

## Examples

- Workspace Owner dashboard (business performance)
- Learner progress dashboard (personal performance)
- Platform Administration dashboard (cross-Workspace health)

---

# 4.4 Insight

## Definition

A meaningful pattern or recommendation surfaced from Analytics Models, often AI-assisted.

---

## Examples

```
LearningInsightGenerated:

"Many learners fail at the same concept."

BusinessInsightGenerated:

"Course completion dropped after Module 3."
```

(per Learning Workspace Domain Event Model, Section 14)

---

# 5. Owned Data

The Analytics Context is the source of truth for:

| Data | Owner |
|-|-|
| Analytics Models | Analytics Context |
| Reports | Analytics Context |
| Dashboards | Analytics Context |
| Insights | Analytics Context |

---

# 6. Data Not Owned

| Data | Owner |
|-|-|
| Enrollment, Assessment, Submission, Certificate facts | Their respective owning contexts |
| Payments, Orders, Revenue records | Commerce Context |
| Learner or Member identity | Identity Context / Workspace Access Context |
| Workspace configuration | Workspace Management Context |

Analytics Context consumes all of the above by subscribing to their published domain events; it never writes back to them.

---

# 7. Business Rules

---

## Rule 1 — Analytics Never Originates Business Facts

Every figure an Analytics Model reports must be traceable to a domain event published by the context that owns the underlying fact. Analytics Context does not invent or independently record business data.

---

## Rule 2 — Analytics Respects Workspace Isolation

An Analytics Model, Report, or Dashboard scoped to one Workspace never includes another Workspace's data, consistent with Workspace Context's Rule 1 ("Workspace Isolation").

---

## Rule 3 — Insights Are Recommendations, Not Actions

An Insight (e.g., `BusinessInsightGenerated`) surfaces a pattern for a human — typically a Workspace Owner — to act on. Analytics Context does not itself change Workspace configuration, pricing, or content in response to an Insight; that follows the same "AI Suggestion → Human Approval → Domain Ownership" flow the Bounded Context Map defines for AI Context (Section 6).

---

## Rule 4 — Historical Reports Are Preserved

A generated Report is a point-in-time record and is not recalculated retroactively when the underlying data later changes; a new Report reflects new data instead (consistent with the platform's general preference for preserving historical records — Assessment Context, Rule 2, applied here by analogy).

---

# 8. Relationships

---

# Analytics → Workspace Owner Experience

Relationship:

```
Analytics Context builds

Workspace Owner Experience Context presents

(Workspace Owner Experience Context, Bounded Context Map Section 5.5,
already lists "Workspace Owner analytics view" under its own Owns —
Analytics Context is the source of the models behind that view; Workspace
Owner Experience Context is responsible for how they are presented.)
```

---

# Analytics → Every Domain Context

Relationship:

```
Domain Event

↓ (published by any context)

Analytics Context

↓ (aggregates, over time)

Analytics Model
```

---

# Analytics → AI Context

Relationship:

```
Analytics Model

may be interpreted by

AI Context, to produce a Business or Learning Insight
```

---

# Analytics → Commerce

Relationship:

```
Payment / Order / Subscription Events

feed

Revenue Analytics Models
```

---

# 9. Analytics Domain Events

- LearningInsightGenerated
- BusinessInsightGenerated

Both are already defined in the Learning Workspace Domain Event Model, Section 14; this document establishes Analytics Context as their owning context.

---

# 10. Future Evolution

The Analytics Context should support:

## Predictive Analytics

Forecasting completion likelihood or churn risk from early engagement patterns.

---

## Cross-Workspace Platform Insights

Aggregate, anonymized insights available to Platform Administration without exposing any individual Workspace's private data (Rule 2, above, still applies at the individual-Workspace reporting level).

---

## Self-Serve Analytics Model Builder

Allowing a Workspace Owner to define custom Analytics Models beyond the platform's built-in set.

---

# 11. Architectural Notes

The Analytics Context manages observation, aggregation, and insight generation.

It should not manage:

- the business facts it observes (owned by their respective contexts);
- how those insights are visually presented to a Workspace Owner (Workspace Owner Experience Context's responsibility);
- automated action taken on an insight (requires human approval, per Rule 3).

Its responsibility is:

```
What happened, across the data other contexts already own?

What pattern does it form?

What should someone do about it?
```
