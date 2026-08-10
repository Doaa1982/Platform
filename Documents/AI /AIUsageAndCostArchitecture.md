# AIUsageAndCostArchitecture.md

**Version:** 1.0
**Status:** Draft
**Bounded Context:** AI Assistant / Commercial Integration
**Architectural Layer:** AI Usage, Metering & Cost
**Depends On:**

* `AIAssistantArchitecture.md`
* `AIOrchestrationArchitecture.md`
* `AIContextArchitecture.md`
* `AISkillArchitecture.md`
* `AIModelProviderArchitecture.md`
* `LicensingAndEntitlementArchitecture.md`
* `BillingArchitecture.md`
* `ProductConfigurationArchitecture.md`
* `CommercialDomainIntegrationArchitecture.md`

---

# 1. Purpose

This document defines how AI consumption is measured, recorded, attributed, controlled, and integrated with the Platform's commercial architecture.

The architecture must answer four different questions:

```text
1. Can the customer use this AI capability?
2. How much AI did the customer consume?
3. How much did the Platform pay the AI provider?
4. How much should the customer be charged?
```

These questions must remain separate.

---

# 2. Core Principle

The Platform must never treat:

```text
Provider Cost
```

as equivalent to:

```text
Customer Price
```

The correct architecture is:

```text
AI Execution
      │
      ▼
Provider Usage
      │
      ▼
Platform Usage Event
      │
      ▼
Usage Metering
      │
      ├───────────────┐
      ▼               ▼
Customer Usage     Cost Analytics
      │               │
      ▼               ▼
Entitlement       AI Infrastructure Cost
      │
      ▼
Commercial Pricing
      │
      ▼
Billing
```

---

# 3. Four Economic Dimensions

The Platform should explicitly model four dimensions.

```text
AI Economics
│
├── Entitlement
├── Usage
├── Provider Cost
└── Customer Charge
```

They are related but not interchangeable.

---

# 4. Entitlement

Entitlement answers:

> **Is this customer allowed to use the capability?**

Example:

```text
Student
 ↓
ExplainStudentAnswer
 ↓
Entitlement
 ↓
Allowed
```

Entitlement belongs to the Licensing & Entitlement architecture.

---

# 5. Usage

Usage answers:

> **How much of the capability was consumed?**

Examples:

```text
AI Requests
Input Tokens
Output Tokens
Audio Minutes
Generated Questions
AI Operations
```

Usage & Metering owns this information.

---

# 6. Provider Cost

Provider cost answers:

> **How much did execution cost the Platform?**

Example:

```text
Model
Input Tokens
Output Tokens
Provider Pricing
        ↓
Infrastructure Cost
```

This is an internal economic metric.

---

# 7. Customer Charge

Customer charge answers:

> **How much should the customer pay?**

This is determined by:

```text
Product Configuration
+
Entitlement
+
Pricing
+
Usage
+
Commercial Rules
```

Billing owns the financial transaction.

---

# 8. Never Collapse the Four Dimensions

For example:

```text
Customer uses:
10,000 AI tokens
```

does not mean:

```text
Customer pays for 10,000 tokens
```

The customer may instead have:

```text
Included AI usage
```

through their subscription.

---

# 9. AI Consumption Model

The Platform should support multiple consumption models.

```text
Consumption Models
│
├── Included Usage
├── Usage-Based
├── Credit-Based
├── Quota-Based
├── Feature-Based
└── Hybrid
```

---

# 10. Included Usage

Example:

```text
Tutor Plan
Includes:
1,000 AI requests / month
```

Usage is measured but may not generate an additional charge.

```text
Usage
 ↓
Included Allowance
 ↓
No Additional Charge
```

---

# 11. Usage-Based

Example:

```text
AI Usage:
10,000 tokens

Price:
$X per usage unit
```

The commercial system determines the resulting charge.

---

# 12. Credit-Based

The Platform may expose AI Credits.

Example:

```text
Customer
 ↓
100 AI Credits
 ↓
AI Skill
 ↓
Consumes Credits
```

The mapping between:

```text
AI Credit
```

and:

```text
Provider Token
```

should not be hard-coded.

---

# 13. Why Credits Should Be Abstract

Different AI operations have radically different costs.

For example:

```text
ExplainAnswer
```

