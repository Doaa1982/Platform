# Commercial Domain Integration Architecture

**Version:** 1.0
**Status:** Draft
**Domain:** Commercial Domain
**Audience:** Business Architects, Solution Architects, Backend Engineers, Product Engineers

---

# 1. Purpose

This document defines how the commercial bounded contexts of the Tutor Learning Workspace Platform collaborate to provide one coherent commercial lifecycle.

The Commercial Domain must support:

* fixed subscription plans;
* configurable plans;
* Design Your Plan;
* capability-based pricing;
* AI-assisted capabilities;
* tutor capacity;
* AI credits;
* promotions;
* trials;
* subscriptions;
* billing;
* licensing and entitlements;
* usage metering;
* product advisory;
* upgrade and downgrade;
* customer-driven configuration changes.

The goal is to answer:

> **How does a tutor move from choosing a product configuration to actually using the capabilities, while pricing, billing, entitlement, usage, and recommendations remain consistent?**

---

# 2. Architectural Goal

The Commercial Domain should provide a continuous lifecycle:

```text
Discover
   ↓
Configure
   ↓
Price
   ↓
Subscribe
   ↓
Pay
   ↓
Entitle
   ↓
Use
   ↓
Measure
   ↓
Advise
   ↓
Reconfigure
```

This creates a closed commercial loop:

```text
┌─────────────────────────────────────────────┐
│                                             │
│              CUSTOMER / TUTOR              │
│                                             │
│                    ↓                        │
│                Configure                    │
│                    ↓                        │
│                Subscribe                   │
│                    ↓                        │
│                  Pay                        │
│                    ↓                        │
│                  Use                        │
│                    ↓                        │
│                Measure                     │
│                    ↓                        │
│                Advisory                    │
│                    ↓                        │
│              Reconfigure                   │
│                    │                        │
│                    └────────────────────────┘
```

---

# 3. Commercial Bounded Contexts

The Commercial Domain consists of the following bounded contexts:

| Bounded Context          | Primary Responsibility                  |
| ------------------------ | --------------------------------------- |
| Product Management       | What products and capabilities exist    |
| Product Configuration    | What combination the customer selects   |
| Subscription Management  | What the customer has subscribed to     |
| Promotion & Discounts    | Commercial incentives                   |
| Billing                  | What the customer owes                  |
| Payment                  | How money is collected                  |
| Licensing & Entitlements | What the Workspace is allowed to use    |
| Usage & Metering         | What the Workspace actually consumes    |
| Product Advisory         | What the customer may benefit from next |

---

# 4. High-Level Bounded Context Map

```text
┌──────────────────────────────────────────────────────────────────┐
│                       COMMERCIAL DOMAIN                          │
│                                                                  │
│  ┌────────────────────┐                                          │
│  │ Product Management  │                                          │
│  └─────────┬──────────┘                                          │
│            │                                                     │
│            ▼                                                     │
│  ┌──────────────────────────┐                                    │
│  │ Product Configuration    │                                    │
│  │ Engine                   │                                    │
│  └────────────┬─────────────┘                                    │
│               │                                                  │
│               ▼                                                  │
│  ┌──────────────────────────┐                                    │
│  │ Subscription Management  │                                    │
│  └───────┬──────────┬───────┘                                    │
│          │          │                                            │
│          ▼          ▼                                            │
│  ┌────────────┐  ┌────────────────────┐                          │
│  │ Promotion  │  │ Licensing &        │                          │
│  │ & Discount │  │ Entitlements       │                          │
│  └─────┬──────┘  └─────────┬──────────┘                          │
│        │                    │                                     │
│        ▼                    ▼                                     │
│  ┌────────────┐      ┌──────────────┐                            │
│  │  Billing   │      │   Workspace  │                            │
│  └─────┬──────┘      └──────────────┘                            │
│        │                    ▲                                     │
│        ▼                    │                                     │
│  ┌────────────┐             │                                     │
│  │  Payment   │             │                                     │
│  └────────────┘             │                                     │
│                             │                                     │
│                     ┌───────┴────────┐                            │
│                     │ Usage & Metering│                           │
│                     └───────┬────────┘                            │
│                             │                                     │
│                             ▼                                     │
│                     ┌────────────────┐                            │
│                     │ Product        │                            │
│                     │ Advisory       │                            │
│                     └───────┬────────┘                            │
│                             │                                     │
│                             ▼                                     │
│                     Design Your Plan                              │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

# 5. Architectural Dependency Direction

The preferred dependency direction is:

```text
Product
   ↓
Configuration
   ↓
Subscription
   ↓
Licensing
```

while financial processing runs:

```text
Configuration
   ↓
Promotion
   ↓
Billing
   ↓
Payment
```

and operational feedback runs:

```text
Workspace
   ↓
Usage
   ↓
Advisory
   ↓
Configuration
```

Therefore the architecture forms a controlled feedback loop rather than a circular synchronous dependency graph.

---

# 6. Core Principle — No Context Owns Everything

A common architectural mistake would be creating one giant:

```text
SubscriptionService
```

that knows:

* plans;
* pricing;
* promotions;
* invoices;
* payment;
* entitlements;
* usage;
* AI credits;
* recommendations.

We explicitly avoid that.

Instead:

```text
Each bounded context owns one business responsibility.
```

Integration occurs through:

* commands;
* queries;
* domain events;
* published contracts;
* snapshots.

---

# 7. Source of Truth Matrix

| Business Fact          | Source of Truth                 |
| ---------------------- | ------------------------------- |
| Product exists         | Product Management              |
| Capability exists      | Product Management              |
| Capability price       | Product Configuration / Pricing |
| Customer configuration | Product Configuration           |
| Subscription status    | Subscription Management         |
| Promotion rules        | Promotion                       |
| Applied promotion      | Promotion                       |
| Invoice                | Billing                         |
| Payment state          | Payment / Billing               |
| Entitlement            | Licensing                       |
| Usage                  | Usage & Metering                |
| Recommendation         | Product Advisory                |

This matrix is foundational.

---

# 8. Product Management

Product Management answers:

> What can the platform sell?

Examples:

```text
Solo Starter
Solo Professional
Solo AI+
AI Assessment
AI Lesson Assistant
25K AI Credits
Additional Tutor
```

It defines the commercial building blocks.

It does not know:

* which customer bought them;
* which invoice they appear on;
* what the customer consumed.

---

# 9. Product Configuration Engine

Product Configuration answers:

> What exactly has the customer chosen?

Example:

```text
Base Plan:
Solo Professional

