# Assignment AI Assistance & Subscription Gating

> Version: 1.0
>
> Status: Draft / Proposed
>
> Domain: Learning Delivery × Commercial (Cross-Context)
>
> Document Type: Business Analysis (closes a cross-context gap)
>
> Author: Business Analysis Team
>
> Purpose of this document: Assignment Business Analysis (BA-006), Assignment Aggregate Design (INV-008), and Learning Activity Assignment Business Analysis (§11, BA-006) all state that **AI assists the tutor during Assignment creation and evaluation, but never publishes an Assignment or finalizes a grade on its own.** Separately, Commercial Product Management Architecture (§16–21) and the AI Product Packaging / AI Commercial Runtime architectures define **how** any AI capability is licensed, leveled, metered, and authorized at runtime. No document has yet connected the two: which specific tutor-facing AI moments in Assignment creation and Submission evaluation exist, what capability and level each one requires, and how that is enforced without contradicting the domain's own "AI never publishes" invariant. This document is that connection. It defines no new Assignment or Submission behavior — it makes the existing "AI assists, following the subscription plan" language operational.
>
> Related Documents:
>
> - Assignment Business Analysis (v1.3)
> - Assignment Aggregate Design (v1.1)
> - Learning Activity Assignment Business Analysis (v1.3)
> - Assessment and Submission Aggregate Design (v1.1)
> - Assessment Context
> - CommercialProductManagementArchitecture.md
> - LicensingAndEntitlementArchitecture.md
> - AIProductPackagingArchitecture.md
> - AICommercialRuntimeArchitecture.md
> - Commercial Domain Decision Brief (v1.1)

---

# 1. Business Vision

A tutor building an Assignment for a lesson should feel the same AI collaborator throughout the whole delivery flow — from setting a submission window to reviewing a stack of student responses — and that collaborator should get visibly more capable as the workspace's subscription plan goes up, without ever being able to do the two things a tutor never delegates: **publishing the Assignment** and **issuing the final grade**.

This document specifies, for the Assignment delivery flow specifically:

- what the tutor and student each do, end to end (Section 2 — this is settled elsewhere; restated here only as the spine AI attaches to);
- every point where AI may assist (Section 3);
- which subscription plan / capability level unlocks which AI behavior at each point (Sections 4–6);
- how that is enforced at runtime without the Assignment or Submission aggregates ever knowing about plans (Section 7);
- the one rule that holds regardless of plan (Section 8).

---

# 2. The End-to-End Flow This Document Attaches To

This is not new — it is the flow already specified across Assignment Business Analysis §7, Learning Activity Assignment Business Analysis §6 and §9–10, and Assessment and Submission Aggregate Design §14, restated here as one continuous narrative because AI touches nearly every step of it.

```text
Tutor authors a Lesson Revision, containing a Learning Activity
        │
        ▼
Tutor creates the Assignment delivering that Learning Activity
        │  (targets learners from active Enrollments; configures
        │   Availability, Due Date, Submission Window start/end,
        │   Attempt Policy, Evaluation Policy, Notifications)
        ▼
Tutor saves Draft → Publishes (Scheduled or Immediate)
        │
        ▼
Students receive the Assignment once Published/Active
        │
        ▼
STUDENT SIDE                              TUTOR SIDE
Start work (In Progress)                  Sees "N submissions received"
Submit within the Submission Window       Opens a Submission → Under Review
Receive Return-for-Resubmission           Evaluates: grade/feedback/pass-fail
  if sent back                            Issues Result → student notified
        │                                        │
        ▼                                        ▼
        Assignment Completed for that learner (Progress Tracking notified)
```

The Submission Window's **start date and end date** (Assignment Business Analysis §8, Assignment Aggregate Design §7's Submission Window value object) is what makes an Assignment concrete for a specific lesson delivery: it is set once per Assignment, applies to every targeted learner in V1 (Assignment BA-007), and is the boundary Submission's own INV-002 checks before accepting a `RecordAssignmentResponse` or `StartSubmission` command.

---

# 3. Where AI Assists — the Touchpoint Catalogue

Every row below already exists as a bullet in Assignment Business Analysis §6 ("AI Assistant may assist tutors by...") or Learning Activity Assignment Business Analysis §11 ("AI Opportunities"). This section is the first place they are collected against a concrete Skill and a concrete Assignment/Submission field.

## 3.1 Tutor side — Assignment creation & configuration

