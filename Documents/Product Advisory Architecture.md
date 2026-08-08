# Product Advisory Architecture

**Version:** 1.0
**Status:** Draft
**Bounded Context:** Product Advisory
**Parent Domain:** Commercial Domain

---

# 1. Purpose

The Product Advisory bounded context provides intelligent recommendations to Workspace owners based on:

* Workspace configuration;
* enabled capabilities;
* usage patterns;
* capacity;
* AI consumption;
* learning activity;
* subscription;
* billing cycle;
* product availability;
* commercial offers.

It answers:

> **"Given how this Workspace is being used, what should the customer consider adding, removing, upgrading, or changing?"**

Product Advisory is therefore the bridge between:

```text
Customer Behavior
        ↓
Understanding
        ↓
Recommendation
        ↓
Commercial Decision
```

---

# 2. Core Principle

Product Advisory is a **decision-support capability**.

It does not own:

* subscription;
* pricing;
* billing;
* entitlements;
* product configuration;
* usage measurement.

Instead:

```text
Usage
   ↓
Product Advisory
   ↓
Recommendation
   ↓
Customer Decision
   ↓
Product Configuration
   ↓
Subscription
   ↓
Billing
   ↓
Licensing
```

---

# 3. Architectural Position

```text
                    Product Catalog
                         │
                         ▼
              Product Configuration
                         │
                         ▼
                    Subscription
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
           Billing    Licensing    Usage
              │          │          │
              └──────────┼──────────┘
                         ▼
                  Product Advisory
                         │
                         ▼
                   Recommendation
                         │
                         ▼
              Customer / Tutor
```

Product Advisory observes the commercial and usage state.

It does not own that state.

---

# 4. Responsibilities

Product Advisory owns:

* recommendation generation;
* recommendation rules;
* recommendation eligibility;
* recommendation ranking;
* recommendation explanations;
* recommendation lifecycle;
* recommendation dismissal;
* recommendation acceptance tracking;
* recommendation relevance;
* advisory policies;
* commercial opportunity detection.

---

# 5. Does Not Own

| Concern                  | Owner                           |
| ------------------------ | ------------------------------- |
| Product definitions      | Product Management              |
| Pricing                  | Product Configuration / Pricing |
| Subscription             | Subscription Management         |
| Invoice                  | Billing                         |
| Payment                  | Billing                         |
| Entitlements             | Licensing                       |
| Usage measurement        | Usage & Metering                |
| Learning activity source | Learning Workspace              |
| Customer identity        | Identity                        |

---

# 6. Why This Bounded Context Exists

Without Product Advisory, the platform behaves like:

```text
Customer
   ↓
Pricing Page
   ↓
Choose Plan
```

With Product Advisory:

```text
Customer
   ↓
Uses Workspace
   ↓
Platform understands usage
   ↓
Platform identifies opportunity
   ↓
Platform recommends
   ↓
Customer evaluates
   ↓
Customer chooses
```

This creates a much more intelligent commercial experience.

---

# 7. Advisory Philosophy

Recommendations should answer:

> **"Why would this help this tutor?"**

rather than:

> **"Buy this feature."**

For example:

Bad:

```text
Upgrade to AI+
```

Better:

```text
You created 18 lessons this month and manually
created most of the assessment questions.

AI Assessment could automatically generate
questions from your lesson content.
```

Even better:

```text
You created 18 lessons this month.

AI Assessment could save approximately
30–45 minutes per lesson by generating
draft questions automatically.

Consider enabling AI Assessment.
```

---

# 8. Recommendation Categories

The platform should support several recommendation categories.

| Category             | Example                  |
| -------------------- | ------------------------ |
| Upgrade              | Move to a higher plan    |
| Downgrade            | Lower unused capacity    |
| Add Capability       | Enable AI Assessment     |
| Add Capacity         | Add another tutor        |
| Add AI Credits       | Purchase more AI usage   |
| Change Billing Cycle | Switch monthly → annual  |
| Optimize             | Remove unused capability |
| Trial                | Try a capability         |
| Promotion            | Apply an available offer |
| Configuration        | Reconfigure Workspace    |