Capabilities:
AI Assessment = Enabled

Capacity:
Tutors = 1

AI Credits:
25K
```

It produces a normalized configuration.

---

# 10. Fixed Plans and Design Your Plan

The same configuration engine should support both.

## Fixed Plan

```text
Solo Professional
        ↓
Predefined Configuration
```

## Design Your Plan

```text
Base Plan
   +
Selected Components
   +
Selected Capacity
   +
Selected AI Credits
```

Both eventually produce:

```text
Product Configuration
```

This is a critical architectural simplification.

---

# 11. Subscription Management

Subscription answers:

> What commercial configuration has the customer committed to?

Example:

```text
Subscription
├── Workspace
├── Configuration
├── Billing Cycle
├── Start Date
├── Renewal Date
├── Status
└── Applied Commercial Terms
```

Subscription should reference the configuration rather than reconstructing it.

---

# 12. Promotion Integration

Promotion modifies commercial terms.

```text
Configuration
     ↓
Base Price
     ↓
Promotion
     ↓
Discount
     ↓
Final Price
```

Promotion must not alter:

```text
Configuration
Entitlements
Capabilities
Usage Rules
```

---

# 13. Billing Integration

Billing consumes the commercial result.

```text
Configuration
      ↓
Pricing
      ↓
Promotion
      ↓
Billing Preview
      ↓
Invoice
```

Billing becomes the authoritative source for:

```text
Amount Due
Invoice
Payment Status
Financial Transaction
```

---

# 14. Licensing Integration

Once the subscription is active and financially valid according to business policy:

```text
Subscription
      ↓
Licensing
      ↓
Entitlement
      ↓
Workspace Capability
```

Example:

```text
AI Assessment
      ↓
Entitlement:
Enabled
```

---

# 15. Usage Integration

Once the Workspace uses capabilities:

```text
Workspace
      ↓
Capability
      ↓
Usage Event
      ↓
Usage & Metering
```

Example:

```text
AI Assessment Generated
```

may produce:

```text
AI Assessment Usage
AI Credit Consumption
```

---

# 16. Advisory Integration

Usage becomes a commercial signal:

```text
Usage
   ↓
Advisory
   ↓
Opportunity
   ↓
Recommendation
```

Example:

```text
AI Credits = 91% consumed
```

produces:

```text
Recommendation:
Add 25K AI Credits
```

---

# 17. Closed Loop

The complete lifecycle is:

```text
Product
   ↓
Configuration
   ↓
Subscription
   ↓
Billing
   ↓
Payment
   ↓
Licensing
   ↓
Usage
   ↓
Advisory
   ↓
Recommendation
   ↓
Configuration
```

This is the central commercial architecture.

---

# 18. Fixed Plan Purchase Flow

A tutor chooses:

```text
Solo Professional
```

Flow:

```text
Tutor
 ↓
Product Catalog
 ↓
Select Plan
 ↓
Configuration
 ↓
Pricing
 ↓
Promotion
 ↓
Checkout
 ↓
Subscription
 ↓
Billing
 ↓
Payment
 ↓
Licensing
 ↓
Workspace Activated
```

---

# 19. Design Your Plan Purchase Flow

```text
Tutor
 ↓
Select Base Plan
 ↓
Select Capabilities
 ↓
Select Capacity
 ↓
Select AI Credits
 ↓
Configuration Validation
 ↓
Price Calculation
 ↓
Promotion Evaluation
 ↓
Billing Preview
 ↓
Customer Confirmation
 ↓
Subscription
 ↓
Payment
 ↓
Licensing
```

---

# 20. Pricing Pipeline

The platform should use one pricing pipeline for all purchasing scenarios.

```text
Configuration
      ↓
Base Price
      ↓
Component Prices
      ↓
Capacity Prices
      ↓
AI Resource Prices
      ↓
Subtotal
      ↓
Promotion
      ↓
Discount
      ↓
Tax
      ↓
Final Amount
```

The exact tax responsibility may be separated into a future Tax bounded context.

---

# 21. Pricing Authority

There should be one authoritative pricing calculation service.

Avoid:

```text
Frontend calculates $29
Backend calculates $31
Billing calculates $30
```

Instead:

```text
Pricing Engine
       ↓
Authoritative Price
```

The UI may display estimates, but the server-side commercial calculation is authoritative.

---

# 22. Configuration Snapshot

When a subscription is created, the system should preserve the configuration used to create it.

Example:

```text
Subscription #1001

Configuration:
Professional
AI Assessment
25K AI Credits
1 Tutor
```

If the catalog later changes:

```text
Professional
AI Assessment
50K AI Credits
```

the existing subscription does not silently change.

---

# 23. Commercial Snapshot

A subscription should preserve the commercial terms required to reproduce its financial state.

```text
Subscription
│
├── Configuration Snapshot
├── Pricing Snapshot
├── Promotion Snapshot
├── Billing Cycle
└── Commercial Terms
```

This is essential for auditability.

---

# 24. Versioning Model

The following objects should be version-aware:

```text
Product
Configuration
Pricing
Promotion
Commercial Terms
```

Example:

```text
Product v3
Configuration v5
Promotion v2
```

The subscription records the versions relevant to its creation.

---

# 25. Why Versioning Matters

Suppose:

```text
August:
Solo Professional = $19
```

September:

```text
Solo Professional = $24
```

Existing customers should not unexpectedly become:

```text
$24
```

unless the subscription pricing policy explicitly allows repricing.

Historical commercial state must remain reconstructable.

---

# 26. Subscription Change

When a customer changes configuration:

```text
Current Configuration
       ↓
