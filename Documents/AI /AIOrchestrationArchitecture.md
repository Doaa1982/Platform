# AIOrchestrationArchitecture.md

**Version:** 1.0
**Status:** Draft
**Bounded Context:** AI Assistant
**Architectural Layer:** Application / Orchestration
**Parent Document:** `AIAssistantArchitecture.md`

---

# 1. Purpose

This document defines how the Platform executes AI-powered operations from the moment an application requests an AI capability until the operation is completed and its actual usage is reconciled.

The orchestration layer is responsible for coordinating:

```text
AI Request
    ↓
Authorization
    ↓
Usage Estimation
    ↓
Usage Reservation
    ↓
Context Construction
    ↓
Skill Resolution
    ↓
Model Selection
    ↓
AI Execution
    ↓
Response Validation
    ↓
Usage Reconciliation
    ↓
Result Delivery
```

The orchestration layer does not own:

* commercial product configuration;
* subscription state;
* entitlement definition;
* actual usage history;
* billing;
* learning content;
* student records;
* tutor records.

It coordinates these capabilities through their defined contracts.

---

# 2. Architectural Position

The orchestration layer sits inside the AI Assistant bounded context.

```text
┌──────────────────────────────────────────────────────────┐
│                    LEARNING WORKSPACE                    │
│                                                          │
│  Lesson Authoring                                       │
│  Assessment                                             │
│  Student Learning                                       │
│  Tutor Workspace                                        │
└───────────────────────┬──────────────────────────────────┘
                        │
                        │ AI Request
                        ▼
┌──────────────────────────────────────────────────────────┐
│                     AI ASSISTANT                         │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │              AI ORCHESTRATION                     │  │
│  │                                                    │  │
│  │ Request Coordinator                                │  │
│  │ Authorization Coordinator                          │  │
│  │ Usage Coordinator                                  │  │
│  │ Context Coordinator                                │  │
│  │ Skill Coordinator                                  │  │
│  │ Model Coordinator                                  │  │
│  │ Execution Coordinator                              │  │
│  │ Result Coordinator                                 │  │
│  └──────────────────────┬─────────────────────────────┘  │
│                         │                                │
└─────────────────────────┼────────────────────────────────┘
                          │
              ┌───────────┼──────────────┐
              ▼           ▼              ▼
         Licensing     Usage &        Learning
         & Entitlement Metering       Context
              │           │
              └───────────┼──────────────┘
                          ▼
                    AI Provider(s)
```

---

# 3. Core Principle

The AI Orchestrator must coordinate; it must not become the owner of other domains.

The following principle applies:

> **Orchestration coordinates decisions; bounded contexts own those decisions.**

For example:

```text
AI Orchestrator
    │
    ├── asks Licensing:
    │      "Can this operation execute?"
    │
    ├── asks Usage & Metering:
    │      "Can this usage be reserved?"
    │
    ├── asks Learning:
    │      "Provide the authorized context."
    │
    └── asks Provider Gateway:
           "Execute this AI operation."
```

The Orchestrator does not reproduce the rules internally.

---

# 4. End-to-End Pipeline

The canonical pipeline is:

```text
1. Receive Request
        ↓
2. Normalize Request
        ↓
3. Resolve Workspace
        ↓
4. Resolve Actor
        ↓
5. Resolve Capability
        ↓
6. Resolve Operation
        ↓
7. Check Entitlement
        ↓
8. Estimate Usage
        ↓
9. Reserve Usage
        ↓
10. Build AI Context
        ↓
11. Resolve AI Skill
        ↓
12. Resolve Model
        ↓
13. Build Provider Request
        ↓
14. Execute
        ↓
15. Validate Response
        ↓
16. Normalize Result
        ↓
17. Record Actual Usage
        ↓
18. Release Unused Reservation
        ↓
19. Persist Operation Result
        ↓
20. Return Result
```

The exact steps may vary by operation, but this represents the default lifecycle.

---

# 5. AI Operation as the Orchestration Unit

The primary orchestration unit is an `AIOperation`.

Conceptually:

```text
AIOperation
│
├── OperationId
├── RequestId
├── CorrelationId
├── ParentOperationId
├── WorkspaceId
├── Actor
├── Capability
├── OperationType
├── Skill
├── Status
├── ContextReference
├── UsageReservation
├── ModelSelection
├── ProviderExecution
├── Result
└── Timestamps
```

This gives the Platform one consistent representation of an AI execution regardless of whether the operation is:

```text
ExplainLesson
GenerateLesson
GenerateQuestions
TranscribeVideo
GenerateFeedback
```

---

# 6. Operation Identity

Every operation requires stable identity.

```text
OperationId
RequestId
CorrelationId
IdempotencyKey
```

Example:

```text
OperationId:
AI-OP-93831

RequestId:
AI-REQ-77192

CorrelationId:
LESSON-GENERATION-129

IdempotencyKey:
LESSON-GENERATION-129-1
```

The identifiers serve different purposes.

### RequestId

Identifies the incoming application request.

### OperationId

Identifies the AI operation.

