# AICommercialIntegrationArchitecture.md

**Version:** 1.0
**Status:** Draft
**Bounded Context:** Cross-Context Integration
**Parent Domain:** Commercial Domain + AI Platform
**Purpose:** Define the runtime and lifecycle integration between AI capabilities and the Platform's commercial architecture.

---

# 1. Purpose

The AI Commercial Integration Architecture defines how the AI subsystem interacts with:

* Product Configuration
* Subscription Management
* Licensing & Entitlements
* Usage & Metering
* Billing
* Promotion & Discounts
* Product Advisory
* Learning Workspace

The architecture answers:

> **How does an AI capability become commercially available to a Workspace, how is its consumption authorized and measured, and how does that consumption participate in the commercial lifecycle?**

The architecture must ensure that AI remains a reusable platform capability rather than becoming tightly coupled to subscription plans, pricing, invoices, or payment processing.

**Document boundary:** this document owns the *commercial state* an AI request moves through — how a capability becomes entitled, how consumption is rated, and how that consumption participates in billing. It does not own how a request is technically executed once authorized; that is `AICommercialRuntimeArchitecture.md`'s concern. Where this document needs to reference the execution pipeline, it points to that document rather than redrawing it.

---

# 2. Architectural Principle

The central principle is that commercial state and execution are separate concerns, evaluated in order:

```text
Commercial State (this document)   →   Execution (AICommercialRuntimeArchitecture.md)
Product Configuration → Subscription → Entitlement → Authorization   →   Orchestration → Skill → Model → Provider → Response
```

The full commercial-state lifecycle is defined in §5. The full technical execution pipeline is defined in `AICommercialRuntimeArchitecture.md` §5 (Request Lifecycle) and §100 (Runtime Architecture Summary). Each document owns exactly one of the two halves shown above; neither restates the other's internals.

---

# 3. Source of Truth

The Platform must maintain one authoritative owner for every concern.

| Concern                     | Source of Truth                           |
| --------------------------- | ----------------------------------------- |
| AI capability definition    | AI Domain                                 |
| AI Skill implementation     | AI Domain                                 |
| AI model/provider selection | AI Infrastructure                         |
| Product definition          | Commercial Product Management             |
| Product configuration       | Product Configuration                     |
| Subscription                | Subscription Management                   |
| Runtime authorization       | Licensing & Entitlements                  |
| Actual consumption          | Usage & Metering                          |
| Price calculation           | Product Configuration / Pricing           |
| Invoice                     | Billing                                   |
| Payment processing          | **External — not owned by this Platform** |
| Customer recommendations    | Product Advisory                          |
| Workspace experience        | Learning Workspace                        |

The Platform must never create a second source of truth for any of these concerns.

---

# 4. Critical Separation

The following concepts must never be collapsed:

```text
Product
Subscription
License
Entitlement
Usage
Provider Cost
Invoice
Payment
```

For example:

```text
Subscription:
Solo AI+

License:
Active

Entitlement:
AI Lesson Generation = Enabled

Allowance:
75,000 AI Credits

Usage:
42,380 AI Credits

Provider Cost:
$X

Invoice:
$Y

Payment:
External / manually confirmed
```

These are different facts.

---

# 5. Commercial AI Lifecycle

The complete lifecycle is:

```text
Product Definition
        ↓
Product Configuration
        ↓
Configuration Snapshot
        ↓
Subscription
        ↓
Workspace License
        ↓
Effective Entitlements
        ↓
AI Authorization
        ↓
AI Execution
        ↓
Usage Event
        ↓
Usage Aggregation
        ↓
Commercial Rating
        ↓
Billing
```

This lifecycle must remain decoupled.

---

# 6. Product Configuration Integration

The Product Configuration Engine determines how AI is packaged commercially.

The existing configuration model already includes:

```text
Base Product
Capability Profiles
Capability Packs
Capacity
Usage Policies
AI Policies
Support
Pricing
```

AI therefore participates as a configurable commercial capability rather than as a special subscription mechanism.

---

# 7. AI Configuration

A configuration may contain:

```text
AI Policies
│
├── AI Capability
├── AI Assistance Level
├── AI Quality Tier
├── AI Usage Allowance
├── AI Credit Package
├── AI Overage Policy
└── AI Add-On
```

Example:

```text
Product:
Solo AI+

AI:
Enabled

Learning AI:
AI+

Assessment AI:
AI+

AI Credits:
75,000 / month
```

---

# 8. Configuration Engine Responsibility

The Product Configuration Engine determines:

1. Whether the selected AI configuration is valid.
2. Which dependencies are required.
3. Which entitlements result.
4. Which usage allowances result.
5. What price is calculated.
6. What configuration snapshot is produced.

It does **not** authorize runtime AI execution.

Runtime authorization belongs to Licensing & Entitlements.

---

# 9. Configuration Result

The configuration result may contain:

