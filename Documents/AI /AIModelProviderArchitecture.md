# AIModelProviderArchitecture.md

**Version:** 1.0
**Status:** Draft
**Bounded Context:** AI Assistant
**Architectural Layer:** Model Infrastructure
**Depends On:**

* `AIAssistantArchitecture.md`
* `AIOrchestrationArchitecture.md`
* `AIContextArchitecture.md`
* `AISkillArchitecture.md`
* `LicensingAndEntitlementArchitecture.md`
* `BillingArchitecture.md`
* `UsageAndMeteringArchitecture.md`
* `ProductConfigurationArchitecture.md`

---

# 1. Purpose

This document defines how the Platform integrates with AI model providers while keeping the AI architecture independent from any specific vendor.

The Platform should be able to start with a single provider and later support additional providers without changing:

* AI Skills
* Learning Workspace
* Student Experience
* Tutor Experience
* Licensing
* Billing
* Usage & Metering
* Product Configuration

The central principle is:

> **The Platform owns AI capabilities; providers supply model execution.**

---

# 2. The Architectural Problem

A naïve implementation might allow application code to directly call a provider SDK:

```text
Learning Workspace
       ↓
OpenAI SDK
       ↓
Model
```

This creates vendor coupling.

Later, if the Platform needs:

```text
Provider A
Provider B
Provider C
Self-hosted Model
```

the application becomes difficult to change.

The desired architecture is:

```text
AI Skill
    ↓
AI Orchestrator
    ↓
Model Router
    ↓
Provider Abstraction
    ↓
Provider Adapter
    ↓
AI Provider
```

---

# 3. Provider Independence

The AI architecture must not make a Skill aware of:

```text
OpenAI
Anthropic
Google
Azure
AWS
Local Model
```

The Skill should express requirements such as:

```text
Reasoning: High
Context: Large
StructuredOutput: Required
Streaming: Optional
Vision: Required
SpeechToText: Required
```

The Model Router selects an appropriate implementation.

---

# 4. Provider vs Model

These concepts must remain separate.

### Provider

The organization or infrastructure exposing AI capabilities.

### Model

The specific model used for execution.

Example:

```text
Provider
   ↓
Model
```

A provider may expose multiple models.

---

# 5. Provider Adapter

Each provider should be integrated through an adapter.

Conceptually:

```text
IModelProvider
```

with implementations:

```text
OpenAIModelProvider
AnthropicModelProvider
GoogleModelProvider
AzureOpenAIModelProvider
LocalModelProvider
```

The exact providers are implementation choices and may change.

---

# 6. Provider Abstraction

The abstraction should represent capabilities rather than provider-specific APIs.

Conceptually:

```text
IAIModelProvider
│
├── Generate
├── Stream
├── Embed
├── Transcribe
└── Analyze
```

Not every provider needs to implement every capability.

---

# 7. Capability-Based Provider Model

A provider should advertise supported capabilities.

```text
ProviderCapabilities
│
├── TextGeneration
├── StructuredOutput
├── Streaming
├── Vision
├── Audio
├── SpeechToText
├── Embeddings
└── ToolCalling
```

The Model Router uses these capabilities when selecting a model.

---

# 8. Model Descriptor

The Platform should maintain a normalized model descriptor.

Conceptually:

```text
AIModelDescriptor
│
├── ModelId
├── ProviderId
├── Capabilities
├── ContextWindow
├── SupportedInputs
├── SupportedOutputs
├── QualityProfile
├── CostProfile
└── Availability
```

The descriptor should not expose provider-specific implementation details to Skills.

---

# 9. Logical Model Identity

The Platform should distinguish between:

```text
Logical Model
```

and:

```text
Provider Model
```

Example:

```text
Logical Capability:
FastConversationalModel

Provider:
Provider A

Provider Model:
model-x
```

The underlying model may later change without changing the Skill.

---

# 10. Model Router

The Model Router is responsible for selecting an appropriate model.

```text
Skill Requirements
        +
Context Characteristics
        +
Provider Capabilities
        +
Cost Policy
        +
Availability
        +
Workspace Policy
        ↓
Model Router
        ↓
Selected Model
```

---

# 11. Model Selection Must Not Be Skill-Specific

A Skill should not contain:

```text
if provider == X
    use model A
```

Instead:

```text
Skill
 ↓
Model Requirements
 ↓
Model Router
```

This keeps model infrastructure centralized.

