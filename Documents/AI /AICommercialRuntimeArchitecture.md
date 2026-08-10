# AICommercialRuntimeArchitecture.md

**Version:** 1.0
**Status:** Draft
**Bounded Context:** AI Platform Runtime
**Related Domains:** Learning Workspace, Commercial Domain, Identity & Access
**Purpose:** Define the runtime architecture for executing AI capabilities under the Platform's commercial authorization, usage, and entitlement model.

---

# 1. Purpose

This document defines how the Platform executes an AI request from the moment a user invokes the AI Assistant until the final response is returned.

The runtime must coordinate:

* Identity
* Workspace
* AI capability
* Licensing
* Entitlements
* Usage & Metering
* AI orchestration
* Context assembly
* Skills
* Model routing
* AI providers
* Validation
* Usage commitment
* Auditability

The runtime must remain independent from the commercial implementation details that determine how the user acquired the AI capability.

**Document boundary:** this document owns *technical execution* — the concrete pipeline a request moves through, from gateway to provider to response. It does not own how entitlement, usage rating, or billing state is derived; that is `AICommercialIntegrationArchitecture.md`'s concern, referenced here only at the two checkpoints where the runtime must call into it (authorization before execution, usage commit after execution).

---

# 2. Core Runtime Principle

The AI runtime follows:

```text
Identify
   ↓
Authorize
   ↓
Reserve
   ↓
Prepare Context
   ↓
Execute
   ↓
Validate
   ↓
Measure
   ↓
Commit Usage
   ↓
Respond
```

The runtime must never execute a commercially controlled AI capability before authorization.

---

# 3. Architectural Boundary

The AI Commercial Runtime sits between the Platform's Workspace experience and the AI provider infrastructure.

```text
┌─────────────────────────────────────────────┐
│              Learning Workspace             │
│                                             │
│  Tutor / Student / Admin                    │
└──────────────────────┬──────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────┐
│                AI Runtime                   │
│                                             │
│  AI Gateway                                 │
│  Authorization                              │
│  Usage Reservation                          │
│  Context Assembly                           │
│  AI Orchestrator                            │
│  Skill Execution                            │
│  Model Routing                              │
│  Validation                                 │
└──────────────────────┬──────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────┐
│             AI Provider Layer               │
│                                             │
│  Provider A                                 │
│  Provider B                                 │
│  Provider C                                 │
└─────────────────────────────────────────────┘
```

Supporting commercial services remain outside the AI runtime:

```text
Licensing & Entitlements
Usage & Metering
Subscription
Billing
Product Configuration
```

---

# 4. Runtime Authorities

The runtime must respect the following authorities.

| Decision                          | Authority             |
| --------------------------------- | --------------------- |
| Who is the user?                  | Identity              |
| Which Workspace?                  | Workspace / Access    |
| Can the Workspace use AI?         | Licensing             |
| Which AI capability is allowed?   | Effective Entitlement |
| How much usage remains?           | Usage & Metering      |
| What AI operation should execute? | AI Domain             |
| Which Skill implements it?        | AI Skill Registry     |
| Which model executes it?          | Model Router          |
| Which provider executes it?       | Provider Routing      |
| What was actually consumed?       | Usage & Metering      |
| What is financially owed?         | Billing               |

---

# 5. Request Lifecycle

Every AI request follows the conceptual pipeline:

```text
User
 ↓
Workspace UI
 ↓
AI Gateway
 ↓
Identity Resolution
 ↓
Workspace Resolution
 ↓
Capability Resolution
 ↓
Entitlement Authorization
 ↓
Usage Availability
 ↓
Usage Reservation
 ↓
Context Assembly
 ↓
AI Orchestrator
 ↓
Skill
 ↓
Model Router
 ↓
Provider
 ↓
AI Response
 ↓
Validation
 ↓
Usage Measurement
 ↓
Usage Commit
 ↓
Response
```

---

# 6. AI Gateway

The AI Gateway is the entry point into the AI runtime.

Its responsibilities include:

* Request validation
* Authentication propagation
* Workspace identification
* Actor identification
* Correlation ID creation
* Request normalization
* Idempotency handling
* Routing to the appropriate AI capability

The Gateway must not implement business-specific AI behavior.

---

# 7. AI Request

A conceptual request is:

