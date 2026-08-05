# Invitation Business Analysis

> Version: 1.0
>
> Status: Draft
>
> Domain: Workspace Access
>
> Document Type: Business Analysis
>
> Author: Business Analysis Team (drafted to close the gap left open in Platform Administrator Business Analysis, Section 16, "Invitation Delivery Ownership," and to reconcile the two existing Invitation lifecycle definitions — see Section 9 and Technical Debt Backlog TD-008)
>
> Related Documents:
>
> - Workspace_Access_Context (§4.5 Invitation, §4.6 Onboarding Request)
> - IdentityAndWorkspaceAccess (§1 Workspace Invitation; Workspace Entry Point; Workspace Resolution)
> - First Login Business Analysis (picks up immediately after Membership Created — credential capture, session issuance, and Workspace selection this document does not cover)
> - Membership Aggregate Design
> - Workspace Aggregate Design
> - Identity Aggregate Design
> - Platform Administrator Business Analysis
> - Technical Debt Backlog

---

# 1. Business Vision

An Invitation is how a specific, named person is authorized to join a specific Workspace, without ever exposing that Workspace to public sign-up.

It is deliberately thin: an Invitation authorizes onboarding — it does not authenticate anyone and does not create an Identity (Workspace_Access_Context, Rule WA-102 in IdentityAndWorkspaceAccess §1). Everything downstream of "the invitee clicked a valid link" belongs to Identity Resolution and Membership, not to the Invitation itself.

For the Platform Administrator's own use (Platform Administrator Business Analysis, Section 7), an Invitation is the only mechanism by which a subscribed Tutor is handed a Workspace — there is no other path from "Admin created an empty Workspace" to "Tutor is its Owner."

---

# 2. Business Problem

The Invitation concept already exists in two places, at two different levels of detail, and they disagree with each other:

- **Workspace_Access_Context §4.5** defines a simple two-branch lifecycle: `Created → Sent → Accepted → Membership Created`, or `Created → Expired`. No `Cancelled` state.
- **IdentityAndWorkspaceAccess §1 ("Workspace Invitation")** defines a six-state lifecycle — `Draft → Issued → Delivered → Accepted → Expired → Cancelled` — with a full field list (Invitation Identifier, Invitation Token, Workspace, Intended Role, Intended Learning Product, Expiration Date, Invitation Status, Issued By, Issued At) and five business rules (WA-101–WA-105), including WA-104: "Invitations may be cancelled before acceptance" — a capability the other document's state machine has no state for.

Neither document specifies how the Invitation Token is generated, stored, or secured. Neither specifies resend behavior. Platform Administrator Business Analysis (Section 16) explicitly deferred all of this rather than guess.

Separately, IdentityAndWorkspaceAccess already defines exactly how an Invitation Link is delivered and resolved — as a **Workspace Entry Point** (`https://platform.com/invite/ABC123`), consumed by **Workspace Resolution** using the Invitation Token as a resolution input. That mechanism is reused here rather than re-designed — see Section 7.

---

# 3. Business Objectives

The Invitation capability shall:

- Authorize exactly one named person to join exactly one Workspace, with an intended role.
- Deliver that authorization as a link that resolves the target Workspace without the invitee doing anything (Workspace Resolution, IdentityAndWorkspaceAccess).
- Prevent the link from being guessed, reused after acceptance, or usable once expired or cancelled.
- Let the sender resend a stalled invitation or cancel one that should no longer be honored.
- Never create an Identity or a Membership by itself — only authorize the Onboarding Request that leads to them (WA-102, WA-105).

---

# 4. Business Concepts

## Invitation

A Workspace-owned record authorizing one named person (by email) to join that Workspace with an intended role. Fields, per IdentityAndWorkspaceAccess §1 (adopted here as-is):

