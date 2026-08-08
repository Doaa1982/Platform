# Subscription Management Architecture

**Version:** 1.0
**Status:** Draft
**Bounded Context:** Subscription Management
**Parent Domain:** Commercial Domain

---

# 1. Purpose

The Subscription Management bounded context manages the **commercial relationship between a customer/workspace and a subscribed product configuration**.

It answers:

> **"What commercial subscription does this Workspace currently have, and what is its lifecycle state?"**

It is the bridge between:

```text
Product Configuration
        ↓
Subscription
        ↓
License
        ↓
Workspace Entitlements
```

---

# 2. Core Responsibility

Subscription Management owns:

* subscription creation;
* subscription activation;
* subscription lifecycle;
* billing-cycle configuration;
* renewal;
* cancellation;
* expiration;
* suspension;
* pause/resume;
* upgrade;
* downgrade;
* subscription changes;
* subscription history;
* effective dates;
* scheduled changes;
* subscription state transitions.

---

# 3. What Subscription Management Does Not Own

| Concern                 | Owner                         |
| ----------------------- | ----------------------------- |
| Product catalog         | Commercial Product Management |
| Product configuration   | Product Configuration Engine  |
| Payment collection      | Billing                       |
| Usage measurement       | Usage & Metering              |
| Workspace authorization | Licensing & Entitlements      |
| Product recommendations | Product Advisory              |
| Workspace data          | Learning Workspace            |

---

# 4. Architectural Position

```text
                Commercial Product Management
                           │
                           ▼
                Product Configuration Engine
                           │
                           ▼
                    Product Configuration
                           │
                           ▼
                ┌───────────────────────┐
                │ Subscription Manager  │
                └───────────┬───────────┘
                            │
                 ┌──────────┼──────────┐
                 ▼          ▼          ▼
              Billing     License    Usage
                 │          │
                 ▼          ▼
             Payments   Entitlements
                            │
                            ▼
                       Workspace
```

---

# 5. Subscription vs Product vs License

These concepts must remain separate.

## Product

Defines what can be sold.

```text
Solo AI+
```

## Product Configuration

Defines the exact commercial composition.

```text
Solo AI+
Learning = AI+
Assessment = AI+
Tutors = 2
AI Credits = 75K
```

## Subscription

Defines the customer's active commercial relationship.

```text
Subscription #123

Workspace = ABC
Configuration = XYZ
Status = Active
Billing Cycle = Monthly
Start = Aug 8
Renewal = Sep 8
```

## License

Defines what the Workspace is currently allowed to use.

```text
Learning AI+
Assessment AI+
Tutors = 2
AI Credits = 75K
```

---

# 6. Subscription Aggregate

Conceptually:

```text
Subscription
│
├── Subscription ID
├── Workspace ID
├── Customer ID
│
├── Product Configuration
│
├── Subscription Status
│
├── Billing Cycle
│
├── Start Date
├── Current Period
├── Renewal Date
│
├── Cancellation
│
├── Scheduled Changes
│
└── Subscription History
```

---

# 7. Subscription Lifecycle

Recommended lifecycle:

```text
                    ┌─────────────┐
                    │   Draft     │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  Pending    │
                    └──────┬──────┘
                           │
                    Payment confirmed
                           │
                           ▼
                    ┌─────────────┐
                    │   Active    │
                    └──────┬──────┘
                           │
             ┌─────────────┼──────────────┐
             │             │              │
             ▼             ▼              ▼
          Paused       Past Due       Cancelled
             │             │              │
             │             ▼              │
             │          Grace            │
             │             │              │
             │             ▼              │
             │        Suspended          │
             │                            │
             └──────────────┬─────────────┘
                            ▼
                         Expired
```

---

# 8. Subscription States

