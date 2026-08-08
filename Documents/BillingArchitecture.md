# Billing Architecture

**Version:** 1.0
**Status:** Draft — Scope Narrowed 2026-08-09 (see notice below)
**Bounded Context:** Billing
**Parent Domain:** Commercial Domain

---

> ## ⚠️ Scope Correction — 2026-08-09
>
> **This platform does not collect payment.** Billing's actual scope here is **Invoice generation only** — producing the bill (amount owed, line items, tax, currency) and tracking its status. There is no payment method storage, no payment gateway integration, no automated payment lifecycle, and no automated refund transaction. An Invoice is marked **Paid** by an authorized human, and that manual action is what triggers Subscription Management's activation (`SubscriptionManagementArchitecture.md` §27a) — not a payment-provider webhook.
>
> This document was written assuming an in-house payment system and was **not rewritten section-by-section** after the correction, to avoid introducing errors across 70 sections without corresponding value. Use this map to know what still applies:
>
> **Still applies (Invoice-only concerns):** §9–15 (Invoice, Invoice Lifecycle, Invoice States, Invoice Line, Invoice Snapshot Principle, Pricing Snapshot, Currency), §25–29 (Proration, Upgrade/Downgrade Billing), §30–31 (Credits, Credit Ledger — as bookkeeping adjustments to a future invoice, not money movement), §34–37 (Tax, Discount, Billing Calculation), §38–44 (Billing Preview, Design Your Plan/Fixed Plan Billing examples), §48–50 (Financial Ledger, Invoice/Ledger distinction, Account Balance), §66 (Recommended Invoice Structure).
>
> **Does NOT apply — describes payment processing this platform will not build:** §16–21 (Payment Method, Payment Providers, Payment Lifecycle, Payment States, Payment Retry), §32–33 (Refunds as money movement — a "Refund" here becomes a credit/invoice adjustment instead, per §30–31), §51–54 (Payment Security, Payment Provider Webhooks, Webhook Idempotency, Reconciliation with a payment provider).
>
> **Needs reinterpretation — same intent, different trigger:** §20 (Payment Failure → read as "Invoice overdue, not marked Paid"), §22–24 (Renewal Flow — "Attempt Payment" becomes "await manual payment confirmation"), §45–47 (Billing Events — `PaymentSucceeded`/`PaymentFailed` don't exist; `InvoiceCreated`, `InvoicePaid` (now a manual-trigger event), `InvoicePastDue` do), §56–58 (Billing Matrix, Subscription↔Billing Matrix — "Payment" rows should read as "Invoice marked Paid"), §64 (Billing Invariants — BIL-002/BIL-003/BIL-009, which assume a payment provider, don't apply as written), §65 (Recommended Initial Billing Model — drop Card Payment/Automatic Renewal, keep the invoicing and proration items).
>
> Full reasoning: `CommercialDomainReferenceArchitecture.md` §28 correction note. Corrected data model: `Commercial Domain Data Model — Billing.md`.

---

# 1. Purpose

The Billing bounded context manages the **financial side of the commercial relationship** between a customer and the platform.

It answers:

> **"How much should the customer pay, what has been charged, what has been paid, and what is still owed?"**

Billing is intentionally separated from:

* Product Configuration;
* Subscription Management;
* Licensing & Entitlements;
* Usage & Metering.

---

# 2. Core Principle

The platform must maintain this separation:

```text
Product Configuration
"What did they choose?"

        ↓

Subscription
"What commercial relationship is active?"

        ↓

License
"What can they use?"

        ↓

Usage
"What did they consume?"

        ↓

Billing
"What money is owed or paid?"
```

Billing should never become the source of truth for Workspace access.

---

# 3. Architectural Position

