# Learning Activity Assignment Business Analysis

> Version: 1.0
>
> Status: Draft
>
> Domain: Learning Delivery
>
> Document Type: Business Analysis
>
> Author: Business Analysis Team
>
> Related Documents:
>
> - Learning Product Context
> - Learning Delivery Context
> - Curriculum Aggregate Design
> - Lesson Aggregate Design
> - Lesson Revision Aggregate Design
> - Learning Asset Aggregate Design
> - AI Capability Architecture
> - AI Collaboration Architecture

---

# 1. Business Vision

The Learning Workspace Platform should enable educators to assign **any form of learning work** to learners.

Assignments are not limited to traditional homework or quizzes. Instead, they represent any educational activity that contributes to learning, practice, reflection, assessment, or skill development.
The Learning Workspace Platform enables educators to extend learning beyond the lesson by creating educational activities that learners complete after or during instruction.

In Version 1, every lesson Activity is created within a Lesson Revision and forms part of the lesson's instructional design.

The platform focuses on delivering a simple and intuitive authoring experience while establishing a foundation that can evolve toward reusable learning activities in future releases.

---

# 2. Business Problem

Traditional Learning Management Systems typically treat homework as a collection of questions or worksheets.

Modern learning experiences extend far beyond traditional homework and include activities such as:

- Reading articles
- Watching educational videos
- Interactive simulations
- Coding exercises
- Reflection journals
- Group discussions
- Team projects
- Presentations
- File uploads
- AI-guided practice sessions
- External learning tools

Treating these as separate business concepts creates unnecessary complexity for both educators and learners.

The platform requires a unified model capable of representing every assigned learning experience while remaining extensible for future activity types.
For the initial release, educators primarily think in terms of lessons rather than reusable activity libraries.

The platform therefore adopts a lesson-first authoring experience where activities are created as part of lesson design instead of as standalone educational resources.

This reduces complexity while aligning with the natural workflow of educators.
---

# 3. Business Objectives

The platform shall enable tutors to:

- - Create learning activities while designing a lesson.
- Attach multiple learning activities to a lesson.
- Assign lesson activities to learners.
- Evaluate learner completion.
- Receive AI assistance during activity creation.
- Support multiple activity types using a unified business model.
- Assign activities to individuals or groups.
- Reuse activities across multiple Lessons and Curricula.
- Track learner completion and engagement.
- Evaluate learner performance.
- Receive AI assistance during activity authoring.
- Support multiple learning and assessment strategies.
- Deliver consistent learner experiences regardless of activity type.

---

# 4. Core Business Concepts

## lesson activity

## Learning Activity

A Learning Activity represents a piece of educational work designed as part of a Lesson Revision.

It extends the learning experience by providing learners with activities to complete during or after instruction.

Examples include:

- Homework
- Quiz
- Reading
- Video Activity
- Reflection
- Essay
- Coding Exercise
- Discussion
- File Upload
- Project

A Learning Activity always belongs to exactly one Lesson Revision.

It cannot exist independently of a Lesson Revision in Version 1.

Future platform versions may introduce reusable activity libraries.

---
### Ownership

Each Learning Activity belongs to one Lesson Revision.

```
Lesson
    │
    ▼
Lesson Revision
    │
    ▼
Learning Activities
```

Activities are created, edited, published, and versioned together with the Lesson Revision.

The Lesson Revision is therefore the owner of the instructional design, including its learning activities.
## Assignment

An Assignment represents the delivery of a Learning Activity to one or more learners.

Assignments define:

- Target learners
- Availability
- Due date
- Submission policy
- Attempt policy
- Evaluation policy
- Visibility
- Scheduling

Assignments are contextual.

Each Assignment is created from one Learning Activity.

Assignments inherit the instructional intent from the Learning Activity while defining learner-specific delivery rules such as availability, due dates, attempts, and evaluation policies.

---

## Submission

A Submission represents a learner's response to an Assignment.

Submissions may include:

- Answers
- Uploaded files
- Text responses
- Code
- External links
- AI conversation history
- Rich media

---

## Evaluation

Evaluation represents the educational review of a Submission.

Evaluation may be:

- Automatic
- AI-assisted
- Manual
- Rubric-based
- Pass / Fail
- Competency-based

---

# 5. Business Actors

## Tutor

Responsible for:

- Creating Learning Activities
- Assigning activities
- Reviewing submissions
- Evaluating learners
- Publishing feedback
- Collaborating with AI

---

## Student

Responsible for:

- Receiving assignments
- Completing activities
- Submitting work
- Reviewing feedback
- Resubmitting when permitted

---

## AI Assistant

Supports tutors by:

- Suggesting activities
- Generating educational content
- Creating questions
- Producing rubrics
- Suggesting evaluations
- Drafting feedback
- Identifying learning gaps

AI assists but does not replace the tutor's pedagogical authority unless explicitly configured.

---

## Workspace Administrator

Responsible for:

- Workspace policies
- Assignment settings
- Evaluation policies
- Permissions
- Monitoring

---

## Parent (Future)

May:

- Monitor learner progress
- Receive notifications
- View assigned activities
- Review completion status

---

# 6. Business Scenarios

## Learning Activity Creation

### Lesson Authoring

- Open Lesson
- Create Lesson Revision
- Add Learning Activity
- Configure activity
- Request AI assistance
- Preview activity
- Publish Lesson Revision
- Duplicate an existing activity
- Import from library
- Save as draft
- Publish activity

---
### Learning Activity Management

Within a Lesson Revision, a tutor may:

- Create a new activity.
- Edit an existing activity.
- Delete an activity.
- Reorder activities.
- Configure activity settings.
- Preview learner experience.

---
## Assignment

- Assign to one learner
- Assign to multiple learners
- Assign to a class
- Assign to a cohort
- Assign to Curriculum participants
- Schedule publication
- Publish immediately
- Withdraw assignment

---

## Learner Completion

- Start activity
- Pause activity
- Resume activity
- Submit work
- Submit after deadline
- Request extension

---

## Evaluation

- Automatic grading
- AI-assisted grading
- Manual grading
- Rubric evaluation
- Pass / Fail evaluation
- Peer review (Future)

---

## Revision

- Return submission
- Allow resubmission
- Reopen assignment
- Update evaluation

---

## Closure

- Complete assignment
- Expire assignment
- Archive assignment

---

# 7. Supported Learning Activity Types

The platform initially supports:

- Question Set
- Quiz
- Homework
- Reading
- Video Activity
- Interactive Lesson
- Essay
- File Upload
- Project
- Discussion
- Coding Exercise
- Reflection Journal
- AI Practice Session
- External Learning Tool

The platform shall support future activity types without requiring architectural changes.

---

# 8. Business Rules

## Learning Activity Rules

- Every Learning Activity belongs to exactly one Lesson Revision.
- A Lesson Revision may contain zero or more Learning Activities.
- Learning Activities cannot exist independently.
- Learning Activities are versioned together with the Lesson Revision.
- Publishing a Lesson Revision publishes all contained Learning Activities.
- Editing Learning Activities after publication requires creating a new Lesson Revision.

---

## Assignment Rules

- An Assignment references exactly one Learning Activity.
- A Learning Activity may have multiple Assignments.
- Assignment policies are independent of the Learning Activity.
- Assignments may target individuals or groups.
- Assignments may be scheduled.

---

## Submission Rules

- A learner may have multiple attempts depending on Assignment policy.
- Every Submission belongs to exactly one Assignment.
- Every Submission belongs to exactly one learner unless collaborative work is enabled.
- Submission deadlines are enforced by Assignment policy.

---

## Evaluation Rules

- Objective responses may be automatically evaluated.
- Tutors may override automated evaluations.
- AI recommendations require tutor approval unless automatic evaluation is enabled.
- Evaluations may include grades, feedback, rubrics, or competency assessments.

---

# 9. Assignment Lifecycle