```text
AIRequest
│
├── RequestId
├── CorrelationId
├── WorkspaceId
├── ActorId
├── Capability
├── Operation
├── Input
├── ContextReference
└── IdempotencyKey
```

Example:

```text
Capability:
Learning.LessonGeneration

Operation:
GenerateLesson

Workspace:
workspace-123

Actor:
tutor-456
```

---

# 8. Client Trust Boundary

The client may provide:

```text
Capability
Operation
Input
Context
```

but the server must independently resolve:

```text
Workspace
Actor
Entitlement
Usage Policy
Quality Tier
Provider
Model
```

The client must never be trusted to declare:

```text
Plan = Premium
Credits = 50000
Provider = X
Model = Y
```

---

# 9. Identity Resolution

The AI Gateway resolves the authenticated actor.

The resulting execution context contains:

```text
ActorId
ActorType
WorkspaceId
```

Possible actor types include:

```text
Tutor
Student
Administrator
System
AI Agent
```

The AI runtime should not infer authorization from actor type alone.

---

# 10. Workspace Resolution

AI execution is always evaluated within a Workspace context.

```text
Actor
 ↓
Workspace Access
 ↓
WorkspaceId
 ↓
AI Authorization
```

This prevents a user from accidentally or intentionally using an entitlement belonging to another Workspace.

---

# 11. Workspace Boundary

The runtime must treat:

```text
Workspace A
```

and:

```text
Workspace B
```

as separate commercial and data boundaries.

Even when the same person belongs to both:

```text
User
 ├── Workspace A
 │     └── AI Entitlement A
 │
 └── Workspace B
       └── AI Entitlement B
```

The AI runtime must never assume that a user's entitlement transfers between Workspaces.

---

# 12. Capability Resolution

The request identifies an AI capability.

Example:

```text
Learning.LessonGeneration
```

The AI runtime resolves that capability against the registered AI capability catalog.

Conceptually:

```text
Capability
 ↓
Capability Definition
 ↓
Required Entitlement
 ↓
Skill
```

---

# 13. AI Capability

An AI Capability represents a customer-visible or platform-level ability.

Examples:

```text
AI Assistant
Lesson Generation
Question Generation
Transcript Generation
Content Summarization
Student Feedback
Learning Recommendation
```

A capability is not the same thing as a model.

---

# 14. AI Skill

A Skill represents the executable AI behavior.

Example:

```text
Capability:
Lesson Generation

Skill:
GenerateLessonFromTranscript
```

Another implementation might be:

```text
Capability:
Question Generation

Skill:
GenerateInteractiveQuestions
```

The commercial entitlement applies to the capability.

The runtime executes the Skill.

---

# 15. Entitlement Resolution

Before execution:

```text
AI Gateway
   ↓
Licensing
   ↓
Effective Entitlement
```

The AI runtime asks:

```text
HasEntitlement(
    WorkspaceId,
    Capability,
    Level
)
```

The AI runtime does not inspect:

```text
Subscription.PlanName
```

or:

```text
Product.Code
```

to determine access.

---

# 16. Authorization Result

Authorization produces an internal execution authorization:

```text
AIExecutionAuthorization
│
├── Allowed
├── WorkspaceId
├── Capability
├── Level
├── UsageMeter
├── UsagePolicy
├── QualityTier
└── CorrelationId
```

Example:

```text
Allowed:
true

Capability:
LessonGeneration

Level:
AI+

Meter:
AICredits

Policy:
BlockOnExhaustion

QualityTier:
Standard
```

---

# 17. Authorization Failure

If the capability is not entitled:

```text
Allowed = false
```

The AI runtime must stop before provider execution.

The response should contain a domain-level reason such as:

```text
AI_CAPABILITY_NOT_ENTITLED
```

or:

```text
AI_USAGE_EXHAUSTED
```

The exact public API error contract should be defined separately.

---

# 18. Usage Availability

If the capability is entitled, the runtime evaluates the applicable usage policy.

Example:

```text
Allowance:
75,000

Consumed:
42,380

Remaining:
32,620
```

The runtime must determine whether the requested operation can proceed.

---

# 19. Usage Estimation

The Skill or AI runtime may estimate expected usage.

Example:

```text
Estimated AI Credits:
1,500
```

The estimate may be based on:

* Input size
* Expected output size
* Operation type
* Model
* Quality tier
* Historical execution patterns