---

# 12. Model Requirements

A Skill may define:

```text
ModelRequirements
│
├── MinimumQuality
├── RequiredCapabilities
├── ContextSize
├── StructuredOutput
├── Streaming
├── Vision
├── Audio
├── ToolCalling
└── LatencyPreference
```

---

# 13. Quality Profile

Models may be classified by logical quality profiles.

Example:

```text
Fast
Balanced
HighQuality
Reasoning
Specialized
```

These are Platform concepts.

They should not necessarily correspond directly to provider marketing categories.

---

# 14. Cost Profile

A model may have an internal cost profile.

Conceptually:

```text
ModelCostProfile
│
├── InputCost
├── OutputCost
├── AudioCost
├── ImageCost
└── RequestCost
```

These values are infrastructure economics.

They are not customer pricing.

---

# 15. Provider Cost vs Customer Pricing

These must remain separate.

```text
Provider Cost
      ↓
AI Infrastructure Economics
```

while:

```text
Customer Usage
      ↓
Usage & Metering
      ↓
Commercial Pricing
      ↓
Billing
```

A provider changing its price must not automatically change customer pricing.

---

# 16. Provider Configuration

Provider configuration should be externalized.

Conceptually:

```text
AIProviderConfiguration
│
├── ProviderId
├── Endpoint
├── CredentialReference
├── Enabled
└── Configuration
```

Credentials must never be stored in Skill configuration.

---

# 17. Credential Management

Provider credentials should be managed through secure infrastructure.

The AI application should receive a secure credential reference rather than embedding secrets in code.

Never place:

```text
API Key
Secret
Provider Token
```

inside:

```text
Skill Definition
Prompt
Context
Database Entity
Source Code
```

---

# 18. Provider Isolation

The Provider Adapter is the only layer that should understand provider-specific concepts.

Example:

```text
OpenAI Adapter
```

may understand:

```text
Provider-specific model names
Provider-specific request format
Provider-specific response format
Provider-specific streaming
Provider-specific tool protocol
```

The rest of the Platform should not.

---

# 19. Provider Request

The normalized Platform request should look conceptually like:

```text
AIModelRequest
│
├── ModelRequirements
├── Messages
├── Context
├── Tools
├── OutputSchema
├── TemperaturePolicy
├── TokenBudget
└── ExecutionOptions
```

The adapter transforms this into the provider-specific request.

---

# 20. Provider Response

Provider-specific responses must be normalized.

```text
Provider Response
      ↓
Provider Adapter
      ↓
Normalized AIModelResponse
```

Example:

```text
AIModelResponse
│
├── Content
├── StructuredContent
├── Usage
├── FinishReason
├── ToolCalls
├── Model
└── ProviderMetadata
```

---

# 21. Usage Normalization

Different providers may expose different usage metrics.

The Platform should normalize them into common dimensions.

Example:

```text
InputTokens
OutputTokens
TotalTokens
AudioSeconds
ImageUnits
RequestCount
```

Usage & Metering can then consume normalized usage events.

---

# 22. Provider Metadata

Provider-specific metadata may be retained separately.

Example:

```text
ProviderMetadata
│
├── ProviderRequestId
├── ProviderModelId
└── ProviderRegion
```

Provider metadata should not become part of the business Skill contract.

---

# 23. Model Router Decision

The router should evaluate:

```text
1. Required capability
2. Model quality
3. Context compatibility
4. Availability
5. Workspace policy
6. Cost policy
7. Latency requirement
8. Provider health
```

The exact priority may vary by operation.

---

# 24. Example: GenerateQuestions

The Skill declares:

```text
StructuredOutput = Required
Quality = Balanced
Context = Medium
Latency = Normal
```

The router may select:

```text
Logical Model:
BalancedStructuredGeneration
```

The selected provider/model is an infrastructure decision.

---

# 25. Example: ExplainAnswer

The Skill may declare:

```text
Quality = Balanced
Latency = HighPriority
Context = Small
Streaming = Preferred
```

The router can favor a fast model.

---

# 26. Example: GenerateLesson

The Skill may declare:

```text
Quality = High
StructuredOutput = Required
Context = Large
Reasoning = High
```

The router can select a stronger model.

---

# 27. Example: TranscribeVideo

The Skill declares:

```text
Capability = SpeechToText
```

The router selects a compatible speech model.

This demonstrates why Skills should request capabilities rather than provider names.

