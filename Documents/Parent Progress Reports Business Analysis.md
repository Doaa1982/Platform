# Parent Progress Reports Business Analysis

> Version: 1.0
>
> Status: Accepted (Version 1 — email)
>
> Domain: Learning Delivery / Communication
>
> Document Type: Business Analysis
>
> Author: Business Analysis Team
>
> Related Documents:
>
> - Assignment Business Analysis
> - Invitation Business Analysis
> - Workspace Setup Business Analysis
> - Learning Progress Tracking Business Analysis
> - Notification Domain (Future)

---

# 1. Business Vision

Parents usually pay the tutor. A parent who regularly sees how their child is doing keeps paying — and recommends the tutor to other parents.

Parent Progress Reports let an academy email a learner's parents short, factual updates: the result of each marked assignment and graded quiz, and a summary of each month.

Competitors (Sahahly) sell this as a headline feature. Here it is included on **every plan, including Free**, by email. WhatsApp delivery will follow as a paid add-on.

---

# 2. Business Problem

Today the only person who sees a learner's results is the learner. Parents hear about progress only if the child tells them, or if the tutor writes to them by hand.

Writing to each parent by hand does not scale, and a tutor who forgets loses the parent's confidence.

---

# 3. Scope

## In scope (Version 1)

- Parent contacts attached to a learner, added by the tutor, by the learner, with an invitation, or from a spreadsheet.
- Consent by email before anything is sent, and one-click unsubscribe.
- Result emails after a marked assignment or a graded quiz.
- A monthly summary email.
- Two academy-level switches, off by default.

## Out of scope (future work)

- **WhatsApp delivery** — a paid add-on. The WhatsApp number is collected and stored now; nothing is sent to it. The send log (§11) is designed to feed its limits.
- **A parent login.** `WorkspaceRoleName.Parent` stays reserved for a future parent account and is not used by this feature.
- Links from the emails into the app (parents have no account).
- A second email when a tutor later overrides a quiz grade.

---

# 4. Glossary

| Term | Meaning |
|---|---|
| Parent contact | A name and an email attached to one learner in one workspace. Not a user. |
| Confirmation | The parent clicking "Yes, send me updates" in the one email they get before consenting. |
| Result email | One email after a marked assignment or a graded quiz. |
| Monthly summary | One email on the 1st of a month about the previous calendar month. |
| Confirmation round | One invitation to confirm. A new round (resend, re-invite, email change) retires the previous link. |

---

# 5. Parent Contact Rules

| Rule | Description |
|---|---|
| PR-001 | Parents do not get accounts. A parent contact is: name, email, preferred language (Arabic or English, Arabic by default), and an optional WhatsApp number that is stored but not used in Version 1. |
| PR-002 | A parent contact belongs to exactly one learner in one workspace. The same person caring for two children is two contacts. |
| PR-003 | A learner can have at most **2** parent contacts. |
| PR-004 | One learner can't have the same parent email twice. Whoever adds it (form, import, invitation), a duplicate updates or is refused — never added twice. |
| PR-005 | Changing a contact's email starts consent over: it is someone else's inbox. |

## Lifecycle

```
Pending confirmation ──confirm──▶ Confirmed ──unsubscribe──▶ Unsubscribed
        ▲                                                         │
        └─────────────── tutor re-invites ◀───────────────────────┘

Any state ──remove──▶ Removed (terminal)
```

| Invariant | Description |
|---|---|
| PR-INV-001 | Consent first: only a **Confirmed** contact can receive reports. |
| PR-INV-002 | A confirmation link works only for its own confirmation round and only within **14 days**. After 14 days the contact stays unconfirmed and receives nothing; the tutor can send the confirmation again. |
| PR-INV-003 | After unsubscribing, nothing is sent until the tutor re-invites **and** the parent confirms again. The old confirmation link can't resubscribe them. |
| PR-INV-004 | Removed is terminal. Adding the parent again creates a new contact. |

---

# 6. Adding Parent Contacts

Every path leads to the same contact record and the same confirmation email.

## 6.1 While inviting a student

- The single and bulk invitation can carry up to 2 parents per student (name, email, language, WhatsApp number). Only for learner invitations.
- Admission rule: no learner membership exists until the invitation is accepted. So the parent details are **stored with the invitation**, not as contacts.
- When the student accepts and their membership is active, the stored details become parent contacts, and **only then** do the parents get the confirmation email. Parents of a student who never joins are never emailed.
- Cancelling the invitation discards the stored details. An expired invitation can't be accepted, and resending one that had expired discards the details typed for it.
- The pending-invitations view shows how many parents are attached to each open invitation.

## 6.2 For existing students

- The tutor (owner or administrator — the same people who manage members) adds, edits, resends the confirmation to, and removes parents from each learner's row on the Members screen.
- The learner adds or removes their own parents from "My parents". A learner can never see or change another learner's contacts.

## 6.3 Spreadsheet import (CSV and .xlsx)

Columns: `student_email, parent1_name, parent1_email, parent1_whatsapp, parent1_language, parent2_name, parent2_email, parent2_whatsapp, parent2_language`. Only `student_email` is required. A template with the headers and one example row can be downloaded; the columns are explained on screen in English and Arabic.

Available in two places:

- **Bulk invite** — replaces typing student emails one by one. The parents travel with each invitation (§6.1).
- **"Import parents"** for existing students — rows are matched to this workspace's learners by student email.

