# Platform Administrator Business Analysis

> Version: 1.0
>
> Status: Draft
>
> Domain: Platform Operations (new — spans Identity Context and Workspace Access Context; see Section 14)
>
> Document Type: Business Analysis
>
> Author: Business Analysis Team (drafted to close the gap recorded in Technical Debt Backlog, TD-005 follow-up: "platform-level Admin has no home")
>
> Revision Note (v1.1): Terminology aligned to "Cancel" (not "Revoke") throughout, matching IdentityAndWorkspaceAccess §1's existing WA-104 wording — see Invitation Business Analysis, BA-002. Section 7's Invitation step, Section 8's Invitation Expiry, Section 10's Invitation Rules, and Section 16's "Invitation Delivery Ownership" item now point to Invitation Business Analysis, which supplies the full lifecycle, token security, resend/cancel rules, and edge cases this document deliberately deferred.
>
> Related Documents:
>
> - Identity Aggregate Design
> - Workspace Aggregate Design
> - Membership Aggregate Design
> - Workspace_Access_Context
> - IdentityAndWorkspaceAccess
> - Commerce Context
> - Invitation Business Analysis
> - Technical Debt Backlog (TD-005, TD-006, TD-008)

---

# 1. Business Vision

A Platform Administrator operates the platform itself, not any single Workspace.

Where a Workspace Owner or Teacher acts *inside* one educational business, the Platform Administrator acts *across all of them* — turning a subscribed Tutor into a running Workspace, keeping the platform's tenant population healthy, and stepping in when something inside a Workspace needs platform-level attention.

The Platform Administrator is the first Actor in this codebase whose scope is the whole platform rather than one Workspace or one Identity's own record.

---

# 2. Business Problem

Technical Debt Backlog TD-005 removed the global `IdentityRole.Admin` value when roles moved to Membership, and left an explicit follow-up:

> "platform-level Admin has no home. ... `WorkspaceRoleName.Administrator` is Workspace-scoped and is not a replacement: it confers nothing platform-wide. If platform staff / support access is ever needed, it must be modelled deliberately rather than by reinstating a global role on Identity. No design doc in the corpus currently covers it."

That gap is concrete, not theoretical: `Identity.Suspend()`, `Identity.Reactivate()`, `Identity.Archive()`, and `Workspace.Suspend()` / `Workspace.Reinstate()` / `Workspace.Archive()` already exist in code today. Nothing in the domain says who is allowed to call them.

A second, related problem has no owner either: **how does a new Workspace come to exist at all?** `Workspace.Create` and the Invitation → Membership → Ownership-transfer sequence are fully modelled (Workspace Aggregate Design; Membership Aggregate Design; Workspace_Access_Context §4.5–4.6), but every step assumes an actor who already has authority over an *unowned* Workspace shell. No Actor in the corpus holds that authority before a Workspace has an Owner.

---

# 3. Business Objectives

The Platform Administrator capability shall enable a Platform Administrator to:

- Provision a new Workspace for a Tutor who has subscribed to the platform, and hand it to them via an Invitation.
- Suspend, reinstate, or archive a Workspace at the platform level.
- Suspend, reactivate, or archive an Identity at the platform level.
- Resend or cancel a pending Invitation.
- See, across every Workspace, which are Active, Suspended, or stalled mid-provisioning.
- Act without becoming a Member of every Workspace they administer.

---

# 4. Business Concepts

## Platform Administrator

A person who operates the platform rather than participating in any single Workspace's teaching or learning activity. Distinct from `WorkspaceRoleName.Administrator` (Membership Aggregate Design §7), which is a Workspace-scoped role held *inside* one Workspace by a Member of it. A Platform Administrator does not need to be a Member of a Workspace to administer it — see Section 5, Business Decision BA-001.

## Platform Subscription