may consume a small amount.

While:

```text
TranscribeVideo
```

may process a long recording.

Therefore:

```text
1 AI Credit
```

should be a commercial unit rather than a direct synonym for:

```text
1 Token
```

---

# 14. Quota-Based

A plan may define:

```text
100 AI requests / month
```

or:

```text
300 transcription minutes / month
```

The Usage system tracks consumption against the quota.

---

# 15. Feature-Based

Some plans may simply include or exclude Skills.

Example:

```text
Basic
    GenerateLesson = Included
    GenerateQuestions = Included
    VideoTranscription = Not Included

Premium
    GenerateLesson = Included
    GenerateQuestions = Included
    VideoTranscription = Included
```

No token-level customer billing is required.

---

# 16. Hybrid Commercial Model

The recommended architecture supports combinations.

Example:

```text
Subscription
    +
Included AI Usage
    +
Optional AI Credit Pack
    +
Overage
```

This gives the commercial architecture flexibility.

---

# 17. AI Usage Event

Every billable or metered AI execution should produce a normalized Usage Event.

Conceptually:

```text
AIUsageEvent
│
├── UsageEventId
├── OperationId
├── SkillId
├── SkillVersion
├── WorkspaceId
├── ActorId
├── ProductId
├── Timestamp
├── UsageDimensions
├── ProviderUsage
└── CostMetadata
```

---

# 18. Usage Dimensions

A Usage Event may contain:

```text
UsageDimensions
│
├── AIRequestCount
├── InputTokens
├── OutputTokens
├── TotalTokens
├── AudioSeconds
├── VideoSeconds
├── GeneratedItems
└── ProcessingUnits
```

Not every Skill uses every dimension.

---

# 19. Example: ExplainStudentAnswer

```text
Skill:
ExplainStudentAnswer

Usage:
AIRequestCount = 1
InputTokens = 1,200
OutputTokens = 450
TotalTokens = 1,650
```

This becomes a Usage Event.

---

# 20. Example: TranscribeVideo

```text
Skill:
TranscribeVideo

Usage:
AIRequestCount = 1
AudioMinutes = 42
```

The primary customer usage dimension may be:

```text
AudioMinutes
```

rather than tokens.

---

# 21. Example: GenerateQuestions

```text
Skill:
GenerateQuestions

Usage:
AIRequestCount = 1
GeneratedQuestions = 10
InputTokens = ...
OutputTokens = ...
```

The Platform may track all of these dimensions even if only one is used commercially.

---

# 22. Provider Usage

Provider adapters return provider-specific usage.

The AI infrastructure normalizes it:

```text
Provider Usage
      ↓
Usage Normalizer
      ↓
Normalized Provider Usage
```

Example:

```text
Provider:
prompt_tokens
completion_tokens
```

becomes:

```text
InputTokens
OutputTokens
```

---

# 23. Customer Usage vs Provider Usage

A Skill may produce:

```text
Customer Usage:
1 GenerateLesson
```

while internally producing:

```text
Provider Usage:
3 model calls
```

Both should be retained.

---

# 24. Why This Separation Matters

Suppose:

```text
GenerateLessonFromVideo
```

internally performs:

```text
Transcription
+
Topic Extraction
+
Lesson Generation
+
Question Generation
```

Customer-facing usage might be:

```text
1 GenerateLessonFromVideo
```

while infrastructure usage is:

```text
4 AI executions
```

This allows the commercial model to remain understandable.

---

# 25. Usage Hierarchy

AI usage should support parent-child relationships.

```text
AI Operation
│
├── Child Operation
├── Child Operation
├── Child Operation
└── Child Operation
```

Example:

```text
GenerateLessonFromVideo
│
├── TranscribeVideo
├── ExtractTopics
├── GenerateLesson
└── GenerateQuestions
```

---

# 26. Usage Attribution

Usage should be attributable to:

```text
Workspace
Actor
Product
Skill
Operation
```

Where applicable.

This enables reporting such as:

```text
Workspace AI usage
Tutor AI usage
Student AI usage
Skill usage
Product usage
```

---

# 27. Workspace Attribution

Every customer AI Usage Event should have a Workspace boundary.

Example:

```text
WorkspaceId:
WS-123
```

This is essential for multi-tenant reporting and isolation.

---

