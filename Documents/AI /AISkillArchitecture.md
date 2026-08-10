# AISkillArchitecture.md

**Version:** 1.0
**Status:** Draft
**Bounded Context:** AI Assistant
**Architectural Layer:** AI Capability / Skill
**Depends On:**

* `AIAssistantArchitecture.md`
* `AIOrchestrationArchitecture.md`
* `AIContextArchitecture.md`
* Learning Workspace Architecture
* Learning Delivery Architecture
* Product Configuration Architecture
* Licensing & Entitlement Architecture
* Billing Architecture
* Usage & Metering Architecture

---

# 1. Purpose

This document defines the architecture for **AI Skills** within the Platform.

An AI Skill represents a specific business capability that uses AI.

Examples:

```text
GenerateLesson
GenerateQuestions
ExplainLesson
ExplainStudentAnswer
TranscribeVideo
SummarizeContent
GenerateActivities
SuggestLearningContent
TutorAssistant
StudentLearningAssistant
```

The purpose of this architecture is to prevent the Platform from treating AI as a single generic chatbot.

Instead:

> **AI is exposed through explicit business capabilities called Skills.**

---

# 2. Why AI Skills Are Required

A generic implementation might look like:

```text
User
 ↓
Chat
 ↓
LLM
```

This is insufficient for the Platform.

The Platform needs to know:

```text
What is the user trying to accomplish?
What data can the AI access?
Which model should execute it?
Is the capability entitled?
How is usage measured?
What output is expected?
What safety rules apply?
Can the result be persisted?
```

AI Skills provide this structure.

---

# 3. AI Skill Definition

An AI Skill is a defined Platform capability that describes:

```text
AI Skill
│
├── Identity
├── Business Purpose
├── Actor Eligibility
├── Input Contract
├── Output Contract
├── Context Requirements
├── Model Policy
├── Tool Requirements
├── Safety Policy
├── Usage Policy
├── Entitlement Requirement
└── Persistence Policy
```

---

# 4. Skill Is Not a Model

A Skill represents a business capability.

A Model represents an execution technology.

Therefore:

```text
GenerateQuestions
       ↓
Model Router
       ↓
Model A
```

or:

```text
GenerateQuestions
       ↓
Model Router
       ↓
Model B
```

The Skill should not be permanently coupled to a specific model.

---

# 5. Skill vs AI Assistant

The **AI Assistant** is the platform-level AI experience.

The **AI Skill** is a specific capability used by that experience.

For example:

```text
AI Assistant
│
├── GenerateLesson
├── GenerateQuestions
├── ExplainLesson
├── ExplainAnswer
├── Summarize
└── TutorAssistant
```

The assistant may invoke one or more Skills during an interaction.

---

# 6. Skill Categories

The initial Skill taxonomy should be:

```text
AI Skills
│
├── Content Creation
│
├── Content Transformation
│
├── Assessment
│
├── Learning Assistance
│
├── Tutor Assistance
│
├── Student Assistance
│
├── Media Intelligence
│
└── Platform Intelligence
```

---

# 7. Content Creation Skills

Examples:

```text
GenerateLesson
GenerateLessonOutline
GenerateLearningObjectives
GenerateExamples
GenerateActivities
GenerateExercises
GenerateExplanations
```

These primarily support tutors and content creators.

---

# 8. Content Transformation Skills

Examples:

```text
SummarizeContent
RewriteContent
SimplifyContent
TranslateContent
ChangeReadingLevel
ExtractKeyConcepts
GenerateStudyNotes
```

These transform existing learning content.

---

# 9. Assessment Skills

Examples:

```text
GenerateQuestions
GenerateMCQ
GenerateTrueFalse
GenerateFillBlank
GenerateShortAnswer
GenerateQuestionDistractors
EvaluateAnswer
ExplainIncorrectAnswer
GenerateAssessment
```

These support assessment creation and learning feedback.

---

# 10. Learning Assistance Skills

Examples:

```text
ExplainLesson
ExplainConcept
ProvideHint
GeneratePractice
RecommendNextActivity
ReviewStudentAnswer
```

These are primarily student-facing.

---

# 11. Tutor Assistance Skills

Examples:

```text
TutorAssistant
SuggestLessonImprovement
SuggestActivities
AnalyzeStudentProgress
SuggestRemediation
GenerateParentSummary
```