A subscribed Tutor's commercial relationship with the platform itself — payment to become a Workspace tenant. **Not** the same concept as Commerce Context's Subscription (Commerce Context §4.5: "recurring commercial access," scoped to "the financial relationships between Learning Workspaces and their customers," Commerce Context §1). Commerce Context's Subscription happens *inside* an existing Workspace, between that Workspace and its own learners. A Platform Subscription happens *before* any Workspace exists — see Business Decision BA-004 for why this is kept as a distinct, deliberately under-specified concept rather than folded into Commerce Context.

## Workspace Provisioning

The act of turning a subscribed Tutor into the Owner of a running Workspace: creating the Workspace shell, inviting the Tutor, and transferring ownership once they accept. Composed entirely of existing commands (`Workspace.Create`, Invitation lifecycle, `Membership.Create`/`Activate`, `Workspace.TransferOwnership`) — see Section 7.

---

# 5. Responsibilities

The Platform Administrator is responsible for:

- Provisioning Workspaces for subscribed Tutors (Section 7).
- Sending, resending, and cancelling Invitations to prospective Workspace Owners.
- Suspending, reinstating, and archiving Workspaces at the platform level.
- Suspending, reactivating, and archiving Identities at the platform level.
- Platform-wide operational visibility: Workspace status, Identity status, and in-progress provisioning.

The Platform Administrator is **not** responsible for:

- Anything inside a Workspace's own operation — curriculum, lessons, assignments, enrollments, or Workspace-level configuration. That belongs to the Workspace's own `WorkspaceRoleName.Administrator`, `Owner`, and `Teacher` Members.
- Authentication or credential management (Identity Aggregate Design — a Platform Administrator suspends an Identity but does not manage its `PasswordHash`).
- Pricing, billing, invoicing, or refunds for in-Workspace commerce (Commerce Context) — Platform Subscription billing itself is explicitly out of scope for this document; see Business Decision BA-004.
- Deciding *whether* a Tutor's Platform Subscription payment succeeded — that is an external signal this document treats as a precondition, not a workflow step (Section 7).

---

# 6. Business Actors

## Platform Administrator

Provisions Workspaces. Sends and manages Invitations. Suspends/reinstates/archives Workspaces and Identities. Holds no Membership in the Workspaces they administer — see BA-001.

---

## Subscribing Tutor

Pays for a Platform Subscription outside this workflow's boundary. Receives an Invitation. Accepts it, completing Identity Resolution and becoming the new Workspace's Owner. Takes over all further configuration of their Workspace once ownership transfers.

---

## Identity Context

Resolves whether the accepting Tutor already owns an Identity, or needs one created, during Onboarding (Workspace_Access_Context §4.6). Referenced, not owned, by this document.

---

## AI Assistant (Future)

May assist the Platform Administrator by flagging anomalies (e.g., a Workspace stuck mid-provisioning, an Identity with repeated suspensions) — not built in Version 1.

---

# 7. Workflow: Provision a Workspace for a Subscribed Tutor

```text
Tutor's Platform Subscription payment succeeds (external signal)

↓

Admin creates Workspace  →  Workspace.Create()  →  status: Created

↓

Admin creates an Invitation
  (target: Tutor's email, intended role: Owner, target Workspace: the one just created)

↓

Invitation: Created → Sent
  (invitation link delivered to the Tutor — see Business Decision BA-005;
  full Invitation mechanics, token security, and edge cases: Invitation Business Analysis)

↓

Tutor opens the invitation link

↓

Onboarding Request created  →  Identity Resolution
  (does this email already own an Identity? reuse it — else Identity.Create())

↓

Invitation: Sent → Accepted  →  Membership.Create(identityId, workspaceId, Owner)
  (Membership status: Pending)

↓

Membership.Activate()  →  status: Active

↓

Workspace.TransferOwnership(membershipId)
  (Workspace.OwnerMembershipId was null since Create — now set; INV-002 satisfied)

↓

Admin's responsibility ends here.
Tutor now owns an Active-Membership Workspace and continues its own
Configuring → Private → Published → Active lifecycle independently
(Workspace Aggregate Design, Section 15).
```

Alternate flow — Invitation not accepted:

```text
Invitation: Created → Sent → Expired

↓

Admin may resend a new Invitation, or leave the Workspace
in Created/Configuring state unclaimed.
```

---

# 8. Configuration

Provisioning may allow the Admin to set:

## Initial Workspace Identity

- Name and Slug (Workspace Aggregate Design §8) — either Admin-supplied at creation or left for the Tutor to complete during their own Configuring step. Both are valid; Version 1 leaves this to Admin discretion rather than mandating one (Future: may be standardized once self-serve signup exists).

## Invitation Expiry

- How long an Invitation remains Sent before it expires. Invitation Business Analysis (Section 8) recommends 7 days as a starting default, not yet a settled policy decision.

## Intended Role

- Owner is the only role granted by this workflow in Version 1. Provisioning a Workspace with a non-Owner initial Member (e.g., inviting a co-Administrator before an Owner exists) is Future scope.

---

# 9. Provisioning Status (Admin-Facing View)

Not a new aggregate — a composed view over existing Workspace, Invitation, and Membership state, for the Admin's own visibility:

```text
Awaiting Provisioning     (subscription confirmed, no Workspace yet)

↓

Workspace Created, Invitation Sent

↓

Invitation Accepted, Membership Pending

↓

Membership Active, Ownership Transferred   (Admin's job is done)

↓

Workspace Active   (Tutor has completed their own configuration and lifecycle)
```

"Awaiting Provisioning" and "Invitation Expired" are the two states where the Admin has outstanding work. Whether this composed view deserves its own tracked entity (e.g., a "Provisioning Request") rather than being computed from Workspace/Invitation/Membership state is deferred — see Section 16.

---

# 10. Business Rules

## Platform Administrator Rules

- A Platform Administrator does not need a Membership in a Workspace to suspend, reinstate, or archive it — see BA-001.
- A Platform Administrator's own access is platform-wide by definition; it is not modelled as a `WorkspaceRoleName` (BA-001), and this document does not resolve exactly how it is represented in the Identity/Membership model — see Business Decision BA-002.

---

## Provisioning Rules

- A Workspace created by an Admin begins with no Owner (`OwnerMembershipId` is null), matching `Workspace.Create`'s existing behavior — this is not a gap introduced by this document.
- Ownership transfers to the accepting Tutor's Membership only after that Membership is Active — `Workspace.TransferOwnership`'s own contract requires the target `membershipId` to name an Active Membership of that Workspace (Workspace Aggregate Design, INV-003).
- A Workspace may sit unclaimed (Created/Configuring, no Owner) indefinitely if its Invitation expires; this document does not mandate automatic cleanup — see Section 16.

---

## Invitation Rules

(Restated from Workspace_Access_Context §4.5 and reconciled in Invitation Business Analysis — not redefined here)

- An Invitation represents an intention to create a Workspace Membership, not the Membership itself.
- Reconciled Version 1 lifecycle: Created → Sent → {Accepted → Membership Created | Expired | Cancelled}. Workspace_Access_Context §4.5 and IdentityAndWorkspaceAccess §1 describe this differently; Invitation Business Analysis (Section 9) reconciles them and Technical Debt Backlog TD-008 records the underlying contradiction as still needing an author's ruling.
- Accepting an Invitation triggers Onboarding Request and Identity Resolution (§4.6) before any Membership exists.
- Full token security, resend/cancel rules, and acceptance edge cases: Invitation Business Analysis, Sections 7–10.

---

## Identity and Membership Rules

- If the Tutor's email already resolves to an existing Identity, provisioning reuses it — a Platform Subscription does not imply a new Identity (INV-001, Identity Aggregate Design: every Person owns exactly one Identity).
- The new Membership is scoped entirely to the newly created Workspace and grants no access elsewhere (Membership Aggregate Design INV-005).

---

# 11. Status

For the Platform Administrator (per Workspace under administration):

- Created
- Configuring
- Private
- Published
- Active
- Suspended
- Archived
- Deleted