# 28. Actor Attribution

Where appropriate:

```text
ActorId
ActorType
```

should identify who initiated the operation.

Example:

```text
ActorType:
Tutor
```

or:

```text
ActorType:
Student
```

---

# 29. System-Initiated Usage

Some AI operations may be triggered automatically.

Example:

```text
Lesson Published
 ↓
Generate Search Embeddings
```

The usage event should identify:

```text
ActorType:
System
```

rather than incorrectly attributing it to a human user.

---

# 30. Product Attribution

AI usage should be attributable to the Learning Product that generated it when applicable.

Example:

```text
Workspace
    ↓
Learning Product
    ↓
AI Skill
```

This allows commercial analytics to understand which products consume AI resources.

---

# 31. Usage Lifecycle

The lifecycle is:

```text
Requested
    ↓
Reserved
    ↓
Executing
    ↓
Measured
    ↓
Recorded
    ↓
Rated
    ↓
Commercialized
```

Not every usage event must pass through every state synchronously.

---

# 32. Usage Reservation

For operations with uncertain or large consumption, the Platform may reserve usage before execution.

Example:

```text
Transcribe 90-minute video
        ↓
Reserve allowance
        ↓
Execute
        ↓
Actual usage
        ↓
Reconcile
```

---

# 33. Why Reservation Is Important

Without reservation:

```text
Customer has 10 minutes remaining
        ↓
Starts 60-minute transcription
        ↓
Consumes beyond allowance
```

Reservation allows the Platform to prevent uncontrolled usage.

---

# 34. Reservation vs Actual Usage

These are different.

```text
Reserved Usage
```

is a temporary hold.

```text
Actual Usage
```

is the measured consumption after execution.

The final usage system must reconcile:

```text
Reserved
-
Actual
=
Released Amount
```

where applicable.

---

# 35. Usage Enforcement

Usage enforcement should occur before expensive execution.

```text
Request
 ↓
Entitlement
 ↓
Usage Availability
 ↓
Reservation
 ↓
Execution
```

This avoids spending provider money on requests that cannot be fulfilled commercially.

---

# 36. Usage Limit Exceeded

Possible result:

```text
USAGE_LIMIT_REACHED
```

The UI can then present a commercial action such as:

```text
Upgrade Plan
Buy AI Credits
Wait Until Renewal
```

The AI Skill itself should not decide which commercial action to offer.

---

# 37. Commercial Decision

The commercial architecture decides:

```text
Usage Limit Reached
        ↓
Commercial Policy
        ↓
Allowed Actions
```

Possible actions:

```text
Block
Allow Overage
Consume Credits
Upgrade
```

---

# 38. Included Allowance

A plan may define:

```text
Monthly AI Requests:
1,000
```

The usage engine tracks:

```text
Used:
742

Remaining:
258
```

The entitlement layer determines whether the Skill is included.

---

# 39. Renewal

At the beginning of a new billing period:

```text
Allowance
 ↓
Reset / Renew
```

Historical usage must not be deleted.

The Platform should preserve:

```text
Period 1 Usage
Period 2 Usage
Period 3 Usage
```

---

# 40. Usage Period

Every usage event should be attributable to a commercial period where applicable.

Example:

```text
BillingPeriodId
```

or equivalent commercial period reference.

This allows usage to be rated correctly.

---

# 41. Usage Rating

Usage Rating converts raw usage into a commercial measurement.

Example:

```text
Raw Usage:
1,650 tokens

Commercial Meter:
AI Request

Rated Usage:
1 AI Request
```

Or:

```text
Raw Usage:
42 audio minutes

Commercial Meter:
Transcription Minutes

Rated Usage:
42 minutes
```

---

# 42. Rating Must Be Configurable

The mapping:

```text
Skill
→ Usage Dimension
→ Commercial Unit
```

should be configuration-driven where possible.

This avoids hard-coding pricing into AI Skills.

---

# 43. Example Rating Configuration

Conceptually:

```text
GenerateQuestions
    Meter = AIRequest

TranscribeVideo
    Meter = TranscriptionMinute

GenerateLessonFromVideo
    Meter = AIContentGeneration
```

The exact pricing remains outside the AI Skill.

---

# 44. AI Credits

If the Platform introduces AI Credits:

```text
AI Usage
 ↓
Commercial Meter
 ↓
Credit Conversion
 ↓
Credit Balance
```

Example:

```text
GenerateLesson
→ 5 AI Credits
```

The Skill does not directly deduct credits.

The commercial usage system performs the deduction.

---

# 45. Credit Ledger

AI Credits should use a ledger rather than only a mutable balance.

Conceptually:

```text
CreditLedger
│
├── CreditPurchase
├── CreditGrant
├── CreditConsumption
├── CreditRefund
└── CreditExpiration
```

The balance is derived from ledger activity.

---

# 46. Credit Refund

If an AI operation fails before meaningful execution:

```text
Reserved Credits
 ↓
Failure
 ↓
Release / Refund
```

The exact rule depends on whether provider consumption occurred.

---

# 47. Partial Failure

Example:

```text
GenerateLessonFromVideo
```

starts transcription successfully but lesson generation fails.

The Platform should preserve the actual provider usage.

It should not pretend the operation consumed zero resources.

---

# 48. Provider Cost Calculation

Provider cost can be calculated from:

```text
Provider
+
Model
+
Usage
+
Provider Pricing Version
```

Example:

```text
Input Tokens × Input Rate
+
Output Tokens × Output Rate
```

The actual formula belongs to the infrastructure cost subsystem.

---

# 49. Provider Pricing Version

Provider pricing can change.

Therefore cost records should identify the pricing version used.

Example:

```text
ProviderPricingVersion:
2026-08
```

This allows historical cost reporting to remain accurate.

---

# 50. Cost Is Not Billing

This distinction must be explicit.

```text
Provider Cost:
What Platform pays

Customer Charge:
What Customer pays
```

The two values may be:

```text
Equal
Different
Zero
Included
Discounted
Marked Up
```

---

# 51. Gross Margin

The Platform can later calculate:

```text
Customer Revenue
-
AI Provider Cost
=
AI Gross Margin
```

This is an analytics concern.

It should not be part of the Skill execution path.

---

# 52. AI Cost Allocation

Infrastructure cost may be allocated by:

```text
Workspace
Product
Skill
Model
Provider
Actor Type
```

This enables internal reporting.

Example:

```text
Tutor AI Cost
Student AI Cost
Video AI Cost
Assessment AI Cost
```

---

# 53. Cost Attribution

Provider cost records should reference:

```text
OperationId
ProviderId
ModelId
SkillId
UsageEventId
```

This allows infrastructure cost to be traced back to AI operations.

---

# 54. Usage Event Immutability

Once finalized, usage events should be treated as immutable facts.

If correction is required:

```text
Original Event
+
Correction / Adjustment Event
```

rather than silently changing history.

---

# 55. Usage Adjustment

Possible reasons:

```text
Provider Correction
Duplicate Event
Failed Execution
Refund
Manual Administrative Correction
```

Adjustments should be auditable.

---

# 56. Billing Integration

The AI Usage subsystem should not create invoices directly.

Instead:

```text
AI Usage
 ↓
Commercial Meter
 ↓
Rated Usage
 ↓
Billing
```

Billing decides how rated usage becomes a financial charge.

---

# 57. Invoice Integration

For usage-based billing:

```text
Usage
 ↓
Rated Usage
 ↓
Invoice Line
```

The invoice should reference the commercial usage/rating rather than the raw provider request.

---

# 58. Example

Provider execution:

```text
1 request
8,000 input tokens
2,000 output tokens
```

Customer plan:

```text
Included:
100 AI requests
```

Customer has used:

```text
72 requests
```

Result:

```text
Usage:
73 / 100

Customer Charge:
0
```

But infrastructure cost still exists:

```text
Provider Cost:
$X
```

---

# 59. Example With Overage

Customer has:

```text
100 included requests
```

Usage becomes:

```text
105 requests
```

Commercial policy may define:

```text
First 100:
Included

Next 5:
Overage
```

The customer charge is determined by the commercial configuration.

---

# 60. Example With AI Credits

Customer has:

```text
20 AI Credits
```

Skill consumes:

```text
5 AI Credits
```

Result:

```text
Remaining:
15
```

Provider token consumption is tracked independently.

---

# 61. Example With Subscription

Subscription:

```text
Premium
```

Entitlement:

```text
GenerateLesson = Allowed
```