The estimate is not the final usage record.

---

# 20. Usage Reservation

When reservation is required:

```text
Estimated Usage
      ↓
UsageReservation
      ↓
AI Execution
```

The reservation protects the allowance from concurrent requests.

---

# 21. Concurrent Requests

Suppose:

```text
Remaining:
2,000
```

Two requests arrive simultaneously:

```text
Request A:
1,500

Request B:
1,000
```

Without reservation:

```text
Both appear valid
```

and the Workspace could consume:

```text
2,500
```

despite having only:

```text
2,000
```

Reservation prevents this race.

---

# 22. Reservation Failure

If the usage reservation fails:

```text
AI Request
 ↓
Authorization
 ↓
Reservation
 ↓
Rejected
```

The provider must not be called.

---

# 23. Context Assembly

After authorization and reservation, the runtime assembles the AI execution context.

```text
Context Assembly
│
├── User Context
├── Workspace Context
├── Learning Context
├── Request Context
├── Conversation Context
├── Content Context
└── Skill Context
```

Context assembly must obey Workspace and data-access boundaries.

---

# 24. Context Authority

The AI runtime should not blindly accept arbitrary context supplied by the client.

For example:

```text
Client:
"Use this student record."
```

The runtime must verify that the actor is authorized to access that record.

The AI system should receive only context already authorized by the relevant domain.

---

# 25. Learning Context

For learning-related AI operations, context may include:

```text
Course
Lesson
Learning Asset
Student
Assignment
Assessment
Conversation
Learning Objective
```

The AI runtime should consume domain-provided context rather than directly bypassing domain boundaries.

---

# 26. Context Provider Pattern

A Skill should request context through a context provider.

Conceptually:

```text
Skill
 ↓
Context Provider
 ↓
Learning Workspace
 ↓
Authorized Context
```

This keeps AI execution independent from the internal persistence model of Learning Workspace.

---

# 27. AI Orchestrator

The AI Orchestrator coordinates execution.

Its responsibilities include:

* Skill selection
* Context assembly
* Model routing
* Provider invocation
* Retry policy
* Timeout handling
* Validation
* Usage measurement
* Execution tracing

It does not own commercial entitlement rules.

---

# 28. Orchestrator Flow

```text
AI Request
    ↓
Resolve Skill
    ↓
Build Context
    ↓
Resolve Model
    ↓
Execute
    ↓
Validate
    ↓
Measure
    ↓
Commit Usage
    ↓
Return Result
```

---

# 29. Skill Registry

The Skill Registry maps:

```text
Capability
```

to:

```text
Skill
```

Example:

```text
LessonGeneration
        ↓
GenerateLessonSkill
```

and:

```text
QuestionGeneration
        ↓
GenerateQuestionSkill
```

The registry should not contain pricing.

---

# 30. Skill Metadata

A Skill may declare:

```text
SkillDefinition
│
├── SkillId
├── Capability
├── InputSchema
├── OutputSchema
├── RequiredContext
├── UsageMeter
├── EstimatedUsageStrategy
├── SupportedQualityTiers
└── ValidationPolicy
```

The `UsageMeter` identifies the commercial measurement model without making the Skill responsible for billing.

---

# 31. Model Router

The Model Router determines which model should execute the Skill.

Input:

```text
Skill
QualityTier
Context
Availability
ProviderPolicy
```

Output:

```text
ModelSelection
```

Example:

```text
QualityTier:
Standard

Model:
Model-A

Provider:
Provider-X
```

---

# 32. Commercial Independence of Model Routing

The commercial product should not normally say:

```text
Use Provider X Model Y
```

Instead:

```text
Premium AI
```

may resolve to:

```text
Quality Tier:
Premium
```

The infrastructure layer determines the actual model.

---

# 33. Model Failover

If the selected provider fails:

```text
Model A
   ↓
Provider Failure
   ↓
Model Router
   ↓
Model B
```

The fallback must remain compatible with:

```text
Entitlement
Quality Tier
Usage Policy
```

If the fallback has different usage economics, the resulting usage must still be accurately measured.

---

# 34. Provider Adapter

Each provider is isolated behind an adapter.

```text
AI Orchestrator
       ↓
Provider Abstraction
       ↓
Provider Adapter
       ↓
External AI Provider
```