```text
ConfigurationResult
│
├── ResolvedConfiguration
├── Entitlements
├── UsagePolicies
├── PriceBreakdown
├── Recommendations
└── ConfigurationVersion
```

The entitlement set becomes the basis for the Workspace License.

This follows the established Product Configuration → Subscription → License architecture.

---

# 10. Configuration Snapshot

When a configuration becomes commercially committed, the Platform creates an immutable Configuration Snapshot.

Example:

```text
Configuration Snapshot
----------------------

Product:
Solo AI+

Learning:
AI+

Assessment:
AI+

AI Credits:
75,000 / month

AI Quality:
Standard

Billing Cycle:
Monthly
```

The Workspace License references this snapshot.

This allows the Platform to reconstruct why the Workspace received its AI entitlements.

---

# 11. Subscription Integration

The Product Configuration Engine does not create runtime authorization.

The lifecycle is:

```text
Configuration Engine
        ↓
Validated Configuration
        ↓
Subscription Management
        ↓
Subscription
        ↓
Licensing & Entitlements
```

The Product Configuration Engine's established responsibility ends with the validated commercial configuration.

---

# 12. Subscription Events

AI commercial availability can change when Subscription state changes.

Examples:

```text
SubscriptionCreated
SubscriptionActivated
SubscriptionChanged
SubscriptionRenewed
SubscriptionCancelled
SubscriptionExpired
SubscriptionSuspended
```

Licensing consumes the relevant subscription state and recalculates the Workspace License.

---

# 13. License Integration

Licensing is the runtime commercial authority.

The existing architecture explicitly defines the License as the commercial authorization record for the Workspace and the Entitlement as an individual right, level, or allowance.

Example:

```text
Workspace License
│
├── Learning = AI+
├── Assessment = AI+
├── AI Credits = 75,000
└── AI Assistant = Enabled
```

---

# 14. Effective Entitlement Resolution

The established resolution pipeline is:

```text
1. Load Configuration Snapshot
2. Resolve Capability Profiles
3. Resolve AI Assistance Levels
4. Resolve Capacity
5. Resolve Usage Allowances
6. Apply Entitlement Overrides
7. Apply License State Policy
8. Publish Effective Entitlement Set
```

This is authoritative and must not be duplicated inside AI or Learning Workspace code.

---

# 15. AI Entitlement Types

AI-related entitlements may include:

```text
AI Capability
AI Assistance Level
AI Quality Tier
AI Usage Allowance
AI Credit Allowance
AI Model Tier
AI Feature
```

Example:

```text
AI Lesson Generation:
Enabled

AI Assistance:
AI+

AI Credits:
75,000

AI Quality:
Premium
```

---

# 16. Entitlement Source Attribution

Every effective entitlement must retain its determining source.

The established precedence is:

```text
1. Manual Override
2. Promotional Grant
3. Capacity / Pack Add-on
4. Base Product
```

This precedence is approved in the current Licensing architecture.

Therefore:

```text
Base Product:
AI Credits = 50,000

AI Pack:
+25,000

Promotion:
+10,000

Override:
+5,000
```

may result in a resolved allowance with each contribution remaining attributable.

---

# 17. AI Entitlement Check

The AI runtime must never inspect the subscription plan directly.

Incorrect:

```text
if plan == "Solo AI+"
```

Correct:

```text
HasEntitlement(
    workspace,
    "AI.LessonGeneration"
)
```

The established Licensing contract is:

```text
HasEntitlement(workspace, capability, level?)
```

and the Workspace must not query plan names.

---

# 18. Runtime Authorization

The AI request flow becomes:

```text
AI Request
    ↓
Identify Workspace
    ↓
Identify Actor
    ↓
Identify AI Capability
    ↓
HasEntitlement()
    ↓
Check Usage Availability
    ↓
Reserve Usage
    ↓
Execute AI
```

Authorization happens before expensive provider execution.

---

# 19. AI Does Not Resolve Entitlements

The AI subsystem should request an authorization decision.

Conceptually:

```text
AI Orchestrator
        │
        │ Authorize AI Capability
        ▼
Licensing
        │
        │ Allowed / Denied
        ▼
AI Orchestrator
```

The AI subsystem must not recreate entitlement resolution.

---

# 20. AI Authorization Result

A useful conceptual response is:

```text
AIAuthorizationResult
│
├── Allowed
├── Capability
├── QualityTier
├── UsageMeter
├── RemainingAllowance
├── UsagePolicy
└── CommercialContext
```

Example:

```text
Allowed:
true

Capability:
GenerateLesson

QualityTier:
Standard

Meter:
AICredits

Remaining:
32,620

Policy:
BlockOnExhaustion
```

---

# 21. Usage Integration

Once AI execution is authorized, Usage & Metering becomes responsible for recording actual consumption.

The established separation is:

```text
Product Configuration
"What did the customer choose?"

Subscription
"What commercial relationship is active?"

Licensing
"What can the customer use?"

Usage & Metering
"What did the customer actually consume?"
```