| State          | Meaning                                                        |
| -------------- | -------------------------------------------------------------- |
| **Draft**      | Subscription is being prepared                                 |
| **Pending**    | Awaiting required commercial/payment confirmation              |
| **Active**     | Subscription is currently active                               |
| **Paused**     | Subscription temporarily paused                                |
| **Past Due**   | Payment is overdue                                             |
| **Grace**      | Temporary continued access while payment is resolved           |
| **Suspended**  | Access restricted because subscription is not in good standing |
| **Cancelled**  | Customer has requested cancellation                            |
| **Expired**    | Subscription period has ended                                  |
| **Terminated** | Subscription permanently closed                                |

---

# 9. Important Distinction: Cancelled vs Expired

Cancellation does not necessarily mean immediate loss of access.

Example:

```text
Aug 8
Customer cancels

Subscription:
Cancelled

Access:
Still active

Access ends:
Sep 8
```

Therefore:

```text
Subscription Status
≠
License Status
```

The license can remain active until the effective cancellation date.

---

# 10. Immediate Cancellation

Some products or policies may allow immediate cancellation.

```text
Active
   ↓
Cancelled Immediately
   ↓
License Revoked
```

Whether refunds or credits are issued is a Billing concern.

---

# 11. Cancellation at Period End

Default recommended behavior:

```text
Active
   ↓
Cancellation Scheduled
   ↓
Continue Access
   ↓
Period Ends
   ↓
Expired
   ↓
License Ends
```

This is safer and more predictable for tutors.

---

# 12. Renewal

A subscription may renew automatically.

```text
Current Period
      │
      ▼
Renewal Evaluation
      │
      ├── Payment Success
      │       ↓
      │    New Period
      │
      └── Payment Failure
              ↓
           Past Due
```

---

# 13. Renewal Principle

A renewal should preserve the current subscription configuration unless:

* the customer scheduled a change;
* the product has been retired;
* pricing changed according to commercial policy;
* a contractual change applies.

---

# 14. Scheduled Subscription Changes

Changes should support effective dates.

Example:

```text
Current:

Solo Professional
Tutors = 1

Scheduled:

Solo Professional
Tutors = 2

Effective:
Next Billing Period
```

This prevents accidental immediate changes when commercial policy requires period-based transitions.

---

# 15. Upgrade

An upgrade may be:

### Immediate

```text
Current
Professional

        ↓

AI+

Effective immediately
```

### Period-End

```text
Current
Professional

        ↓

AI+

Effective next renewal
```

The commercial policy determines which behavior applies.

---

# 16. Upgrade Flow

```text
Customer
   │
   ▼
Select Upgrade
   │
   ▼
Product Configuration Engine
   │
   ▼
Calculate Difference
   │
   ▼
Subscription Management
   │
   ▼
Billing
   │
   ▼
Subscription Updated
   │
   ▼
License Updated
```

---

# 17. Downgrade

Downgrades are more complex because they may remove capabilities or capacity.

Example:

```text
Current:

Solo AI+
Tutors = 2
AI Credits = 75K

Downgrade:

Solo Professional
Tutors = 1
AI Credits = 20K
```

The system must determine whether existing workspace resources are affected.

---

# 18. Downgrade Safety

Before allowing a downgrade:

```text
Configuration Engine
        │
        ▼
Impact Analysis
        │
        ├── No Impact
        │
        ├── Warning
        │
        └── Blocking Impact
```

Example:

> You currently have two tutors. The selected plan supports one tutor. One tutor must be removed or reassigned before the downgrade can take effect.

---

# 19. Subscription Change Types

| Change               | Example                       |
| -------------------- | ----------------------------- |
| Plan Upgrade         | Professional → AI+            |
| Plan Downgrade       | AI+ → Professional            |
| Capability Upgrade   | Analytics Basic → AI Insights |
| Capability Downgrade | AI Insights → Advanced        |
| Pack Addition        | Add Marketing Pack            |
| Pack Removal         | Remove Marketing Pack         |
| Capacity Increase    | 1 → 2 tutors                  |
| Capacity Reduction   | 2 → 1 tutor                   |
| Usage Increase       | 20K → 50K AI credits          |
| Billing Cycle Change | Monthly → Annual              |

