# Learning Workspace Architecture Gap Review

> Version: 1.0
>
> Status: Draft
>
> Domain: Documentation Governance
>
> Author: Business Analysis Team
>
> Related Documents:
>
> - Platform Aggregate Catalogue
> - Learning Workspace Bounded Context Map
> - Learning Workspace Bounded Context Identification
> - Assessment and Submission Aggregate Design
> - Every Aggregate Design and Context document listed in the register below

---

# 1. Purpose

Nine documents in this corpus — AI Collaboration Session, Certificate, Discussion Thread, Enrollment, Identity, Learning Product, Membership, and Workspace Aggregate Designs, plus Lesson Revision Aggregate Design's v1.1 revision — each credit their authorship to closing a gap identified by "the Learning Workspace Architecture Gap Review," without that review itself existing as a document. This document is that review, supplied retroactively.

Its purpose going forward is narrower than its origin: to be the single place where every documentation gap discovered in this corpus — whether a missing Aggregate Design, a missing Context document, a terminology collision, or a broken cross-reference — is logged, tracked to resolution, and, where still open, stated plainly rather than left as a scattered trail of citations in other documents' front matter.

---

# 2. Method

A gap is logged here when a document in the corpus is referenced by name (and, where applicable, by section number) by one or more other documents, but does not itself exist, or exists only as a subsection of a broader document where the corpus's own conventions call for a standalone one (compare, for example, the standalone Context documents that exist for Learning Product, Learning Delivery, Assessment, Commerce, Communication, and Scheduling against contexts that have only a Bounded Context Map subsection).

Each entry records: what was missing, how it was discovered, what depended on it, its resolution, and — for anything not yet resolved — what closing it would require.

---

# 3. Gap Register

