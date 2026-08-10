# AIProductPackagingArchitecture.md

**Version:** 1.0
**Status:** Draft
**Bounded Context:** Commercial / Product Configuration
**Architectural Layer:** AI Product Packaging
**Depends On:**

* `AIAssistantArchitecture.md`
* `AIOrchestrationArchitecture.md`
* `AIContextArchitecture.md`
* `AISkillArchitecture.md`
* `AIModelProviderArchitecture.md`
* `AIUsageAndCostArchitecture.md`
* `LicensingAndEntitlementArchitecture.md`
* `BillingArchitecture.md`
* `ProductConfigurationArchitecture.md`
* `CommercialDomainIntegrationArchitecture.md`

---

# 1. Purpose

This document defines how AI capabilities are transformed from technical capabilities into configurable commercial offerings.

The architecture must allow the Platform to decide:

* Which AI capabilities are available
* To whom they are available
* Whether they are included in a product
* How much usage is included
* Whether additional usage can be purchased
* Whether premium AI capabilities require an upgrade
* Whether AI is free or paid
* How AI capabilities participate in subscriptions
* How AI Credits may be packaged
* How AI capabilities differ between products

The key principle is:

> **AI implementation is independent from AI commercial packaging.**

---

# 2. The Core Separation

The architecture contains four distinct layers:

```text
AI Capability
      ↓
AI Product Capability
      ↓
Entitlement
      ↓
Commercial Usage / Billing
```

For example:

```text
GenerateQuestions
```

is an AI capability.

It can then be packaged as:

```text
Basic Plan
    → Included

Premium Plan
    → Included with larger allowance

Enterprise
    → Included with custom policy
```

The Skill itself never changes.

---

# 3. AI Capability

An AI Capability represents something the Platform can technically perform.

Examples:

```text
GenerateLesson
GenerateQuestions
ExplainLesson
ExplainStudentAnswer
TranscribeVideo
GenerateLessonFromVideo
SemanticSearch
AIStudyAssistant
```

These belong to the AI domain.

---

# 4. AI Skill

An AI Skill is the executable implementation of a capability.

Conceptually:

```text
AI Capability
      ↓
AI Skill
      ↓
AI Orchestrator
      ↓
Model Router
```

The Skill does not know whether it is:

* Free
* Included
* Premium
* Credit-based
* Usage-based

That is a commercial concern.

---

# 5. Product Capability

The Product Configuration Engine determines whether a product exposes an AI capability.

Example:

```text
Tutor Product
│
├── Lesson Management
├── Assignment Management
├── Student Management
└── AI Lesson Generation
```

The AI capability becomes a product capability.

---

# 6. Product Packaging

A commercial product may package AI in several ways.

```text
AI Packaging
│
├── Included
├── Limited
├── Credit-Based
├── Usage-Based
├── Premium
├── Add-On
└── Disabled
```

---

# 7. Included AI

The simplest model:

```text
Premium Plan
    ↓
AI Lesson Generation
    ↓
Included
```

There is no additional customer charge.

Usage can still be metered internally.

---

# 8. Limited Included AI

A plan may include a defined allowance.

Example:

```text
Premium Plan

AI Lesson Generation:
100 / month
```

The entitlement is:

```text
Allowed
```

while the usage policy is:

```text
Maximum:
100
```

---

# 9. Credit-Based AI

The Platform may sell AI Credits separately.

Example:

```text
AI Credit Pack
    ↓
100 Credits
```

A Skill may consume a configured number of credits.

Example:

```text
GenerateLesson
    ↓
5 Credits
```

The Skill does not perform the deduction itself.

---

# 10. Usage-Based AI

AI can also be priced directly according to a commercial meter.

Example:

```text
Transcription
    ↓
$X / minute
```

The Usage system measures minutes.

The commercial layer determines the price.

---

# 11. Premium AI

The Platform may expose higher-quality AI as a product feature.

Example:

```text
Standard AI
Premium AI
```

The commercial configuration determines who can access Premium AI.

