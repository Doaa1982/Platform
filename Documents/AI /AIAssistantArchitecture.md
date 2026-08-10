# AIAssistantArchitecture.md

**Version:** 1.0
**Status:** Draft
**Bounded Context:** AI Assistant
**Parent Domain:** Platform / Learning Domain
**Commercial Integration:** Commercial Domain
**Primary Consumers:** Learning Workspace, Tutor Workspace, Student Workspace, Content & Learning capabilities

---

# 0. Business Vision & Objectives

This section states the business "why" behind the AI Assistant capability and the sub-architecture documents that depend on it. It is ported forward from the earlier `Artificial Intelligence Business Architecture.md`, which established this framing before the technical sub-architecture (Orchestration, Context, Skill, Model Provider, Commercial Integration, Safety & Governance) was written.

## Vision

The Platform uses Artificial Intelligence to enhance — not replace — human expertise. AI empowers tutors to create richer learning experiences, assists learners in achieving better outcomes, and supports organizations in delivering high-quality education. AI operates as an intelligent collaborator under the guidance and control of authorized users, not as an autonomous actor.

## Business Objectives

```text
Reduce repetitive work for tutors and administrators
Accelerate content creation (lessons, questions, activities)
Support instructional design
Personalize learning experiences for students
Improve assessment quality
Assist decision-making with intelligent recommendations
```

## Business Drivers

These objectives translate into the specific technical requirements the rest of this suite enforces:

```text
"Reduce repetitive work"        → AISkillArchitecture.md (Content Creation, Assessment,
                                    Media Intelligence Skills)
"AI as collaborator, not actor" → AISafetyAndGovernanceArchitecture.md §13
                                    (Suggestion vs. Action governance)
"Personalize learning"          → AIContextArchitecture.md (per-student, per-workspace context)
"Multiple providers, no lock-in" → AIModelProviderArchitecture.md
"AI as a sellable capability"    → AIProductPackagingArchitecture.md,
                                    AICommercialIntegrationArchitecture.md
```

## Success Is Not Yet Defined Here

This section states intent, not targets. Concrete success metrics (e.g., reduction in lesson-prep time, AI-assisted engagement lift, AI feature attach rate) and current commercial packaging numbers are owned by product management and should be sourced from `CapabilityTierReference.md` and the Commercial Domain documents rather than restated here, to avoid this document drifting out of sync with actual pricing and targets.

---

# 1. Purpose

The AI Assistant capability provides a controlled platform abstraction for AI-powered experiences across the Platform.

It is responsible for:

* receiving AI requests;
* identifying the AI capability being requested;
* validating the caller's AI entitlement;
* building the appropriate learning/workspace context;
* selecting and invoking an AI provider/model;
* orchestrating multi-step AI operations;
* returning structured AI results to the calling capability;
* recording AI consumption through Usage & Metering;
* enforcing AI-specific safety and operational policies;
* supporting multiple AI providers and models without coupling the Learning Workspace to a specific provider.

The AI Assistant answers:

> **"How can the Platform safely and consistently execute an AI-powered operation for this Workspace?"**

It does **not** determine:

> "What did the customer buy?"

That belongs to Product Configuration and Subscription.

It does **not** determine:

> "What is the customer currently entitled to use?"

That belongs to Licensing & Entitlements.

It does **not** determine:

> "How much was consumed?"

That belongs to Usage & Metering.

---

# 2. Architectural Principle

The AI Assistant must not become a direct integration between the Learning Workspace and an AI provider.

The incorrect architecture is:

```text
Learning Workspace
        │
        ▼
OpenAI API
```

The Platform architecture is:

```text
Learning Workspace
        │
        ▼
AI Assistant
        │
        ├── Entitlement Check
        ├── Context Resolution
        ├── Skill Resolution
        ├── Usage Pre-Authorization
        ├── AI Orchestration
        ├── Provider / Model Selection
        ├── Safety Policy
        └── Usage Recording
                │
                ▼
          AI Provider(s)
```

This keeps the Platform independent from a particular AI provider.

---

# 3. Architectural Position

The AI Assistant sits between the Learning capabilities and the underlying AI infrastructure.

```text
                         COMMERCIAL DOMAIN
                                │
        ┌───────────────────────┼──────────────────────┐
        │                       │                      │
        ▼                       ▼                      ▼
 Product Management     Configuration Engine      Subscription
                                │
                                ▼
                     Licensing & Entitlements
                                │
                                ▼
                         Effective AI
                         Entitlements
                                │
                                ▼
┌───────────────────────────────────────────────────────────────┐
│                         PLATFORM                              │
│                                                               │
│  Learning Workspace                                          │
│       │                                                       │
│       ├── Lesson Authoring                                   │
│       ├── Assessment                                          │
│       ├── AI Tutor                                            │
│       ├── Content Improvement                                 │
│       └── Other AI-enabled capabilities                      │
│                         │                                     │
│                         ▼                                     │
│                  ┌───────────────┐                            │
│                  │ AI Assistant  │                            │
│                  └───────┬───────┘                            │
│                          │                                    │
│              ┌───────────┼────────────┐                       │
│              ▼           ▼            ▼                       │
│          Context      Skills       AI Policy                  │
│          Builder      /Tools       & Safety                   │
│              │           │            │                       │
│              └───────────┼────────────┘                       │
│                          ▼                                    │
│                  AI Orchestrator                              │
│                          │                                    │
└──────────────────────────┼────────────────────────────────────┘
                           │
                           ▼
                    AI Provider(s)
                           │
                           ▼
                    Usage & Metering
```

Usage & Metering remains the authoritative context for actual AI consumption.

---

# 4. Core Responsibilities

The AI Assistant owns:

* AI request orchestration;
* AI capability/skill resolution;
* AI context construction;
* AI provider abstraction;
* AI model routing;
* AI operation lifecycle;
* AI response normalization;
* AI tool invocation;
* AI workflow orchestration;
* AI-specific operational policy;
* AI request correlation;
* AI usage integration;
* AI failure/retry handling;
* AI response metadata.

---

# 5. What the AI Assistant Does Not Own

| Concern                     | Owner                         |
| --------------------------- | ----------------------------- |
| Product definition          | Commercial Product Management |
| Product configuration       | Product Configuration Engine  |
| Subscription lifecycle      | Subscription Management       |
| AI entitlement              | Licensing & Entitlements      |
| AI credit allowance         | Licensing & Entitlements      |
| Actual AI consumption       | Usage & Metering              |
| Billing/invoice             | Billing                       |
| Workspace identity          | Identity                      |
| Student/tutor business data | Learning Workspace            |
| Learning content ownership  | Learning Domain               |
| Customer recommendation     | Product Advisory              |

