# Learning Product Context (Refinement)

**Version:** 1.1

**New Capabilities Added:**

- Learning Asset
- Product Content Strategy
- Reusable Content Model

---

# 1. Context Purpose (Updated)

## Definition

The Learning Product Context manages the definition, packaging, and commercial offering of educational experiences.

It answers:

> "What educational products does this Learning Workspace offer, and how are they structured?"

---

# 2. Updated Core Principle

## Separate Educational Assets From Educational Products

A common mistake in LMS design is:

```
Course

owns

all content
```

This creates duplication.

Example:

A tutor teaches:

```
English Speaking Skills
```

The same lesson may be used in:

```
Beginner English Course

+

IELTS Preparation Course

+

Conversation Practice Membership
```

Therefore:

```
Content

should be reusable.

Products

should compose content.
```

---

# 3. Core Concepts (Updated)

---

# 3.1 Learning Product

## Definition

A Learning Product represents a structured educational offering provided by a Learning Workspace.

---

Examples:

```
English Conversation Course

IELTS Preparation Programme

Mathematics Membership

Private Tutoring Package
```

---

A Learning Product defines:

- target learners;
- learning goals;
- structure;
- access model;
- required learning experiences.

---

# 3.2 Product Structure

## Definition

Product Structure defines how educational components are organised into a product.

---

Example:

```
IELTS Preparation Course

Module 1

  Lesson 1

  Lesson 2


Module 2

  Lesson 3

  Assessment
```

---

# 3.3 Learning Asset

## Definition

A Learning Asset is a reusable educational resource that can be used across multiple learning products and experiences.

---

Examples:

## Media Assets

```
Video

Audio

Image

Animation
```

---

## Knowledge Assets

```
Transcript

Article

Explanation

Example
```

---

## Practice Assets

```
Question Bank

Worksheet

Exercise

Flashcard Set
```

---

## AI Generated Assets

```
AI Summary

AI Quiz

AI Explanation

AI Study Guide
```

---

# 3.4 Learning Asset Library

## Definition

The Learning Asset Library is the collection of reusable educational resources owned by a Learning Workspace.

---

Purpose:

Allow tutors to build once and reuse many times.

---

Example:

Workspace Asset Library:

```
Grammar Videos

Vocabulary Exercises

Speaking Activities

IELTS Questions
```

---

# 3.5 Product Content Strategy

## Definition

Product Content Strategy defines how learning assets are selected, arranged, adapted, and delivered inside a Learning Product.

---

It answers:

```
Which assets are used?

In what order?

For which learners?

With what learning objectives?
```

---

# 4. Product Content Composition Model

A Learning Product is composed from assets.

```
Learning Product

|

+-- Module

      |

      +-- Learning Experience

              |

              +-- Learning Asset

              |

              +-- Interactive Learning Events
```

---

# 5. Asset Reusability Model

Example:

One video:

```
Pronunciation Basics
```

can be used in:

```
Beginner English Course

+

Speaking Membership

+

Teacher Training Programme
```

---

The asset remains the same.

The learning experience changes.

---

# 6. AI Relationship

AI improves the Learning Asset lifecycle.

---

## Before AI

Teacher creates:

```
Video

↓

Manual lesson creation

↓

Manual questions
```

---

## With AI

Teacher creates:

```
Video

↓

AI Analysis

↓

Transcript

↓

Summary

↓

Interactive Questions

↓

Learning Activities

↓

Reusable Asset Library
```

---

# 7. Learning Asset Lifecycle

```
Created

↓

Processed

↓

Enhanced

↓

Approved

↓

Published

↓

Reused

↓

Archived
```

---

# 8. Asset Versioning

Assets require version control.

Example:

```
Video Version 1

↓

Updated explanation

↓

Video Version 2
```

Products using the asset can decide:

```
Use latest version

or

Keep current version
```

---

# 9. AI Generated Content Ownership

## AI Context owns:

```
Generated suggestions

AI analysis

Draft outputs
```

---

## Learning Product Context owns:

```
Approved learning assets

Product structure

Content selection
```

---

# 10. Product Content Strategies

The platform should support multiple strategies.

---

# 10.1 Linear Course Strategy

Example:

```
Lesson 1

↓

Lesson 2

↓

Final Assessment
```

---

# 10.2 Modular Strategy

Example:

Learner selects modules:

```
Grammar Module

Speaking Module

Writing Module
```

---

# 10.3 Membership Library Strategy

Example:

```
Monthly Access

↓

Complete Content Library
```

---

# 10.4 Adaptive Strategy

Future AI-driven model:

```
Learner Performance

↓

AI Selects Next Content
```

---

# 11. Business Value

## For Tutors

They create a growing educational asset library.

---

## For Learners

They receive structured learning journeys.

---

## For Platform

It supports:

- courses;
- memberships;
- tutoring;
- academies;
- marketplaces.

---

# 12. Architectural Notes

The Learning Product Context owns:

```
What educational products exist?

How are they packaged?

Which assets are included?
```

It does not own:

```
How learners interact with content.

How AI generates content.

How payments happen.
```