These support tutor workflows.

---

# 12. Student Assistance Skills

Examples:

```text
StudentLearningAssistant
ExplainAnswer
ProvideHint
GeneratePractice
SummarizeLesson
CreateStudyPlan
```

These operate within the student's authorized learning context.

---

# 13. Media Intelligence Skills

The Learning Delivery architecture already establishes AI-assisted media processing.

Relevant Skills include:

```text
TranscribeVideo
AnalyzeVideo
ExtractTopicsFromVideo
GenerateLessonFromVideo
GenerateQuestionsFromVideo
GenerateTimestamps
```

A typical workflow is:

```text
Video
 ↓
TranscribeVideo
 ↓
Transcript
 ↓
GenerateLesson
 ↓
GenerateQuestions
```

## Timeline Event Output Contract

`GenerateQuestionsFromVideo` and `GenerateLessonFromVideo` do not return unstructured text — their Output Contract (§20) is a set of **Timeline Events**, each anchored to a video timestamp:

```text
Timeline Event Types:
    Question Event
    Reflection Event
    Explanation Event
    Resource Event
    Discussion Event
    Assessment Event
```

A Question Event carries a fixed structure:

```text
Question Event {
    VideoTimestamp
    QuestionType        (Multiple Choice, True/False, Complete the Sentence, Open Answer)
    QuestionText
    AnswerOptions
    CorrectAnswer
    Explanation
    DifficultyLevel
    LearningObjective
}
```

Placement is not random. The Skill should follow the same instructional heuristics regardless of provider: after an explanation (check understanding), before an example (check prediction), after an example (check application).

## Ownership Boundary

This Skill only ever produces a **suggested** timeline — consistent with §42 (Suggestion vs. Action) and §43 (Human Approval), a tutor reviews each event as Accept / Edit / Remove before it becomes part of a Lesson. Ownership follows §47 (Generated Content Ownership) and the Platform Aggregate Catalogue's existing rule that **Interactive Learning Event** is owned by **Lesson Revision**, not by this Skill or by any AI aggregate:

```text
AI Skill produces:        Suggested Timeline Events (draft, unaccepted)
Lesson Revision owns:     Accepted Timeline Events, once a tutor confirms them
                           (Platform Aggregate Catalogue §6, "Interactive Learning
                           Event | Lesson Revision")
```

---

# 14. Platform Intelligence

Platform-level Skills may include:

```text
AnalyzeUsage
ExplainEntitlement
SuggestProductConfiguration
SupportAssistant
```

These require stricter authorization because they may interact with commercial or operational context.

---

# 15. Skill Identity

Every Skill must have a stable identifier.

Example:

```text
SkillId:
learning.generate_lesson
```

Other examples:

```text
learning.generate_questions
learning.explain_lesson
learning.explain_answer
media.transcribe_video
learning.summarize_content
```

The identifier should remain stable even if implementation changes.

---

# 16. Skill Metadata

A Skill should have metadata:

```text
AISkillDefinition
│
├── SkillId
├── Name
├── Description
├── Category
├── Version
├── Status
├── SupportedActors
├── InputSchema
├── OutputSchema
├── ContextRequirements
├── ModelPolicy
├── UsagePolicy
└── EntitlementPolicy
```

---

# 17. Skill Lifecycle

Skills have a lifecycle:

```text
Draft
 ↓
Active
 ↓
Deprecated
 ↓
Retired
```

A Skill should not be immediately removed from the Platform when a newer implementation is introduced.

---

# 18. Skill Versioning

A Skill may evolve independently from the underlying AI model.

Example:

```text
GenerateQuestions v1
GenerateQuestions v2
```

The Skill version controls the business contract.

The model can change without changing the Skill contract.

---

# 19. Input Contract

Every Skill must define its input.

Example:

```text
GenerateQuestionsInput
│
├── LessonId
├── QuestionCount
├── Difficulty
├── QuestionTypes
└── Language
```

The Skill should reject invalid input before invoking the model.

---

# 20. Output Contract

AI output should be structured whenever the result is consumed by the application.

For example:

```text
GenerateQuestionsOutput
│
└── Questions
    ├── Question
    ├── Type
    ├── Options
    ├── CorrectAnswer
    ├── Explanation
    └── Difficulty
```

