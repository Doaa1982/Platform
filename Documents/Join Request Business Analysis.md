# Join Request Business Analysis

> Version: 1.1
>
> Status: Draft
>
> Domain: Workspace Access
>
> Document Type: Business Analysis
>
> Author: Business Analysis Team (drafted to close the gap recorded in Technical Debt Backlog, TD-010: nobody can ask to join a Workspace)
>
> Revision Note (v1.1): Added BA-007, resolving Section 16's former "Where requesters find Workspaces" open question — the platform provides no directory or discovery of any kind, by permanent decision rather than Future scope. See ExperienceArchitecture.md, ADR-EA-002.
>
> Related Documents:
>
> - Invitation Business Analysis
> - Membership Aggregate Design
> - Workspace Aggregate Design
> - Workspace Setup Business Analysis
> - Workspace_Access_Context
> - IdentityAndWorkspaceAccess
> - Identity Aggregate Design
> - Enrollment_Aggregate_Design
> - ExperienceArchitecture
> - Technical Debt Backlog (TD-006, TD-010, TD-013)

---

# 1. Business Vision

A Join Request is a person asking to be let in.

Invitation Business Analysis covers the platform's only current path into a Workspace, and it runs one way: somebody already inside decides they want you, and sends a link. A Join Request is the inverse — an unsolicited approach from someone outside, which a Workspace's own people then accept or refuse.

> Invitation says: **"We want you."**
> Join Request says: **"I want in."**

Both end at the same place — an Active Membership — but they start from opposite sides of the boundary, and that difference decides who holds authority at every step.

---

# 2. Business Problem

Publishing a Workspace makes it publicly discoverable (Workspace Aggregate Design §15, and the `Private` / `Published` distinction §15 exists specifically to justify). Today, discovery leads nowhere: a person who finds an academy has no way to approach it. They must wait to be invited by someone who does not yet know they exist.

This is a closed loop. Every Membership in the system originates with a decision made inside the Workspace, which means a Workspace can only grow by reaching outward and never by being found.

Two smaller consequences follow:

- **`Workspace.Visibility` and the `Published` state do almost no work.** They make a Workspace discoverable, but nothing can act on that discovery, so the effort of publishing has no outward payoff.
- **There is no route to Membership for a person the Workspace has never heard of.** Invitation requires the sender to know an email address. That is a reasonable assumption for a colleague and a poor one for a prospective learner.

---

# 3. Business Objectives

Join Requests shall enable:

- A person who has found a published Workspace to ask to join it, stating who they are.
- A Workspace Owner or Administrator to see pending requests and approve or decline them.
- Approval to produce an Active Membership without any further step from the requester.
- A Workspace to refuse the whole idea — an academy that only wants invited members should not acquire a queue it never asked for.

---

# 4. Business Concepts

## Join Request

A person's unsolicited request to join one Workspace, awaiting a decision by that Workspace. Holds the requester's identifying details, the Workspace, the requested role, an optional message, and its own status.

**A Join Request is not a Membership** and confers nothing. It is a request for one, exactly as an Invitation is an intention to create one and not the thing itself (Workspace_Access_Context §4.5).

## Requester

The person asking. May or may not already own an Identity — see BA-003.

## Reviewer

The Owner or Administrator who decides. The same authority that manages members and invitations (Workspace Setup Business Analysis, BA-001).

---

## What a Join Request is NOT — three easily-confused neighbours

These three concepts all sit near Membership creation and are routinely conflated. Stating the boundaries here is cheaper than untangling them later.

| Concept | Direction | Exists when | Produces |
|---|---|---|---|
| **Invitation** | Workspace → person | The Workspace decided first | A Membership on acceptance |
| **Join Request** | Person → Workspace | The person decided first | A Membership on approval |
| **Onboarding Request** | — | *After* an Invitation is accepted | Nothing directly — it drives Identity Resolution (WA-105) |
| **Enrollment** | — | *After* a Membership exists | Registration for one Learning Product |

**Onboarding Request** (Workspace_Access_Context §4.6) is the step that resolves whether an accepting person already owns an Identity. It is a mechanism inside acceptance, not a way in. A Join Request that is approved runs the same Identity Resolution — so Onboarding Request serves both paths and is not duplicated by this document.