### CorrelationId

Connects related operations across the Platform.

### IdempotencyKey

Prevents duplicate execution.

---

# 7. Parent / Child Operations

Complex AI operations may contain child operations.

Example:

```text
GenerateLessonFromVideo
        │
        ├── TranscribeVideo
        │
        ├── GenerateLessonStructure
        │
        ├── GenerateExamples
        │
        ├── GenerateQuestions
        │
        └── GenerateActivities
```

The relationship is:

```text
ParentOperationId
        │
        ├── Child Operation A
        ├── Child Operation B
        ├── Child Operation C
        └── Child Operation D
```

Every child operation retains the original correlation identifier.

This preserves the attribution requirements already established for Usage & Metering.

---

# 8. Orchestration State Machine

The operation lifecycle is:

```text
Requested
    │
    ▼
Normalized
    │
    ▼
Authorized
    │
    ▼
UsageReserved
    │
    ▼
ContextReady
    │
    ▼
SkillResolved
    │
    ▼
ModelResolved
    │
    ▼
Executing
    │
    ├───────────────┐
    │               │
    ▼               ▼
Completed         Failed
    │               │
    ▼               ▼
Reconciled       Reconciled
    │
    ▼
Finalized
```

Cancellation can occur from selected states:

```text
Requested
Authorized
UsageReserved
Queued
Executing
```

The exact cancellation semantics depend on the operation type.

---

# 9. Request Normalization

The first responsibility of the Orchestrator is to normalize an incoming request.

Example:

```text
Raw Request
    ↓
AIRequest
```

The normalized request must identify:

```text
Workspace
Actor
Capability
Operation
Input
Context Reference
Correlation
Idempotency
```

The Orchestrator should reject requests that do not contain sufficient identity or capability information.

---

# 10. Workspace Resolution

Workspace is the primary commercial and security boundary.

The Orchestrator must resolve:

```text
WorkspaceId
```

before accessing:

* entitlements;
* learning context;
* usage;
* AI configuration;
* AI conversations.

No AI operation should proceed without an established Workspace context.

---

# 11. Actor Resolution

The initiating actor must also be resolved.

Examples:

```text
Student
Tutor
Administrator
System
Automation
```

The actor is retained for:

* authorization;
* audit;
* attribution;
* analytics;
* usage dimensions.

Usage & Metering explicitly supports actor attribution through `ActorType` and `ActorId`.

---

# 12. Capability Resolution

The Orchestrator identifies the business capability requesting AI.

Examples:

```text
LessonAuthoring
Assessment
StudentLearning
ContentManagement
Analytics
```

The capability is important because AI entitlement is capability-specific.

The Orchestrator should never treat:

```text
AI Enabled = true
```

as sufficient authorization.

---

# 13. Operation Resolution

The capability then resolves the requested operation.

Examples:

```text
LessonAuthoring
    └── GenerateLesson

Assessment
    └── GenerateQuestions

StudentLearning
    └── ExplainLesson
```

This creates the relationship:

```text
Capability
     +
Operation
     ↓
AI Skill
```

---

# 14. Authorization Stage

The Orchestrator invokes Licensing & Entitlements.

Conceptually:

```text
HasEntitlement(
    workspace,
    capability,
    requiredLevel
)
```

Licensing is the authoritative runtime source for entitlement decisions.

The Orchestrator does not inspect:

```text
ProductName
PlanName
Price
ConfigurationSnapshot
```

to decide whether the request is allowed.

---

# 15. Authorization Result

The authorization result should be explicit.

```text
Authorized
NotAuthorized
Restricted
Unavailable
```

Example:

```text
AuthorizationResult
│
├── Allowed
├── RequiredLevel
├── Source
└── Reason
```

If not authorized:

```text
AI_OPERATION_NOT_ENTITLED
```

The operation stops before provider execution.

---

# 16. Usage Estimation

After authorization, the Orchestrator estimates the expected consumption.

Example:

```text
Operation:
GenerateLessonFromVideo

Estimated AI Credits:
1,200
```

The estimate may depend on:

```text
Operation
Input Size
Expected Output
Model
Context Size
Workflow Steps
```

The estimate is not actual usage.

---

# 17. Usage Reservation

The Orchestrator requests a reservation from Usage & Metering.

Conceptually:

```text
ReserveUsage(
    workspace,
    meter,
    estimatedAmount,
    correlationId
)
```

The existing Usage & Metering architecture defines `UsageReservation` as expected consumption and explicitly separates it from actual `UsageEvent`.

---

# 18. Reservation Failure

If the reservation cannot be created:

```text
AI Operation
      │
      ▼
Usage Reservation
      │
      ▼
Rejected
```

The operation must not execute.

Possible reason:

```text
AI_USAGE_LIMIT_REACHED
```

or another usage-policy-specific result.

---

# 19. Why Reservation Happens Before Execution

Without reservation:

```text
AI Provider
    ↓
Expensive Operation
    ↓
Usage Recorded
    ↓
Allowance Already Exhausted
```

This creates uncontrolled exposure.