---

# 9. Recommendation Types

## 9.1 Upgrade Recommendation

Example:

```text
Your Workspace is approaching the limits
of Solo Professional.

Solo AI+ may be a better fit because
you frequently use AI-assisted lesson creation.
```

---

## 9.2 Add-On Recommendation

Example:

```text
You are frequently generating assessments.

AI Assessment is available as an add-on.
```

---

## 9.3 Capacity Recommendation

Example:

```text
You currently have one tutor.

Your Workspace has recently added
multiple teaching collaborators.

Consider adding another tutor seat.
```

---

## 9.4 AI Credit Recommendation

Example:

```text
You have used 90% of your included AI credits.

Consider adding a 25K AI Credit Pack.
```

---

## 9.5 Downgrade Recommendation

Example:

```text
Your Workspace has used less than 10%
of the available AI allowance for the
last three billing periods.

You may be able to reduce your plan.
```

This is important because the platform should optimize for **customer trust**, not only revenue.

---

# 10. Product Advisory Should Be Customer-Centric

The system should not recommend something merely because it produces more revenue.

Recommendation quality should consider:

```text
Customer Benefit
+
Usage Evidence
+
Relevance
+
Timing
+
Commercial Value
```

A recommendation should be suppressed if the customer is unlikely to benefit.

---

# 11. Advisory Signals

Product Advisory consumes signals from multiple contexts.

```text
Usage
   │
   ├── AI usage
   ├── Lesson creation
   ├── Assessment creation
   ├── Student activity
   └── Storage usage

Subscription
   │
   ├── Current plan
   ├── Billing cycle
   └── Renewal date

Licensing
   │
   ├── Enabled capabilities
   └── Capacity

Product Catalog
   │
   ├── Available products
   ├── Add-ons
   └── Plans

Promotion
   │
   ├── Active offers
   └── Eligibility

Billing
   │
   ├── Payment state
   └── Account status
```

---

# 12. Signal Categories

| Signal           | Example                    |
| ---------------- | -------------------------- |
| Usage            | 90% AI usage               |
| Frequency        | 20 lessons/month           |
| Capacity         | 95% tutor capacity         |
| Feature adoption | AI Assessment used heavily |
| Feature absence  | Manual assessment creation |
| Growth           | Student count increasing   |
| Subscription     | Current plan               |
| Billing          | Renewal approaching        |
| Promotion        | Eligible for annual offer  |
| Behavior         | Repeated workflow          |

---

# 13. Usage Thresholds

Some recommendations can use deterministic thresholds.

Example:

```text
AI Usage
< 50%       → No recommendation
50–75%      → Informational
75–90%      → Consider
90–100%     → Strong recommendation
> 100%      → Action required
```

These thresholds should be configurable.

---

# 14. Recommendation Confidence

Each recommendation should have a confidence score.

```text
Recommendation
│
├── Confidence
├── Evidence
├── Expected Benefit
└── Reason
```

Example:

```text
Confidence:
92%

Evidence:
AI usage > 90% for 2 consecutive periods

Recommendation:
Purchase additional AI credits
```

---

# 15. Evidence-Based Recommendations

Every recommendation should have evidence.

Example:

```text
Recommendation:
Add AI Credit Pack

Evidence:
- 88% AI usage this period
- 94% AI usage last period
- 3 AI-intensive workflows
```

This allows the UI to explain the recommendation.

---

# 16. Recommendation Explainability

A recommendation should answer three questions:

### Why?

```text
You are approaching your AI usage limit.
```

### What?

```text
Add 25K AI Credits.
```

### Benefit?

```text
Continue using AI-assisted lesson creation
without waiting for the next billing period.
```

---

# 17. Recommendation Lifecycle

```text
Detected
   ↓
Evaluated
   ↓
Generated
   ↓
Presented
   ↓
Viewed
   ↓
Accepted / Dismissed / Ignored
```

---

# 18. Recommendation States