This separation is fundamental to the architecture.

---

# 22. Usage Reservation

For AI operations with predictable or estimable consumption:

```text
AI Request
    ↓
Estimate Usage
    ↓
Reserve Usage
    ↓
Execute
```

The Usage & Metering model explicitly separates `UsageReservation` from `UsageEvent` because a reservation represents intent to consume, while an event represents actual consumption.

---

# 23. Usage Reservation Example

Suppose:

```text
Remaining:
5,000 AI Credits
```

The requested operation estimates:

```text
1,500 AI Credits
```

The system reserves:

```text
1,500
```

Remaining available capacity becomes effectively:

```text
3,500
```

The AI operation may now execute.

---

# 24. Actual Usage

After execution:

```text
Estimated:
1,500

Actual:
1,320
```

The Platform records:

```text
Actual Usage:
1,320
```

and releases:

```text
180
```

from the reservation.

---

# 25. Over-Consumption

If:

```text
Estimated:
1,500

Actual:
1,900
```

the system must reconcile the additional:

```text
400
```

according to the commercial usage policy.

Possible outcomes:

```text
Allowed
Overage
Credit Consumption
Blocked
Adjustment Required
```

---

# 26. Usage Event

The normalized AI Usage Event should contain sufficient attribution to support commercial reporting.

Conceptually:

```text
AIUsageEvent
│
├── UsageEventId
├── WorkspaceId
├── SubscriptionId
├── ActorId
├── ActorType
├── Capability
├── Skill
├── OperationId
├── MeterId
├── Quantity
├── RawProviderUsage
├── Provider
├── Model
├── MeterVersion
├── Timestamp
└── CorrelationId
```

## The existing Usage architecture requires attribution, raw provider usage, normalization, correlation, and historical auditability.

# 27. Composite AI Operations

One AI request may execute multiple internal operations.

Example:

```text
GenerateLessonFromVideo
│
├── Transcription
├── Topic Extraction
├── Lesson Generation
└── Question Generation
```

The commercial system may expose:

```text
1 GenerateLessonFromVideo
```

while Usage & Metering records the child operations.

The existing Usage architecture already supports parent-child usage relationships.

---

# 28. Usage Attribution

Every AI operation must be attributable to:

```text
Workspace
Actor
Capability
Operation
Subscription
```

Where applicable:

```text
Tutor
Student
System
AI Agent
```

The Usage Data Model explicitly includes actor attribution because future AI agents may perform operations on behalf of users.

---

# 29. Actor vs Bill-To

The actor performing the operation is not necessarily the party responsible for the commercial relationship.

Example:

```text
Student
   ↓
Uses AI Assistant
   ↓
Tutor Workspace
   ↓
Workspace License
   ↓
Tutor Subscription
```

Therefore:

```text
Actor
≠
Usage Owner
≠
Bill-To Party
```

These relationships must remain independently representable.

---

# 30. Usage Allowance

The effective entitlement may contain:

```text
AI Credits:
75,000
```

Usage & Metering maintains:

```text
Used:
42,380
```

The effective state is therefore:

```text
Allowance:
75,000

Consumed:
42,380

Remaining:
32,620
```

The entitlement itself does not mutate because usage changed.

---

# 31. Credit Consumption Order

The current Licensing architecture defines the consumption priority as:

```text
1. Expiring Promotional Credits
2. Purchased Add-on Credits
3. Included Subscription Credits
```

This order must be preserved by the AI commercial integration.

---

# 32. Example: Promotional Credits

Workspace has:

```text
Included:
75,000

Purchased:
25,000

Promotion:
10,000
```

Effective allowance:

```text
110,000
```

If the Workspace consumes:

```text
5,000
```

the consumption should first use:

```text
Promotional Credits
```

according to the established priority.

---

# 33. AI Credit Ledger

AI Credits that represent purchased or granted commercial value should be represented through the commercial credit ledger.

Possible sources:

```text
Subscription Grant
Purchased Pack
Promotion
Manual Grant
Refund
Adjustment
Consumption
Expiration
```

Usage & Metering records consumption.

The Credit Ledger records commercial credit movements.

---

# 34. Credit Purchase Integration

When a customer purchases an AI Credit Pack through the commercial flow:

```text
Product Configuration
        ↓
AI Credit Pack
        ↓
Price
        ↓
Subscription / Commercial Activation
        ↓
License
        ↓
Credit Entitlement
        ↓
Credit Grant
```

The AI subsystem does not create the credit grant.

---

# 35. AI Credit Add-On

Example:

```text
Current:
75K AI Credits

Customer selects:
+25K AI Credit Pack
```

The Product Configuration Engine calculates:

```text
Effective AI Credits:
100K
```

Subscription receives the finalized configuration.

Licensing resolves the new entitlement.

Usage consumes from the resulting allowance.

---

# 36. Promotion Integration

Promotion may grant temporary AI usage.

Example:

```text
Promotion:
+25K AI Credits

Effective:
30 days
```

