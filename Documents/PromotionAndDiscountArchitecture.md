# Promotion & Discount Architecture

**Version:** 1.0
**Status:** Draft
**Bounded Context:** Promotion & Discounts
**Parent Domain:** Commercial Domain

---

# 1. Purpose

The Promotion & Discount bounded context manages commercial incentives that modify the price or commercial terms offered to a customer.

It answers:

> **"Does this customer qualify for a special commercial offer, and what financial benefit should that offer provide?"**

Examples include:

* coupon codes;
* percentage discounts;
* fixed-amount discounts;
* introductory pricing;
* free trials;
* promotional plans;
* referral rewards;
* loyalty discounts;
* launch offers;
* annual-payment incentives;
* targeted commercial offers.

---

# 2. Core Principle

Promotion is a **pricing modifier**, not a product definition.

The architecture should remain:

```text
Product
    ↓
Configuration
    ↓
Subscription
    ↓
Promotion / Discount
    ↓
Billing
```

A promotion should never silently change:

* what capabilities exist;
* what the Workspace is entitled to;
* how usage is measured;
* the subscription lifecycle.

It changes the **commercial terms**.

---

# 3. Architectural Position

```text
                    Product Management
                           │
                           ▼
                Product Configuration
                           │
                           ▼
                     Subscription
                           │
                           ▼
                Promotion & Discounts
                           │
                           ▼
                       Billing
                        (Invoice)
                           │
                           ▼
              Manually Marked Paid
       (§27a, SubscriptionManagementArchitecture.md —
          no payment processing in this platform)
```

At the same time:

```text
Subscription
      │
      ▼
Licensing
      │
      ▼
Workspace
```

Promotion does not sit between Subscription and Licensing.

---

# 4. Responsibilities

Promotion & Discounts owns:

* promotion definitions;
* discount rules;
* eligibility rules;
* promotion activation;
* promotion expiration;
* coupon codes;
* redemption limits;
* customer eligibility;
* promotional periods;
* discount stacking rules;
* introductory offers;
* referral rewards;
* promotion history.

---

# 5. Does Not Own

| Concern                 | Owner                   |
| ----------------------- | ----------------------- |
| Product definition      | Product Management      |
| Product configuration   | Configuration Engine    |
| Subscription lifecycle  | Subscription Management |
| Invoice (bill only — no payment collection, see 2026-08-09 correction) | Billing                 |
| Workspace authorization | Licensing               |
| Usage                   | Usage & Metering        |
| AI consumption          | Usage & Metering        |

---

# 6. Promotion vs Discount

These concepts should be distinct.

## Promotion

A commercial offer with rules.

Example:

```text
Launch Offer
20% off Solo Professional
Valid until September 30
```

## Discount

The financial effect applied to a transaction.

```text
Invoice:
$20

Discount:
-$4

Net:
$16
```

Therefore:

```text
Promotion
    ↓
Discount Calculation
    ↓
Billing
```

---

# 7. Promotion Aggregate

Conceptually:

```text
Promotion
│
├── Promotion ID
├── Name
├── Description
├── Status
├── Start Date
├── End Date
│
├── Eligibility Rules
├── Discount Rules
├── Redemption Rules
├── Stacking Rules
│
└── Product Scope
```

---

# 8. Promotion Lifecycle

```text
Draft
  ↓
Scheduled
  ↓
Active
  ↓
Expired
```

Alternative:

```text
Draft
  ↓
Active
  ↓
Suspended
  ↓
Active
  ↓
Expired
```

---

# 9. Promotion States

| State     | Meaning                  |
| --------- | ------------------------ |
| Draft     | Being configured         |
| Scheduled | Will become active later |
| Active    | Can be applied           |
| Suspended | Temporarily disabled     |
| Expired   | End date passed          |
| Archived  | No longer operational    |

---

# 10. Promotion Types

The initial architecture should support:

| Type               | Example                              |
| ------------------ | ------------------------------------ |
| Percentage         | 20% off                              |
| Fixed Amount       | $10 off                              |
| Introductory Price | $9 for first 3 months                |
| Free Trial         | 14 days free                         |
| Free Period        | First month free                     |
| Credit             | $10 account credit                   |
| Bundle Discount    | Buy pack, receive discount           |
| Annual Discount    | 20% off annual                       |
| Referral Reward    | $10 credit                           |
| Targeted Offer     | Special offer for selected customers |

---

# 11. Percentage Discount