This follows the established Commercial Domain separation:

```text
Product Configuration
"What did they choose?"

Licensing & Entitlements
"What are they allowed to use?"

AI Assistant
"How do we execute the AI operation?"

Usage & Metering
"What did they actually consume?"
```

## The source architecture explicitly establishes Licensing as the runtime authority for entitlement decisions and Usage & Metering as the authority for actual consumption.

# 6. AI Assistant as a Platform Capability

AI should not be represented as one global switch.

The Platform must support AI at the capability level.

Examples:

```text
Lesson Authoring
    AI Assistance = Co-Pilot

Assessment
    AI Assistance = Co-Pilot

Analytics
    AI Assistance = Insights

Marketing
    AI Assistance = Assist

Commerce
    AI Assistance = Manual
```

The Product Configuration Engine already defines AI policies per capability and the Commercial Data Model contains `CAPABILITY_AI_POLICY` and `AI_ASSISTANCE_LEVEL`.

Therefore the AI Assistant consumes the **effective entitlement**, rather than interpreting the customer's product name.

---

# 7. AI Entitlement Model

The AI Assistant must never ask:

```text
Is the Workspace on Solo AI+?
```

Instead:

```text
HasEntitlement(
    workspace,
    capability,
    requiredLevel
)
```

For example:

```text
HasEntitlement(
    Workspace = WS-123,
    Capability = LessonAuthoring,
    Level = CoPilot
)
```

Licensing & Entitlements explicitly requires runtime authorization to use `HasEntitlement(workspace, capability, level?)` rather than checking plan names.

---

# 8. AI Entitlement Types

The AI Assistant may consume the following entitlement categories:

```text
AI Assistance Level
AI Capability
AI Usage Allowance
AI Capacity
AI Feature Access
```

Example effective entitlement set:

```text
Learning Profile = AI+

Assessment Profile = AI+

Lesson Authoring AI = Co-Pilot

Assessment AI = Co-Pilot

AI Credits = 75,000

Tutor Capacity = 2
```

The allowance is not owned by AI Assistant.

It is resolved by Licensing from the commercial configuration.

---

# 9. Product Configuration → AI

The Product Configuration Engine may receive:

```text
AI Assistance Level
AI Credit Package
Capability Pack
Capability Profile
```

For example:

```text
Base Product:
Solo Professional

Learning:
AI+

Assessment:
AI+

AI Credits:
50,000/month
```

The Configuration Engine calculates the resulting configuration and entitlement set.

It then produces an immutable Configuration Snapshot.

```text
Configuration
       │
       ▼
Configuration Snapshot
       │
       ▼
Subscription
       │
       ▼
Workspace License
       │
       ▼
Effective Entitlements
```

---

# 10. Licensing → AI Assistant

Licensing publishes the effective entitlement set.

For example:

```text
Learning = AI+

Assessment = AI+

AI Credits = 75,000
```

The AI Assistant does not calculate these values.

It only asks Licensing whether a requested operation is permitted.

```text
AI Request
    │
    ▼
Licensing
    │
    ├── Entitled → Continue
    │
    └── Not Entitled → Reject
```

---

# 11. Usage & Metering → AI Assistant

Usage & Metering is responsible for measuring actual AI consumption.

The architecture already establishes:

```text
AI Provider Usage
       ↓
Usage Normalization
       ↓
Platform AI Credits
```

rather than exposing raw provider tokens as the customer's commercial unit.

The AI Assistant therefore reports actual provider usage after an AI operation.

```text
AI Operation
     │
     ▼
Provider Response
     │
     ├── Input Tokens
     ├── Output Tokens
     ├── Cached Tokens
     ├── Model
     └── Provider
             │
             ▼
       Usage & Metering
             │
             ▼
        AI Credits
```

---

# 12. AI Credit Abstraction

The customer's commercial model uses:

```text
AI Credits
```

rather than raw provider tokens.

The transformation is:

```text
Provider Usage
      │
      ▼
AI Credit Calculator
      │
      ▼
Normalized Usage
      │
      ▼
UsageEvent
```

The current Usage & Metering architecture explicitly defines AI Credits as the initial P0 metered resource, while AI Tokens remain an internal measurement.

---

# 13. AI Assistant Internal Architecture

```text
AI Assistant
│
├── AI Request Gateway
│
├── AI Authorization
│
├── AI Context Builder
│
├── AI Skill Resolver
│
├── AI Tool Registry
│
├── AI Orchestrator
│
├── AI Model Router
│
├── AI Provider Gateway
│
├── AI Response Processor
│
├── AI Usage Adapter
│
├── AI Safety Policy
│
└── AI Operation Store
```

---

# 14. AI Request Gateway

The AI Request Gateway is the entry point for AI operations.

Example:

```text
POST /api/ai/operations
```

Conceptually:

```text
AIRequest
│
├── RequestId
├── WorkspaceId
├── Actor
├── Capability
├── Operation
├── Input
├── ContextReference
├── CorrelationId
└── Options
```

The request should identify the business capability and operation rather than simply being:

```text
POST /chat
```

---

# 15. AI Operation

An AI operation represents a business-level AI action.

Examples:

```text
GenerateLesson
GenerateQuestions
ExplainLesson
GenerateHint
ReviewAnswer
GenerateFeedback
ImproveContent
TranslateContent
SummarizeContent
TranscribeVideo
GenerateStudyPlan
AnswerTutorQuestion
```

This allows usage, authorization, analytics, and auditing to be tied to meaningful platform operations.

---

# 16. AI Skill Model

The Assistant should use explicit skills rather than one unrestricted general-purpose prompt.

```text
AI Skill
│
├── Skill ID
├── Capability
├── Operation
├── Required AI Level
├── Context Requirements
├── Allowed Tools
├── Output Contract
└── Usage Policy
```

Example:

```text
Skill:
GenerateLesson

Capability:
Lesson Authoring

Required AI Level:
Co-Pilot

Context:
Learning Product + Lesson + Tutor Preferences

Output:
LessonDraft
```

---

# 17. Initial AI Skill Groups

## Student Skills

```text
ExplainLesson
AnswerQuestion
GiveHint
GeneratePractice
ReviewAnswer
GenerateQuiz
StudyPlan
```

## Tutor Skills

```text
CreateLesson
ImproveLesson
GenerateQuestions
GenerateQuiz
GenerateActivities
AnalyzeStudentPerformance
RecommendLearningContent
```

## Content Skills

```text
TranscribeVideo
SummarizeContent
GenerateInteractiveQuestions
TranslateContent
ImproveContent
GenerateMetadata
```

---

# 18. AI Context Architecture