Promotion is owned by Promotion & Discounts.

Licensing consumes the resulting promotion source when resolving entitlements.

AI must not implement promotion logic.

---

# 37. Manual Entitlement Override

Support may temporarily grant:

```text
+10,000 AI Credits
```

This is represented as:

```text
EntitlementOverride
```

rather than modifying the base product configuration.

The existing Licensing architecture explicitly includes entitlement overrides in V1.

---

# 38. Billing Integration

Billing receives commercially relevant financial information.

The relationship is:

```text
Usage & Metering
       ↓
Rated Usage
       ↓
Billing
```

However:

> **Billing does not own AI execution or usage measurement.**

---

# 39. Important Payment Boundary

The current commercial data model explicitly establishes:

> **The Platform does not process payment.**

Payment satisfaction may occur outside the Platform.

The Platform can record that commercial terms were satisfied through **Manual Commercial Activation**, using the subscription event mechanism with:

```text
triggered_by
reference_note
```

This is an important constraint for all AI commercial flows.

---

# 40. AI and Billing When AI Is Included

Example:

```text
Subscription:
Solo AI+

Included:
75K AI Credits
```

Customer uses:

```text
42K AI Credits
```

Result:

```text
AI Usage:
Recorded

Provider Cost:
Recorded

Additional Invoice Line:
None
```

AI infrastructure still incurs cost internally.

---

# 41. AI and Billing When Overage Is Enabled

Example:

```text
Included:
75K

Used:
75K

Additional:
10K
```

If the product configuration defines overage:

```text
10K
    ↓
Rated Usage
    ↓
Billing
    ↓
Invoice Line
```

The AI Skill remains unchanged.

---

# 42. AI and Billing When Credits Are Purchased

Example:

```text
AI Credit Pack:
25K

Price:
$X
```

The commercial product configuration determines the price.

Billing records the financial obligation according to the Platform's billing model.

The resulting entitlement/credit grant becomes available through Licensing.

---

# 43. Billing Does Not Decide Entitlement

Billing may report:

```text
Invoice overdue
```

but it does not directly disable AI.

Instead:

```text
Billing / Subscription State
        ↓
Subscription Management
        ↓
Licensing
        ↓
License State
        ↓
Effective AI Entitlement
```

This preserves the established rule that Licensing derives license state from Subscription state rather than maintaining its own independent commercial state.

---

# 44. Grace State

If the Subscription enters:

```text
Past Due
```

Licensing may derive:

```text
License:
Grace
```

The AI commercial policy can determine whether:

```text
AI remains available
```

or:

```text
AI becomes restricted
```

This decision belongs to commercial policy, not to the AI provider integration.

---

# 45. Restricted State

A restricted license may produce:

```text
AI Assistant:
Disabled
```

while preserving:

```text
Learning Content
Existing Lessons
Generated Content
Historical Usage
```

The established Licensing rule is that reducing an entitlement restricts access and does not delete Workspace data.

---

# 46. License Revocation

If the License becomes:

```text
Expired
```

or:

```text
Revoked
```

AI authorization fails.

Existing AI-generated content remains governed by the normal Workspace/Learning data-retention policies.

---

# 47. Domain Events

The AI commercial integration should consume relevant events such as:

```text
SubscriptionActivated
SubscriptionChanged
SubscriptionRenewed
SubscriptionExpired
SubscriptionSuspended

EntitlementGranted
EntitlementChanged
EntitlementRevoked

UsageRecorded
UsageAdjusted
```

Licensing already publishes:

```text
LicenseCreated
LicenseActivated
LicenseStateChanged
LicenseSuspended
LicenseRestricted
LicenseExpired
LicenseRevoked

EntitlementGranted
EntitlementChanged
EntitlementRevoked
```

These events are the preferred integration mechanism rather than polling.

---

# 48. AI Commercial Events

The AI subsystem may publish technical events such as:

```text
AIExecutionStarted
AIExecutionCompleted
AIExecutionFailed
AIUsageMeasured
```

Usage & Metering converts the relevant execution facts into commercial Usage Events.

---

# 49. Event Ownership

The ownership model is:

```text
AI Domain
    owns AI execution facts

Usage & Metering
    owns usage facts

Licensing
    owns entitlement facts

Subscription
    owns subscription facts

Product Configuration
    owns configuration facts

Billing
    owns invoice / financial facts
```

No context should publish an event pretending to be the source of truth for another context's fact.

---

# 50. Runtime Sequence

From a commercial-integration standpoint, a request touches this document at exactly two checkpoints, with technical execution happening entirely between them:

```text
Licensing        → HasEntitlement?           (this document, §17–20)
Usage & Metering → Reserve?                   (this document, §21–23)
                                               ← full technical execution happens here,
                                                 owned by AICommercialRuntimeArchitecture.md
Usage & Metering → Measure, Record, Finalize   (this document, §24–26)
```

