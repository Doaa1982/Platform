# Usage & Metering Architecture

**Version:** 1.0
**Status:** Draft
**Bounded Context:** Usage & Metering
**Parent Domain:** Commercial Domain

---

# 1. Purpose

The Usage & Metering bounded context is responsible for measuring, recording, aggregating, and reporting the consumption of commercially metered resources within the platform.

It answers:

> **"How much of the resources included in this Workspace's commercial entitlement has actually been consumed?"**

The most important initial use case is **AI usage**, but the architecture must support other metered resources in the future.

---

# 2. Why Usage Must Be a Separate Bounded Context

We have already established:

```text
Product Configuration
"What did the customer choose?"

Subscription
"What commercial relationship is active?"

License & Entitlements
"What is the customer allowed to use?"

Usage & Metering
"What did the customer actually consume?"
```

These must not be combined.

For example:

```text
AI Entitlement:
75,000 credits/month

Actual Usage:
42,380 credits
```

The entitlement does not change simply because usage changes.

---

# 3. Architectural Position

```text
                 Product Configuration
                         │
                         ▼
                 License & Entitlements
                         │
                         ▼
                  Usage Allowances
                         │
                         │
Learning Workspace ──────┼──────► Usage & Metering
                         │
                         ▼
                   Usage Records
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
        Usage Analytics          Billing
              │
              ▼
       Commercial Analytics
```

---

# 4. Core Responsibilities

Usage & Metering owns:

* usage event ingestion;
* usage measurement;
* usage normalization;
* usage aggregation;
* usage counters;
* usage periods;
* usage limits;
* usage summaries;
* usage history;
* usage reconciliation;
* usage alerts;
* usage-based billing data;
* AI consumption measurement.

---

# 5. What This Context Does Not Own

| Concern                 | Owner                           |
| ----------------------- | ------------------------------- |
| Product limits          | Product Management              |
| Entitlements            | Licensing                       |
| Subscription            | Subscription Management         |
| Price definition        | Product Configuration / Pricing |
| Payment                 | Billing                         |
| Feature authorization   | Licensing                       |
| Workspace functionality | Learning Workspace              |

---

# 6. Metered Resource Model

The platform should represent a generic:

```text
Metered Resource
```

rather than hardcoding AI as the only usage type.

Examples:

```text
AI Credits
Video Processing Minutes
Storage
Email Sends
SMS
Document Processing
Translation Characters
Speech-to-Text Minutes
```

---

# 7. Initial Metered Resources

For the first version, prioritize:

| Resource         | Metered? | Priority |
| ---------------- | -------: | -------: |
| AI Credits       |      Yes |       P0 |
| AI Tokens        | Internal |       P0 |
| Video Processing | Optional |       P1 |
| Storage          | Optional |       P1 |
| Student Seats    | Capacity |       P1 |
| Tutor Seats      | Capacity |       P1 |
| Email            |   Future |       P2 |
| SMS              |   Future |       P2 |

---

# 8. AI Usage Model

AI consumption may occur across many workspace capabilities.

For example:

```text
Lesson Generation
Question Generation
Video Transcription
AI Feedback
AI Assessment
AI Translation
AI Content Improvement
AI Tutor Assistant
```

Each operation may consume different amounts of AI resources.

---

# 9. AI Usage Should Not Be Modeled Only As Tokens

Internally, AI providers may report:

```text
Input Tokens
Output Tokens
Cached Tokens
Processing Time
Model
```

But the customer's commercial plan should not necessarily expose raw tokens.

Instead:

```text
Provider Usage
       ↓
Usage Normalization
       ↓
Platform AI Credits
```

This allows the platform to change AI providers without changing the commercial model.

---

# 10. AI Credit Abstraction

The platform should introduce:

```text
AI Credit
```

as the commercial measurement unit.

Example:

```text
GPT Input Tokens
+
GPT Output Tokens
+
Model Cost
        ↓
AI Credit Calculator
        ↓
AI Credits Consumed
```