```text
                    Product Configuration
                             │
                             ▼
                       Subscription
                             │
                             ▼
                          Billing
                       ┌─────┴─────┐
                       ▼           ▼
                   Invoice      Payment
                       │           │
                       └─────┬─────┘
                             ▼
                       Payment Result
                             │
                             ▼
                       Subscription
                             │
                             ▼
                        Licensing
```

---

# 4. Billing Responsibilities

Billing owns:

* billing accounts;
* invoices;
* invoice lines;
* payment attempts;
* payment methods;
* payment transactions;
* payment status;
* refunds;
* credits;
* adjustments;
* proration calculations;
* billing periods;
* tax calculation integration;
* payment provider integration;
* financial transaction history;
* outstanding balances.

---

# 5. Billing Does Not Own

| Concern                  | Owner                   |
| ------------------------ | ----------------------- |
| Product catalog          | Product Management      |
| Product configuration    | Configuration Engine    |
| Subscription lifecycle   | Subscription Management |
| Workspace access         | Licensing               |
| Usage measurement        | Usage & Metering        |
| Feature authorization    | Licensing               |
| Customer recommendations | Product Advisory        |

---

# 6. Billing Account

A customer should have a Billing Account separate from their Workspace.

```text
Customer
   │
   └── Billing Account
          │
          ├── Payment Methods
          ├── Invoices
          ├── Credits
          └── Transactions
```

This allows one billing entity to potentially pay for multiple Workspaces.

---

# 7. Why Billing Account ≠ Workspace

Example:

```text
Parent / Company
      │
      ▼
Billing Account
      │
      ├── Tutor Workspace A
      ├── Tutor Workspace B
      └── Tutor Workspace C
```

The same architecture also supports:

```text
Tutor
  │
  └── Billing Account
          │
          └── One Workspace
```

This gives us flexibility without forcing the model to assume that every Workspace has exactly one payer.

---

# 8. Billing Relationship

```text
Customer
   │
   ▼
Billing Account
   │
   ▼
Subscription
   │
   ▼
Invoice
   │
   ▼
Payment
```

---

# 9. Invoice

The invoice represents a financial obligation.

Conceptually:

```text
Invoice
│
├── Invoice ID
├── Billing Account
├── Subscription
├── Billing Period
├── Issue Date
├── Due Date
├── Currency
├── Lines
├── Subtotal
├── Discounts
├── Tax
├── Total
├── Amount Paid
├── Amount Due
└── Status
```

---

# 10. Invoice Lifecycle

Recommended states:

```text
Draft
  ↓
Open
  ↓
Payment Processing
  ↓
Paid
```

Alternative paths:

```text
Open
  ↓
Past Due
  ↓
Paid
```

or:

```text
Open
  ↓
Past Due
  ↓
Uncollectible
```

---

# 11. Invoice States

| State          | Meaning                    |
| -------------- | -------------------------- |
| Draft          | Invoice is being prepared  |
| Open           | Amount is due              |
| Processing     | Payment is being attempted |
| Paid           | Fully paid                 |
| Partially Paid | Some amount paid           |
| Past Due       | Payment deadline passed    |
| Voided         | Invoice cancelled          |
| Uncollectible  | Unable to collect          |

---

# 12. Invoice Line

Every invoice should contain explicit lines.

Example:

```text
Invoice #INV-1024

Solo AI+ Plan                 $29
Additional AI Credit Pack    $10
Discount                      -$5
Tax                            $2
--------------------------------
Total                         $36
```

The invoice should preserve the commercial explanation of the amount.

---

# 13. Invoice Snapshot Principle

An invoice must be historically immutable after finalization.

If the customer had:

```text
Solo Professional
$19/month
```

and the price later becomes:

```text
$24/month
```

the old invoice remains:

```text
Solo Professional
$19
```

It must never dynamically recalculate from the current Product Catalog.

---

# 14. Pricing Snapshot

Invoice lines should reference a **pricing snapshot**.

```text
Product Configuration
        │
        ▼
Pricing Calculation
        │
        ▼
Invoice
        │
        └── Frozen Financial Values
```