- Invitation Identifier
- Invitation Token
- Workspace (the owning Workspace — WA-101)
- Intended Role
- Intended Learning Product *(optional; not applicable to the Owner-provisioning case in Platform Administrator Business Analysis, since a newly provisioned Workspace has no Learning Product yet — relevant only to Future Teacher/Learner invitations into an existing Workspace)*
- Expiration Date
- Invitation Status
- Issued By (the sending Identity/Membership — the Platform Administrator, in Version 1's only sender scenario; see BA-007)
- Issued At

## Invitation Token

The secret, unguessable value embedded in the Invitation Link. It is the only thing that proves the invitee is the person the Invitation was issued to — see Section 8 for its security properties.

## Invitation Link (Entry Point)

The delivery form of an Invitation Token, already defined in IdentityAndWorkspaceAccess as one of the platform's Workspace Entry Point types:

```text
https://platform.com/invite/ABC123
```

This is not a new addressing scheme — it is the existing Entry Point type reused. **Workspace Resolution** (IdentityAndWorkspaceAccess, "Workspace Resolution") takes the Invitation Token as one of its resolution inputs and produces either a Resolved Workspace or Workspace Not Found, before any authentication happens.

## Onboarding Request

Unchanged from Workspace_Access_Context §4.6 — created only after a valid Invitation is accepted, drives Identity Resolution, and is itself never the thing that creates a Membership (WA-105: accepting starts onboarding; onboarding is not acceptance).

---

# 5. Responsibilities

The Invitation is responsible for:

- Naming exactly one Workspace, one invitee (by email), and one intended role.
- Carrying an expiration date and honoring it.
- Being cancellable before acceptance.
- Being resendable while still outstanding.
- Triggering Onboarding on acceptance.

The Invitation is **not** responsible for:

- Authenticating anyone (IdentityAndWorkspaceAccess §1, "An invitation does not authenticate a learner").
- Creating an Identity (WA-102).
- Creating a Membership directly — Membership Creation is the *outcome* of a successful Onboarding Request, not something the Invitation does itself (WA-105; Workspace_Access_Context §4.6).
- Deciding what happens inside the Workspace after Membership is Active — that is the new Member's and the Workspace's own concern.

---

# 6. Business Actors

## Sender

In Version 1, the only sender is the **Platform Administrator**, issuing an Invitation as part of Workspace Provisioning (Platform Administrator Business Analysis, Section 7). A Workspace's own Owner or `WorkspaceRoleName.Administrator` inviting a Teacher or Learner into an *existing* Workspace is the same mechanism, structurally — but is Future scope, not built now. See BA-007.

## Invitee

The person named on the Invitation by email. May already own an Identity, or may not — Identity Resolution (Identity Context) determines which during Onboarding.

## Workspace Resolution (System Process)

Not a human actor. Resolves the Invitation Link to its target Workspace and validates the token before Onboarding begins (IdentityAndWorkspaceAccess, "Workspace Resolution Flow").

---

# 7. Workflow: End-to-End Invitation

```text
Sender creates an Invitation
  (Workspace, invitee email, intended role — e.g. Owner, per Platform Administrator
  Business Analysis Section 7)

↓

Invitation Token generated
  (cryptographically random, unguessable — see Section 8)

↓

Invitation: Created

↓

Invitation delivered to invitee
  (channel: email, in Version 1 — see Section 8)

↓

Invitation: Sent

↓

Invitee opens the Invitation Link
  https://platform.com/invite/{token}

↓

Workspace Resolution
  (resolves the Workspace from the Invitation Token — IdentityAndWorkspaceAccess,
  "Workspace Resolution")

↓

Invitation Validation
  (token exists, unexpired, uncancelled, unused — Section 10)

↓ valid                                          ↓ invalid

Onboarding Request created                  Invitee sees an error
  ↓                                          (expired / cancelled / already used —
Identity Resolution                          Section 10, Edge Cases)
  (does this email already own an
  Identity? reuse it — else create one)
  ↓
Invitation: Accepted
  ↓
Membership.Create(identityId, workspaceId, intendedRole)
  (Membership status: Pending)
  ↓
Membership.Activate()
  ↓
If intended role was Owner:
  Workspace.TransferOwnership(membershipId)
  (Platform Administrator Business Analysis, Section 7)
```

## Resend

```text
Invitation: Sent or Expired

↓ (sender resends)

New Invitation Token generated
  (previous token invalidated immediately — Section 10, BA-005)

↓

Invitation: Sent
  (Expiration Date reset)
```

## Cancel

```text
Invitation: Created or Sent

↓ (sender cancels)

Invitation: Cancelled
  (Invitation Link no longer resolves to a usable Invitation)
```

Cancel is not available once an Invitation is Accepted — removing a person who has already become a Member is `Membership.Remove`'s job, a different action with different consequences (Membership Aggregate Design, Section 13), not an Invitation concern.

---

# 8. Configuration

## Delivery Channel

Email, in Version 1. Other channels (SMS, in-app) are not precluded by this design but are not built now.

## Expiration Date

No numeric default is mandated by either source document. Recommended default: **7 days** from Issued At, configurable rather than hard-coded, so it can be tuned without a domain change. Final number is a business policy call — see Section 16.

## Token Generation and Storage

Neither existing source document specifies this, so it is decided here:

- The Invitation Token is cryptographically random (not derived from the Invitation Identifier, email, or any guessable input).
- The raw token is shown to the invitee exactly once, inside the Invitation Link. It is **not** stored in plaintext — only its hash is persisted, mirroring how `PasswordHash` protects credentials in Identity Aggregate Design (INV-006, "passwords are never visible"). Validation hashes the incoming token and compares.
- The token is single-use: once an Invitation reaches Accepted, its token can never validate again, even if the link is reopened.

## Single Active Invitation

At most one Created/Sent Invitation may exist per (invitee email, Workspace) pair at a time. See BA-005.

---

# 9. Lifecycle

Two lifecycles for the same concept already exist in the corpus and disagree (Section 2). This document adopts **Workspace_Access_Context §4.5** as the base — it is the more recent document and the one Membership Aggregate Design already builds on — and folds in the one capability the other document has that this one lacks: **Cancelled** (required by WA-104, which nothing in Workspace_Access_Context §4.5 contradicts — it simply never mentions cancellation).

**Reconciled Version 1 lifecycle, as used throughout this document:**

```text
Created

↓

Sent  ──────────────┐
  │                  │
  ↓ (invitee accepts) ↓ (time elapses)   ↓ (sender cancels)
  │                  │                    │
Accepted           Expired             Cancelled
  ↓
Membership Created
```

`Sent → Expired` and `Sent → Cancelled` are alternatives to `Sent → Accepted`, not a further sequence — an Invitation reaches exactly one of Accepted, Expired, or Cancelled, never more than one. `Created → Cancelled` is also legal (a sender may cancel before ever sending).

This reconciliation, and the disagreement it resolves, is logged as **Technical Debt Backlog TD-008** rather than silently overwritten — the same treatment TD-007 gave the analogous Membership state-machine contradiction. The underlying documents themselves are not edited by this document; TD-008 records that they still need a maintainer's ruling.

`Draft` and `Issued`/`Delivered` (from IdentityAndWorkspaceAccess's six-state version) are treated as finer-grained sub-steps of `Created` and `Sent` respectively, not as distinct states Version 1 needs to track separately. Splitting `Sent` into `Issued` (queued) and `Delivered` (confirmed delivered, e.g. email provider ack) is a reasonable Future refinement if delivery failures need their own visibility — not required to implement Section 7 as written.

---

# 10. Business Rules

## Ownership and Scope Rules

(Restated from IdentityAndWorkspaceAccess §1, WA-101–WA-105 — not redefined here)

- Every Invitation belongs to exactly one Workspace (WA-101).
- Invitations are never shared across Workspaces.
- Invitations never create Identities directly (WA-102).
- Accepting an Invitation starts the Onboarding process; it does not itself create a Membership (WA-105).

---

## Token and Security Rules

- The Invitation Token is cryptographically random and unguessable.
- Only the token's hash is stored; the raw value exists only in the delivered link.
- A token is valid for exactly one successful acceptance. Once Accepted, it cannot be reused, even to view the same Workspace again.
- Resending or cancelling an Invitation invalidates its current token immediately.

---

## Delivery Rules

- Version 1 delivers by email only, sent to the address named on the Invitation.
- Delivery failure (e.g., bounce) does not silently retry indefinitely — it surfaces to the sender rather than leaving a Sent-but-undeliverable Invitation invisible. Exact retry/backoff policy is Future — see Section 16.

---

## Expiry Rules

- Expiration is evaluated lazily, at the moment the Invitation Link is opened or resend/cancel is attempted — there is no requirement for a background job to flip status early in Version 1.
- An Expired Invitation cannot be Accepted. It can be resent (Section 7), which issues a fresh token and Expiration Date.

---

## Resend Rules

- Only Sent or Expired Invitations may be resent.
- Resending invalidates the previous token and resets the Expiration Date — it does not create a second, parallel Invitation.
- Cancelled or Accepted Invitations cannot be resent. A Cancelled one requires a brand-new Invitation if the sender changes their mind; an Accepted one is done — see Membership Aggregate Design for what happens to an existing Member instead.

---

## Cancel Rules

- Only Created or Sent Invitations may be cancelled (WA-104: "before acceptance").
- Cancelling immediately invalidates the token; the Invitation Link stops resolving to a usable Invitation.
- Cancel is distinct from Remove: Cancel undoes an offer that was never accepted; `Membership.Remove` ends a relationship that already exists. See BA-002 for the terminology fix this implies elsewhere.

---

## Single-Invitation and Ownership-Race Rules

- At most one Created/Sent Invitation may exist per (invitee email, Workspace) pair. A sender who "resends" while one is already outstanding performs Section 7's Resend flow rather than creating a second Invitation — see BA-005.
- A Workspace with no current Owner may have at most one outstanding (Created/Sent) **Owner-role** Invitation at a time. This prevents two different people both holding a valid link that would each try to claim ownership of the same unowned Workspace — see BA-006.

---

## Acceptance Edge Cases

- **Invitee's email already resolves to an Identity with an Active Membership in the target Workspace already.** Acceptance is rejected as a no-op; the invitee is told they are already a Member rather than silently creating a second Membership.
- **Invitee's resolved Identity is Suspended or Archived.** Acceptance is blocked; the Invitation remains Sent, and the situation is surfaced to the sender rather than silently failing.
- **Target Workspace was Archived or Deleted between Sent and Accept.** Acceptance fails gracefully with a clear message; the Invitation is not silently marked Accepted against a Workspace that no longer operates.
- **Invitee never had an Identity before.** Identity Resolution creates one as part of Onboarding (Identity Aggregate Design, `Identity.Create`) — this is the ordinary case, not an edge case, and is unaffected by anything above.

---

# 11. Status

For the Sender:

- Created
- Sent
- Accepted
- Expired
- Cancelled

For the Invitee, on opening the link:

- Valid — proceeds to Onboarding
- Expired — offered nothing further; sender must resend
- Cancelled — offered nothing further
- Already Used — informs the invitee they already accepted

---

# 12. Notifications

- Invitation sent (to invitee)
- Invitation accepted (to sender)
- Invitation expired (to sender — prompts a resend decision)
- Invitation cancelled (to invitee, only if they attempt to use an already-cancelled link)
- Invitation resent (to invitee — new link, previous one now dead)

As in Platform Administrator Business Analysis (BA-005), who actually delivers these is not resolved here: Communication Context is scoped to "a Learning Workspace and its community" (Communication Context §1), and an invitee has no community membership until after acceptance. This document treats delivery as a platform-level notification concern, consistent with that earlier decision — not re-litigated here.

---

# 13. Contribution to Platform Growth

Invitation acceptance is the leading indicator behind Platform Administrator Business Analysis's provisioning metrics (Section 13 there): time from Sent to Accepted, and the proportion of Invitations that reach Accepted versus Expired or Cancelled, are the natural health signals for the whole provisioning flow. Not designed further here — this section only names the connection.

---

# 14. Integration with Other Domains

| Domain | Relationship |
|---------|--------------|
| Workspace_Access_Context | Base definition (§4.5) and Onboarding Request (§4.6) reused as-is; this document adds the depth §4.5 left out. |
| IdentityAndWorkspaceAccess | Source of the field list, WA-101–WA-105 rules, and the Entry Point / Workspace Resolution mechanics this document builds delivery on. Also the source of the lifecycle contradiction resolved in Section 9. |
| Identity Aggregate Design | Identity Resolution (reuse existing Identity or `Identity.Create`) happens during Onboarding, after Invitation acceptance. |
| Membership Aggregate Design | Acceptance is what causes `Membership.Create` and `Membership.Activate` to run. |
| Workspace Aggregate Design | Owner-role acceptance is what supplies the `membershipId` to `Workspace.TransferOwnership`. |
| Platform Administrator Business Analysis | Primary Version 1 consumer — Workspace Provisioning (its Section 7) *is* this document's end-to-end workflow, specialized to the Owner role. |
| Communication Context | Explicitly not extended — see Section 12. |

---

# 15. Business Decisions

## BA-001

The reconciled Version 1 lifecycle (Section 9) is `Created → Sent → {Accepted | Expired | Cancelled}`, adopting Workspace_Access_Context §4.5 as the base and adding `Cancelled` from IdentityAndWorkspaceAccess §1 to satisfy WA-104. The contradiction between the two source documents is not silently resolved by this choice — it is logged as Technical Debt Backlog TD-008, following the same precedent as TD-007 (Membership Pending→Archived).

---

## BA-002

Terminology is aligned to **Cancel**, matching WA-104's existing wording, not **Revoke**. Platform Administrator Business Analysis (Section 5) used "Revoke" before this document existed; it is updated to "Cancel" for consistency (see that document's v1.1 revision note).

---

## BA-003

The Invitation Link reuses the existing Workspace Entry Point / Workspace Resolution mechanism (`https://platform.com/invite/{token}`) exactly as defined in IdentityAndWorkspaceAccess. No new addressing scheme, resolution process, or URL structure is introduced by this document.

---

## BA-004

Invitation Tokens are cryptographically random, stored hashed (never in plaintext), and single-use. Neither source document specified token security; this fills that gap by mirroring the same principle Identity Aggregate Design already applies to passwords (INV-006).

---

## BA-005

At most one Created/Sent Invitation may exist per (invitee email, Workspace) pair. "Resend" is a command on the existing Invitation, not a second Invitation — this keeps status, history, and the acceptance edge cases in Section 10 unambiguous.

---

## BA-006

A Workspace with no current Owner may have at most one outstanding Owner-role Invitation at a time. Without this rule, two valid links could each resolve to "become the Owner" of the same unowned Workspace — a race this rule closes structurally rather than by relying on `Workspace.TransferOwnership`'s caller to catch it after the fact.

---

## BA-007

Version 1's only Invitation sender is the Platform Administrator, issuing Owner-role Invitations for Workspace Provisioning. The same mechanism is expected to be reused when a Workspace's own Owner or `WorkspaceRoleName.Administrator` invites a Teacher, Assistant Teacher, Learner, or Parent into an *existing* Workspace — but that sender scenario is Future work, not designed further here, since nothing in Sections 7–10 assumes Platform Administrator specifically except "Issued By."

---

# 16. Version 1 Open Questions

### Lifecycle Contradiction — Open (BA-001, TD-008)

- Workspace_Access_Context §4.5 and IdentityAndWorkspaceAccess §1 need an author's ruling on which is normative, and the losing document should be corrected. This document's Section 9 states the working reconciliation used meanwhile.

### Expiration Duration — Open (Section 8)

- 7 days is recommended, not decided. Needs a business-policy confirmation.

### Delivery Failure Handling — Open (Section 10, Delivery Rules)

- Exact retry/backoff behavior on a bounced or failed email delivery is unspecified.

### Reminder Notifications — Open (Section 12)

- Whether an invitee is reminded before an Invitation expires (and how long before) is not specified — Assignment Business Analysis's "due soon" pattern (Section 12 there) is a plausible precedent to reuse later.

### Non-Owner Invitation Rules — Open (BA-007)

- When Future work extends sending to Workspace-internal actors (a Teacher inviting another Teacher, for instance), do all of Section 10's rules still apply unchanged, or does the Owner-role-exclusivity rule (BA-006) need a non-Owner equivalent (e.g., limiting how many outstanding Invitations one Workspace may have open at once)? Not answered here.

---

# Summary

An Invitation authorizes exactly one named person to join exactly one Workspace with an intended role, and does nothing else — it does not authenticate, and it does not create an Identity or Membership by itself (WA-102, WA-105).

This document resolves what Platform Administrator Business Analysis deferred: it reconciles two disagreeing lifecycle definitions into one Version 1 answer (logging the disagreement rather than hiding it), reuses the platform's existing Invitation Link / Workspace Resolution mechanism rather than inventing a new one, and fills the previously unspecified gaps — token security, resend, cancel, and the acceptance edge cases — needed to actually build Workspace Provisioning's Section 7 workflow end to end.
