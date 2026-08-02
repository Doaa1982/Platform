# Learning Delivery Context (Refinement)

**Version:** 1.1

**New Capability Added:**

- Interactive Learning Events

---

# 1. Context Purpose (Updated)

## Definition

The Learning Delivery Context manages the execution of learning experiences between educators and learners.

It defines how educational content, activities, interactions, and progress are experienced by learners.

It answers:

> "What does the learner experience, and how does learning happen?"

---

# 2. Updated Core Principle

## Learning Is an Experience, Not a Content Container

Traditional model:

```
Course

↓

Lesson

↓

Video

↓

Student watches
```

Updated model:

```
Learning Experience

↓

Learning Flow

↓

Learning Events

↓

Learner Actions

↓

Progress
```

---

# 3. Updated Core Concepts

---

# 3.1 Learning Experience

## Definition

A Learning Experience represents the complete journey a learner follows while participating in a Learning Product.

---

It contains:

```
Learning Plan

+

Learning Content

+

Learning Activities

+

Interactive Events

+

Assessments

+

Progress Tracking
```

---

# 3.2 Lesson

## Definition

A Lesson is a structured learning unit containing educational resources and learning interactions.

---

A Lesson is no longer only content.

It is a learning flow.

Example:

```
Lesson:

Understanding Fractions


Timeline:

1. Video Introduction

2. Interactive Question

3. Explanation

4. Practice Activity

5. Reflection
```

---

# 3.3 Learning Asset

## Definition

A Learning Asset is an educational resource used inside learning experiences.

---

Examples:

```
Video

Transcript

PDF

Image

Presentation

Audio

Worksheet

Flashcard
```

---

## Ownership

Learning Delivery owns the use of assets.

AI Context may generate or enhance assets.

---

# 3.4 Interactive Learning Event

## Definition

An Interactive Learning Event represents an intentional learning interaction occurring at a specific point within a learning experience.

---

## Purpose

It transforms passive content consumption into active learning.

---

# 4. Interactive Learning Event Types

---

# 4.1 Question Event

## Definition

A learning checkpoint requiring the learner to answer a question.

---

Examples:

```
Multiple Choice

True / False

Complete Sentence

Open Answer
```

---

Example:

```
Video Timestamp:

03:25


Event:

Question


Question:

What does the denominator represent?
```

---

# 4.2 Reflection Event

## Definition

A prompt encouraging learners to think about or apply knowledge.

---

Example:

```
Explain this concept using your own example.
```

---

# 4.3 Practice Event

## Definition

An activity where learners apply knowledge.

---

Examples:

- Solve exercises
- Record speaking practice
- Write an answer
- Complete a task

---

# 4.4 Discussion Event

## Definition

An interaction encouraging communication.

---

Examples:

- Class discussion
- Peer feedback
- Teacher question

---

# 4.5 Resource Event

## Definition

A moment where additional learning material is provided.

---

Examples:

```
At minute 05:00:

Show vocabulary list
```

---

# 4.6 AI Assistance Event

## Definition

An event where AI provides contextual support during learning.

---

Examples:

```
Learner asks:

Explain this concept differently.


AI responds:

Simplified explanation based on lesson transcript only
```

---

# 5. Interactive Video Lesson Model

An interactive video is represented as:

```
Interactive Lesson

|

+-- Video Asset

|

+-- Transcript

|

+-- Timeline

       |

       +-- Learning Event

       |

       +-- Question Event

       |

       +-- Practice Event

       |

       +-- Reflection Event
```

---

# 6. Timeline-Based Learning Flow

## Definition

A Learning Flow defines the sequence of learning events.

---

Example:

```
00:00

Introduction Video


03:20

Question Event


05:00

Explanation


07:30

Practice Activity


10:00

Assessment
```

---

# 7. AI Generated Interactive Events

## Workflow

```
Teacher uploads video

↓

AI analyses transcript

↓

AI identifies learning moments

↓

AI suggests events

↓

Teacher approves

↓

Events become part of Lesson
```

---

# 8. Ownership Boundary

## AI Context Owns

```
AI suggestions

Generated questions

Transcript analysis

Recommended events
```

---

## Learning Delivery Context Owns

```
Published Lesson

Interactive Learning Events

Learning Flow

Learner Interaction

Completion Tracking
```

---

# 9. Learner Progress Model (Updated)

Progress is no longer only:

```
Lesson completed
```

It becomes:

```
Learning Experience Progress

|

+-- Content Progress

+-- Activity Completion

+-- Interactive Event Completion

+-- Assessment Results
```

---

# 10. Business Value

This model allows:

## Tutors

to transform existing teaching materials into premium interactive courses.

---

## Learners

to actively engage instead of passively watching.

---

## AI

to continuously improve learning experiences.

---

## Platform

to support:

- recorded courses;
- live classes;
- AI tutoring;
- blended learning;
- adaptive learning.

---

# 11. Architectural Notes

The Learning Delivery Context owns the learner experience.

It should answer:

```
What does the learner do?

What interactions happen?

What progress is achieved?
```

It does not answer:

```
How was this content generated?

```

That belongs to AI Context.