The customer sees:

> 1,240 AI credits used

rather than:

> 8,347 input tokens + 2,100 output tokens.

---

# 11. Why AI Credits Are Better

AI credits allow us to:

* support multiple AI providers;
* change models;
* introduce new models;
* control margins;
* simplify customer pricing;
* support different AI capability levels;
* create future AI packs;
* change provider costs without redesigning plans.

---

# 12. Usage Event

Every metered operation produces a usage event.

Conceptually:

```text
UsageEvent
│
├── UsageEventId
├── WorkspaceId
├── SubscriptionId
├── MeterId
├── Capability
├── Operation
├── Provider
├── Model
├── RawUsage
├── NormalizedUsage
├── Timestamp
└── CorrelationId
```

---

# 13. Example Usage Event

```text
Workspace:
WS-123

Capability:
Lesson Authoring

Operation:
Generate Lesson

Provider:
OpenAI

Model:
Model-X

Input Tokens:
4,500

Output Tokens:
1,800

AI Credits:
920
```

---

# 14. Usage Event Lifecycle

```text
Workspace Operation
        │
        ▼
Usage Event
        │
        ▼
Validation
        │
        ▼
Normalization
        │
        ▼
Metering
        │
        ▼
Aggregation
        │
        ▼
Usage Counter
        │
        ▼
Usage Summary
```

---

# 15. Usage Event Validation

The system should validate:

* Workspace exists;
* resource is metered;
* operation is recognized;
* timestamp is valid;
* event is not duplicated;
* usage values are valid;
* subscription context is valid.

---

# 16. Idempotency

Usage events must be idempotent.

The same event should never be counted twice.

Example:

```text
CorrelationId:
AI-REQUEST-89231
```

If the event is received twice:

```text
Event #1 → Counted
Event #2 → Ignored
```

This is critical for AI usage accuracy.

---

# 17. Usage Period

Usage must be associated with a commercial period.

Example:

```text
Subscription Period

Aug 8 → Sep 8

AI Allowance:
75,000 credits

Usage:
42,380 credits
```

At renewal:

```text
Sep 8 → Oct 8

AI Allowance:
75,000 credits

Usage:
0 credits
```

---

# 18. Usage Counter

Conceptually:

```text
UsageCounter
│
├── Workspace
├── Subscription
├── Meter
├── Period
├── Allowed
├── Consumed
├── Remaining
└── PercentageUsed
```

Example:

| Metric    |  Value |
| --------- | -----: |
| Allowed   | 75,000 |
| Used      | 42,380 |
| Remaining | 32,620 |
| Usage     |  56.5% |

---

# 19. Entitlement vs Usage

This distinction must remain explicit.

```text
License

AI Credits Allowed = 75,000


Usage

AI Credits Used = 42,380
```

The effective remaining amount is:

```text
75,000 - 42,380 = 32,620
```

---

# 20. Usage Status

Recommended statuses:

| Status     | Meaning                       |
| ---------- | ----------------------------- |
| Normal     | Usage below warning threshold |
| Warning    | Usage approaching allowance   |
| Near Limit | Usage very close to limit     |
| Exhausted  | Allowance consumed            |
| Over Limit | Usage exceeded allowance      |
| Unlimited  | No configured limit           |

---

# 21. Usage Thresholds

The platform should support configurable thresholds.

Example:

```text
70% → Warning
85% → Near Limit
100% → Exhausted
```

These values should be commercial policy, not hardcoded into the Workspace.

---

# 22. Usage Enforcement

Usage measurement and usage enforcement are separate responsibilities.

```text
Usage & Metering
"What has been consumed?"

Licensing
"Is this operation allowed?"

```

Before an expensive AI operation:

```text
Workspace
   │
   ▼
License Check
   │
   ├── Allowed → Execute
   │
   └── Not Allowed → Reject / Upgrade
```