This protects financial history.

---

# 15. Currency

Every invoice must explicitly specify currency.

Example:

```text
Currency:
USD
```

The platform should not assume the customer's location determines billing currency.

Future support may include:

```text
USD
THB
EUR
SAR
AED
```

depending on commercial strategy and payment-provider support.

---

# 16. Payment Method

The Billing Account may have:

```text
PaymentMethod
│
├── Type
├── Provider
├── Token
├── Billing Details
├── Default
└── Status
```

Sensitive payment credentials should remain with the payment provider whenever possible.

The platform should store provider references/tokens rather than raw card data.

---

# 17. Payment Providers

Billing should use an abstraction:

```text
Payment Gateway
        │
        ├── Provider A
        ├── Provider B
        └── Provider C
```

This prevents the Commercial Domain from becoming dependent on one payment provider.

---

# 18. Payment Lifecycle

```text
Payment Requested
       ↓
Payment Processing
       │
       ├── Success → Paid
       │
       ├── Failed → Failed
       │
       └── Requires Action
```

---

# 19. Payment States

| State              | Meaning                        |
| ------------------ | ------------------------------ |
| Pending            | Payment requested              |
| Processing         | Provider is processing         |
| Succeeded          | Payment successful             |
| Failed             | Payment failed                 |
| Requires Action    | Customer intervention required |
| Refunded           | Fully refunded                 |
| Partially Refunded | Partially refunded             |
| Cancelled          | Payment attempt cancelled      |

---

# 20. Payment Failure

A failed payment does **not** automatically mean:

```text
Workspace Access = Revoked
```

Instead:

```text
Payment Failed
      ↓
Billing
      ↓
Subscription = Past Due
      ↓
Grace Policy
      ↓
License remains Active
```

This preserves the separation of responsibilities.

---

# 21. Payment Retry

The system should support retry policies.

```text
Payment Failed
      ↓
Retry #1
      ↓
Retry #2
      ↓
Retry #3
      ↓
Grace Period Ends
```

The exact schedule belongs to Billing policy.

---

# 22. Subscription and Billing Relationship

Subscription Management decides:

> "The subscription should renew."

Billing decides:

> "Can we successfully collect the money?"

Example:

```text
Subscription
     │
     │ Renewal Requested
     ▼
Billing
     │
     ├── Payment Success
     │       ↓
     │    Renewal Complete
     │
     └── Payment Failure
             ↓
          Past Due
```

---

# 23. Renewal Flow

```text
Subscription
     │
     ▼
Renewal Date
     │
     ▼
Create Invoice
     │
     ▼
Attempt Payment
     │
 ┌───┴────┐
 ▼        ▼
Success  Failure
 │        │
 ▼        ▼
Paid    Past Due
 │        │
 ▼        ▼
Renew   Retry / Grace
```

---

# 24. Failed Renewal

Recommended flow:

```text
Renewal Date
     ↓
Invoice Created
     ↓
Payment Failed
     ↓
Subscription = Past Due
     ↓
Grace Period
     ↓
Retry Payment
     │
     ├── Success → Active
     │
     └── Failure → Suspended
```

---

# 25. Proration

Proration is required when a subscription changes during a billing period.

Example:

```text
Current Plan:
$20/month

New Plan:
$40/month

Change occurs halfway through month.
```

The system calculates the unused value of the old plan and the remaining value of the new plan.

---

# 26. Proration Example

Conceptually:

```text
Unused Old Plan Value
        -
Remaining New Plan Value
        =
Proration Adjustment
```

Example:

```text
Unused old plan:
$10

New plan remaining value:
$20

Additional charge:
$10
```

The exact calculation must be handled consistently and recorded.

---

# 27. Upgrade Billing