---

# 28. Model Fallback

The Platform should support controlled fallback.

```text
Primary Model
      ↓
Unavailable
      ↓
Fallback Model
```

Fallback should only occur if the fallback satisfies the Skill's minimum requirements.

---

# 29. Fallback Hierarchy

Example:

```text
Primary:
HighQualityModel

Fallback:
BalancedModel

Emergency:
BasicModel
```

The Skill may specify:

```text
MinimumQuality = Balanced
```

If no acceptable model exists, execution should fail rather than silently produce an unacceptable result.

---

# 30. Provider Failure

Provider failures should be normalized.

Examples:

```text
PROVIDER_UNAVAILABLE
PROVIDER_TIMEOUT
PROVIDER_RATE_LIMITED
PROVIDER_AUTHENTICATION_FAILED
PROVIDER_INVALID_REQUEST
PROVIDER_CONTENT_REJECTED
PROVIDER_OVERLOADED
```

The Orchestrator decides whether retry or fallback is appropriate.

---

# 31. Retry Policy

Not all failures should be retried.

### Retryable

```text
Timeout
Temporary Unavailability
Transient Network Error
Rate Limit
```

### Non-Retryable

```text
Invalid Request
Unauthorized
Invalid Output Contract
Policy Rejection
Unsupported Capability
```

---

# 32. Provider Health

The Platform should monitor provider health.

Metrics:

```text
Availability
Latency
Error Rate
Timeout Rate
Rate Limit Rate
Output Validation Failure
```

The Model Router can use health information when selecting providers.

---

# 33. Provider Circuit Breaker

If a provider becomes unstable:

```text
Healthy
   ↓
Degraded
   ↓
Unavailable
```

The router may temporarily stop selecting the provider.

This prevents cascading failures.

---

# 34. Provider Quotas

Providers may impose quotas.

The Platform should monitor:

```text
Requests
Tokens
Audio
Rate Limits
Concurrency
```

Provider quota management is infrastructure responsibility.

Customer usage limits remain the responsibility of Usage & Metering and Entitlement.

---

# 35. Customer Usage vs Provider Usage

These are separate dimensions.

```text
Customer:
AI Requests = 100
```

does not necessarily mean:

```text
Provider:
API Requests = 100
```

because one Skill may involve multiple model calls.

---

# 36. Composite Skill and Provider Usage

Example:

```text
GenerateLessonFromVideo
```

may execute:

```text
Transcription
+
Topic Extraction
+
Lesson Generation
+
Question Generation
```

Provider usage may therefore be:

```text
4 AI executions
```

while the customer may see:

```text
1 AI Lesson Generation
```

depending on the commercial product definition.

Both dimensions should remain available.

---

# 37. Model Routing and Commercial Policy

The Product Configuration Engine may define:

```text
Allowed AI Quality Tier
```

for a product.

Example:

```text
Basic Product
    → Balanced

Premium Product
    → HighQuality
```

The customer-facing commercial rule should remain in Product Configuration / Entitlement.

The Model Router only consumes the resulting policy.

---

# 38. Tenant Model Policy

A Workspace may have configuration such as:

```text
AllowedProviders
AllowedModels
PreferredQuality
DataResidencyPolicy
```

These policies must be applied before model selection.

---

# 39. Data Residency

Some Workspaces may require specific data residency policies.

Therefore model routing may consider:

```text
Workspace Region
Provider Region
Data Residency Requirement
```

A model that violates the Workspace policy must not be selected.

---

# 40. Privacy Policy

Some AI operations may have stricter privacy requirements.

The router may receive:

```text
PrivacyRequirement
```

Example:

```text
NoExternalTraining
RestrictedDataProcessing
RegionalProcessing
```

The provider adapter must satisfy the declared requirement.

---

# 41. Context Sensitivity and Provider Selection

Context classification can affect provider selection.

For example:

```text
Restricted Context
       ↓
Only Approved Providers
```

while:

```text
Public Content
       ↓
Broader Provider Pool
```

This should be policy-driven.

---

# 42. Provider Registry

The Platform should maintain a provider registry.

Conceptually:

```text
AIProviderRegistry
│
├── RegisterProvider
├── GetProvider
├── GetCapabilities
├── GetHealth
└── GetModels
```

The registry is infrastructure metadata, not business configuration.

---

# 43. Model Registry

Likewise:

```text
AIModelRegistry
│
├── RegisterModel
├── GetModel
├── GetCapabilities
├── GetCostProfile
└── GetAvailability
```

---

# 44. Model Lifecycle

Models can have:

```text
Preview
Active
Deprecated
Retiring
Retired
```

The Platform should not automatically route new operations to retired models.

---

# 45. Model Deprecation

When a model is deprecated:

```text
Model
 ↓
Replacement Recommendation
 ↓
Router Update
```

Skills should not need to change if the logical capability remains compatible.

---

# 46. Model Pinning

Some operations may require model pinning.

Examples:

```text
Regulatory workflow
Reproducibility requirement
Evaluation
Benchmarking
Migration testing
```

A Skill or system-level policy may specify:

```text
PinnedModel
```

for those cases.

Normal production operations should generally use routing.

---

# 47. Experimentation

The architecture should support controlled model experiments.

Example:

```text
Skill:
GenerateQuestions

Traffic:
90% Model A
10% Model B
```

Experiment assignment must be deterministic where necessary.

---

# 48. Experiment Safety

Experiments must not bypass:

```text
Entitlement
Context Policy
Safety Policy
Workspace Isolation
Usage Metering
```

Only model selection changes.

---

# 49. Evaluation

Model selection should be evaluated using Skill-specific quality metrics.

For example:

### GenerateQuestions

```text
Schema Validity
Correctness
Difficulty Accuracy
Duplicate Rate
```

### ExplainAnswer

```text
Correctness
Pedagogical Quality
Student Understanding
```

### Transcription

```text
Word Error Rate
Timestamp Accuracy
Language Accuracy
```

---

# 50. Model Evaluation Pipeline

```text
Skill
 ↓
Evaluation Dataset
 ↓
Candidate Models
 ↓
Evaluation
 ↓
Quality Score
 ↓
Model Registry
 ↓
Router Policy
```

---

# 51. Provider Abstraction Must Not Hide Everything

Abstraction should not eliminate useful provider capabilities.

Therefore the architecture should support:

```text
Common Capability
+
Optional Provider Extension
```

For example:

```text
Standard ToolCalling
```

may be supported by all providers.

A provider may additionally support a specialized capability.

The specialized capability should only be used by Skills that explicitly require it.

---

# 52. Provider Extension Boundary

Conceptually:

```text
IAIModelProvider
       │
       ├── Common Capabilities
       │
       └── Provider Extensions
```

Provider-specific extensions must not leak into ordinary Skills.

---

# 53. Streaming

The provider abstraction should support streaming where useful.

```text
Skill
 ↓
Orchestrator
 ↓
Model Provider
 ↓
Stream
 ↓
UI
```

Typical use:

```text
Student Assistant
Tutor Assistant
ExplainLesson
```

Streaming should not change the Skill's logical result contract.

---

# 54. Structured Output + Streaming

The Platform should distinguish:

```text
Streaming Text
```

from:

```text
Structured Final Result
```

For structured Skills:

```text
Model Stream
 ↓
Accumulation
 ↓
Final Parse
 ↓
Schema Validation
```

The UI may display progress while the final structured result is validated.

---

# 55. Embeddings

Embeddings should be treated as a separate model capability.

Potential use cases:

```text
Learning Content Search
Semantic Retrieval
Duplicate Detection
Content Recommendations
```

The Embedding Provider should remain behind the provider abstraction.

---

# 56. Embedding Model Independence

Learning Retrieval should request:

```text
Embedding Capability
```

rather than:

```text
Provider X Embedding Model
```

This allows future migration.

---

# 57. Speech-to-Text

Speech-to-text should similarly be modeled as a capability.

```text
Transcription Skill
 ↓
SpeechToText Requirement
 ↓
Model Router
 ↓
Speech Provider
```

---

# 58. Multimodal Models

Some Skills may require:

```text
Text
+
Image
+
Audio
+
Video
```

The Model Router must consider input modality requirements.

Example:

```text
AnalyzeLearningImage
```

requires:

```text
Vision = Required
```

---

# 59. AI Gateway

The Platform may introduce an internal AI Gateway as the infrastructure boundary.

```text
AI Orchestrator
      ↓
AI Gateway
      ↓
Model Router
      ↓
Provider Adapter
```

The Gateway centralizes:

```text
Authentication
Routing
Observability
Retries
Rate Limiting
Provider Policies
```

---

# 60. AI Gateway vs AI Orchestrator