The AI Assistant must not receive unrestricted access to the Platform database.

The incorrect model is:

```text
AI
 │
 ▼
Database
```

The correct model is:

```text
AI Assistant
      │
      ▼
Context Provider
      │
      ├── Workspace Context
      ├── Learning Context
      ├── Lesson Context
      ├── Student Context
      ├── Tutor Context
      └── Content Context
```

The Context Provider returns only data explicitly required by the AI skill.

---

# 19. Context Provider

Conceptually:

```text
IAIContextProvider
```

Specialized providers may include:

```text
IWorkspaceAIContextProvider
ILearningAIContextProvider
ILessonAIContextProvider
IStudentAIContextProvider
ITutorAIContextProvider
IAssessmentAIContextProvider
```

The AI Assistant should consume domain-approved context rather than querying domain databases directly.

---

# 20. Example: Student Question

Student asks:

> Why did I get this question wrong?

The AI should receive controlled context such as:

```text
Workspace:
Arabic Tutor

Course:
Arabic Grammar

Lesson:
Past Tense

Question:
She ____ to school yesterday.

Student Answer:
go

Correct Answer:
went

Learning Objective:
Irregular past-tense verbs
```

The AI then generates the explanation.

The student does not need to manually provide all of this information.

---

# 21. Example: Tutor Lesson Generation

Tutor requests:

```text
Create a lesson about fractions
for a 9-year-old student.
```

Context may contain:

```text
Tutor Workspace
    │
    ├── Learning Product
    ├── Curriculum
    ├── Existing Lessons
    ├── Student Level
    ├── Tutor Preferences
    └── Lesson Standards
```

The AI produces a structured lesson draft.

The result should then return to the owning Learning capability rather than becoming an AI-owned lesson.

---

# 22. AI Does Not Own Learning Content

The AI Assistant generates content.

It does not own that content.

For example:

```text
AI
 │
 ▼
GenerateLesson
 │
 ▼
LessonDraft
 │
 ▼
Learning Domain
 │
 ▼
Tutor Saves / Publishes
```

The Lesson remains owned by the Learning domain.

This preserves the existing Learning Delivery and Learning Product architecture.

---

# 23. AI Orchestrator

The AI Orchestrator coordinates the complete AI operation.

Example:

```text
Generate Lesson From Video
```

may become:

```text
1. Validate entitlement
2. Reserve estimated AI usage
3. Obtain video context
4. Transcribe video
5. Generate lesson structure
6. Generate explanation
7. Generate questions
8. Generate interactive activities
9. Normalize result
10. Record actual usage
11. Release unused reservation
12. Return LessonDraft
```

This is a workflow, not a single model invocation.

---

# 24. Parent and Child AI Operations

A single business operation may generate multiple AI operations.

Example:

```text
Business Operation
LESSON-GENERATION-123
        │
        ├── Transcription
        ├── Summary
        ├── Question Generation
        ├── Activity Generation
        └── Feedback Generation
```

All child operations must retain the parent correlation identifier.

This directly aligns with Usage & Metering's requirement that correlated AI operations remain attributable to the original request.

---

# 25. AI Operation Correlation

The AI Assistant should generate:

```text
RequestId
CorrelationId
ParentOperationId
OperationId
```

Example:

```text
CorrelationId:
LESSON-GENERATION-123

Operation:
GenerateQuestions

Parent:
GenerateLesson
```

Usage & Metering then records consumption with the correlation information.

The Usage & Metering data model requires `UsageEvent.correlation_id` to be unique at the database level to guarantee idempotency.

---

# 26. AI Usage Reservation

Expensive operations should reserve estimated usage before execution.

```text
AI Request
    │
    ▼
Estimate
    │
    ▼
Usage Reservation
    │
    ├── Insufficient → Reject
    │
    ▼
Execute
```

Usage & Metering explicitly models `UsageReservation` separately from `UsageEvent`. A reservation represents expected consumption; it is not actual consumption.

---

# 27. Reservation Lifecycle

```text
Requested
    │
    ▼
Reserved
    │
    ├───────────────┐
    ▼               ▼
Completed        Failed
    │               │
    ▼               ▼
Commit Usage     Release
    │
    ▼
UsageEvent
```

Example:

```text
Estimated:
1,000 AI Credits

Actual:
920 AI Credits

Released:
80 AI Credits
```

---

# 28. AI Authorization and Usage Are Different

The Assistant must never confuse:

```text
Entitlement
```

with:

```text
Usage
```

For example:

```text
AI Entitlement:
75,000 credits

Usage:
42,380 credits

Remaining:
32,620 credits
```

Licensing determines the allowance.

Usage & Metering determines consumption.

The AI Assistant coordinates the operation between them.

---

# 29. AI Pre-Authorization Flow

```text
AI Request
    │
    ▼
Identify Capability
    │
    ▼
HasEntitlement?
    │
    ├── No → Reject
    │
    ▼
Estimate Usage
    │
    ▼
Reserve Usage
    │
    ├── Cannot Reserve → Reject
    │
    ▼
Execute AI Operation
```

This is particularly important for:

* video transcription;
* large document processing;
* batch generation;
* multi-step lesson generation;
* large assessments.

---

# 30. AI Provider Abstraction

The AI Assistant must not expose provider-specific APIs to the Learning Workspace.

Instead:

```text
IAIProvider
```

Conceptually:

```text
Generate()
Stream()
Embed()
Transcribe()
Moderate()
```

Provider implementations may include:

```text
OpenAIProvider
OtherProvider
FutureProvider
```

The actual providers are infrastructure choices, not Learning Domain concepts.

---

# 31. Model Routing

The Assistant should separate:

```text
AI Skill
```

from:

```text
AI Model
```

For example:

```text
GenerateLesson
       │
       ▼
Model Router
       │
       ├── Model A
       ├── Model B
       └── Model C
```

This allows the Platform to change models without changing business capabilities.

---

# 32. Model Selection Factors

Model selection may consider:

```text
Skill
Complexity
Context Size
Latency Requirement
Cost
Workspace Entitlement
Provider Availability
Model Availability
```

The business capability should never contain code such as:

```text
if (model == "...")
```

---

# 33. Provider Independence

The Platform's commercial abstraction remains:

```text
AI Credits
```

not:

```text
OpenAI Tokens
```

This is essential because the Usage & Metering architecture explicitly requires provider usage to be normalized into the Platform's AI Credit model.

Therefore:

```text
Provider A
Provider B
Provider C
      │
      ▼
Provider Usage
      │
      ▼
Normalization
      │
      ▼
AI Credits
```

---

# 34. AI Response Contract

AI responses should be normalized into platform-defined contracts.

Example:

```text
GenerateLessonResult
│
├── Title
├── Description
├── Objectives
├── Sections
├── Examples
├── Questions
├── Activities
└── Metadata
```

The Learning Domain should not depend on the provider's raw JSON response.

---

# 35. Structured Output

Where an AI operation is intended to produce platform data, the AI Assistant should request structured output.

Example:

```text
GenerateQuestions
        │
        ▼
QuestionGenerationResult
        │
        ├── QuestionType
        ├── QuestionText
        ├── Options
        ├── CorrectAnswer
        ├── Explanation
        └── SuggestedTimestamp
```

The result can then be validated by the owning Learning capability.

---

# 36. AI Response Validation

AI-generated output is not automatically trusted.

The pipeline should be:

```text
AI Provider
     │
     ▼
Raw Response
     │
     ▼
Schema Validation
     │
     ▼
Business Validation
     │
     ▼
Safety Validation
     │
     ▼
Normalized Result
```

Invalid output should not silently enter the Learning Domain.

---

# 37. AI Safety Boundary

AI Assistant should provide a central place for AI-specific safety policies.

Potential policies include:

```text
Input validation
Output validation
Content safety
Prompt injection protection
Tool authorization
Sensitive-data filtering
Rate limiting
Abuse prevention
```

The exact safety policies remain an implementation concern and should be expanded in a dedicated AI Safety & Governance architecture.

---

# 38. AI Tool Access

AI should not receive unrestricted access to Platform tools.

Instead:

```text
AI Skill
    │
    ▼
Allowed Tool Set
```

Example:

```text
Student ExplainLesson

Allowed:
✓ Read current lesson
✓ Read current question
✓ Read student's answer

Not allowed:
✗ Modify subscription
✗ Modify entitlement
✗ Delete lesson
✗ Access another workspace
```

Tool access must be capability-specific.

---

# 39. AI Agent Model

The architecture should allow future agentic workflows.

Example:

```text
Tutor:
"Create a complete lesson from this video."

AI Agent
   │
   ├── Read Video
   ├── Transcribe
   ├── Generate Lesson
   ├── Generate Questions
   ├── Generate Activities
   └── Return Draft
```

However, every operation must remain attributable to:

```text
Original Actor
+
Original Request
+
Workspace
+
Capability
```

This aligns with the Usage & Metering model's explicit actor attribution and correlation requirements.

---

# 40. Human vs AI Agent Attribution

AI operations should identify the initiating actor.

Possible actor types:

```text
Student
Tutor
Administrator
System
Automation
AI Agent
API
Background Job
```

Example:

```text
Actor Type:
Tutor

Actor ID:
TUTOR-123

Initiating Operation:
GenerateLesson
```

The AI Agent may execute child operations, but it must not become the owner of the commercial consumption.

---

# 41. AI Operation Lifecycle

```text
Requested
    │
    ▼
Authorized
    │
    ▼
Usage Reserved
    │
    ▼
Context Built
    │
    ▼
Skill Resolved
    │
    ▼
Model Selected
    │
    ▼
Executing
    │
    ├── Failed
    │
    ├── Cancelled
    │
    └── Completed
             │
             ▼
       Usage Reconciled
             │
             ▼
          Completed
```

---

# 42. Failure Handling

AI operations can fail independently of Platform authorization.

Examples:

```text
Provider unavailable
Model unavailable
Timeout
Rate limit
Invalid response
Safety rejection
Context unavailable
Reservation expired
Workspace entitlement revoked
```

The AI Assistant should distinguish these outcomes.

Example:

```text
AI_OPERATION_NOT_ENTITLED

AI_USAGE_LIMIT_REACHED

AI_PROVIDER_UNAVAILABLE

AI_RESPONSE_INVALID

AI_SAFETY_REJECTED

AI_OPERATION_TIMEOUT
```

---

# 43. Retry Policy

Retries must be carefully controlled because retrying an AI request may create additional provider usage.

Therefore:

```text
Retry
   │
   ▼
New provider attempt
   │
   ▼
Additional actual usage
```

Every billable/provider-consuming attempt must remain attributable and idempotently recorded.

The AI Assistant should never assume:

> "Retrying is free."

---

# 44. Idempotency

AI operations must have an idempotency mechanism.

Example:

```text
IdempotencyKey:
AI-REQUEST-89231
```

If the same request is submitted twice:

```text
Request 1 → Execute

Request 2 → Return existing operation/result
```

This protects against duplicate AI generation caused by:

* network retries;
* frontend retries;
* API gateway retries;
* browser refresh;
* distributed processing.

Usage & Metering separately enforces usage-event idempotency using a unique correlation ID.

---

# 45. Streaming

The AI Assistant may support streaming responses.

```text
AI Request
    │
    ▼
AI Provider
    │
    ▼
Stream
    │
    ├── Partial Response
    ├── Partial Response
    ├── Partial Response
    └── Final Response
```

However, the operation remains one logical AI operation.

Usage must be recorded based on the final provider usage information where available.

---

# 46. AI Conversation

A conversation is a reusable interaction context.

```text
AI Conversation
│
├── Conversation ID
├── Workspace
├── Actor
├── Capability
├── Context Reference
├── Messages
└── Operations
```

Example:

```text
Student
   │
   ▼
Lesson
   │
   ▼
AI Conversation
   │
   ├── Explain this
   ├── Give another example
   ├── Quiz me
   └── Why is this wrong?
```

Conversation history should not automatically imply unrestricted access to all previous Workspace data.

---

# 47. Context Scope

Every AI conversation should have an explicit context scope.

Examples:

```text
Lesson
Course
Learning Product
Workspace
Assessment
Student Activity
```

The Assistant should use the narrowest context necessary.

Example:

```text
Explain this question
```

should not automatically load:

```text
Entire Workspace
```

---

# 48. AI Memory

Long-lived AI memory should be treated separately from ordinary conversation history.

Potential future categories:

```text
Tutor Preferences
Student Learning Preferences
Workspace AI Preferences
Conversation History
Learning History
```

Memory must remain governed by the owning domain and applicable privacy policies.

This document does not yet define the final AI Memory architecture.

---

# 49. AI Commercial Control Flow

The complete commercial control path is:

```text
Product Configuration
        │
        ▼
Configuration Snapshot
        │
        ▼
Subscription
        │
        ▼
Workspace License
        │
        ▼
Effective AI Entitlement
        │
        ▼
AI Assistant
        │
        ▼
Usage Reservation
        │
        ▼
AI Operation
        │
        ▼
Usage Event
        │
        ▼
Usage Aggregate
        │
        ▼
Usage Counter
```

This is the central integration model.

---