Example:

```text
Plan:
$29

Promotion:
20%

Discount:
$5.80

Final:
$23.20
```

The percentage rule belongs to Promotion.

The invoice calculation belongs to Billing.

---

# 12. Fixed Discount

Example:

```text
Plan:
$29

Promotion:
$10 off

Final:
$19
```

The discount cannot reduce the applicable amount below the configured minimum unless the promotion explicitly allows it.

---

# 13. Introductory Pricing

This is particularly useful for our tutor platform.

Example:

```text
Solo AI+

Normal:
$29/month

First 3 months:
$19/month

After month 3:
$29/month
```

The subscription should remain:

```text
Solo AI+
```

Only the commercial price changes.

---

# 14. Introductory Pricing Lifecycle

```text
Subscription Created
       ↓
Promotion Applied
       ↓
Introductory Period
       ↓
Normal Pricing
```

Example:

```text
Month 1 → $19
Month 2 → $19
Month 3 → $19
Month 4 → $29
```

---

# 15. Free Trial

A trial is a commercial offer.

Example:

```text
Solo AI+
14-Day Trial
```

The underlying product configuration remains valid.

```text
Product Configuration
        ↓
Subscription
        ↓
Trial Terms
        ↓
Billing
```

---

# 16. Trial vs Free Plan

These should not be treated as the same concept.

### Free Trial

Temporary access to a paid product.

```text
Paid Product
    ↓
Trial
    ↓
Paid Subscription
```

### Free Plan

A permanent product configuration with zero price.

```text
Free Product
    ↓
Subscription
    ↓
Active
```

This distinction is important for future commercial analytics.

---

# 17. Coupon Code

A coupon is an activation mechanism for a promotion.

```text
Coupon Code
    ↓
Promotion
    ↓
Eligibility
    ↓
Discount
```

Example:

```text
Code:
TUTOR2026

Promotion:
20% off for 3 months
```

The coupon itself does not define the discount rules.

---

# 18. Coupon Aggregate

```text
Coupon
│
├── Code
├── Promotion ID
├── Status
├── Valid From
├── Valid Until
├── Maximum Redemptions
├── Per Customer Limit
└── Redemption Count
```

---

# 19. Coupon Redemption

A redemption should be recorded separately.

```text
Promotion
   │
   ▼
Coupon
   │
   ▼
Redemption
   │
   ▼
Subscription
```

Example:

```text
TUTOR2026
Redeemed by Workspace A
August 8
```

---

# 20. Redemption Limits

Promotions may have:

### Global Limit

```text
Maximum:
1,000 customers
```

### Customer Limit

```text
Maximum:
1 redemption/customer
```

### Workspace Limit

```text
Maximum:
1 redemption/workspace
```

### Subscription Limit

```text
Only first subscription
```

---

# 21. Eligibility Rules

A promotion can target:

```text
Customer
Workspace
Product
Plan
Subscription
Region
Billing Cycle
New Customer
Existing Customer
Referral
```

Example:

> 30% off Solo AI+ for new customers subscribing annually.

---

# 22. Eligibility Engine

Conceptually:

```text
Promotion
     │
     ▼
Eligibility Rules
     │
     ├── Customer qualifies
     ├── Product qualifies
     ├── Subscription qualifies
     ├── Billing cycle qualifies
     └── Date qualifies
```

Result:

```text
Eligible
```

or:

```text
Not Eligible
```

---

# 23. Eligibility Must Be Explainable

The system should be able to explain why a promotion was rejected.

Example:

```text
Promotion:
WELCOME20

Result:
Not Eligible

Reason:
Promotion applies only to first-time customers.
```

This is essential for customer support.

---

# 24. Promotion Scope

A promotion may apply to:

```text
Entire Subscription
Specific Plan
Specific Capability
Specific Add-on
Specific AI Credit Pack
Specific Billing Cycle
```

Example:

```text
20% off
Solo Professional

But not:
AI Credit Packs
```

---

# 25. Capability-Specific Promotion

Because we have a configurable product model, promotions can target individual components.

Example:

```text
AI Assessment
Normal:
$5

Promotion:
50% off

Discount:
$2.50
```

This should be represented as a pricing modification, not as a change to the capability entitlement itself.

---

# 26. Promotion Matrix