The application should not have to parse arbitrary prose.

---

# 21. Structured Output

Where possible, Skills should request structured output.

For example:

```text
{
  "questions": [
    {
      "type": "multiple_choice",
      "question": "...",
      "options": [],
      "correctAnswer": "...",
      "explanation": "..."
    }
  ]
}
```

The AI response is then validated against the Skill's output schema.

---

# 22. Output Validation

The pipeline should be:

```text
Model
 ↓
Raw Response
 ↓
Structured Parser
 ↓
Schema Validation
 ↓
Business Validation
 ↓
Skill Result
```

The result must not be persisted directly after receiving raw model output.

---

# 23. Business Validation

Schema validation checks structure.

Business validation checks meaning and domain rules.

Example:

```text
QuestionCount = 5
```

is structurally valid.

But:

```text
CorrectAnswer not contained in Options
```

is a business validation failure.

---

# 24. Skill Execution Pipeline

The standard execution pipeline is:

```text
Request
 ↓
Resolve Skill
 ↓
Authorize Actor
 ↓
Check Entitlement
 ↓
Validate Input
 ↓
Resolve Context
 ↓
Estimate Usage
 ↓
Reserve Usage
 ↓
Select Model
 ↓
Execute AI
 ↓
Validate Output
 ↓
Record Usage
 ↓
Persist Result if required
 ↓
Return Result
```

This sequence connects the AI architecture with the Commercial architecture.

---

# 25. Entitlement

A Skill is not automatically available to every user.

Example:

```text
Tutor
 ↓
GenerateLesson
 ↓
Entitlement Check
```

The Licensing & Entitlement domain remains authoritative.

AI does not decide whether the user has purchased the capability.

---

# 26. Usage

Execution may consume usage.

Examples:

```text
AI Requests
AI Tokens
Video Minutes
Transcription Minutes
Generated Questions
AI Credits
```

Usage & Metering remains the authoritative source for consumption.

---

# 27. Skill Usage Definition

Each Skill should declare its usage dimensions.

Example:

```text
GenerateLesson
    AIRequest = 1
    TokenUsage = measured
```

Another:

```text
TranscribeVideo
    AIRequest = 1
    AudioMinutes = measured
```

---

# 28. Skill Cost Profile

The Skill may have a cost profile.

Example:

```text
GenerateQuestions
    BaseUnit: AI Request
    VariableUnit: Tokens
```

or:

```text
TranscribeVideo
    BaseUnit: Audio Minute
```

The Skill does not calculate billing.

It declares usage characteristics.

---

# 29. Skill Pricing Separation

Pricing remains outside the Skill.

```text
Skill
 ↓
Usage
 ↓
Commercial Meter
 ↓
Pricing
 ↓
Billing
```

Therefore changing the price of a Skill does not require changing the Skill implementation.

---

# 30. Model Policy

A Skill declares its model requirements.

Example:

```text
GenerateLesson
    Quality: High
    StructuredOutput: Required
    Context: Large
```

The Model Router decides the actual model.

---

# 31. Model Selection

Conceptually:

```text
Skill Requirements
+
Context Characteristics
+
Tenant Policy
+
Cost Policy
+
Availability
        ↓
Model Router
        ↓
Selected Model
```

---

# 32. Model Fallback

A Skill should support fallback models where appropriate.

```text
Primary Model
     ↓
Unavailable
     ↓
Fallback Model
```

However, fallback must preserve the Skill's minimum quality and output requirements.

---

# 33. Skill-Specific Model Policy

Different Skills may have different requirements.

Example:

```text
TranscribeVideo
→ Speech-to-text model

GenerateLesson
→ General reasoning model

GenerateQuestions
→ Structured generation model

ExplainAnswer
→ Fast conversational model
```

---

# 34. Context Requirements

Every Skill declares the context it needs.

Example:

```text
GenerateQuestions
Requires:
    Workspace
    Lesson
    LearningObjectives

Optional:
    StudentLevel
    PreviousQuestions
```

This directly integrates with `AIContextArchitecture.md`.

---

# 35. Skill Context Contract

Conceptually:

```text
AISkillContextRequirement
│
├── ContextType
├── Required
├── Scope
├── MaximumSize
└── SensitivityLevel
```