Requested Configuration
       ↓
Difference Calculation
       ↓
Pricing
       ↓
Promotion
       ↓
Proration / Billing Policy
       ↓
Customer Confirmation
       ↓
Subscription Update
       ↓
Licensing Update
```

---

# 27. Upgrade

Example:

```text
Professional
$19

→

AI+
$29
```

Flow:

```text
Configuration Change
      ↓
Price Difference
      ↓
Billing
      ↓
Payment
      ↓
Subscription Update
      ↓
Entitlement Update
```

---

# 28. Downgrade

Example:

```text
AI+
$29

→

Professional
$19
```

The system must evaluate:

```text
Current capabilities
      ↓
Capabilities removed?
      ↓
Current usage?
      ↓
Billing policy
      ↓
Effective date
```

A downgrade should not automatically destroy data.

---

# 29. Capability Removal

Suppose the customer removes:

```text
AI Assessment
```

The architecture must distinguish:

```text
Capability Disabled
```

from:

```text
Data Deleted
```

The recommended policy is:

> Removing a capability should normally remove access, not immediately delete historical data.

---

# 30. Tutor Capacity

Tutor capacity is a commercial component.

Example:

```text
Solo Workspace

Tutor Seats:
1
```

Customer adds another:

```text
Tutor Seats:
2
```

Flow:

```text
Configuration
 ↓
Capacity Price
 ↓
Subscription
 ↓
Billing
 ↓
Licensing
 ↓
Additional Tutor Entitlement
```

---

# 31. Workspace Ownership vs Tutor Seats

A Workspace may have:

```text
Workspace Owner
+
Tutor Seats
```

The owner does not necessarily consume a paid tutor seat unless the product policy explicitly defines it that way.

This must be specified in the product configuration.

---

# 32. AI Credits

AI credits are a commercial resource.

They may come from:

```text
Subscription
Add-on
Promotion
Purchase
```

The resulting entitlement may be:

```text
AI Credit Balance
```

Usage then consumes the balance.

---

# 33. AI Credit Lifecycle

```text
Product Configuration
        ↓
AI Credit Allocation
        ↓
Licensing
        ↓
Credit Balance
        ↓
AI Usage
        ↓
Consumption
        ↓
Remaining Balance
```

---

# 34. Promotional Credits

Promotional credits follow:

```text
Promotion
   ↓
Promotional Credit Grant
   ↓
Licensing / Resource Balance
   ↓
Usage
```

They must remain distinguishable from purchased credits.

---

# 35. Free Trial

Trial architecture:

```text
Product
   ↓
Configuration
   ↓
Trial Subscription
   ↓
Licensing
   ↓
Workspace Access
```

During the trial:

```text
Usage
   ↓
Advisory
```

can already operate.

This means the platform can recommend:

```text
"AI Assessment is useful for your workflow."
```

before the tutor converts to paid.

---

# 36. Trial Conversion

```text
Trial
 ↓
Usage
 ↓
Advisory
 ↓
Recommendation
 ↓
Conversion
 ↓
Paid Subscription
```

This makes the trial part of the product learning experience, not just a billing mechanism.

---

# 37. Promotion During Trial

A customer may have:

```text
Trial
+
WELCOME20
```

The system must define whether the promotion:

* starts during the trial;
* starts after trial;
* extends the trial;
* discounts the first paid periods.

Recommended:

> Promotions should explicitly declare when their commercial effect begins.

---

# 38. Billing Failure

Suppose:

```text
Subscription Active
      ↓
Renewal
      ↓
Payment Failed
```

Billing publishes:

```text
PaymentFailed
```

Subscription then moves according to policy:

```text
Active
 ↓
Past Due
 ↓
Grace Period
 ↓
Suspended
 ↓
Cancelled
```

---

# 39. Licensing During Billing Failure

Licensing should not invent its own payment state.

Instead:

```text
Billing / Subscription State
       ↓
License Policy
       ↓
Entitlement State
```

Example:

```text
Past Due
```

may mean:

```text
Access remains active
```

during a grace period.

Later:

```text
Suspended
```

may mean:

```text
Paid capabilities disabled
```

---

# 40. Event-Driven Integration

The preferred integration mechanism between bounded contexts is domain events.

Example:

```text
SubscriptionActivated
        ↓
Licensing
```

```text
PaymentSucceeded
        ↓
Subscription
```

```text
UsageThresholdReached
        ↓
Product Advisory
```

---

# 41. Core Domain Events

## Product

```text
ProductPublished
ProductUpdated
CapabilityPublished
PriceChanged
```

## Configuration

```text
ConfigurationCreated
ConfigurationValidated
ConfigurationChanged
```

## Subscription

```text
SubscriptionCreated
SubscriptionActivated
SubscriptionChanged
SubscriptionCancelled
SubscriptionRenewed
SubscriptionExpired
```

## Promotion

```text
PromotionActivated
PromotionRedeemed
PromotionExpired
```

## Billing

```text
InvoiceCreated
InvoicePaid
InvoicePaymentFailed
RefundIssued
```

## Licensing

```text
EntitlementGranted
EntitlementChanged
EntitlementRevoked
```

## Usage

```text
UsageRecorded
UsageThresholdReached
CreditConsumed
```

## Advisory

```text
RecommendationCreated
RecommendationViewed
RecommendationDismissed
RecommendationAccepted
RecommendationConverted
```

---

# 42. Event Flow — New Subscription

```text
Customer
   ↓
ConfigurationCreated
   ↓
PriceCalculated
   ↓
PromotionApplied
   ↓
SubscriptionCreated
   ↓
InvoiceCreated
   ↓
PaymentSucceeded
   ↓
SubscriptionActivated
   ↓
EntitlementGranted
   ↓
WorkspaceReady
```

---

# 43. Event Flow — Usage

```text
Workspace
   ↓
Capability Used
   ↓
UsageRecorded
   ↓
Usage Aggregated
   ↓