Provider-specific SDKs must not leak into Skills.

---

# 35. Provider Request

The provider adapter translates the normalized request into provider-specific input.

```text
Normalized AI Request
        ↓
Provider Adapter
        ↓
Provider Request
```

The reverse occurs for the response.

---

# 36. Provider Response

The provider adapter normalizes:

```text
Provider Response
```

into:

```text
Normalized AI Result
```

including, where available:

```text
Input Tokens
Output Tokens
Total Tokens
Model
Provider
Latency
Provider Request Id
```

---

# 37. AI Result

The normalized result may contain:

```text
AIResult
│
├── Result
├── Model
├── Provider
├── ProviderRequestId
├── RawUsage
├── Duration
└── ExecutionMetadata
```

The customer-facing response should contain only what the relevant Workspace feature needs.

---

# 38. Validation

AI output must pass the Skill's validation policy before finalization.

Validation may include:

```text
Schema Validation
Safety Validation
Domain Validation
Required Field Validation
Content Validation
```

For example:

```text
GenerateQuestion
```

must produce a valid question structure before it is persisted.

---

# 39. Structured AI Output

Where the Skill expects structured output:

```text
Question
├── Type
├── Text
├── Options
├── CorrectAnswer
└── Explanation
```

the runtime should validate the structure before returning it.

Invalid output should not silently become persisted Learning data.

---

# 40. Retry Policy

Retries may occur for:

```text
Transient Provider Failure
Timeout
Rate Limit
Temporary Network Failure
```

Retries must be controlled.

The runtime must avoid:

```text
Unbounded Retry
```

because every retry may create additional provider usage.

---

# 41. Retry and Usage

Each provider execution must be measurable.

Example:

```text
Attempt 1:
1,000 credits

Attempt 2:
1,200 credits

Successful result:
Attempt 2
```

The commercial usage record must account for actual consumption according to the configured usage policy.

---

# 42. Idempotency

AI operations must support idempotency where appropriate.

A request should contain:

```text
IdempotencyKey
```

The runtime can then prevent accidental duplicate execution caused by:

```text
Browser Retry
Network Retry
Client Retry
Gateway Retry
```

---

# 43. Execution Identity

Each actual provider call receives a unique:

```text
ExecutionId
```

The relationship becomes:

```text
OperationId
   │
   ├── ExecutionId 1
   ├── ExecutionId 2
   └── ExecutionId 3
```

This supports retry and usage reconciliation.

---

# 44. Usage Measurement

After execution:

```text
Provider Response
      ↓
Raw Provider Usage
      ↓
Usage Normalization
      ↓
Commercial Meter
      ↓
Usage Event
```

The AI runtime provides the execution facts.

Usage & Metering owns the resulting commercial usage record.

---

# 45. Usage Commit

The reservation is finalized after actual usage is known.

Example:

```text
Reserved:
1,500

Actual:
1,320
```

Result:

```text
Commit:
1,320

Release:
180
```

---

# 46. Usage Adjustment

If the provider reports delayed or corrected usage:

```text
Initial:
1,320

Corrected:
1,400
```

Usage & Metering should create an adjustment rather than rewriting the historical event.

---

# 47. Failed Execution

If the AI operation fails before provider execution:

```text
Reservation:
Release
```

If provider execution occurred:

```text
Provider Usage:
Measure

Reservation:
Reconcile

Usage:
Record according to policy
```

Failure does not automatically mean zero provider consumption.

---

# 48. Response Pipeline

The final response path is:

```text
AI Provider
 ↓
Provider Adapter
 ↓
Normalized Result
 ↓
Validation
 ↓
Usage Measurement
 ↓
Usage Commit
 ↓
Skill Result
 ↓
AI Gateway
 ↓
Workspace
```

---

# 49. Response Persistence

The AI runtime should not automatically persist every response.

Persistence depends on the capability.

For example:

```text
AI Chat
```

may persist conversation messages.

While:

```text
GenerateLessonPreview
```

may return a draft without persistence.

The owning domain decides persistence semantics.

---

# 50. Learning Content Creation

For generated Learning content:

```text
AI
 ↓
Generated Lesson
 ↓
Learning Workspace
 ↓
Draft / Publish Lifecycle
```

AI should generate content.

Learning Workspace owns:

```text
Lesson State
Draft
Published
Version
Publishing
```

AI must not own the lesson lifecycle.

---

# 51. AI Assistant Conversation

For conversational AI:

```text
User
 ↓
AI Assistant
 ↓
Conversation Context
 ↓
Entitlement
 ↓
Usage
 ↓
AI Model
 ↓
Response
```

Conversation persistence remains a domain concern rather than a commercial concern.

---

# 52. Streaming Responses

The runtime may support streaming:

```text
AI Provider
 ↓
Partial Tokens
 ↓
AI Gateway
 ↓
Workspace
```

However, commercial usage must still be finalized based on the provider's actual usage information.

The streaming protocol must not bypass usage tracking.

---

# 53. Cancellation

If the user cancels an AI operation:

```text
Running
 ↓
Cancellation
 ↓
Provider Cancellation
 ↓
Measure Actual Usage
 ↓
Release Remaining Reservation
```

If the provider cannot cancel immediately, actual usage may still occur.

---

# 54. Timeout

If the operation times out:

```text
Timeout
 ↓
Stop Waiting
 ↓
Determine Provider Execution State
 ↓
Reconcile Usage
```

A timeout must not automatically be treated as:

```text
No Usage
```

---

# 55. AI Runtime Security

The AI runtime must enforce:

```text
Authentication
Authorization
Workspace Isolation
Context Authorization
Input Validation
Output Validation
Usage Authorization
Rate Limiting
Auditability
```

---

# 56. Prompt Security

The AI runtime should treat user-provided content as untrusted input.

Examples:

```text
Lesson Content
Student Input
Uploaded Documents
Web Content
Conversation Messages
```

may contain instructions that conflict with the system's intended behavior.

The Skill execution policy must maintain system-level control.

---

# 57. Context Injection Boundary

External content must not automatically become:

```text
System Instruction
```

The runtime should maintain distinct layers:

```text
System Instructions
Developer / Skill Instructions
Authorized Context
User Input
External Content
```

---

# 58. Data Minimization

Only context required by the Skill should be sent to the provider.

For example, a question-generation Skill may require:

```text
Lesson Content
Learning Objective
Difficulty
```

but not:

```text
Student Billing Information
Payment Information
Unrelated Workspace Data
```

---

# 59. Provider Data Boundary

The Platform should define which information can leave the Platform and be transmitted to an external provider.

The provider adapter is the enforcement boundary for provider-specific data transmission.

---

# 60. Provider Configuration

Provider configuration may include:

```text
Provider
Endpoint
Credentials
Model
Timeout
Retry Policy
Rate Limit
Data Policy
```

These are infrastructure configuration concerns.

They are not customer subscription configuration.

---

# 61. Secret Management

Provider credentials must never be stored in:

```text
AI Request
AI Skill
Workspace
Product Configuration
Subscription
```

They belong to secure infrastructure configuration.

---

# 62. Rate Limiting

AI runtime rate limiting is separate from commercial usage allowance.

For example:

```text
Commercial:
75K AI Credits
```

and:

```text
Runtime:
10 AI Requests / minute
```

are different policies.

Commercial entitlement answers:

> Can the Workspace use this capability?

Runtime rate limiting answers:

> Can the system safely process this request now?

---

# 63. Provider Rate Limits

Provider rate limits are also separate.

The runtime may need to manage:

```text
Platform Rate Limit
Workspace Rate Limit
Provider Rate Limit
```

without confusing them with customer commercial allowances.

---

# 64. Runtime Quotas

The Platform may additionally enforce technical quotas:

```text
Max Prompt Size
Max Output Size
Max Concurrent Requests
Max Request Duration
```

These are technical safety controls.

They are not automatically customer pricing rules.

---

# 65. Commercial Policy vs Runtime Policy

The architecture therefore distinguishes:

```text
Commercial Policy
    ↓
What the customer is entitled to use

Runtime Policy
    ↓
What the infrastructure can safely execute
```

Both must succeed.

---

# 66. Runtime Decision

The complete authorization decision is:

```text
Commercial Authorization
        AND
Technical Runtime Authorization
        ↓
Execute
```

If either fails:

```text
Do Not Execute
```

---

# 67. AI Runtime Error Categories

The runtime should distinguish:

```text
AUTHORIZATION_ERROR
USAGE_EXHAUSTED
RATE_LIMITED
CONTEXT_ACCESS_DENIED
INVALID_INPUT
MODEL_UNAVAILABLE
PROVIDER_ERROR
TIMEOUT
VALIDATION_FAILED
EXECUTION_CANCELLED
```

These should not be collapsed into a generic AI failure.

---

# 68. User Experience

The Workspace should translate runtime failures into understandable messages.

For example:

```text
Technical:
AI_USAGE_EXHAUSTED
```

Customer-facing:

```text
You've used all AI credits included in your current plan.
```

The AI runtime should return structured error codes rather than presentation text.

---

# 69. Commercial Upgrade Experience

When usage is exhausted:

```text
AI Runtime
   ↓
Usage Exhausted
   ↓
Commercial Error
   ↓
Workspace
   ↓
"Get More AI Credits"
```

The Workspace can then open:

```text
Product Configuration
```

for an upgrade or add-on.

---

# 70. AI Runtime Does Not Sell

The AI runtime does not:

```text
Create Products
Change Prices
Create Subscriptions
Process Payments
Grant Commercial Entitlements
```

It only consumes the resulting authorization.

---

# 71. AI Runtime Does Not Decide Pricing

For example:

```text
AI operation:
GenerateLesson

Usage:
2,400 credits
```

The AI runtime records the usage.

It does not decide:

```text
2,400 credits = $X
```

Commercial rating owns that decision.

---

# 72. AI Runtime and Billing

The runtime may emit:

```text
AIUsageMeasured
```

Usage & Metering owns the normalized usage.

Billing consumes rated commercial information when applicable.

```text
AI Runtime
 ↓
Usage
 ↓
Rating
 ↓
Billing
```

---

# 73. Free AI

Free AI uses the same runtime.

Example:

```text
Product:
Free

Entitlement:
AI Assistant

Allowance:
500 credits
```

The runtime performs exactly the same flow:

```text
Authorize
Reserve
Execute
Measure
Commit
```

The difference is commercial configuration, not runtime architecture.

---

# 74. Included AI

Example:

```text
Product:
Tutor Standard

AI:
Included

Allowance:
10K credits
```

Again:

```text
Same Runtime
Different Entitlement
```

---

# 75. Paid AI Add-On

Example:

```text
Product:
Tutor Standard

AI Credits Add-On:
+50K
```

The runtime remains unchanged.

Only the effective entitlement changes.

---

# 76. Usage-Based AI

If overage is enabled:

```text
Included:
10K

Used:
12K

Overage:
2K
```

The runtime still performs:

```text
Authorize
Reserve
Execute
Measure
Commit
```

Commercial rating later determines the financial treatment.

---

# 77. Premium AI

Premium AI may provide:

```text
Higher Quality Tier
Larger Context
More Capable Model
Higher Allowance
```

The runtime receives the effective:

```text
QualityTier
```

and Model Router selects the appropriate infrastructure.

---

# 78. Runtime Quality Tier

Example:

```text
AI+
 ↓
QualityTier = Premium
 ↓
ModelRouter
 ↓
Premium-capable Model
```

The Skill does not need to know the customer's subscription name.

---

# 79. AI Agent Execution

Future AI Agents can use the same runtime.

```text
AI Agent
 ↓
Workspace Context
 ↓
Authorization
 ↓
Usage Reservation
 ↓
Skill
 ↓
Model
 ↓
Usage
```

This is consistent with the existing Usage model's actor attribution supporting future AI agents.

---

# 80. AI Agent Authority

An AI Agent must never inherit unlimited authority from the user.

The runtime must evaluate:

```text
Agent Identity
+
Workspace
+
Capability
+
Effective Entitlement
+
Tool Authorization
```

before execution.

---

# 81. Tool Execution

If an AI Assistant can invoke platform tools:

```text
AI
 ↓
Tool Request
 ↓
Tool Authorization
 ↓
Tool Execution
```

Tool execution must have its own authorization boundary.

An AI model's generated text must never itself constitute permission to perform a privileged operation.

---

# 82. Example: AI Creates a Lesson

```text
Tutor
 ↓
Generate Lesson
 ↓
Workspace Access
 ↓
AI LessonGeneration Entitlement
 ↓
Reserve Credits
 ↓
Load Authorized Lesson Context
 ↓
GenerateLesson Skill
 ↓
Model Router
 ↓
Provider
 ↓
Validate Lesson
 ↓
Commit Usage
 ↓
Return Draft
 ↓
Learning Workspace
```