---

# 20. Subscription Versioning

Every significant subscription change should create a new subscription version.

Example:

```text
Subscription #100

Version 1
Solo Professional
Aug 8 → Sep 8

Version 2
Solo AI+
Sep 8 → Oct 8
```

The history remains immutable.

---

# 21. Subscription History

```text
Subscription
│
├── Version 1
│   └── Solo Essential
│
├── Version 2
│   └── Solo Professional
│
├── Version 3
│   └── Solo AI+
│
└── Version 4
    └── Solo AI+ + Additional Tutor
```

This is essential for:

* customer support;
* billing;
* auditing;
* refunds;
* analytics;
* dispute resolution.

---

# 22. Subscription Period

A subscription should explicitly define:

```text
Start Date
Current Period Start
Current Period End
Next Renewal Date
```

Example:

```text
Start:
08 Aug 2026

Current Period:
08 Aug → 08 Sep

Renewal:
08 Sep
```

---

# 23. Billing Cycle

Supported billing cycles may include:

| Cycle     | Example        |
| --------- | -------------- |
| Monthly   | Every month    |
| Quarterly | Every 3 months |
| Annual    | Every year     |
| Custom    | Contractual    |

The initial platform can start with:

```text
Monthly
Annual
```

and expand later.

---

# 24. Trial Subscription

The architecture should support trials without treating them as a separate product.

```text
Product Configuration
        │
        ▼
Subscription
        │
        ├── Trial Period
        │
        └── Paid Period
```

Example:

```text
Solo AI+

Trial:
14 days

Then:
Monthly subscription
```

---

# 25. Trial Lifecycle

```text
Trial
  │
  ├── Convert → Active
  │
  ├── Cancel → Expired
  │
  └── Trial Ends → Payment Required
                         │
                         ├── Success → Active
                         └── Failure → Past Due
```

---

# 26. Grace Period

A grace period protects the tutor from immediate disruption caused by payment failures.

Example:

```text
Payment Failure
      ↓
Past Due
      ↓
Grace Period
      ↓
Payment Success → Active

or

Grace Period Ends
      ↓
Suspended
```

The exact grace duration is a commercial policy.

---

# 27. License Relationship

Subscription Management requests license changes.

It does not directly manage runtime authorization.

```text
Subscription
     │
     │ Subscription Activated
     ▼
Licensing & Entitlements
     │
     ▼
Workspace License
```

---

# 28. Subscription → License Rules

| Subscription State | License Recommendation        |
| ------------------ | ----------------------------- |
| Active             | Active                        |
| Trial              | Active                        |
| Paused             | Restricted / Policy dependent |
| Past Due           | Active / Grace                |
| Grace              | Active                        |
| Suspended          | Restricted                    |
| Cancelled          | Active until effective date   |
| Expired            | Inactive                      |
| Terminated         | Revoked                       |

---

# 29. Payment Failure

Payment failure must not immediately mean:

```text
License = Revoked
```

Instead:

```text
Payment Failure
      ↓
Subscription = Past Due
      ↓
Grace Policy
      ↓
License = Active
      ↓
Payment succeeds
      ↓
Subscription = Active
```

This protects the customer's learning workspace.

---

# 30. Subscription Pause

A customer may request a temporary pause.

Example:

```text
Active
   ↓
Pause Scheduled
   ↓
Paused
   ↓
Resume
   ↓
Active
```

The pause policy determines:

* whether access remains available;
* whether billing stops;
* whether usage allowances freeze;
* whether subscription dates move;
* maximum pause duration.

---

# 31. Subscription Resume

When resumed:

```text
Paused
   ↓
Resume Request
   ↓
Configuration Validation
   ↓
Billing Validation
   ↓
Active
```

