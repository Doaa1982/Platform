# Assessment Context

**Version:** 1.0 (Draft)

**Bounded Context Type:** Supporting Domain

**Domain Classification:** Strategic Supporting Context

**Related Documents**

- Learning Workspace Domain Language & Business Ontology
- Learning Product Context
- Learning Delivery Context
- Learning Workspace Value Streams

---

# 1. Context Purpose

## Definition

The Assessment Context manages the measurement and evaluation of learner achievement.

It answers:

> "How do we know that learning has happened?"

---

# 2. Business Responsibility

The Assessment Context owns:

- Assessment design
- Assessment execution
- Evaluation
- Scoring
- Feedback
- Achievement records
- Certification eligibility

---

# 3. Core Principle

## Learning and Assessment Are Related But Separate

Learning Delivery answers:

> "What learning activities happen?"

Assessment answers:

> "How do we measure achievement?"

---

Example:

Learning Activity:

```
Complete speaking practice
```

Assessment:

```
Evaluate speaking ability using rubric
```

---

# 4. Core Concepts

---

# 4.1 Assessment

## Definition

An Assessment is a structured method used to evaluate learner knowledge, skills, or achievement.

---

## Assessment Types

Examples:

```
Quiz

Exam

Assignment

Project

Interview

Presentation

Practical Task

Portfolio Review

AI Evaluation
```

---

## Responsibilities

An Assessment defines:

- objectives;
- criteria;
- evaluation method;
- scoring approach;
- completion requirements.

---

# 4.2 Assessment Template

## Definition

A reusable assessment design that can be applied to multiple learning experiences.

---

Example:

```
IELTS Speaking Assessment

Criteria:

Fluency

Vocabulary

Pronunciation

Grammar
```

---

# 4.3 Assessment Attempt

## Definition

An Assessment Attempt represents one learner's participation in an assessment.

---

Example:

```
Assessment:

Math Final Exam


Learner:

Ahmed


Attempt:

First Attempt

Score:

85%
```

---

## Responsibilities

Tracks:

- submission;
- answers;
- evidence;
- completion;
- evaluation status.

---

# 4.4 Evaluation

## Definition

Evaluation represents the process of judging learner performance.

---

## Evaluation Methods

```
Automatic

Teacher Evaluation

Peer Evaluation

AI Evaluation

Mixed Evaluation
```

---

# 4.5 Rubric

## Definition

A Rubric defines the criteria used to evaluate quality.

---

Example:

Speaking Skill:

```
Excellent

Good

Developing

Needs Improvement
```

---

## Purpose

Allows consistent evaluation.

---

# 4.6 Grade

## Definition

A Grade represents the outcome of an assessment evaluation.

---

## Examples

```
Score:

90%

Grade:

A


Competency:

Mastered
```

---

# 4.7 Certificate

## Definition

A Certificate represents formal recognition of achievement.

---

## Examples

- Course completion certificate
- Skill certificate
- Programme certificate
- Professional certificate

---

# 5. Owned Data

The Assessment Context is the source of truth for:

| Data | Owner |
|-|-|
| Assessment | Assessment Context |
| Assessment Template | Assessment Context |
| Attempt | Assessment Context |
| Evaluation | Assessment Context |
| Rubric | Assessment Context |
| Grade | Assessment Context |
| Certificate Record | Assessment Context |

---

# 6. Data Not Owned

| Data | Owner |
|-|-|
| Lesson | Learning Delivery Context |
| Activity | Learning Delivery Context |
| Learner identity | Membership Context |
| Product definition | Learning Product Context |
| Communication | Communication Context |

---

# 7. Business Rules

---

## Rule 1 — Assessment Must Have Purpose

Every assessment must evaluate a defined learning objective.

---

## Rule 2 — Assessment Results Are Historical Records

Once issued, assessment results should not change without maintaining history.

---

## Rule 3 — Evaluation Method Is Flexible

The same assessment can support:

```
Teacher grading

+

AI evaluation

+

Automatic scoring
```

---

## Rule 4 — Certificates Require Achievement Criteria

A certificate should only be issued when defined requirements are satisfied.

---

# 8. Relationships

---

# Assessment → Learning Delivery

Relationship:

```
Learning Activity

may require

Assessment
```

---

# Assessment → Learning Product

Relationship:

```
Learning Product

defines

Assessment Requirements
```

---

# Assessment → Membership

Relationship:

```
Learner Membership

creates

Assessment Attempt
```

---

# Assessment → AI Context

Relationship:

```
Assessment

may use

AI Evaluation
```

---

# 9. Assessment Lifecycle

```
Created

↓

Configured

↓

Published

↓

Attempt Started

↓

Submitted

↓

Evaluated

↓

Result Issued

↓

Archived
```

---

# 10. AI Assessment Future Model

AI can support:

## Automated Evaluation

Examples:

- language speaking analysis;
- writing feedback;
- coding evaluation.

---

## Adaptive Assessment

AI changes difficulty based on learner performance.

---

## Assessment Insights

AI identifies:

- common mistakes;
- weak skills;
- improvement areas.

---

# 11. Future Evolution

The Assessment Context should support:

## Competency-Based Learning

Instead of only scores:

```
Skill:

Fractions

Level:

Mastered
```

---

## Standards Alignment

Examples:

- Cambridge standards
- CEFR language levels
- Professional frameworks

---

## Portfolio Assessment

Learners demonstrate achievement through evidence.

---

# 12. Architectural Notes

The Assessment Context owns evaluation logic.

It should not manage:

- lessons;
- courses;
- learner identity;
- payments.

Its responsibility is:

```
What achievement means.

How achievement is measured.

How achievement is recorded.
```
