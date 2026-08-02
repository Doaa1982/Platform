# Scheduling Context

**Version:** 1.0 (Draft)

**Bounded Context Type:** Supporting Domain

**Domain Classification:** Strategic Supporting Context

**Related Documents**

- Learning Workspace Domain Language & Business Ontology
- Learning Product Context
- Learning Delivery Context
- Assessment Context
- Learning Workspace Value Streams

---

# 1. Context Purpose

## Definition

The Scheduling Context manages the planning and organisation of time-based educational activities.

It answers:

> "When and where does learning happen, and who participates?"

---

# 2. Business Responsibility

The Scheduling Context owns:

- Time planning
- Sessions
- Availability
- Recurring schedules
- Bookings
- Calendar events
- Resource allocation

---

# 3. Core Principle

## Separate Learning From Scheduling

A lesson describes educational content.

A schedule describes operational execution.

Example:

Learning Delivery:

```
Lesson:

Introduction to Fractions
```

Scheduling:

```
Session:

Monday 5:00 PM

Teacher:

Ahmed

Room:

Classroom 3
```

---

# 4. Core Concepts

---

# 4.1 Schedule

## Definition

A Schedule defines planned timing rules for educational activities.

---

## Examples

```
Every Monday

5 PM - 6 PM

Math Group A
```

or:

```
Available tutoring slots:

Monday-Friday

3 PM-8 PM
```

---

# 4.2 Learning Session

## Definition

A Learning Session represents a scheduled occurrence of learning delivery.

---

## Example

```
Session:

English Conversation Practice

Date:

15 August

Time:

18:00

Teacher:

Sara

Learners:

8 students
```

---

## Responsibilities

A session manages:

- timing;
- participants;
- location;
- status.

---

# 4.3 Availability

## Definition

Availability represents when resources can be used.

---

## Examples

Teacher availability:

```
Ahmed

Available:

Monday
Tuesday
Wednesday

4 PM - 8 PM
```

---

Resource availability:

```
Room 4

Available:

Saturday morning
```

---

# 4.4 Booking

## Definition

A Booking represents a confirmed reservation of a learning opportunity.

---

## Examples

```
Student books:

Private English Lesson

Time:

Tuesday 6 PM
```

---

# 4.5 Calendar Event

## Definition

A Calendar Event represents an important time-based occurrence.

---

Examples:

- Exam date
- Parent meeting
- Workshop
- Holiday
- School event

---

# 5. Owned Data

The Scheduling Context is the source of truth for:

| Data | Owner |
|-|-|
| Schedule | Scheduling Context |
| Session timing | Scheduling Context |
| Availability | Scheduling Context |
| Booking | Scheduling Context |
| Calendar Events | Scheduling Context |

---

# 6. Data Not Owned

| Data | Owner |
|-|-|
| Lesson content | Learning Delivery Context |
| Teacher identity | Membership Context |
| Payment | Commerce Context |
| Communication messages | Communication Context |
| Assessment result | Assessment Context |

---

# 7. Business Rules

---

## Rule 1 — Scheduling Does Not Define Learning

A schedule cannot create educational meaning.

It only organises execution.

---

## Rule 2 — A Session Requires Participants

A session must have:

- teacher/resource;
- learners or target audience;
- time;
- status.

---

## Rule 3 — Availability Comes Before Booking

A booking cannot exist without available capacity.

---

## Rule 4 — Recurring Schedules Generate Sessions

Example:

```
Every Monday

for 12 weeks

creates

12 Learning Sessions
```

---

## Rule 5 — Schedule Changes Preserve History

Changing future schedules must not modify completed sessions.

---

# 8. Relationships

---

# Scheduling → Learning Delivery

Relationship:

```
Learning Experience

creates

Scheduled Sessions
```

---

# Scheduling → Membership

Relationship:

```
Teacher Membership

provides

Available Instructor
```

```
Learner Membership

participates in

Session
```

---

# Scheduling → Resource Management

Relationship:

```
Session

may require

Room / Equipment / Online Meeting Resource
```

---

# Scheduling → Communication

Relationship:

```
Schedule Event

triggers

Reminder / Notification
```

---

# 9. Scheduling Models Supported

---

# 9.1 Private Tutoring

Example:

```
Tutor:

Ahmed

Learner:

Ali

Frequency:

Twice weekly
```

---

# 9.2 Group Classes

Example:

```
Teacher:

Sara

Class:

Beginner English

Students:

15
```

---

# 9.3 Academy Timetable

Example:

```
Branch:

Downtown Campus

Room:

A12

Teacher:

Multiple Staff
```

---

# 9.4 Self-Paced Learning

No required schedule.

Learners progress independently.

---

# 10. Future Evolution

The Scheduling Context should support:

## Intelligent Scheduling

AI can optimise:

- teacher availability;
- learner preferences;
- room usage;
- workload balance.

---

## Automatic Rescheduling

Examples:

- teacher absence;
- holiday conflicts;
- learner requests.

---

## Multi-Location Scheduling

Support:

- branches;
- campuses;
- classrooms.

---

## Hybrid Learning

Example:

```
Physical classroom

+

Online participants
```

---

# 11. Architectural Notes

The Scheduling Context manages operational time.

It should not manage:

- learning content;
- learner progress;
- payments;
- assessment results.

Its responsibility is:

```
When does learning happen?

Who participates?

What resources are required?
```
