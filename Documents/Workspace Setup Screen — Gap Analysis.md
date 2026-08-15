# Workspace Setup Screen — Gap Analysis

> Version: 1.0
>
> Status: Draft
>
> Domain: Workspace Management
>
> Document Type: Gap Analysis (Business Analysis vs. Implementation)
>
> Author: Business Analysis Team
>
> Scope: `frontend/src/screens/WorkspaceSetupScreen.jsx` (last modified 2026-08-09) against
> Workspace Setup Business Analysis v1.0 (last modified 2026-08-05)
>
> Related Documents:
>
> - Workspace Setup Business Analysis
> - Workspace Aggregate Design
> - Learning Workspace Experience Architecture
> - Technical Debt Backlog (TD-006, TD-009)

---

## 1. Purpose

Workspace Setup Business Analysis specifies what an Owner must be able to do to take a
Workspace from `Created` to `Active`. `WorkspaceSetupScreen.jsx` is the tutor-facing
surface built to realise that specification (closing TD-009). This document checks the
built screen against the specification line by line, records what matches, what is
missing, and — where a gap already has a known cause — points at the Technical Debt
Backlog entry that explains it rather than re-raising it as new.

## 2. Method

Each requirement in Workspace Setup Business Analysis §3 (Business Objectives) and §8
(Configuration) was checked against the component's rendered sections and the fields the
`IdentityForm` submits. Findings are marked Implemented, Partial, or Missing, with the
originating spec section and, where relevant, the Technical Debt Backlog entry that
already accounts for the gap.

## 3. Findings Summary

| Spec requirement | Section | Status | Backlog cross-reference |
|---|---|---|---|
| Lifecycle transitions, strictly ordered | §7, BA-004 | Implemented | TD-009 (Done) |
| Owner-declared `Activate` | BA-002 | Implemented | TD-009 (Done) |
| Workspace Identity — name, public identifier | §8 | Implemented | — |
| Workspace Identity — description | §8 | Implemented | — |
| Workspace Identity — contact information | §8 | Missing | Not covered by TD-006 |
| Workspace Identity — visibility setting | §8 | Missing | TD-006 |
| Workspace Configuration — language, timezone, regional, pacing | §8 | Missing | TD-006 |
| Branding Configuration | §8 | Missing | TD-006 |
| Enabled Capabilities selection | §3, §8 | Missing | TD-006 |
| Entry Point (implicit-subdomain) addressability note | BA-003 | Implemented | TD-009 (Done) |
| Setup Completeness, derived not stored | BA-005 | Implemented | — |
| Readiness Checklist presentation | §4 | Partial | Not covered by any TD (see §6 below) |
| Join Requests toggle + QR code | not in spec | Undocumented | Not covered by any TD (see §7 below) |

## 4. Implemented, matches spec

**Lifecycle stepper.** The five-state journey (`Created` → `Configuring` → `Private` →
`Published` → `Active`) renders in order and the screen never re-derives which
transition is next — it renders whatever `nextTransition` the API returns. This matches
BA-004: the lifecycle is strictly ordered and the client does not attempt to skip
`Private`.

**`Activate` as a distinct, Owner-driven action.** `Published` and `Active` are separate
steps with separate actions, consistent with BA-002's ruling that `Published → Active`
is Owner-declared rather than automatic.

**Identity — name, public identifier, description.** All three are editable via
`IdentityForm` and displayed read-only otherwise, matching the mandatory-before-publication
half of §8.

**Derived completeness.** The screen holds no local "is this ready" flag — it renders
`setup.nextTransition` and `setup.blocker` as returned by the server on every load and
after every action, consistent with BA-005 (Setup Completeness is derived, never stored).

**Implicit Entry Point note.** The discoverability note tied to `Published`/`Active`
status matches BA-003's stopgap: the Public Identifier stands in for a registered Entry
Point until the Entry Point Registry (TD-006) exists.

## 5. Missing, already accounted for by TD-006

Workspace Configuration (language, timezone, regional settings, pacing defaults),
Branding Configuration (logo, theme, colour tokens, typography), Enabled Capabilities,
and Workspace Identity's Visibility Setting are all absent from the screen. This is not a
new finding — Technical Debt Backlog TD-006 already records that these were deliberately
left off the `Workspace` aggregate itself when it was built, so no UI could have exposed
them yet.