The system should not blindly reactivate an obsolete configuration.

---

# 32. Product Retirement

A product can be retired while subscriptions remain active.

Example:

```text
Product:
Solo Professional v1

Status:
Retired for New Sales

Existing Subscription:
Active
```

Existing customers remain supported according to migration policy.

---

# 33. Product Retirement Strategy

Possible strategies:

| Strategy               | Meaning                          |
| ---------------------- | -------------------------------- |
| **Grandfather**        | Customer remains on old product  |
| **Auto-Migrate**       | Customer moves to replacement    |
| **Migration Required** | Customer must choose replacement |
| **End-of-Life**        | Subscription ends after notice   |

The default should be **Grandfather**, unless there is a strong commercial or technical reason otherwise.

---

# 34. Subscription Migration

When migration is required:

```text
Old Subscription
       │
       ▼
Migration Assessment
       │
       ▼
Target Configuration
       │
       ▼
Impact Analysis
       │
       ▼
Customer Confirmation
       │
       ▼
New Subscription Version
```

---

# 35. Subscription Ownership

A subscription should reference:

```text
Customer
Workspace
Product Configuration
```

Recommended model:

```text
Customer
   │
   └── Subscription
           │
           └── Workspace
```

However, the architecture should not assume that the person paying is necessarily the same person operating the Workspace.

This becomes important when:

* a parent pays for a tutor;
* an academy pays for tutors;
* a company owns multiple workspaces;
* an administrator manages subscriptions.

---

# 36. Subscription Actor Model

Possible actors:

| Actor              | Responsibility                  |
| ------------------ | ------------------------------- |
| Workspace Owner    | Manage subscription             |
| Billing Owner      | Manage payment                  |
| Organization Admin | Manage commercial relationship  |
| Platform Admin     | Support/admin operations        |
| System             | Automated renewal and lifecycle |

Authorization belongs to the Identity/Access domain, while Subscription Management defines the commercial operations available.

---

# 37. Subscription Commands

Conceptually:

```text
CreateSubscription
ActivateSubscription
CancelSubscription
ScheduleCancellation
PauseSubscription
ResumeSubscription
RenewSubscription
UpgradeSubscription
DowngradeSubscription
ChangeBillingCycle
AddCapacity
RemoveCapacity
AddPack
RemovePack
```

---

# 38. Domain Events

Subscription Management may publish:

```text
SubscriptionCreated

SubscriptionActivated

SubscriptionRenewed

SubscriptionUpgradeScheduled

SubscriptionUpgraded

SubscriptionDowngradeScheduled

SubscriptionDowngraded

SubscriptionPaused

SubscriptionResumed

SubscriptionCancellationScheduled

SubscriptionCancelled

SubscriptionEnteredPastDue

SubscriptionEnteredGrace

SubscriptionSuspended

SubscriptionExpired

SubscriptionTerminated
```

---

# 39. Billing Integration

Subscription Management requests billing actions.

```text
Subscription
      │
      ▼
Billing
      │
      ├── Invoice
      ├── Payment
      └── Payment Result
```

Billing does not decide whether a subscription should exist.

---

# 40. Billing Failure Integration

```text
Billing
   │
   │ PaymentFailed
   ▼
Subscription Management
   │
   ▼
Past Due
   │
   ▼
Grace Policy
   │
   ▼
Licensing
```

---

# 41. Usage Integration

Usage Metering reports consumption.

Example:

```text
AI Credits
Allowed: 75,000
Used: 72,000
```

Subscription Management should not calculate usage.

It may receive usage-related signals when a commercial action is required.

---

# 42. License Integration

When subscription state changes:

```text
SubscriptionActivated
        ↓
License Activated

SubscriptionUpgraded
        ↓
License Updated

SubscriptionSuspended
        ↓
License Restricted

SubscriptionExpired
        ↓
License Deactivated
```

---

# 43. Effective-Dated Changes

Subscription changes should support:

```text
Effective Immediately
Effective Next Billing Period
Effective Specific Date
```

Example:

```text
Today:
Solo Professional

Scheduled:
Solo AI+

Effective:
Next Renewal
```

---

# 44. Subscription Change Preview

Before confirming a change, the system should provide:

```text
Current Configuration
+
New Configuration
+
Price Difference
+
Effective Date
+
Capability Impact
+
Capacity Impact
+
Usage Impact
```

Example:

> Your plan will change from Professional to AI+ on September 8. Your monthly price will increase by $12 and AI-assisted assessment features will become available.

---

# 45. Subscription Invariants

### SUB-001

Every active subscription must reference a valid product configuration.

### SUB-002

A subscription cannot become Active without satisfying activation requirements.

### SUB-003

Subscription history must remain immutable.

### SUB-004

A cancelled subscription may remain active until its effective cancellation date.

### SUB-005

An expired subscription cannot remain commercially active.

### SUB-006

A subscription change must produce a new effective version.

### SUB-007

A subscription cannot directly grant runtime entitlements.

### SUB-008

License state must be derived from subscription state and commercial policy.

### SUB-009

Payment failure must follow the configured grace policy.

### SUB-010

A product retirement must not silently invalidate an existing subscription.

---

# 46. Subscription State Machine

The authoritative state model:

```text
                       ┌────────────┐
                       │   Draft    │
                       └─────┬──────┘
                             │
                             ▼
                       ┌────────────┐
                       │  Pending   │
                       └─────┬──────┘
                             │
                             ▼
                       ┌────────────┐
                       │   Active   │◄─────────────┐
                       └──┬─────┬───┘              │
                          │     │                  │
             Pause ───────┘     └──── Payment ────┤
                          │          recovery      │
                          ▼                        │
                    ┌────────────┐                 │
                    │   Paused   │─────────────────┘
                    └────────────┘

Active
  │
  └── Payment Failure
           │
           ▼
      ┌──────────┐
      │ Past Due │
      └────┬─────┘
           │
           ▼
       ┌───────┐
       │ Grace │
       └───┬───┘
           │
      ┌────┴─────┐
      │          │
 Payment OK    Grace Ends
      │          │
      ▼          ▼
   Active     Suspended
                 │
                 ▼
              Expired


Active
  │
  └── Cancel
         │
         ▼
  Cancellation Scheduled
         │
         ▼
       Expired
```

---

# 47. Subscription Timeline Example

```text
Aug 08
│
├── Subscription Created
│
├── Subscription Activated
│
├── License Activated
│
│
Sep 01
│
├── Customer requests upgrade
│
├── New configuration calculated
│
└── Upgrade scheduled
│
│
Sep 08
│
├── New billing period
├── New subscription version
└── License updated
```

---

# 48. Full Commercial Lifecycle

The complete architecture now becomes:

```text
                    PRODUCT CATALOG
                          │
                          ▼
                 PRODUCT CONFIGURATION
                          │
                          ▼
                    SUBSCRIPTION
                          │
                ┌─────────┴─────────┐
                ▼                   ▼
             BILLING             LICENSE
                │                   │
                ▼                   ▼
             PAYMENT          ENTITLEMENTS
                                    │
                                    ▼
                               WORKSPACE
                                    │
                                    ▼
                              USAGE METERING
```

---

# 49. Critical Architectural Separation

The platform must preserve these boundaries:

```text
Product
"What can we sell?"

Configuration
"What exactly was selected?"

Subscription
"What commercial relationship is active?"

License
"What is currently granted?"

Entitlement
"What capability/limit is available?"

Usage
"How much has been consumed?"

Billing
"How much money is owed/paid?"
```

This separation prevents the commercial domain from becoming a single large, tightly coupled model.

---

# 50. Example: Solo Tutor Lifecycle

### Step 1 — Select Plan

```text
Solo AI+
```