Threshold Evaluated
   ↓
RecommendationCreated
```

---

# 44. Event Flow — AI Credit Exhaustion

```text
AI Usage
   ↓
Credit Consumed
   ↓
Balance = 0
   ↓
Usage Limit Reached
   ↓
Advisory
   ↓
Recommend Credit Pack
```

The platform can then present:

```text
Add 25K AI Credits
```

---

# 45. Event Flow — Design Your Plan

```text
Customer
   ↓
Select Components
   ↓
Configuration Draft
   ↓
Validation
   ↓
Price Preview
   ↓
Promotion Evaluation
   ↓
Final Preview
   ↓
Customer Confirm
   ↓
Subscription
```

---

# 46. Draft Configuration

Design Your Plan should support temporary configurations.

```text
Configuration Draft
```

is not yet:

```text
Subscription
```

This allows the customer to experiment safely.

---

# 47. Configuration State Model

```text
Draft
  ↓
Validated
  ↓
Priced
  ↓
Confirmed
  ↓
Committed
```

A draft can be abandoned without affecting the Workspace.

---

# 48. Commercial Transaction Boundary

A commercial change should become committed only after:

```text
Customer Confirmation
+
Valid Configuration
+
Valid Pricing
+
Valid Promotion
+
Billing Authorization
```

Then:

```text
Subscription Change
```

is committed.

---

# 49. Idempotency

Commercial operations must be idempotent.

Examples:

```text
Create Subscription
Apply Promotion
Create Invoice
Record Payment
Grant Entitlement
```

If the same request arrives twice:

```text
Request ID = ABC123
```

the system should not create:

```text
2 subscriptions
2 invoices
2 payments
2 entitlements
```

---

# 50. Distributed Transaction Principle

Do not attempt to create one giant database transaction across all bounded contexts.

Avoid:

```text
BEGIN TRANSACTION

Subscription
Billing
Payment
Licensing
Usage

COMMIT
```

Instead use:

```text
Local Transaction
      ↓
Domain Event
      ↓
Next Context
      ↓
Local Transaction
```

with:

* idempotency;
* retries;
* compensating actions;
* reconciliation.

---

# 51. Saga Example — Subscription Activation

```text
Create Subscription
       ↓
Create Invoice
       ↓
Payment
       ↓
Payment Success
       ↓
Activate Subscription
       ↓
Grant Entitlements
```

If payment fails:

```text
Payment Failed
       ↓
Subscription remains pending
       ↓
No paid entitlement
```

---

# 52. Saga Example — Upgrade

```text
Requested Upgrade
       ↓
Calculate Difference
       ↓
Create Invoice / Charge
       ↓
Payment Success
       ↓
Commit Configuration
       ↓
Update Subscription
       ↓
Update Entitlements
```

If payment fails:

```text
Configuration remains unchanged
```

unless the business policy explicitly allows another model.

---

# 53. Reconciliation

Because the system is distributed, reconciliation is required.

Examples:

```text
Subscription = Active
Billing = Paid
Licensing = Missing
```

This is an inconsistency.

A reconciliation process should detect:

```text
Commercial State ≠ Entitlement State
```

and repair or flag it.

---

# 54. Commercial Consistency Matrix

| State                       | Expected           |
| --------------------------- | ------------------ |
| Active Subscription + Paid  | Active Entitlement |
| Active Subscription + Trial | Trial Entitlement  |
| Past Due                    | Policy-dependent   |
| Suspended                   | Restricted/Revoked |
| Cancelled                   | Entitlement End    |
| Expired                     | Entitlement End    |

---

# 55. Eventual Consistency

The platform should accept that:

```text
Payment succeeded
```

and:

```text
Entitlement activated
```

may not happen in the exact same database transaction.

The user experience should nevertheless provide a coherent state.

Example:

```text
Payment successful.
Your Workspace is being activated.
```

---

# 56. Customer-Facing Commercial State

The UI should not expose the internal distributed architecture.

Instead it should present:

```text
Subscription:
Solo AI+

Status:
Active

Next billing:
September 8

AI Credits:
72K remaining

Capabilities:
AI Assessment ✓
AI Lesson Assistant ✓
```

The underlying system may involve six bounded contexts.

---

# 57. Commercial Read Model

A dedicated read model can combine:

```text
Subscription
+
Configuration
+
Billing
+
Entitlements
+
Usage
+
Recommendations
```

into:

```text
Workspace Commercial Summary
```

This is particularly useful for the Workspace dashboard.

---

# 58. Workspace Commercial Summary

Example:

```text
Workspace:
Duaa Arabic Learning

Plan:
Solo AI+

Tutors:
1 / 1

Students:
35

AI Credits:
68K / 100K

Billing:
$29/month

Next Renewal:
September 8

Recommendations:
AI Assessment
```

This is a read model, not a new source of truth.

---

# 59. Commercial Read Model Architecture

```text
Subscription ───────┐
Configuration ──────┤
Billing ────────────┤
Licensing ──────────┤
Usage ──────────────┤
Advisory ───────────┤
                    ▼
          Commercial Read Model
                    │
                    ▼
              Workspace UI
```

---

# 60. API Boundary

Each bounded context should expose APIs appropriate to its responsibility.

Example:

```text
Product API
Configuration API
Subscription API
Promotion API
Billing API
Licensing API
Usage API
Advisory API
```

The frontend should not need to understand every internal integration.

---

# 61. Application Orchestration

A Commercial Application Service may orchestrate a user operation:

```text
CreateSubscription
```

Conceptually:

```text
CreateSubscription
      ↓
Validate Configuration
      ↓
Calculate Price
      ↓
Evaluate Promotion
      ↓
Create Subscription
      ↓
Create Invoice
      ↓
Payment
```

The orchestration layer coordinates.

It does not own the domain rules of each bounded context.

---

# 62. Domain Ownership vs Orchestration

Important distinction:

```text
Application Layer
    = coordinates
```

while:

```text
Bounded Context
    = owns business rules
