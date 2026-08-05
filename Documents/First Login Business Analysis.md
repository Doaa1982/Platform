# First Login Business Analysis

> Version: 1.0
>
> Status: Draft
>
> Domain: Identity / Workspace Access (spans both — see Section 14)
>
> Document Type: Business Analysis
>
> Author: Business Analysis Team (drafted to close the gap between Invitation Business Analysis and Workspace Setup Business Analysis — the moment between "Invitation Accepted" and "Owner is looking at Workspace Setup," already built in code with no Business Analysis coverage. See Technical Debt Backlog, TD-014.)
>
> Related Documents:
>
> - Invitation Business Analysis
> - Platform Administrator Business Analysis
> - Workspace Setup Business Analysis
> - Identity Aggregate Design
> - Membership Aggregate Design
> - Workspace_Access_Context (§4.7, Workspace Session)
> - Technical Debt Backlog (TD-014)

---

# 1. Business Vision

Accepting an Invitation should end with the person looking at their new Workspace — not at a login form, not at a blank screen, not at the setup wizard before they've had a chance to arrive.

First Login is the short, easily-overlooked bridge between two already-documented moments: Invitation Business Analysis ends at "Membership Created" (its Section 7.2); Workspace Setup Business Analysis explicitly begins with "an already-authenticated Owner sitting inside the Workspace" (its Section 5: creating the Workspace and transferring ownership is "complete before this document begins"). Nothing between those two sentences was ever written down — even though a real, coherent mechanism for it already exists in code.

---

# 2. Business Problem

Two adjacent documents both stop just short of this territory, and code filled the gap without documentation following it:

- Invitation Business Analysis's Section 7.2 workflow says "Onboarding Request created → Identity Resolution (does this email already own an Identity? reuse it — else `Identity.Create()`)" but never specifies *how* a brand-new Identity acquires a credential. `Identity.Create` requires a `PasswordHash` (Identity Aggregate Design) — something has to supply one, and the document is silent on what.
- Workspace Setup Business Analysis's own Section 5 states plainly that getting the Owner authenticated and into the Workspace is out of its scope and assumed already done.
- Workspace_Access_Context §4.7 defines a **Workspace Session** — "an authenticated Identity actively participating inside one specific Workspace... created only after Identity authentication succeeds and an active Workspace Membership is validated" — and defers its lifecycle to IdentityAndWorkspaceAccess, Section II. No `WorkspaceSession` entity, table, or route exists anywhere in the codebase. What is actually built is simpler and was never reconciled against §4.7.

**What's actually built, observed in code, and undocumented until now:** the Invitation acceptance screen collects a password inline (a new choice for a new Identity, an existing-password check for a returning one); accepting returns an authenticated session immediately, in the same shape ordinary login returns, so no separate login step ever happens; the client auto-selects the sole eligible Workspace when there is exactly one; and a dedicated first-run screen — distinct from Workspace Setup — greets the person by name before anything else. All of this works today. None of it has ever been named as a business concept.

---

# 3. Business Objectives

First Login shall:

- Capture a credential from a new invitee, or verify one from a returning Identity, as part of accepting the Invitation — not as a separate signup or login step.
- Issue an authenticated session immediately on successful acceptance.
- Resolve which Workspace the person lands in without asking them, whenever that is unambiguous.
- Present a distinct welcome moment before Workspace Setup, not instead of it and not automatically skipping into it.
- State plainly how this relates to Workspace_Access_Context §4.7's Workspace Session concept, rather than leaving two unreconciled descriptions of the same moment in the corpus.

---

# 4. Business Concepts

## Credential Capture (at Acceptance)

Part of Invitation acceptance, not a separate step. Branches on Identity Resolution's outcome (Invitation Business Analysis, Section 7.2):