# 50. Example: AI Credit Allowance

Suppose the commercial configuration produces:

```text
Included AI Credits:
75,000

Purchased AI Credits:
0

Promotional AI Credits:
25,000

Effective Allowance:
100,000
```

Licensing owns the effective allowance.

Usage & Metering records consumption.

The AI Assistant simply coordinates the operation.

---

# 51. Promotional AI Credits

Promotional credits remain distinguishable from included and purchased credits.

The established consumption order is:

```text
1. Expiring Promotional Credits
2. Purchased Add-on Credits
3. Included Subscription Credits
```

This ordering is defined by Licensing & Entitlements and must not be reimplemented inside AI Assistant.

The AI Assistant only requests authorization/reservation.

---

# 52. AI Credit Exhaustion

Example:

```text
Allowance:
75,000

Consumed:
74,900

Requested Estimate:
500
```

Remaining:

```text
100
```

If Licensing policy is:

```text
Block
```

the AI Assistant returns:

```text
AI_USAGE_LIMIT_REACHED
```

The user interface may then offer:

```text
Buy AI Credit Pack
Upgrade Plan
```

The AI Assistant itself does not perform the commercial upgrade.

---

# 53. Overage

If a future commercial configuration allows overage:

```text
Allowance:
75,000

Consumed:
75,000

New Operation:
500

Policy:
Overage Allowed
```

The AI operation may proceed.

Usage becomes:

```text
75,500
```

Usage & Metering exposes the actual consumption for the commercial system.

The AI Assistant must therefore not hardcode:

```text
usage >= allowance → always block
```

---

# 54. AI Usage Dimensions

Every AI usage operation should support attribution to:

```text
Workspace
Subscription
Capability
Operation
Actor
Model
Provider
Correlation
Billing Period
```

The Usage & Metering architecture already defines these dimensions as important for analytics and commercial control.

---

# 55. AI Usage Event

Conceptually:

```text
UsageEvent
│
├── WorkspaceId
├── SubscriptionId
├── MeterId
├── CapabilityId
├── Operation
├── Provider
├── Model
├── RawUsage
├── NormalizedUsage
├── MeterVersion
├── ActorType
├── ActorId
├── CorrelationId
└── Timestamp
```

This corresponds directly with the updated Usage & Metering data model.

---

# 56. Meter Version

AI Assistant should not calculate historical commercial usage using current pricing/conversion rules.

Usage & Metering stores:

```text
MeterVersion
```

on each usage event.

Therefore:

```text
AI Provider Usage
      │
      ▼
AI Credit Calculation
      │
      ▼
Meter Version
      │
      ▼
UsageEvent
```

Historical events remain reproducible even when the AI credit calculation changes.

---

# 57. AI Cost vs AI Credits

The architecture intentionally separates:

```text
Provider Cost
```

from:

```text
Customer AI Credits
```

Example:

```text
Provider Usage
     ↓
Provider Cost
     ↓
AI Credit Calculator
     ↓
Customer Consumption
```

This allows the Platform to control commercial margins without exposing provider economics to customers.

---

# 58. AI Provider Cost Tracking

Provider cost should be retained as internal usage metadata where available.

For example:

```text
Provider:
OpenAI

Model:
Model-X

Input Tokens:
4,500

Output Tokens:
1,800

Provider Cost:
Internal

AI Credits:
920
```

The customer-facing commercial model remains AI Credits.

---

# 59. AI Usage Dashboard

The Workspace may consume a read model such as:

```text
AI Usage

42,380 / 75,000

56.5% Used

32,620 Remaining
```

Breakdown:

```text
Lesson Authoring       20,400
Assessment              9,800
Transcription           7,300
AI Feedback             4,880
```

These are read models derived from Usage & Metering, not counters maintained by AI Assistant.

Usage & Metering explicitly defines `UsageCounter` as a materialized read model rather than a write target.

---

# 60. AI Events

The AI Assistant may publish operational events such as:

```text
AIRequestReceived
AIOperationAuthorized
AIUsageReserved
AIOperationStarted
AIOperationCompleted
AIOperationFailed
AIUsageReconciled
AIResponseRejected
```

These are AI operational events.

Commercial usage remains represented by Usage & Metering events.

---

# 61. Domain Event Separation

The distinction should remain clear:

```text
AI Assistant Events
"What happened during the AI operation?"

Usage Events
"What resource was actually consumed?"

Entitlement Events
"What is the Workspace allowed to use?"
```

Licensing publishes events such as:

```text
EntitlementGranted
EntitlementChanged
EntitlementRevoked
```

and dependent domains react without polling.

---

# 62. Entitlement Revocation During AI Operation

A Workspace may lose its AI entitlement while an operation is running.

Example:

```text
AI Operation Started
        │
        ▼
Subscription State Changes
        │
        ▼
License Restricted
        │
        ▼
EntitlementRevoked
```

The AI Assistant must define an operation policy for in-flight requests.

At minimum:

```text
New AI operations:
Rejected

Already-running operations:
Continue or cancel according to operation policy
```

The exact cancellation policy should be finalized before implementation.

The important boundary is that Licensing owns the entitlement change; AI Assistant reacts to it.

---

# 63. License State Effects

The AI Assistant should respect effective license state.

Examples:

```text
Active
→ AI operations allowed according to entitlement.

Grace
→ AI behavior determined by commercial policy.

Restricted
→ Restricted AI capabilities may be disabled.

Suspended
→ Paid AI operations may be blocked.

Expired
→ AI entitlement unavailable.

Revoked
→ AI entitlement unavailable.
```

The License state is derived from Subscription state and commercial policy; AI Assistant must not maintain its own subscription state.

---

# 64. Workspace Isolation

Every AI request must be workspace-scoped.

```text
AI Request
    │
    ▼
Workspace Context
    │
    ▼
Entitlement
    │
    ▼
Context Provider
    │
    ▼
AI Operation
```

An AI operation must never be able to cross Workspace boundaries unless an explicitly authorized platform capability permits it.

---

# 65. Student and Tutor Attribution

AI usage may optionally be attributed to:

```text
Tutor
Student
```

while Workspace remains the authoritative commercial scope.

Example:

```text
Workspace:
40,000 credits

Tutor A:
20,000

Tutor B:
12,000

Student activity:
8,000
```

The Usage & Metering architecture explicitly supports tutor attribution and optional student attribution.

---

# 66. Multi-Tutor Workspace

The AI Assistant must support multiple tutors operating within one Workspace.

Commercial usage remains:

```text
Workspace
```

while operational attribution may be:

```text
Tutor
```

Example:

```text
Workspace
│
├── Tutor A
│    ├── GenerateLesson
│    └── GenerateQuiz
│
└── Tutor B
     ├── GenerateLesson
     └── AI Feedback
```