```

For example:

```text
Promotion Context
```

owns:

> Is this promotion valid?

The orchestration layer does not duplicate that logic.

---

# 63. API Responsibility Matrix

| Operation                     | Owner                 |
| ----------------------------- | --------------------- |
| Get available products        | Product               |
| Build configuration           | Configuration         |
| Calculate configuration price | Configuration/Pricing |
| Validate coupon               | Promotion             |
| Create subscription           | Subscription          |
| Create invoice                | Billing               |
| Collect payment               | Payment               |
| Grant entitlement             | Licensing             |
| Record usage                  | Usage                 |
| Get recommendations           | Advisory              |

---

# 64. Security Boundary

Commercial operations require authorization.

Examples:

```text
Create Subscription
Change Plan
Purchase Add-on
Redeem Promotion
Cancel Subscription
View Billing
```

Workspace-level authorization should ensure:

```text
Only authorized Workspace actors
can perform commercial actions.
```

---

# 65. Tutor vs Student

The Commercial Domain primarily serves the:

```text
Workspace Owner / Tutor
```

Students normally do not control:

```text
Subscription
Billing
Promotion
Configuration
Tutor Capacity
```

Students consume the resulting entitlements.

Therefore:

```text
Tutor
   ↓
Commercial Operations
   ↓
Workspace
   ↓
Student Experience
```

---

# 66. Single-Tutor Workspace

For the majority of customers:

```text
Workspace
 └── Owner/Tutor
      └── Students
```

The commercial model remains simple:

```text
One Workspace
One Tutor
One Subscription
Many Students
```

Student count may be:

* included;
* limited;
* metered;
* or unlimited,

depending on the product configuration.

---

# 67. Multi-Tutor Expansion

The same architecture supports:

```text
Workspace
 ├── Owner
 ├── Tutor 1
 ├── Tutor 2
 └── Tutor 3
```

The commercial change is:

```text
Tutor Capacity
```

not a fundamentally different product.

This is one of the reasons the configurable product model is valuable.

---

# 68. Fixed Plans Matrix

Example initial plans:

| Capability           | Solo Starter | Solo Professional | Solo AI+ |
| -------------------- | -----------: | ----------------: | -------: |
| Workspace            |            ✓ |                 ✓ |        ✓ |
| Students             |      Limited |            Higher |   Higher |
| Basic Lessons        |            ✓ |                 ✓ |        ✓ |
| Assessments          |        Basic |          Advanced | Advanced |
| AI Lesson Assistance |            — |           Limited |        ✓ |
| AI Assessment        |            — |          Optional |        ✓ |
| AI Credits           |          Low |            Medium |     High |
| Tutor Seats          |            1 |                 1 |        1 |
| Design Your Plan     |            ✓ |                 ✓ |        ✓ |

The actual numbers remain product configuration data.

---

# 69. Plan + Component Architecture

A plan should not become a giant hard-coded object.

Instead:

```text
Plan
  ↓
Configuration Template
  ↓
Components
  ├── Capability
  ├── Capacity
  ├── AI Allowance
  └── Limits
```

This allows:

```text
Fixed Plan
```

and:

```text
Design Your Plan
```

to use the same underlying model.

---

# 70. Design Your Plan Guardrails

Customers should not be able to create invalid configurations.

Example:

```text
AI Assessment
requires:
AI Capability Foundation
```

or:

```text
25K AI Credits
requires:
AI-enabled Workspace
```

The Configuration Engine owns these compatibility rules.

---

# 71. Configuration Validation

```text
Requested Configuration
        ↓
Compatibility Rules
        ↓
Capacity Rules
        ↓
Dependency Rules
        ↓
Commercial Rules
        ↓
Valid / Invalid
```

Example:

```text
AI Assessment = Enabled
AI Foundation = Disabled
```

Result:

```text
Invalid Configuration
```

---

# 72. Promotion Validation

Promotion evaluation occurs after the configuration is known.

```text
Configuration
      ↓
Promotion Eligibility
```

This matters because a promotion may apply only to:

```text
Solo AI+
```

but not:

```text
Solo Starter
```

---

# 73. Commercial Decision Sequence

```text
1. What does the customer want?
             ↓
2. Is the configuration valid?
             ↓
3. What does it cost?
             ↓
4. Is a promotion available?
             ↓
5. What is the final price?
             ↓
6. Does the customer confirm?
             ↓
7. Can payment be completed?
             ↓
8. What should be entitled?
```

This sequence should remain stable.

---

# 74. Commercial State Machine

At the Workspace level:

```text
No Subscription
      ↓
Trial / Pending
      ↓
Active
      ↓
Past Due
      ↓
Suspended
      ↓
Cancelled / Expired
```

At the configuration level:

```text
Draft
 ↓
Validated
 ↓
Committed
 ↓
Changed
```

At the recommendation level:

```text
Candidate
 ↓
Active
 ↓
Viewed
 ↓
Accepted / Dismissed / Expired
```

---

# 75. Cross-Context State Matrix

| Context       | Main State                            |
| ------------- | ------------------------------------- |
| Configuration | Draft / Validated / Committed         |
| Subscription  | Trial / Active / Past Due / Cancelled |
| Promotion     | Active / Expired                      |
| Billing       | Pending / Paid / Failed               |
| Licensing     | Active / Suspended / Revoked          |
| Usage         | Current / Exhausted                   |
| Advisory      | Active / Dismissed / Converted        |

No context should assume another context's state without consuming the appropriate contract.

---

# 76. Complete Customer Journey

```text
                    DISCOVERY
                       │
                       ▼
                 Select Plan
                       │
                       ▼
               Design Your Plan
                       │
                       ▼
               Configuration
                       │
                       ▼
                   Pricing
                       │
                       ▼
                  Promotion
                       │
                       ▼
                   Checkout
                       │
                       ▼
                 Subscription
                       │
                       ▼
                    Billing
                       │
                       ▼
                   Payment
                       │
                       ▼
                  Licensing
                       │
                       ▼
                Workspace Ready
                       │
                       ▼
                    Usage
                       │
                       ▼
                   Advisory
                       │
                       ▼
              Recommended Change
                       │
                       ▼
                Design Your Plan
                       │
                       └───────────────┐
                                       │
                                       ▼
                              Next Commercial Cycle