### Step 2 — Configuration

```text
Learning = AI+
Assessment = AI+
Tutors = 1
AI Credits = 75K
```

### Step 3 — Subscription

```text
Status = Active
Billing = Monthly
```

### Step 4 — License

```text
Learning AI+
Assessment AI+
Tutors = 1
AI Credits = 75K
```

### Step 5 — Workspace

The tutor sees and uses the entitled capabilities.

---

# 51. Example: Tutor Adds Another Tutor

```text
Current:
Tutors = 1

Customer selects:
Additional Tutor

        ↓

Product Configuration Engine

        ↓

New Configuration:
Tutors = 2

        ↓

Subscription Change

        ↓

License Update

        ↓

Workspace
Additional Tutor slot available
```

---

# 52. Example: Payment Failure

```text
Payment Failed
      ↓
Subscription = Past Due
      ↓
Grace Period
      ↓
License = Active
      ↓
Payment Retry
      │
      ├── Success → Active
      │
      └── Failure → Suspended
```

The tutor should not immediately lose their Workspace.

---

# 53. Example: Cancellation

```text
Customer clicks Cancel
        ↓
Subscription = Cancellation Scheduled
        ↓
License remains Active
        ↓
Billing Period Ends
        ↓
Subscription = Expired
        ↓
License = Inactive
```

This provides predictable behavior.

---

# 54. Example: Design Your Own Plan

```text
Customer
   │
   ▼
Design Your Plan
   │
   ▼
Product Configuration Engine
   │
   ├── Validate
   ├── Resolve
   └── Price
   │
   ▼
Confirmed Configuration
   │
   ▼
Subscription
   │
   ▼
License
   │
   ▼
Workspace
```

The Subscription system does not need to know how the configuration was created.

---

# 55. Recommended Data Ownership

| Entity                 | Owner                   |
| ---------------------- | ----------------------- |
| Product                | Product Management      |
| Product Version        | Product Management      |
| Capability             | Product Management      |
| Product Configuration  | Configuration Engine    |
| Configuration Snapshot | Configuration Engine    |
| Subscription           | Subscription Management |
| Subscription Version   | Subscription Management |
| Billing Account        | Billing                 |
| Invoice                | Billing                 |
| Payment                | Billing                 |
| License                | Licensing               |
| Entitlement            | Licensing               |
| Usage Record           | Usage & Metering        |

---

# 56. Architectural Principle

The Subscription Management context should be:

**Lifecycle-oriented, not feature-oriented.**

It should not contain logic such as:

```text
if tutor count > 1
    enable collaboration
```

That belongs to Product Configuration and Licensing.

Subscription Management should instead say:

```text
Subscription Version 3
references
Configuration Snapshot 892
```

The configuration and licensing contexts determine the resulting capabilities.

---

# 57. Final Architecture

```text
┌─────────────────────────────────────────────────────────┐
│                  COMMERCIAL DOMAIN                      │
│                                                         │
│  Product Management                                    │
│       │                                                 │
│       ▼                                                 │
│  Product Configuration                                  │
│       │                                                 │
│       ▼                                                 │
│  Subscription Management                                │
│       │                                                 │
│       ├──────────────► Billing                          │
│       │                                                 │
│       ▼                                                 │
│  Licensing & Entitlements                               │
│       │                                                 │
└───────┼─────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────┐
│       Learning Workspace      │
│                               │
│  Capabilities                 │
│  Capacity                     │
│  AI Assistance                │
│  Usage Limits                 │
└───────────────┬───────────────┘
                │
                ▼
          Usage & Metering
```

---

# 58. Status

**Draft — Version 1.0**

This document establishes Subscription Management as the authoritative owner of the **commercial lifecycle**.

The next document should define the other important dimension:

> **How the platform measures actual consumption—especially AI usage—and compares it against the allowances defined by the Product Configuration and License.**

**Next: `UsageAndMeteringArchitecture.md`**