With reservation:

```text
Check Allowance
      ↓
Reserve
      ↓
Execute
```

The Platform obtains commercial control before the expensive operation begins.

---

# 20. Context Construction

Once the operation is authorized and usage is reserved, the Orchestrator requests the necessary context.

```text
AI Orchestrator
      │
      ▼
Context Provider
      │
      ├── Workspace
      ├── Learning Product
      ├── Lesson
      ├── Assessment
      ├── Student
      └── Tutor
```

Only context required by the AI Skill should be retrieved.

---

# 21. Context Failure

If required context cannot be obtained:

```text
Context Failure
     ↓
Operation Failed
     ↓
Release Reservation
```

No AI provider call should occur if the operation cannot be meaningfully executed.

---

# 22. Skill Resolution

The Orchestrator resolves the AI Skill.

Example:

```text
Capability:
LessonAuthoring

Operation:
GenerateLesson

        ↓

Skill:
GenerateLesson
```

The skill provides:

```text
Required Input
Context Requirements
Allowed Tools
Output Schema
Model Requirements
Safety Requirements
Usage Characteristics
```

---

# 23. Skill Definition

Conceptually:

```text
AISkill
│
├── SkillId
├── Capability
├── Operation
├── RequiredAILevel
├── ContextRequirements
├── ToolRequirements
├── InputSchema
├── OutputSchema
├── ModelPolicy
└── SafetyPolicy
```

The Skill is declarative wherever practical.

---

# 24. Model Resolution

The Orchestrator then asks the Model Router to select an appropriate model.

Inputs may include:

```text
Skill
Capability
Complexity
Context Size
Latency
Cost
Availability
Workspace Policy
```

The result:

```text
ModelSelection
│
├── Provider
├── Model
├── Version
└── RoutingReason
```

---

# 25. Model Selection Must Be Replaceable

The Learning Workspace should never contain:

```text
if operation == GenerateLesson
    use Model-X
```

Instead:

```text
GenerateLesson
      ↓
Model Router
      ↓
Selected Model
```

This permits model changes without changing the business capability.

---

# 26. Provider Request Construction

The Orchestrator converts the normalized Platform request into a provider-independent model request.

```text
AI Operation
     ↓
AI Model Request
     ↓
Provider Adapter
     ↓
Provider API
```

The provider adapter is responsible for provider-specific translation.

---

# 27. Provider Gateway

The Orchestrator communicates with:

```text
IAIProviderGateway
```

rather than a specific vendor client.

Conceptually:

```text
ExecuteAsync(
    AIModelRequest
)
```

The gateway returns:

```text
AIProviderResponse
```

containing:

```text
Output
Provider
Model
Usage
Metadata
Status
```

---

# 28. Provider Failure

Provider failures must remain distinguishable from commercial authorization failures.

Examples:

```text
AI_PROVIDER_UNAVAILABLE
AI_PROVIDER_TIMEOUT
AI_PROVIDER_RATE_LIMITED
AI_MODEL_UNAVAILABLE
AI_PROVIDER_INVALID_RESPONSE
```

The operation remains authorized but execution failed.

---

# 29. Retry Strategy

Retries must be policy-driven.

Safe retry candidates may include:

```text
Transient Network Failure
Temporary Provider Unavailability
Provider Rate Limit
```

Unsafe automatic retry candidates may include:

```text
Invalid Business Output
Safety Rejection
Permanent Authorization Failure
Invalid Input
```

The retry policy must consider usage because another attempt may consume additional AI resources.

---

# 30. Retry and Usage

Example:

```text
Estimated:
1,000 credits

Attempt 1:
700 credits

Provider Timeout

Attempt 2:
600 credits
```

Actual usage may become:

```text
1,300 credits
```

The Orchestrator must not record only the successful attempt.

Every provider-consuming attempt must be represented appropriately in Usage & Metering.

---

# 31. Response Validation

The raw provider result must be validated.

```text
Provider Response
      ↓
Schema Validation
      ↓
Safety Validation
      ↓
Business Validation
      ↓
Normalized Result
```

The operation should fail if the response does not satisfy its contract.

---

# 32. Schema Validation

Example:

```text
GenerateQuestions
```

expects:

```text
Question[]
```

If the provider returns:

```text
Unstructured Text
```

the result is not automatically accepted.

The Orchestrator may:

```text
Retry
Repair
Reject
```

according to the skill policy.

---

# 33. Business Validation

The Learning capability may validate:

```text
Question Type
Difficulty
Correct Answer
Lesson Alignment
Required Fields
```

AI Assistant validates AI-level contracts.

Learning validates learning-domain rules.

This distinction preserves bounded-context ownership.

---

# 34. AI Safety Validation

The Orchestrator invokes the AI safety policy before returning the result.

```text
AI Response
     ↓
Safety Policy
     ├── Allowed
     └── Rejected
```

Safety rejection is an AI operation result, not a licensing failure.

---

# 35. Result Normalization

Provider-specific output becomes a Platform result.

