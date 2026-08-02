# Communication Context

**Version:** 1.0 (Draft)

**Bounded Context Type:** Supporting Domain

**Domain Classification:** Strategic Supporting Context

**Related Documents**

- Learning Workspace Domain Language & Business Ontology
- Workspace Context
- Membership Context
- Learning Delivery Context
- Commerce Context
- Learning Workspace Value Streams

---

# 1. Context Purpose

## Definition

The Communication Context manages communication relationships between a Learning Workspace and its community.

It answers:

> "How does this educational business communicate with the right people at the right time?"

---

# 2. Business Responsibility

The Communication Context owns:

- Messages
- Announcements
- Communication campaigns
- Conversations
- Communication preferences
- Templates
- Communication history

---

# 3. Core Principle

## Communication Is a Business Relationship

Communication is not only sending notifications.

It represents interaction between people and the learning business.

---

Example:

A notification:

```
Class starts tomorrow
```

is infrastructure.

A communication:

```
Dear Ahmed,

Your IELTS speaking session is tomorrow at 6 PM.
Please prepare your speaking task.

Your teacher,
Sara
```

is a business interaction.

---

# 4. Core Concepts

---

# 4.1 Message

## Definition

A Message is a communication sent between members of a Learning Workspace.

---

## Examples

- Teacher feedback
- Parent message
- Administrative announcement
- Learner question

---

## Responsibilities

A Message contains:

- sender;
- recipients;
- content;
- context;
- status.

---

# 4.2 Conversation

## Definition

A Conversation represents an ongoing communication relationship between participants.

---

## Examples

```
Teacher

+

Parent

+

Student Progress Discussion
```

or:

```
Tutor

+

Learner

+

Homework Support
```

---

# 4.3 Announcement

## Definition

An Announcement is a one-to-many communication from the workspace.

---

## Examples

- Holiday announcement
- New course launch
- Policy update
- Event announcement

---

# 4.4 Communication Template

## Definition

A reusable communication structure.

---

## Examples

```
Welcome message

Payment reminder

Class reminder

Course completion message
```

---

# 4.5 Communication Preference

## Definition

Rules defining how and when a person wants to receive communications.

---

## Examples

```
Receive:

Email

Yes


SMS

No


WhatsApp

Yes
```

---

# 4.6 Communication Event

## Definition

A business event that may trigger communication.

---

Examples:

```
Student enrolled

↓

Welcome message
```

```
Session tomorrow

↓

Reminder message
```

```
Assignment graded

↓

Feedback notification
```

---

# 5. Owned Data

The Communication Context is the source of truth for:

| Data | Owner |
|-|-|
| Messages | Communication Context |
| Conversations | Communication Context |
| Announcements | Communication Context |
| Templates | Communication Context |
| Communication Preferences | Communication Context |
| Communication History | Communication Context |

---

# 6. Data Not Owned

| Data | Owner |
|-|-|
| User identity | Identity Context |
| Roles | Membership Context |
| Learning progress | Learning Delivery Context |
| Payments | Commerce Context |
| Schedule information | Scheduling Context |

---

# 7. Business Rules

---

## Rule 1 — Communication Requires Context

A business communication should relate to a business purpose.

Examples:

- Learning activity
- Payment
- Schedule
- Assessment
- Event

---

## Rule 2 — Communication Ownership

Messages belong to a workspace communication history.

---

## Rule 3 — Preferences Must Be Respected

Users control allowed communication channels.

---

## Rule 4 — Historical Communication Must Be Preserved

Important communication records cannot disappear.

---

# 8. Relationships

---

# Communication → Membership

Relationship:

```
Members

participate in

Communication
```

---

# Communication → Learning Delivery

Relationship:

```
Learning Event

may trigger

Communication
```

---

# Communication → Scheduling

Relationship:

```
Upcoming Session

may trigger

Reminder
```

---

# Communication → Commerce

Relationship:

```
Payment Event

may trigger

Receipt or Reminder
```

---

# Communication → AI Context

Relationship:

```
AI Assistant

may generate

Personalised Communication
```

---

# 9. Communication Types

---

## Operational Communication

Examples:

- Reminders
- Confirmations
- Updates

---

## Educational Communication

Examples:

- Feedback
- Guidance
- Learning advice

---

## Business Communication

Examples:

- Offers
- Promotions
- Renewal messages

---

## Community Communication

Examples:

- Events
- Discussions
- Announcements

---

# 10. Future Evolution

The Communication Context should support:

## AI Communication Assistant

Examples:

AI drafts:

- parent reports;
- learner feedback;
- course announcements.

---

## Omnichannel Communication

Channels:

- Email
- SMS
- WhatsApp
- Push notification
- In-app messaging

---

## Personalised Communication

AI adapts communication based on:

- learner progress;
- preferences;
- behaviour;
- history.

---

## Parent Engagement

Important for school and child-learning scenarios:

- progress updates;
- attendance alerts;
- achievement messages.

---

# 11. Architectural Notes

The Communication Context manages communication meaning.

It should not manage:

- delivery technology;
- authentication;
- learning rules;
- payment rules.

Its responsibility is:

```
Who communicates?

Why?

What is communicated?

When?
```