The Model Router determines which underlying model fulfills it.

---

# 12. AI Add-On

AI can be packaged as an optional add-on.

Example:

```text
Tutor Plan
    +
AI Assistant Add-On
```

The subscription architecture determines whether the add-on is active.

Entitlement then exposes the relevant capabilities.

---

# 13. AI as a Free Capability

AI can also be genuinely free to the customer.

Example:

```text
Free Plan
    ↓
AI Assistant
    ↓
10 interactions / month
```

"Free" means:

> No additional customer charge.

It does **not** mean:

> No AI infrastructure cost.

The Platform still measures provider cost.

---

# 14. AI as a Subscription Capability

AI can be included in the subscription itself.

Example:

```text
Tutor Starter
    AI = Basic

Tutor Pro
    AI = Advanced

Tutor Enterprise
    AI = Custom
```

This is likely the preferred initial commercial approach.

---

# 15. AI as a Separate Subscription

The Platform may eventually offer:

```text
Core Platform Subscription
+
AI Subscription
```

This is useful if AI becomes a major standalone product.

Example:

```text
Platform
$X / month

AI Assistant
$Y / month
```

The entitlement system combines both subscriptions.

---

# 16. Product Configuration Engine

The Product Configuration Engine should be the central mechanism for defining AI packaging.

Conceptually:

```text
Product
  ↓
AI Capability Configuration
  ↓
Entitlement Policy
  ↓
Usage Policy
  ↓
Commercial Policy
```

---

# 17. AI Product Configuration

An AI product configuration may contain:

```text
AIProductCapability
│
├── CapabilityId
├── Enabled
├── AccessMode
├── QualityTier
├── UsageMeter
├── IncludedAllowance
├── CreditCost
├── OveragePolicy
└── AvailabilityPolicy
```

---

# 18. Access Mode

Possible values:

```text
Included
Quota
Credit
UsageBased
Premium
AddOn
Disabled
```

The exact implementation can use enums/value objects.

---

# 19. Example Configuration

Conceptually:

```text
Product:
Tutor Pro

Capability:
GenerateLesson

Enabled:
true

AccessMode:
Included

MonthlyAllowance:
100
```

This means the customer can use the Skill, subject to the defined allowance.

---

# 20. Quality Tier

A product can define the AI quality level.

Example:

```text
QualityTier:
Standard
```

or:

```text
QualityTier:
Premium
```

The Model Router translates this into model requirements.

---

# 21. Commercial Configuration vs Model Configuration

The Product Configuration Engine should say:

```text
QualityTier = Premium
```

It should **not** say:

```text
Model = ProviderX-ModelY
```

That belongs to the AI Model Router.

---

# 22. Why This Separation Matters

Suppose the Platform changes its provider.

Before:

```text
Premium
→ Model A
```

After:

```text
Premium
→ Model B
```

The commercial product remains:

```text
Premium AI
```

No customer-facing configuration needs to change.

---

# 23. Usage Meter

Each AI capability may define a commercial meter.

Example:

```text
GenerateLesson
    → AIRequest

TranscribeVideo
    → TranscriptionMinute

GenerateQuestions
    → GeneratedQuestion
```

This links the product configuration to Usage & Metering.

---

# 24. Included Allowance

A product can specify:

```text
IncludedAllowance
```

Example:

```text
GenerateQuestions:
500 operations / month
```

The Usage subsystem tracks actual consumption.

---

# 25. Unlimited AI

The Platform may support:

```text
AccessMode:
Included

Allowance:
Unlimited
```

However, "Unlimited" should normally still be subject to:

```text
Fair Use
Technical Rate Limits
Abuse Protection
Infrastructure Protection
```

---

# 26. Fair Use

Unlimited AI should not mean:

> Infinite unrestricted provider consumption.

The Platform may enforce:

```text
Technical Limits
Concurrency Limits
Rate Limits
Abuse Detection
```

without presenting them as normal commercial quotas.

---

# 27. Overage Policy

A product can define what happens after included usage is exhausted.