**Enrollment** (Enrollment Aggregate Design) is downstream of Membership entirely. Joining a Workspace does not enrol anyone in anything; a Membership may exist with zero Enrollments.

---

# 5. Responsibilities

The Join Request is responsible for:

- Recording who is asking, of which Workspace, for what role, and why.
- Its own lifecycle from submission to decision.
- Ensuring one person cannot flood one Workspace with parallel requests.

It is **not** responsible for:

- Creating or activating the Membership — that is Membership Aggregate Design's, invoked on approval.
- Identity Resolution — Identity Context's, reused unchanged from the invitation path.
- Deciding whether a Workspace accepts requests at all — that is Workspace configuration (BA-005).
- Anything about Learning Products or Enrollment.

---

# 6. Business Actors

## Requester

Finds a published Workspace, submits a request, waits. May withdraw it before a decision. Receives the outcome.

## Workspace Owner / Administrator

Reviews the queue and decides. Under no obligation to decide at all — see §10, Expiry Rules.

## Identity Context

Resolves whether the requester's email already owns an Identity — not on approval, but
when the resulting Invitation is later accepted, the same moment and the same code path
any other Invitation acceptance uses. Referenced, not owned, by this document.

> **Corrected 2026-08-08 (TD-018).** This entry previously said "on approval." Approval
> only issues an Invitation (`JoinRequestService.ApproveAsync` → `WorkspaceMemberService.
> InviteAsync`); neither touches an Identity. See §7 for the corrected sequence.

## AI Assistant (Future)

Might summarise a request, flag duplicates, or suggest a decision from the Workspace's history. Not built in Version 1.

---

# 7. Workflow: Person Asks, Workspace Answers

```text
Person finds a Published Workspace
  (Workspace.Visibility = Published; a Private or Configuring
   Workspace is not discoverable and cannot be requested — BA-005)

↓

Person submits a Join Request
  (name, email, optional message — no password, and nothing
   about the requester's Identity is touched yet)

Join Request status: Submitted
  (the requester is a member of nothing, and owns no Identity
   yet either — see §16, "Checking back without an Identity")

↓  reviewer decides

┌───────────────────────────────┬────────────────────────────┐
│  APPROVED                     │  DECLINED                  │
│                                │                            │
│  An Invitation is issued to   │  No Invitation created.    │
│  the requester's email —      │  Requester is told the     │
│  WorkspaceMemberService.      │  outcome, not the reason   │
│  InviteAsync, the identical   │  (BA-006).                 │
│  path a direct invite uses.   │                            │
│  Approval alone creates       │  (no Identity or            │
│  no Membership.                │   Membership exists         │
│         ↓                     │   for this email unless    │
│  Requester must separately    │   one already did)          │
│  accept that Invitation.      │                            │
│         ↓                     │                            │
│  Identity Resolution runs     │                            │
│  HERE, on acceptance          │                            │
│  (ProvisioningService.        │                            │
│  AcceptAsync):                │                            │
│    · no Identity for this     │                            │
│      email → create one       │                            │
│    · Identity already exists  │                            │
│      → the password given at  │                            │
│      acceptance must match it │                            │
│         ↓                     │                            │
│  Membership.Create(Learner)   │                            │
│  Membership.Activate()        │                            │
│  → Membership: Active         │                            │
└───────────────────────────────┴────────────────────────────┘
```

