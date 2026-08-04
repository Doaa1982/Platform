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
**Status:** Deferred (pending intent confirmation)

The Tutor Login API plan's architecture overview mentioned a `Credential` value
object and Identity domain events. The plan's itemised changes never specified
them, and they were not built. `Identity` currently models the Email/Password
credential as a flat `PasswordHash` property.

Per Identity Aggregate Design §4, INV-005 ("an Identity may hold multiple
Credentials"), a flat `PasswordHash` cannot represent more than one credential —
so this becomes real work as soon as a second credential type appears.

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
**Status:** Deferred (needs decision)

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

**Trigger:** invitation-expiry handling, or any review of the Membership lifecycle.
**Resolution sketch:** decide, then correct whichever of §14/§15 is wrong so the
document is self-consistent, and align `Membership.Archive()` if the ruling goes the
other way.

---

## Log

| Date | Change |
| --- | --- |
| 2026-08-04 | Created. TD-001…TD-004 raised during Tutor Login API verification. |
| 2026-08-04 | TD-005 raised during frontend architecture review (single web app vs. split Tutor/Learner apps). |
| 2026-08-04 | TD-006, TD-007 raised while implementing the Workspace and Membership aggregates. |
| 2026-08-04 | TD-005 closed — roles moved to Membership, identity-level token with per-request resolution. TD-002 closed by the first `[Authorize]` endpoints. |