Learning Workspace then controls whether the draft is:

```text
Saved
Edited
Published
```

---

# 83. Example: AI Generates Questions

```text
Tutor
 ↓
Generate Questions
 ↓
Entitlement Check
 ↓
Usage Reservation
 ↓
Load Lesson
 ↓
QuestionGeneration Skill
 ↓
Model
 ↓
Validate Question Schema
 ↓
Usage Commit
 ↓
Return Questions
```

The generated questions remain subject to the Learning Workspace lifecycle.

---

# 84. Example: Student AI Assistant

```text
Student
 ↓
Ask AI Assistant
 ↓
Workspace Authorization
 ↓
Student AI Entitlement
 ↓
Usage Check
 ↓
Conversation Context
 ↓
AI Skill
 ↓
Model
 ↓
Response
 ↓
Usage Commit
```

The commercial owner may be different from the actor.

---

# 85. Observability

Every AI execution should produce correlated telemetry.

Recommended identifiers:

```text
RequestId
CorrelationId
OperationId
ExecutionId
WorkspaceId
ActorId
ProviderRequestId
UsageEventId
```

These allow support to reconstruct an execution.

---

# 86. Metrics

The runtime should measure:

```text
AI Requests
Successful Requests
Failed Requests
Latency
Provider Latency
Token Usage
AI Credits
Retries
Timeouts
Validation Failures
Usage Reservation Failures
```

---

# 87. Commercial Metrics

Commercial systems may additionally calculate:

```text
AI Usage by Workspace
AI Usage by Product
AI Usage by Capability
AI Usage by Subscription
AI Revenue
AI Provider Cost
AI Gross Margin
```

These are derived from the underlying runtime and usage facts.

---

# 88. Distributed Tracing

A request should be traceable across:

```text
Gateway
 ↓
Licensing
 ↓
Usage
 ↓
Orchestrator
 ↓
Provider
 ↓
Usage
```

The same `CorrelationId` should be propagated.

---

# 89. Audit Logging

Audit events should capture commercially significant decisions:

```text
AI Authorization Granted
AI Authorization Denied
Usage Reservation Created
Usage Reservation Rejected
Usage Committed
Usage Adjusted
```

This is separate from ordinary application logs.

---

# 90. Failure Recovery

The runtime must tolerate:

```text
Provider Failure
Usage Service Temporary Failure
Licensing Service Temporary Failure
Context Provider Failure
Network Failure
```

However, failure handling must never accidentally grant AI access.

The safe default for authorization uncertainty is:

```text
Deny
```

unless an explicitly defined short-lived cached authorization policy permits continued operation.

---

# 91. Licensing Availability

Because Licensing is authoritative, the runtime may use a cached effective entitlement for resilience.

However:

```text
Cache
≠
Source of Truth
```

The cache must have:

```text
Version
Timestamp
Expiration
WorkspaceId
```

and must react to entitlement events.

---

# 92. Usage Service Availability

Usage availability is more sensitive because the system must avoid uncontrolled commercial consumption.

The runtime must define explicit behavior for:

```text
Usage Service Unavailable
```

Possible policy:

```text
Fail Closed
```

for metered AI capabilities.

The exact policy should be finalized per commercial product.

---

# 93. AI Provider Unavailability

If the provider is unavailable:

```text
Provider A
 ↓
Unavailable
 ↓
Model Router
 ↓
Provider B
```

If no compatible provider is available:

```text
AI_PROVIDER_UNAVAILABLE
```

The system must reconcile any reservation appropriately.

---

# 94. Provider Cost Isolation

The runtime records provider usage.

Example:

```text
Provider:
Provider-A

Model:
Model-X

Input Tokens:
2,000

Output Tokens:
800
```

The commercial layer may later calculate:

```text
Provider Cost
```

The customer price remains independently defined.

---

# 95. AI Runtime Dependency Rules

The AI runtime may depend on:

```text
Identity
Workspace Access
Licensing
Usage
AI Infrastructure
```

It should not directly depend on:

```text
Billing Database
Payment Database
Product Pricing Tables
Promotion Database
```

Commercial integration should occur through contracts/events.