> **Corrected 2026-08-08 (TD-018), superseding the 2026-08-05 correction below.** The
> 2026-08-05 note argued for BA-003's submission-time model over the diagram's own former
> approval-time claim. Neither is what was built. The actual implementation is simpler
> than both: `SubmitAsync` collects no password and never touches an Identity;
> `ApproveAsync` issues an Invitation and stops — no Membership yet, nothing "in one step."
> Identity Resolution and Membership creation both happen together, but only when that
> Invitation is separately accepted, reusing `ProvisioningService.AcceptAsync` exactly as
> written for any other Invitation. BA-003 and BA-004 are corrected in place below rather
> than treated as still-operative.
>
> **Superseded — kept for the record, 2026-08-05.** Version 1.0 of this document placed
> Identity Resolution at approval in this diagram, contradicting BA-003, which places it
> at submission. BA-003 is operative: its own reasoning depends on the Identity existing
> before a decision is made ("an Identity with no Membership can do nothing but log in and
> see an empty workspace list"). Resolving at approval would also leave a requester unable
> to check back on their own request, which is the thing BA-003's whole trade-off buys.

Alternate flow — requester changes their mind:

```text
Join Request: Submitted

↓ (requester withdraws)

Join Request: Withdrawn
  (no decision was made; the Workspace's queue simply loses the item)
```

---

# 8. Configuration

## Accepting Requests

Per Workspace, off by default (BA-005). An Owner turns it on deliberately.

## Requestable Roles

`Learner` only in Version 1 (BA-002). Not configurable — widening it is a design decision, not a setting.

## Request Message

Optional free text from the requester. Length-limited. Present so a reviewer has something to decide on beyond a name.

---

# 9. Lifecycle

```text
Submitted

├──→ Approved    → Membership created and activated
├──→ Declined
└──→ Withdrawn   (by the requester, before any decision)
```

`Submitted` is the only open state. `Approved`, `Declined` and `Withdrawn` are terminal and mutually exclusive — a request reaches exactly one.

There is deliberately **no `Expired` state** — see §10.

---

# 10. Business Rules

## Submission Rules

- A Join Request may only be made against a Workspace whose Visibility is `Published` (BA-005). You cannot ask to join something you were never able to find.
- A Workspace must have join requests enabled. Otherwise the request is refused as though the Workspace were not accepting — which it is not.
- At most one `Submitted` Join Request may exist per (person, Workspace). A second submission while one is open is refused, not queued.
- A person who already holds an Active Membership in that Workspace cannot request to join it. The answer is that they are already in.
- A person whose Identity is Suspended or Archived cannot submit a request.

## Decision Rules

- Only an Owner or Administrator of that Workspace may approve or decline (BA-001, Workspace Setup Business Analysis).
- Approval runs Identity Resolution, then creates and activates the Membership in one step (BA-004).
- Approval grants exactly the role recorded on the request — a reviewer who wants to grant something else approves and then assigns the role, which is an ordinary member-management action with its own audit trail.
- Declining creates nothing and is terminal. A reviewer who changes their mind invites the person instead.

## Expiry Rules

- Join Requests do **not** expire. An Invitation expires because it carries a credential that should not stay valid forever (Invitation Business Analysis §8). A Join Request carries no credential — it grants nothing until someone acts on it — so nothing is made safer by timing it out.
- An unanswered request is the reviewer's backlog, not the requester's problem. Surfacing the age of a request is an Experience concern.

## Re-request Rules

- After a decline or withdrawal, a person may submit again. Whether a cooldown should apply is open — see §16.

---

# 11. Status

For the Requester:

- Submitted
- Approved
- Declined
- Withdrawn

For the Reviewer, per Workspace:

- Pending requests (count and list)
- Nothing else — decided requests leave the queue

---

# 12. Notifications

- JoinRequestSubmitted — to the Workspace's Owner and Administrators
- JoinRequestApproved — to the requester
- JoinRequestDeclined — to the requester
- JoinRequestWithdrawn — to the Workspace

Delivery is the same platform-level notification concern established for invitations (Platform Administrator Business Analysis, BA-005), and inherits the same open question about Communication Context's boundary.

---

# 13. Contribution to Platform Growth

Join Requests are the first mechanism by which a Workspace can grow without its owner doing the reaching. That makes two things measurable for the first time:

- whether publishing a Workspace produces any inbound interest at all
- the conversion from request to Active Membership, and how long reviewers take

Both are honest signals of whether public discoverability is worth anything — a question the platform currently cannot answer, because discovery leads nowhere.

---

# 14. Integration with Other Domains

| Domain | Relationship |
|---|---|
| Membership Aggregate Design | Approval calls `Membership.Create` and `Activate`. No new membership state is required (BA-004). |
| Invitation Business Analysis | The mirror-image path. Deliberately kept separate (BA-001). |
| Workspace Aggregate Design | Supplies the `Published` visibility this depends on, and would own the accepting-requests setting (BA-005). |
| Workspace Setup Business Analysis | Supplies the Owner/Administrator authority reviewers are checked against. |
| Identity Aggregate Design | Identity Resolution on approval; possible Identity creation (BA-003). |
| Workspace_Access_Context | Owns Onboarding Request, which this reuses rather than duplicates. |
| Enrollment Aggregate Design | Strictly downstream. A new Member has enrolled in nothing. |

---

# 15. Business Decisions

## BA-001

**A Join Request is its own aggregate, not a flag on Invitation.**

Reasoning: they share only their outcome. The initiating actor, the authority that decides, the presence or absence of a credential, the expiry behaviour, and the terminal states all differ. Modelling them as one concept with a `direction` flag would make almost every rule conditional on that flag, which is how a single concept quietly becomes two badly-specified ones.

---

## BA-002

**Only `Learner` may be requested in Version 1.**

Reasoning: requesting `Teacher`, `Administrator` or `FinanceManager` is a claim to authority over other people's work, and nothing in a self-submitted request substantiates it. Those roles stay invitation-only, where somebody inside vouches first. A reviewer who wants to grant more approves the request and then assigns the role deliberately — two acts, and the second is auditable as a role assignment rather than hidden inside an approval.

---

## BA-003

**A Join Request creates an Identity if the requester has none — recommended, with its cost stated.**

The alternative is requiring an Identity first, which is circular: the platform has no self-serve signup, so the only way to get an Identity today is to accept an invitation. Requiring one would mean only already-invited people could request to join.

So the request itself carries name, email and password, and creates the Identity on submission — reusing exactly what invitation acceptance already does for a person with no account.

**The cost, stated plainly:** this makes Identity creation self-serve and therefore abusable. Anyone could create Identity records at will. Version 1 accepts that on the grounds that the surface is small (an Identity with no Membership can do nothing but log in and see an empty workspace list), but it should not stay unguarded — see §16 on verification and rate limiting.

> **Corrected 2026-08-08 (TD-018).** Not what was built. `SubmitAsync` collects `FullName`,
> `Email` and an optional `Message` only — no password field exists on `SubmitJoinRequest`
> — and never touches `db.Identities`. Identity Resolution was deferred entirely to
> Invitation acceptance instead (§7's corrected diagram; `ProvisioningService.AcceptAsync`),
> reusing that path unchanged rather than duplicating it here, which is what §5 ("Identity
> Resolution — Identity Context's, reused unchanged from the invitation path") already said
> was the intent. The stated cost above does not apply to what shipped: anonymous
> submission cannot create an Identity record at all, so there is nothing self-serve to
> abuse on this path. §16's "Abuse control on Identity creation" question is corrected to
> match.

---

## BA-004

**Approval creates the Membership and activates it in one step. The Join Request holds the pending semantics, not the Membership.**

This corrects an assumption worth naming: it was initially expected that Join Requests would give `MembershipStatus.Pending` a persistent life, since nothing currently produces a Membership that waits. They do not — and should not. The waiting happens in the Join Request's own `Submitted` state, and once a reviewer has approved, there is nothing further to wait for. Leaving the Membership `Pending` after approval would invent a second confirmation nobody asked for.

`MembershipStatus.Pending` therefore remains without a persistent producer after this document. Its natural producers are bulk import and any future flow requiring a member to complete something before access begins — neither of which is in scope here.

> **Corrected 2026-08-08 (TD-018).** "In one step," and "the Membership never waits," are
> both still true — but not *at approval*. Approval only issues an Invitation
> (`JoinRequestService.ApproveAsync` → `WorkspaceMemberService.InviteAsync`); there is
> something further to wait for, namely the requester accepting that Invitation.
> `Membership.Create()` and `.Activate()` do still happen together, with no `Pending` gap
> between them — just inside `ProvisioningService.AcceptAsync`, at acceptance, not
> approval. This decision's core claim (no persistent `Pending` producer here) is
> unaffected; only "once a reviewer has approved, there is nothing further to wait for" is
> wrong and should be read as "once the requester has accepted the resulting Invitation."

---

## BA-005

**Join requests are off by default, per Workspace.**

An academy that intends to work only with invited people should not silently acquire a queue of strangers. Making it opt-in also means the feature cannot surprise the Workspaces that already exist.

This belongs with Enabled Capabilities (Workspace Aggregate Design §7), which is not yet implemented (TD-006). Until it is, the setting lives as a plain Workspace configuration flag and moves to a capability when the registry arrives.

---

## BA-006

**A decline tells the requester the outcome, not the reason.**

Reasoning: a reason is either boilerplate, which is worse than nothing, or genuinely specific, which invites argument and exposes the Workspace's internal judgement to someone outside it. Reviewers who want to explain can invite the person and say so directly. Version 1 keeps the refusal clean.

---

## BA-007

**The platform never helps a requester find a Workspace. Discovery happens entirely off-platform, permanently, not as a Future gap.**

This document's own premise — "a person has already found a published Workspace" — previously left open how that happens. It is now decided: there is no public directory, search, or "browse academies" feature anywhere on the platform, in this or any future version, and none is planned. A Requester learns a Workspace exists only through that Workspace's own off-platform marketing — a shared link, a social post, a website the Tutor runs themselves — never through the platform surfacing it on their behalf.

Reasoning: this platform's paying customer is the Tutor, who brings their own students (Platform Administrator Business Analysis, Section 1; ExperienceArchitecture.md, ADR-EA-002, Business Model Note). Providing discovery would put the platform in competition with its own customers for their students' attention — the same reasoning Shopify applies by giving merchants a signup site with no consumer-facing store directory.

**Consequence for `Workspace.Visibility`:** `Published` continues to mean only "not hidden from someone who already has the link," per Workspace Aggregate Design §15 — it does not mean "listed" anywhere, and BA-005's per-Workspace opt-in for accepting Join Requests governs a separate concern (whether a found Workspace accepts unsolicited requests at all, not how it was found).

---

# 16. Version 1 Open Questions

### Abuse control on Identity creation — Moot for Version 1 (TD-018)

**Corrected 2026-08-08.** This question assumed `SubmitAsync` creates an Identity, per
BA-003's original text. It does not — see BA-003's correction note. Anonymous submission
never reaches `db.Identities`, so there is no self-serve Identity creation on this path to
verify or rate-limit for that reason. Rate limiting on the endpoint remains, justified
instead on the narrower ground already stated in §5 (bounding junk `JoinRequest` rows and
reviewer-queue noise) — see `RateLimitPolicies.cs`.

### Checking back without an Identity — Open (new, 2026-08-08, found via TD-018)

The workflow diagram (§7) previously claimed "the requester can now sign in and see their
pending request" immediately after submission — true only under BA-003's unbuilt
submission-time design, where an Identity (and therefore a login) would already exist.
Under what is actually built, submission creates neither an Identity nor any credential,
and `JoinRequestsController` has no `GET` route for an individual request by id or by
token. A requester who has submitted has, today, no way to check their own request's
status at all — not by signing in (nothing to sign in with), not by any status link (none
is issued). TD-011's "token-bearing status link" pattern (shared with Tutor Signup
Request's `SecureToken` mechanism) is the natural fit if this is worth building; it is not
designed here.

### Re-request cooldown — Open

A declined person may currently submit again immediately. Whether that needs a cooldown, a limit, or nothing at all depends on volumes nobody has observed yet.

### Where requesters find Workspaces — Resolved (BA-007)

This document assumes a person has already found a published Workspace. How they find one is now settled: never through the platform itself. See BA-007.

### Notification delivery — Inherited

Same open boundary as invitations: platform-level notification versus widening Communication Context (Platform Administrator Business Analysis, BA-005).

---

# Summary

Join Requests give the platform its first inbound path to Membership. Everything today runs outward — somebody inside decides, and reaches out — which means a published Workspace can be found but not approached.

The design deliberately keeps the concept separate from Invitation rather than generalising the two into one bidirectional thing (BA-001), restricts what may be requested to `Learner` (BA-002), and refuses to invent a second confirmation step after approval (BA-004).

One decision carries real risk and is stated rather than buried: allowing a Join Request to create an Identity makes account creation self-serve for the first time (BA-003). That is what makes the feature work for strangers, and it is also the thing that needs verification and rate limiting before this is exposed publicly (§16).