**What this document adds:** TD-006 is scoped to `Platform.Domain` — the aggregate. It
does not currently note that the gap is full-stack: even once those fields exist on the
aggregate, `WorkspaceSetupScreen.jsx` has no sections for them today, so a future pass on
TD-006 has front-end work to do as well as domain work. Worth a one-line addition to
TD-006's Area field, or a linked frontend-specific entry, so the trigger conditions
(custom domains, capability tiering, theming) are understood to unblock UI work too, not
just the domain model.

**Contact information** is the one §8 field TD-006 does not mention at all — it lists
"Workspace Identity's Contact Information and Visibility Setting" together as omitted
from the aggregate, so this is in fact covered, just worth flagging explicitly since it's
easy to miss inside a combined bullet.

## 6. Partial: Readiness Checklist

§4 defines the Readiness Checklist as "the Owner-facing presentation of Setup
Completeness — what is done, what remains," explicitly owned by Learning Workspace
Experience Architecture, "referenced here so that this document specifies *what must be
true*, not how it is displayed."

`Learning Workspace Experience Architecture.md` does not mention a Readiness Checklist,
or any checklist, anywhere in its current text. The concept is referenced by Workspace
Setup Business Analysis as being defined elsewhere, but nowhere actually defines it.

The screen's stepper is not a substitute for this — it shows lifecycle *state* (which of
the five stages the Workspace is in), not setup *completeness* (which specific fields or
conditions are outstanding within the current stage). The only completeness signal
surfaced today is the single `blocker` string returned by the API when there is no
available next transition.

This is a documentation gap one level up from the screen: the screen cannot be checked
against a Readiness Checklist spec that does not exist yet. Recommend raising this against
Learning Workspace Experience Architecture directly rather than against the screen.

## 7. Undocumented: Join Requests toggle and QR code

The screen includes an `acceptsJoinRequests` toggle and a QR code linking to
`/join/{slug}`. Neither appears in Workspace Setup Business Analysis. `AcceptsJoinRequests`
is a real, implemented field (present in the EF model and migrations), so this is not
speculative or dead code — it is genuine, shipped functionality that predates or sits
outside this document's scope.

§5 of Workspace Setup Business Analysis explicitly excludes "Membership management inside
the Workspace — invitations, roles, member lifecycle," attributing that territory to
Membership Aggregate Design and Workspace_Access_Context. Whether a join-requests-open/closed
policy flag counts as "membership management" (out of scope) or as a Workspace-level policy
setting analogous to Visibility (in scope, just not yet written up) is genuinely ambiguous
from the text — it is not a clear violation, but it is not covered either.

**Recommendation:** confirm with the domain owner which document this belongs to, then add
it explicitly — either as a new subsection of Workspace Setup Business Analysis §8, or as a
cross-reference from Join Request Business Analysis. Leaving it unassigned means the next
reader of either document will not know this screen surfaces it.

## 8. Recommendations

1. Treat §5 (Workspace Configuration, Branding, Capabilities, Visibility) as still blocked
   on TD-006, not as a new defect — but extend TD-006's scope note to cover the frontend
   surface, not just the aggregate.
2. Raise a documentation gap against Learning Workspace Experience Architecture: define the
   Readiness Checklist it is already cited as owning.
3. Get an explicit ruling on where the Join Requests toggle's business rules belong, and
   document it there.
4. No action needed on the lifecycle stepper, Identity (name/slug/description), or the
   Activate/Entry-Point behaviour — all three match the specification as written.

These are recommendations only; no changes have been made to the Technical Debt Backlog or
any Business Analysis document. Say the word and I can turn items 1–3 into new or amended
Technical Debt Backlog entries in the same format as TD-001 through TD-018.

---

## Summary

Most of what's missing from `WorkspaceSetupScreen.jsx` against the Business Analysis is not
a build defect — it's the already-acknowledged TD-006 scope reduction showing up on the
frontend the same way it already shows up on the domain model. The two findings that are
new here are that the Readiness Checklist concept is referenced but never actually defined
anywhere in the corpus, and that the Join Requests toggle is real, shipped functionality
with no document claiming ownership of its rules.