| Promotion | Plan     | Capability       | Billing Cycle | Customer |
| --------- | -------- | ---------------- | ------------- | -------- |
| Launch20  | All      | All              | Monthly       | New      |
| Annual20  | All      | All              | Annual        | All      |
| AI50      | AI Pack  | AI Credits       | All           | All      |
| Tutor10   | All      | Additional Tutor | All           | Existing |
| Welcome   | Selected | All              | Monthly       | New      |

---

# 27. Stacking

The platform must explicitly define whether promotions can stack.

Example:

```text
20% Welcome Discount
+
10% Annual Discount
```

Possible policies:

| Policy               | Meaning                           |
| -------------------- | --------------------------------- |
| No Stacking          | Only one promotion                |
| Best Discount        | Highest-value promotion wins      |
| Ordered Stacking     | Promotions apply in defined order |
| Explicit Combination | Only approved combinations        |

Recommended initial policy:

> **No stacking by default.**

Selected promotions may explicitly allow stacking.

---

# 28. Best Discount

If the customer has:

```text
Promotion A = 20%
Promotion B = $10
```

the system can calculate:

```text
A → $6 discount
B → $10 discount
```

and select:

```text
Promotion B
```

if the policy is "Best Discount."

---

# 29. Discount Priority

When multiple eligible promotions exist:

```text
Priority
   ↓
Eligibility
   ↓
Stacking Rules
   ↓
Best Applicable Offer
```

Promotion priority should be deterministic.

---

# 30. Promotion Duration

Discounts can be:

```text
One-Time
First N Billing Periods
Until Date
Recurring
Lifetime
```

Example:

```text
20% off

First 3 billing periods
```

---

# 31. One-Time Discount

Example:

```text
Subscription:
$29

First invoice:
$19

Future invoices:
$29
```

---

# 32. Recurring Discount

Example:

```text
Subscription:
$29

Every month:
20% discount
```

Until:

```text
Promotion End Date
```

---

# 33. Lifetime Discount

Example:

```text
20% off
for the entire subscription lifetime
```

This should be used carefully because it creates a long-term commercial commitment.

---

# 34. Annual Pricing Promotion

The platform can support:

```text
Monthly:
$29 × 12 = $348

Annual:
$290

Annual Saving:
$58
```

This can be represented as:

```text
Annual Pricing Policy
```

rather than a coupon.

---

# 35. Referral Promotion

Example:

```text
Tutor A refers Tutor B
```

Both may receive:

```text
$10 credit
```

Flow:

```text
Referral
   ↓
Eligibility
   ↓
Successful Conversion
   ↓
Reward
   ├── Referrer Credit
   └── New Customer Discount
```

---

# 36. Referral Reward

Referral rewards should become financial credits rather than directly modifying subscription configuration.

```text
Referral
   ↓
Credit
   ↓
Billing Account
   ↓
Future Invoice
```

---

# 37. Promotional AI Credits

We should also support promotional resources.

Example:

```text
Solo AI+

Included:
75K AI Credits

Promotion:
+25K Bonus Credits
```

Important:

> Bonus credits are not the same as purchased credits.

Therefore the License/Entitlement model should be able to distinguish:

```text
Included Credits
Purchased Credits
Promotional Credits
```

---

# 38. AI Credit Expiration

Promotional credits may expire.

Example:

```text
25K Bonus Credits
Valid for:
30 days
```

Purchased subscription allowance may follow:

```text
Billing Period
```

These rules must remain explicit.

---

# 39. Credit Priority

If multiple credit pools exist:

```text
Promotional Credits
Purchased Credits
Included Credits
```

the system should define consumption order.

Recommended:

```text
1. Expiring Promotional Credits
2. Purchased Add-on Credits
3. Included Subscription Credits
```

This maximizes customer value and avoids unnecessary expiration.

---

# 40. Promotion and Product Configuration

The Product Configuration Engine should calculate:

```text
Base Configuration
+
Selected Components
```

Promotion then calculates:

```text
Commercial Price Adjustment
```

Therefore:

```text
Configuration ≠ Promotion
```

---

# 41. Example: Design Your Plan + Promotion

Customer selects:

```text
Base:
Professional

AI Assessment:
Yes

Additional Tutor:
Yes

AI Credits:
25K
```

Configuration:

```text
Base                  $19
AI Assessment          $5
Additional Tutor       $7
25K AI Credits         $5
-------------------------
Subtotal               $36
```

Promotion:

```text
WELCOME20
20% off
```

Discount:

```text
-$7.20
```

Final:

```text
$28.80
```

---

# 42. Billing Integration