| # | AI Touchpoint (source) | Acts on | AI Skill |
|---|---|---|---|
| T1 | "Suggesting due dates" (Assignment BA §6; LAA-BA §11 Planning) | Due Date Policy | `SuggestAssignmentDueDate` |
| T2 | "Estimating workload" / "Estimate completion time" (Assignment BA §6; LAA-BA §11) | Submission Window sizing | `EstimateAssignmentWorkload` |
| T3 | "Recommending submission policies" (Assignment BA §6) | Attempt Policy, Submission Policy | `RecommendSubmissionPolicy` |
| T4 | "Recommending evaluation strategies" (Assignment BA §6) | Evaluation Policy (Automatic/Manual/AI-Assisted/Hybrid) | `RecommendEvaluationPolicy` |
| T5 | "Recommend activity difficulty" / "prerequisite knowledge" (LAA-BA §11 Planning) | Targeting guidance (not a stored field — advisory only) | `RecommendAssignmentDifficulty` |

## 3.2 Tutor side — Reviewing & evaluating Submissions

| # | AI Touchpoint (source) | Acts on | AI Skill |
|---|---|---|---|
| E1 | "Suggest grades" (LAA-BA §11 Evaluation) | Submission → Evaluation → Grade (draft only) | `SuggestSubmissionGrade` |
| E2 | "Draft personalized feedback" (LAA-BA §11 Evaluation; Assignment BA §6 style) | Evaluation.Feedback text | `DraftSubmissionFeedback` |
| E3 | "Recommend remediation activities" (LAA-BA §11 Evaluation) | Advisory, feeds Progress Tracking / future Learning Path | `RecommendRemediation` |
| E4 | "Detect plagiarism" / "Detect AI-generated submissions" (LAA-BA §11 Evaluation — **both explicitly Future**) | Not built — listed for completeness only | *(Future)* |

## 3.3 Student side

Learning Activity Assignment Business Analysis §5 and Assessment and Submission Aggregate Design's Commands do **not** name an AI-facing action on the student side of Submission itself — a student's `RecordAssignmentResponse` is authored by the student. Where the underlying Learning Activity type is itself an "AI Practice Session" or similar (Learning Activity Assignment BA §7), AI's role there belongs to that Learning Activity's own authoring/runtime behavior, not to Assignment or Submission — out of scope for this document.

---

# 4. Mapping Touchpoints to the Commercial Model

CommercialProductManagementArchitecture §11 already places **Assignment Authoring** inside the **Assessment** capability domain, alongside Quiz Authoring, Exam Authoring, Question Bank, Automated Grading, Rubrics, Feedback, and Assessment Analytics. §14's Capability Matrix marks Assignment Authoring **✓ on every tier, Essential through Academy** — creating and configuring an Assignment manually is core teaching functionality per §15's principle and is never plan-gated. What *is* plan-gated is the AI layer on top of it, exactly as §18 states: *"AI Is Not One Commercial Capability."* This document treats the touchpoints in Section 3 as two new named AI capabilities inside the Assessment domain, following the same shape as the existing "Assessment Feedback" row in §17's AI Capability Matrix:

## 4.1 New AI Capability: Assignment Planning AI
Covers T1–T5.

| Level | Essential | Professional | AI+ | Studio | Academy |
|---|:---:|:---:|:---:|:---:|:---:|
| Assignment Planning AI | Manual | Assist | Co-Pilot | Co-Pilot | Co-Pilot |

- **Manual** (Essential): the tutor sees no suggestions; every field in Section 3.1 is set by hand. This is the same "no AI involvement" definition as §16's Manual level and is consistent with Assignment Authoring itself remaining fully available.
- **Assist** (Professional): AI drafts a suggested value for each field (a due date, an attempt count, an evaluation method) that the tutor accepts, edits, or ignores — nothing is pre-applied.
- **Co-Pilot** (AI+ and above): AI pre-fills the Assignment configuration form from the Learning Activity's content and the tutor's own history (e.g., typical grading turnaround), still requiring the tutor to review before Save Draft — matching §16's Co-Pilot definition, "AI performs significant work with tutor review."

## 4.2 New AI Capability: Assignment Evaluation AI
Covers E1–E3 (E4 is Future and unlisted).

| Level | Essential | Professional | AI+ | Studio | Academy |
|---|:---:|:---:|:---:|:---:|:---:|
| Assignment Evaluation AI | Manual | Assist | Co-Pilot | Co-Pilot | Co-Pilot |

This mirrors the existing **Assessment Feedback** row already published in §17 (Manual / Assist / Co-Pilot / Co-Pilot / Co-Pilot) rather than inventing a new ladder — Assignment-target Submissions and Assessment-target Submissions already share one Evaluation entity and one set of Evaluation Methods (Assessment and Submission Aggregate Design §7, §10), so their AI assistance should share one commercial ladder too. **Recommendation: Assignment Evaluation AI is not a new row — it is the Assessment Feedback row, extended to explicitly cover Assignment-target Submissions, since both are the same Evaluation entity underneath.**

## 4.3 Capability Pack alignment