```

---

# 77. Scenario — New Tutor

### Step 1

Tutor creates a Workspace.

### Step 2

Tutor selects:

```text
Solo Professional
```

### Step 3

Configuration Engine creates:

```text
1 Tutor
AI Assessment
100K AI Credits
```

### Step 4

Promotion:

```text
20% for first 3 months
```

### Step 5

Billing:

```text
$23.20
```

### Step 6

Payment succeeds.

### Step 7

Licensing grants capabilities.

### Step 8

Tutor begins creating lessons.

---

# 78. Scenario — Tutor Uses AI Heavily

After two months:

```text
AI Usage:
94%
```

Advisory detects:

```text
High AI Consumption
```

Recommendation:

```text
25K AI Credit Pack
```

Tutor opens:

```text
Design Your Plan
```

Adds:

```text
25K AI Credits
```

Billing previews the new amount.

Tutor confirms.

Subscription updates.

Licensing increases available credits.

---

# 79. Scenario — Tutor Adds AI Assessment

Tutor currently manually creates assessments.

Usage:

```text
30 assessments/month
```

Advisory:

```text
AI Assessment may reduce repetitive work.
```

Tutor selects:

```text
Add AI Assessment
```

Configuration validates the component.

Promotion checks:

```text
AI Assessment = 50% off
```

Billing calculates:

```text
+$2.50/month
```

Tutor confirms.

Licensing enables the capability.

---

# 80. Scenario — Tutor Adds Second Tutor

Workspace grows.

Tutor wants another teacher.

```text
Design Your Plan
      ↓
Tutor Capacity: 2
```

Pricing:

```text
Additional Tutor = $7
```

Subscription changes.

Licensing creates:

```text
Additional Tutor Entitlement
```

Identity/Workspace Access then provisions the new tutor.

---

# 81. Scenario — Tutor Downgrades

Tutor removes:

```text
AI Assessment
```

The system evaluates:

```text
Current usage
Current subscription
Billing policy
Effective date
```

The capability is scheduled for removal.

Historical assessment data remains available according to data-retention policy.

---

# 82. Scenario — Promotion Expires

Promotion:

```text
20% off for 3 months
```

After period 3:

```text
Promotion expires
```

Subscription continues.

Billing automatically returns to:

```text
Standard price
```

No configuration change is required.

---

# 83. Scenario — Customer Cancels

Customer chooses:

```text
Cancel at end of period
```

Subscription:

```text
Active
→
Cancellation Scheduled
```

Customer continues using the Workspace until:

```text
Period End
```

Then:

```text
Subscription Ends
      ↓
Licensing Ends
```

Historical data remains according to retention policy.

---

# 84. Scenario — Payment Failure

```text
Renewal
 ↓
Payment Failed
 ↓
Billing = Past Due
 ↓
Subscription = Past Due
 ↓
Licensing = Grace Period
```

If payment remains unresolved:

```text
Past Due
 ↓
Suspended
 ↓
Entitlements Restricted
```

The exact grace period is a business policy.

---

# 85. Commercial Integration Matrix

| From          | To            | Integration            |
| ------------- | ------------- | ---------------------- |
| Product       | Configuration | Product catalog        |
| Configuration | Subscription  | Configuration snapshot |
| Configuration | Billing       | Pricing result         |
| Promotion     | Billing       | Discount result        |
| Subscription  | Billing       | Billing schedule       |
| Billing       | Payment       | Payment request        |
| Payment       | Billing       | Payment result         |
| Subscription  | Licensing     | Subscription state     |
| Licensing     | Workspace     | Entitlements           |
| Workspace     | Usage         | Usage events           |
| Usage         | Advisory      | Usage signals          |
| Advisory      | Configuration | Recommendation         |
| Promotion     | Advisory      | Eligible offers        |

---

# 86. Event Ownership Matrix

| Event                  | Owner         |
| ---------------------- | ------------- |
| ProductPublished       | Product       |
| ConfigurationCreated   | Configuration |
| ConfigurationCommitted | Configuration |
| SubscriptionActivated  | Subscription  |
| PromotionRedeemed      | Promotion     |
| InvoiceCreated         | Billing       |
| PaymentSucceeded       | Payment       |
| EntitlementGranted     | Licensing     |
| UsageRecorded          | Usage         |
| RecommendationCreated  | Advisory      |

---

# 87. Integration Style Matrix

| Interaction             | Preferred Style           |
| ----------------------- | ------------------------- |
| Read product catalog    | Query                     |
| Calculate configuration | Synchronous command/query |
| Validate promotion      | Synchronous query         |
| Create subscription     | Command                   |
| Create invoice          | Command/event             |
| Payment                 | Command + event           |
| Grant entitlement       | Event-driven              |
| Record usage            | Event                     |
| Generate advisory       | Event-driven              |
| Update read models      | Event-driven              |

---

# 88. Synchronous vs Asynchronous

Use synchronous calls when the customer is waiting for an immediate answer.

Examples:

```text
Price Preview
Coupon Validation
Configuration Validation
Billing Preview
```

Use asynchronous processing when immediate response is unnecessary.

Examples:

```text
Usage aggregation
Recommendation generation
Analytics
Reconciliation
```

---

# 89. Commercial API Example

Conceptually:

```text
POST /workspaces/{workspaceId}/configurations
```

creates a configuration draft.

```text
POST /workspaces/{workspaceId}/configurations/{id}/price
```

calculates price.

```text
POST /promotions/validate
```

validates a promotion.

```text
POST /subscriptions
```

creates a subscription.

```text
GET /workspaces/{workspaceId}/commercial-summary
```

returns the combined commercial read model.

```text
GET /workspaces/{workspaceId}/recommendations
```

returns advisory recommendations.

---

# 90. Commercial Summary API

The UI should ideally be able to request:

```text
CommercialSummary
```

containing:

```text
{
  subscription,
  configuration,
  billing,
  entitlements,
  usage,
  recommendations
}
```

This is a read-model contract.

It does not mean these objects belong to one bounded context.

---

# 91. Failure Handling

Each integration must define:

```text
Retry
Timeout
Idempotency
Dead Letter
Reconciliation
Compensation
```

For example:

```text
PaymentSucceeded
```

but:

```text
EntitlementGranted
```

was not processed.

A retry mechanism should safely process the event again.

---

# 92. Outbox Pattern

For critical domain events, the platform should consider the Outbox Pattern.

Example:

```text
Subscription Database Transaction
        │
        ├── Subscription Updated
        │
        └── Outbox Event Created
                    │
                    ▼
              Event Publisher
                    │
                    ▼
              Licensing