The full request sequence, including the AI Orchestrator, Model Router, and Provider steps between reservation and finalization, is defined once in `AICommercialRuntimeArchitecture.md` §5 and §100 and is not repeated here.

---

# 51. Why Authorization Happens Before Provider Execution

AI providers incur infrastructure cost.

Therefore the Platform should not execute an expensive request when:

```text
Entitlement = Denied
```

or:

```text
Usage = Exhausted
```

unless the commercial policy explicitly permits the operation.

---

# 52. Why Usage Is Finalized After Execution

The Platform cannot always know actual provider consumption beforehand.

For example:

```text
Estimated:
2,000 credits

Actual:
2,450 credits
```

Therefore:

```text
Reservation
```

protects the commercial allowance before execution, while:

```text
Usage Event
```

records actual consumption afterward.

---

# 53. Idempotency

Commercial usage events must be idempotent.

The same AI execution must not result in:

```text
Usage:
2,000
```

being recorded twice because an event was delivered twice.

A stable execution identity should be used:

```text
OperationId
+
ExecutionId
```

or equivalent.

---

# 54. Failure Handling

If AI execution fails:

```text
AI Execution
      ↓
Failure
      ↓
Determine Actual Provider Usage
      ↓
Finalize / Release Reservation
      ↓
Record Failure
```

If the provider consumed resources before failing, those resources must remain measurable.

---

# 55. Retry Handling

A retry must have a distinct execution identity.

Example:

```text
Operation:
GenerateLesson

Execution 1:
Failed after provider call

Execution 2:
Succeeded
```

Usage must be:

```text
Execution 1 usage
+
Execution 2 usage
```

unless provider-level cancellation/refund semantics explicitly justify an adjustment.

---

# 56. Composite Operation Billing

For a composite operation:

```text
GenerateLessonFromVideo
```

the Platform may expose one customer-facing usage unit:

```text
1 Lesson Generation
```

while internally measuring:

```text
Transcription
+
Generation
+
Questions
```

This allows commercial simplicity without sacrificing cost visibility.

---

# 57. Product Advisory Integration

Usage data can feed Product Advisory.

Example:

```text
Current Plan:
75K AI Credits

Current Usage:
68K

Projected Usage:
91K

Product Advisory:
Recommend +25K AI Credit Pack
```

This follows the existing architecture where Usage feeds Advisory and Commercial Optimization.

---

# 58. Recommendation Boundary

Product Advisory may recommend:

```text
Upgrade
Add AI Credits
Add AI Pack
Change Product
```

It must not directly modify:

```text
Subscription
License
Entitlement
Credit Balance
```

The customer must pass through the commercial configuration flow.

---

# 59. Upgrade Flow From AI Usage

```text
Usage Forecast
      ↓
Product Advisory
      ↓
Recommendation
      ↓
Product Configuration
      ↓
Price / Configuration
      ↓
Subscription Change
      ↓
Licensing
      ↓
New AI Entitlement
```

This creates a clean commercial loop.

---

# 60. AI Usage Dashboard

The Workspace can consume a commercial usage projection:

```text
AI Usage

42,380 / 75,000

56.5% used

32,620 remaining
```

The UI does not need to know:

```text
Provider
Model
Input Tokens
Output Tokens
Provider Cost
```

unless the user has an appropriate administrative view.

---

# 61. Administrative AI Cost Dashboard

An administrative interface may expose:

```text
AI Infrastructure Cost

Provider:
$X

Model:
$Y

Workspace:
$Z

Capability:
$W
```

This is an internal economic view.

It should not be confused with customer billing.

---

# 62. AI Cost vs Customer Revenue

The Platform can calculate:

```text
AI Revenue
-
AI Provider Cost
=
AI Gross Margin
```

This belongs to Commercial Analytics.

It does not belong in the runtime AI execution path.

---

# 63. Multi-Provider Architecture

The commercial layer must remain provider-neutral.

Example:

```text
Commercial Product:
Premium AI
```

could be fulfilled by:

```text
Provider A
```

today and:

```text
Provider B
```

later.

The customer entitlement remains:

```text
Premium AI
```

The provider/model selection remains an infrastructure concern.

---

# 64. Model Routing

The Product Configuration Engine may define:

```text
AI Quality Tier:
Premium
```

The Model Router determines:

```text
Which model should execute?
```

This prevents commercial configuration from becoming coupled to provider names.

---

# 65. Provider Pricing Changes

Suppose provider cost changes:

```text
Provider Cost:
$X → $Y
```

The Platform may update:

```text
Provider Cost Configuration
```

without changing:

```text
Customer Subscription
AI Capability
AI Entitlement
Workspace UI
```

unless the business deliberately changes customer pricing.

---

# 66. AI Credit Meter Versioning

The Usage system must version AI Credit conversion.

Example:

```text
AI Credit Meter v1
```

and later:

```text
AI Credit Meter v2
```

Historical Usage Events retain the meter version used at the time.

This is required to preserve historical accuracy.

---