Possible policies:

```text
Block
Consume Credits
Charge Overage
Downgrade AI Quality
Request Upgrade
```

---

# 28. Overage Example

```text
Tutor Pro

Included:
100 AI lesson generations

After 100:
Allow additional usage
using AI Credits
```

The customer experience remains simple.

---

# 29. Block Policy

A product may instead define:

```text
100 included
0 overage
```

At usage 101:

```text
AI capability unavailable
```

The UI may present:

```text
Upgrade Plan
```

---

# 30. Credit Fallback

Another product may define:

```text
Included:
100

After 100:
Consume AI Credits
```

The entitlement system permits the operation.

The usage system consumes the appropriate commercial unit.

---

# 31. Premium Fallback

The Platform could allow:

```text
Standard AI
```

after the allowance is exhausted while reserving:

```text
Premium AI
```

for paid usage.

This should be explicitly configured.

---

# 32. AI Capability Bundle

Products may package several Skills together.

Example:

```text
AI Tutor Assistant
│
├── Explain Lesson
├── Explain Answer
├── Generate Practice
├── Recommend Lesson
└── Summarize Content
```

The commercial system can sell the bundle as one product capability.

---

# 33. AI Add-On Bundle

Example:

```text
AI Content Creation Add-On
│
├── Generate Lesson
├── Generate Questions
├── Generate Activities
└── Generate Summaries
```

The add-on can activate all related entitlements.

---

# 34. Product-Level AI Bundles

A Learning Product may also include AI.

Example:

```text
Learning Product:
English Mastery

Included AI:
AI Study Assistant
AI Practice Generator
AI Explanation
```

This means AI packaging does not have to exist only at platform subscription level.

---

# 35. Product Hierarchy

AI availability may be derived from multiple layers:

```text
Platform
   ↓
Commercial Product
   ↓
Subscription
   ↓
Workspace
   ↓
Learning Product
   ↓
User
```

The effective entitlement is calculated from these layers.

---

# 36. Effective AI Entitlement

Conceptually:

```text
Effective AI Entitlement
=
Platform Policy
+
Subscription
+
Add-Ons
+
Workspace Policy
+
Product Policy
```

subject to conflict and precedence rules.

---

# 37. Entitlement Precedence

The Licensing & Entitlement architecture should define precedence.

For example:

```text
Platform Restriction
        ↓
Subscription Entitlement
        ↓
Add-On Entitlement
        ↓
Workspace Policy
        ↓
Product Policy
```

A lower-level configuration must never grant access that a higher-level policy explicitly prohibits.

---

# 38. AI Capability Matrix

The Product Configuration Engine can expose a matrix such as:

| Capability          |     Free |  Starter |      Pro | Enterprise |
| ------------------- | -------: | -------: | -------: | ---------: |
| Explain Lesson      |        ✓ |        ✓ |        ✓ |          ✓ |
| Generate Questions  |  Limited |        ✓ |        ✓ |          ✓ |
| Generate Lesson     |        — |  Limited |        ✓ |          ✓ |
| Video Transcription |        — |        — |        ✓ |          ✓ |
| Premium AI          |        — |        — |        ✓ |     Custom |
| AI Credits          | Optional | Optional | Optional |     Custom |

The values are examples of configuration, not hard-coded product rules.

---

# 39. AI Credit Product

AI Credits should themselves be represented as a commercial product.

Example:

```text
AI Credit Pack 100
AI Credit Pack 500
AI Credit Pack 1,000
```

Billing handles the purchase.

The Credit Ledger handles the resulting balance.

---

# 40. Credit Expiration

The commercial system may define:

```text
Credits expire after:
90 days
```

or:

```text
Credits never expire
```

This is a commercial rule.

---

# 41. Credit Priority

If multiple credit grants exist:

```text
Purchased Credits
Promotional Credits
Subscription Credits
```

the Credit Ledger needs deterministic consumption rules.

For example:

```text
Expiring credits first
```

---

# 42. AI Trial

The Platform may provide trial AI usage.