Usage:

```text
23 generations
```

Commercial policy:

```text
Included
```

Billing:

```text
No additional charge
```

---

# 62. Example: Student AI

Student uses:

```text
ExplainStudentAnswer
```

The platform may define:

```text
Student AI:
Included in Tutor Workspace
```

The student consumes usage.

The tutor's commercial subscription may absorb the cost.

This is why:

```text
Actor
```

and:

```text
Bill-To Party
```

must remain separate concepts.

---

# 63. Bill-To Party

The user initiating an AI operation is not necessarily the party paying for it.

Example:

```text
Student
   ↓
Uses AI
   ↓
Tutor Workspace
   ↓
Workspace Subscription
   ↓
Pays
```

The usage system must therefore support commercial attribution separately from actor attribution.

---

# 64. Commercial Ownership

Potential relationships:

```text
Actor
Workspace
Product
Subscription
Bill-To Account
```

An AI Usage Event may reference the relevant commercial context.

---

# 65. Usage Ownership

The Platform should distinguish:

```text
Usage Actor
```

from:

```text
Usage Owner
```

and:

```text
Bill-To Account
```

Example:

```text
Actor:
Student

Usage Owner:
Tutor Workspace

Bill-To:
Workspace Subscription
```

---

# 66. AI Usage Dashboard

The platform should eventually expose usage information.

Tutor may see:

```text
AI Usage
──────────────
Lesson Generation     18
Question Generation   42
Student Assistance   93
Transcription         67 min
```

The exact visibility depends on authorization.

---

# 67. Student Usage Visibility

Students should only see usage information relevant to their experience.

For example:

```text
AI Assistance Used:
12 interactions
```

rather than:

```text
Provider:
Model X
Input Tokens:
12,473
Provider Cost:
$0.42
```

unless the product explicitly exposes technical usage.

---

# 68. Administrative Usage

Administrators may see:

```text
Provider Cost
Customer Usage
Margin
Model Distribution
Skill Distribution
Workspace Cost
```

This is an administrative analytics capability.

---

# 69. Usage Alerts

The Platform should support thresholds.

Examples:

```text
80% allowance used
90% allowance used
100% allowance used
Unexpected usage spike
```

Alerts can be sent to authorized Workspace users.

---

# 70. Abuse Detection

Usage anomalies may indicate:

```text
Automation
Misuse
Unexpected Integration
Compromised Account
Bug
```

The Platform should support anomaly detection independently from normal quota enforcement.

---

# 71. Rate Limiting

Rate limiting protects infrastructure.

Example:

```text
100 AI requests / minute
```

This is different from:

```text
1,000 AI requests / month
```

The first is infrastructure protection.

The second is commercial entitlement.

---

# 72. Three Types of Limits

The architecture should distinguish:

```text
Technical Limit
Commercial Limit
Provider Limit
```

### Technical

Protects Platform infrastructure.

### Commercial

Protects product entitlements.

### Provider

Protects provider quota.

---

# 73. Limit Enforcement

```text
Request
 │
 ├── Technical Rate Limit
 │
 ├── Entitlement
 │
 ├── Commercial Usage Limit
 │
 └── Provider Availability
 │
 ▼
Execution
```

---

# 74. Usage Reservation Flow

Recommended flow:

```text
User Request
     ↓
Resolve Skill
     ↓
Check Entitlement
     ↓
Check Technical Limits
     ↓
Estimate Usage
     ↓
Reserve Commercial Usage
     ↓
Execute AI
     ↓
Measure Actual Usage
     ↓
Finalize Usage
     ↓
Release Difference
```

---

# 75. Usage Finalization

After execution:

```text
Provider Response
      ↓
Usage Extraction
      ↓
Usage Normalization
      ↓
Usage Event
      ↓
Commercial Meter
      ↓
Finalize Reservation
```

---

# 76. Failure Flow

If provider execution fails:

```text
Execution Failure
      ↓
Determine Actual Provider Usage
      ↓
Finalize / Refund Reservation
      ↓
Record Failure
```

This prevents accounting inconsistencies.

---

# 77. Idempotency

Usage recording must be idempotent.

If the same provider response is processed twice:

```text
UsageEventId
```

or:

```text
OperationId + ExecutionId
```

