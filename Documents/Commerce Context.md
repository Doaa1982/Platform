# Commerce Context

**Version:** 1.0 (Draft)

**Bounded Context Type:** Supporting Domain

**Domain Classification:** Strategic Supporting Context

**Related Documents**

- Learning Workspace Domain Language & Business Ontology
- Workspace Context
- Learning Product Context
- Membership Context
- Learning Workspace Value Streams

---

# 1. Context Purpose

## Definition

The Commerce Context manages the financial relationships between Learning Workspaces and their customers.

It answers:

> "How does a Learning Workspace generate and manage revenue?"

---

# 2. Business Responsibility

The Commerce Context owns:

- Pricing
- Offers
- Orders
- Purchases
- Payments
- Subscriptions
- Invoices
- Refunds
- Revenue records

---

# 3. Core Principle

## Separate Commercial Value From Learning Value

Learning Product Context:

```
What educational offering exists?
```

Commerce Context:

```
How is that offering bought and paid for?
```

---

Example:

Learning Product:

```
IELTS Preparation Programme
```

Commerce:

```
Price:

£500

Payment:

Monthly subscription

Customer:

Ahmed
```

---

# 4. Core Concepts

---

# 4.1 Price

## Definition

A Price represents the financial amount required to access a Learning Product or service.

---

## Examples

```
Course:

£300


Monthly Membership:

£50/month


Private Lesson:

£40/session
```

---

# 4.2 Offer

## Definition

An Offer represents a commercial opportunity available to customers.

---

## Examples

```
Early Registration Discount

Bundle Package

Seasonal Promotion

Trial Period
```

---

# 4.3 Order

## Definition

An Order represents a customer's intention to purchase a product.

---

## Example

```
Customer:

Ahmed


Order:

IELTS Programme


Amount:

£300


Status:

Completed
```

---

# 4.4 Payment

## Definition

A Payment represents the successful transfer of money.

---

## Payment States

```
Pending

↓

Completed

↓

Failed

↓

Refunded
```

---

# 4.5 Subscription

## Definition

A Subscription represents recurring commercial access.

---

## Examples

```
Monthly English Membership

£50/month
```

or:

```
AI Learning Assistant

£15/month
```

---

# 4.6 Invoice

## Definition

A financial document representing a commercial transaction.

---

Examples:

- Learner invoice
- Organisation invoice
- Tax document

---

# 4.7 Refund

## Definition

A Refund represents returning money after a completed transaction.

---

# 5. Owned Data

The Commerce Context is the source of truth for:

| Data | Owner |
|-|-|
| Price | Commerce Context |
| Offer | Commerce Context |
| Order | Commerce Context |
| Payment | Commerce Context |
| Subscription | Commerce Context |
| Invoice | Commerce Context |
| Refund | Commerce Context |
| Revenue Record | Commerce Context |

---

# 6. Data Not Owned

| Data | Owner |
|-|-|
| Learning Product details | Learning Product Context |
| Learner progress | Learning Delivery Context |
| User identity | Identity Context |
| Membership role | Membership Context |

---

# 7. Business Rules

---

## Rule 1 — Commerce Does Not Own Products

Commerce references Learning Products.

It does not define them.

---

Example:

Commerce knows:

```
Product ID:

IELTS-001

Price:

£500
```

It does not know:

```
Lesson 1:

Introduction

Activity:

Speaking Practice
```

---

## Rule 2 — Every Transaction Has Ownership

Revenue belongs to a Workspace.

---

## Rule 3 — Payment Does Not Equal Enrolment

Important separation:

```
Payment

≠

Learning Access
```

A payment may trigger enrolment, but they are different business concepts.

---

Example:

```
Payment completed

↓

Enrollment created

↓

Learning begins
```

---

## Rule 4 — Financial History Is Immutable

Past transactions must remain historically accurate.

---

# 8. Relationships

---

# Commerce → Learning Product

Relationship:

```
Learning Product

has

Commercial Options
```

---

# Commerce → Membership

Relationship:

```
Member

may become

Customer
```

---

# Commerce → Enrolment

Relationship:

```
Successful Purchase

may create

Learning Access
```

---

# Commerce → Workspace

Relationship:

```
Workspace

owns

Revenue
```

---

# 9. Supported Business Models

---

# 9.1 One-Time Purchase

Example:

```
Course:

£200

Single payment
```

---

# 9.2 Subscription

Example:

```
Learning Membership:

£50/month
```

---

# 9.3 Package

Example:

```
10 Private Lessons

£400
```

---

# 9.4 Organisation Purchase

Example:

```
Company purchases training

for 100 employees
```

---

# 9.5 Free Offering

Example:

```
Free workshop

No payment required
```

---

# 10. Future Evolution

The Commerce Context should support:

## Marketplace Revenue

Platform commission models.

---

## Affiliate Revenue

Partners referring learners.

---

## Scholarships

Discounted or sponsored access.

---

## Financial Analytics

Revenue insights:

- product performance;
- learner lifetime value;
- retention.

---

# 11. Architectural Notes

The Commerce Context manages money.

It should not manage:

- courses;
- lessons;
- teaching;
- assessment.

Its responsibility is:

```
What is the financial relationship?

Who paid?

How much?

When?

Why?
```