```text
Provider Response
      ↓
Response Adapter
      ↓
AI Operation Result
```

Example:

```text
OpenAIResponse
      ↓
GenerateLessonResult
```

The Learning Domain receives:

```text
GenerateLessonResult
```

not provider-specific structures.

---

# 36. Usage Reconciliation

After provider execution, actual usage must be reconciled.

Example:

```text
Reserved:
1,200

Actual:
920
```

The Orchestrator requests:

```text
Commit:
920

Release:
280
```

Usage & Metering then becomes the authoritative source of actual consumption.

---

# 37. Usage Must Be Based on Actual Consumption

The Orchestrator must not assume:

```text
Reserved = Actual
```

They are different concepts.

```text
UsageReservation
    =
Expected Consumption

UsageEvent
    =
Actual Consumption
```

This distinction is explicitly established by the Usage & Metering architecture.

---

# 38. Usage Reconciliation Failure

If actual usage cannot immediately be reconciled:

```text
AI Operation
      ↓
Completed
      ↓
Usage Reconciliation
      ↓
Temporary Failure
```

The Platform should not silently discard the usage.

The operation should enter a recoverable reconciliation state.

Example:

```text
UsageReconciliationPending
```

A background process can retry reconciliation.

---

# 39. Operation Completion

Only after the result and usage state are safely persisted should the operation be finalized.

```text
Provider Completed
       ↓
Result Validated
       ↓
Usage Reconciled
       ↓
Operation Finalized
```

This provides an auditable lifecycle.

---

# 40. Successful Operation

Example:

```text
Requested
   ↓
Authorized
   ↓
Reserved 1,000
   ↓
Executed
   ↓
Actual 920
   ↓
Release 80
   ↓
Completed
```

Final state:

```text
Status:
Completed

Actual Usage:
920

Released:
80
```

---

# 41. Failed Operation Before Provider Call

Example:

```text
Requested
   ↓
Authorization
   ↓
Authorized
   ↓
Reservation
   ↓
Context Failure
```

No provider usage exists.

Therefore:

```text
Release Reservation
```

No `UsageEvent` representing provider consumption should be created.

---

# 42. Failed Operation After Provider Call

Example:

```text
Requested
   ↓
Authorized
   ↓
Reserved
   ↓
Provider Called
   ↓
Provider Error
```

If provider usage occurred, it must be reconciled.

The operation may become:

```text
Failed
```

while actual usage is still recorded.

This distinction is critical.

> **Operation failure does not necessarily mean zero AI consumption.**

---

# 43. Partial Success

Some AI workflows may partially complete.

Example:

```text
GenerateLesson
   │
   ├── Structure ✓
   ├── Examples ✓
   ├── Questions ✓
   └── Activities ✗
```

The Orchestrator should support:

```text
Completed
Partial
Failed
```

according to the operation contract.

The Learning capability decides whether a partial result is acceptable.

---

# 44. Long-Running Operations

Large operations should be asynchronous.

Example:

```text
POST /ai/operations
        ↓
202 Accepted
        ↓
OperationId
```

Client:

```text
GET /ai/operations/{operationId}
```

Possible states:

```text
Queued
Running
Completed
Failed
Cancelled
```

---

# 45. Background Execution

Long-running operations may be executed by a background worker.

```text
API
 │
 ▼
AI Operation Store
 │
 ▼
Queue
 │
 ▼
AI Worker
 │
 ▼
AI Orchestrator
```

The same orchestration rules apply.

The worker does not bypass:

```text
Authorization
Reservation
Context
Usage
```

---

# 46. Queue Safety

The queue message should contain references, not uncontrolled business data.

Example:

```text
AIWorkItem
│
├── OperationId
├── WorkspaceId
├── CorrelationId
└── SkillId
```

The worker retrieves authoritative context when execution begins.

---

# 47. Authorization Recheck

For queued operations, authorization should be revalidated at execution time.

Why?

Because:

```text
Request Time
     ≠
Execution Time
```

A license may have changed between them.

Therefore:

```text
Request
 ↓
Initial Authorization
 ↓
Queue
 ↓
Execution
 ↓
Authorization Recheck
```

If entitlement has been revoked, the operation should not begin.

This respects Licensing's role as runtime authorization authority.

---

# 48. Reservation Expiration

Queued operations must not hold reservations indefinitely.

A reservation should have:

```text
ReservationId
ExpiresAt
```

If execution does not begin in time:

```text
Reservation
    ↓
Expired
    ↓
Released
```

The AI operation may become:

```text
Expired
```

or be re-queued with a new reservation.

---

# 49. Cancellation

A user may cancel a long-running AI operation.

Example:

```text
Tutor
  ↓
Cancel
  ↓
AI Operation
  ↓
Cancellation Requested
```

The Orchestrator must distinguish:

```text
Cancelled Before Provider Execution
```

from:

```text
Cancelled After Provider Execution Began
```

The latter may still have provider usage.

---

# 50. Timeout

Every AI operation should have an execution timeout.

```text
Operation
   ↓
Timeout
```

The operation becomes:

```text
TimedOut
```

If provider usage occurred, actual usage must still be reconciled.

---

# 51. Idempotency

The Orchestrator must protect against duplicate requests.

Example:

```text
Tutor clicks:
Generate Lesson

Browser sends request twice
```

The Platform should produce:

```text
One Logical Operation
```

rather than:

```text
Two AI Generations
```

where the same idempotency key is used.

---

# 52. Idempotency Boundary

Idempotency should exist at multiple levels.

```text
API Request
    ↓
AI Operation
    ↓
Provider Attempt
    ↓
Usage Event
```

The Usage & Metering layer already requires correlation-based idempotency for usage events.

The AI Orchestrator must complement, not replace, that protection.

---

# 53. AI Conversation Orchestration

Conversational AI uses the same orchestration pipeline.

```text
Student Message
      ↓
Conversation Resolution
      ↓
Capability Resolution
      ↓
Authorization
      ↓
Context Construction
      ↓
Skill Resolution
      ↓
Model
      ↓
Response
      ↓
Usage Reconciliation
```

Conversation history is context.

It is not a replacement for entitlement or Workspace authorization.

---

# 54. Conversation Context

For a conversation:

```text
ConversationId
```

should resolve:

```text
Workspace
Actor
Capability
Context Scope
Conversation History
```

The Orchestrator then constructs a bounded context for the model.

---

# 55. Context Window Management

The Orchestrator should not blindly send the entire conversation to the model.

Instead:

```text
Conversation History
       ↓
Context Selection
       ↓
Relevant Messages
       ↓
Relevant Domain Context
       ↓
Model Context
```

This controls:

* token usage;
* latency;
* relevance;
* privacy exposure.

---

# 56. Tool-Calling Orchestration

Some AI Skills may use tools.

Example:

```text
ExplainLesson
      ↓
AI Model
      ↓
Request Tool:
GetCurrentLesson
      ↓
Learning Domain
      ↓
Tool Result
      ↓
AI Model
      ↓
Final Explanation
```

Every tool call must be authorized.

---

# 57. Tool Execution Loop

The orchestration loop becomes:

```text
Execute Model
     │
     ▼
Tool Requested?
     │
 ┌───┴────┐
 │        │
No       Yes
 │        │
 ▼        ▼
Result   Authorize Tool
          │
          ▼
       Execute Tool
          │
          ▼
       Return Tool Result
          │
          ▼
       Execute Model
```

The loop must have limits.

---

# 58. Agentic Loop Limits

The Orchestrator should enforce:

```text
Maximum Tool Calls
Maximum Iterations
Maximum Execution Time
Maximum Context Size
Maximum Estimated Usage
```

This prevents uncontrolled agentic behavior.

---

# 59. AI Workflow Definition

Complex operations may be represented as workflows.

Example:

```text
GenerateLessonFromVideo
```

```text
Workflow
│
├── Transcribe
├── Analyze
├── GenerateStructure
├── GenerateQuestions
├── GenerateActivities
└── Validate
```

The Orchestrator executes the workflow.

---

# 60. Workflow Step Contract

Each step should define:

```text
StepId
SkillId
Input
Output
RetryPolicy
Timeout
UsageEstimate
Dependencies
```

Example:

```text
GenerateQuestions
DependsOn:
GenerateStructure
```

---

# 61. Workflow Failure Policy

Each workflow must define whether a failed step:

```text
Stops Workflow
Retries
Skips
Falls Back
Produces Partial Result
```

Example:

```text
Transcription
   ↓ failure
Stop

OptionalActivityGeneration
   ↓ failure
Continue
```

---

# 62. Parallel AI Operations

Independent steps may execute in parallel.

Example:

```text
GenerateLessonStructure
        │
        ├── GenerateExamples
        │
        ├── GenerateQuestions
        │
        └── GenerateActivities
```

Parallelism must still respect:

```text
Usage limits
Provider limits
Workspace policies
Operation limits
```

---

# 63. Usage Reservation for Parallel Operations

The Orchestrator may reserve the expected total usage before starting parallel operations.

```text
Total Estimate:
3,000

Reserve:
3,000

Execute:
 ├── Step A
 ├── Step B
 └── Step C
```

Each step's actual usage is recorded against the parent correlation.

---

# 64. Compensation

AI operations do not generally support transactional rollback of provider consumption.

For example:

```text
AI generated 1,000 credits
```

The Platform cannot "undo" the provider call.

Therefore compensation means:

```text
Record actual usage
Correct Platform state
Release unused reservation
```

not:

```text
Undo AI consumption
```

---

# 65. AI Result Persistence

The Orchestrator should persist the operation result when necessary.

However, ownership remains with the calling domain.

Example:

```text
AI Assistant
      ↓
GenerateLessonResult
      ↓
Learning Application Service
      ↓
Lesson Draft
```

The AI Assistant does not become the owner of `Lesson`.

---

# 66. AI Result Reference

For large outputs, the operation may return:

```text
ResultReference
```

instead of embedding the complete result in every response.

Example:

```text
OperationId:
AI-OP-123

Result:
LessonDraftReference
```

The owning domain can retrieve the result through the appropriate contract.

---

# 67. Security Boundary

The Orchestrator must enforce:

```text
Workspace Boundary
Actor Boundary
Capability Boundary
Tool Boundary
Context Boundary
Provider Boundary
```

No AI operation should inherit permissions merely because it is "AI."

---

# 68. Prompt Injection Consideration

Retrieved content may contain instructions intended for the AI.

For example:

```text
Lesson Content:
"Ignore previous instructions..."
```

The Orchestrator must treat retrieved content as data, not system-level instructions.

The detailed security architecture belongs in:

```text
AISafetyAndGovernanceArchitecture.md
```

but the orchestration boundary must support this separation.

---

# 69. Provider Isolation

Provider credentials must never reach:

```text
Learning Workspace
Frontend
AI Skill
AI Conversation
```

They belong exclusively in the Provider Gateway / infrastructure boundary.

---

# 70. Model Configuration

Model configuration should be centrally managed.

Example:

```text
AI Model Configuration
│
├── Provider
├── Model
├── Endpoint
├── Limits
├── Cost Metadata
├── Capability Support
└── Status
```

The Orchestrator reads configuration through the Model Router.

---

# 71. Provider Failover

Future provider failover may look like:

```text
Primary Provider
      │
      ▼
Failure
      │
      ▼
Fallback Provider
      │
      ▼
Execute
```

Failover must respect:

```text
Skill compatibility
Output contract
Usage estimation
Commercial policy
Provider availability
```

A fallback provider may have different usage characteristics.

---

# 72. Model Fallback

Likewise:

```text
Preferred Model
      ↓
Unavailable
      ↓
Fallback Model
```

The actual provider/model used must be recorded in usage metadata where available.

This is important for operational analytics and cost analysis.

---

# 73. AI Cost Optimization

The Orchestrator may optimize model selection.

Example:

```text
Simple Explanation
       ↓
Lower-cost Model

Complex Lesson Generation
       ↓
Higher-capability Model
```

However, optimization must never violate:

```text
Skill Requirements
AI Entitlement
Output Contract
Safety Requirements
```

---

# 74. AI Usage Forecasting

The Orchestrator may estimate usage before execution.

Example:

```text
GenerateLesson
Estimated:
700 credits
```

The estimate may be exposed to the UI where useful.

However:

> Estimated usage is not actual usage.

---

# 75. User Experience

For an interactive operation:

```text
Tutor clicks Generate
        ↓
Authorization
        ↓
Usage Reservation
        ↓
AI Execution
```

The UI may show:

```text
Generating lesson...
```

After completion:

```text
Lesson generated.

AI usage:
920 credits
```

The exact UI belongs to Learning Workspace.

---

# 76. Commercial UX

If the operation is rejected because the allowance is exhausted:

```text
AI usage limit reached.

You have used:
75,000 / 75,000 AI Credits.
```

The UI can offer:

```text
Upgrade
Buy AI Credits
```

The AI Assistant should return a structured commercial reason rather than implementing the purchase flow itself.

---

# 77. Structured Failure Contract

Example:

```text
AIError
│
├── Code
├── Category
├── Message
├── Retryable
├── CommercialAction
└── CorrelationId
```

Example:

```text
Code:
AI_USAGE_LIMIT_REACHED

Category:
Commercial

Retryable:
false

CommercialAction:
PURCHASE_AI_CREDITS
```

---

# 78. Error Categories

Recommended categories:

```text
Authorization
Commercial
Validation
Context
Safety
Provider
Infrastructure
Timeout
Cancellation
Usage
```

This allows the frontend to respond appropriately.

---

# 79. Orchestration Metrics

The Orchestrator should expose operational metrics such as:

```text
AI Operations / minute
Success Rate
Failure Rate
Average Latency
P95 Latency
Provider Error Rate
Model Error Rate
Retry Rate
Average Usage
Reservation Failure Rate
```

These are operational metrics.

Commercial consumption remains owned by Usage & Metering.

---

# 80. Distributed Tracing

AI operations should carry:

```text
TraceId
CorrelationId
OperationId
```

through:

```text
Frontend
 ↓
API
 ↓
AI Assistant
 ↓
Licensing
 ↓
Usage
 ↓
Learning Context
 ↓
Provider
```

This makes a single AI request traceable across the Platform.

---

# 81. Eventual Consistency

Commercial and operational components may be distributed.

For example:

```text
Entitlement Changed
      ↓
Event Published
      ↓
AI Assistant receives updated state
```

The AI Assistant should rely on the authoritative Licensing contract for critical authorization rather than assuming local cached state is always current.

---

# 82. Caching

Some AI metadata may be cached:

```text
Skill Definition
Model Metadata
Provider Configuration
```

Entitlement decisions may be cached only according to Licensing's defined consistency requirements.

The AI Assistant must not introduce a cache that causes revoked entitlements to remain usable beyond the accepted policy window.

---

# 83. Concurrency