The Context Builder uses this contract to construct the AI context.

---

# 36. Skill Tools

Some Skills may require tools.

Example:

```text
TutorAssistant
    ├── SearchLearningContent
    ├── GetStudentProgress
    └── GetLessonDetails
```

The Skill defines which tools it may use.

It does not receive unrestricted tool access.

---

# 37. Tool Authorization

Tool invocation follows:

```text
Skill
 ↓
Tool Policy
 ↓
Authorization
 ↓
Tool
 ↓
Filtered Result
```

A model cannot arbitrarily invoke any Platform API.

---

# 38. Skill Safety Policy

Each Skill should define safety requirements.

Example:

```text
ExplainLesson
    → Educational content safety

StudentAssistant
    → Student protection

TutorAssistant
    → Privacy protection

ContentGeneration
    → Content safety
```

The platform-wide policy behind these requirements — what each classification means, how it is enforced, and how it is audited — is defined in `AISafetyAndGovernanceArchitecture.md`. A Skill's safety declaration here is a label; that document is the enforceable policy.

---

# 39. Skill Safety Boundary

Safety must exist at multiple layers:

```text
Input
 ↓
Context
 ↓
Prompt
 ↓
Model
 ↓
Output
 ↓
Domain Validation
```

No single safety mechanism should be assumed sufficient.

---

# 40. Student-Facing Skill Restrictions

Student-facing Skills should explicitly declare:

```text
Allowed Context
Allowed Tools
Allowed Output Types
Restricted Actions
```

Example:

```text
StudentLearningAssistant
```

may:

```text
Explain
Hint
Practice
Summarize
```

but may not:

```text
Modify Grades
Modify Enrollment
Access Billing
Modify Tutor Content
```

unless another explicitly authorized capability exists.

---

# 41. Tutor-Facing Skill Restrictions

Tutor-facing Skills may:

```text
Generate Draft Lesson
Generate Questions
Suggest Activities
Analyze Learning Data
```

but should not automatically:

```text
Publish Content
Change Student Grades
Modify Billing
```

AI suggestion and domain mutation remain separate concerns.

---

# 42. AI Suggestion vs AI Action

This is a critical distinction.

### Suggestion

```text
AI
 ↓
Suggestion
 ↓
Tutor
 ↓
Decision
```

### Action

```text
AI
 ↓
Authorized Command
 ↓
Domain
```

The Platform should prefer suggestion mode initially.

---

# 43. Human Approval

For consequential actions:

```text
AI Recommendation
       ↓
Human Review
       ↓
Confirm
       ↓
Domain Command
```

Examples:

```text
Publish Lesson
Change Student Grade
Send Parent Message
```

should normally require explicit confirmation unless a separate trusted automation capability is established.

---

# 44. Skill Result Types

A Skill may return:

```text
GeneratedContent
Recommendation
Explanation
Classification
Extraction
Transformation
ActionProposal
```

These should be represented explicitly.

---

# 45. Skill Result Example

```text
AIResult<T>
│
├── Result
├── SkillId
├── SkillVersion
├── OperationId
├── ModelMetadata
├── UsageMetadata
└── ValidationStatus
```

---

# 46. Persistence Policy

Each Skill declares whether its result should be persisted.

Examples:

```text
GenerateLesson
→ Usually persist as draft

ExplainAnswer
→ Usually transient

TranscribeVideo
→ Persist transcript

TutorAssistant
→ Conversation-dependent
```

---

# 47. Generated Content Ownership

AI-generated content belongs to the domain that owns the resulting artifact.

For example:

```text
GenerateLesson
 ↓
Learning Domain
 ↓
Lesson Draft
```

AI does not own the Lesson.

Likewise:

```text
GenerateQuestions
 ↓
Assessment / Learning Domain
 ↓
Question Draft
```

---

# 48. Draft Generation

AI-generated learning content should normally enter a draft state.

Example:

```text
GenerateLesson
      ↓
Lesson Draft
      ↓
Tutor Review
      ↓
Publish
```

AI generation should not silently publish educational content.

---

# 49. Skill Idempotency

Long-running Skills should support idempotency where appropriate.

Example:

```text
OperationId:
AI-OP-123
```

If the request is retried, the Platform should avoid accidental duplicate domain artifacts.

---

# 50. Retry Policy