The AI Assistant must not create separate commercial accounts for each tutor unless a future commercial policy explicitly requires that.

---

# 67. AI Operation Security

Every operation must validate:

```text
Actor
Workspace
Capability
Entitlement
Context
Tool Authorization
Usage Authorization
```

Only then may the operation execute.

---

# 68. AI Tool Authorization

A tool should have an explicit contract:

```text
AITool
│
├── ToolId
├── Name
├── RequiredCapability
├── RequiredPermission
├── AllowedSkills
├── InputSchema
└── OutputSchema
```

Example:

```text
Tool:
GetCurrentLesson

Allowed Skill:
ExplainLesson

Permission:
Read Lesson
```

Another:

```text
Tool:
CreateLessonDraft

Allowed Skill:
GenerateLesson

Permission:
Create Draft
```

---

# 69. AI Should Not Bypass Domain APIs

The AI Assistant should interact with domains through their application contracts.

Incorrect:

```text
AI
 ↓
EF Core
 ↓
Lesson table
```

Correct:

```text
AI
 ↓
Learning Application API
 ↓
Learning Domain
 ↓
Lesson
```

This prevents AI from bypassing domain rules.

---

# 70. AI and Product Configuration

AI Assistant must not modify Product Configuration directly.

For example, if a tutor says:

> "Give me more AI credits."

The AI Assistant may explain:

> Your current allowance is 75,000 credits.

But it should not directly change:

```text
Configuration
```

Instead:

```text
AI Assistant
     │
     ▼
Commercial Action / Upgrade Intent
     │
     ▼
Product Configuration
```

The Commercial Domain remains authoritative.

---

# 71. AI and Licensing

Likewise, AI Assistant must not grant itself entitlement.

Incorrect:

```text
AI:
"Workspace needs AI+"

→ Grant entitlement
```

Correct:

```text
AI
 ↓
Request Commercial Action
 ↓
Product Configuration
 ↓
Subscription
 ↓
Licensing
 ↓
New Effective Entitlement
```

This preserves LIC-003 and the source-attribution rules in Licensing.

---

# 72. AI and Usage

AI Assistant may request:

```text
EstimateUsage
ReserveUsage
```

but Usage & Metering owns:

```text
UsageEvent
UsageAggregate
UsageCounter
UsageCorrection
```

The updated Usage & Metering data model explicitly states that `UsageCounter` is not directly written and is derived from usage history.

---

# 73. Initial V1 AI Capabilities

The initial AI architecture should support:

```text
P0

AI Tutor Assistant
AI Lesson Generation
AI Question Generation
AI Content Improvement
AI Feedback
AI Usage Tracking
AI Credit Enforcement
```

Potential P1 capabilities:

```text
Video Transcription
Interactive Activity Generation
Translation
Student Study Plans
Student Performance Analysis
```

The exact capability rollout should be driven by the Learning Workspace roadmap.

---

# 74. AI Commercial Model

AI is not intrinsically a separate subscription.

Instead:

```text
Product Configuration
        │
        ▼
AI Assistance Level
        +
AI Credit Allowance
        │
        ▼
License Entitlements
```

For example:

```text
Product:
Solo AI+

AI Assistance:
Co-Pilot

AI Credits:
75,000/month
```

Another configuration could provide:

```text
AI Assistance:
Basic

AI Credits:
10,000/month
```

The AI Assistant does not care which commercial product produced those entitlements.

---

# 75. AI Credit Add-ons

The Product Configuration Engine already supports usage upgrades and AI credit configuration.

Therefore a future commercial configuration can be:

```text
Base Product:
Solo AI+

Included:
75K AI Credits

Add-on:
+25K AI Credits
```

Licensing resolves:

```text
AI Credits = 100K
```

Usage measures consumption.

The AI Assistant enforces the runtime entitlement.

---

# 76. AI Provider Cost Does Not Define Entitlement

A provider may become cheaper or more expensive.

That must not automatically change the Workspace entitlement.

Instead:

```text
Provider Cost
      │
      ▼
AI Credit Calculation
      │
      ▼
Usage & Metering
```

while:

```text
Commercial Configuration
      │
      ▼
AI Credit Allowance
      │
      ▼
Licensing
```

remain separate.

---

# 77. AI Provider Replacement

Changing provider should not require changing:

```text
Learning Workspace
Product Configuration
Licensing
Subscription
```

The change should occur behind:

```text
AI Provider Gateway
```

Example:

```text
Before:

AI Orchestrator
      ↓
Provider A


After:

AI Orchestrator
      ↓
Provider B
```

Commercial AI Credits remain unchanged.

---

# 78. AI Architecture and Existing Commercial Spine

The resulting architecture is:

```text
┌──────────────────────────────────────────────┐
│              COMMERCIAL DOMAIN               │
│                                              │
│ Product Management                           │
│        ↓                                     │
│ Product Configuration Engine                │
│        ↓                                     │
│ Subscription                                 │
│        ↓                                     │
│ Licensing & Entitlements                     │
└──────────────────────┬───────────────────────┘
                       │
                       │ Effective Entitlements
                       ▼
┌──────────────────────────────────────────────┐
│                 AI ASSISTANT                 │
│                                              │
│ Request Gateway                              │
│ Authorization                                │
│ Context Builder                              │
│ Skill Resolver                               │
│ Orchestrator                                 │
│ Model Router                                 │
│ Provider Gateway                             │
│ Response Validation                           │
└──────────────────────┬───────────────────────┘
                       │
                       │ Actual Provider Usage
                       ▼
┌──────────────────────────────────────────────┐
│              USAGE & METERING                │
│                                              │
│ UsageEvent                                   │
│ UsageReservation                             │
│ UsageAggregate                               │
│ UsageCounter                                 │
│ UsageCorrection                              │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
                    Billing
```

---

# 79. Core Interfaces

Conceptually, the AI Assistant should expose contracts similar to:

```text
IAIAssistant

ExecuteAsync(AIRequest)

StreamAsync(AIRequest)

GetOperationAsync(operationId)
```

Authorization:

```text
IAIAuthorizationService

CanExecuteAsync(
    workspaceId,
    capability,
    operation
)
```

Context:

```text
IAIContextProvider

BuildContextAsync(
    workspaceId,
    capability,
    contextReference
)
```

Skills:

```text
IAISkillResolver

ResolveAsync(
    capability,
    operation
)
```

Provider:

```text
IAIProviderGateway

ExecuteAsync(
    modelRequest
)
```

Usage:

```text
IAIUsageService

EstimateAsync(...)
ReserveAsync(...)
RecordActualUsageAsync(...)
ReleaseAsync(...)
```