Both show a **preview before anything is saved**. Each row is either OK or shows its problem:

| Problem | Meaning |
|---|---|
| studentEmailMissing / studentEmailInvalid | No usable student email |
| studentNotFound | (Import) no learner with this email in the workspace |
| duplicateStudent | The student appears twice in the file |
| parentNameMissing / parentEmailInvalid | A parent's details are incomplete |
| parentLanguageInvalid | Language other than ar/en (Arabic/English words are accepted) |
| parentPhoneInvalid | WhatsApp number with fewer than 7 or more than 15 digits |
| duplicateParent | The same parent twice on one row |
| tooManyParents | More than 2 parents for this student, counting those they already have |

The tutor fixes rows in the file and uploads again, or leaves them out, then confirms. Re-importing the same file creates no duplicates: a parent the learner already has (same student + parent email) is **updated**, not added. Limits: 500 rows, 1 MB.

## 6.4 Joining by link, QR code or join request

No parent step. The learner or the tutor adds parents afterwards.

---

# 7. Consent and Links

- When a contact is created (or re-invited, or its email changes) the parent gets **one** email: who the academy is, what it would send, and a "Yes, send me updates" button. Nothing else is sent until they confirm.
- Every report carries a **one-click unsubscribe** link.
- Links are signed, single-purpose tokens. A confirm link can't unsubscribe, an unsubscribe link can't confirm, and neither works for another contact. A confirmation link also names its confirmation round, so a newer one retires it.
- The link pages need no login and show in the parent's email language (unless the browser already has a language chosen), in Arabic right-to-left.
- Link tokens are never written to analytics or logs.

---

# 8. When Reports Are Sent

The academy switches reporting on in **Workspace settings**. Both switches are **off by default** and independent:

1. "Email parents after each marked assignment or quiz"
2. "Email parents a monthly summary"

| Report | Trigger |
|---|---|
| Assignment result | Only when the tutor **issues the result** (the evaluation is saved). Never before the tutor's decision. |
| Quiz result | When the learner's attempt is **graded** (lesson questions, lesson quiz, adaptive quiz). A later grade override by the tutor sends nothing in Version 1. |
| Monthly summary | On the **1st of each month, Africa/Cairo time**, covering the previous calendar month. The 2nd and 3rd are a catch-up window if the service was down on the 1st. Learners with no activity that month are skipped. |

Delivery rules:

- An email is sent only **after** the action it reports has been saved, so a failed save never emails a parent.
- A failed email never fails the tutor's or learner's action. It is logged and recorded.
- The same report is never sent twice to the same parent (§11).
- No plan gating and no AI credits: reports are free on every plan.

---

# 9. What a Report Contains

Short, friendly, no marketing, and **no links into the app**.

## Assignment or quiz result

- The learner's **first name**, the activity title and the course.
- The result: pass/fail (or "Reviewed") for assignments; score % and pass/fail for quizzes.
- For assignments, the tutor's feedback **as written**, trimmed to about 300 characters.
- Quizzes carry no feedback text in Version 1: what the learner is shown after a quiz is a generated score line (not something a tutor or the AI wrote), and the score is already in the email.

## Monthly summary

- Assignments completed (counted in the month their result was issued) and quizzes completed (graded that month).
- Missed: assignments due that month, still visible to the learner, with no response.
- Average quiz score, and the change from the previous month (in points).
- The activity with the lowest result: a "Not passed" assignment, otherwise the lowest quiz score.
- A learner has **activity** in a month when something was completed or missed. Otherwise no summary.

## Always

| Rule | Description |
|---|---|
| PR-010 | Never include another learner's data, class rankings or comparisons. |
| PR-011 | The email is from the academy: "{Academy} via Teach Tandem" as the sender name, the academy in the signature, replies to the academy owner. Footer: "Sent via Teach Tandem" plus the unsubscribe link. |
| PR-012 | The email chrome is in the parent's preferred language; activity titles and feedback are shown exactly as the tutor wrote them. Arabic emails are right-to-left. |

---

# 10. Roles and Permissions

| Who | May |
|---|---|
| Owner, Administrator | Add, edit, resend, remove any learner's parents; import; switch reports on/off |
| Teacher, Assistant teacher | See parent contacts |
| Learner | Add and remove their own parents only |
| Parent | Confirm or unsubscribe through their own email links |
| Another workspace | Nothing — contacts are invisible outside their workspace |

---

# 11. Send Log

Every message sent or attempted is recorded: contact, learner, kind (confirmation, assignment result, quiz result, monthly summary), what it was about (the submission, or the month), channel, time and whether it was delivered.

- A record for the same contact, kind and subject means "already sent" — so no report goes out twice, and re-running the monthly job sends nothing new.
- The channel field is "email" in Version 1. The WhatsApp add-on will count against the same log.

---

# 12. Business Decisions

| Id | Decision |
|---|---|
| BA-001 | Parents are contacts, not users. A parent login is future work and will use `WorkspaceRoleName.Parent`. |
| BA-002 | Email first, on every plan. WhatsApp later, as a paid add-on; the number is collected now. |
| BA-003 | Consent before any report, with a 14-day window and one-click unsubscribe. |
| BA-004 | Off by default; the academy decides, with separate switches for results and the monthly summary. |
| BA-005 | Invitation parents wait with the invitation and are contacted only after the student accepts. |
| BA-006 | No second email on a grade override in Version 1. |
| BA-007 | Monthly summaries follow the Cairo calendar month. |
