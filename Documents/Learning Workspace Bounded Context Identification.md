# Learning Workspace Bounded Context Identification

**Version:** 1.2 (Draft)

**Status:** Domain-Driven Design Specification

> **Revision Note (v1.1):** "Membership Context" has been renamed **Workspace Access Context** throughout this document to align with Identity & Workspace Access Architecture and the Bounded Context Map (v1.1). This context already appeared correctly separated from Identity Context in the original v1.0 context list — only the label changes, not the boundary.
>
> **Revision Note (v1.2):** Added **Enrollment Context** to the Initial Bounded Context Map (Section 4) and classified it as a Supporting Context (Section 5), aligning with its addition to the Bounded Context Map (v1.3). Enrollment was previously referenced constantly as a dependency across the corpus but had no formal entry in this document's context list.

**Depends On**

- Learning Workspace Domain Language & Business Ontology
- Learning Workspace Capability Model
- Learning Workspace Core Domain Analysis
- Learning Workspace Business Value Streams

---

# 1. Purpose

## 1.1 Objective

This document identifies the business boundaries within the Learning Workspace Platform.

Each bounded context represents a clear area of business responsibility with:

- its own language,
- its own rules,
- its own ownership,
- and its own model.

The purpose is to prevent the platform from becoming a collection of tightly coupled features.

---

# 2. What Is a Bounded Context?

A Bounded Context is a boundary within which a specific business model is valid.

Inside a bounded context:

- terms have a specific meaning;
- business rules are consistent;
- data ownership is clear;
- changes can happen independently.

The same word may have different meanings in different contexts.

Example:

"Student"

In:

## Learning Context

Student means:

> A person actively participating in learning activities.

---

In:

## Commerce Context

Student means:

> A customer who purchased a learning product.

---

In:

## Communication Context

Student means:

> A recipient of educational communication.

---

The contexts do not need to share the same model.

---

# 3. Bounded Context Identification Criteria

A capability should become a separate bounded context when it has:

## 3.1 Independent Business Responsibility

The capability owns a clear business outcome.

Example:

Learning Product Management owns:

"Creating educational offerings."

---

## 3.2 Independent Business Rules

The capability contains rules that change independently.

Example:

Commerce rules:

- pricing
- discounts
- refunds
- subscriptions

should not affect Learning rules:

- lessons
- progress
- assessments

---

## 3.3 Independent Language

The capability has its own vocabulary.

Example:

Commerce:

- Order
- Payment
- Invoice
- Subscription

Learning:

- Course
- Lesson
- Activity
- Progress

---

## 3.4 Independent Evolution

The capability can evolve without requiring changes everywhere else.

---

## 3.5 Clear Ownership

One context should be the source of truth for its data.

---

# 4. Initial Bounded Context Map

Based on the current business architecture, the initial bounded contexts are:

```
Learning Workspace Platform

│
├── Workspace Context
│
├── Identity Context
│
├── Workspace Access Context
│
├── Enrollment Context
│
├── Learning Product Context
│
├── Learning Delivery Context
│
├── Assessment Context
│
├── Scheduling Context
│
├── Commerce Context
│
├── Communication Context
│
├── Community Context
│
├── Analytics Context
│
├── AI Context
│
├── Automation Context
│
└── Integration Context
```

---

# 5. Context Categories

## Core Contexts

These represent the unique value of the platform.

```
Workspace Context

Learning Product Context

Learning Experience Context

AI Context
```

---

## Supporting Contexts

Necessary for operating the business.

```
Learning Delivery Context

Assessment Context

Scheduling Context

Workspace Access Context

Enrollment Context

Communication Context

Analytics Context
```

---

## Generic Contexts

Potentially replaceable capabilities.

```
Identity Context

Commerce Context

Integration Context

Notification Infrastructure
```

---

# 6. Next Analysis

Each candidate context will now be analysed using:

## Context Definition

What business responsibility does it own?

## Core Language

What terms belong inside this context?

## Owned Data

What information is this context the source of truth for?

## Business Rules

What rules does it enforce?

## Relationships

Which contexts does it communicate with?

## Classification

Core / Supporting / Generic