```

This prevents the classic failure:

```text
Database committed
BUT
Event was lost
```

---

# 93. Event Idempotency

Consumers should store processed event identifiers.

Example:

```text
Event ID:
EVT-102345
```

If received twice:

```text
First → Process
Second → Ignore
```

This is mandatory for critical commercial events.

---

# 94. Auditability

The system should be able to reconstruct:

```text
Why does this Workspace have this plan?
Why is this customer paying this amount?
Why is this capability enabled?
Why was this recommendation generated?
Why was this promotion applied?
```

The architecture therefore requires historical records and snapshots.

---

# 95. Commercial Audit Trail

Example:

```text
Aug 01
Subscription created

Aug 01
WELCOME20 applied

Aug 01
Payment succeeded

Aug 01
AI Assessment entitlement granted

Aug 18
AI usage reached 80%

Aug 19
AI Credit recommendation generated

Aug 20
Customer added 25K credits

Aug 20
Subscription updated

Aug 20
Additional entitlement granted
```

This creates a complete commercial history.

---

# 96. Business Rules vs Configuration

Rules that are likely to change should be configurable.

Examples:

```text
AI usage warning threshold
Recommendation cooldown
Promotion duration
Tutor capacity price
AI credit pack price
Trial duration
Grace period
```

Core invariants should remain enforced in code/domain logic.

---

# 97. Commercial Configuration

A commercial configuration layer can hold:

```text
TrialDays
AIWarningThreshold
RecommendationCooldown
PaymentGracePeriod
MaximumTutorSeats
```

But configuration must not bypass business invariants.

---

# 98. Multi-Currency

The architecture should allow future support for:

```text
USD
THB
EUR
SAR
EGP
```

Pricing should therefore be represented with:

```text
Money
Currency
```

rather than primitive decimal values alone.

---

# 99. Tax

Tax should eventually be isolated from base pricing.

Conceptually:

```text
Configuration
 ↓
Price
 ↓
Promotion
 ↓
Tax
 ↓
Invoice
```

A future Tax bounded context may be introduced.

It should not be embedded deeply into Product Configuration.

---

# 100. Localization

Commercial configuration may vary by market.

Example:

```text
Product:
Solo AI+

Market:
Thailand

Price:
THB

Market:
Egypt

Price:
EGP
```

The underlying capability configuration can remain the same while commercial pricing differs.

---

# 101. Commercial Market Model

Future architecture:

```text
Product
   ↓
Market
   ↓
Price Book
   ↓
Configuration
   ↓
Promotion
   ↓
Billing
```

This should be designed for but not necessarily implemented in V1.

---

# 102. Tenant / Workspace Isolation

Every commercial entity must be scoped correctly.

Examples:

```text
Workspace
Subscription
Configuration
Usage
Entitlements
Recommendations
```

must not accidentally leak between Workspaces.

A tutor should never see:

```text
Another Workspace's subscription
Another Workspace's usage
Another Workspace's invoice
```

---

# 103. Commercial Security Principles

### COM-SEC-001

Workspace commercial operations require authorization.

### COM-SEC-002

Billing data requires stronger access controls.

### COM-SEC-003

Students cannot modify Workspace commercial configuration.

### COM-SEC-004

Promotion redemption must be protected against replay.

### COM-SEC-005

Payment data must remain within appropriate payment-provider boundaries.

### COM-SEC-006

Commercial audit records must be tamper-resistant.

---

# 104. Complete Ownership Matrix

| Capability     | Context               | Source of Truth |
| -------------- | --------------------- | --------------- |
| Product        | Product Management    | ✓               |
| Capability     | Product Management    | ✓               |
| Plan Template  | Product Management    | ✓               |
| Configuration  | Configuration         | ✓               |
| Pricing        | Configuration/Pricing | ✓               |
| Promotion      | Promotion             | ✓               |
| Subscription   | Subscription          | ✓               |
| Invoice        | Billing               | ✓               |
| Payment        | Payment               | ✓               |
| Entitlement    | Licensing             | ✓               |
| Usage          | Usage                 | ✓               |
| Recommendation | Advisory              | ✓               |
| Workspace      | Workspace Domain      | ✓               |
| Student        | Learning Domain       | ✓               |

---

# 105. Commercial Capability Matrix

| Capability          | Product | Config | Subscription | Promotion | Billing | Licensing | Usage | Advisory |
| ------------------- | ------: | -----: | -----------: | --------: | ------: | --------: | ----: | -------: |
| Define Product      |       ✓ |        |              |           |         |           |       |          |
| Configure Product   |         |      ✓ |              |           |         |           |       |          |
| Calculate Price     |         |      ✓ |              |           |       ✓ |           |       |          |
| Apply Promotion     |         |        |              |         ✓ |       ✓ |           |       |          |
| Create Subscription |         |        |            ✓ |           |         |           |       |          |
| Generate Invoice    |         |        |              |           |       ✓ |           |       |          |
| Collect Payment     |         |        |              |           |       ✓ |           |       |          |
| Grant Entitlement   |         |        |              |           |         |         ✓ |       |          |
| Measure Usage       |         |        |              |           |         |           |     ✓ |          |
| Recommend Upgrade   |         |        |              |           |         |           |     ✓ |        ✓ |
| Recommend Add-on    |         |        |              |           |         |           |     ✓ |        ✓ |
| Design Your Plan    |         |      ✓ |              |           |         |           |       |        ✓ |

---

# 106. What Should Never Happen

The following architectural shortcuts should be prohibited:

```text
Frontend → Billing Database
```

```text
Frontend → Entitlement Database
```

```text
Advisory → Direct Subscription Mutation
```

```text
Promotion → Direct Entitlement Grant
```

```text
Usage → Direct Price Change
```

```text
Billing → Product Definition
```

```text
Student → Subscription Management
```

---

# 107. Recommended Integration Principle

Use this rule:

> **Commands change state; events communicate facts; queries retrieve current state.**

Example:

```text
Command:
ChangeSubscription
```

produces:

```text
Event:
SubscriptionChanged
```

which is consumed by:

```text
Licensing
Advisory
Read Model
Analytics
```

---

# 108. Commercial Domain Golden Path

For every commercial change:

```text
INTENT
  ↓