must prevent duplicate consumption.

---

# 78. Exactly-Once vs At-Least-Once

Distributed systems may deliver events more than once.

Therefore the Usage system should assume:

```text
At-Least-Once Delivery
```

and implement idempotent consumption.

---

# 79. Event Architecture

The AI execution layer may publish:

```text
AIExecutionCompleted
AIExecutionFailed
AIUsageMeasured
```

The Usage & Metering subsystem consumes the relevant events.

---

# 80. Recommended Event

A normalized event could conceptually contain:

```text
AIUsageRecorded
{
    UsageEventId,
    OperationId,
    SkillId,
    WorkspaceId,
    ActorId,
    UsageDimensions,
    ProviderUsage,
    Timestamp
}
```

---

# 81. Event Ownership

The AI domain produces:

```text
AI Execution Fact
```

Usage & Metering owns:

```text
Usage Measurement
```

Commercial owns:

```text
Rating / Entitlement Interpretation
```

Billing owns:

```text
Financial Charge
```

---

# 82. Bounded Context Separation

The architecture should therefore remain:

```text
AI Assistant
     │
     │ AI execution
     ▼
Usage & Metering
     │
     │ rated usage
     ▼
Commercial
     │
     │ financial instruction
     ▼
Billing
```

---

# 83. AI Does Not Own Billing

AI Skills must never contain:

```text
CreateInvoice()
ChargeCustomer()
ApplySubscriptionPrice()
```

Instead:

```text
AI
 ↓
Usage Event
```

and the commercial architecture takes over.

---

# 84. AI Does Not Own Entitlement

Likewise:

```text
AI Skill
```

does not decide:

```text
Premium user?
```

It asks the entitlement boundary.

---

# 85. Usage Does Not Own Pricing

Usage records:

```text
What happened?
```

Commercial pricing determines:

```text
What does it mean financially?
```

This separation allows pricing to evolve independently.

---

# 86. Pricing Example

The same Skill:

```text
GenerateQuestions
```

could be:

```text
Basic Plan:
Included

Premium Plan:
Included with larger quota

Enterprise:
Unlimited within fair-use policy
```

The Skill implementation does not change.

---

# 87. Future Commercial Models

The architecture supports future models such as:

```text
AI Included
AI Credits
AI Add-On
AI Overage
AI Premium Models
AI Pay-As-You-Go
AI Fair Use
```

without changing the core AI Skill architecture.

---

# 88. Premium AI Models

A future product may offer:

```text
Standard AI
Premium AI
```

This should be modeled commercially as a capability or quality tier.

Example:

```text
AI Quality Tier:
Standard

AI Quality Tier:
Premium
```

The Model Router maps that policy to eligible models.

---

# 89. Premium Model Usage

The customer should not need to know:

```text
Provider Model X
```

The customer buys:

```text
Premium AI
```

The infrastructure determines which model fulfills that entitlement.

---

# 90. AI Cost Optimization

The Model Router and Usage system can cooperate to optimize cost.

Example:

```text
Simple Skill
 ↓
Fast Model
 ↓
Lower Provider Cost
```

while:

```text
Complex Skill
 ↓
High Quality Model
```

This improves platform economics without changing the customer-facing capability.

---

# 91. Cost Guardrails

The Platform should support infrastructure guardrails such as:

```text
Maximum Provider Cost / Operation
Maximum Token Budget
Maximum Audio Duration
Maximum Model Calls
```

These are technical protections.

They are not customer pricing rules.

---

# 92. AI Budget

The Platform may maintain an internal AI infrastructure budget.

Example:

```text
Workspace:
Monthly AI Infrastructure Budget
```

This is useful for controlling unexpected spend.

However, such budgets must be clearly distinguished from customer quotas.

---

# 93. Cost Anomaly Detection

The Platform should detect:

```text
Sudden Token Increase
Unexpected Model Selection
Provider Cost Spike
Unusual Workspace Usage
Unexpected Composite Skill Expansion
```

This can protect platform margins.

---

# 94. AI Cost Reporting

Administrative reporting should support:

```text
Total AI Cost
Cost by Provider
Cost by Model
Cost by Skill
Cost by Workspace
Cost by Product
Cost by Period
```

---

# 95. AI Revenue Reporting

Commercial reporting may support:

```text
AI Revenue
AI Usage
AI Cost
AI Margin
```

This allows product decisions such as:

```text
Should this AI capability be included in the plan?
Should it become an add-on?
Should usage limits change?
```

---

# 96. Recommended MVP Commercial Model

For the initial Platform implementation, avoid exposing complex token pricing to customers.

Recommended:

```text
Subscription
    +
Included AI Allowance
    +
Optional AI Add-On / Credits
```

Internally:

```text
Measure:
Requests
Tokens
Audio Minutes
Provider Cost
```

Externally:

```text
Show:
Included Usage
Remaining Usage
Optional Upgrade / Add-On
```

This keeps the customer experience understandable while preserving accurate internal economics.

---

# 97. Recommended Initial Meter Set

The first version should support:

```text
AIRequest
AITokens
TranscriptionMinutes
GeneratedItems
```

The system should be extensible for future dimensions.

---

# 98. Recommended Initial Skills and Meters

| Skill                   | Primary Meter          |
| ----------------------- | ---------------------- |
| GenerateLesson          | AI Request             |
| GenerateQuestions       | AI Request             |
| ExplainLesson           | AI Request             |
| ExplainStudentAnswer    | AI Request             |
| TranscribeVideo         | Transcription Minutes  |
| GenerateLessonFromVideo | Composite AI Operation |

Provider tokens should be measured internally for every applicable Skill.

---

# 99. Complete Commercial Flow

The complete architecture becomes:

```text
                       User
                        │
                        ▼
                  AI Assistant
                        │
                        ▼
                     Skill
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
     Entitlement     Context       Usage
          │             │             │
          └─────────────┼─────────────┘
                        │
                        ▼
                  AI Orchestrator
                        │
                        ▼
                   AI Gateway
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
                 Provider Usage
                        │
                        ▼
               Usage Normalizer
                        │
                        ▼
                 Usage Event
                        │
             ┌──────────┴──────────┐
             ▼                     ▼
      Customer Meter          Cost Analytics
             │                     │
             ▼                     ▼
       Commercial             Provider Cost
          Rating                    │
             │                      │
             ▼                      │
          Billing ◄────────────────┘
```

---

# 100. Architectural Invariants

### USAGE-001

Every applicable AI execution must produce measurable usage.

### USAGE-002

Usage must be attributable to a Workspace.

### USAGE-003

Usage actor and bill-to party must be independently representable.

### USAGE-004

Provider usage and customer usage must remain separate.

### USAGE-005

Provider cost must not automatically determine customer price.

### USAGE-006

AI Skills must not directly create invoices or charges.

### USAGE-007

AI Skills must not directly manage subscription balances.

### USAGE-008

Usage recording must be idempotent.

### USAGE-009

Usage reservations must be reconciled with actual consumption.

### USAGE-010

Commercial limits must be distinct from technical rate limits.

### USAGE-011

Historical usage must remain auditable.

### USAGE-012

Usage corrections should be represented as adjustments rather than silent mutation.

### USAGE-013

Composite Skills must preserve parent-child usage relationships.

### USAGE-014

Provider pricing changes must not rewrite historical customer usage.

### USAGE-015

Customer pricing must remain configurable independently from AI implementation.

---

# 101. Final Architecture Principle

The most important commercial principle is:

```text
AI execution
≠
AI usage
≠
AI cost
≠
Customer price
```

Instead:

```text
AI execution
      ↓
AI usage
      ↓
Commercial interpretation
      ↓
Customer charge
```

while simultaneously:

```text
AI execution
      ↓
Provider usage
      ↓
Provider cost
      ↓
Platform economics
```

This gives the Platform the ability to offer AI as:

```text
Included
Subscription-based
Credit-based
Usage-based
Premium
Add-on
```

without changing the underlying AI Skills or provider architecture.

---

# 102. Status

**Draft — Version 1.0**

The AI architecture is now connected to the commercial architecture.

The next document should be:

**`AIProductPackagingArchitecture.md`**

That document should answer the remaining product/business question: **how AI becomes an actual product capability that can be packaged into Tutor Plans, Learning Products, AI Add-ons, AI Credits, Premium AI tiers, or included features—and how the Product Configuration Engine, Entitlement, Usage, and Billing work together to make that configurable rather than hard-coded.**
