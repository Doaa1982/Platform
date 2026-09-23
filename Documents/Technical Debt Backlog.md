# Technical Debt Backlog

Deferred items — known, deliberately postponed, not blocking. Each entry records
*why* it was deferred and the **trigger** that should bring it back into scope, so
nothing gets rediscovered from scratch later.

Status values: `Deferred` · `In Progress` · `Done` · `Dropped`

---

## TD-001 — `Jwt:Key` is missing outside Development

**Raised:** 2026-08-04 (Tutor Login API verification)
**Area:** Platform.Api — configuration / deployment
**Severity:** Blocker *at deploy time*, harmless before it
**Status:** Deferred

`Jwt:Key` is defined only in `appsettings.Development.json`. `appsettings.json` has
no `Jwt` section, so `Program.cs` throws `InvalidOperationException` at startup in
any non-Development environment.

This is correct fail-fast behaviour, not a bug — the app refuses to run with an
unsigned/defaulted key rather than silently accepting one. It is deferred only
because there is no deployment target yet.

Also note the dev key is committed in plaintext. That is acceptable for a local-only
dev secret, but it must **not** become the production value.

**Trigger:** first deployment to any shared/hosted environment.
**Resolution sketch:** source the key from user-secrets locally and from the
environment / a secret store (Aspire parameter, key vault) per environment. Keep the
startup throw — do not add a fallback default.

---

## TD-002 — JWT bearer middleware is configured but unexercised

**Raised:** 2026-08-04 (Tutor Login API verification)
**Area:** Platform.Api — authentication
**Severity:** Low — verification gap, not a defect
**Status:** Done (2026-08-04)

Authentication is registered and the pipeline calls `UseAuthentication()` /
`UseAuthorization()`, but no endpoint carries `[Authorize]`. Token *issuance* is
proven end-to-end; token *validation* is not exercised by any request.

Issuance and validation read the same `Jwt:Key` / `Jwt:Issuer` / `Jwt:Audience`
config keys, so they agree by construction. The risk is low.

**Closed** by `GET /api/me` and `GET /api/me/workspaces/{slug}` on `MeController`,
the first `[Authorize]` endpoints. Verified against a live API: no token → 401,
tampered token → 401, valid token → 200. Token validation is now exercised on every
request to those routes.

---

## TD-003 — Misleading "constant-time check" comment in AuthController

**Raised:** 2026-08-04 (Tutor Login API verification)
**Area:** Platform.Api — `Controllers/AuthController.cs`
**Severity:** Low (the comment); Low-Moderate (the underlying leak)
**Status:** Deferred

The comment claims a constant-time check, but `identity is null || !BCrypt.Verify(...)`
short-circuits: an unknown email returns *without* ever running a bcrypt comparison,
while a known email pays the full hash cost. The response bodies are correctly
identical, so the leak is timing-only — but it permits email enumeration.

**The comment is the more urgent half.** As written it tells a future reader the
concern is already handled, which is how a real hardening gap survives review.

Deferred because enumeration pressure is negligible at current scale (one seeded
test identity, no public signup).

**Trigger:** public signup/login exposure, a security review, or simply the next
time someone edits this file.
**Resolution sketch:** always run a bcrypt verify — compare against a fixed dummy
hash when no identity is found — so both paths cost the same. Then correct or
remove the comment. Consider rate limiting on the login route at the same time.

---

## TD-004 — `Credential` value object and Identity domain events not implemented

**Raised:** 2026-08-04 (Tutor Login API verification)
**Area:** Platform.Domain — Identity aggregate
**Severity:** Informational — scope question, not a defect
**Status:** Deferred (confirmed 2026-08-05 — intent settled, not an open question)

The Tutor Login API plan's architecture overview mentioned a `Credential` value
object and Identity domain events. The plan's itemised changes never specified
them, and they were not built. `Identity` currently models the Email/Password
credential as a flat `PasswordHash` property.