After execution:

```text
AI Operation
   │
   ▼
Usage Event
   │
   ▼
Metering
```

---

# 23. Pre-Authorization for AI

For expensive operations, the platform should support:

```text
Reserve Usage
```

before execution.

Example:

```text
Requested Operation
Estimated Cost = 1,000 credits

Current Remaining = 700

Result:
Rejected
```

This prevents a user from starting an operation that cannot be completed.

---

# 24. Usage Reservation

```text
Available
   │
   ▼
Reserve
   │
   ├── Operation Success → Commit
   │
   └── Operation Failure → Release
```

This is especially useful for:

* video transcription;
* large document processing;
* batch question generation;
* large AI lesson generation.

---

# 25. Actual Usage vs Estimated Usage

AI operations may not know the exact cost before execution.

Therefore:

```text
Estimated Usage
        ↓
Reservation
        ↓
Actual Usage
        ↓
Reconciliation
```

Example:

```text
Estimated:
1,000 credits

Actual:
920 credits

Released:
80 credits
```

---

# 26. Usage Reconciliation

The system should support correction when actual provider usage differs from the initial estimate.

```text
Reserved:
1,000

Actual:
920

Adjustment:
-80
```

---

# 27. AI Capability Usage Matrix

We should track usage by capability.

| Capability       | Example Operation  | Meter                |
| ---------------- | ------------------ | -------------------- |
| Lesson Authoring | Generate Lesson    | AI Credits           |
| Assessment       | Generate Questions | AI Credits           |
| Video            | Transcription      | AI Credits / Minutes |
| Feedback         | Generate Feedback  | AI Credits           |
| Translation      | Translate Content  | AI Credits           |
| Marketing        | Generate Campaign  | AI Credits           |
| AI Tutor         | AI Response        | AI Credits           |

This will later allow us to understand which AI capabilities are commercially valuable.

---

# 28. Usage by Tutor

For multi-tutor workspaces, usage should optionally be attributed to the tutor.

```text
Workspace
│
├── Tutor A
│    └── 20,000 credits
│
├── Tutor B
│    └── 12,000 credits
│
└── Tutor C
     └── 8,000 credits
```

The workspace-level total remains authoritative:

```text
Workspace = 40,000 credits
```

---

# 29. Usage by Student

Student attribution may also be useful.

Example:

```text
Workspace
   │
   ├── Tutor
   ├── Student
   ├── Capability
   └── Operation
```

However, student attribution should be optional unless required by a commercial policy.

---

# 30. Usage Dimensions

The metering model should support dimensions such as:

```text
Workspace
Tutor
Student
Capability
Operation
Model
Provider
Region
Subscription
Billing Period
```

These dimensions allow flexible analytics without changing the fundamental usage model.

---

# 31. Usage Aggregation

Raw events should remain available for audit and reconciliation.

Aggregations can then be created:

```text
Raw Events
    │
    ├── Daily
    ├── Monthly
    ├── Subscription Period
    ├── Workspace
    ├── Tutor
    ├── Capability
    └── Operation
```

---

# 32. Usage Storage Model

Recommended conceptual model:

```text
UsageEvent
     │
     ▼
UsageRecord
     │
     ▼
UsageAggregate
     │
     ▼
UsageCounter
```

Do not rely only on a mutable counter.

The event history is required for:

* auditing;
* debugging;
* billing reconciliation;
* dispute resolution;
* analytics.

---

# 33. Usage Correction

Corrections should never silently modify historical events.

Instead:

```text
Original:
1,000 credits

Correction:
-80 credits

Final:
920 credits
```

The correction itself becomes an auditable event.

---

# 34. Usage Reprocessing

If the AI credit conversion rules change, the platform may need to reprocess historical usage.

Therefore the event should retain enough raw provider data to support recalculation.

Example:

```text
Raw Usage
Input Tokens
Output Tokens
Model
Provider
Timestamp
```