```text
Tutor
  │
  ▼
Upgrade Plan
  │
  ▼
Product Configuration
  │
  ▼
Price Difference
  │
  ▼
Proration Calculation
  │
  ▼
Invoice / Adjustment
  │
  ▼
Payment
  │
  ▼
Subscription Updated
  │
  ▼
License Updated
```

---

# 28. Downgrade Billing

Downgrades may produce:

* no immediate financial adjustment;
* credit;
* refund;
* period-end price change.

Recommended initial policy:

> **Downgrades become effective at the next billing period.**

This greatly simplifies billing and avoids unnecessary refunds.

---

# 29. Recommended Upgrade/Downgrade Policy

| Change                  | Recommended          |
| ----------------------- | -------------------- |
| Upgrade                 | Immediate            |
| Upgrade Billing         | Prorated             |
| Downgrade               | Next billing period  |
| Downgrade Refund        | No automatic refund  |
| Billing Cycle Upgrade   | Immediate / prorated |
| Billing Cycle Downgrade | Next period          |

This can later become configurable commercial policy.

---

# 30. Credits

Billing should support credits.

Example:

```text
Billing Account Credit:
$15
```

Credit can be applied to future invoices.

Sources may include:

* refund conversion;
* service compensation;
* promotion;
* manual support adjustment;
* migration adjustment.

---

# 31. Credit Ledger

Credits should be auditable.

```text
Credit Ledger

+ $20 Promotion
- $10 Invoice #1001
------------------
  $10 Remaining
```

Credits should never simply overwrite a balance.

---

# 32. Refunds

Refunds are financial transactions.

Supported types:

```text
Full Refund
Partial Refund
Credit Instead of Refund
```

Example:

```text
Invoice:
$40

Refund:
$10

Remaining captured amount:
$30
```

---

# 33. Refund Flow

```text
Customer / Admin
      ↓
Refund Request
      ↓
Refund Policy
      ↓
Billing
      ↓
Payment Provider
      ↓
Refund Result
      ↓
Financial Ledger
```

A refund should not automatically decide whether the subscription remains active.

That is a Subscription decision.

---

# 34. Tax

Tax should be represented explicitly.

```text
Subtotal
    +
Discount
    +
Tax
    =
Total
```

The platform should support integration with a tax calculation service rather than embedding country-specific tax rules into the Workspace.

---

# 35. Discount

Discounts may come from:

* promotion;
* coupon;
* negotiated commercial agreement;
* introductory pricing;
* migration;
* loyalty program.

Billing applies the financial result.

The source and rules are owned by Commercial Product / Promotion contexts.

---

# 36. Billing Calculation Flow

```text
Subscription
     │
     ▼
Product Configuration Snapshot
     │
     ▼
Pricing
     │
     ▼
Discounts
     │
     ▼
Credits
     │
     ▼
Proration
     │
     ▼
Tax
     │
     ▼
Invoice Total
```

---

# 37. Billing Calculation Must Be Deterministic

For the same:

```text
Configuration
Pricing Version
Discounts
Tax Context
Billing Period
```

the system should produce the same financial result.

This is essential for:

* audit;
* support;
* reconciliation;
* disputes.

---

# 38. Billing Preview

Before charging a customer, the platform should support:

```text
Billing Preview
```

Example:

```text
Current Plan              $19
Upgrade                  +$10
Proration                 +$5
Credit                    -$3
Tax                       +$2
--------------------------------
Amount Due                $33
```

The customer can confirm before payment.

---

# 39. Design Your Own Plan Billing

This integrates directly with our Product Configuration Engine.

```text
Design Your Plan
       ↓
Configuration
       ↓
Price Calculation
       ↓
Billing Preview
       ↓
Customer Confirmation
       ↓
Subscription
       ↓
Invoice
       ↓
Payment
```

Billing does not need to understand every feature.

It receives the finalized commercial price and line-item explanation.

---

# 40. Fixed Plans

For fixed plans:

```text
Solo Essential
$9/month

Solo Professional
$19/month

Solo AI+
$29/month
```

Billing simply invoices according to the active subscription configuration and pricing version.

---

# 41. Configurable Plans

For Design Your Plan:

```text
Base Plan
+
Selected Capabilities
+
Capacity
+
AI Allowance
-
Discounts
=
Final Price
```

The Configuration Engine calculates the commercial configuration.

Billing receives the finalized result.

---

# 42. Additional Tutor Billing

Example:

```text
Base Plan:
$19

Additional Tutor:
+$7

Total:
$26/month
```

The subscription configuration records:

```text
Tutors = 2
```

Billing records:

```text
Base Subscription       $19
Additional Tutor         $7
```

---

# 43. AI Credit Pack Billing

Example:

```text
Base AI Allowance:
75K

Additional Pack:
25K

Pack Price:
$5
```

Invoice:

```text
Solo AI+                 $29
AI Credit Pack            $5
----------------------------
Total                    $34
```

The License receives:

```text
AI Credits = 100K
```

Usage measures consumption.

---

# 44. Billing and Usage

Billing can consume Usage information when pricing includes overage.

```text
Usage
  │
  ▼
Billable Usage
  │
  ▼
Invoice Line
```

Example:

```text
Included AI Credits:
75K

Actual:
82K

Overage:
7K

Invoice:
+ $3
```

However, Usage & Metering remains the source of truth for consumption.

---

# 45. Billing Events

Billing should publish events such as:

```text
InvoiceCreated

InvoiceFinalized

PaymentRequested

PaymentSucceeded

PaymentFailed

PaymentRequiresAction

InvoicePaid

InvoicePastDue

RefundIssued

CreditGranted

CreditApplied
```

---

# 46. Integration With Subscription

Important events:

```text
PaymentSucceeded
        ↓
SubscriptionRenewalConfirmed

PaymentFailed
        ↓
SubscriptionPastDue

GraceExpired
        ↓
SubscriptionSuspensionRequested
```

Billing should not directly manipulate licenses.

---

# 47. Integration With Licensing

Licensing reacts indirectly through Subscription.

```text
Billing
   │
   ▼
Subscription
   │
   ▼
License
```

Avoid:

```text
Billing
   │
   └──────► License
```

This prevents tight coupling.

---

# 48. Financial Ledger

The platform should maintain an immutable financial ledger.

Example:

```text
Ledger
│
├── Invoice +$29
├── Payment -$29
├── Credit +$10
├── Credit Applied -$10
└── Refund +$5
```

The ledger provides an audit trail.

---

# 49. Invoice vs Transaction vs Ledger

These concepts should remain separate.

| Entity  | Purpose                    |
| ------- | -------------------------- |
| Invoice | Amount customer owes       |
| Payment | Money received             |
| Refund  | Money returned             |
| Credit  | Financial value available  |
| Ledger  | Complete financial history |

---

# 50. Billing Account Balance

The system may expose:

```text
Outstanding:
$29

Credits:
$10

Net Due:
$19
```

But the underlying ledger remains authoritative.

---

# 51. Payment Security

The platform should avoid storing:

* raw card numbers;
* CVV;
* sensitive payment credentials.

Instead:

```text
Platform
   ↓
Payment Provider
   ↓
Token / Payment Method Reference
```

Payment provider security requirements should be followed.

---

# 52. Payment Provider Webhooks

Payment providers may send asynchronous events.

Example:

```text
Payment Provider
      │
      ▼
Webhook
      │
      ▼
Billing
      │
      ▼
Verify Event
      │
      ▼
Update Payment
```

Webhook processing must be idempotent.

---

# 53. Webhook Idempotency

If the provider sends:

```text
payment_succeeded
```

three times:

```text
Event 1 → Process
Event 2 → Ignore
Event 3 → Ignore
```

The customer must never be charged or credited multiple times.

---

# 54. Reconciliation