Per Identity Aggregate Design §4, INV-005 ("an Identity may hold multiple
Credentials"), a flat `PasswordHash` cannot represent more than one credential —
so this becomes real work as soon as a second credential type appears.

**Confirmed deferred (2026-08-05).** This is settled, not undecided: the work is real
(a `Credential` collection, an EF mapping change and a data migration) and has no
consumer today. A flat `PasswordHash` is the correct shape while exactly one credential
type exists. Revisit when the trigger fires, and not before.

**Trigger:** adding a second credential type (SSO, magic link, OAuth), or wiring
the first consumer of Identity domain events.
**Resolution sketch:** promote `PasswordHash` to a `Credential` value object
collection keyed by credential type; raise `IdentityCreated` / `CredentialAdded`
events from the aggregate. Requires an EF mapping change and a data migration.
Confirm intent against Identity Aggregate Design before starting.

---

## TD-005 — `Identity.Role` is global, contradicting the Membership-scoped role model

**Raised:** 2026-08-04 (frontend architecture review — one app vs. two)
**Area:** Platform.Domain — `IdentityRole.cs`, `Identity.cs`; Platform.Api — JWT `role` claim
**Severity:** Moderate — forces rework once authorization becomes real
**Status:** Done (2026-08-04)
**Related:** TD-004 (same aggregate, same root cause — Identity carrying what Membership owns)

`Identity` holds a single global `IdentityRole` (`Tutor | Learner | Admin`), and
`AuthController` writes it into the JWT as a `ClaimTypes.Role` claim. The target
design says roles do not live on Identity at all:

- Identity Aggregate Design §5 — Identity is *not* responsible for "Workspace-specific
  roles, permissions, or status (Membership Aggregate)" (line 52).
- Identity Aggregate Design — Identity "does not own: Workspace Membership, roles,
  permissions, enrollments, or any Workspace-scoped data" (line 86, ID-101–ID-105).
- Membership Aggregate Design — roles are held by Membership, scoped entirely to one
  Workspace (line 264), drawn from Owner / Administrator / Teacher / Assistant Teacher
  / Learner / Parent / Finance Manager (line 114), and a Membership **may hold several
  simultaneously** (line 118).
- IdentityAndWorkspaceAccess GP-005 (line 121) — one Identity participates in many
  Workspaces.

**Consequences of the current shape:**

1. A person who teaches in one Workspace and learns in another cannot be represented —
   the enum permits exactly one global role.
2. The three-value enum cannot express the seven-plus documented role names, nor
   multiple concurrent roles.
3. The JWT `role` claim is unscoped: it names a role without naming the Workspace it
   applies to, so it cannot support an authorization decision once more than one
   Workspace exists.

**Note:** the doc comment in `IdentityRole.cs` cites "Identity Aggregate Design,
Section 7" as authority for roles being global. That citation is incorrect — §7 is the
*Entities* section covering Credential, and the document states the opposite. Remove
the comment along with the fix so it does not mislead a future reader.

Deferred deliberately: the global role was a reasonable bootstrap for standing up
login against a single seeded identity, and there is no Workspace or Membership
implementation yet to scope a role against.

**Resolution as built (2026-08-04):**

- `Identity.Role` and the `IdentityRole` enum are removed. Roles now live on
  `Membership` as a `WorkspaceRole` collection, using the seven role names from
  Workspace Access Context §4.4.
- **Token model chosen: identity-level token with per-request role resolution.** The
  JWT carries `sub`, `email`, `name` and no role claim. `WorkspaceAccessService`
  resolves roles from Membership per request against a named Workspace.
- `LoginResponse` no longer returns `Role` — a breaking API change made while it had
  no consumers.
- The misleading "Section 7" comment was removed with the enum.

**Follow-up — platform-level Admin has no home.** The old enum's `Admin` value was
dropped along with it. `WorkspaceRoleName.Administrator` is Workspace-scoped and is
*not* a replacement: it confers nothing platform-wide. If platform staff / support
access is ever needed, it must be modelled deliberately rather than by reinstating a
global role on Identity. No design doc in the corpus currently covers it.

**Follow-up resolved (2026-08-04):** Platform Administrator Business Analysis now
covers this Actor. The "one app vs. two" framing this item was raised under is
resolved separately by ExperienceArchitecture.md, ADR-EA-001 (one Application for
Learner + Workspace Owner Portals; Administrator Portal named as a reasonable
candidate for its own Application, not decided there).

---

## TD-006 — Workspace and Membership configuration surfaces not implemented

**Raised:** 2026-08-04 (Workspace + Membership implementation)
**Area:** Platform.Domain — `Workspace.cs`, `Membership.cs`
**Severity:** Low — deliberate scope reduction, not a defect
**Status:** Deferred

The aggregates were built as the core slice needed to move roles onto Membership
(TD-005). These specified parts were intentionally left out:

**Workspace** (Workspace Aggregate Design §7–8): Entry Point Registry, Enabled
Capabilities, Branding Configuration, Workspace Configuration (language, timezone,
regional settings, pacing defaults), and Workspace Identity's Contact Information
and Visibility Setting.

**Membership** (Membership Aggregate Design §7–8): Permissions (the resolved
effective permission set), Membership Metadata Origin, and Membership Preferences.

**Consequence — one invariant is only half-enforced.** INV-007 requires a Workspace
to have both a complete Workspace Identity *and* at least one registered, Active
Entry Point before it can be Published. `Workspace.Publish()` enforces only the
Name + Slug half; the Entry Point half cannot be checked because the registry does
not exist. INV-006 (an Entry Point value resolves to exactly one Workspace) is
approximated for now by a unique index on `Slug`.

**Also true on the frontend (confirmed 2026-08-15).** `WorkspaceSetupScreen.jsx`
(built 2026-08-09, closing TD-009) has no sections for Workspace Configuration,
Branding, or Enabled Capabilities either — it only exposes Identity (name, slug,
description) and the lifecycle stepper. That is not a separate gap; it is this
same deferral showing up one layer up, since a screen cannot render fields the
aggregate does not yet carry. Noted here so a future pass triggered by this
entry knows there is frontend work to do as well as domain work — see the
Workspace Setup Screen — Gap Analysis document for the full comparison.

**Trigger:** custom domains / Workspace resolution (Entry Points), maturity-model
tiering (Capabilities), or workspace theming (Branding). Permissions become
necessary at the first real authorization decision.
**Resolution sketch:** add each as its own entity/value object per the design docs.
Restore the full INV-007 check inside `Publish()` once the Entry Point Registry
exists. Extend `WorkspaceSetupScreen.jsx` with a section per field once its
backing data exists.

---

## TD-007 — Contradiction in Membership Aggregate Design: Pending → Archived

**Raised:** 2026-08-04 (Workspace + Membership implementation)
**Area:** Documentation — `Documents/Membership Aggregate Design.md`
**Severity:** Low — needs an author's ruling, cheap to fix either way
**Status:** Done (2026-08-05)

The document contradicts itself on a single transition:

- **§15 (State Machine)** lists "Active or Pending ↓ Archived" — Pending → Archived
  is legal.
- **§14, INV-002** gives as its example of an *illegal* transition "Pending directly
  to Archived without passing through Active or Removed."

`Membership.Archive()` follows §15 (permitting Pending → Archived) on the grounds
that the state machine diagram is the normative specification and INV-002's clause
is an illustrative parenthetical. That choice is recorded in the method's doc
comment.

The business question is real: should a Pending invitation that is never accepted be
archivable directly, or must it first be Removed? Archiving un-accepted invitations
directly seems the more natural business behaviour, which also favours §15.

**Ruling (2026-08-05): §15 is normative — `Pending → Archived` is legal.**

Archiving an invitation that was never accepted is ordinary business behaviour, and
forcing it through `Removed` first would misrepresent what happened. INV-002's example
has been replaced in `Membership Aggregate Design.md` with transitions §15 genuinely
forbids (`Removed → Active`, `Archived → anything`), and a note records that §15 wins
where the two disagree.

No code change: `Membership.Archive()` already permitted Active and Pending, and the
method's doc comment already pointed at this contradiction.

---

## TD-008 — Contradiction in Invitation state machine: two documents, two lifecycles

**Raised:** 2026-08-04 (Invitation Business Analysis)
**Area:** Documentation — `Documents/Workspace_Access_Context.md` §4.5, `Documents/IdentityAndWorkspaceAccess.md` §1
**Severity:** Low — needs an author's ruling, same shape as TD-007
**Status:** Done (2026-08-05)

The two documents describe the Invitation lifecycle differently:

- **Workspace_Access_Context §4.5** — `Created → Sent → Accepted → Membership Created`, or
  `Created → Expired`. No `Cancelled` state.
- **IdentityAndWorkspaceAccess §1 ("Workspace Invitation")** — `Draft → Issued → Delivered →
  Accepted → Expired → Cancelled`, plus a field list (Invitation Identifier, Invitation Token,
  Workspace, Intended Role, Intended Learning Product, Expiration Date, Invitation Status,
  Issued By, Issued At) and rules WA-101–WA-105, including WA-104 ("Invitations may be
  cancelled before acceptance") — a capability the other document's state machine has no
  state for.

Invitation Business Analysis (Section 9) works around this rather than silently picking one:
it adopts Workspace_Access_Context §4.5 as the base (the more recent document, and the one
Membership Aggregate Design already builds on) and adds `Cancelled` from IdentityAndWorkspaceAccess
to satisfy WA-104, giving `Created → Sent → {Accepted | Expired | Cancelled}`. `Draft` and the
`Issued`/`Delivered` split are treated as finer-grained sub-steps of `Created`/`Sent`, not
separately tracked states, for Version 1.

**Ruling (2026-08-05): Invitation Business Analysis §9 is normative.**

`Created → Sent → {Accepted | Expired | Cancelled}`. Both source documents now carry a note
pointing at it:

- **Workspace_Access_Context §4.5** gained the missing `Cancelled` branch — its absence left
  WA-104 ("Invitations may be cancelled before acceptance") describing a capability with no
  state to occupy. Expiry now branches from `Sent` rather than `Created`, since an Invitation
  that was never sent expires to no purpose.
- **IdentityAndWorkspaceAccess §1** keeps its six-state list, with a note that its arrows read
  as a sequence no Invitation follows — `Accepted`, `Expired` and `Cancelled` are mutually
  exclusive outcomes — and that `Draft` and the `Issued`/`Delivered` split are finer-grained
  sub-steps of `Created`/`Sent`.

The richer model was deliberately **not** rewritten. Splitting `Sent` into queued and
confirmed-delivered will matter if delivery failures ever need their own visibility, and
discarding it now would mean rediscovering it later.

No code change: `Invitation` already implements the reconciled lifecycle.

---

## TD-009 — A provisioned Workspace has no path out of `Created`

**Raised:** 2026-08-04 (reviewing the Platform Administrator console)
**Area:** Platform.Api — no Owner-facing Workspace lifecycle endpoints; Documentation — no
Business Analysis covered the Owner's setup journey
**Severity:** Moderate — provisioning delivers a Workspace that cannot be finished
**Status:** Done (2026-08-04) — see "Resolution as built" at the end of this entry

Provisioning transfers ownership and stops, exactly as Platform Administrator Business
Analysis §7 intends. But nothing then advances the Workspace through its own lifecycle
(`Created → Configuring → Private → Published → Active`, Workspace Aggregate Design §15).

The aggregate methods all exist. What was missing was any authorized caller: `AdminController`
exposes only `Suspend`/`Reinstate`/`Archive`, which are the platform's exception handling, and
`WorkspaceMembersController` covers members only. So a tutor handed a Workspace cannot finish
setting it up by any route.

**Observed, not hypothetical.** Workspaces provisioned through the admin flow sit at
`lifecycle=Created, provisioning=Provisioned, owner=true`. The only Workspace reaching `Active`
is the development seed, which drives the four transitions directly in code.

**Documented by:** Workspace Setup Business Analysis (new, 2026-08-04), which specifies the
Owner's workflow, authority, completion rules and the meaning of each transition.

**Blocked on a decision.** Workspace Setup Business Analysis BA-002: `Published → Active` has
no business meaning anywhere in the corpus. §15 justifies splitting `Private` from `Published`
but not `Published` from `Active`. Implementing the transition requires knowing whether it is
automatic, driven by first real use, or Owner-declared — the document recommends Owner-declared
and asks for a ruling. Building it on a guess would bake an accidental decision into the tenant
lifecycle.

**Also note (BA-003):** INV-007 requires an Active Entry Point before publication, which cannot
be enforced while the Entry Point Registry is unimplemented (TD-006). Version 1 enforces the
identity half only; the recommendation is to treat the Public Identifier as an implicit
platform-subdomain Entry Point until the registry exists.

**Resolution as built (2026-08-04):**

`/api/workspaces/{slug}/setup` — GET returning identity, status, derived completeness and the
single available next transition; PUT identity; and `begin-configuration`, `make-private`,
`publish`, `activate`. Authority is Owner or Administrator, resolved per request from the
caller's Membership. A `WorkspaceSetupScreen` in the tutor surface renders the journey and
whichever action the server says is available.

No new domain method was required, exactly as Platform Administrator Business Analysis BA-003
predicted.

**BA-002 was still open, and implementation proceeded on the analysis's own recommendation:**
`Activate` is Owner-declared. It is a separate command with no side effects beyond the status
change, so a different ruling — automatic on publish, or driven by first real use — changes
only `ActivateAsync` and `NextStep`. Nothing else depends on which reading wins. The decision
remains open in the document; only the implementation has taken a position.

**Still true (BA-003):** the aggregate enforces INV-007's identity half only. Addressability is
satisfied by the Public Identifier as an implicit platform-subdomain entry point until the
Entry Point Registry exists (TD-006), and is reported as its own completeness flag so the
distinction stays visible.

**Known limitation:** `readyToPublish` cannot currently be false, because provisioning always
supplies a name and identifier. The check is real but always satisfied until self-serve
creation can produce a partial Workspace.

---

## TD-010 — Nobody can ask to join a Workspace

**Raised:** 2026-08-04 (reviewing the tutor lifecycle end to end)
**Area:** Platform.Api — no inbound path to Membership; Documentation — no concept covered it
**Severity:** Moderate — the growth path is one-directional
**Status:** Deferred (documented; one open question should be settled before public exposure)

Every Membership in the system originates inside the Workspace: someone decides they
want you and sends an Invitation. There is no way for a person to approach a Workspace
they have found.

This makes `Workspace.Visibility = Published` do almost no work. The `Private`/`Published`
split exists specifically to mark public discoverability (Workspace Aggregate Design §15),
but discovery currently leads nowhere — a person who finds an academy can only wait to be
invited by someone who does not know they exist.

**Documented by:** Join Request Business Analysis (new, 2026-08-04).

**Correction it records (BA-004).** It was initially expected that Join Requests would
give `MembershipStatus.Pending` a persistent producer, since nothing currently creates a
Membership that waits — invitation acceptance creates and activates in one step. On
analysis they do not and should not: the waiting belongs in the Join Request's own
`Submitted` state, and leaving a Membership `Pending` after approval would invent a second
confirmation nobody asked for. `Pending` therefore still has no persistent producer; its
natural sources are bulk import and any flow requiring a member to complete something
before access begins.

**Settle before public exposure (BA-003, §16).** A Join Request creates an Identity when
the requester has none — which is unavoidable, since the platform has no self-serve signup
and requiring an existing Identity would mean only already-invited people could ask. That
makes account creation self-serve and therefore abusable. Email verification and rate
limiting are undesigned. The blast radius is small today (an Identity with no Membership
can only log in and see an empty list), but this should be built before the feature is
public, not after.

**Trigger:** wanting a Workspace to grow by being found rather than only by reaching out.

---

## TD-011 — Two inbound-request concepts with the same shape at different scopes

**Raised:** 2026-08-05 (reviewing Platform Administrator Business Analysis v1.2 alongside
Join Request Business Analysis)
**Area:** Documentation / design — `Tutor Signup Request` vs `Join Request`
**Severity:** Low now, moderate if both are built independently
**Status:** Done (2026-08-05)

Two concepts were designed within days of each other, from opposite ends of the platform,
and came out structurally identical:

| | Direction | Decided by | Lifecycle | Token link |
| --- | --- | --- | --- | --- |
| **Tutor Signup Request** | person → **platform** | Platform Administrator | Submitted → Approved / Rejected | Signup Status Link |
| **Join Request** | person → **workspace** | Workspace Owner / Administrator | Submitted → Approved / Declined / Withdrawn | — |

Both are unsolicited inbound requests from someone with no existing relationship, reviewed
by whoever holds authority at that scope, granting access on approval and nothing on
refusal. Both need an unguessable token link so an applicant without an Identity can check
back. Both must resolve identity at approval time.

Neither document is wrong, and the duplication is not accidental — it is the same business
pattern appearing at two scopes, which is usually a sign the pattern is real.

**The decision needed:** do these stay two independent aggregates, or share an explicit
abstraction?

The reasoning in Join Request Business Analysis BA-001 (for keeping Join Request separate
from Invitation) argues *for* keeping them separate here too: their reviewing authority,
their scope, and what approval produces all differ, and a shared `scope` discriminator would
make most rules conditional on it. The counter-argument is that a token-bearing status link
and an approval workflow are genuine shared mechanism, and building them twice invites them
to drift.

**A middle answer worth considering:** keep the two aggregates separate, but extract the
*token status link* mechanism — which is already a third copy of the pattern used by
Invitation Links — rather than the request lifecycle.

**Ruling (2026-08-05): separate aggregates, shared token mechanism.**

Taken while implementing Tutor Signup Request — the second of the two — exactly at the
point this entry said the decision was due. Platform Administrator Business Analysis
BA-008 had already implied the answer: a Signup Status Link "reuses the general
unguessable-token-link pattern ... as a distinct concept."

What was shared: `InvitationToken` became `SecureToken`, and Invitation, Join Request
and Signup Request all use it. That removes what would otherwise have been a third
hand-rolled copy of the same generate/hash/constant-time-compare logic — the place
drift actually starts.

What was kept apart: the aggregates. `SignupRequest` and `JoinRequest` share no base
type, table or lifecycle. Their reviewing authority differs (Platform Operator vs
Workspace Owner), what approval produces differs (an approved application still has to
be paid for, then provisioned; an approved join request is immediately a Membership),
and only one has a payment stage at all. A shared discriminator would have made nearly
every rule conditional on which kind it was — the same reasoning Join Request BA-001
used to keep Join Request separate from Invitation.

The pattern being visible in two places is not duplication to be eliminated. It is one
business shape appearing at two scopes, and the honest response was to share the
mechanism and let the meanings stay distinct.

---

## TD-012 — Rate limiting partitions by a client IP the API cannot currently see

**Raised:** 2026-08-05 (implementing Join Request rate limiting)
**Area:** Platform.Api — `RateLimitPolicies.cs`; deployment configuration
**Severity:** Low today, High the moment anything is deployed behind a proxy
**Status:** Deferred (blocked on a deployment topology existing — same gate as TD-001)

`RateLimitPolicies` partitions its limiters by `context.Connection.RemoteIpAddress`, which
is the address of the **immediately connecting peer** — not the end user, whenever anything
sits in front of the API.

**This is already the case in development.** Both the Vite dev-server proxy and Aspire's
own DCP proxy forward requests, so the API sees `127.0.0.1` or `::1` for every browser
request regardless of who sent it. With one developer that is harmless, and direct calls to
the API (which is how the limiter was verified) do partition correctly. But it means the
per-client partitioning is not actually being exercised by the normal path even now.

**Why it matters more than it looks.** When every caller lands in one partition, the failure
is not "the limit is weaker" — it is inverted:

- Legitimate users consume one shared bucket and collectively trip the limit, which is a
  denial of service against your own users.
- An attacker is constrained no more than anyone else, because everyone already shares the
  same allowance.

So the guard degrades into something actively harmful rather than merely absent, and it does
so silently, at the moment a proxy is introduced.

**The fix is NOT simply `UseForwardedHeaders`.** Enabling it naively is itself a
vulnerability: `X-Forwarded-For` is attacker-controlled, so an unrestricted configuration
lets anyone claim any address and defeat the limiter completely — trading a shared bucket
for no bucket at all. It must be paired with `KnownProxies` / `KnownNetworks` so only
trusted hops are honoured, and that list is deployment-specific, which is why this cannot be
settled before a deployment target exists.

**Worth considering alongside it:** a secondary limit keyed on the submitted email address
would survive the proxy problem entirely, since it does not depend on network identity. It
does not stop an attacker cycling through addresses, so it complements the IP limit rather
than replacing it — but it is the part that keeps working when the network signal is
untrustworthy.

**Trigger:** the first deployment behind any reverse proxy, load balancer, or CDN — which is
effectively all of them. Pair this with TD-001, since both are settled by the same decision
about where and how the platform runs.

---

## TD-013 — No public entry page for anyone ADR-WE-001 doesn't cover

**Raised:** 2026-08-05 (reviewing what a visitor sees at the platform root)
**Area:** Documentation / design — platform root (`/`); `frontend/src/AppRoot.jsx`
**Severity:** Moderate — Tutor Signup Request (Platform Administrator Business Analysis §7.1)
has nowhere for an applicant to actually start
**Status:** Deferred (documented; not built)

ADR-WE-001 (IdentityAndWorkspaceAccess, "Workspace-First Entry") rules out a platform home
page — but only for learners, who always arrive through a Workspace Entry Point. It says
nothing about a Prospective Tutor or a returning user who lands on the root instead of their
Workspace URL. No document reconciled this until now, and nothing in the corpus's Open
Questions (Platform Administrator Business Analysis §16; Join Request Business Analysis §16,
prior to its own v1.1) named it either.

**Observed, not hypothetical.** `frontend/src/AppRoot.jsx` routes `/` to `SideChooser`, a
binary "I teach / I'm learning" login router — it has no path for an unauthenticated
Prospective Tutor to apply. `/apply` does not exist in the frontend or the backend
(`Program.cs` maps no such route) — Section 7.1 is fully specified in documentation and
entirely unbuilt in code.

**Documented by:** ExperienceArchitecture.md, ADR-EA-002, which settles the root page as a
single-purpose page converting a Prospective Tutor into an applicant — one call to action,
Become a Tutor — with the Platform Administrator deliberately unlinked. It does not design the
page visually.

**Resolved alongside this (not a separate open item):** an earlier draft of ADR-EA-002 gave
the root page a second call to action, "Find an Academy," treating Workspace discovery as a
Future feature not yet built. That has been corrected to a permanent decision, not a deferred
one — the platform will never provide Workspace discovery, in any version. See ADR-EA-002's
Business Model Note and Join Request Business Analysis BA-007 (v1.1), which resolves that
document's own former "where requesters find Workspaces" open question the same way.

**Trigger:** implementing the Tutor Signup Request frontend (Section 7.1 has no UI yet), or
any work that would otherwise add an ad hoc "apply" link somewhere without an owning page to
put it on.

---

## TD-014 — First login was built with no Business Analysis behind it, and diverges from §4.7

**Raised:** 2026-08-05 (documenting the bridge between Invitation acceptance and Workspace Setup)
**Area:** Documentation — no document covered credential capture, session issuance, or
Workspace selection at first login; `Documents/Workspace_Access_Context.md` §4.7
**Severity:** Low — the code works; the risk is a future reader trusting §4.7 over it
**Status:** Deferred (documented; §4.7 itself not yet corrected)

Invitation Business Analysis ends at "Membership Created." Workspace Setup Business Analysis
explicitly begins with an already-authenticated Owner already inside the Workspace, stating
plainly that getting there is "complete before this document begins." Nothing in between was
ever specified — even though `InviteScreen.jsx`, `ProvisioningService.AcceptAsync`,
`AuthProvider.jsx`, and `WorkspaceHomeScreen.jsx` already implement a complete, working
mechanism for it: inline credential capture (new password vs. existing-password check),
immediate session issuance with no separate login step, client-side auto-selection of the
sole eligible Workspace, and a dedicated first-run Welcome screen distinct from Setup.

**The more consequential half:** this working mechanism does not match Workspace_Access_Context
§4.7's `Workspace Session` — a concept that specifies a session created only once both
authentication and Membership validation for one specific Workspace succeed together, implying
a workspace-scoped session artifact. What is built is a single identity-level token (per TD-005,
already a deliberate choice) with Workspace context resolved client-side, per request, from
`GET /api/me` — never persisted server-side, never workspace-scoped at the token level. §4.7 was
never implemented this way and, per the new document below, will not be.

**Documented by:** First Login Business Analysis (new, 2026-08-05), which names all of the
above as business concepts and states in its BA-004 that its model **supersedes** §4.7 for
Version 1 — a correction, not an extension. The document does not itself edit
Workspace_Access_Context.md.

**Trigger:** any review of Workspace_Access_Context.md, or the first time someone builds
against §4.7 expecting a workspace-scoped session to exist.
**Resolution sketch:** correct §4.7 to describe the identity-level-token model actually built,
or mark it explicitly superseded by First Login Business Analysis BA-004, so a future reader
does not treat it as the still-current target design.

---

## TD-015 — Two onboarding lifecycles, unstated relationship

**Raised:** 2026-08-05 (reviewing TutorWorkspaceFirstTimeExperienceArchitecture.md)
**Area:** Documentation — `TutorWorkspaceFirstTimeExperienceArchitecture.md`; Workspace Setup
Business Analysis; First Login Business Analysis
**Severity:** Low — no code contradiction, only a documentation gap that invites one
**Status:** Done (2026-08-05) — resolved by cross-references, no code affected

`TutorWorkspaceFirstTimeExperienceArchitecture.md` (drafted separately from the Business
Analysis series, in a different template — "Architecture" framing, no `BA-XXX` decisions, no
Technical Debt Backlog citations) describes a tutor-onboarding lifecycle — `First Workspace
Entry → Workspace Onboarding → Workspace Ready → Normal Tutor Experience` — that never
mentions Workspace Setup Business Analysis's already-built `Created → Configuring → Private →
Published → Active` publish lifecycle. Nothing stated whether these are the same lifecycle
under two names, one sequenced before the other, or two independent tracks.

**Resolved:** they are two independent tracks that run in parallel — Workspace Setup governs
whether the tenant business is publicly operable; the new document governs whether this
specific tutor has finished their own profile, preferences, and resource setup. Neither implies
the other's completion. Cross-reference notes were added to all three documents rather than
merging or resequencing anything.

**Also noted, not separately raised:** the new document's Stage 4 (Course Library, Lesson
Repository, Resource Library, Personal Calendar) is not yet mapped onto existing aggregates
(Curriculum, Lesson, Learning Asset Aggregate Design) and should be read as target-state, not
Version 1 scope. "AI Workspace" is the one Stage 4 item that is already grounded — it matches
the AI Workspace Profile boundary flag Workspace Aggregate Design already owns.

---

## TD-016 — `JoinRequestService.SubmitAsync` never checks for an outstanding Invitation

**Raised:** 2026-08-08 (verifying `JoinRequestService` against Join Request Business
Analysis §10 after the document was found missing from `Documents/` and restored)
**Area:** Platform.Api — `JoinRequestService.SubmitAsync`, `.ApproveAsync`
**Severity:** Low today, Moderate as both inbound paths see real traffic
**Status:** Deferred

Join Request Business Analysis §10's Submission Rules list five checks a submission must
pass — discoverable Workspace, join requests enabled, at most one open `Submitted`
request, no existing Active Membership, not a Suspended/Archived Identity — and
`SubmitAsync` implements four of those five correctly (the fifth, Identity status, is its
own gap — TD-017). None of the five is an outstanding Invitation.
Concretely: `SubmitAsync` queries `db.Memberships` (for an Active Membership) and
`db.JoinRequests` (for an existing `Submitted` one); it never queries `db.Invitations`.
So a Workspace Owner can invite someone, and before that person acts on it, the same
person can separately find the Workspace's join page and submit a Join Request for the
same email — nothing refuses this.

**This is not just an unenforced rule sitting quietly — it breaks the reviewer's normal
approval path.** `WorkspaceMemberService.InviteAsync` *does* enforce the equivalent check
on its own side (§8: "at most one open Invitation per (email, Workspace)"; `open.Any(i =>
i.IsOpen())` refuses with "There's already an open invitation for that email — resend it
instead of creating another."). `JoinRequestService.ApproveAsync` calls exactly that
method to turn an approved Join Request into an Invitation. So: reviewer approves the Join
Request → `InviteAsync` finds the requester's own pre-existing open Invitation → refuses →
`ApproveAsync` returns that Conflict *before* ever calling `joinRequest.Approve(...)` →
the Join Request is left stuck in `Submitted` permanently, sitting in the reviewer's queue
with no way to approve it through the normal flow, and the reviewer sees a confusing
error about "resending" an invitation they have no reason to know exists for a person they
only know as a join requester.

Not a BA-001 tension — Join Request and Invitation are correctly kept as separate
aggregates, and reaching across into another aggregate's table at submission time is
already the established pattern here (the existing Active-Membership check already
queries `db.Memberships`). This is a missing sixth check of the same shape as the other
five, not a design disagreement.

**Trigger:** implementing the fix below, or the first real report of a reviewer unable to
approve a Join Request that keeps failing with an invitation-resend error.
**Resolution sketch:** add a sixth check to `SubmitAsync`, same shape as the existing
Active-Membership one — an open Invitation (`IsOpen()`) to that email in that Workspace
refuses the Join Request with a message pointing the person at the invitation they
already have, rather than letting it reach `Submitted` and fail later at approval time.
Separately decide (not settled by this entry) what should happen to a Submitted Join
Request left behind when its person becomes an Active Member through the *other* path —
auto-withdraw on Membership activation is the natural answer but is not designed here.

---

## TD-017 — `JoinRequestService.SubmitAsync` never checks the requester's Identity status

**Raised:** 2026-08-08 (split out from TD-016 during the same verification pass)
**Area:** Platform.Api — `JoinRequestService.SubmitAsync`
**Severity:** Low — no downstream failure found, unlike TD-016's Invitation gap
**Status:** Deferred

Join Request Business Analysis §10's fifth Submission Rule: "A person whose Identity is
Suspended or Archived cannot submit a request." `SubmitAsync` never looks up an existing
Identity by the submitted email at all, so this rule has no code behind it — a Suspended
or Archived Identity's email can submit a Join Request exactly as freely as anyone else's.

Unlike TD-016, this was not traced to a concrete downstream break — `ApproveAsync` runs
`WorkspaceMemberService.InviteAsync`, and nothing in that path currently re-checks the
target email's Identity status either, so an approval would proceed rather than fail. The
gap is real but its consequence is narrower: a Workspace could end up inviting, and
potentially activating a Membership for, an Identity the platform previously suspended or
archived — which is the exact outcome §10's rule exists to prevent, just without an
error message forcing the question the way TD-016's does.

**Trigger:** implementing TD-016's fix (a natural point to add this alongside it, same
method, same shape of check), or the first Suspended/Archived Identity observed to have
an Active Membership created through this path.
**Resolution sketch:** add a seventh check to `SubmitAsync` — look up an existing Identity
by the submitted email and refuse if its status is Suspended or Archived, same shape as
the Active-Membership and (once TD-016 lands) open-Invitation checks. Worth deciding
alongside TD-016 whether `ApproveAsync`/`InviteAsync` should also re-check status at
approval time, in case an Identity is suspended *after* a request is already `Submitted`.

---

## TD-018 — Join Request Business Analysis contradicts itself on when Identity Resolution runs; the submission-time design it describes was never built

**Raised:** 2026-08-08 (confirming implementation of §6's "Identity Context" business actor)
**Area:** Documentation — `Documents/Join Request Business Analysis.md` §4/§5 vs §6 vs §7
and BA-003; `backend/src/Platform.Api/RateLimitPolicies.cs`'s doc comment
**Severity:** Low — no code is wrong, only what several comments and one document claim
about it
**Status:** Done (2026-08-08) — same-document contradiction, resolved the way TD-008
resolved a cross-document one: ruling recorded, sources corrected in place, nothing rewritten
out of the record

Three parts of the same document describe three different moments for Identity
Resolution, and the code confirms only one of them:

| Section | Claims it happens... | Matches code? |
| --- | --- | --- |
| §4 ("Onboarding Request" row), §5 | After the resulting Invitation is accepted | Yes |
| §6 ("Identity Context" business actor) | "on approval" | No — `ApproveAsync` never touches `db.Identities`, only issues an Invitation |
| §7 (workflow diagram), BA-003 | At **submission** — the request carries a password; an Identity is created or matched immediately | No — `SubmitJoinRequest` has no `Password` field (`FullName`, `Email`, `Message` only); `SubmitAsync` never touches `db.Identities` |

The submission-time design §7 and BA-003 describe — collect a password up front,
create-or-match the Identity right there, reusing "exactly what invitation acceptance
already does" — reads as a deliberate, specific decision, not a stray typo. It appears to
have been designed and then quietly abandoned during implementation in favour of the
simpler §4/§5 model: a Join Request stays anonymous request data (no password, no
Identity, nothing in `db.Identities`) until a reviewer approves it into an ordinary
Invitation, and Identity Resolution happens only if and when *that* Invitation is later
accepted — `ProvisioningService.AcceptAsync`, labelled inline `// ── Identity Resolution
(Workspace_Access_Context §4.6) ──`, the exact same code path a directly-issued Invitation
uses. Nothing was ever written back to correct §6, §7, or BA-003 to match.

**This is not cosmetic — it changes a stated risk.** BA-003's accepted cost ("this makes
Identity creation self-serve and therefore abusable") and §16's open question ("Abuse
control on Identity creation... should be settled before the feature is exposed publicly")
both assume `SubmitAsync` can mint an Identity. It cannot — anonymous submission never
reaches `db.Identities` at all, so there is no self-serve Identity creation on this path
for email verification or anything else to guard. The same wrong premise is repeated
verbatim in `RateLimitPolicies.cs`'s own doc comment ("each one can mint an Identity"),
which currently justifies the endpoint's rate limit on a mechanism the code below it does
not have.

**Ruling:** §4/§5's model is normative — it is what `AcceptAsync` actually implements.
§6, §7, BA-003, and `RateLimitPolicies.cs`'s comment are corrected in place (this same
change) to describe Identity Resolution as deferred entirely to Invitation acceptance,
with a note on each rather than a silent rewrite. Rate limiting on `SubmitAsync` remains
justified on its own, narrower ground that was already true independent of this
correction — bounding junk `JoinRequest` rows and reviewer-queue noise (§5: "Ensuring one
person cannot flood one Workspace with parallel requests") — not guarding Identity
creation, which this endpoint was never able to do.

**Trigger:** already actioned. Any future document or comment repeating "Join Request
submission can create an Identity" should be corrected the same way.

---

## TD-019 — Readiness Checklist is referenced but never defined

**Raised:** 2026-08-15 (gap analysis of `WorkspaceSetupScreen.jsx` against Workspace
Setup Business Analysis)
**Area:** Documentation — `Documents/Workspace Setup Business Analysis.md` §4;
`Documents/Learning Workspace Experience Architecture.md`
**Severity:** Low — no code depends on it yet, but the next reader will assume it
already exists somewhere
**Status:** Done (2026-08-15)

Workspace Setup Business Analysis §4 defines "Readiness Checklist (Experience
concern)" as "the Owner-facing presentation of Setup Completeness — what is done,
what remains," and explicitly assigns ownership elsewhere: "Owned by Learning
Workspace Experience Architecture, referenced here so that this document specifies
*what must be true*, not how it is displayed."

`Learning Workspace Experience Architecture.md` does not mention a Readiness
Checklist, or any comparable concept, anywhere in its current text. The concept is
cited as being defined in a specific document and is not actually defined there.

**Consequence for the built screen.** `WorkspaceSetupScreen.jsx`'s lifecycle stepper
shows which of the five states (`Created` … `Active`) a Workspace is in — state, not
completeness. The only completeness signal exposed today is the single `blocker`
string the API returns when there is no available next transition. That is a
reasonable Version 1 stand-in, but it cannot be checked against a Readiness Checklist
specification that does not exist, and a future reader of Workspace Setup Business
Analysis §4 would reasonably expect one to.

**Trigger:** the next revision of Learning Workspace Experience Architecture, or the
first time an Owner needs more diagnostic detail than a single blocker string can
carry.
**Resolution sketch:** define the Readiness Checklist in Learning Workspace
Experience Architecture — what it enumerates, how partial progress within a stage is
shown — then extend `/api/workspaces/{slug}/setup`'s response and
`WorkspaceSetupScreen.jsx` to surface it.

**Resolution as documented (2026-08-15):** Learning Workspace Experience Architecture
gained §18 ("Owner Setup Experience"), appended after §17 rather than inserted, so
`Workspace Aggregate Design`'s existing citation of its §13 stays correct. §18 defines
the checklist entirely in terms already settled by Workspace Setup Business Analysis
§8/§10 (Blocking: name, public identifier; Addressable: the implicit Entry Point;
Suggested, never blocking: configuration, branding, capabilities) plus a presentation
rule (Suggested items are never shown as errors) and a reminder that it is derived, not
stored (BA-005). Workspace Setup Business Analysis §4 and §14 now cite §18 by number.
**Not done (superseded 2026-08-15, same day):** this entry originally closed only the
documentation gap, on the assumption the implementation gap stayed open. It didn't stay
open long — `WorkspaceSetupScreen.jsx` gained a `Readiness` component the same day,
built directly against this section: Blocking (name, public web address) and Suggested
(description — real and checkable; language/timezone/regional, branding, capabilities —
shown with a "not built yet" badge and a muted dash rather than an empty circle, per
§18's Presentation Principle, since TD-006 means there's nothing to toggle yet) render as
separate groups, plus a standalone Addressable row. `/api/workspaces/{slug}/setup`
needed no change — `WorkspaceSetupResponse.Completeness` already carried every field the
checklist reads. See the Workspace Setup Screen — Gap Analysis document, §6, for the
before/after.

---

## TD-020 — `AcceptsJoinRequests` toggle has no document claiming ownership of its rules

**Raised:** 2026-08-15 (gap analysis of `WorkspaceSetupScreen.jsx` against Workspace
Setup Business Analysis)
**Area:** Documentation — no Business Analysis assigns `AcceptsJoinRequests`;
`frontend/src/screens/WorkspaceSetupScreen.jsx`; `Documents/Join Request Business
Analysis.md`
**Severity:** Low — the feature works; only its ownership is undocumented
**Status:** Done (2026-08-15)

`WorkspaceSetupScreen.jsx` renders an `AcceptsJoinRequests` toggle and a QR code
linking to `/join/{slug}`. This is genuine, shipped functionality, not speculative —
`AcceptsJoinRequests` is a real field in the EF model and migrations, and Join
Request Business Analysis §10 already depends on it as one of its Submission Rules
("join requests enabled").

Neither document states who may toggle it, when, or what happens to Join Requests
already `Submitted` if it is turned off mid-flight. Workspace Setup Business
Analysis §5 excludes "membership management inside the Workspace — invitations,
roles, member lifecycle" from its own scope, which would point at Join Request
Business Analysis — but that document currently treats "join requests enabled"
purely as a precondition to check at submission time, not as a Workspace-level
setting it defines or assigns an owner to.

**Trigger:** the first question about who is allowed to flip this, or the next
revision of either document.
**Resolution sketch:** assign ownership explicitly — most likely a new subsection of
Join Request Business Analysis defining `AcceptsJoinRequests` as Workspace-level
policy state (who may set it, effect on in-flight Join Requests), with a
cross-reference added from Workspace Setup Business Analysis §8.

**Resolution as documented (2026-08-15):** Join Request Business Analysis gained
BA-008 (v1.1 → v1.2) — authority is Owner or Administrator, the same Workspace Setup
authority as everything else on that screen (BA-001), and toggling the setting never
touches a Join Request already `Submitted`; it only gates new submissions. §8's
"Accepting Requests" subsection now names BA-008 and states where the control is
actually rendered. Workspace Setup Business Analysis §8 gained a matching "Accepting
Join Requests" note pointing back at Join Request Business Analysis as the owning
document, and §14's integration table gained a row for it. No code change — this
closed the documentation gap the entry was raised for; the toggle's behaviour in
`WorkspaceSetupScreen.jsx` already matched BA-008 by construction (it only ever wrote
the flag, and nothing in `JoinRequestService` reacts to it beyond the submission-time
check BA-008 confirms is the only intended effect).

---

## TD-021 — No URL-based routing; full reload from any deep screen returns to the dashboard

**Raised:** 2026-09-22 (student-reported: refreshing a lesson page while its video is playing
redirects to the dashboard)
**Area:** `frontend/src/App.jsx` — navigation state (`learnerScreen`, `ownerScreen`,
`learnerLessonId`, `studioProductId` and siblings)
**Severity:** Moderate — real, reproducible, user-facing loss of place; not specific to video
**Status:** Deferred

Which screen and which record are open live only in `useState` (`App.jsx:853-882`), never
synced to the URL or any persistent storage. `learnerScreen` initializes to `"dashboard"` on
every mount. A full page reload remounts the app from scratch, so that state resets to its
default — the user lands on the dashboard regardless of what they were viewing.

**Not video-specific.** Reloading from any deep screen — a lesson, an assignment, a Content
Studio product, a resource — loses the same way. It is most noticeable on a lesson video
because playback is audibly/visibly interrupted, which is how it was found, but the root cause
is the complete absence of routing, not anything about video or the Phase 3 playback-refresh
work reviewed the same day.

**Security constraint for the fix, stated up front so it isn't rediscovered under pressure
later:** any deep link a URL-restore reconstructs (a lesson, an asset, an assignment) **must**
go through the same authorization path it would if reached by clicking through the UI —
`LearningAssetAccessPolicy` for asset access, and whatever screen-level checks already gate
lessons/assignments/products — not skip it by restoring component state directly from a URL
parameter. Routing must not become a second, unchecked way to reach content the click-through
path would refuse.

**Trigger:** the next time this is reported by a real user (student-reported once already), or
a deliberate routing pass.
**Resolution sketch:** real URL routing (`react-router`, or manual `pushState`/`popstate`
handling already used once in `App.jsx:407` for side-switching) synced to
`learnerScreen`/`ownerScreen`/the open lesson or product id, with restore-from-URL on load.
Every restored id must be re-authorized through the existing checks on the way back in, exactly
as if the user had navigated there by clicking, never assumed valid because it came from a URL.

---

## TD-022 — `playbackRefresh.js`'s initial-load `schedule()` is not gated on a successful first load

**Raised:** 2026-09-22 (Phase 3 video-refresh Run 3/Run 4 Playwright-failure investigation)
**Area:** `frontend/src/api/playbackRefresh.js` — `start()`
**Severity:** Low — a real, correctly-diagnosed defect, but not shown to cause any observed
failure, and the watchdog already provides a safety net
**Status:** Deferred — do not fix speculatively; no reproducible failure exists to verify a fix
against

`start()` calls `schedule()` unconditionally, immediately after assigning the very first
video source — with no gate on whether that source ever reaches `readyState > 0`. Every
subsequent swap gets this right: its `schedule()` call happens only from `finish()`, after a
confirmed successful load. Only the first one skips that rule.

Consequence: since a freshly-opened, unplayed video has `media.paused === true` by default,
the proactive-refresh-while-paused rule (`onProactiveDue()`) can fire on a source that hasn't
finished loading yet — even one that's healthy and about to succeed — interrupting it
needlessly. Exact evidence, from Run 4's own network timeline: a second `POST /access` fired
at ~15s after the first, well before the watchdog's own 20s timeout, aborting the still-loading
first connection (`net::ERR_ABORTED`) — traced precisely to `schedule()`'s proactive timer
(`lifetime - lead = 15000ms` for a 30s test lifetime), not to the watchdog.

**Investigated, not confirmed causal.** A full investigation (the original failure's
millisecond-level reconstruction, plus 10 fresh reproduction attempts) did not establish that
this defect caused Run 4's actual failure — the underlying stall (TD-023) was already present
on the first source before the proactive refresh ever fired, so the premature interruption was
incidental to that failure, not its cause.

**Trigger:** the next time `playbackRefresh.js` is touched for any reason (fix
opportunistically then); or sooner if TD-023's stall becomes reliably reproducible and this
interruption is shown to make it worse rather than merely coincide with it.
**Resolution sketch:** call `schedule()` for the initial source only after its first successful
`loadedmetadata` — move the first `schedule()` call out of `start()` and into the same success
path (`finish()`/`onAnyMetadata()`) every subsequent swap already uses.

---

## TD-023 — Chrome/R2 media stall: a video's initial load occasionally never reaches `readyState > 0`

**Raised:** 2026-09-22 (same investigation as TD-022)
**Area:** Browser/network interaction between Chrome's `<video>` element and Cloudflare R2
presigned URLs — not directly fixable in application code
**Severity:** Low-Moderate — real and observed, currently only mitigated, not root-caused or
fixed
**Status:** Deferred — not a launch blocker

Chrome's `<video>` element occasionally never progresses past `readyState = 0` (`HAVE_NOTHING`)
despite R2 responding correctly. Confirmed directly: in Run 4's failing run, three separate
presigned URLs in the same session each got a clean, fast `206 Partial Content` response
(350–650ms), yet none of them ever produced a `loadedmetadata` event.

**Estimated rate:** roughly 1-in-6 to 1-in-12 loads, from earlier direct bare-`<video>`
probing (12 loads: ~2/12 stalled with default Chrome flags, 0/12 with `--disable-quic`) —
though `--disable-quic` does not fully eliminate it, since Run 4's failure occurred with that
flag already applied. Root cause (why Chrome's media pipeline stalls specifically against R2,
even with QUIC disabled) was not identified; it looks connection/negotiation-related, not an
R2 delivery problem.

**Already mitigated, not fixed.** `playbackRefresh.js`'s stalled-load watchdog (20s timeout,
up to 2 retries before reporting failure) recovers from this automatically in the ordinary
case. Only a rare, compounding run of consecutive stalls — as seen once in Run 4 — can exhaust
that retry budget before recovering, which is what a Playwright test with a fixed wait budget
can observe as a failure.

**Not reproduced again.** 10 fresh-context reproduction attempts, plus 5 full Playwright runs
across two later batches (3 then 2 more), all passed cleanly — consistent with a genuinely
low, roughly-estimated rate rather than a systematic issue, but not a large enough sample to
rule the underlying condition out.

**Trigger:** a genuine, reproducible recurrence; or a broader Chrome/QUIC/R2 compatibility
investigation if the same pattern turns up elsewhere.
**Resolution sketch:** none available yet — this needs browser-level root-causing (a packet
capture or Chrome `net-internals` trace during a live repro), not an application code change,
since R2 itself is responding correctly every time this was observed.

---
## TD-024 — Product Draft/Archived status not enforced in shared learner access rule

**Raised:** 2026-09-22 (LearningAssetAccessPolicy Phase 2 build)
**Area:** Platform.Api — `LearnerAccess` / `LearningDeliveryService` / `LearningAssetAccessPolicy`
**Severity:** Moderate — access-control gap, deliberately not fixed in this change
**Status:** Deferred

`GetLessonAsync` and the new asset policy both ignore `LearningProduct.Status`. A
learner can still open a Published lesson's content and read its assets even
when the owning product is `Draft` or `Archived`. Only the product list (hides
it) and the curriculum endpoint (returns `NotFound`) currently check status.
Unpublishing or archiving a product does not cascade to its lessons.

Deferred deliberately — fixing it in the shared `LearnerAccess` code would also
change lesson delivery behaviour, which was out of scope for the asset-security
work this was found during.

**Trigger:** a product decision on what should happen to learners of a
retired/unpublished product (keep access? revoke it?), or before launch if that
decision is made.
**Resolution sketch:** add a product-status check to the shared `LearnerAccess`
primitives so lesson delivery and asset access agree by construction.

---

## TD-025 — Assignment view exposes activities on unpublished lessons; asset itself is blocked, content is not

**Raised:** 2026-09-22 (LearningAssetAccessPolicy Phase 2 build)
**Area:** Platform.Api — assignment/activity delivery path
**Severity:** Low-Moderate — partial gap, asset download already fixed
**Status:** Deferred

The asset policy now requires the lesson to be `Published` before serving an
activity file — stricter than the assignment view itself. An enrolled learner
can still open an activity belonging to an unpublished lesson through the
assignment view and receive its file id (the file download now correctly
403s, but the activity's other content is still visible).

**Trigger:** next time the assignment/activity delivery path is touched, or a
security review of the learner-facing assignment surface.
**Resolution sketch:** apply the same lesson-Published check the asset policy
uses to the assignment view's activity visibility.

---

## TD-026 — Activity-file access is Active-enrollment-only; video/resource access also allows Completed

**Raised:** 2026-09-22 (LearningAssetAccessPolicy Phase 2 build)
**Area:** Platform.Api — `LearnerAccess` enrollment rules
**Severity:** Low — inconsistency, not a security gap
**Status:** Deferred

Lesson videos/resources accept `Active` or `Completed` enrollment. Activity
files (mirroring the assignment view's rule) accept `Active` only. A learner
who completes a course can keep rewatching its videos but loses access to its
activity files.

**Trigger:** a product decision on whether Completed learners should retain
activity-file access, matching video/resource behaviour.
**Resolution sketch:** if intended, this changes both the asset policy and the
assignment view together, so they don't diverge again.

---

## TD-027 — Ad hoc diagnostic/investigation scripts don't clean up on failure

**Raised:** 2026-09-22 (Run 3/Run 4 Playwright investigation)
**Area:** `frontend/e2e/` throwaway harness scripts (not application code)
**Severity:** Low — housekeeping, caused one confirmed R2 dev-bucket leftover
**Status:** Deferred

A throwaway diagnostic harness (`frontend/e2e/.output/investigate.mjs`, since
deleted) uploaded a video during a seed step, then crashed on an unrelated bug
before reaching its own cleanup — which only ran at the end of a successful
pass. The orphaned object sat in `learning-workspace-dev` until caught by a
manual object-count check.

**Trigger:** the next time a throwaway investigation script uploads to R2.
**Resolution sketch:** any ad hoc script that writes to R2 should clean up in a
`try`/`finally` (or equivalent), not only on successful completion.

---

## TD-028 — `Storage__AssetTokenKey` and R2 credentials have no production value yet

**Raised:** 2026-09-22 (Phase 3 close-out / production deployment planning)
**Area:** Platform.Api — configuration / deployment
**Severity:** Blocker *at deploy time*, harmless before it — same shape as TD-001
**Status:** Deferred

`Storage:AssetTokenKey` startup validation (missing, under 32 bytes, a
placeholder, or equal to the JWT key all fail fast outside Development) is
correct, but no production value has been generated or set yet. Same is true
of `Storage__R2__AccessKeyId` / `Storage__R2__SecretAccessKey` — a previously
exposed key pair was rolled once already during dev setup, and a temporary
read-only prod token used for the dev-bucket migration is still pending
revocation.

**Trigger:** first deployment to any shared/hosted environment (same trigger
as TD-001 — worth doing together).
**Resolution sketch:** generate `Storage__AssetTokenKey` via
`openssl rand -base64 48`, distinct from the JWT key and the dev key. Set it
alongside the R2 keys on the production host. Revoke the old exposed key pair
and the temporary prod token in Cloudflare before or immediately after deploy.

---

## TD-029 — No hosting environment, CI/CD pipeline, or email/mailing system exists yet

**Raised:** 2026-09-22 (first production deployment planning)
**Area:** Infrastructure — hosting, deployment, transactional/marketing email
**Severity:** Blocker for launch, not for continued development
**Status:** In Progress

This is the first production deployment of the whole app — no hosting
platform, CI/CD pipeline, custom domain, or email-sending capability exists
yet. Direction decided so far, nothing provisioned:

- **Hosting:** Azure App Service (.NET-native) + Azure Database for
  PostgreSQL Flexible Server, UAE North region for proximity to the
  Egypt-based user base (same reasoning as the R2 EEUR bucket hint). Frontend
  via Azure Static Web Apps or App Service. Secrets via Azure Key Vault.
- **CI/CD:** not yet built; GitHub Actions is the likely fit if the repo is
  on GitHub.
- **Email:** no transactional or marketing email exists. Needed for account
  verification, password reset, enrollment notifications, assignment/grading
  notifications, and marketing/newsletters. Direction: SendGrid (handles
  both transactional and marketing in one platform). Requires a custom
  domain (not yet registered), SPF/DKIM/DMARC DNS records, and separate
  sending subdomains for transactional vs. marketing so a bad marketing send
  can't damage deliverability of password-reset/verification email.
- **Domain name:** not yet decided or registered — blocks email setup and
  the frontend/App Service hostname.

**Trigger:** already triggered — this is the active blocker to launch.
**Resolution sketch:** pick and register a domain; provision Azure resources;
build the GitHub Actions pipeline; set up SendGrid with domain verification;
close out TD-001 and TD-028 (production secrets) as part of the same push.

---
## Log

| Date | Change |
| --- | --- |
| 2026-08-04 | Created. TD-001…TD-004 raised during Tutor Login API verification. |
| 2026-08-04 | TD-005 raised during frontend architecture review (single web app vs. split Tutor/Learner apps). |
| 2026-08-04 | TD-006, TD-007 raised while implementing the Workspace and Membership aggregates. |
| 2026-08-04 | TD-005 closed — roles moved to Membership, identity-level token with per-request resolution. TD-002 closed by the first `[Authorize]` endpoints. |
| 2026-08-04 | TD-008 raised during Invitation Business Analysis (Invitation state-machine contradiction). |
| 2026-08-04 | TD-005's "one app vs. two" framing resolved by ExperienceArchitecture.md ADR-EA-001. |
| 2026-08-04 | TD-009 raised — a provisioned Workspace cannot leave `Created`. Documented by the new Workspace Setup Business Analysis; implementation blocked on its BA-002. |
| 2026-08-04 | TD-009 closed — Owner-facing setup lifecycle implemented; BA-002 proceeded on the analysis's recommendation (Owner-declared Activate), isolated so a different ruling changes one method. |
| 2026-08-04 | TD-010 raised — no inbound path to Membership. Documented by the new Join Request Business Analysis. |
| 2026-08-05 | TD-007 closed — §15 normative; `Pending → Archived` is legal. INV-002's contradictory example replaced. |
| 2026-08-05 | TD-008 closed — Invitation Business Analysis §9 normative. Both source documents annotated; the six-state model retained rather than rewritten. |
| 2026-08-05 | TD-009's BA-002 ruled — `Published → Active` is Owner-declared. Recorded in Workspace Aggregate Design §15. |
| 2026-08-05 | TD-004 confirmed deferred — settled, not undecided. |
| 2026-08-05 | TD-011 raised — Tutor Signup Request and Join Request share a shape; decide before the second is built. |
| 2026-08-05 | TD-010 implemented — Join Requests, with per-IP rate limiting on the one anonymous endpoint that can create an Identity. |
| 2026-08-05 | TD-012 raised — the rate limiter's IP partition is already blind behind the dev proxies, and inverts into a self-inflicted denial of service once deployed. |
| 2026-08-05 | TD-011 closed — separate aggregates, shared `SecureToken` mechanism, decided while implementing Tutor Signup Request. |
| 2026-08-05 | Tutor Signup Request implemented — the last unbuilt stage of the tutor lifecycle. `/apply` is now a real form. |
| 2026-08-05 | TD-013 raised — no public entry page for Prospective Tutors, returning multi-Membership users, or Workspace discovery; ADR-WE-001 covers learners only. Documented by ExperienceArchitecture.md ADR-EA-002. |
| 2026-08-05 | Workspace discovery ruled out permanently, not deferred — root page is single-CTA (Become a Tutor only). ExperienceArchitecture.md ADR-EA-002 revised; Join Request Business Analysis v1.1 adds BA-007, resolving its "where requesters find Workspaces" open question the same way. |
| 2026-08-05 | TD-014 raised — first login (credential capture, session issuance, Workspace selection, first-run Welcome) was built with no Business Analysis behind it, and diverges from Workspace_Access_Context §4.7's unbuilt Workspace Session. Documented by the new First Login Business Analysis, whose BA-004 supersedes §4.7 for Version 1; §4.7 itself not yet corrected. |
| 2026-08-05 | TD-015 raised and closed — TutorWorkspaceFirstTimeExperienceArchitecture.md's onboarding lifecycle and Workspace Setup's publish lifecycle are independent parallel tracks, not sequenced. Cross-references added to all three documents. |
| 2026-08-08 | Join Request Business Analysis, Invitation Business Analysis, Enrollment Aggregate Design and Platform Administrator Business Analysis restored to `Documents/` from git history — accidentally swept into an unrelated commit's bulk deletion; content was never actually lost. |
| 2026-08-08 | TD-016 raised while re-verifying `JoinRequestService` against the restored Join Request Business Analysis §10 — `SubmitAsync` never checks for an outstanding Invitation, and approving such a Join Request fails against `InviteAsync`'s own dedupe check, leaving it stuck in `Submitted` with no way to approve it. |
| 2026-08-08 | TD-017 split out from TD-016 — `SubmitAsync` also never checks whether the requester's email belongs to a Suspended or Archived Identity, §10's fifth Submission Rule. Narrower than TD-016: no concrete downstream failure traced, just the rule going unenforced. |
| 2026-08-08 | TD-018 raised and closed — Join Request Business Analysis §6/§7/BA-003 described Identity Resolution happening at submission (with a password field that doesn't exist) or on approval; only §4/§5's "after Invitation acceptance" matches code. Ruled §4/§5 normative; §6, §7, BA-003, and `RateLimitPolicies.cs`'s comment corrected in place. Also corrects BA-003's and §16's stated risk — `SubmitAsync` never creates an Identity, so there is no self-serve Identity creation on this path to guard against. |
| 2026-08-15 | Gap analysis of `WorkspaceSetupScreen.jsx` against Workspace Setup Business Analysis (see `Documents/Workspace Setup Screen — Gap Analysis.md`). TD-006 amended — the deferred Configuration/Branding/Capabilities surfaces are confirmed missing from the frontend too, not just the aggregate. TD-019 raised — Workspace Setup Business Analysis §4 cites Learning Workspace Experience Architecture as owning the Readiness Checklist, which that document never actually defines. TD-020 raised — the shipped `AcceptsJoinRequests` toggle has no document claiming ownership of its rules. |
| 2026-08-15 | TD-019 closed — Learning Workspace Experience Architecture gained §18 (Owner Setup Experience), appended after §17 so existing citations of its §13 stay valid, defining the Readiness Checklist in terms Workspace Setup Business Analysis §8/§10 already settled. Workspace Setup Business Analysis §4/§14 now cite §18 by number. Implementation (API + screen still expose only a single `blocker` string) intentionally left open — this closed the documentation gap only. |
| 2026-08-15 | TD-020 closed — Join Request Business Analysis gained BA-008 (v1.1 → v1.2): `AcceptsJoinRequests` authority is Owner-or-Administrator (BA-001, same as every other Workspace Setup action), and toggling it never affects a Join Request already `Submitted`, confirmed against `WorkspaceSetupService.SetAcceptsJoinRequestsAsync` and `JoinRequestService`, neither of which does anything beyond the existing submission-time check. Workspace Setup Business Analysis §8/§14 cross-reference the owning document. No code change. |
| 2026-08-15 | TD-019's implementation gap closed the same day — `WorkspaceSetupScreen.jsx` gained a `Readiness` component matching §18's Blocking/Addressable/Suggested groups exactly, reading the `Completeness` object `/api/workspaces/{slug}/setup` already returned. Same pass: a success toast for the `AcceptsJoinRequests` toggle (previously silent), a slug-change warning when editing a Published/Active workspace's public identifier (a UI mitigation for §16's still-open "changing a Public Identifier after publication" question, not a resolution of it), and an honest in-screen note that Configuration/Branding/Capabilities aren't built yet (TD-006). `Documents/Workspace Setup Screen — Gap Analysis.md` updated to match. |
| 2026-09-22 | TD-021 raised — no URL-based routing; a full page reload from any deep screen (lesson, assignment, Content Studio product) loses navigation state and returns to the dashboard. Found via a student report on a lesson video. Fix requires real routing synced to screen/record state with restore-from-URL, and any restored deep link must re-run existing authorization (`LearningAssetAccessPolicy` and equivalent screen-level checks) rather than trusting the URL. |
| 2026-09-22 | TD-022, TD-023 raised during the Phase 3 video-refresh Playwright investigation (Run 3/Run 4 failures). TD-022 (the `schedule()` gating defect): correctly diagnosed, not proven causal for the observed failure, ruled deferred pending its own trigger rather than fixed speculatively. TD-023 (the underlying Chrome/R2 stall): confirmed real, root cause not identified, already mitigated by the existing watchdog, ruled not a launch blocker at its estimated ~1-in-6 to ~1-in-12 rate. |
| 2026-09-22 | TD-024 through TD-026 raised during the LearningAssetAccessPolicy Phase 2 build — product Draft/Archived status not enforced, unpublished-lesson activities visible via the assignment view, and Active-only activity-file enrollment inconsistent with video/resource access. All deliberately deferred pending product decisions. TD-027 raised — a throwaway diagnostic script left an orphaned R2 object after crashing before its own cleanup ran. TD-028 raised — `Storage__AssetTokenKey` and production R2 credentials have no value set yet (same trigger as TD-001). TD-029 raised — first production deployment: no hosting, CI/CD, domain, or email system exists yet; direction decided (Azure, SendGrid) but nothing provisioned. |