They have different responsibilities.

### Orchestrator

Controls the AI operation workflow.

### Gateway

Controls access to model infrastructure.

Therefore:

```text
Orchestrator:
"What should happen?"

Gateway:
"How do we execute this model request?"
```

---

# 61. Recommended Architecture

```text
AI Skill
   ↓
AI Orchestrator
   ↓
Context
   ↓
Usage / Entitlement
   ↓
AI Gateway
   ↓
Model Router
   ↓
Provider Adapter
   ↓
Provider
```

---

# 62. Direct Provider Access Is Forbidden

Application layers should not directly call:

```text
Provider SDK
Provider HTTP API
Provider Client
```

Only the AI infrastructure boundary should do so.

---

# 63. API Key Security

Provider credentials should be:

```text
Secret
Encrypted
Rotatable
Auditable
Environment-Specific
```

The Platform should support credential rotation without redeploying Skills.

---

# 64. Development vs Production

Provider configuration should differ by environment.

```text
Development
 ↓
Development Provider / Key

Testing
 ↓
Controlled Provider

Production
 ↓
Production Provider Configuration
```

Skills remain unchanged.

---

# 65. Testing Without External AI

Skills should be testable without invoking a real provider.

The architecture should support:

```text
FakeAIModelProvider
MockAIModelProvider
RecordedAIModelProvider
```

This enables deterministic application tests.

---

# 66. Contract Testing

Provider adapters should be contract-tested against the normalized model interface.

Tests should verify:

```text
Request Mapping
Response Mapping
Usage Mapping
Error Mapping
Tool Mapping
Structured Output
Streaming
```

---

# 67. AI Evaluation vs Integration Testing

These are different.

### Integration Test

Does the provider adapter work?

### AI Evaluation

Does the model produce a good answer?

Both are required.

---

# 68. Observability

Every model execution should produce traceable metadata:

```text
OperationId
SkillId
SkillVersion
ProviderId
ModelId
ContextHash
Latency
Usage
Fallback
Outcome
```

Sensitive prompt content should not automatically be logged.

---

# 69. Distributed Tracing

The AI operation should be traceable across:

```text
API
 ↓
AI Orchestrator
 ↓
Context Providers
 ↓
Usage
 ↓
AI Gateway
 ↓
Provider
```

This is important for debugging latency and failures.

---

# 70. Provider Cost Monitoring

The Platform should monitor infrastructure cost separately from customer billing.

Example:

```text
AI Infrastructure
│
├── Provider Cost
├── Model Cost
├── Skill Cost
├── Workspace Consumption
└── Customer Revenue
```

This enables margin analysis later.

---

# 71. AI Unit Economics

A future commercial analytics layer can calculate:

```text
Customer Revenue
-
AI Infrastructure Cost
=
AI Contribution Margin
```

This should not be embedded inside the AI Skill itself.

---

# 72. Recommended Initial Provider Strategy

For the initial implementation:

```text
One Primary Provider
+
One Provider Abstraction
+
One Model Router
+
Provider Adapter
```

Do not build a complicated multi-provider platform before the first real AI workflows are validated.

The abstraction should exist from day one, but the number of providers can remain small.

---

# 73. Recommended Initial Model Strategy

Start with a small logical model set:

```text
Fast
Balanced
HighQuality
SpeechToText
Embedding
```

Map these logical profiles to concrete provider models through configuration.

---

# 74. Do Not Expose Provider Names to End Users

The user should normally see:

```text
AI Assistant
Fast
High Quality
```

rather than:

```text
Provider X Model Y
```

unless the product intentionally exposes model selection.

---

# 75. Administrative Model Configuration

Administrators may configure:

```text
Default Model
Fallback Model
Allowed Providers
Model Quality
Cost Limits
Regional Restrictions
```

This should be an administrative/infrastructure concern.

---

# 76. Workspace Model Configuration

If the business eventually supports workspace-level AI configuration, it may include:

```text
AI Enabled
Allowed Skill Set
Preferred Quality
Allowed Providers
Data Processing Policy
```

But Workspace configuration must remain constrained by platform-level policy.

---

# 77. Failure Isolation

A provider failure should not bring down the Learning Workspace.

For example:

```text
AI Provider Down
        ↓
AI Skill Failed
        ↓
Learning Workspace Still Available
```

AI should be an important capability, but not a single point of failure for core learning operations.

---

# 78. Degraded Experience