(Unchanged from Workspace Aggregate Design §15 — the Platform Administrator observes and, for Suspend/Reinstate/Archive, drives these transitions; it does not introduce new Workspace states.)

For a pending provisioning action:

- Awaiting Provisioning
- Invitation Sent
- Invitation Expired
- Provisioned

---

# 12. Notifications

Typical events an Admin's actions should raise:

- Invitation sent
- Invitation expired
- Invitation accepted
- Workspace provisioned (ownership transferred)
- Workspace suspended / reinstated / archived (platform-level)
- Identity suspended / reactivated / archived (platform-level)

Who delivers these (email, in-app, etc.) is not resolved here. Communication Context is explicitly scoped to "a Learning Workspace and its community" (Communication Context §1) — a provisioning Invitation is sent *before* a Workspace has any community, so it does not cleanly fit that context's current definition either. This document treats invitation delivery as a platform-level notification, distinct from Communication Context's Workspace-scoped messaging — see Business Decision BA-005.

---

# 13. Contribution to Platform Growth

Workspace provisioning is the platform's tenant-creation event. It is the first point at which:

- A subscribed Tutor becomes a counted, active Workspace.
- Platform-wide metrics (Workspaces provisioned, time-to-first-Workspace-Active, Invitation acceptance rate) become possible.

The exact metrics and their ownership (a future Analytics Context concern) are out of scope here; this section only establishes that provisioning is the event such metrics would be built on.

---

# 14. Integration with Other Domains

| Domain | Relationship |
|---------|--------------|
| Identity Aggregate Design | Provisioning may create a new Identity (via Identity Resolution) or reuse an existing one. Platform Administrator also drives Identity.Suspend/Reactivate/Archive. |
| Workspace Aggregate Design | Provisioning calls Workspace.Create and Workspace.TransferOwnership directly. Platform Administrator also drives Workspace.Suspend/Reinstate/Archive. |
| Membership Aggregate Design | Provisioning creates and activates the Owner Membership that Workspace ownership transfers to. |
| Workspace_Access_Context | Invitation and Onboarding Request lifecycles (§4.5–4.6) are reused as-is, not redefined. |
| Commerce Context | Platform Subscription is explicitly distinguished from Commerce Context's Workspace-scoped Subscription (§4.5) — see BA-004. This document does not extend Commerce Context. |
| Communication Context | Invitation delivery does not fit Communication Context's current Workspace-community scope — see BA-005. This document does not extend Communication Context. |

---

# 15. Business Decisions

## BA-001

A Platform Administrator's authority over a Workspace does not depend on holding a Membership in it. This is a deliberate departure from every other Actor in the corpus (Tutor, Learner, Workspace Administrator), all of whom act through a Membership. It is necessary because the Admin must be able to create and suspend Workspaces the Admin is never a Member of, and must act on a brand-new Workspace before any Membership exists at all.

---

## BA-002

This document does not resolve how Platform Administrator access is represented in the Identity/Membership model (e.g., a platform-level flag on Identity, a separate Staff/Operator concept, or an entirely external admin-authorization system). TD-005's follow-up explicitly warned against "reinstating a global role on Identity" as the default fix; this document honors that warning by naming the responsibilities (Sections 5, 7, 10) without picking a representation. See Section 16.

---

## BA-003

Workspace Provisioning (Section 7) is fully expressible using only commands and lifecycles that already exist in code today (`Workspace.Create`, `Workspace.TransferOwnership`, `Membership.Create`, `Membership.Activate`, and the already-documented Invitation/Onboarding Request lifecycle). No new domain method is required to implement Section 7 as written.

---

## BA-004

**Platform Subscription (Tutor-to-platform) is a distinct concept from Commerce Context's Subscription (Workspace-to-learner), and this document does not fold one into the other.**

