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

**Trigger:** custom domains / Workspace resolution (Entry Points), maturity-model
tiering (Capabilities), or workspace theming (Branding). Permissions become
necessary at the first real authorization decision.
**Resolution sketch:** add each as its own entity/value object per the design docs.
Restore the full INV-007 check inside `Publish()` once the Entry Point Registry
exists.

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