# 67. Commercial Configuration Versioning

Likewise:

```text
Configuration Snapshot v1
```

must remain immutable.

A future change creates:

```text
Configuration Snapshot v2
```

rather than rewriting v1.

This is consistent with the Product Configuration architecture and its immutable Configuration Snapshot model.

---

# 68. AI Pricing Change

Example:

```text
August:
75K AI Credits

September:
100K AI Credits
```

The September configuration does not alter August's entitlement history.

Licensing retains the historical source.

Usage retains the historical meter version.

Billing retains the historical financial record.

---

# 69. Customer Upgrade

```text
Current:
75K AI Credits

Customer chooses:
+25K AI Credit Pack
```

Flow:

```text
Customer
 ↓
Product Configuration
 ↓
Validate
 ↓
Price
 ↓
Subscription Change
 ↓
New Configuration Snapshot
 ↓
Licensing
 ↓
Entitlement Changed
 ↓
AI allowance becomes 100K
```

---

# 70. Customer Downgrade

```text
Current:
100K AI Credits

Customer downgrades:
75K AI Credits
```

Licensing must restrict the effective entitlement.

It must not delete:

```text
Existing AI-generated content
Existing Lessons
Existing Assessments
```

This follows the approved downgrade principle.

---

# 71. Existing Usage During Downgrade

Suppose:

```text
Current allowance:
100K

Used:
90K
```

Customer downgrades to:

```text
75K
```

The Platform must not erase the historical 90K usage.

The commercial architecture must determine the resulting state according to the downgrade policy.

This is a commercial policy decision and must not be implemented inside AI execution code.

---

# 72. AI Add-On Removal

If:

```text
AI Assessment Pack
```

is removed:

```text
Assessment AI Entitlement
        ↓
Revoked
```

Existing generated assessments remain governed by Learning/Workspace retention rules.

Licensing publishes:

```text
EntitlementRevoked
```

and downstream domains react accordingly.

---

# 73. Subscription Renewal

At renewal:

```text
Subscription Renewed
      ↓
New Commercial Period
      ↓
License remains / becomes Active
      ↓
Allowance renewed
      ↓
Usage Counter for new period
```

Historical usage remains available for reporting.

---

# 74. AI Credit Renewal

For subscription-included credits:

```text
Period 1:
75K

Period 2:
75K
```

The allowance is associated with the relevant commercial period.

The Usage system must not merge the periods into one unlimited balance.

---

# 75. AI Credit Expiration

Promotional credits may expire independently.

Example:

```text
Subscription:
75K

Promotion:
+25K
Expires:
30 days
```

At expiration:

```text
Promotional Credits
→ Expired

Subscription Credits
→ Remain
```

This follows the established distinction between included, purchased, and promotional allowances.

---

# 76. Security Boundary

AI commercial authorization must always include:

```text
Workspace Identity
Actor Identity
Capability
Entitlement
Usage Policy
```

A client must never be able to send:

```text
"Use Premium AI"
```

and have the backend trust the requested tier.

The backend resolves the effective entitlement.

---

# 77. No Client-Side Commercial Authority

The frontend may display:

```text
Premium AI
```

but it must not determine:

```text
Premium AI = Allowed
```

The backend Licensing context is authoritative.

---

# 78. AI API Boundary

Conceptually:

```text
POST /ai/execute
```

may accept:

```text
Capability
Input
Context
```

but should not trust client-supplied:

```text
Plan
Price
Allowance
Credit Balance
Provider
Model
```

These are resolved server-side.

---

# 79. Commercial Context Passed to AI

The AI Orchestrator may receive a resolved execution authorization:

```text
AIExecutionContext
│
├── WorkspaceId
├── ActorId
├── Capability
├── Skill
├── QualityTier
├── UsageMeter
├── UsagePolicy
└── CorrelationId
```

It should not receive unnecessary billing details.

---

# 80. AI Must Not Receive Payment Data

AI execution should never require:

```text
Credit Card
Payment Method
Invoice Payment Details
Bank Information
```

The AI system only needs the commercial authorization necessary to execute the capability.

---

# 81. Billing Data Isolation

Likewise, Billing should not need:

```text
AI Prompt
AI Response
Learning Content
Student Conversation
```

Billing needs:

```text
Rated Commercial Usage
Invoice Component
Commercial Reference
```

This maintains data minimization and bounded-context separation.

---

# 82. Sensitive AI Content

Usage events should avoid storing the complete AI prompt or response unless required by the AI domain.

Usage needs attribution and measurement, not educational content.

For example:

```text
Good:
OperationId
Capability
Usage
Provider
Model

Avoid:
Full Student Conversation
Full AI Response
```

---

# 83. Audit Trail

A support administrator should be able to answer:

> Why was this AI operation allowed?

The trace should be:

```text
AI Operation
   ↓
Workspace
   ↓
Effective Entitlement
   ↓
Configuration Snapshot
   ↓
Subscription
```

And:

> Why was this AI operation charged?