The normalized commercial usage can then be recalculated using a specific meter version.

---

# 35. Meter Versioning

Every meter should have a version.

Example:

```text
AI Credit Meter v1
1 credit = X cost units

AI Credit Meter v2
1 credit = Y cost units
```

Historical records remain associated with the version that was used.

---

# 36. Why Meter Versioning Matters

Suppose:

```text
January:
AI Credit v1

March:
AI Credit v2
```

The platform must not recalculate January usage using March rules unless explicitly performing a commercial migration.

---

# 37. Usage-Based Pricing

The architecture should support usage being included in a plan.

Example:

```text
Solo AI+

Included:
75,000 AI Credits
```

It should also eventually support:

```text
Included:
75,000

Additional:
$X per 10,000 credits
```

This means the metering context must not assume that exceeding an allowance always means "block the operation."

---

# 38. Usage Policy

The License/Entitlement context should define what happens when usage reaches the limit.

Possible policies:

| Policy       | Behavior                      |
| ------------ | ----------------------------- |
| Block        | Operation is rejected         |
| Soft Limit   | Operation allowed temporarily |
| Overage      | Additional usage is billable  |
| Auto Upgrade | Upgrade to a larger allowance |
| Buy Pack     | Purchase additional credits   |
| Throttle     | Reduce available operation    |
| Notify       | Warn only                     |

The policy is commercial/licensing logic.

Usage & Metering only measures.

---

# 39. Example: AI Credit Exhaustion

```text
Allowed:
75,000

Used:
74,900

Requested:
500

Pre-check:
Remaining = 100

Requested > Remaining

License Policy:
Block

Result:
Operation rejected
```

The UI can then show:

> You have 100 AI credits remaining. Add an AI Credit Pack or upgrade your plan.

---

# 40. Example: Overage

If the plan supports overage:

```text
Allowed:
75,000

Used:
75,000

Requested:
500

License Policy:
Overage Allowed

Operation:
Allowed

Usage:
75,500

Billable Overage:
500
```

Billing can then use the metering result.

---

# 41. AI Credit Packs

This connects directly to our **Design Your Own Plan** architecture.

Example:

```text
Base Plan:
75K AI Credits

Additional Pack:
+25K

Effective Allowance:
100K
```

The configuration engine determines the allowance.

Usage measures consumption.

Licensing determines whether the usage is permitted.

---

# 42. Usage Dashboard Data

The Workspace should be able to display:

```text
AI Usage

42,380 / 75,000

56.5% used

32,620 remaining
```

Optional breakdown:

```text
Lesson Authoring     20,400
Assessment            9,800
Transcription         7,300
AI Feedback           4,880
```

---

# 43. Usage Alerts

The platform may generate:

```text
UsageThresholdReached
UsageAllowanceExhausted
UsageOverageStarted
UsageAnomalyDetected
```

Example:

> You have used 85% of your monthly AI allowance.

---

# 44. Usage Anomaly Detection

The architecture should allow future anomaly detection.

Example:

```text
Normal daily usage:
1,500 credits

Today:
15,000 credits
```

The system may flag:

```text
Unusual Usage Pattern
```

This is particularly useful for:

* compromised accounts;
* accidental batch operations;
* runaway AI processes;
* automation loops.

---

# 45. Usage Attribution

Every usage event should be attributable to a source.

Possible source:

```text
Tutor
Student
System
Automation
AI Agent
API
Background Job
```

Example:

```text
Source:
Tutor

Actor:
Tutor-123

Operation:
Generate Questions
```

---

# 46. Usage and AI Agents

Future AI agents may perform many operations automatically.

Therefore usage should distinguish:

```text
Human Initiated
```

from:

```text
AI Agent Initiated
```

Example:

```text
Tutor:
"Create a complete lesson."

AI Agent:
Generate transcript
Generate summary
Generate questions
Generate activities
Generate feedback
```

