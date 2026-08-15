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
> Scope: `frontend/src/screens/WorkspaceSetupScreen.jsx` (last modified 2026-08-15) against
> Workspace Setup Business Analysis v1.0 (last modified 2026-08-15) and Learning Workspace
> Experience Architecture §18 (added 2026-08-15)
>
> Related Documents:
>
> - Workspace Setup Business Analysis
> - Workspace Aggregate Design
> - Learning Workspace Experience Architecture
> - Join Request Business Analysis
> - Technical Debt Backlog (TD-006, TD-009, TD-019, TD-020)

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
| Readiness Checklist presentation | §4, Experience §18 | Implemented | TD-019 (Done — see §6 below) |
| Join Requests toggle + QR code | §8, Join Request BA-008 | Documented and implemented | TD-020 (Done — see §7 below) |
| Public Identifier change warning on a Published/Active workspace | §16 (open question) | Partial — UI mitigation only | Not a Backlog entry; §16 itself is still open (see §8 below) |

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

## 6. Resolved: Readiness Checklist (was Partial)

*(Updated 2026-08-15, same day as the original finding.)* §4 defines the Readiness
Checklist as "the Owner-facing presentation of Setup Completeness — what is done, what
remains," explicitly owned by Learning Workspace Experience Architecture. At the time
this document was first drafted, that document did not define it — TD-019 was raised
for exactly that gap.

Both halves are now closed. Learning Workspace Experience Architecture §18 ("Owner
Setup Experience") defines the checklist as three groups — **Blocking** (workspace
name, public web address), **Addressable** (satisfied automatically today via BA-003's
implicit Entry Point, shown so the Owner understands why), and **Suggested, never
blocking** (description, language/timezone/regional settings, branding, enabled
capabilities) — plus a Presentation Principle that Suggested items never read as errors.

`WorkspaceSetupScreen.jsx` now implements this directly: a `Readiness` component renders
the same three groups, reading `WorkspaceSetupResponse.Completeness` (already returned by
the API — no backend change needed). The three Suggested items with nothing to toggle yet
(TD-006: language/timezone/regional, branding, capabilities) render with a muted dash and
a "not built yet" badge rather than an empty circle, so they read as unavailable rather
than as the Owner's unfinished business — matching §18's Presentation Principle. The
stepper still shows lifecycle *state* as before; the Readiness Checklist now sits
alongside it showing setup *completeness*, which is the distinction §4 draws.

## 7. Resolved: Join Requests toggle and QR code (was Undocumented)

*(Updated 2026-08-15, same day as the original finding.)* The screen includes an
`acceptsJoinRequests` toggle and a QR code linking to `/join/{slug}`. At the time this
document was first drafted, neither Workspace Setup Business Analysis nor Join Request
Business Analysis assigned an owner to the toggle's rules — TD-020 was raised for that gap.

Join Request Business Analysis gained BA-008: authority is Owner-or-Administrator (the
same Workspace Setup authority as everything else on this screen, BA-001), and toggling
the setting never affects a Join Request already `Submitted` — it only gates new
submissions. Workspace Setup Business Analysis §8 gained a matching "Accepting Join
Requests" note pointing back at BA-008 as the owning document. The toggle's actual
behaviour needed no code change to match BA-008 — `JoinRequestService` already did
nothing beyond the submission-time check BA-008 confirms is the only intended effect.

One real gap did survive from the original finding: the toggle previously gave no
confirmation on click, unlike every lifecycle action on this screen. It now shows a
success toast ("Now open to join requests." / "Closed to join requests.") on the same
`act()` path the other actions use.

## 8. New since original analysis: Public Identifier change warning

*(Added 2026-08-15, same day as the original analysis.)* §16 records "Changing a Public
Identifier after publication" as an open question: existing invitation links and any
external references resolve through the identifier, and whether a change should be
forbidden, redirected, or permitted destructively is unspecified.

The screen previously let an Owner retype the Public Identifier of a Published or Active
workspace with no more friction than editing the description — the only nearby signal was
a general discoverability note (`/{slug}` is discoverable) rendered below the form
regardless of what was being edited, not a warning tied to the act of changing it.

`IdentityForm` now compares the typed value against the saved slug and, only when the
workspace is already Published or Active and the two differ, renders an inline warning
directly under the Public Identifier field naming the concrete consequence (invitations,
bookmarks, anything already shared stop resolving once saved).

This is scoped deliberately as a **warning, not a rule**: the form still permits the save.
§16 asks whether the platform should forbid, redirect, or permit the change; this addition
answers none of those — it only ensures the Owner sees the risk at the moment they'd cause
it, instead of finding out after the fact. §16 stays open (see Recommendation 6, next).

## 9. Recommendations

1. ~~Treat §5 (Workspace Configuration, Branding, Capabilities, Visibility) as still
   blocked on TD-006, not as a new defect — but extend TD-006's scope note to cover the
   frontend surface, not just the aggregate.~~ **Done** — TD-006 amended 2026-08-15 to
   record the frontend gap alongside the aggregate gap.
2. ~~Raise a documentation gap against Learning Workspace Experience Architecture: define
   the Readiness Checklist it is already cited as owning.~~ **Done** — TD-019 raised and
   closed the same day; §18 defines it; the screen now implements it (§6, above).
3. ~~Get an explicit ruling on where the Join Requests toggle's business rules belong, and
   document it there.~~ **Done** — TD-020 raised and closed the same day; BA-008 owns it
   (§7, above).
4. No action needed on the lifecycle stepper, Identity (name/slug/description), or the
   Activate/Entry-Point behaviour — all three match the specification as written.
5. **Still open:** Contact Information and Visibility Setting (§8's two remaining Identity
   fields) stay genuinely missing — TD-006 names both, no change here. Not worth a
   dedicated screen section on their own; revisit alongside whatever unblocks TD-006 more
   broadly.
6. **Still open:** §16's "Changing a Public Identifier after publication" question is not
   resolved by the new slug-change warning added 2026-08-15 (§8, above) — that warning
   only makes the *existing*, silently-permitted risk visible at the point of editing. It
   does not decide whether the change should instead be forbidden, redirected, or left as
   is. §16 should stay open until that ruling happens; the warning is a stopgap, not
   evidence the question is settled.

---

## Summary

*(Updated 2026-08-15, same day as the original analysis.)* At first draft, most of what
was missing from `WorkspaceSetupScreen.jsx` against the Business Analysis was not a build
defect — it was the already-acknowledged TD-006 scope reduction showing up on the frontend
the same way it already showed up on the domain model. That's still true for Configuration,
Branding, Capabilities, Contact Information and Visibility — all five remain out of scope
until TD-006 moves.

The two findings that were new to this document — the Readiness Checklist referenced but
never defined, and the Join Requests toggle shipped with no document claiming ownership of
its rules — are now both resolved, in documentation (TD-019, TD-020) and in the screen
itself (the `Readiness` component; the join-requests success toast). One genuinely new
surface was added in the same pass and is *not* fully resolved: a slug-change warning
mitigates, but does not settle, §16's still-open question about changing a Public
Identifier after publication.