Billing should support reconciliation between:

```text
Platform Records
        ↕
Payment Provider
        ↕
Bank / Financial System
```

Example:

```text
Platform:
$10,000 collected

Provider:
$10,000 collected

Difference:
$0
```

Any difference should produce a reconciliation exception.

---

# 55. Billing Exceptions

Examples:

```text
Payment Provider Timeout
Duplicate Payment
Webhook Missing
Payment Reversed
Refund Failed
Invoice Mismatch
Currency Mismatch
Tax Calculation Failure
```

These should enter an operational exception workflow rather than silently modifying data.

---

# 56. Billing Matrix

| Capability            | Billing Responsibility  |
| --------------------- | ----------------------- |
| Subscription Charge   | Yes                     |
| Invoice               | Yes                     |
| Payment               | Yes                     |
| Refund                | Yes                     |
| Credit                | Yes                     |
| Discount Application  | Financial Application   |
| Tax                   | Calculation/Integration |
| Usage Measurement     | No                      |
| Usage Collection      | No                      |
| License               | No                      |
| Workspace Access      | No                      |
| Product Configuration | No                      |

---

# 57. Subscription → Billing Matrix

| Subscription Event | Billing Action             |
| ------------------ | -------------------------- |
| Created            | Prepare billing            |
| Activated          | Create first invoice       |
| Renewing           | Create renewal invoice     |
| Upgraded           | Calculate proration        |
| Downgraded         | Schedule future pricing    |
| Cancelled          | Stop future billing        |
| Suspended          | Policy dependent           |
| Expired            | No future recurring charge |

---

# 58. Billing → Subscription Matrix

| Billing Event    | Subscription Reaction |
| ---------------- | --------------------- |
| Payment Success  | Activate / renew      |
| Payment Failure  | Past Due              |
| Grace Expired    | Suspend               |
| Payment Recovery | Reactivate            |
| Refund           | Policy-dependent      |
| Chargeback       | Commercial review     |

---

# 59. Invoice Lifecycle Example

```text
Subscription Renewal
        ↓
Generate Invoice
        ↓
Invoice Open
        ↓
Payment Attempt
        │
        ├── Success
        │      ↓
        │    Paid
        │
        └── Failure
               ↓
            Past Due
               ↓
             Retry
```

---

# 60. Upgrade Example

Current:

```text
Solo Professional
$19
```

Tutor upgrades:

```text
Solo AI+
$29
```

During the billing period:

```text
Old Plan Remaining Value:
$9

New Plan Remaining Value:
$14

Additional Charge:
$5
```

Billing:

```text
Invoice
Upgrade Proration      $5
```

Subscription:

```text
Solo AI+
```

License:

```text
AI capabilities enabled
```

---

# 61. Downgrade Example

Current:

```text
Solo AI+
$29
```

Customer chooses:

```text
Solo Professional
$19
```

Recommended:

```text
Today:
AI+ remains active

Next Renewal:
Professional becomes active
```

Billing:

```text
Current invoice:
$29

Next invoice:
$19
```

No immediate refund.

---

# 62. Cancellation Example

Customer cancels on August 20.

Billing period:

```text
Aug 8 → Sep 8
```

Recommended:

```text
Aug 20
Cancellation requested

Aug 20 → Sep 8
No further recurring charge
Workspace remains active

Sep 8
Subscription expires
```

---

# 63. Payment Failure Example

```text
Sep 8
Renewal invoice = $29

Payment fails

Subscription:
Past Due

License:
Active

Sep 10
Retry fails

Sep 12
Retry succeeds

Subscription:
Active

License:
Active
```

No Workspace disruption occurs.

---

# 64. Billing Invariants

### BIL-001

Every finalized invoice must be immutable.

### BIL-002

Every payment must reference a billing account.

### BIL-003

Payment provider events must be idempotent.

### BIL-004

Billing must not directly grant Workspace entitlements.

