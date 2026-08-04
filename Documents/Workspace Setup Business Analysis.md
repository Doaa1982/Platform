# Workspace Setup Business Analysis

> Version: 1.0
>
> Status: Draft
>
> Domain: Workspace Management
>
> Document Type: Business Analysis
>
> Author: Business Analysis Team (drafted to close the gap recorded in Technical Debt Backlog, TD-009: a provisioned Workspace has no path out of `Created`)
>
> Related Documents:
>
> - Workspace Aggregate Design
> - Workspace Context
> - Platform Administrator Business Analysis
> - Invitation Business Analysis
> - Membership Aggregate Design
> - Learning Workspace Experience Architecture
> - IdentityAndWorkspaceAccess
> - Technical Debt Backlog (TD-006, TD-009)

---

# 1. Business Vision

Workspace Setup is the Workspace Owner's own journey: turning a Workspace they have just been handed into an educational business that is open for learners.

Platform Administrator Business Analysis §7 ends deliberately — *"Admin's responsibility ends here. Tutor now owns an Active-Membership Workspace and continues its own lifecycle independently."* This document describes that independent continuation, which no document in the corpus currently covers.

Where the Platform Administrator answers *"does this tenant exist and who owns it?"*, Workspace Setup answers:

> "Is this educational business ready for learners, and who says so?"

---

# 2. Business Problem

Provisioning delivers a Workspace in `Created` state with an Owner attached. Workspace Aggregate Design §15 then expects it to travel `Created → Configuring → Private → Published → Active`. Nothing in the corpus says who drives those transitions, when, or against what completion criteria.

The consequence is observable, not theoretical. Workspaces provisioned through the Platform Administrator flow sit at:

```text
lifecycle = Created | provisioning = Provisioned | owner = true
```

They are owned, they have an Active Owner Membership, and they can never become `Active`, because no Actor has been given the authority or the workflow to advance them. The only Workspace in the system that reaches `Active` does so because a development seed drives the four transitions directly in code — which is not a business process.

A second, subtler problem: **`Published` and `Active` are distinct states in Workspace Aggregate Design §15, and nothing explains the difference in business terms.** §15 justifies splitting `Private` from `Published` (public discoverability, with real consequence for Workspace Resolution) but offers no equivalent justification for `Published → Active`. Implementing the lifecycle requires knowing what that transition means — see BA-002.

---

# 3. Business Objectives

Workspace Setup shall enable a Workspace Owner to:

- Complete their Workspace Identity — name, public identifier, description, contact information.
- Configure the Workspace — language, timezone, regional settings, and default learning preferences.
- Apply branding, within the boundary Workspace Aggregate Design §8 defines.
- Choose which platform capabilities are enabled for their Workspace.
- Move their Workspace through its own lifecycle to the point where learners can enrol.
- Do all of the above without Platform Administrator involvement.

---

# 4. Business Concepts

## Workspace Setup

The Owner-driven sequence between receiving ownership and being open to learners. Not an aggregate and not a new entity — a workflow over the existing Workspace Aggregate's commands and state machine.

## Setup Completeness

Whether a Workspace holds enough information to be published. Derived, never stored: it is a question asked of the Workspace's current data, not a field maintained alongside it. See §10 for what "enough" means, and BA-003 for the part that is currently unenforceable.

## Readiness Checklist (Experience concern)

The Owner-facing presentation of Setup Completeness — what is done, what remains. Owned by Learning Workspace Experience Architecture, referenced here so that this document specifies *what must be true*, not how it is displayed.

---

# 5. Responsibilities

Workspace Setup is responsible for:

- Completing and amending Workspace Identity, Configuration and Branding.
- Managing Entry Point registration for this Workspace (when the registry exists — TD-006).
- Enabling and disabling platform capabilities for this Workspace.
- Driving the `Created → Configuring → Private → Published → Active` transitions.

Workspace Setup is **not** responsible for:

- Creating the Workspace or transferring ownership to the Owner — that is Platform Administrator Business Analysis §7, complete before this document begins.
- Platform-level `Suspend` / `Reinstate` / `Archive`, which remain the Platform Administrator's (Platform Administrator Business Analysis §5). An Owner configures their Workspace; they do not suspend it.
- Membership management inside the Workspace — invitations, roles, member lifecycle (Membership Aggregate Design; Workspace_Access_Context §4.5–4.6).
- Learning Products, Curricula or Lessons. A Workspace becomes ready to *receive* content; it does not create it.

---

# 6. Business Actors

## Workspace Owner

Holds `WorkspaceRoleName.Owner` through the Membership designated in the Workspace's Ownership Record. Drives every transition in §7 and is accountable for the Workspace being fit to publish.

## Workspace Administrator

Holds `WorkspaceRoleName.Administrator`. May perform the same configuration work — see BA-001 for why, and for the one thing they may not do.

## Platform Administrator

Appears only at the boundaries: hands the Workspace over at the start (§7 of that document), and may suspend or archive it later. Takes no part in setup itself.

## AI Assistant (Future)

May propose Workspace Identity wording, branding, or a suggested capability set from the Owner's stated subject and audience — consistent with AI Context's Workspace-native positioning. Not built in Version 1.

---

# 7. Workflow: From Handed-Over to Open

```text
Ownership transferred   (Platform Administrator Business Analysis §7 ends)
Workspace status: Created

↓

Owner begins configuration  →  Workspace.BeginConfiguration()
Workspace status: Configuring

↓

Owner completes Workspace Identity
  (name, public identifier, description, contact information)

Owner sets Workspace Configuration
  (language, timezone, regional settings, default pacing)

Owner applies Branding Configuration
  (logo reference, theme, colour tokens, typography)

Owner selects Enabled Capabilities
  (per maturity level — Learning Workspace Capability Model)

↓

Owner marks the Workspace ready  →  Workspace.MakePrivate()
Workspace status: Private
  (fully configured; not publicly discoverable; the Owner and invited
   Members can work inside it)

↓

Owner publishes  →  Workspace.Publish()
  (INV-007: requires a complete Workspace Identity and at least one
   registered, Active Entry Point — see BA-003)
Workspace status: Published

↓

Workspace becomes operational  →  Workspace.Activate()
Workspace status: Active
  (what this transition means in business terms is unresolved — BA-002)
```

Alternate flow — Owner stops partway:

```text
Workspace remains in Configuring or Private indefinitely.

No deadline, no automatic reminder, and no cleanup in Version 1. A Workspace
that is never published is a legitimate, if unproductive, state — the Owner
paid for a tenancy and may take as long as they like over it.
```

---

# 8. Configuration

## Workspace Identity

Name and Public Identifier are mandatory before publication (INV-007). Description, contact information and visibility setting are optional and amendable at any point in the lifecycle.

## Workspace Configuration

Language, timezone, regional settings and default pacing (Workspace Context §3.4). All have platform defaults; none blocks publication. An unconfigured timezone is a poor experience, not an invalid Workspace.

## Branding Configuration

Logo, theme, colour tokens, typography (Workspace Aggregate Design §8). Never blocks publication — an unbranded Workspace is valid, and Learning Workspace Experience Architecture already defines platform defaults.

## Enabled Capabilities

Which platform capabilities this Workspace uses, per Learning Workspace Capability Model. A Workspace may publish with the default set; capabilities can be turned on and off throughout its life (INV-008 governs what happens to data when one is turned off).

---

# 9. Lifecycle

Unchanged from Workspace Aggregate Design §15 — this document introduces no new Workspace states. It supplies only the missing business meaning of the four transitions the Owner drives:

| Transition | Business meaning |
|---|---|
| `Created → Configuring` | The Owner has taken possession and started work. |
| `Configuring → Private` | Configuration is complete enough to work inside. Members can be invited and content prepared; the public cannot find it. |
| `Private → Published` | The Workspace is publicly discoverable and resolvable by its Entry Points. |
| `Published → Active` | Unresolved — see BA-002. |

`Suspended`, `Archived` and `Deleted` are reachable from this lifecycle but are driven by the Platform Administrator, not the Owner (§5).

---

# 10. Business Rules

## Authority Rules