If AI is unavailable:

```text
AI button
    ↓
Unavailable
```

The underlying lesson, course, assessment, and student experience should continue functioning.

---

# 79. Provider Migration

The architecture should support:

```text
Provider A
   ↓
Provider B
```

without changing:

```text
Lesson
Question
Student
Tutor
Subscription
Billing
```

Only infrastructure configuration and potentially model evaluation should change.

---

# 80. Provider Migration Strategy

Recommended process:

```text
1. Register new provider
2. Register models
3. Run evaluation
4. Run shadow traffic
5. Compare quality
6. Compare cost
7. Configure fallback
8. Gradually migrate
9. Monitor
10. Retire old provider
```

---

# 81. Shadow Evaluation

Before migration:

```text
Production Request
       │
       ├── Primary Provider
       │
       └── Candidate Provider
```

The candidate result is evaluated without being shown to the user.

This allows safe comparison.

---

# 82. Architectural Invariants

### MODEL-001

AI Skills must not directly depend on provider SDKs.

### MODEL-002

Provider-specific implementation belongs behind a Provider Adapter.

### MODEL-003

Model selection belongs to the Model Router.

### MODEL-004

Skills declare capabilities and requirements, not concrete provider implementations.

### MODEL-005

Provider credentials must never be embedded in Skills.

### MODEL-006

Provider usage must be normalized before entering Usage & Metering.

### MODEL-007

Customer pricing must remain separate from provider cost.

### MODEL-008

Provider failure must not compromise core Learning Workspace functionality.

### MODEL-009

Fallback models must satisfy the Skill's minimum requirements.

### MODEL-010

Model changes must not require domain-model changes.

### MODEL-011

Provider-specific features must not leak into standard Skill contracts.

### MODEL-012

Workspace and privacy policies must participate in model selection.

### MODEL-013

Provider/model execution must be observable.

### MODEL-014

AI model infrastructure must be replaceable without rewriting AI Skills.

### MODEL-015

The initial architecture may use one provider while preserving provider independence.

---

# 83. Final Architecture

The complete AI execution architecture is now:

```text
                         ┌──────────────────────┐
                         │   User / System      │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │    AI Assistant      │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │      AI Skill        │
                         └──────────┬───────────┘
                                    │
                  ┌─────────────────┼─────────────────┐
                  │                 │                 │
                  ▼                 ▼                 ▼
             Entitlement        Context            Usage
                Policy           Policy             Policy
                  │                 │                 │
                  └─────────────────┼─────────────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │   AI Orchestrator    │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │      AI Gateway      │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │     Model Router     │
                         └──────────┬───────────┘
                                    │
                    ┌───────────────┼────────────────┐
                    │               │                │
                    ▼               ▼                ▼
             Provider A       Provider B       Provider C
             Adapter          Adapter          Adapter
                    │               │                │
                    ▼               ▼                ▼
                 Model            Model            Model
```

---

# 84. Relationship With the Other AI Documents

The AI architecture now has clear boundaries:

```text
AIAssistantArchitecture
        │
        ▼
AIOrchestrationArchitecture
        │
        ├───────────────┐
        ▼               ▼
AIContextArchitecture  AISkillArchitecture
        │               │
        └───────┬───────┘
                ▼
       AIModelProviderArchitecture
                │
                ▼
          Model Router
                │
                ▼
          AI Providers
```

Commercial boundaries remain outside:

```text
Licensing & Entitlement
        │
        ▼
Can the Skill execute?

Usage & Metering
        │
        ▼
What was consumed?

Billing
        │
        ▼
How is the customer charged?
```

---

# 85. Final Principle

The Platform should never become:

```text
"an OpenAI application"
```

It should become:

```text
"an AI-enabled learning platform"
```

The difference is architectural.

The Platform owns:

```text
Skills
Context
Orchestration
Entitlement
Usage
Learning Experience
```

while AI providers supply:

```text
Model Execution
```

This allows the Platform to start simple while preserving the ability to evolve its AI infrastructure over time.

---

# 86. Status

**Draft — Version 1.0**

The next important document should be:

**`AIUsageAndCostArchitecture.md`**

This is the document that connects the AI architecture we have now built to the commercial architecture we already defined. It should establish exactly how **AI requests, tokens, transcription minutes, generated content, model cost, customer usage, AI credits, limits, overages, and subscriptions** fit together—without mixing provider cost with customer billing.