Promotion produces a discount instruction.

```text
Promotion
    ↓
Discount Calculation
    ↓
Billing
    ↓
Invoice Line
```

Billing remains responsible for the final financial document.

---

# 43. Promotion Snapshot

When a promotion is applied to a subscription, the applied terms should be preserved.

Example:

```text
Promotion:
WELCOME20

Applied:
20%

Duration:
3 months

Applied On:
Aug 8, 2026
```

If the promotion is later changed:

```text
WELCOME20 = 10%
```

the customer's existing 20% discount should not silently change.

---

# 44. Applied Promotion

Conceptually:

```text
AppliedPromotion
│
├── Promotion ID
├── Promotion Version
├── Subscription ID
├── Discount Rule Snapshot
├── Start Date
├── End Date
├── Remaining Periods
└── Redemption
```

---

# 45. Promotion Versioning

Promotions should be versioned.

Example:

```text
WELCOME20 v1
20% off
3 months

WELCOME20 v2
15% off
2 months
```

Existing customers retain their original applied terms.

---

# 46. Promotion Changes

Changing a promotion should affect:

```text
Future Redemptions
```

not:

```text
Existing Applied Promotions
```

unless the commercial policy explicitly says otherwise.

---

# 47. Promotion Cancellation

If an active promotion is withdrawn:

```text
Promotion
   ↓
Suspended
```

New customers cannot redeem it.

Existing customers should normally continue receiving the promised discount until the agreed promotional period ends.

---

# 48. Promotion Abuse Prevention

The system should support:

* redemption limits;
* customer uniqueness;
* Workspace uniqueness;
* email/domain restrictions where appropriate;
* payment-method restrictions;
* suspicious redemption detection;
* referral abuse detection;
* coupon expiration.

---

# 49. Promotion Security

Coupon codes should not be predictable where security matters.

For example, avoid simple sequences:

```text
WELCOME001
WELCOME002
WELCOME003
```

for private targeted offers.

Use secure/randomized codes where appropriate.

---

# 50. Promotion Analytics

The context should publish data such as:

```text
Promotion Created
Promotion Activated
Coupon Redeemed
Promotion Applied
Promotion Rejected
Promotion Expired
Promotion Cancelled
```

Analytics can then measure:

```text
Redemption Rate
Conversion Rate
Revenue Impact
Discount Cost
Customer Acquisition
Upgrade Rate
```

---

# 51. Promotion Performance

Example:

```text
WELCOME20

Issued:
10,000

Redeemed:
1,200

Converted:
950

Conversion Rate:
79.2%

Discount Cost:
$12,500

New Revenue:
$45,000
```

This belongs in Commercial Analytics, but Promotion must provide the events.

---

# 52. Promotion Eligibility Matrix

| Rule                  | Example                 |
| --------------------- | ----------------------- |
| New Customer          | First subscription only |
| Existing Customer     | Existing Workspace      |
| Product               | Solo AI+                |
| Billing Cycle         | Annual only             |
| Date                  | Aug 1–Sep 30            |
| Region                | Selected markets        |
| Referral              | Referral conversion     |
| Capacity              | One tutor only          |
| Usage                 | Below threshold         |
| Previous Subscription | Never subscribed before |

---

# 53. Promotion Decision

The promotion engine should return a structured result.

```text
Promotion Decision
│
├── Eligible
├── Promotion
├── Discount
├── Duration
├── Effective Date
├── Expiration Date
└── Explanation
```

Example:

```text
Eligible: Yes

Promotion:
WELCOME20

Discount:
20%

Duration:
3 months

Reason:
New customer + eligible product
```

---

# 54. Rejected Promotion

Example:

```text
Eligible:
No

Reason:
Customer has previously subscribed.
```

The system should avoid exposing internal rules that could create security or abuse risks.

---

# 55. Promotion Application Flow

```text
Customer
   │
   ▼
Enter Coupon / Select Offer
   │
   ▼
Promotion Engine
   │
   ├── Eligibility
   ├── Validity
   ├── Redemption Limit
   ├── Stacking
   └── Discount Calculation
   │
   ▼
Billing Preview
   │
   ▼
Customer Confirmation
   │
   ▼
Subscription
   │
   ▼
Invoice
```

---

# 56. Free Trial Flow