- **New Identity** (the invitee's email resolves to nobody). The invitee chooses a password as part of accepting. `Identity.Create` runs with that password's hash.
- **Returning Identity** (the invitee's email already owns an Identity — from a prior Workspace, for instance). The invitee proves it by entering their existing password, rather than being asked to set a new one. No new Identity is created; the existing one is reused, per Invitation Business Analysis's own Identity and Membership Rules.

Both happen on the Invitation's own acceptance screen. There is deliberately no intermediate "create your account" or "log in first" screen.

## Immediate Session Issuance

A successful acceptance returns an authenticated session in the same response shape ordinary login produces (`AuthController`'s `LoginResponse`) — the person is signed in as a direct consequence of accepting, never by then visiting a login form. This is distinct from **ordinary login** (`POST /api/auth/login`), which remains exactly how a returning user signs back in on any later visit, with no Invitation involved.

## Workspace Auto-Selection

Once authenticated, the client resolves which Workspace to show. When the Identity's `GET /api/me` response contains exactly one eligible Membership — the ordinary case immediately after provisioning, since the new Workspace is the only one that exists for a brand-new Owner — that Workspace is entered automatically, with no picker shown. When more than one Membership exists, the existing Workspace Picker is presented (reused, not redesigned by this document). This selection is computed client-side on every load from `GET /api/me`; nothing about "which Workspace was last active" is persisted server-side.

## First-Run Welcome

The first screen a Member actually sees inside their Workspace, immediately after arriving — distinct from, and prior to, Workspace Setup. It greets the person by name and offers a deliberate, clickable path onward into Setup, rather than redirecting into the setup wizard automatically. First Login's job ends here; everything past this point is Workspace Setup Business Analysis's territory.

> **Note (2026-08-05):** This same hand-off point is also where TutorWorkspaceFirstTimeExperienceArchitecture.md's tutor-onboarding stages (profile, teaching preferences, resource initialization) begin. That document's stages run independent of, and in parallel with, Workspace Setup's publish lifecycle — see Technical Debt Backlog TD-015. First Login does not choose between the two; it only ends at Welcome.

---

# 5. Responsibilities

First Login is responsible for:

- Collecting or verifying a credential as part of Invitation acceptance.
- Issuing an authenticated session immediately on acceptance, with no separate login step.
- Resolving Workspace selection automatically when unambiguous.
- Presenting the first-run welcome moment, and the deliberate hand-off into Setup.

First Login is **not** responsible for:

- The Invitation's own Accept / Expire / Cancel mechanics, or its token security — Invitation Business Analysis's territory, unchanged here.
- The Workspace's own `Created → Configuring → Private → Published → Active` journey — Workspace Setup Business Analysis's territory, begun only once First Login hands off.
- Ordinary login for a returning user with no Invitation in play — `AuthController`'s existing `/api/auth/login` path, unaffected by this document.
- Deciding password strength policy or any other credential rule beyond "a credential must be supplied" — see Section 16.

---

# 6. Business Actors

## New Tutor (First-Time Identity)

Accepts an Invitation with no prior Identity. Chooses a password as part of accepting. Sees the Welcome screen for the very first time, with nothing configured yet.

## Returning Identity, New Invitation

Already owns an Identity from a prior Workspace (as a Teacher, a Learner, or a previous Tutor). Accepts a new Invitation by proving their existing password, not choosing a new one. Still sees a first-run Welcome for *this* Workspace, even though their Identity itself is not new — first-run is scoped to the Workspace/Membership, not the Identity.

## Identity Context

Performs Identity Resolution during Onboarding (Workspace_Access_Context §4.6) — reused unchanged here, not redefined.

## Auth (Platform.Api)

Issues the session on acceptance, using the same mechanism as ordinary login.

---

# 7. Workflow: From Accepted Invitation to Workspace Home

```text
Invitation: Accepted (Invitation Business Analysis, Section 7.2)

↓

Identity Resolution outcome

↓ New Identity                              ↓ Returning Identity
Invitee chooses a password                  Invitee enters their existing password
↓                                            ↓
Identity.Create(passwordHash: ...)          Password verified against existing Identity
↓                                            ↓
Membership.Create(identityId, workspaceId, Owner)   [both paths continue here]

↓

Membership.Activate()

↓

Workspace.TransferOwnership(membershipId)
  (Platform Administrator Business Analysis, Section 7.2 — ends here in that document)

↓

Session issued immediately
  (same response shape as ordinary login — no separate login screen)

↓

GET /api/me resolved

↓ exactly one eligible Membership            ↓ more than one eligible Membership
Workspace entered automatically              Existing Workspace Picker shown
↓                                            ↓
                    [both paths converge here]

↓

First-Run Welcome shown
  ("Welcome, {name}." — greets by name, offers "Continue setup" as a
  deliberate next click, not an automatic redirect)

↓

Owner clicks through, or returns later

↓

Workspace Setup Business Analysis begins
  (Workspace Setup Business Analysis, Section 7)
```

---

# 8. Configuration

## Password Requirements

Not specified by this document. Whatever policy Identity Aggregate Design or a future Credential concept (Technical Debt Backlog TD-004) settles on applies equally here — First Login introduces no separate rule.

## First-Run Detection

Not fully specified here. Observed behavior in `WorkspaceHomeScreen` distinguishes a first-run view from an ordinary return visit, but this document does not pin down what drives that distinction (Workspace status, a persisted flag, or something else) — see Section 16.

---

# 9. Session and Screen States

For the person, across their first visit:

```text
Unauthenticated
  ↓ (accepts Invitation, supplies/verifies credential)
Authenticated, no Workspace selected
  ↓ (auto-selection or picker)
Workspace Selected
  ↓ (first visit to this Workspace)
First-Run Welcome
  ↓ (any later visit to this Workspace)
Ordinary Workspace Entry
  (Welcome is not shown again — Workspace Setup or Workspace Home directly,
  depending on Workspace status)
```

---

# 10. Business Rules

## Credential Rules

- A new Identity created during acceptance must receive a password chosen at that moment; `Identity.Create` cannot proceed without one (Identity Aggregate Design).
- A returning Identity is never issued a new password during acceptance — it is verified against the existing one, consistent with Invitation Business Analysis's rule that an existing Identity is reused, not duplicated.

## Session Rules

- Acceptance issues a session directly. No intermediate login step exists or is required for a person who just accepted an Invitation.
- The session issued here is not a distinct kind of token from ordinary login's — same shape, same claims, same subsequent handling. First Login does not introduce a new authentication mechanism, only a new way of arriving at the existing one.

## Workspace Selection Rules

- Exactly one eligible Membership auto-selects that Workspace with no picker.
- More than one eligible Membership shows the existing Workspace Picker — this document does not change picker behavior.
- Selection is recomputed from `GET /api/me` on each load; nothing about the choice persists server-side between sessions.

## First-Run Rules

- First-Run Welcome is scoped to the Workspace/Membership pairing, not to the Identity — a returning Identity accepting a brand-new Invitation still sees a first-run Welcome for that new Workspace.
- Welcome offers, but never forces, the path into Workspace Setup. Landing on Setup automatically instead would remove the Owner's choice to look around first — see BA-003.

## Relationship to Workspace Session (§4.7)

- This document's Session and Workspace Selection concepts are not the `Workspace Session` Workspace_Access_Context §4.7 describes. §4.7 specifies validation against Membership per Workspace as part of session creation itself; what exists today is a single identity-level session plus a client-side selection computed fresh each time — simpler, and not scoped per Workspace at the token level at all (consistent with TD-005's identity-level-token decision). See BA-004 for how this document treats that gap.

---

# 11. Status

For the person, across acceptance:

- Unauthenticated
- Authenticated — Workspace Selection Pending
- Workspace Selected — First Run
- Workspace Selected — Returning

---

# 12. Notifications

No new notification events are introduced by this document. Invitation acceptance itself was already covered by Invitation Business Analysis, Section 12 ("Invitation accepted — to sender"). First Login does not add a separate "welcome email" or similar — if one is wanted, it is Future scope, not assumed here.

---

# 13. Contribution to Platform Growth

First Login is the natural point to measure activation, not just provisioning: time from Invitation Accepted to first Workspace Setup step started, and whether an Owner who reaches Welcome ever clicks through to Setup at all. Not designed further here — named only as the metric this moment would feed, consistent with how Platform Administrator Business Analysis (Section 13) and Invitation Business Analysis (Section 13) treat their own growth metrics.

---

# 14. Integration with Other Domains

| Domain | Relationship |
|---------|--------------|
| Invitation Business Analysis | This document begins exactly where that one's Section 7.2 ends (Membership Created) and supplies the credential-capture detail that section left unspecified. |
| Platform Administrator Business Analysis | Section 7.2 there explicitly stops at ownership transfer; this document is its stated continuation for the authentication/session half, alongside Workspace Setup Business Analysis for the Workspace-lifecycle half. |
| Workspace Setup Business Analysis | This document's Welcome screen is the deliberate hand-off point into that document's Section 7. Workspace Setup's own Section 5 already states it begins with an authenticated Owner already inside the Workspace — this document is what makes that true. |
| Identity Aggregate Design | Credential capture calls `Identity.Create` (new) or verifies against an existing `PasswordHash` (returning) — no new Identity behavior is introduced. |
| Membership Aggregate Design | Session issuance follows `Membership.Activate()`, unchanged. |
| Workspace_Access_Context | §4.7's Workspace Session is named and reconciled, not extended — see BA-004. |

---

# 15. Business Decisions

## BA-001

Credential capture happens inline during Invitation acceptance — a new password for a new Identity, a password check for a returning one — rather than as a separate signup or login screen. This mirrors what `InviteScreen` already does; this document names the rule rather than inventing a new one.

## BA-002

Acceptance issues a session immediately, using the same response shape as ordinary login. A person who just proved who they are by accepting an Invitation and supplying a credential should never be asked to prove it again one screen later by logging in.

## BA-003

Welcome offers a manual "Continue setup" action rather than redirecting automatically into Workspace Setup. An Owner arriving at their new Workspace for the first time should get a moment to arrive before being placed into a multi-step configuration wizard — consistent with `WorkspaceHomeScreen`'s existing behavior, which this document treats as the deliberate design, not an oversight.

## BA-004

**This document's Session and Workspace Selection concepts formally supersede Workspace_Access_Context §4.7's Workspace Session for Version 1 — they are not the same mechanism, and this is a correction of §4.7, not an extension of it.**

Reasoning: §4.7 describes a session created only after both authentication *and* Membership validation for one specific Workspace succeed together, implying a workspace-scoped session artifact. What is actually built, and what Technical Debt Backlog TD-005 already deliberately chose, is a single identity-level token carrying no Workspace claim, with Workspace context resolved per request from `GET /api/me` and selected client-side. These are materially different designs, not a documentation gap in §4.7 that simply needs filling in — §4.7 describes something that was considered and not built this way. §4.7 should be corrected to reflect the identity-level-token model, or explicitly marked superseded, rather than left standing as if it were still the target design. See Technical Debt Backlog, TD-014.

---

# 16. Version 1 Open Questions

### First-Run Detection Mechanism — Open (Section 8)

What actually distinguishes a first-run view from a return visit in `WorkspaceHomeScreen` — Workspace status, a persisted per-Membership flag, or something else — is not specified here and should be confirmed against the implementation rather than assumed.

### Password Policy — Open (Section 8)

Deferred entirely to wherever Identity's credential rules end up being specified (Technical Debt Backlog TD-004). Not designed here.

### Workspace_Access_Context §4.7 Correction — Open (BA-004)

BA-004 states this document's model supersedes §4.7 for Version 1, but does not itself edit Workspace_Access_Context.md. Someone should either correct §4.7 to describe the identity-level-token model actually built, or mark it explicitly as superseded — leaving it as-is invites a future reader to treat it as the still-current target.

### Welcome for Non-Owner First Logins — Open

This document's Workflow (Section 7) is written for the Owner path, since that is Version 1's only exercised Invitation scenario (Invitation Business Analysis, BA-007: non-Owner invitations are Future scope). Whether a first-time Teacher or Learner sees the same Welcome pattern, a different one, or none at all is not addressed.

---

# Summary

First Login names and documents a mechanism that was already built and already working, but had never been written down: credential capture branching on whether the invitee's Identity is new or reused, immediate session issuance with no separate login step, automatic Workspace selection when unambiguous, and a deliberate first-run Welcome that hands off into Workspace Setup rather than skipping into it.

It also corrects the record rather than padding it: Workspace_Access_Context §4.7's Workspace Session was never built as specified, and this document states plainly that the simpler, identity-level-token model already chosen by Technical Debt Backlog TD-005 is what Version 1 actually runs on — a decision that document should be updated to reflect, not a gap this one quietly works around.