- Only a Membership holding `Owner` or `Administrator` in this Workspace may perform Workspace Setup (BA-001).
- Setup authority is Workspace-scoped and confers nothing in any other Workspace (Membership Aggregate Design, INV-005).
- Ownership cannot be given away as part of setup. Transferring ownership is its own command with its own consequences (Workspace Aggregate Design, INV-002 and INV-005).

## Completion Rules

- A Workspace cannot be published without a complete Workspace Identity — Name and Public Identifier at minimum (INV-007).
- A Workspace cannot be published without at least one registered, Active Entry Point (INV-007). **This half of INV-007 is currently unenforceable** — see BA-003 and TD-006.
- Configuration, branding and capability selection never block publication. Only identity and addressability do.

## Lifecycle Rules

- Transitions follow §15 in order. A Workspace cannot jump from `Configuring` straight to `Published` — see BA-004.
- Amending identity, configuration or branding after publication is permitted and does not move the Workspace backwards through its lifecycle. A published Workspace changing its logo is not returning to `Configuring`.
- Changing the Public Identifier of a published Workspace has Entry Point consequences (existing links stop resolving) and is deferred with the Entry Point Registry — see §16.

---

# 11. Status

For the Owner, per Workspace (unchanged from Workspace Aggregate Design §15):

- Created
- Configuring
- Private
- Published
- Active
- Suspended *(platform-driven)*
- Archived *(platform-driven)*
- Deleted *(platform-driven)*

For the Owner's setup progress — a derived view, not stored state:

- Not started
- In progress
- Ready to publish
- Published

---

# 12. Notifications

Events this workflow should raise, drawn from Workspace Aggregate Design §13:

- WorkspaceConfigured
- WorkspaceBrandUpdated
- WorkspaceCapabilityEnabled / WorkspaceCapabilityDisabled
- WorkspaceEntryPointRegistered
- WorkspacePublished

`WorkspacePublished` is the one with an audience beyond the Owner: it is the moment the Workspace becomes discoverable, and the natural trigger for any platform-level directory or metrics. Who consumes these events is not resolved here.

---

# 13. Contribution to Platform Growth

Publication — not provisioning — is the point at which a tenant becomes a functioning educational business. It is the honest denominator for:

- time from provisioning to published (how much friction setup imposes)
- proportion of provisioned Workspaces that never publish (where owners abandon)
- time from published to first enrolment

Counting provisioned Workspaces as active tenants overstates the platform's real position, precisely because the current gap lets a Workspace be owned and permanently unpublished.

---

# 14. Integration with Other Domains

| Domain | Relationship |
|---|---|
| Workspace Aggregate Design | Supplies every command and state this workflow uses. No new domain method is required. |
| Platform Administrator Business Analysis | Hands over at ownership transfer; resumes only for suspend/archive. |
| Membership Aggregate Design | Supplies the Owner/Administrator roles this workflow's authority is checked against. |
| Workspace_Access_Context | Owns Entry Points and Workspace Resolution, which INV-007's publication rule depends on. |
| Learning Workspace Experience Architecture | Owns the Readiness Checklist presentation and the branding defaults an unbranded Workspace falls back to. |
| Learning Workspace Capability Model | Supplies the capability set an Owner selects from. |
| Learning Product Context | Begins where this ends: a published Workspace is one that can now hold Learning Products. |

---

# 15. Business Decisions

## BA-001

**Both `Owner` and `Administrator` may perform Workspace Setup; only `Owner` may transfer ownership.**

Reasoning: Workspace Context §3.2 treats the Owner as accountable for the Workspace, but Membership Aggregate Design §7 lists `Administrator` as a distinct role whose purpose is administering the Workspace on the Owner's behalf. Excluding Administrators from setup would leave that role with almost nothing to do. Ownership transfer is excluded because INV-002 makes ownership singular and consequential — an Administrator who could reassign ownership could take the Workspace.

---

## BA-002

**What `Published → Active` means is left open, with a recommendation.**

Workspace Aggregate Design §15 adopts the granular Ontology sequence and justifies distinguishing `Private` from `Published`, but gives no equivalent reasoning for `Active`. Three readings are possible:

1. **Automatic** — `Active` follows publication immediately and carries no independent meaning. Simplest, and makes the state redundant.
2. **First real use** — `Active` means the Workspace has genuine activity: a published Learning Product, or a first enrolment. Gives the state real meaning, but makes Workspace depend on Learning Product and Enrollment, which Workspace Aggregate Design §6 explicitly refuses.
3. **Owner-declared** — the Owner says when they are open for business, as a deliberate act distinct from being discoverable.

**Recommendation: reading 3.** It keeps the Workspace Aggregate free of dependencies it has already rejected, gives `Active` a meaning `Published` does not have, and matches the business reality that being findable and being open are different things. Reading 1 is the fallback if the distinction proves to carry no weight in practice — in which case §15 should be amended to drop the state rather than leaving it vestigial.

**This needs a maintainer's ruling before implementation.**

---

## BA-003

**INV-007's Entry Point requirement is currently unenforceable, and Version 1 enforces only the identity half.**

INV-007 requires a complete Workspace Identity *and* at least one registered, Active Entry Point before publication. The Entry Point Registry is not implemented (TD-006), so the second condition cannot be checked.

**Recommendation:** treat the Workspace's Public Identifier as an implicit platform-subdomain Entry Point for Version 1. Every Workspace has one, it is already unique, and it is genuinely how a Workspace is addressed today — so the rule's *intent* (a published Workspace must be reachable) holds, even though its stated mechanism does not exist yet. Formalise it as a real Entry Point record when custom domains arrive, at which point INV-007 becomes enforceable as written.

This is recorded rather than quietly ignored: the code today enforces name and slug only, and a reader of INV-007 would otherwise reasonably assume both halves are checked.

---

## BA-004

**The lifecycle is strictly ordered; publication cannot skip `Private`.**

An Owner might reasonably want to configure and publish in one action. Version 1 refuses, because `Private` is the only state in which a Workspace can be worked in — members invited, content prepared — before the public can find it. Collapsing it would remove the rehearsal step that makes a good first impression possible. A future convenience action may perform both transitions in one request, but as two transitions, not one.

---

## BA-005

**Setup Completeness is derived, never stored.**

A stored completion flag can disagree with the data it summarises, and then must be repaired. Asking the question of current state cannot drift. This mirrors the treatment of the Platform Administrator's provisioning view (Platform Administrator Business Analysis §9), which is composed rather than tracked for the same reason.

---

# 16. Version 1 Open Questions

### `Published → Active` semantics — Open (BA-002)

Needs a ruling before the transition can be implemented as anything other than an automatic no-op.

### Entry Point Registry — Deferred (BA-003, TD-006)

INV-007 cannot be fully enforced until it exists. The implicit-subdomain recommendation is a stopgap, not a resolution.

### Changing a Public Identifier after publication — Open

Existing invitation links and any external references resolve through the identifier. Whether a change is forbidden, permitted with a redirect, or permitted destructively is not specified. No urgency while no Workspace has external traffic.

### Abandoned setup — Open

A Workspace can sit in `Configuring` forever. Whether the platform should prompt, escalate to the Platform Administrator, or ignore it is unspecified. Related to Platform Administrator Business Analysis's own open question on unclaimed Workspace cleanup, though that one concerns Workspaces with no Owner at all — this one has an Owner who simply stopped.

### Publication approval — Not required, worth revisiting

Version 1 lets an Owner publish unilaterally. If the platform ever curates what appears in a public directory, a review step would belong here rather than in the aggregate.

---

# Summary

Workspace Setup is the Owner's half of tenant creation, and the half the corpus had not described. Platform Administrator Business Analysis deliberately stops at ownership transfer; this document picks up there and carries a Workspace to the point where learners can enrol.

It introduces no new aggregate, entity or state — every command and transition it uses already exists in Workspace Aggregate Design. What was missing was business meaning: who may drive the lifecycle, what must be true to publish, and what each transition signifies.

Two things are deliberately left open rather than assumed: what `Published → Active` means (BA-002), and how INV-007's Entry Point requirement is satisfied before the registry exists (BA-003). Both are recorded as needing a ruling, because implementing either on a guess would bake an accidental decision into the platform's tenant lifecycle.