All resulting consumption must be attributable to the original request.

---

# 47. Correlation

A parent operation should have a correlation ID.

```text
Request:
LESSON-GENERATION-123

Child Operations:
├── Transcription
├── Summary
├── Questions
├── Activities
└── Feedback
```

The platform can then calculate:

```text
Total Cost:
4,820 AI Credits
```

for the entire workflow.

---

# 48. Usage Event Hierarchy

```text
Business Operation
        │
        ├── AI Operation A
        ├── AI Operation B
        ├── AI Operation C
        └── AI Operation D
```

This becomes important for AI workflow pricing.

---

# 49. Usage APIs — Conceptual

```text
RecordUsage()

ReserveUsage()

CommitUsage()

ReleaseUsage()

GetUsage()

GetUsageSummary()

GetUsageByCapability()

GetUsageByTutor()

GetUsageByPeriod()

GetRemainingAllowance()

GetUsageForecast()
```

---

# 50. Usage Forecasting

Future versions can estimate when an allowance will be exhausted.

Example:

```text
Allowance:
75,000

Current:
42,380

Average Daily Usage:
2,100

Estimated Exhaustion:
~15 days
```

This can support proactive recommendations.

---

# 51. Product Advisory Integration

Usage can feed Product Advisory.

Example:

```text
Current Plan:
75K AI Credits

Usage Trend:
95K projected

Recommendation:
Upgrade to 150K AI Credits
```

This is a powerful connection between:

```text
Usage
   ↓
Insight
   ↓
Recommendation
   ↓
Configuration
   ↓
Upgrade
```

---

# 52. Usage → Commercial Optimization

Eventually the platform can identify:

```text
Tutor consistently uses:

Learning AI:
High

Assessment AI:
Low

Marketing AI:
None
```

The system could recommend:

> You may save money by reducing unused capability packs.

This should be handled by Product Advisory / Commercial Optimization, not by Usage & Metering itself.

---

# 53. Usage Data Matrix

| Dimension      |    Required | Purpose              |
| -------------- | ----------: | -------------------- |
| Workspace      |         Yes | Commercial ownership |
| Subscription   |         Yes | Billing period       |
| Meter          |         Yes | Resource type        |
| Timestamp      |         Yes | Time analysis        |
| Quantity       |         Yes | Consumption          |
| Operation      |         Yes | Usage explanation    |
| Capability     | Recommended | Product analysis     |
| Tutor          | Recommended | Attribution          |
| Student        |    Optional | Attribution          |
| Provider       | Recommended | AI cost analysis     |
| Model          | Recommended | AI cost analysis     |
| Correlation ID |         Yes | Workflow tracking    |

---

# 54. AI Usage Capability Matrix

This matrix connects our commercial plans to actual consumption.

| Capability          | AI Available? | Metered? | Potential Future Pricing |
| ------------------- | ------------: | -------: | ------------------------ |
| Lesson Authoring    |           Yes |      Yes | AI Credits               |
| Assessment          |           Yes |      Yes | AI Credits               |
| Video Transcription |           Yes |      Yes | AI Credits / Minutes     |
| AI Feedback         |           Yes |      Yes | AI Credits               |
| Translation         |           Yes |      Yes | AI Credits               |
| Marketing           |           Yes |      Yes | AI Credits               |
| Analytics           |           Yes |    Maybe | AI Credits               |
| AI Tutor            |           Yes |      Yes | AI Credits               |

---

# 55. Usage and Pricing Relationship

Usage should never directly decide product price.

Instead:

```text
Product Configuration
       ↓
Usage Allowance
       ↓
License
       ↓
Actual Usage
       ↓
Usage Result
       ↓
Billing / Analytics / Advisory
```

This keeps responsibilities clean.

---

# 56. Usage Invariants

### USG-001

Every usage event must identify a Workspace.

### USG-002

Every metered event must reference a known Meter.

### USG-003