Multiple AI operations may execute simultaneously.

Example:

```text
Tutor
 ├── GenerateLesson
 ├── GenerateQuiz
 └── GenerateActivities
```

The Platform must ensure usage reservation and entitlement enforcement remain correct under concurrency.

This is particularly important because a simple:

```text
Check Remaining
Execute
```

is not sufficient.

The reservation mechanism provides the concurrency boundary.

---

# 84. Concurrent Reservation Example

Remaining:

```text
1,000 credits
```

Two requests arrive simultaneously:

```text
Request A:
700

Request B:
600
```

Without reservation:

```text
A sees 1,000
B sees 1,000

Both execute

Total:
1,300
```

With reservation:

```text
A reserves 700

Remaining:
300

B requests 600

Rejected
```

This is why reservation is a first-class concept.

---

# 85. Orchestrator Responsibilities Summary

The Orchestrator owns:

```text
Request coordination
Operation lifecycle
Workflow execution
Skill resolution
Context coordination
Model routing
Provider invocation
Retry policy
Result validation
Usage reconciliation coordination
```

It does not own:

```text
Entitlement rules
Subscription rules
Product configuration
Usage history
Billing
Learning entities
```

---

# 86. Application Contracts

Conceptual contracts:

```text
IAIAssistant
IAIOperationOrchestrator
IAIAuthorizationService
IAIUsageCoordinator
IAIContextCoordinator
IAISkillResolver
IAIModelRouter
IAIProviderGateway
IAIResponseValidator
IAIWorkflowExecutor
```

---

# 87. Orchestrator Service

Conceptually:

```text
IAIOperationOrchestrator.ExecuteAsync(
    AIRequest request,
    CancellationToken cancellationToken
)
```

The orchestration service should coordinate the pipeline rather than implement provider-specific logic.

---

# 88. Pipeline Pattern

Implementation may use a pipeline:

```text
AI Request
   ↓
RequestValidationStep
   ↓
WorkspaceResolutionStep
   ↓
AuthorizationStep
   ↓
UsageReservationStep
   ↓
ContextStep
   ↓
SkillResolutionStep
   ↓
ModelResolutionStep
   ↓
ExecutionStep
   ↓
ResponseValidationStep
   ↓
UsageReconciliationStep
   ↓
CompletionStep
```

This makes the lifecycle explicit and testable.

---

# 89. Pipeline Rules

Each step should:

```text
Receive Context
Validate Preconditions
Execute Responsibility
Update Operation State
Pass Control
```

Steps should not silently bypass previous stages.

For example:

```text
ExecutionStep
```

must never execute when:

```text
Authorization != Allowed
```

or:

```text
UsageReservation != Confirmed
```

unless the operation explicitly defines a non-metered execution mode.

---

# 90. Non-Metered AI Operations

Not every internal AI operation necessarily has the same commercial treatment.

Examples could include:

```text
Internal Platform Diagnostics
Safety Classification
Operational Embeddings
Internal Search
```

Commercial treatment should be explicitly configured.

The default assumption for customer-facing AI capabilities should be:

```text
Metered
```

unless the commercial configuration says otherwise.

---

# 91. Metered vs Non-Metered Decision

The Orchestrator should resolve:

```text
Operation
      ↓
Usage Policy
      ↓
Metered?
```

If:

```text
Metered = true
```

then:

```text
Reserve → Execute → Reconcile
```

If:

```text
Metered = false
```

then the operation may skip customer usage reservation while still maintaining operational telemetry.

The commercial rule should not be inferred from the provider.

---

# 92. AI Operation Policy

Conceptually:

```text
AIOperationPolicy
│
├── RequiresEntitlement
├── RequiresUsageReservation
├── MaximumUsage
├── MaximumDuration
├── MaximumRetries
├── AllowedModels
├── AllowedTools
└── FailurePolicy
```

This gives the Orchestrator explicit operational rules.

---

# 93. Workflow Example: Generate Lesson

```text
GenerateLesson
│
├── Authorization
│
├── Reserve Usage
│
├── Load Tutor Context
│
├── Load Curriculum Context
│
├── Resolve GenerateLesson Skill
│
├── Select Model
│
├── Generate Draft
│
├── Validate Draft
│
├── Generate Questions
│
├── Validate Questions
│
├── Reconcile Usage
│
└── Return LessonDraft
```

The Lesson remains owned by Learning.

---

# 94. Workflow Example: Explain Student Answer

```text
ExplainAnswer
│
├── Authorization
├── Usage Estimate
├── Reservation
├── Load Lesson
├── Load Question
├── Load Student Answer
├── Resolve ExplainAnswer Skill
├── Select Model
├── Generate Explanation
├── Validate
├── Record Usage
└── Return Explanation
```

This should be optimized for low latency.

---

# 95. Workflow Example: Video → Interactive Lesson

```text
Video
  ↓
Transcription
  ↓
Lesson Structure
  ↓
Learning Objectives
  ↓
Questions
  ↓
Interactive Activities
  ↓
Validation
  ↓
LessonDraft
```