| State      | Meaning                            |
| ---------- | ---------------------------------- |
| Candidate  | Potential recommendation           |
| Generated  | Recommendation created             |
| Active     | Available to customer              |
| Viewed     | Customer saw it                    |
| Accepted   | Customer acted on it               |
| Dismissed  | Customer explicitly rejected it    |
| Expired    | No longer relevant                 |
| Superseded | Replaced by a newer recommendation |

---

# 19. Recommendation Aggregate

```text
Recommendation
│
├── Recommendation ID
├── Workspace
├── Type
├── Target Product
├── Target Capability
├── Reason
├── Evidence
├── Confidence
├── Priority
├── Valid Until
├── Status
└── Actions
```

---

# 20. Recommendation Action

A recommendation can provide an action.

Examples:

```text
Review Plan
Add AI Credits
Enable AI Assessment
Add Tutor
Switch to Annual
View Configuration
Start Trial
```

The recommendation should not execute the action itself.

---

# 21. Action Boundary

Correct:

```text
Recommendation
      ↓
"Add AI Credits"
      ↓
Product Configuration
      ↓
Customer Confirmation
      ↓
Subscription
      ↓
Billing
      ↓
Licensing
```

Incorrect:

```text
Recommendation
      ↓
Automatically change subscription
```

Customer consent is required for commercial changes.

---

# 22. Design Your Plan Integration

This is one of the most important uses of Product Advisory.

```text
Workspace Usage
       ↓
Advisory
       ↓
Recommended Configuration
       ↓
Design Your Plan
       ↓
Customer Reviews
       ↓
Confirm
```

Example:

```text
You may benefit from:

✓ AI Assessment
✓ 25K AI Credits
✗ Additional Tutor
```

The customer can review the proposed configuration.

---

# 23. Recommended Configuration

The system can construct a recommended configuration.

```text
Recommended Configuration

Base:
Solo Professional

Add:
AI Assessment

Add:
25K AI Credits

Estimated:
$29/month
```

This is a **recommendation**, not an order.

---

# 24. Advisory vs Product Configuration

These must remain separate.

### Product Configuration

Answers:

> "What has the customer selected?"

### Product Advisory

Answers:

> "What might the customer benefit from selecting?"

Therefore:

```text
Advisory
    ↓
Recommendation
    ↓
Configuration
```

Never:

```text
Advisory
    ↓
Configuration automatically changed
```

---

# 25. Advisory vs Promotion

Promotion says:

> "You are eligible for 20% off."

Advisory says:

> "You may benefit from adding AI Assessment."

They can work together:

```text
Advisory
   ↓
AI Assessment recommended
   ↓
Promotion
   ↓
50% off AI Assessment
   ↓
Customer Decision
```

---

# 26. Commercial Opportunity Detection

The engine should identify opportunities such as:

```text
High AI Usage
      ↓
AI Credit Recommendation
```

```text
High Student Growth
      ↓
Tutor Capacity Recommendation
```

```text
Frequent Assessment Creation
      ↓
AI Assessment Recommendation
```

```text
Low Usage
      ↓
Optimization / Downgrade Recommendation
```

---

# 27. Opportunity Matrix

| Signal                    | Recommendation        |
| ------------------------- | --------------------- |
| AI > 80%                  | AI Credit Pack        |
| AI > 100%                 | Immediate AI Capacity |
| Many manual assessments   | AI Assessment         |
| Tutor capacity > 80%      | Add Tutor             |
| Student growth            | Capacity upgrade      |
| Heavy lesson creation     | AI Lesson Assistance  |
| Low feature usage         | Optimization          |
| Monthly + stable usage    | Annual plan           |
| Repeated manual workflows | Automation capability |

---

# 28. Solo Tutor Focus

Because most platform customers are expected to be **solo tutors**, recommendations should prioritize:

1. saving time;
2. increasing teaching capacity;
3. reducing repetitive work;
4. useful AI assistance;
5. avoiding unnecessary complexity;
6. predictable costs.

The platform should not assume that every tutor wants to become a multi-tutor organization.

---

# 29. Solo Tutor Advisory Example

Tutor behavior:

```text
Students:
35

Lessons:
24/month

Assessments:
18/month

AI usage:
72%

Tutors:
1
```

Recommendation:

```text
AI Assessment
```

Not:

```text
Add another tutor
```

because the available evidence does not support that recommendation.

---

# 30. Solo Tutor Growth Recommendation

Later:

```text
Students:
85

Lessons:
60/month

AI usage:
92%

Tutors:
1
```

The system may recommend:

```text
1. AI Credit Pack
2. AI Assessment
3. Additional Tutor
```

with ranking:

```text
AI Credit Pack
██████████ 94%

AI Assessment
████████░░ 82%

Additional Tutor
██████░░░░ 61%
```

---

# 31. Recommendation Ranking

Recommendations should be ranked using:

```text
Relevance
+
Expected Customer Benefit
+
Evidence Strength
+
Timing
+
Commercial Fit
```

A possible conceptual score:

```text
Recommendation Score =
    Relevance ×
    Evidence ×
    Benefit ×
    Timing
```

The actual implementation can use a more sophisticated scoring model later.

---

# 32. Recommendation Priority

| Priority      | Meaning                  |
| ------------- | ------------------------ |
| Critical      | Customer may be blocked  |
| High          | Strong immediate benefit |
| Medium        | Useful improvement       |
| Low           | Optional optimization    |
| Informational | Awareness only           |

---

# 33. Avoid Recommendation Spam

The platform should limit repeated recommendations.

Example:

```text
AI Credit Recommendation
```

shown today should not appear:

```text
Every time the tutor opens the dashboard.
```

Possible suppression:

```text
Dismissed
    ↓
Suppress for 30 days
```

---

# 34. Dismissal

Customer may choose:

```text
Not now
Not relevant
Too expensive
Already handled
Don't show this again
```

These actions become advisory signals.

---

# 35. Dismissal Learning

If a tutor repeatedly dismisses:

```text
Additional Tutor
```

the platform should reduce its priority.

This creates an adaptive advisory system.

---

# 36. Recommendation Frequency

Recommended initial policy:

| Recommendation | Frequency                      |
| -------------- | ------------------------------ |
| Critical       | Until resolved                 |
| High           | Once per billing period        |
| Medium         | Once per 30 days               |
| Low            | Once per 60–90 days            |
| Dismissed      | Suppressed according to policy |

---

# 37. Recommendation Expiration

A recommendation must expire when its underlying evidence becomes invalid.

Example:

```text
AI Usage = 95%
```

Recommendation:

```text
Add AI Credits
```

Later:

```text
AI Usage = 30%
```

The recommendation should automatically become:

```text
Expired / No Longer Relevant
```

---

# 38. Recommendation Recalculation

Advisory should react to significant events.

```text
Usage Updated
     ↓
Evaluate Rules
     ↓
Existing Recommendation?
     │
     ├── Still Relevant → Update
     ├── No Longer Relevant → Expire
     └── New Opportunity → Create
```

---

# 39. Advisory Events

The context may consume:

```text
LessonCreated
AssessmentCreated
AIUsageUpdated
StudentAdded
TutorAdded
CapabilityEnabled
CapabilityDisabled
SubscriptionChanged
BillingCycleChanged
InvoicePaid
PromotionAvailable
TrialEnding
```

---

# 40. Advisory Events Published

The context should publish:

```text
RecommendationCreated
RecommendationUpdated
RecommendationViewed
RecommendationDismissed
RecommendationAccepted
RecommendationExpired
RecommendationConverted
```

---

# 41. Recommendation Conversion

The platform should measure:

```text
Recommendation
      ↓
Viewed
      ↓
Clicked
      ↓
Configuration Started
      ↓
Configuration Confirmed
      ↓
Subscription Changed
```

This creates a conversion funnel.

---

# 42. Advisory Analytics

Example:

```text
AI Credit Recommendation

Generated:
2,400

Viewed:
1,900

Clicked:
800

Accepted:
320

Conversion:
13.3%
```

This allows the business to improve recommendation quality.

---

# 43. Customer Benefit Measurement

Commercial conversion alone is not enough.