The exact interfaces should be finalized during implementation design.

---

# 80. Application Boundary

The Learning Workspace should see:

```text
IAIAssistant
```

not:

```text
IOpenAIClient
```

This is one of the most important implementation boundaries.

Example:

```text
LessonAuthoringService
        │
        ▼
IAIAssistant
        │
        ▼
AI Orchestrator
        │
        ▼
AI Provider Gateway
```

---

# 81. API Boundary

Potential API:

```text
POST /api/ai/operations
GET  /api/ai/operations/{id}
GET  /api/ai/conversations/{id}
POST /api/ai/conversations
```

Capability-specific application endpoints may also exist:

```text
POST /api/lessons/{id}/ai/generate
POST /api/assessments/ai/generate
```

Those endpoints should delegate to the same AI Assistant infrastructure rather than implementing separate provider integrations.

---

# 82. Synchronous vs Asynchronous AI

Not every AI operation should be synchronous.

### Synchronous

Suitable for:

```text
ExplainLesson
GiveHint
ReviewAnswer
Short AI Tutor response
```

### Asynchronous

Suitable for:

```text
Video Transcription
Generate Complete Lesson
Generate Large Quiz
Batch Content Generation
Large Document Processing
```

The AI Assistant should expose a unified operation model while allowing different execution strategies.

---

# 83. AI Operation State

Recommended state model:

```text
Requested
Authorized
Reserved
Queued
Running
Completed
Failed
Cancelled
Expired
```

The state is operational AI state.

It must not be confused with:

```text
Subscription State
License State
Usage Status
```

---

# 84. Observability

Every AI operation should be observable using:

```text
RequestId
OperationId
CorrelationId
WorkspaceId
ActorId
Capability
Operation
Provider
Model
Duration
Status
Usage
```

This allows the Platform to answer:

> What happened when this tutor clicked Generate?

without relying only on provider logs.

---

# 85. Commercial Observability

The Platform should also be able to answer:

```text
How many AI credits were consumed?

Which capability consumed them?

Which tutor initiated them?

Which model/provider was used?

Which subscription period?

Which operation generated the usage?
```

The Usage & Metering model already provides the required dimensions for this.

---

# 86. Auditability

AI operations should be traceable:

```text
User Action
     ↓
AI Request
     ↓
Authorization
     ↓
Reservation
     ↓
AI Operation
     ↓
Provider Usage
     ↓
Usage Event
```

This allows support and commercial operations to reconstruct disputes.

---

# 87. AI Data Retention

AI Assistant should distinguish:

```text
Operational Logs
Conversation History
AI Operation Metadata
Provider Usage
Generated Content
```

These should not automatically share the same retention policy.

Generated Learning content remains subject to the Learning Domain's retention policy.

Usage events remain governed by Usage & Metering's audit requirements.

---

# 88. Important Invariants

### AI-001

The Learning Workspace must never directly depend on a specific AI provider.

### AI-002

The AI Assistant must never grant or modify commercial entitlements.

### AI-003

AI authorization must be based on effective entitlements, not product or plan names.

### AI-004

AI consumption must be recorded through Usage & Metering.

### AI-005

An AI operation must be attributable to a Workspace.

### AI-006

AI operations must support actor attribution.

### AI-007

AI workflows must preserve correlation across child operations.

### AI-008

AI usage reservation must be separate from actual usage.

### AI-009

AI-generated content must remain owned by its domain of origin.

### AI-010

AI provider-specific usage must be normalized into the Platform's commercial AI Credit model.

### AI-011

AI provider/model changes must not require changes to commercial product definitions.

### AI-012

AI tools must be explicitly authorized per skill/capability.

### AI-013

AI-generated structured output must pass schema and business validation before entering a domain.

### AI-014

AI retry behavior must not create untracked or duplicate commercial usage.

### AI-015

AI Assistant must respect entitlement revocation and license restrictions.

---

# 89. End-to-End Example

A tutor wants to generate a lesson from a video.

```text
Tutor
  │
  ▼
Learning Workspace
  │
  ▼
AI Assistant
  │
  ▼
Identify Operation
GenerateLessonFromVideo
  │
  ▼
Licensing
HasEntitlement(
    LessonAuthoring,
    CoPilot
)
  │
  ▼
Estimate Usage
  │
  ▼
Usage & Metering
ReserveUsage
  │
  ▼
AI Orchestrator
  │
  ├── Get Video
  ├── Transcribe
  ├── Generate Lesson
  ├── Generate Questions
  └── Generate Activities
  │
  ▼
Validate AI Result
  │
  ▼
Learning Domain
  │
  ▼
LessonDraft
  │
  ▼
Usage & Metering
  │
  ├── Commit Actual Usage
  └── Release Unused Reservation
```

The result is:

```text
LessonDraft
```

The AI Assistant does not publish the lesson automatically unless the calling Learning capability explicitly requests a publishing operation and the appropriate permission exists.

---

# 90. End-to-End Commercial Example

Suppose the customer's configuration is:

```text
Product:
Solo AI+

Learning:
AI+

Assessment:
AI+

AI Credits:
75,000
```

The Product Configuration Engine creates the configuration and pricing result.

Licensing resolves:

```text
Learning AI = Enabled
Assessment AI = Enabled
AI Credits = 75,000
```

The Workspace requests:

```text
GenerateLesson
```

AI Assistant asks Licensing:

```text
HasEntitlement(
    LessonAuthoring,
    CoPilot
)
```

Result:

```text
Allowed
```

AI Assistant reserves:

```text
1,000 AI Credits
```

The operation actually consumes:

```text
920 AI Credits
```

Usage & Metering records:

```text
Reserved:
1,000

Actual:
920

Released:
80
```

The resulting usage counter is then derived from the usage history rather than being directly modified by AI Assistant.

---

# 91. Architecture Decision

The Platform will treat AI as:

> **A reusable platform capability with commercial entitlements and metered consumption, not as a direct third-party API integration.**

The resulting separation is:

```text
PRODUCT CONFIGURATION
        │
        │ defines
        ▼
AI ENTITLEMENT
        │
        ▼
LICENSING
        │
        │ authorizes
        ▼
AI ASSISTANT
        │
        │ executes
        ▼
AI PROVIDER
        │
        │ reports usage
        ▼
USAGE & METERING
        │
        ▼
COMMERCIAL ANALYTICS / BILLING
```

---

# 92. Relationship to Existing Documents

## Depends On