Each stage can be an AI operation while the overall workflow remains one correlated business operation.

---

# 96. AI Orchestration and Learning Domain

The Learning Domain should invoke AI through an application contract.

Example:

```text
LessonApplicationService
       │
       ▼
IAIAssistant
       │
       ▼
GenerateLesson
       │
       ▼
GenerateLessonResult
       │
       ▼
LessonApplicationService
```

This allows the Learning Domain to remain independent from AI infrastructure.

---

# 97. AI Orchestration and Commercial Domain

Commercial integration should remain contract-driven.

```text
AI Orchestrator
      │
      ├── Licensing
      │      └── HasEntitlement
      │
      └── Usage & Metering
             ├── Reserve
             ├── Record
             └── Release
```

The Product Configuration Engine remains upstream.

---

# 98. Configuration Changes

If Product Configuration changes AI configuration:

```text
Configuration Change
       ↓
Configuration Snapshot
       ↓
Subscription
       ↓
Licensing
       ↓
Effective Entitlement
```

The Orchestrator does not need to understand the original configuration.

It only consumes the resulting entitlement.

---

# 99. Subscription Upgrade During Session

Example:

```text
Tutor reaches limit
       ↓
AI rejected
       ↓
Tutor upgrades
       ↓
Subscription changes
       ↓
License updated
       ↓
AI entitlement updated
       ↓
New AI request
       ↓
Authorized
```

The Orchestrator should not require knowledge of the upgrade mechanism.

---

# 100. Architectural Invariants

### ORCH-001

Every AI operation must have a Workspace identity.

### ORCH-002

Every customer-facing AI operation must resolve an actor.

### ORCH-003

Authorization must occur before provider execution.

### ORCH-004

Metered operations must reserve usage before expensive execution.

### ORCH-005

Actual provider consumption must be reconciled after execution.

### ORCH-006

Reservation and actual usage must remain separate concepts.

### ORCH-007

AI provider failures must not be confused with entitlement failures.

### ORCH-008

Queued operations must revalidate entitlement before execution.

### ORCH-009

Retries must preserve usage attribution.

### ORCH-010

Every child AI operation must retain correlation with its parent workflow.

### ORCH-011

Provider-specific contracts must not leak into Learning capabilities.

### ORCH-012

AI-generated learning content remains owned by the Learning domain.

### ORCH-013

AI tools must be explicitly authorized.

### ORCH-014

Operation failure does not imply zero provider consumption.

### ORCH-015

The Orchestrator must not implement commercial entitlement rules locally.

---

# 101. Reference Flow

The canonical implementation flow is:

```text
                ┌─────────────────────┐
                │   Learning Client   │
                └──────────┬──────────┘
                           │
                           ▼
                    AI Request API
                           │
                           ▼
                 ┌────────────────────┐
                 │  AI Orchestrator   │
                 └─────────┬──────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
         Licensing      Usage       Context
         Entitlement   Metering     Providers
              │            │            │
              └────────────┼────────────┘
                           ▼
                     Skill Resolver
                           │
                           ▼
                      Model Router
                           │
                           ▼
                    Provider Gateway
                           │
                           ▼
                      AI Provider
                           │
                           ▼
                  Response Validation
                           │
                           ▼
                  Usage Reconciliation
                           │
                           ▼
                    AI Operation
                       Complete
```

---

# 102. Relationship to Other AI Documents

This document defines orchestration.

It should be complemented by:

```text
AIAssistantArchitecture.md
        │
        ├── AIOrchestrationArchitecture.md
        │
        ├── AIContextArchitecture.md
        │
        ├── AISkillArchitecture.md
        │
        ├── AIModelProviderArchitecture.md
        │
        ├── AIUsageAndCostArchitecture.md
        │
        ├── AICommercialIntegrationArchitecture.md
        │
        ├── AICommercialRuntimeArchitecture.md
        │
        ├── AIProductPackagingArchitecture.md
        │
        └── AISafetyAndGovernanceArchitecture.md
```

Each document should own a distinct architectural concern.

---

# 103. Final Architecture Rule

The AI execution path is:

```text
REQUEST
   ↓
IDENTITY
   ↓
CAPABILITY
   ↓
ENTITLEMENT
   ↓
RESERVATION
   ↓
CONTEXT
   ↓
SKILL
   ↓
MODEL
   ↓
PROVIDER
   ↓
VALIDATION
   ↓
ACTUAL USAGE
   ↓
RESULT
```

The critical commercial relationship remains:

```text
Product Configuration
        ↓
Subscription
        ↓
Licensing
        ↓
AI Orchestrator
        ↓
Usage & Metering
```

The Orchestrator is therefore the **execution coordinator**, not a new commercial authority.

---

# 104. Status

**Draft — Version 1.0**

This document establishes the operational execution model for the AI Assistant.

The next architectural concern should be **`AIContextArchitecture.md`**, because context is one of the most important boundaries for the Platform: the AI must be able to understand the student's lesson, the tutor's workspace, the learning product, and the current operation without receiving unrestricted access to domain data.