| # | Gap | Type | Depended On By | Status |
|---|---|---|---|---|
| 1 | Identity Aggregate Design | Aggregate Design | Platform Aggregate Catalogue; every aggregate referencing Identity | Resolved — Identity Aggregate Design |
| 2 | Workspace Aggregate Design | Aggregate Design | Every aggregate in the primary dependency chain | Resolved — Workspace Aggregate Design |
| 3 | Membership Aggregate Design | Aggregate Design | Enrollment, Assessment, Learning Delivery, Discussion Thread | Resolved — Membership Aggregate Design |
| 4 | Certificate Aggregate Design (and Certification Context — see #9) | Aggregate Design | Assessment Context (Section 4.7); Identity & Workspace Access Architecture | Resolved (Aggregate Design) — Certificate Aggregate Design |
| 5 | Discussion Thread Aggregate Design (and Community Context — see #8) | Aggregate Design | Platform Aggregate Catalogue; Bounded Context Map (Section 5.16) | Resolved (Aggregate Design) — Discussion Thread Aggregate Design |
| 6 | AI Collaboration Session Aggregate Design | Aggregate Design | AI Context; every domain AI Collaboration Session references | Resolved — AI Collaboration Session Aggregate Design |
| 7 | Enrollment Context / Enrollment Aggregate Design | Bounded Context + Aggregate Design | Membership, Assignment, Assessment, Learning Delivery | Resolved — Bounded Context Map, Section 5.4, plus Enrollment Aggregate Design |
| 8 | Community Context (business-analysis-level) | Bounded Context | Discussion Thread Aggregate Design, explicitly | Resolved — Community Context |
| 9 | Certification Context (business-analysis-level) | Bounded Context | Certificate Aggregate Design, explicitly | Resolved — Certification Context |
| 10 | Assessment and Submission Aggregate Design | Aggregate Design | Certificate, Bounded Context Map, Discussion Thread, Workspace, Membership, Identity, AI Collaboration Session Aggregate Designs (14+ citations) | Resolved — Assessment and Submission Aggregate Design |
| 11 | Analytics Context (business-analysis-level) | Bounded Context | Bounded Context Map (Section 5.13); Domain Event Model; Workspace Context | Resolved — Analytics Context |
| 12 | Learning Activity as a formal Entity of Lesson Revision | Entity omission | Learning Activity Assignment Business Analysis referenced it; Lesson Revision Aggregate Design did not list it | Resolved — Lesson Revision Aggregate Design, v1.1 |
| 13 | "Assignment" / "Graded Task" naming collision | Terminology | Assessment Context's Assessment Types list vs. Assignment Business Analysis's Assignment concept | Resolved — Assessment Context, v1.1 |
| 14 | "Tutor" / "Workspace Owner" naming preference | Terminology | Bounded Context Map's former "Tutor Workspace Experience Context" | Resolved — Bounded Context Map, v1.4 |
| 15 | "Assessment Attempt" / "Submission" naming | Terminology | Assessment Context (Section 4.3) vs. Platform Aggregate Catalogue (Section 3, 6) | Resolved — Assessment and Submission Aggregate Design, Section 2 |
| 16 | Submission & Evaluation Business Analysis | Business Analysis | Referenced as "(Future)" in Learning Progress Tracking Business Analysis, Section header | Open — see Section 5 |

Entries 1–15 are resolved as of this review. Entry 16 remains open.

---

# 4. Resolved Gaps — Notes

## Aggregate Design gaps (1–6, 10)

Six Aggregate Roots from the Platform Aggregate Catalogue — Identity, Workspace, Membership, Certificate, Discussion Thread, and AI Collaboration Session — were, for a period, referenced constantly throughout the corpus without dedicated Aggregate Design documents of their own. Each was closed individually, and each closing document referenced this review and, in most cases, Assessment and Submission Aggregate Design's Section 17, as the place the gap was tracked. That created a second-order gap (entry 10): the tracking reference itself, Assessment and Submission Aggregate Design, did not exist. It has now been authored, and its own Section 17 records this same gap list as its "Summary," closing the citation loop from both directions.

## Bounded Context gaps (7, 8, 9, 11)

Four bounded contexts — Enrollment, Community, Certification, and Analytics — existed in the Bounded Context Map and/or Bounded Context Identification only as short subsections (Purpose / Owns / Business Question / Does Not Own), while comparably-scoped contexts (Learning Product, Learning Delivery, Assessment, Commerce, Communication, Scheduling) each received a full standalone Context document. Enrollment's case was judged sufficient without a standalone document because its companion Aggregate Design already covers the ground a Context document normally would, in more depth than most of the corpus's dedicated Context documents (see Enrollment Aggregate Design's 19 sections against, for example, Scheduling Context's shorter treatment). Community, Certification, and Analytics did not have that same offsetting depth anywhere else in the corpus, and have each now received a standalone Context document.

## Entity and terminology gaps (12–15)

These are smaller in scope but follow the same pattern as the larger gaps above: a concept used in one document was not fully reflected in the document that was supposed to be its source of truth. Each was resolved by either adding the missing material (Learning Activity) or by explicitly naming and reconciling the collision (Assignment/Graded Task, Tutor/Workspace Owner, Assessment Attempt/Submission) rather than silently picking one term and leaving the other dangling.

---

# 5. Open Gap

## Submission & Evaluation Business Analysis

Learning Progress Tracking Business Analysis lists "Submission & Evaluation Business Analysis" as a related document marked "(Future)." Assessment and Submission Aggregate Design (this review's entry 10) now supplies the aggregate-level specification for Submission, but a dedicated **business-analysis-level** treatment — in the style of Assignment Business Analysis or Learning Activity Assignment Business Analysis, covering business rules, stakeholder workflows, and open business questions rather than aggregate structure — has not been written. Whether it is still needed is itself an open question: Assessment Context already carries most business-analysis-level material for Assessment and Submission (Section 4.3, 4.4, 7, Rules 1–4), and it is possible that Assessment and Submission Aggregate Design's Sections 1–3 and 10–11 now cover the remaining gap well enough that a separate Business Analysis document would be redundant rather than necessary. This review recommends deferring a decision until a concrete business question arises that neither existing document answers, rather than authoring a document speculatively.

---

# 6. Governance Going Forward

To prevent this pattern from recurring silently:

- A document should not cite another document by name and section number before that document exists. Where a future document anticipates a dependency that does not yet exist, it should say so explicitly (as, for example, Learning Progress Tracking Business Analysis correctly marked its Submission & Evaluation reference "(Future)" rather than citing it as settled).
- When a document is added specifically to close a gap, its front matter should continue to note that provenance (as the six Aggregate Design documents in Section 4 already do), and this review's Gap Register (Section 3) should be updated in the same pass.
- Bounded contexts that appear in the Bounded Context Map or Bounded Context Identification should be treated as documentation debt, not merely acknowledged, whenever another document explicitly states that the context "has never received business-analysis-level documentation" — as Certificate Aggregate Design and Discussion Thread Aggregate Design each did before Certification Context and Community Context were written.

---

# Summary

Of sixteen gaps identified across this corpus, fifteen are now resolved, including the two most heavily cross-referenced documents in the entire corpus — Assessment and Submission Aggregate Design and this review itself. One gap, a dedicated Submission & Evaluation Business Analysis document, remains open by recommendation rather than oversight: existing documents already cover its likely content, and authoring it speculatively would risk creating the same kind of unmoored cross-reference this review exists to prevent.