```text
Customer
   │
   ▼
Select Solo AI+
   │
   ▼
Apply Trial Promotion
   │
   ▼
Subscription
Trial
   │
   ▼
Workspace License
Active
   │
   ▼
Trial Ends
   │
   ▼
Billing (Invoice Issued)
   │
   ├── Manually Marked Paid → Active
   └── Overdue (not marked Paid) → Past Due
```

No automated payment processing occurs — see the 2026-08-09 correction note in `CommercialDomainReferenceArchitecture.md` §28.

---

# 57. Promotion and Cancellation

If a customer cancels during a promotional period:

```text
Subscription
   ↓
Cancellation Scheduled
   ↓
Promotion remains attached
   ↓
Subscription Ends
   ↓
Promotion Ends
```

Cancellation should not automatically generate a refund.

Refund policy belongs to Billing.

---

# 58. Promotion and Upgrade

Suppose:

```text
Professional
$19

WELCOME20
20% off
```

Customer upgrades to:

```text
AI+
$29
```

The system must explicitly define whether:

```text
20% continues
```

or:

```text
Promotion ends
```

Recommended:

> Promotions should define whether they are **subscription-wide** or **product-specific**.

---

# 59. Promotion Scope Rules

### Subscription-Wide

```text
20% off entire subscription
```

Upgrade may continue receiving 20%.

### Product-Specific

```text
20% off Solo Professional
```

Upgrade may remove the discount.

### Component-Specific

```text
50% off AI Assessment
```

Only that component is discounted.

---

# 60. Recommended Promotion Policies

| Scenario               | Recommended Default                           |
| ---------------------- | --------------------------------------------- |
| Coupon stacking        | No                                            |
| Existing customer      | Not eligible for welcome offers               |
| Upgrade                | Promotion preserved only if subscription-wide |
| Downgrade              | Promotion recalculated                        |
| Cancellation           | Promotion ends with subscription              |
| Refund                 | Billing policy                                |
| Expired promotion      | Existing commitments preserved                |
| Promotional AI credits | Expiring allowed                              |
| Coupon redemption      | Idempotent                                    |
| Promotion modification | Versioned                                     |

---

# 61. Promotion Invariants

### PRO-001

A promotion cannot modify product capability definitions.

### PRO-002

A promotion cannot directly grant Workspace authorization.

### PRO-003

Applied promotion terms must be historically preserved.

### PRO-004

Coupon redemption must be idempotent.

### PRO-005

Promotion eligibility must be deterministic.

### PRO-006

Expired promotions cannot be newly redeemed.

### PRO-007

Existing contractual promotional terms must not silently change.

### PRO-008

Discount calculations must be reproducible.

### PRO-009

Promotion stacking must follow explicit policy.

### PRO-010

Promotional credits must be distinguishable from purchased/included credits.

---

# 62. Promotion Domain Model

```text
Promotion
    │
    ├── Promotion Version
    │
    ├── Eligibility Rules
    │
    ├── Discount Rules
    │
    ├── Coupons
    │      │
    │      └── Redemptions
    │
    └── Applied Promotions
             │
             ▼
         Subscription
             │
             ▼
          Billing
```

---

# 63. Relationship With Product Configuration

```text
Product Configuration
        │
        ▼
Base Price
        │
        ▼
Promotion
        │
        ▼
Discounted Price
        │
        ▼
Billing
```

The configuration remains unchanged.

---

# 64. Relationship With Subscription

```text
Subscription
   │
   ├── Product Configuration
   │
   └── Applied Promotion
```

This allows the platform to answer:

> "Why is this customer's subscription price different from the standard price?"

Answer:

```text
Subscription
+
Pricing Snapshot
+
Applied Promotion
```

---

# 65. Relationship With Billing

```text
Promotion
    │
    ▼
Discount Result
    │
    ▼
Invoice
```

Billing owns:

* invoice;
* amount due;
* payment;
* refund.

Promotion owns:

* why the discount exists;
* eligibility;
* duration;
* rules.

---

# 66. Relationship With Usage

Promotion generally does not meter usage.

However, it may influence commercial allowances.

Example:

```text
Promotion:
+25K AI Credits
```

Then:

```text
Promotion
   ↓
Entitlement Adjustment
   ↓
License
```

Usage then measures consumption.

---

# 67. Relationship With Product Advisory

Usage can inform future promotions.

Example:

```text
High AI Usage
       ↓
Product Advisory
       ↓
Offer AI Credit Pack
       ↓
Promotion
       ↓
Customer
```

This is a later-stage commercial optimization capability.

---