Usage events must be idempotent.

### USG-004

Historical usage events must be immutable.

### USG-005

Usage corrections must be auditable.

### USG-006

Usage must be associated with a commercial period when relevant.

### USG-007

Usage measurement must be independent of entitlement enforcement.

### USG-008

Raw provider usage should be preserved for AI operations.

### USG-009

Meter versions must be preserved for historical accuracy.

### USG-010

Aggregated counters must be derivable from usage events.

---

# 57. Complete Commercial Flow

The platform now has:

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
          BILLING              LICENSE
                                 │
                                 ▼
                            ENTITLEMENTS
                                 │
                                 ▼
                           WORKSPACE
                                 │
                           User Operation
                                 │
                                 ▼
                            USAGE EVENT
                                 │
                                 ▼
                           METERING
                                 │
                  ┌──────────────┼──────────────┐
                  ▼              ▼              ▼
               Billing        Advisory       Analytics
```

---

# 58. Example: Complete AI Operation

A tutor asks:

> "Create a complete lesson from this video."

The system performs:

```text
1. License Check
   ↓
2. Estimate AI Usage
   ↓
3. Reserve 5,000 credits
   ↓
4. Transcribe Video
   ↓
5. Generate Lesson
   ↓
6. Generate Questions
   ↓
7. Calculate Actual Usage
   ↓
8. Commit Usage
   ↓
9. Release unused reservation
```

Result:

```text
Reserved:
5,000

Actual:
4,620

Released:
380

Remaining:
70,380
```

---

# 59. The Three-Layer Commercial Control Model

At this point the architecture has a very clean three-layer model:

```text
┌───────────────────────────────┐
│ PRODUCT CONFIGURATION         │
│                               │
│ What did they buy?            │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│ LICENSING & ENTITLEMENTS      │
│                               │
│ What can they use?            │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│ USAGE & METERING              │
│                               │
│ What did they consume?        │
└───────────────────────────────┘
```

This is one of the most important architectural boundaries in the entire platform.

---

# 60. Final Architecture

```text
                         COMMERCIAL DOMAIN
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
 Product Management     Configuration Engine      Subscription
        │                       │                       │
        └───────────────────────┼───────────────────────┘
                                │
                                ▼
                     Licensing & Entitlements
                                │
                                ▼
                           Workspace
                                │
                                ▼
                        Usage & Metering
                                │
             ┌──────────────────┼──────────────────┐
             ▼                  ▼                  ▼
           Billing           Advisory          Analytics
```

---

# 61. Architectural Outcome

With Usage & Metering in place, the platform can now support:

* AI credit allowances;
* AI usage tracking;
* capability-level usage;
* tutor-level usage;
* usage warnings;
* usage exhaustion;
* usage reservations;
* usage reconciliation;
* usage-based billing;
* AI credit packs;
* usage forecasting;
* upgrade recommendations;
* future overage pricing;
* commercial optimization.

Most importantly:

> **The platform can change AI providers, models, pricing, and commercial plans without coupling those changes to the Learning Workspace.**

---

# 62. Related Documents

### Depends On

* `CommercialDomainReferenceArchitecture.md`
* `CommercialProductManagementArchitecture.md`
* `ProductConfigurationEngineArchitecture.md`
* `SubscriptionManagementArchitecture.md`
* `LicensingAndEntitlementArchitecture.md`

### Feeds

* `BillingArchitecture.md`
* `ProductAdvisoryArchitecture.md`
* `CommercialAnalyticsArchitecture.md`
* `AICommercialStrategyArchitecture.md`

---

# 63. Status

**Draft — Version 1.0**

The next document should now cover the **money side** of the commercial lifecycle:

> **`BillingArchitecture.md`**

That document will define invoices, payment attempts, payment failures, renewals, refunds, prorations, taxes, credits, and how billing interacts with subscriptions—without mixing payment concerns into the Workspace or Licensing contexts.