Retries should distinguish:

```text
Transient Failure
Permanent Failure
Validation Failure
Authorization Failure
Usage Failure
```

Only appropriate failures should be retried.

---

# 51. Asynchronous Skills

Large operations should support asynchronous execution.

Examples:

```text
TranscribeVideo
GenerateLargeAssessment
AnalyzeCourse
GenerateLessonFromVideo
```

Workflow:

```text
Request
 ↓
AI Operation
 ↓
Queued
 ↓
Processing
 ↓
Completed
```

---

# 52. Synchronous Skills

Short interactions may execute synchronously.

Examples:

```text
ExplainLesson
ProvideHint
ExplainAnswer
SummarizeShortText
```

---

# 53. Skill Operation

Every execution should have an Operation ID.

```text
AI Skill
    ↓
AI Operation
    ↓
Execution
```

This allows the Platform to trace:

```text
Request
→ Skill
→ Context
→ Model
→ Usage
→ Result
```

---

# 54. Skill Observability

Metrics should include:

```text
Execution Count
Success Rate
Failure Rate
Latency
Token Usage
Context Size
Model
Fallback Rate
Validation Failure Rate
```

---

# 55. Skill Error Model

Standard errors should include:

```text
SKILL_NOT_FOUND
SKILL_DISABLED
SKILL_NOT_ENTITLED
INVALID_INPUT
CONTEXT_UNAVAILABLE
CONTEXT_NOT_AUTHORIZED
MODEL_UNAVAILABLE
OUTPUT_VALIDATION_FAILED
USAGE_LIMIT_REACHED
SAFETY_POLICY_REJECTED
```

---

# 56. Skill Availability

A Skill may be:

```text
Globally Enabled
Workspace Enabled
Plan Enabled
Actor Enabled
Feature-Flagged
Disabled
```

The final availability decision combines these policies.

---

# 57. Skill Configuration

Workspace-specific configuration may include:

```text
Default Language
Preferred AI Behavior
Allowed Skills
Model Preferences
Usage Limits
Safety Configuration
```

However, Workspace configuration must never bypass platform safety or entitlement rules.

---

# 58. Product Configuration Integration

The Product Configuration Engine can define which AI capabilities are included in a product.

Example:

```text
Tutor Product
│
├── Lesson Creation
├── AI Lesson Generation
├── AI Question Generation
└── AI Tutor Assistant
```

The AI Skill remains the technical capability.

Product Configuration determines how that capability is packaged commercially.

---

# 59. Licensing Integration

Example:

```text
AI Skill
    ↓
Capability Identifier
    ↓
Entitlement Service
    ↓
Allowed / Denied
```

This means the Skill does not need to understand subscription plans directly.

---

# 60. Billing Integration

Billing should not be called directly by the Skill.

Instead:

```text
Skill Execution
 ↓
Usage Event
 ↓
Usage & Metering
 ↓
Commercial/Billing
```

This maintains bounded-context separation.

---

# 61. AI Skill Registry

The Platform should maintain a registry of available Skills.

Conceptually:

```text
AISkillRegistry
│
├── Register
├── Resolve
├── GetMetadata
├── GetVersion
└── CheckAvailability
```

The registry should not contain business-domain data.

---

# 62. Skill Discovery

The UI may use the Skill Registry to discover available capabilities.

Example:

```text
Tutor opens Lesson Editor
       ↓
Available AI Skills
       ↓
Generate Lesson
Generate Questions
Improve Content
Summarize
```

Only Skills that are both:

```text
Available
+
Entitled
```

should normally be presented as usable.

---

# 63. UI Should Not Hard-Code Commercial Rules

The frontend should not implement:

```text
if subscription == Premium
```

Instead:

```text
Frontend
 ↓
Capability / Entitlement API
 ↓
Available AI Skill
```

This keeps commercial rules centralized.

---

# 64. AI Skill Invocation

A conceptual request:

```text
POST /ai/skills/learning.generate-questions
```

should resolve:

```text
Skill
Actor
Workspace
Context
Entitlement
Usage
Model
```

before execution.

The exact API shape belongs to the AI Application/API architecture and should not be tightly coupled to the internal Skill implementation.

---

# 65. Skill Execution Boundary

The recommended architecture is:

```text
                  AI API
                    │
                    ▼
             AI Application
                    │
                    ▼
             Skill Dispatcher
                    │
          ┌─────────┼─────────┐
          ▼         ▼         ▼
      Lesson      Question   Student
       Skill        Skill     Skill
          │         │         │
          └─────────┼─────────┘
                    ▼
             AI Orchestrator
                    │
          ┌─────────┼─────────┐
          ▼         ▼         ▼
       Context    Usage    Model Router
```

---

# 66. Skill Implementation

A Skill implementation should primarily coordinate business-specific AI behavior.

Conceptually:

```text
AISkill
│
├── ValidateInput()
├── DefineContext()
├── DefineModelPolicy()
├── DefineToolPolicy()
├── Execute()
└── ValidateOutput()
```

It should not directly manipulate billing or subscription state.

---

# 67. Example: Generate Questions

```text
GenerateQuestions
```

Execution:

```text
Input
 ↓
Validate
 ↓
Entitlement
 ↓
Context:
    Lesson
    Objectives
 ↓
Usage Reservation
 ↓
Model Selection
 ↓
Prompt Construction
 ↓
Model
 ↓
Structured Output
 ↓
Question Validation
 ↓
Result
```

---

# 68. Example: Explain Student Answer

```text
ExplainStudentAnswer
```

Context:

```text
Lesson
Question
ExpectedAnswer
StudentAnswer
StudentLearningLevel
```

Execution:

```text
Context
 ↓
Skill Prompt
 ↓
Model
 ↓
Explanation
 ↓
Safety / Output Validation
 ↓
Student
```

---

# 69. Example: Generate Lesson From Video

```text
GenerateLessonFromVideo
```

Pipeline:

```text
Video
 ↓
TranscribeVideo
 ↓
Transcript
 ↓
ExtractLearningConcepts
 ↓
GenerateLesson
 ↓
GenerateQuestions
 ↓
Lesson Draft
```

This demonstrates that a higher-level Skill may orchestrate other AI capabilities.

---

# 70. Composite Skills

Some Skills may be composite.

Example:

```text
GenerateLessonFromVideo
```

may internally use:

```text
TranscribeVideo
ExtractTopics
GenerateLesson
GenerateQuestions
```

These should remain independently observable where useful.

---

# 71. Composite Skill Usage

The Platform must decide whether usage is measured as:

```text
One Composite Operation
```

or:

```text
Multiple Underlying AI Operations
```

For accurate metering, the recommended approach is:

```text
Composite Operation
+
Child AI Operations
```

This allows both product-level reporting and technical cost analysis.

---

# 72. Skill Dependency Graph

Composite Skills may have dependencies:

```text
GenerateLessonFromVideo
        │
        ├── TranscribeVideo
        │
        ├── ExtractTopics
        │
        └── GenerateLesson
                │
                └── GenerateQuestions
```

The Orchestrator manages execution.

---

# 73. Skill Composition Rules

A Skill should only invoke another Skill if:

```text
Dependency Is Declared
+
Caller Is Authorized
+
Required Entitlement Exists
+
Usage Can Be Recorded
```

This prevents hidden AI consumption.

---

# 74. Skill Marketplace Potential

Because Skills have explicit contracts, the architecture can later support:

```text
Platform AI Skills
Workspace AI Skills
Third-Party AI Skills
```

However, third-party Skills should be treated as a future extension rather than part of the initial implementation.

---

# 75. Initial Platform Skill Set

The recommended initial Skills are:

### Tutor

```text
GenerateLesson
GenerateQuestions
ImproveLesson
SummarizeContent
GenerateActivities
GenerateExamples
```

### Student

```text
ExplainLesson
ExplainAnswer
ProvideHint
GeneratePractice
SummarizeLesson
```

### Media

```text
TranscribeVideo
GenerateLessonFromVideo
GenerateQuestionsFromVideo
```

### General

```text
TutorAssistant
StudentLearningAssistant
```

---

# 76. Recommended MVP

Do not implement every Skill immediately.

The first implementation should focus on:

```text
1. GenerateLesson
2. GenerateQuestions
3. ExplainLesson
4. ExplainStudentAnswer
5. TranscribeVideo
```

These Skills align strongly with the Learning Workspace use cases already defined.

---

# 77. AI Assistant Evolution