```text
AI Operation
   ↓
Usage Event
   ↓
Meter Version
   ↓
Commercial Rating
   ↓
Billing Record
```

---

# 84. Traceability

Every commercial AI operation should therefore have a traceable chain:

```text
CorrelationId
      │
      ├── AI Execution
      ├── Usage Reservation
      ├── Usage Event
      ├── Rating
      └── Billing Reference
```

This is essential for support, reconciliation, and dispute resolution.

---

# 85. Reconciliation

The Platform should support reconciliation between:

```text
AI Execution
```

and:

```text
Usage Event
```

and:

```text
Commercial Usage
```

and, where applicable:

```text
Billing Line
```

A missing or duplicated link should be detectable.

---

# 86. Reconciliation Example

```text
AI Executions:
1,000

Usage Events:
1,000

Rated Operations:
1,000

Invoice Lines:
Expected based on policy
```

Any discrepancy should be flagged for reconciliation.

---

# 87. AI Commercial Integration APIs

Conceptual APIs include:

### Licensing

```text
HasEntitlement()

GetEffectiveAIEntitlement()

GetAIUsagePolicy()
```

### Usage

```text
ReserveUsage()

CommitUsage()

ReleaseUsage()

RecordUsage()

GetRemainingAllowance()
```

### Product Configuration

```text
ResolveConfiguration()

PriceConfiguration()

PreviewUpgrade()

PreviewDowngrade()
```

### Billing

```text
GetRatedUsage()

CreateInvoiceComponent()
```

Exact API contracts should be defined in implementation-specific integration documents.

---

# 88. Domain Events

Recommended integration events:

```text
ConfigurationFinalized

SubscriptionActivated
SubscriptionChanged
SubscriptionRenewed
SubscriptionExpired

EntitlementGranted
EntitlementChanged
EntitlementRevoked

AIUsageRecorded
AIUsageAdjusted

InvoiceIssued
InvoiceVoided
```

Payment-related events should only be introduced if they represent externally verified commercial state rather than implying that this Platform itself processed the payment.

---

# 89. Eventual Consistency

The architecture should not require every commercial component to be synchronously updated.

For example:

```text
EntitlementChanged
      ↓
Event Bus
      ↓
Workspace Cache
      ↓
AI Runtime
```

However, runtime authorization must use a current enough entitlement representation to prevent unauthorized execution.

---

# 90. Runtime Entitlement Cache

Licensing owns the source of truth.

AI services may maintain a read-optimized cache of:

```text
Effective AI Entitlements
```

but:

> The cache is not the source of truth.

When Licensing publishes:

```text
EntitlementRevoked
```

the AI authorization cache must invalidate/update promptly.

---

# 91. Usage Counter Performance

The existing Usage & Metering architecture separates:

```text
UsageAggregate
```

from:

```text
UsageCounter
```

The counter is optimized for the hot-path:

```text
How much is left?
```

while aggregates serve analytics and historical reporting.

This is particularly important because every AI request may require a usage availability check.

---

# 92. AI Runtime Performance

The desired flow is therefore:

```text
Cached Effective Entitlement
        +
Current Usage Counter
        ↓
Fast Authorization Decision
        ↓
AI Execution
```

Historical Usage Aggregates should not be queried on every AI request.

---

# 93. AI Commercial Integration Architecture

The complete architecture is:

```text
                    Commercial Product Management
                              │
                              ▼
                   Product Configuration Engine
                              │
                              ▼
                      Configuration Snapshot
                              │
                              ▼
                         Subscription
                              │
                              ▼
                  Licensing & Entitlements
                              │
                              ▼
                   Effective AI Entitlement
                              │
                              ▼
                         AI Assistant
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
                       Usage & Metering
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
              Commercial Rating    Cost Analytics
                    │
                    ▼
                  Billing
```

---

# 94. The Most Important Boundary

The critical runtime boundary is:

```text
                    COMMERCIAL
                        │
                        │ HasEntitlement
                        ▼
                   AI RUNTIME
                        │
                        │ Execute
                        ▼
                    PROVIDER
```

The AI runtime consumes commercial authorization.

It does not own commercial policy.

---

# 95. What Happens When AI Is Free?

"Free AI" is simply a Product Configuration.

Example:

```text
Free Plan

AI Assistant:
Enabled

AI Credits:
500 / month

Price:
Included
```

The same integration architecture applies.

The provider still generates an internal cost.

---

# 96. What Happens When AI Is Paid?

Nothing changes in the AI runtime.

Only the commercial configuration changes:

```text
AI Assistant:
Enabled

AI Credits:
75,000

Price:
Included in subscription
```

or:

```text
AI Assistant:
Enabled

AI Credits:
Purchased Add-On
```

or:

```text
AI Assistant:
Enabled

Overage:
Billable
```

The AI Skill remains unchanged.

---

# 97. Recommended V1

Based on the existing commercial architecture, the recommended V1 is:

```text
Subscription
      +
Included AI Credits
      +
Optional AI Credit Pack
```

Internally:

```text
Measure:
AI Credits
AI Tokens
Provider
Model
Cost
```

Externally:

```text
Show:
Included AI
Used
Remaining
Upgrade / Buy Credits
```

This gives the customer a simple product while preserving the economic data needed for future monetization.

---

# 98. V1 AI Commercial Flow

```text
Tutor
  │
  ▼
Uses AI Assistant
  │
  ▼
HasEntitlement()
  │
  ▼
Check AI Credits
  │
  ├── Available ──► Reserve
  │                    │
  │                    ▼
  │                 Execute
  │                    │
  │                    ▼
  │                Measure
  │                    │
  │                    ▼
  │                Commit Usage
  │
  └── Exhausted
          │
          ▼
   Commercial Policy
          │
     ┌────┴─────┐
     ▼          ▼
   Block     Buy Credits
```

---

# 99. Future Commercial Flow

The architecture can later evolve into:

```text
Subscription
+
Included AI
+
AI Add-Ons
+
AI Credits
+
Premium AI
+
Usage-Based Overage
+
Enterprise AI Policies
```

without changing the AI Skills.

---

# 100. Architectural Invariants

### ACI-001

AI Skills must not contain subscription pricing logic.

### ACI-002

AI Skills must not directly modify entitlements.

### ACI-003

AI Skills must not directly create invoices.

### ACI-004

AI Skills must not process payment.

### ACI-005

AI runtime authorization must use effective entitlements, not plan names.

### ACI-006

Provider model selection must remain independent from commercial product configuration.

### ACI-007

Provider usage and customer usage must remain separately measurable.

### ACI-008

Customer usage must be attributable to a Workspace.

### ACI-009

Actor attribution must remain separate from bill-to attribution.

### ACI-010

Usage reservations must remain separate from actual Usage Events.

### ACI-011

Usage Events must be idempotent.

### ACI-012

Historical usage must remain auditable.

### ACI-013

Commercial configuration snapshots must remain immutable.

### ACI-014

Entitlement changes must propagate through Licensing events.

### ACI-015

Usage exhaustion must be governed by commercial policy.

### ACI-016

Billing must consume rated commercial information rather than raw AI provider calls.

### ACI-017

Provider cost must never automatically become customer price.

### ACI-018

AI must remain provider-neutral.

### ACI-019

Promotional, purchased, and included AI allowances must remain distinguishable.

### ACI-020

AI commercial integration must support both free/included AI and future paid AI without architectural redesign.

---

# 101. Final Architecture Decision

The Platform should **not implement "AI subscription" as a special technical subsystem**.

Instead:

```text
AI
```

is a normal Platform capability that participates in the existing Commercial Domain.

The final relationship is:

```text
Product Configuration
        ↓
Subscription
        ↓
License
        ↓
AI Entitlement
        ↓
AI Authorization
        ↓
AI Execution
        ↓
Usage
        ↓
Commercial Rating
        ↓
Billing
```

This is the architectural foundation that allows the Platform to offer AI:

```text
Free
Included
Credit-Based
Add-On
Premium
Usage-Based
Enterprise Custom
```

without coupling the AI runtime to any particular commercial model.

---

# 102. Related Documents

### AI

* `AIAssistantArchitecture.md`
* `AIOrchestrationArchitecture.md`
* `AIContextArchitecture.md`
* `AISkillArchitecture.md`
* `AIModelProviderArchitecture.md`
* `AIUsageAndCostArchitecture.md`
* `AIProductPackagingArchitecture.md`

### Commercial

* `ProductConfigurationEngineArchitecture.md`
* `LicensingAndEntitlementArchitecture.md`
* `SubscriptionManagementArchitecture.md`
* `BillingArchitecture.md`
* `UsageAndMeteringArchitecture.md`
* `PromotionAndDiscountArchitecture.md`
* `CommercialDomainIntegrationArchitecture.md`
* `ProductAdvisoryArchitecture.md`

### Data Models

* `Commercial Domain Data Model.md`
* `Commercial Domain Data Model — Usage & Metering.md`
* `Commercial Domain Data Model — Billing.md`

---

# 103. Status

**Draft — Version 1.0**

This document establishes the integration boundary between the AI Platform and the existing Commercial Domain.

The next logical document is:

**`AICommercialRuntimeArchitecture.md`**

That document should move from commercial integration into the **actual runtime implementation** and define the concrete request pipeline:

```text
AI Assistant
    ↓
AI Gateway
    ↓
Identity / Workspace
    ↓
Entitlement Check
    ↓
Usage Reservation
    ↓
AI Orchestrator
    ↓
Context Assembly
    ↓
Skill
    ↓
Model Router
    ↓
Provider
    ↓
Validation
    ↓
Usage Commit
    ↓
Response
```

This is where we can finally define how the AI Assistant will be implemented technically inside the Platform rather than only how it participates in the commercial architecture.