* `CommercialDomainReferenceArchitecture.md`
* `ProductConfigurationEngineArchitecture.md`
* `LicensingAndEntitlementArchitecture.md`
* `UsageAndMeteringArchitecture.md`
* Learning Workspace Architecture
* Learning Delivery Architecture
* Learning Product Architecture
* Identity & Workspace Access Architecture

## Integrates With

* `Commercial Domain Data Model.md`
* `Commercial Domain Data Model — Usage & Metering.md`
* `SubscriptionManagementArchitecture.md`
* `BillingArchitecture.md`
* `ProductAdvisoryArchitecture.md`
* Learning Delivery
* Learning Product
* Assessment
* Content Management

## Related AI Sub-Architecture Documents

The documents below were anticipated here and have since been written. This list reflects their actual filenames and current status rather than the original working titles.

```text
AIModelProviderArchitecture.md          — written
AIOrchestrationArchitecture.md          — written
AIContextArchitecture.md                — written
AISkillArchitecture.md                  — written
AIUsageAndCostArchitecture.md           — written
AISafetyAndGovernanceArchitecture.md    — written
AICommercialIntegrationArchitecture.md  — written
AICommercialRuntimeArchitecture.md      — written
AIProductPackagingArchitecture.md       — written
AIMemoryArchitecture.md                 — not yet written
```

---

# 93. Implementation Phases

## Phase 1 — AI Foundation

```text
AI Assistant API
AI Operation Model
AI Provider Gateway
AI Authorization
AI Context Provider
AI Usage Integration
AI Credit Reservation
AI Credit Recording
```

## Phase 2 — First Learning Skills

```text
ExplainLesson
GenerateLesson
GenerateQuestions
ImproveContent
GenerateFeedback
```

## Phase 3 — Advanced Workflows

```text
Video → Lesson
Video → Questions
Lesson → Interactive Activities
Student Performance → Recommendations
```

## Phase 4 — Agentic AI

```text
AI Agent
Tool Registry
Multi-step workflows
Background AI operations
Automated content pipelines
```

---

# 94. V1 Boundary

For V1, the AI Assistant should **not** attempt to become a general autonomous agent platform.

V1 should focus on:

```text
Controlled AI operations
+
Explicit skills
+
Explicit tools
+
Explicit context
+
Commercial entitlement checks
+
AI credit reservation
+
Usage recording
+
Provider abstraction
```

Agentic behavior can be introduced on top of these foundations later.

---

# 95. Final Architectural Model

The final Platform model becomes:

```text
                         COMMERCIAL DOMAIN
                                │
                                ▼
                    Product Configuration
                                │
                                ▼
                         Subscription
                                │
                                ▼
                    Licensing & Entitlements
                                │
                                ▼
                      Effective AI Rights
                                │
                                ▼
                    ┌─────────────────────┐
                    │    AI ASSISTANT     │
                    │                     │
                    │ Request Gateway     │
                    │ Authorization       │
                    │ Context             │
                    │ Skills              │
                    │ Tools               │
                    │ Orchestration       │
                    │ Model Routing       │
                    │ Provider Gateway    │
                    │ Response Validation │
                    └──────────┬──────────┘
                               │
                               ▼
                        AI Provider(s)
                               │
                               ▼
                       Actual AI Usage
                               │
                               ▼
                     Usage & Metering
                               │
                ┌──────────────┼──────────────┐
                ▼              ▼              ▼
             Counters       Analytics       Billing
```

The critical architectural chain is therefore:

> **Configure → Entitle → Authorize → Execute → Measure**

and no bounded context should take ownership of another step.

---

# 96. AI Collaboration Session — Business Aggregate Boundary

Everything above this section describes `AIOperation` as the *execution* unit: one authorized, metered, correlated invocation of a Skill (§15, §24–25, §41). This section reconciles that with the Platform's existing Aggregate model.

The Platform Aggregate Catalogue already lists **AI Collaboration Session** as the Aggregate Root for the AI bounded context, with lifecycle `Started → Active → Completed`, referencing `MembershipId`, `WorkspaceId`, and optionally `LessonId`/`AssessmentId`, and owning `AI Recommendation` as an internal entity. A full aggregate-design formalization already exists in `AI_Collaboration_Session_Aggregate_Design.md` — root, entities, value objects, invariants, domain events, and commands — and remains authoritative for that structure. It is not superseded by this document.

The relationship between the two models is one of granularity, not conflict:

```text
AI Collaboration Session (Aggregate Root, business-scoped)
        │
        │  Started → Active → Completed
        │  "What is the user and AI working on, right now, together?"
        │
        └── Capability Invocations (entities within the Session)
                │
                │  each Capability Invocation corresponds 1:1 to
                │  one AIOperation as defined in this document (§15)
                │
                └── AIOperation
                        Requested → Authorized → ... → Completed (§41)
                        "Execute this one Skill call."
```

A single AI Collaboration Session — for example, a tutor authoring one lesson — will typically span several correlated `AIOperation`s (`GenerateLesson`, then `GenerateQuestions`, then several `ImproveContent` calls), exactly as already modeled by this document's Parent/Child AI Operation correlation (§24–25). The Session is the business consistency boundary that groups them and tracks the Recommendation review lifecycle (Accepted/Rejected/Edited); the `AIOperation` is the orchestration-layer unit that `AIOrchestrationArchitecture.md` actually executes.

```text
Owned by AI Collaboration Session:   Recommendation accept/reject/edit history,
                                      Collaboration State, session lifecycle
Owned by AIOperation:                authorization, usage reservation, context
                                      assembly, model routing, provider execution
```

Neither document should restate the other's structure. Business-aggregate questions (session lifecycle, recommendation review, ownership transfer to Lesson Revision on acceptance) are answered by `AI_Collaboration_Session_Aggregate_Design.md`. Execution questions (how a single AI operation runs) are answered by this document and `AIOrchestrationArchitecture.md`.

---

# 97. Status

**Draft — Version 1.0**

This document establishes the AI Assistant as a platform capability that is commercially controlled through the existing Product Configuration → Subscription → Licensing & Entitlements chain and commercially measured through Usage & Metering.

The architecture deliberately avoids coupling the Learning Workspace to a specific AI provider and establishes AI Credits as the customer-facing commercial measurement while provider-specific tokens remain internal usage data.

The updated Usage & Metering model is treated as authoritative for `UsageEvent`, `UsageReservation`, `UsageAggregate`, `UsageCounter`, meter versioning, actor attribution, and usage corrections.

The updated Licensing architecture is treated as authoritative for effective AI assistance levels, usage allowances, entitlement source precedence, runtime `HasEntitlement`, license state, and entitlement revocation.
The Product Configuration Engine remains authoritative for AI configuration, AI credit configuration, capability packs, configuration snapshots, pricing, and resulting entitlement composition.