Reasoning: Commerce Context is explicitly scoped as the financial relationship "between Learning Workspaces and their customers" (Commerce Context §1) and its owned-data table lists Subscription as Commerce Context's own. A Tutor's Platform Subscription happens *before* any Workspace exists, so it cannot be "between a Workspace and its customer" — there is no Workspace yet. Renaming or repurposing Commerce Context's Subscription to also cover this case would contradict its own scope statement.

**Recommendation for the trigger question ("how does workspace creation get triggered by a subscription"):**

- **Version 1 (recommended): Admin-initiated, manually triggered.** The Admin learns that a Tutor's Platform Subscription succeeded through some external channel (billing provider dashboard, support inbox, or a simple queue) and performs Section 7's workflow by hand. This requires building nothing beyond the Admin capability itself — every command Section 7 uses already exists.
- **Future: Commerce-driven auto-provisioning.** Once a dedicated Platform Billing capability exists to own Platform Subscription as a first-class concept, it could emit a `PlatformSubscriptionActivated` event that pre-fills or automatically triggers Section 7, with Admin approval as an optional gate.

The Version 1 recommendation is made because automating the trigger requires designing and building a new billing capability first — real scope, not a small addition — while the manual path delivers the actual business need (a subscribed Tutor gets a Workspace) using only what already exists.

---

## BA-005

Invitation delivery (the email/link a prospective Tutor receives) is treated as a platform-level notification in this document, not a Communication Context message, because Communication Context is scoped to "a Learning Workspace and its community" (Communication Context §1) and no community exists yet at invitation time. This mirrors BA-004's reasoning for Commerce Context. Whether platform-level notifications eventually become their own concern, or Communication Context's scope is deliberately widened to cover pre-Workspace correspondence, is left open — see Section 16.

---

# 16. Version 1 Open Questions

Unlike Assignment Business Analysis, these are recorded as open rather than resolved — this is a Version 1 draft, not a settled design.

### Platform Administrator Representation — Open (BA-002)

- How is "this Identity is a Platform Administrator" actually represented and checked? Candidates: a flag on Identity (contradicts TD-005's own warning against a global role), a separate Staff/Operator record outside Identity entirely, or an external authorization system (e.g., an allow-list, a separate admin auth path). Needs a decision before Section 7 can be implemented as an authorized action, not just a domain sequence.

### Platform Subscription Ownership — Open (BA-004)

- Does Platform Subscription billing belong in a new "Platform Billing" capability, or is it out of this codebase entirely (e.g., handled by an external billing provider, with the platform only reacting to a webhook)? This document assumes the latter for Version 1 (an external signal) without designing it.

### Provisioning Visibility — Open (Section 9)

- Does the Admin's provisioning view (Section 9) need its own tracked entity/aggregate, or can it always be computed live from Workspace + Invitation + Membership state? Revisit once there are enough concurrent provisioning workflows for "compute it live" to become a performance or auditability concern.

### Invitation Delivery Ownership — Addressed in depth, Communication Context boundary still open (BA-005)

- Invitation Business Analysis now covers the full delivery mechanics (Entry Point / Workspace Resolution reuse, token security, resend/cancel). The narrower question of whether Communication Context's scope should eventually widen to include pre-Workspace correspondence remains open there too — no urgency while volume is low.

### Unclaimed Workspace Cleanup — Open (Section 10)

- Should a Workspace with an expired Invitation and no Owner be automatically archived after some period, or does it wait for Admin action indefinitely? Not specified.

---

# Summary

The Platform Administrator is the platform's first cross-Workspace Actor: it provisions new Workspaces for subscribed Tutors using only commands that already exist (`Workspace.Create`, the existing Invitation/Onboarding lifecycle, `Membership.Create`/`Activate`, `Workspace.TransferOwnership`), and it is the natural home for the already-implemented but currently unreachable `Suspend`/`Reactivate`/`Archive` operations on both Identity and Workspace.

It deliberately does not resolve how Admin authority is represented in the Identity/Membership model, nor design Platform Subscription billing — both are named as real, open gaps (Section 16) rather than quietly assumed. Provisioning itself, however, is fully specified and buildable against the current domain model as written.