Commercial Domain Decision Brief item 3 confirms the **AI Assessment Pack** ships at launch. CommercialProductManagementArchitecture §19–21 already scopes it as "Question generation, grading, rubrics, feedback" with dependency `Assessment Profile >= Professional`. Both new capabilities in 4.1 and 4.2 belong under this same pack:

```text
AI Assessment Pack
│
├── Assessment AI = Co-Pilot            (existing)
├── Assignment Planning AI = Co-Pilot   (new — this document)
├── Assignment Evaluation AI = Co-Pilot (new — this document, = Assessment Feedback)
├── AI Question Generation              (existing)
├── AI Distractor Generation            (existing)
├── AI Feedback                         (existing)
├── AI Grading                          (existing)
└── AI Rubric Suggestions               (existing)
```

A workspace on Solo Essential or Professional without the pack still gets Manual or Assist respectively (Section 4.1–4.2) — the pack's marginal value is jumping straight to Co-Pilot without upgrading the whole Assessment Profile, the same "profile vs. pack" relationship LicensingAndEntitlementArchitecture §225–229 already describes for the Assessment domain generally.

---

# 5. Business Rules

## AIA-001
Assignment Authoring (creating, configuring, scheduling, and publishing an Assignment) is never gated by AI entitlement or plan tier. Only the *AI-assisted* variants of configuration and evaluation (Sections 3.1–3.2) are. A tutor on any plan can always build a complete Assignment by hand.

## AIA-002
Assignment Planning AI and Assignment Evaluation AI are licensed as two Assessment-domain AI capabilities, each independently leveled Manual / Assist / Co-Pilot / Autonomous per CommercialProductManagementArchitecture §16, and each resolved through Licensing's `HasEntitlement(WorkspaceId, Capability, Level)` (AICommercialRuntimeArchitecture §15) — never by inspecting the workspace's plan name or product code directly.

## AIA-003
Assignment Evaluation AI shares its commercial ladder with the existing Assessment Feedback capability rather than being leveled independently, because both gate AI assistance on the same underlying Evaluation entity (Assessment and Submission Aggregate Design §7).

## AIA-004
Every AI Skill in Section 3 is metered against the workspace's AI Credits allowance via Usage Estimation → Usage Reservation → Usage Commit (AICommercialRuntimeArchitecture §19–20, §44–46), exactly like any other AI Skill on the platform. No Assignment-specific metering model is introduced.

## AIA-005
Suggested values from Assignment Planning AI (T1–T5) are advisory until the tutor explicitly accepts them into the Assignment's configuration. No AI suggestion is written to the Assignment aggregate's state on generation alone — this is a Skill-side draft, not a `ConfigureAssignment` command, until the tutor confirms it (consistent with Assignment BA-006: "AI never publishes Assignments automatically," extended here to "AI never configures Assignments automatically" for the same reason).

## AIA-006
Suggested grades and drafted feedback (E1, E2) are held as a proposed Evaluation until a tutor (human Membership) confirms it via `EvaluateSubmission`. This holds at every AI level, including a future Autonomous level — see Section 8.

## AIA-007
If a workspace's Assignment Planning AI or Assignment Evaluation AI entitlement is Manual, or a Usage Reservation fails due to exhausted AI Credits (AICommercialRuntimeArchitecture §22), the tutor's Assignment-creation and Submission-review screens function identically minus the AI suggestion affordance — never an error state. This follows the Commercial Upgrade Experience pattern (AICommercialRuntimeArchitecture §69) rather than blocking core teaching.

---

# 6. Effective Entitlement — Worked Example

Using AIProductPackagingArchitecture §36–37's precedence model, applied to Assignment Evaluation AI:

```text
Workspace: Solo Professional, no AI Assessment Pack
        │
Base Product (Solo Professional):     Assignment Evaluation AI = Assist
Capability Pack:                      none purchased
Support Override:                     none
        │
        ▼
Effective Assignment Evaluation AI = Assist
```

```text
Workspace: Solo Professional + AI Assessment Pack
        │
Base Product (Solo Professional):     Assignment Evaluation AI = Assist
Capability Pack (AI Assessment Pack): Assignment Evaluation AI = Co-Pilot
        │
        ▼
Effective Assignment Evaluation AI = Co-Pilot   (Pack > Base Product, per
                                                  LicensingAndEntitlementArchitecture §271)
```

```text
Workspace: Solo AI+, Support Override active (billing dispute, temporary downgrade)
        │
Base Product (Solo AI+):    Assignment Evaluation AI = Co-Pilot
Support Override:           Assignment Evaluation AI = Manual
        │
        ▼
Effective Assignment Evaluation AI = Manual     (Override wins, per
                                                  LicensingAndEntitlementArchitecture §299–302)
```

---

# 7. Runtime Enforcement

Each Skill in Section 3 follows the standard request lifecycle already defined in AICommercialRuntimeArchitecture, with no Assignment-specific branch:

```text
Tutor action in Assignment/Submission UI
        │
        ▼
AI Gateway receives AI Request
  (Capability = "AssignmentPlanningAI" or "AssignmentEvaluationAI",
   Context = { AssignmentId, LearningActivityId, WorkspaceId, ... })
        │
        ▼
Identity Resolution → Workspace Resolution → Capability Resolution
        │
        ▼
Entitlement Resolution:  HasEntitlement(WorkspaceId, Capability, Level)
        │
   ┌────┴────┐
 Denied     Allowed
   │           │
   ▼           ▼
AIA-007      Usage Availability → Usage Estimation → Usage Reservation
applies            │
                    ▼
              Context Assembly (Learning Context includes Assignment,
              Assessment — AICommercialRuntimeArchitecture §25) —
              context is authorized by Learning Delivery / Assessment
              Context, never assembled by the Skill directly (§24)
                    │
                    ▼
              AI Orchestrator → Skill → Model Router → Provider
                    │
                    ▼
              Usage Commit + AI Result returned as a draft suggestion
                    │
                    ▼
              Tutor reviews → accepts/edits → ordinary domain command
              (ConfigureAssignment / EvaluateSubmission) is issued by
              the tutor's own action, not by the AI Skill
```

The last step is the load-bearing one: the AI Skill never itself calls `ConfigureAssignment`, `PublishAssignment`, or `EvaluateSubmission`. It returns a suggestion; the tutor's UI action is what issues the domain command. This keeps AIA-005/AIA-006 true by construction rather than by a check inside the Assignment or Submission aggregate, which per Assignment Aggregate Design §6 owns no AI-specific state at all.

---

# 8. The One Rule That Never Changes With Plan

Regardless of AI Assistance Level — including a future **Autonomous** level, defined generally by CommercialProductManagementArchitecture §16 as "AI executes approved workflows with configurable oversight" — two Assignment/Submission actions are excluded from autonomous execution by domain invariant, not by commercial configuration:

- **`PublishAssignment`** may never be issued by an AI Skill (Assignment Aggregate Design INV-008; Assignment BA-006).
- **`EvaluateSubmission` → `IssueResult`** (the step that produces a Result Issued Grade, per Assessment and Submission Aggregate Design §14) may never be issued by an AI Skill on the tutor's behalf.

This is deliberately stronger than what Section 16 of the commercial architecture generally allows an Autonomous tier to do. If an "Autonomous" Assignment Planning AI or Assignment Evaluation AI level is ever introduced, its autonomy is scoped to *preparing* a configuration or evaluation completely — up to and excluding the publish/issue action itself, which remains a human command regardless of plan. This should be read as a permanent constraint on how "Autonomous" is defined for these two capabilities specifically, not a Version 1 limitation to be relaxed later.

---

# 9. Future Evolution

- **Rubric-based Assignment Evaluation AI.** Assessment and Submission Aggregate Design §18 already flags Rubric-based evaluation for Assignment-target Submissions as future work; once built, `SuggestSubmissionGrade` would extend to per-criterion suggestions, not just Pass/Fail or Feedback-only.
- **E4 (plagiarism / AI-generation detection).** Both explicitly Future in Learning Activity Assignment Business Analysis §11; would be licensed as its own capability, likely under a distinct Integrity-focused pack rather than folded into Assignment Evaluation AI.
- **Differentiated AI suggestions per cohort**, once differentiated due dates per recipient ship (Assignment Aggregate Design §14, tied to relaxing the 1:1 Learning Activity → Assignment cardinality) — Assignment Planning AI's due-date suggestion would need to reason about multiple recipient groups rather than one uniform date.
- **Parent-facing AI summaries** — Learning Activity Assignment Business Analysis §5 names Parent as a future actor; any AI touchpoint there is out of scope for this document.

---

# Summary

Assignment creation and Submission evaluation already have a settled business design (Assignment Business Analysis, Assignment Aggregate Design, Learning Activity Assignment Business Analysis, Assessment and Submission Aggregate Design) that names AI as a tutor collaborator throughout, and a settled commercial design (CommercialProductManagementArchitecture, LicensingAndEntitlementArchitecture, the AI Product Packaging and AI Commercial Runtime architectures) that defines how any AI capability is leveled, packaged, and metered. This document is the missing bridge between them: it names two new Assessment-domain AI capabilities — Assignment Planning AI and Assignment Evaluation AI — places them on the existing Manual/Assist/Co-Pilot ladder and inside the existing AI Assessment Pack, and shows that enforcing "AI never publishes, AI never issues the final grade" requires no special-casing inside the Assignment or Submission aggregates at all: it falls out of the existing rule that an AI Skill returns a suggestion, and only a tutor's own action ever issues a domain command.