# 68. Complete Commercial Flow

```text
                 PRODUCT
                    │
                    ▼
             CONFIGURATION
                    │
                    ▼
              SUBSCRIPTION
                    │
             ┌──────┴───────┐
             ▼              ▼
        PROMOTION        LICENSE
             │              │
             ▼              ▼
          BILLING        WORKSPACE
             │
             ▼
          PAYMENT
             │
             ▼
           USAGE
```

---

# 69. Example — New Tutor

Tutor signs up and selects:

```text
Solo Professional
```

Normal:

```text
$19/month
```

Enters:

```text
WELCOME20
```

Promotion:

```text
20% off
First 3 months
```

Result:

```text
Month 1:
$15.20

Month 2:
$15.20

Month 3:
$15.20

Month 4:
$19
```

The Workspace capabilities remain identical.

Only the commercial price changes.

---

# 70. Example — Design Your Plan Promotion

Tutor configures:

```text
Professional                 $19
AI Assessment                 $5
Additional Tutor              $7
25K AI Credits                $5
--------------------------------
Subtotal                     $36
```

Promotion:

```text
Launch20
20% off
```

Result:

```text
Discount:
$7.20

Final:
$28.80
```

The customer still receives the same:

```text
Tutors = 2
AI Assessment = Enabled
AI Credits = 25K
```

---

# 71. Example — Promotional AI Credits

Customer has:

```text
Included:
75K

Promotion:
+25K

Total available:
100K
```

Usage:

```text
Used:
40K
```

Remaining:

```text
60K
```

If promotional credits expire first, the system consumes them according to the configured credit priority.

---

# 72. Example — Referral

Tutor A invites Tutor B.

Tutor B becomes a paying customer.

Promotion engine creates:

```text
Tutor B:
$10 discount

Tutor A:
$10 credit
```

Billing applies both financial benefits independently.

---

# 73. Recommended Initial Implementation

For V1, support:

### Promotions

* percentage discounts;
* fixed discounts;
* introductory pricing;
* free trials;
* annual discount;
* coupon codes;
* referral credits;
* promotional AI credits.

### Rules

* start/end date;
* new/existing customer;
* product scope;
* billing cycle;
* redemption limit;
* no stacking by default.

### Financial

* invoice discounts;
* account credits;
* promotional credit packs.

Avoid complex campaign orchestration initially.

---

# 74. Final Commercial Architecture

The Commercial Domain now becomes:

```text
┌────────────────────────────────────────────────────────────┐
│                     COMMERCIAL DOMAIN                      │
│                                                            │
│  Product Management                                       │
│          │                                                 │
│          ▼                                                 │
│  Product Configuration Engine                              │
│          │                                                 │
│          ▼                                                 │
│  Subscription Management                                   │
│          │                                                 │
│          ├───────────────┐                                 │
│          ▼               ▼                                 │
│   Promotion &          Licensing                           │
│   Discounts            & Entitlements                      │
│          │               │                                 │
│          ▼               ▼                                 │
│       Billing         Workspace                            │
│    (Invoice)                                                │
│          │                                                 │
│          ▼                                                 │
│  Manually Marked Paid (no payment processing)                │
│                                                            │
│  Usage & Metering ───────────────► Billing / Analytics      │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

# 75. Architectural Outcome

We now have a clean distinction:

| Question                            | Bounded Context       |
| ----------------------------------- | --------------------- |
| What can we sell?                   | Product Management    |
| How can we compose it?              | Product Configuration |
| What did the customer subscribe to? | Subscription          |
| Is there a special offer?           | Promotion             |
| What should they pay?               | Billing               |
| Did they pay?                       | Billing               |
| What can they use?                  | Licensing             |
| What did they consume?              | Usage                 |

This separation is particularly valuable for our **solo tutor platform**, because we can introduce sophisticated commercial strategies later without changing the core Learning Workspace.

---

# 76. Status

**Draft — Version 1.0**

The next document should be:

**`ProductAdvisoryArchitecture.md`**

This is where we can connect the commercial intelligence together:

```text
Workspace
   ↓
Subscription
   ↓
Usage
   ↓
Behavior
   ↓
Product Advisory
   ↓
Recommendation
   ↓
Design Your Plan / Upgrade / Add-on
```

This will be especially important for the **Design Your Plan** idea we agreed on, because the platform can eventually recommend exactly which capability or AI allowance a solo tutor should add based on how they actually use the Workspace.