---

# 96. Dependency Direction

Preferred:

```text
AI Runtime
    ↓
Licensing Contract
    ↓
Licensing

AI Runtime
    ↓
Usage Contract
    ↓
Usage
```

Avoid:

```text
AI Runtime
    ↓
Billing Repository
```

or:

```text
AI Runtime
    ↓
Subscription Database
```

---

# 97. Transaction Boundary

AI execution should not attempt one distributed database transaction across:

```text
Licensing
Usage
AI
Billing
Learning
```

Instead, the runtime should use:

```text
Authorization
+
Reservation
+
Execution
+
Usage Commit
+
Events
```

with explicit reconciliation.

---

# 98. Saga-Like Execution

Conceptually:

```text
Authorize
   ↓
Reserve
   ↓
Execute
   ↓
Commit
```

Failure at any step triggers the corresponding compensating action.

Example:

```text
Reserve
   ↓
Execution Failed
   ↓
Release Reservation
```

---

# 99. Exactly-Once Illusion

Distributed systems cannot rely on perfect exactly-once execution.

Therefore the runtime should use:

```text
Idempotency
Deduplication
Execution IDs
Usage Reconciliation
```

rather than assuming that every network operation occurs exactly once.

---

# 100. Runtime Architecture Summary

The final runtime architecture is:

```text
                           USER
                             │
                             ▼
                    ┌─────────────────┐
                    │ Learning /      │
                    │ Workspace UI    │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │   AI Gateway    │
                    └────────┬────────┘
                             │
                   ┌─────────┴─────────┐
                   ▼                   ▼
             Identity /            Workspace
             Access               Resolution
                   │                   │
                   └─────────┬─────────┘
                             ▼
                    ┌─────────────────┐
                    │  AI Capability  │
                    │    Resolver     │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │    Licensing    │
                    │  Authorization  │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Usage & Metering│
                    │   Reservation   │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ AI Orchestrator │
                    └────────┬────────┘
                             │
                  ┌──────────┴──────────┐
                  ▼                     ▼
          Context Assembly         Skill Registry
                  │                     │
                  └──────────┬──────────┘
                             ▼
                    ┌─────────────────┐
                    │   Model Router  │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Provider Adapter│
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  AI Provider    │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Result / Usage  │
                    │   Validation    │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Usage Commit    │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Workspace       │
                    │ Response        │
                    └─────────────────┘
```

---

# 101. Key Architectural Decision

The Platform should implement **one AI runtime architecture**, not separate runtimes for:

```text
Free AI
Paid AI
Subscription AI
Credit AI
Premium AI
Enterprise AI
```

All of these use:

```text
Same Gateway
Same Authorization
Same Usage
Same Orchestrator
Same Skill Model
Same Model Router
Same Provider Abstraction
```

Only the commercial entitlement and policy differ.

---

# 102. Final Principle

The most important architectural rule is:

> **Commercial configuration determines what the Workspace is entitled to use; the AI runtime determines how that entitled capability is executed.**

Therefore:

```text
Commercial Domain
        ↓
"What may this Workspace use?"
        ↓
Effective Entitlement
        ↓
AI Runtime
        ↓
"How should this capability execute?"
        ↓
AI Provider
```

This separation allows the Platform to introduce AI without creating a second commercial architecture and allows the commercial model to evolve without rewriting the AI execution engine.

---

# 103. Next Documents

The next logical implementation documents are:

1. **`AIAssistantArchitecture.md`**
   Defines the actual Assistant experience and conversational architecture.

2. **`AIOrchestrationArchitecture.md`**
   Defines the orchestration engine, Skills, context assembly, execution pipeline, retries, and workflows.

3. **`AISkillArchitecture.md`**
   Defines how individual AI capabilities are implemented and registered.

4. **`AIModelProviderArchitecture.md`**
   Defines provider abstraction, model routing, fallback, and provider adapters.

5. **`AIUsageAndCostArchitecture.md`**
   Defines AI-specific usage normalization, token/cost measurement, and provider economics.

These should build on this runtime document rather than duplicate its commercial boundaries.

---

# 104. Status

**Draft — Version 1.0**

This document establishes the runtime execution boundary between the AI Assistant, the Platform's commercial authorization system, Usage & Metering, Learning Workspace, and external AI providers.