```text
Draft
    │
    ▼
Scheduled
    │
    ▼
Published
    │
    ▼
Active
    │
    ▼
Closed
    │
    ▼
Archived
```

---

# 10. Submission Lifecycle

```text
Not Started
      │
      ▼
In Progress
      │
      ▼
Submitted
      │
      ▼
Under Review
      │
      ▼
Evaluated
      │
      ▼
Returned
      │
      ▼
Resubmitted
      │
      ▼
Completed
```

---

# 11. AI Opportunities

AI may assist throughout the Learning Activity lifecycle.


## Lesson Authoring

AI may assist tutors by:

- Suggesting suitable Learning Activities.
- Generating activity instructions.
- Creating question sets.
- Producing coding exercises.
- Drafting discussion prompts.
- Creating reading comprehension activities.
- Suggesting estimated completion time.
- Suggesting activity difficulty.

---

## Planning

- Suggest due dates
- Recommend activity difficulty
- Estimate completion time
- Recommend prerequisite knowledge

---

## Evaluation

- Suggest grades
- Draft personalized feedback
- Detect plagiarism (Future)
- Detect AI-generated submissions (Future)
- Recommend remediation activities

---

## Analytics

- Detect struggling learners
- Identify difficult activities
- Recommend improvements
- Predict completion risk

AI acts as a collaborative educational assistant rather than an autonomous instructor.

---

# 12. Integration with Existing Domains

Lesson Revision

Learning Activities are owned by Lesson Revisions and form part of the instructional design.

Publishing a Lesson Revision also publishes its Learning Activities.

| Domain | Relationship |
|----------|--------------|
| Curriculum | Activities may be associated with Curriculum Lessons or Units. |
| Lesson Revision | Activities may be created from or attached to Lesson Revisions. |
| Learning Asset | Activities may reference Learning Assets. |
| Enrollment | Determines assignment recipients. |
| Progress Tracking | Activity completion contributes to learner progress. |
| Notifications | Publishes assignment and feedback events. |
| AI Collaboration | Assists authoring and evaluation. |
| Assessment | Question-based activities may integrate with Assessment capabilities. |

---
# 13. Business Decisions

## BA-001

Learning Activities belong to exactly one Lesson Revision.

Standalone Learning Activities are not supported in Version 1.

---

## BA-002

Learning Activities are authored during lesson design.

Educators do not create activities outside the context of a Lesson Revision.

---

## BA-003

Learning Activities are published together with the Lesson Revision.

They do not have an independent publication lifecycle.

---

## BA-004

Assignments are created from Learning Activities.

Assignments cannot exist without an associated Learning Activity.

---

## BA-005

Activity reuse across multiple Lessons is outside the scope of Version 1.

This capability may be introduced in a future release through an Activity Library.

---

## BA-006

AI collaborates with tutors while designing Lesson Revisions.

AI assists in creating Learning Activities but does not independently publish educational content.
# Summary

Lesson
      │
      ▼
Lesson Revision
      │
      ▼
Learning Activities
      │
      ▼
Assignments
      │
      ▼
Student Submission
      │
      ▼
Evaluation
The Learning Activity Assignment capability provides a unified business model for assigning, completing, and evaluating any form of educational work.

By separating **Learning Activity** from **Assignment**, the platform enables reusable educational content, flexible delivery, AI-assisted authoring, scalable evaluation strategies, and future educational innovations while maintaining a consistent learner experience| Business Decision                 | Version 1                                                    |
| --------------------------------- | ------------------------------------------------------------ |
| Learning Activity ownership       | Belongs to exactly one Lesson Revision                       |
| Standalone Learning Activities    | ❌ Not supported                                              |
| Shared Activity Library           | ❌ Not supported                                              |
| Reusing Activities across Lessons | ❌ Not supported                                              |
| Copy Activity                     | ❌ Not supported                                              |
| Activity Marketplace              | ❌ Not supported                                              |
| Assignment source                 | Must originate from a Learning Activity in a Lesson Revision |
.