Example:

```text
New Workspace
    ↓
50 AI Credits
    ↓
Trial
```

Trial credits should be distinguished from purchased credits.

---

# 43. Promotional AI

Marketing may grant:

```text
100 AI Credits
```

as a promotion.

The ledger should identify:

```text
GrantType:
Promotion
```

rather than treating it as a purchase.

---

# 44. Subscription Renewal

A subscription may grant:

```text
Monthly AI Allowance
```

on every billing cycle.

Example:

```text
Subscription Renewal
       ↓
Grant 500 AI Units
```

The grant should be tied to the billing period.

---

# 45. Cancellation

If the subscription is cancelled:

```text
Subscription
 ↓
Ends
 ↓
AI Entitlement
 ↓
Revoked
```

Existing historical usage remains intact.

---

# 46. Grace Period

If the commercial architecture supports a billing grace period:

```text
Payment Failure
 ↓
Grace Period
 ↓
AI Access
```

The effective entitlement policy determines whether AI remains available.

The AI Skill should not know about payment failure.

---

# 47. Downgrade

Example:

```text
Pro
 ↓
Starter
```

AI entitlements may change:

```text
Premium AI
    ↓
Removed

Basic AI
    ↓
Retained
```

The effective entitlement is recalculated.

---

# 48. Upgrade

Example:

```text
Starter
 ↓
Pro
```

New AI capabilities become available immediately if the commercial system supports immediate entitlement activation.

---

# 49. AI Product Configuration Versioning

AI commercial configurations should be versioned.

Example:

```text
Product Version 1
GenerateLesson:
100 included

Product Version 2
GenerateLesson:
200 included
```

Historical usage should continue referencing the commercial configuration applicable at the time.

---

# 50. Configuration Effective Dates

Configurations should support:

```text
EffectiveFrom
EffectiveTo
```

This enables scheduled pricing and entitlement changes.

---

# 51. Example Scheduled Change

```text
August:
100 AI operations

September:
250 AI operations
```

The system can publish the new configuration before September without modifying August history.

---

# 52. AI Pricing Does Not Belong in Skill Code

Avoid:

```text
if (plan == "Pro")
{
    cost = 5;
}
```

Instead:

```text
Skill
 ↓
Usage Meter
 ↓
Commercial Configuration
 ↓
Rating
```

---

# 53. AI Feature Flags

Feature flags may control technical rollout.

Example:

```text
AIQuestionGenerationEnabled
```

However, feature flags must not replace entitlement.

Correct:

```text
Feature Flag
AND
Entitlement
```

Both must permit execution.

---

# 54. Technical Availability vs Commercial Availability

These are separate.

```text
Technical:
Is the AI capability deployed?
```

versus:

```text
Commercial:
Is the customer entitled to use it?
```

A capability may be technically available but commercially disabled.

---

# 55. AI Capability Lifecycle

AI capabilities may have:

```text
Draft
Internal
Beta
Available
Deprecated
Retired
```

Commercial packaging should only expose capabilities in allowed lifecycle states.

---

# 56. Beta AI

A capability may be available only to selected products.

Example:

```text
AI Study Planner
```

could be:

```text
Beta
Enterprise only
```

The Product Configuration Engine controls exposure.

---

# 57. Enterprise Customization

Enterprise customers may receive custom AI policies:

```text
Enterprise
│
├── Custom AI Allowance
├── Custom AI Skills
├── Restricted Models
├── Dedicated Provider
└── Regional Processing
```

The architecture supports this without changing the underlying AI Skills.

---

# 58. AI Provider Selection Remains Infrastructure

Even when Enterprise requests:

```text
Premium AI
```

the customer-facing product configuration should not need to know the provider model.

The Model Router resolves it.

---

# 59. Product Configuration Example

Conceptually:

```text
Product:
Tutor Pro

AI Capabilities:

ExplainLesson:
    Enabled = true
    Access = Included
    QualityTier = Standard

GenerateLesson:
    Enabled = true
    Access = Included
    Allowance = 100

GenerateQuestions:
    Enabled = true
    Access = Included
    Allowance = 500

TranscribeVideo:
    Enabled = true
    Access = CreditBased
    CreditCost = 1 / minute

PremiumAI:
    Enabled = true
    Access = AddOn
```

---

# 60. Runtime Resolution

At runtime:

```text
User Request
      ↓
AI Skill
      ↓
Resolve Workspace
      ↓
Resolve Product
      ↓
Resolve Effective Entitlement
      ↓
Resolve Usage Policy
      ↓
Resolve AI Quality Tier
      ↓
Execute
```

---

# 61. Runtime Commercial Decision

The result should be something like:

```text
AIExecutionAuthorization
│
├── Allowed
├── Reason
├── UsageMeter
├── RemainingAllowance
├── QualityTier
├── OveragePolicy
└── CommercialContext
```

The Orchestrator can then proceed.

---

# 62. AI Execution Authorization

Example:

```text
Allowed:
true

QualityTier:
Premium

UsageMeter:
AIRequest

Remaining:
73

Overage:
ConsumeCredits
```

The AI Orchestrator does not need to understand subscription pricing.

---

# 63. Commercial Boundary

The interaction should be:

```text
AI Orchestrator
      │
      │ "Can I execute this?"
      ▼
Entitlement / Commercial Boundary
      │
      │ Authorization Result
      ▼
AI Orchestrator
```

This is cleaner than embedding commercial rules inside AI.

---

# 64. UI Representation

The UI can display:

```text
AI Assistant

73 AI interactions remaining
```

rather than exposing:

```text
Provider Tokens
```

The UI receives a customer-oriented usage representation.

---

# 65. Upgrade Experience

If access is denied:

```text
AI Assistant
──────────────

You've reached your monthly AI allowance.

[Upgrade Plan]
[Buy AI Credits]
```

The exact options come from the commercial policy.

---

# 66. No Hard-Coded Upgrade Logic

The frontend must not assume:

```text
Limit reached
→ Upgrade Pro
```

Instead the backend returns available commercial actions.

Example:

```text
CommercialActions:
[
    BuyCredits,
    UpgradePlan
]
```

---

# 67. Commercial Actions

Potential actions:

```text
UpgradeSubscription
PurchaseAddon
PurchaseCredits
WaitForRenewal
RequestEnterpriseAccess
```

The Product Configuration Engine can determine which actions are available.

---

# 68. AI Packaging and Billing

The relationship is:

```text
Product Configuration
        ↓
Entitlement
        ↓
Usage
        ↓
Commercial Rating
        ↓
Billing
```

AI itself does not directly participate in financial settlement.

---

# 69. Recommended Initial Business Model

For the Platform's first release, the recommended model is:

```text
Core Platform Subscription
        +
AI included allowance
        +
Optional AI Credit Pack
```

This is preferable to exposing raw token billing to tutors or students.

---

# 70. Why Not Charge Per Token?

Raw token pricing is:

* Difficult for users to understand
* Different between models
* Different between providers
* Difficult to predict
* Vulnerable to provider pricing changes

Instead, customers should purchase understandable units such as:

```text
AI Requests
AI Credits
Transcription Minutes
Premium AI
```

The Platform can still internally track tokens.

---

# 71. Recommended Initial Free Strategy

The Platform can offer AI for free within a controlled allowance.

Example:

```text
Starter
50 AI operations / month
```

The customer sees:

```text
50 included AI operations
```

The Platform internally sees:

```text
Provider tokens
Model cost
AI infrastructure cost
```

This gives users a simple experience while allowing the business to understand actual AI economics.

---

# 72. When AI Should Become Paid

AI should become separately monetized when:

```text
AI Cost
+
AI Usage
+
Customer Value
```

justify a distinct commercial offering.

The architecture already supports that transition.

The Platform does not need to redesign the AI subsystem when monetization begins.

---

# 73. Initial Implementation Recommendation

Build the architecture with:

```text
Provider Abstraction
        +
Model Router
        +
AI Usage Metering
        +
Entitlement Integration
        +
Product Configuration
```

But initially expose:

```text
AI Included
```

rather than:

```text
Complex AI Pricing
```

This keeps the first release simple.

---

# 74. Evolution Path

### Phase 1

```text
Subscription
+
Included AI
```

### Phase 2

```text
Subscription
+
Included AI
+
Usage Limits
```

### Phase 3

```text
Subscription
+
Included AI
+
AI Credits
```

### Phase 4

```text
Subscription
+
AI Add-Ons
+
Premium AI
+
Credits
```

### Phase 5

```text
Subscription
+
Credits
+
Usage-Based
+
Enterprise Custom AI
```

The underlying AI architecture remains stable.

---

# 75. Complete Commercial AI Architecture

```text
                         ┌─────────────────────┐
                         │  Product Definition │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │ Product Configuration│
                         │       Engine         │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │ AI Capability       │
                         │ Packaging            │
                         └──────────┬──────────┘
                                    │
                    ┌───────────────┼────────────────┐
                    ▼               ▼                ▼
               Entitlement       Usage           Quality Tier
                    │               │                │
                    └───────────────┼────────────────┘
                                    ▼
                            AI Authorization
                                    │
                                    ▼
                            AI Orchestrator
                                    │
                                    ▼
                              Model Router
                                    │
                                    ▼
                              AI Provider
                                    │
                                    ▼
                             AI Execution
                                    │
                                    ▼
                              Usage Event
                                    │
                       ┌────────────┴─────────────┐
                       ▼                          ▼
                Customer Meter              Provider Cost
                       │                          │
                       ▼                          ▼
                 Commercial                   Cost Analytics
                    Rating
                       │
                       ▼
                    Billing
```

---

# 76. Architectural Invariants

### PACKAGING-001

AI capabilities must be independently packageable from their implementation.

### PACKAGING-002

Product Configuration determines commercial exposure of AI capabilities.

### PACKAGING-003

Entitlement determines whether execution is authorized.

### PACKAGING-004

Usage determines consumption.

### PACKAGING-005

Billing determines financial settlement.

### PACKAGING-006

Provider cost must remain separate from customer pricing.

### PACKAGING-007

AI Skills must not contain subscription or pricing logic.

### PACKAGING-008

Product configuration must not reference concrete AI provider models.

### PACKAGING-009

Quality tiers must resolve through the Model Router.

### PACKAGING-010

AI Credits must be managed through a commercial ledger.

### PACKAGING-011

Customer-facing AI units should be understandable business units.

### PACKAGING-012

Raw provider tokens remain an internal infrastructure metric unless explicitly commercialized.

### PACKAGING-013

Commercial configuration must be versioned and effective-dated.

### PACKAGING-014

AI availability and commercial entitlement must remain separate concepts.

### PACKAGING-015

The commercial architecture must support free, included, credit-based, usage-based, premium, and add-on AI without changing AI Skill implementations.

---

# 77. Final Decision

The Platform should **not make the AI Assistant inherently "free" or inherently "paid."**

Instead:

```text
AI Assistant
     ↓
AI Capability
     ↓
Product Configuration
     ↓
Commercial Packaging
```

This means the same AI capability can be:

```text
Free in one product
Included in another
Credit-based in another
Premium in another
Enterprise-custom in another
```

without changing the AI implementation.

The recommended initial commercial strategy is:

> **AI is included in the Platform subscription with controlled usage allowances, while the architecture is prepared from day one for AI Credits, Premium AI, Add-Ons, and usage-based monetization.**

---

# 78. Status

**Draft — Version 1.0**

## Next Document

The next document should be:

**`AICommercialIntegrationArchitecture.md`**

It will connect this packaging model directly to the already-established:

```text
Product Configuration Engine
        ↓
Licensing & Entitlement
        ↓
Usage & Metering
        ↓
Billing
        ↓
Commercial Domain Integration
```

and define the **actual runtime contracts and flows** between these bounded contexts.