The platform should eventually measure:

```text
Recommendation
      ↓
Capability Added
      ↓
Capability Used
      ↓
Customer Outcome
```

Example:

```text
AI Assessment recommended
        ↓
Enabled
        ↓
Used 40 times
        ↓
Manual work reduced
```

This is much more valuable than simply measuring revenue.

---

# 44. Recommendation Quality

A recommendation can be evaluated using:

```text
Relevance
Acceptance
Usage After Acceptance
Retention
Customer Satisfaction
Commercial Conversion
```

A recommendation that produces revenue but is never used should eventually be considered low quality.

---

# 45. AI-Powered Advisory

AI can later improve Product Advisory.

Example:

```text
Usage Data
     ↓
Rules Engine
     ↓
AI Analysis
     ↓
Recommendation
```

AI can identify patterns such as:

> "This tutor repeatedly creates lesson content manually and then generates assessments separately. AI-assisted lesson creation plus AI Assessment may reduce repetitive work."

---

# 46. AI Must Not Become the Source of Truth

AI can recommend:

```text
"Consider adding AI Assessment."
```

But it must not decide:

```text
"Enable AI Assessment automatically."
```

AI should operate inside the same commercial boundaries.

---

# 47. Rules + AI Architecture

Recommended:

```text
              Usage Signals
                    │
             ┌──────┴──────┐
             ▼             ▼
        Rules Engine       AI Analysis
             │             │
             └──────┬──────┘
                    ▼
             Recommendation
                    │
                    ▼
              Customer Review
```

Rules provide safety and determinism.

AI provides richer interpretation.

---

# 48. Advisory Guardrails

AI recommendations must respect:

* available products;
* current pricing;
* eligibility;
* customer subscription;
* licensing constraints;
* promotion validity;
* capacity limits.

AI should never invent:

```text
A capability
A price
A promotion
An entitlement
```

---

# 49. Recommendation Source

Every recommendation should identify its source.

```text
Source:
Rule

Source:
AI Analysis

Source:
Promotion

Source:
Usage Threshold

Source:
Lifecycle Event
```

This improves auditability.

---

# 50. Recommendation Explanation

Example:

```text
Why are you seeing this?

You have used 91% of your included AI credits
this billing period.

You have also used AI-assisted lesson creation
more frequently during the last three weeks.

Adding 25K AI Credits may help you continue
without waiting for the next billing period.
```

---

# 51. Advisory and Pricing

Product Advisory should never calculate arbitrary prices.

Instead:

```text
Advisory
   ↓
Recommended Configuration
   ↓
Product Configuration Engine
   ↓
Current Price
   ↓
Promotion Engine
   ↓
Final Commercial Price
```

This ensures that recommendations always use the same pricing logic as real purchases.

---

# 52. Advisory and Billing

The advisory engine may say:

```text
Estimated additional cost:
$5/month
```

But the authoritative amount comes from:

```text
Billing Preview
```

Therefore:

> **Advisory prices are informative; Billing prices are authoritative.**

---

# 53. Advisory and Licensing

The recommendation may say:

```text
Enable AI Assessment
```

but Licensing is responsible for:

```text
Can the Workspace use AI Assessment?
```

Flow:

```text
Recommendation
   ↓
Customer Accepts
   ↓
Configuration
   ↓
Subscription
   ↓
Licensing
   ↓
Capability Enabled
```

---

# 54. Advisory and Promotions

The advisory engine can include eligible offers.

Example:

```text
You may benefit from AI Assessment.

Good news:
AI Assessment is currently 50% off
for your Workspace.
```

The promotion engine remains responsible for determining eligibility.

---

# 55. Advisory and Design Your Plan

This is the most important commercial experience.

```text
Usage
   ↓
Advisory
   ↓
Recommended Components
   ↓
Design Your Plan
   ↓
Price Preview
   ↓
Promotion
   ↓
Final Price
   ↓
Customer Confirmation
```

---

# 56. Recommended Plan Example

