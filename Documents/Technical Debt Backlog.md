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
**Status:** Deferred

Authentication is registered and the pipeline calls `UseAuthentication()` /
`UseAuthorization()`, but no endpoint carries `[Authorize]`. Token *issuance* is
proven end-to-end; token *validation* is not exercised by any request.

Issuance and validation read the same `Jwt:Key` / `Jwt:Issuer` / `Jwt:Audience`
config keys, so they agree by construction. The risk is low.

**Trigger:** the first protected endpoint — this closes itself at that moment.
**Resolution sketch:** no dedicated work item. When adding the first `[Authorize]`
endpoint, confirm a token from `POST /api/auth/login` is accepted, and that a
tampered/expired one returns 401.

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
**Status:** Deferred
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

**Trigger:** whichever comes first — implementing Membership/Workspace, the first
endpoint making an authorization decision, or role-driven navigation in the frontend.

**Resolution sketch:** move role assignment onto Membership as a workspace-scoped
collection. Drop `Identity.Role`. Decide the token model deliberately — either a
Workspace-scoped token minted after Workspace selection (fits "a learner interacts
with exactly one Workspace at a time", IdentityAndWorkspaceAccess line 131), or an
identity-level token with roles resolved per request from Membership. Requires an EF
mapping change and a data migration.

---

## Log

| Date | Change |
| --- | --- |
| 2026-08-04 | Created. TD-001…TD-004 raised during Tutor Login API verification. |
| 2026-08-04 | TD-005 raised during frontend architecture review (single web app vs. split Tutor/Learner apps). |
