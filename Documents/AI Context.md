# AI Context

**Version:** 1.0 (Draft)

**Bounded Context Type:** Core Domain

**Domain Classification:** Strategic Core Context

**Related Documents**

- Learning Workspace Domain Language & Business Ontology
- Learning Workspace Capability Model
- Core Domain Analysis
- Workspace Context
- Learning Product Context
- Learning Delivery Context
- Assessment Context

---

# 1. Context Purpose

## Definition

The AI Context manages artificial intelligence capabilities that enhance the operation, teaching, learning, and growth of a Learning Workspace.

It answers:

> "How can AI help this educational business operate, teach, and improve?"

---

# 2. Strategic Importance

The AI Context is a Core Domain because AI behaviour is a major differentiator of the Learning Workspace Platform.

The platform should not provide generic AI.

It should provide:

> Workspace-aware AI.

---

# 3. Core Principle

## AI Is Workspace-Native

AI behaviour depends on:

- Workspace identity
- Educational philosophy
- Learning products
- Curriculum
- Teaching style
- Policies
- Learner data
- Historical interactions

---

Example:

Two tutors use the platform.

Tutor A:

```
Language academy

Teaching style:

Conversation focused

Feedback:

Friendly and encouraging
```

Tutor B:

```
Exam preparation academy

Teaching style:

Structured and rigorous

Feedback:

Detailed scoring
```

The AI assistant should behave differently.

---

# 4. AI Roles

The AI Context supports multiple AI roles.

---

# 4.1 AI Teaching Assistant

## Purpose

Supports educators during teaching activities.

---

## Responsibilities

- Explain concepts
- Generate examples
- Suggest activities
- Create practice material
- Assist lesson preparation
- Provide teaching recommendations

---

Example:

Tutor asks:

"Create speaking activities for B1 English learners."

AI generates:

- activities;
- instructions;
- evaluation criteria.

---

# 4.2 AI Learning Assistant

## Purpose

Supports learners directly.

---

## Responsibilities

- Answer questions
- Explain concepts
- Provide practice
- Recommend resources
- Support revision

---

Example:

Learner asks:

"I don't understand fractions."

AI adapts explanation according to:

- learner level;
- previous mistakes;
- learning goals.

---

# 4.3 AI Assessment Assistant

## Purpose

Supports evaluation and feedback.

---

## Responsibilities

- Analyse answers
- Suggest grades
- Provide feedback
- Detect learning gaps
- Generate assessment questions

---

# 4.4 AI Business Assistant

## Purpose

Supports workspace owners in running their educational business.

---

## Responsibilities

- Analyse performance
- Suggest improvements
- Predict risks
- Recommend actions

---

Example:

AI insight:

"Your Grade 5 mathematics learners have a lower completion rate after Module 4. Consider adding additional practice activities."

---

# 4.5 AI Content Assistant

## Purpose

Supports creation of educational materials.

---

## Responsibilities

- Generate lessons
- Create quizzes
- Create worksheets
- Create presentations
- Adapt content difficulty

---

# 5. Core Concepts

---

# 5.1 AI Agent

## Definition

An AI Agent is an intelligent assistant with a defined purpose, permissions, and responsibilities.

---

Examples:

```
Teaching Agent

Learning Agent

Assessment Agent

Business Agent
```

---

# 5.2 Workspace AI Profile

## Definition

Defines how AI behaves inside a specific workspace.

---

Contains:

- teaching style;
- communication style;
- educational philosophy;
- allowed actions;
- knowledge sources.

---

# 5.3 AI Knowledge Base

## Definition

Workspace-specific knowledge available to AI.

---

Examples:

- curriculum documents;
- teaching materials;
- policies;
- FAQs;
- course content.

---

# 5.4 AI Memory

## Definition

Stores relevant historical information used to improve AI responses.

---

Examples:

Learner memory:

```
Student struggles with pronunciation.

Prefers visual explanations.
```

Workspace memory:

```
Teacher prefers British English examples.
```

---

# 5.5 AI Action

## Definition

A task that AI can perform.

---

Examples:

```
Generate lesson plan

Create feedback

Analyse progress

Draft message

Recommend activity
```

---

# 6. Owned Data

The AI Context owns:

| Data | Owner |
|-|-|
| AI Agents | AI Context |
| AI Configuration | AI Context |
| AI Profiles | AI Context |
| AI Knowledge Configuration | AI Context |
| AI Interaction History | AI Context |
| AI Recommendations | AI Context |

---

# 7. Data Not Owned

| Data | Owner |
|-|-|
| Learner progress | Learning Delivery Context |
| Grades | Assessment Context |
| Course structure | Learning Product Context |
| User identity | Identity Context |
| Permissions | Membership Context |

---

# 8. AI Governance Rules

---

## Rule 1 — AI Has Boundaries

AI actions must respect:

- workspace permissions;
- privacy rules;
- educational policies.

---

## Rule 2 — AI Does Not Replace Ownership

AI assists humans.

It does not become the owner of educational decisions.

---

## Rule 3 — Workspace Controls AI Behaviour

Each workspace defines:

- tone;
- rules;
- allowed capabilities.

---

## Rule 4 — Human Approval

Sensitive actions may require human approval.

Examples:

- final grades;
- official certificates;
- parent reports.

---

# 9. Relationships

---

# AI → Workspace

Relationship:

```
Workspace

configures

AI Behaviour
```

---

# AI → Learning Product

Relationship:

```
Learning Product

provides

Educational Context
```

---

# AI → Learning Delivery

Relationship:

```
Learning Experience

provides

Learning Context
```

---

# AI → Assessment

Relationship:

```
Assessment

uses

AI Evaluation Support
```

---

# AI → Communication

Relationship:

```
AI

generates

Communication Drafts
```

---

# 10. AI Value Streams

---

## Teacher Productivity

Before:

```
Create lesson:
2 hours
```

After:

```
AI draft:
10 minutes
```

---

## Learner Support

Before:

```
Question waits until teacher available
```

After:

```
AI provides immediate support
```

---

## Business Intelligence

Before:

```
Owner checks reports manually
```

After:

```
AI identifies opportunities
```

---

# 11. Future Evolution

The AI Context should support:

## Multi-Agent Architecture

Example:

```
Teaching Agent

+

Assessment Agent

+

Business Agent

+

Student Agent
```

---

## AI Marketplace

Workspaces may use specialised AI agents.

---

## AI Personal Tutors

Each learner may have a personalised AI tutor.

---

## AI Workspace Manager

An AI agent that understands:

- students;
- teachers;
- revenue;
- operations.

---

# 12. Architectural Notes

The AI Context is a strategic capability layer.

It should not own educational truth.

It provides intelligence over existing domains.

Its responsibility is:

```
Understand context.

Assist decisions.

Automate work.

Improve outcomes.
```
# 13. AI Content Creation & Lesson Authoring Assistant

## Definition

The AI Content Creation Assistant helps educators transform existing teaching materials into structured, interactive learning experiences.

It allows tutors to use their own teaching knowledge while reducing the time required to create professional learning content.

---

# 13.1 Business Purpose

Many tutors already have valuable educational assets:

- recorded lessons;
- YouTube videos;
- Zoom recordings;
- presentations;
- documents;
- existing course materials.

The AI assistant converts these assets into structured lessons inside the Learning Workspace.

---

# 13.2 Lesson Creation Workflow

The workflow:

```
Teacher uploads content

↓

AI analyses content

↓

AI creates lesson structure

↓

Teacher reviews and edits

↓

Lesson published

↓

Interactive activities generated
```

---

# 13.3 Supported Content Sources

The AI Assistant supports:

## Video Upload

Teacher uploads:

- MP4 video;
- recorded classroom session;
- recorded tutoring session.

---

## Video URL

Teacher provides:

- YouTube URL;
- Vimeo URL;
- supported video source URL.

The AI extracts available educational information from the video source.

---

## Other Materials

Future support:

- PDF files;
- presentations;
- documents;
- textbooks;
- images.

---

# 13.4 AI Video Understanding

After receiving a video, AI performs:

## Transcription

AI converts speech into text.

Example:

```
Video:

Introduction to Fractions

↓

Transcript:

"Fractions represent parts of a whole..."
```

---

## Content Analysis

AI identifies:

- main topics;
- concepts;
- examples;
- explanations;
- important points.

---

## Lesson Title Suggestion

AI suggests professional lesson names.

Example:

Original video:

```
lesson5_final.mp4
```

AI suggests:

```
Understanding Equivalent Fractions
```

---

## Lesson Summary Generation

AI creates:

- lesson description;
- learning objectives;
- key concepts.

---

# 13.5 Interactive Lesson Generation

The transcript becomes the foundation for creating interactive learning activities.

---

## AI Generated Questions

AI generates questions based on lesson content.

Examples:

### Multiple Choice

```
What does a fraction represent?
```

---

### True / False

```
A fraction always represents a number greater than one.
```

---

### Short Answer

```
Explain the difference between numerator and denominator.
```

---

### Discussion Questions

```
Give an example of fractions in daily life.
```

---

# 13.6 Interactive Learning Elements

AI can generate:

- comprehension questions;
- vocabulary activities;
- reflection activities;
- practice exercises;
- flashcards;
- summaries;
- knowledge checks.

---

# 13.7 Teacher Control

AI-generated content is not automatically published.

The workflow is:

```
AI Suggests

↓

Teacher Reviews

↓

Teacher Edits

↓

Teacher Approves

↓

Learners Receive
```

---

# 13.8 AI Lesson Adaptation

The same lesson can be adapted for different audiences.

Example:

Original lesson:

```
Advanced Mathematics Explanation
```

AI adapts into:

```
Beginner explanation

+

simplified examples

+

additional practice
```

---

# 13.9 Relationship With Other Contexts

## AI Context

Provides:

- analysis;
- generation;
- recommendations.

---

## Learning Delivery Context

Owns:

- lesson;
- activity;
- learning experience.

---

## Assessment Context

Receives:

- generated questions;
- evaluation activities.

---

## Learning Product Context

Uses:

- generated lessons as product content.

---

# 13.10 Architectural Principle

AI creates suggestions and accelerates authoring.

The educator remains the owner of educational decisions.

The ownership flow:

```
Teacher Knowledge

↓

AI Processing

↓

Learning Asset

↓

Teacher Approval

↓

Learning Experience
```