```text
Based on your Workspace activity:

Current:
Solo Professional

Recommended:
Solo Professional

Add:
✓ AI Assessment
✓ 25K AI Credits

Do not add:
✗ Additional Tutor

Estimated monthly price:
$29
```

The customer remains in control.

---

# 57. Advisory Could Recommend Against Spending

This is strategically important.

Example:

```text
You currently use only 12% of your
included AI allowance.

You probably do not need additional
AI credits at this time.
```

This improves trust.

---

# 58. Trust Model

The platform should optimize:

```text
Customer Success
        +
Customer Trust
        +
Product Adoption
        +
Sustainable Revenue
```

rather than:

```text
Maximum Upsell
```

---

# 59. Advisory Decision Matrix

| Situation                   | Recommendation     |
| --------------------------- | ------------------ |
| Low usage                   | No upgrade         |
| High AI usage               | AI credits         |
| High manual assessment work | AI Assessment      |
| High student growth         | Capacity           |
| High tutor capacity         | Additional tutor   |
| Low feature usage           | Optimization       |
| Stable annual usage         | Annual billing     |
| Trial nearing end           | Conversion         |
| Promotion available         | Relevant promotion |
| Overprovisioned plan        | Downgrade          |

---

# 60. Recommendation Eligibility

Before generating a recommendation:

```text
1. Is the product available?
2. Is the Workspace eligible?
3. Is the customer already subscribed?
4. Is the capability already enabled?
5. Is there sufficient evidence?
6. Is the recommendation timely?
7. Has it recently been dismissed?
8. Is there a valid commercial offer?
```

Only then should a recommendation be created.

---

# 61. Advisory Decision Pipeline

```text
Signals
   ↓
Normalize
   ↓
Evaluate Eligibility
   ↓
Detect Opportunity
   ↓
Generate Candidate
   ↓
Calculate Confidence
   ↓
Rank
   ↓
Apply Suppression Rules
   ↓
Publish Recommendation
```

---

# 62. Recommendation Engine

The initial implementation can use deterministic rules.

Example:

```text
IF
    AIUsagePercentage >= 85%
AND
    AIUsageTrend = Increasing
AND
    CurrentPlanHasAI
THEN
    Recommend AI Credit Pack
```

Later:

```text
Rules
+
Machine Learning
+
AI Analysis
```

can improve the system.

---

# 63. Rule Definition

Conceptually:

```text
AdvisoryRule
│
├── Rule ID
├── Name
├── Trigger
├── Conditions
├── Recommendation Type
├── Priority
├── Cooldown
├── Confidence
└── Validity
```

---

# 64. Example Rule

```text
Rule:
HIGH_AI_USAGE

Condition:
AI usage >= 85%

AND:
usage trend increasing

Recommendation:
25K AI Credit Pack

Priority:
High

Cooldown:
30 days
```

---

# 65. Rule Versioning

Rules should be versioned.

```text
HIGH_AI_USAGE v1
Threshold = 85%

HIGH_AI_USAGE v2
Threshold = 80%
```

Existing recommendations should preserve the rule version that generated them.

---

# 66. Advisory Snapshot

A recommendation should preserve the evidence that generated it.

```text
Recommendation
│
├── Rule Version
├── Usage Snapshot
├── Subscription Snapshot
├── Product Snapshot
├── Promotion Snapshot
└── Recommendation Result
```

This allows support teams to understand:

> "Why did the system recommend this?"

---

# 67. Recommendation Audit

Example:

```text
Recommendation ID:
REC-10245

Generated:
Aug 8, 2026

Rule:
HIGH_AI_USAGE v2

Evidence:
AI Usage = 91%

Current Plan:
Solo Professional

Recommended:
25K AI Credits

Confidence:
94%
```

---

# 68. Customer Experience

Recommendations may appear in:

* Workspace dashboard;
* usage page;
* AI usage panel;
* subscription management;
* Design Your Plan;
* billing preview;
* notification center.

The advisory context itself does not own these UI surfaces.

---

# 69. Notification Strategy

Not every recommendation should generate a notification.

Example:

| Priority      | Dashboard | Notification |
| ------------- | --------- | ------------ |
| Critical      | Yes       | Yes          |
| High          | Yes       | Maybe        |
| Medium        | Yes       | No           |
| Low           | Optional  | No           |
| Informational | Optional  | No           |

---

# 70. Recommendation Personalization

The system can personalize recommendations based on:

```text
Workspace Size
Teaching Style
Usage Pattern
Enabled Features
Growth Pattern
AI Usage
Commercial History
```

However, recommendations should remain explainable.

---

# 71. Commercial Personalization

The system may eventually recommend:

```text
"Annual billing may save you $58/year."
```

based on:

```text
Stable monthly usage
+
Long subscription history
```

This is a commercial recommendation.

---

# 72. Retention Advisory

Product Advisory can also identify churn risks.

Example signals:

```text
Usage dropped 70%
Login frequency dropped
Capabilities unused
Subscription renewal approaching
```

Recommendation:

```text
"Would you like help optimizing your Workspace?"
```

This is preferable to immediately offering a discount.

---

# 73. Retention Recommendation Types

```text
Usage Help
Configuration Optimization
Feature Education
Plan Optimization
Discount
Pause
Downgrade
Cancellation Support
```

---

# 74. Ethical Commercial Boundary

The platform should not intentionally create artificial urgency.

Avoid:

```text
"Upgrade now or you will lose everything!"
```

unless there is a genuine policy-driven consequence.

Prefer:

```text
"Your current plan will renew on September 8."
```

and:

```text
"You are currently using 91% of your included AI allowance."
```

---

# 75. Product Advisory Capability Matrix

| Capability                    | V1 | Future |
| ----------------------------- | -: | -----: |
| Usage-based recommendations   |  ✓ |        |
| Upgrade recommendations       |  ✓ |        |
| Add-on recommendations        |  ✓ |        |
| AI credit recommendations     |  ✓ |        |
| Capacity recommendations      |  ✓ |        |
| Annual billing recommendation |  ✓ |        |
| Promotion recommendations     |  ✓ |        |
| Recommendation dismissal      |  ✓ |        |
| Recommendation cooldown       |  ✓ |        |
| Explainability                |  ✓ |        |
| Rule engine                   |  ✓ |        |
| AI-generated recommendations  |    |      ✓ |
| Predictive churn              |    |      ✓ |
| Predictive demand             |    |      ✓ |
| Personalized configuration    |    |      ✓ |
| Outcome-based recommendations |    |      ✓ |

---

# 76. Product Advisory Data Flow

```text
┌─────────────────────┐
│ Learning Workspace  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Usage & Metering    │
└──────────┬──────────┘
           │
           ▼
┌────────────────────────────────┐
│       Product Advisory         │
│                                │
│  Signals                       │
│     ↓                          │
│  Rules                         │
│     ↓                          │
│  AI Analysis                   │
│     ↓                          │
│  Candidate                     │
│     ↓                          │
│  Ranking                       │
│     ↓                          │
│  Recommendation                │
└──────────┬─────────────────────┘
           │
           ▼
┌─────────────────────┐
│ Customer Experience │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Design Your Plan    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Configuration       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Subscription        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Billing             │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Licensing           │
└─────────────────────┘
```

---

# 77. End-to-End Example

A solo tutor has:

```text
35 Students
1 Tutor
42 Lessons / Month
31 Assessments / Month
AI Usage = 88%
```

Current subscription:

```text
Solo Professional
```

The Advisory Engine detects:

```text
AI usage high
+
Assessment workload high
+
Tutor capacity low
```

It generates:

```text
Recommendation #1
AI Assessment
Confidence: 94%

Recommendation #2
25K AI Credits
Confidence: 91%

Recommendation #3
Additional Tutor
Confidence: 63%
```

The platform presents:

```text
Recommended for your Workspace

1. AI Assessment
   High impact

2. 25K AI Credits
   You are approaching your limit

3. Additional Tutor
   Consider if you plan to grow
```

The tutor selects:

```text
AI Assessment
+
25K AI Credits
```

The system opens:

```text
Design Your Plan
```

The customer reviews:

```text
Solo Professional        $19
AI Assessment              $5
25K AI Credits             $5
-----------------------------
Total                     $29
```

Customer confirms.

Then:

```text
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
Capabilities Enabled
```

---

# 78. Complete Commercial Architecture

At this point the Commercial Domain becomes:

```text
┌──────────────────────────────────────────────────────────────┐
│                      COMMERCIAL DOMAIN                       │
│                                                              │
│  Product Management                                          │
│          │                                                   │
│          ▼                                                   │
│  Product Configuration Engine                                │
│          │                                                   │
│          ▼                                                   │
│  Subscription Management                                     │
│          │                                                   │
│    ┌─────┼───────────────┐                                   │
│    ▼     ▼               ▼                                   │
│ Billing Promotion     Licensing                              │
│    │     │               │                                   │
│    │     │               ▼                                   │
│    │     │          Entitlements                             │
│    │     │                                                   │
│    │     └──────┐                                            │
│    │            ▼                                            │
│    │      Product Advisory ◄──────── Usage & Metering        │
│    │            │                                            │
│    │            ▼                                            │
│    │      Recommendations                                    │
│    │            │                                            │
│    │            ▼                                            │
│    │      Design Your Plan                                   │
│    │            │                                            │
│    └────────────┴──────────────► Customer Decision            │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

# 79. Architectural Principles

### PA-001 — Advisory Is Recommendation Only

Product Advisory cannot directly modify subscriptions.

### PA-002 — Evidence-Based

Every meaningful recommendation must have identifiable evidence.

### PA-003 — Explainable

The customer should understand why the recommendation exists.

### PA-004 — Customer-Controlled

Commercial changes require customer confirmation.

### PA-005 — Pricing Authority

Advisory never becomes the source of truth for price.

### PA-006 — Entitlement Authority

Advisory never grants entitlements.

### PA-007 — Usage Authority

Advisory never becomes the source of truth for consumption.

### PA-008 — Versioned

Rules and recommendation evidence must be historically reproducible.

### PA-009 — Suppression-Aware

Dismissed recommendations should not repeatedly annoy customers.

### PA-010 — Outcome-Oriented

Long-term recommendation quality should be measured by customer benefit, not only conversion.

---

# 80. Recommended V1 Scope

For the first implementation, Product Advisory should remain intentionally simple.

### V1

```text
✓ Rule-based recommendations
✓ Usage thresholds
✓ Upgrade recommendations
✓ Add-on recommendations
✓ AI credit recommendations
✓ Capacity recommendations
✓ Annual billing recommendations
✓ Promotion recommendations
✓ Recommendation explanation
✓ Recommendation dismissal
✓ Cooldown
✓ Recommendation analytics
✓ Design Your Plan integration
```

### Later

```text
○ AI-generated recommendations
○ Predictive churn
○ Predictive usage
○ Personalized configuration
○ Intelligent price optimization
○ Outcome-based recommendations
○ Cross-Workspace recommendations
```

---

# 81. Final Concept

The most important architectural idea is:

```text
                    CUSTOMER
                       │
                       ▼
                 USES WORKSPACE
                       │
                       ▼
                  USAGE SIGNALS
                       │
                       ▼
                PRODUCT ADVISORY
                       │
                       ▼
                "I recommend..."
                       │
                       ▼
              CUSTOMER DECISION
                       │
                       ▼
              DESIGN YOUR PLAN
                       │
                       ▼
                CONFIGURATION
                       │
                       ▼
                SUBSCRIPTION
                       │
              ┌────────┴────────┐
              ▼                 ▼
           BILLING          LICENSING
              │                 │
              ▼                 ▼
           PAYMENT          CAPABILITIES
```

This gives us a very powerful commercial architecture:

> **The platform observes how a tutor actually works, understands where the Workspace could help them more, recommends a relevant configuration, lets the tutor decide, and then uses the existing Configuration → Subscription → Billing → Licensing pipeline to execute that decision.**

That keeps the system modular while giving us a foundation for the **intelligent "Design Your Plan" experience** we discussed.