### BIL-005

Historical invoices must preserve the pricing snapshot used at creation.

### BIL-006

Refunds must be auditable.

### BIL-007

Credits must be ledger-based.

### BIL-008

Financial calculations must be reproducible.

### BIL-009

Payment failure must follow Subscription's commercial state policy.

### BIL-010

A billing failure must not automatically revoke access without the Subscription/Licensing lifecycle deciding to do so.

---

# 65. Recommended Initial Billing Model

For the first platform release, keep the commercial model intentionally simple.

### Support:

```text
Monthly
Annual

Fixed Plans
Design Your Plan

Card Payment
Automatic Renewal

Upgrade
Downgrade at Period End

Credits
Refunds

Proration for Upgrades
Grace Period for Failed Payments
```

Avoid implementing complex enterprise billing until there is a real business requirement.

---

# 66. Recommended Initial Invoice Structure

```text
Invoice
│
├── Subscription
├── Billing Period
│
├── Base Plan
│
├── Additional Capabilities
│
├── Additional Tutor Capacity
│
├── AI Credit Packs
│
├── Discounts
│
├── Credits
│
├── Tax
│
└── Total
```

This structure maps directly to our **Product Configuration Engine**.

---

# 67. Complete Commercial Architecture

We now have a complete commercial chain:

```text
┌──────────────────────────────────────────────────────────┐
│                   COMMERCIAL DOMAIN                      │
│                                                          │
│  Product Management                                      │
│          │                                               │
│          ▼                                               │
│  Product Configuration Engine                            │
│          │                                               │
│          ▼                                               │
│  Subscription Management                                 │
│          │                                               │
│     ┌────┴─────────────┐                                 │
│     ▼                  ▼                                 │
│  Billing        Licensing & Entitlements                 │
│     │                  │                                 │
│     │                  ▼                                 │
│     │             Workspace Access                       │
│     │                                                    │
│     ▼                                                    │
│  Payments                                                  │
│                                                          │
│          ▲                                               │
│          │                                               │
│   Usage & Metering                                       │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

# 68. End-to-End Example

A tutor chooses:

```text
Solo Professional
```

Then adds:

```text
AI Assessment
+25K AI Credits
Second Tutor
```

### Product Configuration

```text
Base Plan              $19
AI Assessment           $5
25K AI Credits          $5
Additional Tutor        $7
---------------------------
Total                   $36
```

### Subscription

```text
Status:
Active

Billing:
Monthly
```

### Billing

```text
Invoice:
$36
```

### Payment

```text
Payment:
Succeeded
```

### Licensing

```text
Tutors:
2

AI Assessment:
Enabled

AI Credits:
25K additional
```

### Usage

```text
AI Credits Used:
8,400
```

The four contexts remain independent while working together.

---

# 69. Commercial Domain Separation

The final conceptual model is:

```text
                  WHAT CAN WE SELL?
                         │
                         ▼
                Product Management
                         │
                         ▼
                WHAT DID THEY CHOOSE?
                         │
                         ▼
              Product Configuration
                         │
                         ▼
              WHAT DID THEY AGREE TO?
                         │
                         ▼
                  Subscription
                         │
             ┌───────────┴───────────┐
             ▼                       ▼
       WHAT DO THEY OWE?       WHAT CAN THEY USE?
             │                       │
             ▼                       ▼
          Billing                Licensing
             │                       │
             └───────────┬───────────┘
                         ▼
                  WHAT DID THEY USE?
                         │
                         ▼
                       Usage
```

---

# 70. Status

**Draft — Version 1.0**

Billing is now defined as the financial boundary of the Commercial Domain.

The next logical document is:

**`PromotionAndDiscountArchitecture.md`**

because we now need to define how **coupons, introductory offers, discounts, free trials, promotional pricing, and commercial incentives** modify the price without contaminating Product Configuration, Subscription, or Billing.