The architecture supports progressive evolution:

```text
Phase 1
Explicit AI Buttons
       ↓
Phase 2
Context-Aware Assistant
       ↓
Phase 3
Multi-Skill Assistant
       ↓
Phase 4
Proactive AI
       ↓
Phase 5
Controlled AI Agents
```

The Platform should not jump directly to autonomous agents.

---

# 78. Skill vs Agent

A Skill is:

```text
Bounded
Predictable
Contract-Based
Authorized
Observable
```

An Agent is:

```text
Multi-Step
Goal-Oriented
Potentially Autonomous
Tool-Using
```

The Skill architecture should be established before introducing agents.

---

# 79. Future Agent Architecture

Future agents should be composed from Skills.

```text
AI Agent
   │
   ├── Skill
   ├── Skill
   ├── Skill
   └── Skill
```

This means Skills become the controlled primitives for future AI automation.

---

# 80. Architectural Invariants

### SKILL-001

Every AI capability must have a stable Skill identity.

### SKILL-002

Skills must define explicit input and output contracts.

### SKILL-003

Skills must declare context requirements.

### SKILL-004

Skills must not directly access unrestricted domain repositories.

### SKILL-005

Skills must not directly own billing or subscription logic.

### SKILL-006

Skill availability must respect entitlement.

### SKILL-007

Skill execution must produce usage information where applicable.

### SKILL-008

Structured output should be used whenever application logic consumes the result.

### SKILL-009

AI-generated domain artifacts must remain owned by their domain.

### SKILL-010

Consequential domain actions should require explicit authorization and, where appropriate, human confirmation.

### SKILL-011

Skill execution must be observable through an AI Operation.

### SKILL-012

Composite Skills must expose their underlying AI usage.

### SKILL-013

Skills must not silently bypass context policies.

### SKILL-014

Skills must be independently versionable from AI models.

### SKILL-015

Skills should be reusable by both UI-driven workflows and future AI Agents.

---

# 81. Final Architecture

The resulting AI architecture is:

```text
                         ┌───────────────────┐
                         │   User / System   │
                         └─────────┬─────────┘
                                   │
                                   ▼
                         ┌───────────────────┐
                         │    AI Assistant   │
                         └─────────┬─────────┘
                                   │
                                   ▼
                         ┌───────────────────┐
                         │    AI Skill       │
                         │     Registry      │
                         └─────────┬─────────┘
                                   │
                                   ▼
                         ┌───────────────────┐
                         │  Skill Dispatcher │
                         └─────────┬─────────┘
                                   │
                 ┌─────────────────┼─────────────────┐
                 │                 │                 │
                 ▼                 ▼                 ▼
          Entitlement          Context            Usage
             Policy             Policy            Policy
                 │                 │                 │
                 └─────────────────┼─────────────────┘
                                   │
                                   ▼
                         ┌───────────────────┐
                         │   AI Orchestrator │
                         └─────────┬─────────┘
                                   │
                         ┌─────────┴─────────┐
                         ▼                   ▼
                  ┌──────────────┐    ┌──────────────┐
                  │ Model Router │    │ Tool Policy  │
                  └──────┬───────┘    └──────┬───────┘
                         │                   │
                         └─────────┬─────────┘
                                   ▼
                            ┌─────────────┐
                            │ AI Provider │
                            └──────┬──────┘
                                   │
                                   ▼
                            Validated Result
                                   │
                 ┌─────────────────┼──────────────────┐
                 ▼                 ▼                  ▼
             Learning           Student           Conversation
              Domain             UI                  Memory
```

---

# 82. Final Principle

The Platform should not build:

```text
"an AI chatbot"
```

It should build:

```text
an AI capability platform
```

where:

```text
Assistant
    ↓
Skills
    ↓
Context
    ↓
Entitlement
    ↓
Usage
    ↓
Orchestration
    ↓
Models
```

This gives the Platform a foundation where AI can later become a powerful assistant without allowing AI to become an uncontrolled architectural dependency.

---

# 83. Status

**Draft — Version 1.0**

Next recommended document:

**`AIModelProviderArchitecture.md`**

That document should define how the Platform connects to OpenAI and potentially other model providers, how provider abstraction works, how model routing/fallback works, and—critically—how we keep the architecture independent of a single AI vendor.