CONFIGURATION
  ↓
VALIDATION
  ↓
PRICING
  ↓
PROMOTION
  ↓
CUSTOMER CONFIRMATION
  ↓
SUBSCRIPTION
  ↓
BILLING
  ↓
PAYMENT
  ↓
LICENSING
  ↓
USAGE
  ↓
ADVISORY
```

This is the primary architecture pattern.

---

# 109. The Most Important Design Decision

The platform should treat:

```text
Product
Configuration
Subscription
Entitlement
Usage
```

as **different concepts**.

They are related, but they are not interchangeable.

For example:

```text
Product:
AI Assessment exists.

Configuration:
Tutor selected AI Assessment.

Subscription:
Tutor paid for AI Assessment.

Entitlement:
Workspace may use AI Assessment.

Usage:
Workspace used AI Assessment 31 times.
```

This distinction will prevent many future architectural problems.

---

# 110. Commercial Domain Summary

The final Commercial Domain can be understood as six major stages:

```text
1. DEFINE
Product Management

2. COMPOSE
Product Configuration

3. COMMIT
Subscription

4. CHARGE
Promotion + Billing + Payment

5. ENABLE
Licensing

6. LEARN
Usage + Product Advisory
```

And then:

```text
LEARN
  ↓
RECOMMEND
  ↓
COMPOSE AGAIN
```

---

# 111. Final Architecture

```text
                           ┌─────────────────────┐
                           │  PRODUCT MANAGEMENT │
                           └──────────┬──────────┘
                                      │
                                      ▼
                           ┌─────────────────────┐
                           │ PRODUCT CONFIGURATION│
                           │       ENGINE        │
                           └──────────┬──────────┘
                                      │
                         ┌────────────┴────────────┐
                         │                         │
                         ▼                         ▼
                 ┌──────────────┐        ┌────────────────┐
                 │ PROMOTION    │        │ SUBSCRIPTION   │
                 │ & DISCOUNTS  │        │ MANAGEMENT     │
                 └──────┬───────┘        └───────┬────────┘
                        │                         │
                        └────────────┬────────────┘
                                     ▼
                              ┌────────────┐
                              │  BILLING   │
                              └─────┬──────┘
                                    │
                                    ▼
                              ┌────────────┐
                              │  PAYMENT   │
                              └─────┬──────┘
                                    │
                                    ▼
                         ┌────────────────────┐
                         │ LICENSING &        │
                         │ ENTITLEMENTS       │
                         └─────────┬──────────┘
                                   │
                                   ▼
                            ┌─────────────┐
                            │  WORKSPACE  │
                            └──────┬──────┘
                                   │
                                   ▼
                            ┌─────────────┐
                            │   USAGE     │
                            │ & METERING  │
                            └──────┬──────┘
                                   │
                                   ▼
                         ┌────────────────────┐
                         │ PRODUCT ADVISORY   │
                         └─────────┬──────────┘
                                   │
                                   ▼
                         ┌────────────────────┐
                         │ RECOMMENDATION     │
                         └─────────┬──────────┘
                                   │
                                   ▼
                         ┌────────────────────┐
                         │ DESIGN YOUR PLAN   │
                         └─────────┬──────────┘
                                   │
                                   └───────────────►
                                      CONFIGURATION
```

---

# 112. Architectural Outcome

With this architecture, the platform can support all of the commercial scenarios we have discussed without creating separate systems for each one.

### Fixed Plans

```text
Plan
→ Configuration
→ Subscription
```

### Design Your Plan

```text
Components
→ Configuration
→ Subscription
```

### AI Assistance

```text
Capability
→ Entitlement
→ Usage
```

### AI Credits

```text
Configuration
→ Credit Allocation
→ Usage
→ Advisory
```

### Promotions

```text
Promotion
→ Discount
→ Billing
```

### Trials

```text
Subscription
→ Trial
→ Usage
→ Conversion
```

### Upgrades

```text
Advisory
→ Configuration
→ Subscription
→ Billing
→ Licensing
```

### Downgrades

```text
Customer Decision
→ Configuration
→ Subscription
→ Licensing
```

### Solo Tutor Growth

```text
Usage
→ Advisory
→ Additional Capability / Capacity
```

---

# 113. Final Business Principle

The commercial architecture should ultimately behave like this:

> **The customer chooses what they need.
> The Configuration Engine understands what they selected.
> Pricing determines what it costs.
> Promotions determine whether a commercial benefit applies.
> Billing determines what is owed.
> Payment determines whether money was collected.
> Licensing determines what the Workspace may use.
> Usage measures what the Workspace actually consumes.
> Product Advisory learns from that usage and recommends what may help next.
> The customer remains in control of every commercial decision.**

This gives the Tutor Learning Workspace Platform a commercial foundation that is:

* configurable;
* scalable;
* auditable;
* event-driven;
* AI-ready;
* promotion-ready;
* billing-ready;
* suitable for solo tutors;
* capable of growing into multi-tutor Workspaces;
* and ready for the **Design Your Plan** experience.
