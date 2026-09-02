# V1 Launch Readiness Report — Final (Post-Remediation, Live-Verified)

This supersedes both `V1_PRODUCTION_READINESS_REPORT.md` (the original audit baseline) and the first pass of this file (which was code-review-only). This version reflects an actual, live, end-to-end run against a **genuinely clean, isolated production-configured environment** — a fresh Postgres container, zero shared state with any prior dev database, `ASPNETCORE_ENVIRONMENT=Production`, real local AI inference (Ollama), no manual database repair to hide any failure. Every claim below marked "live-verified" was observed directly: HTTP responses and, at each key step, the actual persisted Postgres row state.

## 1. Executive Decision

```
READY FOR PRODUCTION
```

The complete mandated journey — signup → workspace creation → commercial provisioning → subscription activation → license/entitlement resolution → AI allowance grant → AI consumption → content creation → publishing → student joining → enrollment → learning → submission → evaluation → commercial period transition — was run start to finish against a clean database with zero manual database repair, and every step succeeded. Full evidence in §2–3.

This decision comes with one important disclosure: **the first live run of this exact journey failed**, and failed completely — see the callout below. It was fixed in this same pass and re-verified live afterward. I'm stating this plainly rather than only reporting the passing re-run, because it's the central lesson of this remediation: seven independent code-review passes (file:line citations, real rigor) all missed it, because it is a runtime framework-default behavior no amount of reading the code would surface. It was caught only because the journey was actually driven end to end. The one thing standing between "READY" and a false "READY" was running it for real.

### The bug the live run caught

`Program.cs`'s JWT `OnTokenValidated` handler (added earlier in this engagement for session-revocation, P1 security work) read the identity claim as `context.Principal?.FindFirstValue(JwtRegisteredClaimNames.Sub)`. ASP.NET Core's default inbound claim map silently rewrites the JWT's `"sub"` claim to the legacy `ClaimTypes.NameIdentifier` URI before any handler sees the principal — every controller in the codebase already defends against this (`User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub)`, present in all ~20 controllers), but this one handler didn't. The result: **every authenticated request, for every user, always, failed with 401 "Token is missing required claims."** Login itself worked (issues a token fine); the very next request — any of them — failed. This is not an edge case or a narrow permission gap; it is total, universal breakage of everything beyond the login screen, and it existed because the handler that does the revocation check was itself never exercised by a live authenticated call, only by a pure-domain unit test of the `TokenVersion` increment logic in isolation (exactly the gap the earlier code-review pass had already flagged as a testing risk, without knowing it was hiding an actual defect).

Fixed with the same one-line defensive fallback every controller already uses (`Program.cs`, `OnTokenValidated`). Rebuilt, restarted, re-verified live: the entire journey below was then run successfully.

## 2. P0 Verification

### P0-Auth — JWT claim-mapping bug (found during this pass's live run)

- **Root cause:** `OnTokenValidated`'s `subClaim` lookup checked only the raw `"sub"` claim type, not the `ClaimTypes.NameIdentifier` URI ASP.NET Core's default inbound claim map rewrites it to.
- **Files changed:** `backend/src/Platform.Api/Program.cs` (one lookup, now matches every controller's existing pattern).
- **Business invariant now enforced:** an issued, valid, non-revoked token is actually usable for every subsequent request.
- **Automated test coverage:** **none — this is the single most important testing gap left by this remediation.** `IdentitySessionTests.cs` (`Platform.Domain.Tests`) proves the `TokenVersion` counter increments correctly in isolation; nothing in the repository drives an actual HTTP request through the JWT bearer pipeline. There is no integration test project in this codebase at all (`Platform.Domain.Tests` is domain-only, no DB, no HTTP). Building minimal `WebApplicationFactory`-based integration test coverage for the authentication pipeline specifically should be the very next piece of work after this report, precisely because this bug proves the risk is real, not theoretical.
- **End-to-end verification:** Live-verified. Confirmed broken (reproduced the exact 401 with debug logging showing "Token is missing required claims"), fixed, rebuilt, restarted, then confirmed every subsequent authenticated call in the full journey below succeeded.
- **Status: FIXED AND VERIFIED**, with a flagged, unaddressed regression-protection gap.

### P0-1 — Subscription AI credits never funded to the ledger

- **Root cause:** originally, no code path ever wrote a `CreditLedgerEntry` for a subscription's included credits; earlier work in this engagement (before this pass) fixed funding, period-separation, and refund-on-failure, but left the grant path's concurrency guard missing (a retried renewal or concurrent sweep could double-grant).
- **Files changed this pass:** `backend/src/Platform.Api/Services/LicensingService.cs` (added a `pg_advisory_xact_lock` around the grant, matching `CreditLedgerService.TryDebitAsync`'s existing pattern; reloads the subscription's grant-tracking fields under the lock).
- **Business invariant now enforced:** every subscription period's promised allowance is granted exactly once, durably, even under concurrent/retried triggers.
- **Automated test coverage:** `SubscriptionRenewalAndCreditGrantTests.cs` covers the domain entity's sequential state transitions. The concurrency guard itself has no automated test (same integration-test-infrastructure gap as above).
- **End-to-end verification — live-verified, concurrency included:**
  - Manual Commercial Activation upgrade (Free → Professional, $37.74 prorated invoice → admin marks paid) resulted in `aiCreditsRemaining: 20200` (20,000 new period grant + 200 pre-existing trial, exact, no loss/duplication).
  - **Fired 10 concurrent `recompute-entitlements` calls against the same subscription.** Result: exactly one `SubscriptionGrant` ledger row, 20,000 credits, not duplicated. This is the literal race the fix targets, reproduced and proven closed under real concurrent load against real Postgres.
  - Real AI call (local Ollama) → correct debit (10 credits) → balance updated correctly.
  - **Identical retry of the same AI request** (simulating a client that never saw the original response) → real second AI response returned to the user, balance **unchanged** — the new idempotency-fingerprint mechanism (added this pass, see below) worked.
  - **25 concurrent AI calls fired against a manufactured 190-credit balance** (19 × 10-credit calls possible) → exactly 19 succeeded (200), exactly 6 cleanly rejected (402, structured `credits_exhausted` error with `requiredCredits`/`remainingCredits`), final balance exactly 0, no overdraft.
  - **Forced a real provider failure** (pointed the AI provider at an unreachable port for one call) → debit occurred, call failed with a clean 409 error, balance was refunded back to its pre-call value exactly, ledger shows the matched Consumption/Refund pair.
  - **Simulated a period rollover** (set `CurrentPeriodEnd` into the past, restarted the app with zero manual trigger) → the new `CommercialLifecycleSweepBackgroundService` renewed the subscription automatically on startup with **no admin action whatsoever**, granted the new period's credits exactly once, and the previous period's grant row remained in the ledger, untouched, auditable.
- **Status: FIXED AND VERIFIED.**

### P0-1b — No retry-safe idempotency on AI credit debit (new fix this pass)

- **Root cause:** `CreditLedgerService.TryDebitAsync` had a concurrency guard (advisory lock) but no protection against a *sequential* retry — a client that times out waiting for a response and resends the identical request would be charged twice.
- **Fix:** `AiOrchestrator` now computes a SHA-256 fingerprint of exactly the inputs that determine "is this the same logical AI call" (workspace, skill, band, both prompts, attachment signature) and passes it to `TryDebitAsync`, which — under the same advisory lock — checks for a matching Consumption entry within a 3-minute window before debiting. A recognized duplicate still runs the AI call (so the client gets a real answer) but isn't charged again. No client-generated key or new API contract needed; needed no changes to any of the 16 AI-skill call sites. New migration `AddCreditLedgerIdempotencyFingerprint`.
- **Automated test coverage:** domain-level test confirms the fingerprint is stored on a `Debit` entry (`CreditLedgerEntryIdempotencyTests.cs`); the actual windowed-lookup dedup logic has no automated test (same integration-test gap).
- **End-to-end verification:** live-verified (see the retry bullet under P0-1 above).
- **Status: FIXED AND VERIFIED.**

### P0-2 — No production commercial bootstrap

- **Root cause:** catalog seeding and the Free-plan auto-checkout originally ran only under `Development`.
- **Files verified (already fixed by earlier work in this engagement, not modified this pass):** `Program.cs`'s catalog/pricing seed (runs unconditionally, idempotent via existence checks); `ProvisioningService.cs`'s invitation-acceptance auto-checkout.
- **New fix this pass — a more severe, previously undiscovered variant of the same class of bug:** the **first Platform Operator account** (needed to approve any signup-request at all) was *also* only ever seeded inside `IsDevelopment()`. In production, this meant nobody could ever hold admin authority, so `AdminController`'s signup-approval endpoints were permanently unreachable — the entire self-service tutor signup path (Platform Administrator Business Analysis §7.1) was dead on arrival in any real deployment, independent of and in addition to the JWT bug above. Found only by attempting to actually drive the signup journey as an admin, in `Production`, from empty.
- **Fix:** new `InitialPlatformOperatorOptions` (`InitialPlatformOperator:Email`/`:Password` config), wired into the same unconditional, idempotent bootstrap block as the catalog seed (`Program.cs`) — grants an existing Identity if the email matches one, otherwise creates a new Identity and grants it, otherwise logs a clear warning if unconfigured. Guarded by `!db.PlatformOperators.Any()`, so it never re-runs once a Platform Operator exists.
- **Business invariant now enforced:** a clean production database reaches a state where the entire signup → approve → provision → invite → accept → commercial-provisioning chain is reachable by a real person, with zero manual database intervention.
- **Automated test coverage:** none (same gap as above — no seed/bootstrap test exists).
- **End-to-end verification — live-verified, literally from an empty database:**
  - Fresh Postgres, zero rows. `dotnet ef database update` applied all 39 migrations cleanly in order.
  - App started in `Production` with `InitialPlatformOperator:Email`/`:Password` set via environment variables (the real deployment mechanism) — logged `"Bootstrapped the first Platform Operator"`.
  - DB inspection confirmed: 4 commercial products, 4 product versions, 1 product family, 8 packs, 8 pack versions, 19 skill credit costs, 1 Platform Operator — all from the unconditional startup seed, zero admin-UI clicks.
  - Full signup chain driven for real: `POST /api/signup-requests` (anonymous) → admin login → `approve` → `provision` (issues an invitation with a real link in the JSON response) → `accept` (creates the tutor's Identity, Owner Membership, auto-checks-out the Free plan) — all succeeded, all inspected in the DB afterward (Active Workspace, Active Subscription, Active License, 13 resolved Entitlement rows, 200-credit trial grant).
- **Status: FIXED AND VERIFIED**, including a genuinely new finding this pass closed.

### P0-3 — Destructive actions have no confirmation / no undo

- Unchanged from the prior pass's verification: every one-click delete now confirms with the target named; structural deletes (unit/activity/video) are blocked once published; `LessonRevision.RemoveResource`'s lack of a Draft-only guard is confirmed intentional (documented design — resources are treated as safe, revision-independent metadata).
- **Status: FIXED AND VERIFIED** (frontend confirm dialogs were code-verified, not live-clicked through a browser in this pass — see §4).

## 3. Business Journey Matrix (this pass — live, clean environment)

| Journey | Clean Environment | Result |
|---|---|---|
| A — Signup → admin approval → provisioning → invitation → acceptance | ✅ live-run | Full chain succeeded from an empty DB; admin bootstrap gap found and fixed along the way |
| B — Commercial: Free auto-checkout on acceptance | ✅ live-run | Active Subscription/License/13 Entitlements/200-credit trial, zero manual steps |
| C — Commercial: paid upgrade via Manual Commercial Activation | ✅ live-run | Upgrade request → prorated invoice → admin mark-paid → plan/entitlements/credits all updated correctly |
| D — AI credit funding exactly-once under concurrency | ✅ live-run | 10 concurrent recomputes → exactly one grant |
| E — AI consumption: success / retry / concurrency / exhaustion / failure+refund | ✅ live-run | All five sub-scenarios individually proven (see P0-1 bullets) |
| F — Commercial period transition (renewal) | ✅ live-run | Fully automatic via the new background service, zero admin action, prior period stays auditable |
| G — Tutor content authoring: course, unit, lesson, publish | ✅ live-run | Product → curriculum → unit → lesson → draft content → publish, all persisted correctly |
| H — Assignment: create → configure → publication blocked pre-revision-publish → publish → learner sees it → submit → evaluate → learner sees grade | ✅ live-run | Every step succeeded, including the publish-blocked-until-revision-published guard (P1.2) firing correctly on a live attempt |
| I — Assessment: attempt limit + answer-disclosure policy | ✅ live-run | Attempt 1 of 2: answer withheld. Attempt 2 of 2: answer disclosed (attempts exhausted). Attempt 3: cleanly blocked. Exactly the policy confirmed with the user this session |
| J — Student invitation → acceptance → enrollment → learning | ✅ live-run | Invite → accept → enroll → open lesson → progress recorded |
| K — Unenrollment preserves history | ✅ live-run | `Enrollment.Status → Cancelled` (not deleted); both learners' `LessonProgress` rows still present afterward, row count unchanged |
| L — Removed member loses access immediately | ✅ live-run | Same still-valid JWT, same lesson route, 200 before removal → 404 immediately after (live membership re-check, not cached in the token) |
| M — Authorization attack surface | ✅ live-run | Learner mutating tutor-only content: 403. Non-operator hitting admin routes: 403. Cross-workspace access by slug guess: 404. No token: 401. Garbage token: 401 |
| N — Draft content never reaches a learner | ✅ live-run | Added a second, unpublished "SECRET DRAFT LESSON" to the curriculum; the enrolled learner's own curriculum view showed only the one Published lesson |

Everything in this table was exercised via real HTTP calls against the running API and confirmed against actual Postgres rows, not inferred from response codes alone.

## 4. What this pass did **not** cover (explicit, not hidden)

- **No browser was driven.** Every journey above went through the HTTP API directly (curl), not through the React frontend in an actual browser. The frontend's own build was verified clean (`npm run build`) earlier in this engagement, and it consumes the same API surface, but click-through UI verification (confirm dialogs actually firing, loading/error states rendering) was not re-performed live in this pass.
- **No automated regression test exists for the JWT bug this pass found and fixed**, or for the credit-grant concurrency lock, or for the debit idempotency window. All three were proven correct by hand, live, once — none of the three is protected against a future regression by CI. This is the highest-priority follow-up work.
- **Video/transcription pipeline, invitation email delivery, and password-reset delivery** were not exercised live this pass (Email was deliberately disabled to test the "not configured" production posture, which is itself a real and correctly-handled state — the invitation link appeared directly in the API response, as designed).
- **A second, independent tutor workspace and cross-tenant data isolation at a larger scale** (many workspaces, many products) was not stress-tested — only the specific cross-workspace-by-slug-guess and removed-member cases above.

## 5. Remaining Risks

**P0 — Blocks launch:** none.

**P1 — Should be fixed before launch:**
1. **No integration test coverage for the JWT authentication pipeline.** This is the top item. A `WebApplicationFactory`-based test that logs in and makes one authenticated call would have caught the bug this pass found before it ever reached a live run.
2. Auto-checkout during invitation acceptance still doesn't check/log its own result (carried over, unchanged this pass).
3. Invitation email needs real SMTP config + an `appsettings.Production.json` (or equivalent env vars) at actual deploy time — not a code defect, a deployment-runbook item.
4. `/health` doesn't check DB connectivity; rate-limiting isn't proxy-aware yet (both carried over, unchanged).

**P2 — Acceptable known limitations:** unchanged from the prior pass (entitlement history has no dedicated read API; Grace/Suspend/Expire remain deliberately manual per the no-payment-collection architecture; no debit idempotency key protects against literal browser-level double-submission outside the 3-minute fingerprint window in an unusual way; stale dead i18n keys; zero broader integration-test coverage beyond auth specifically).

**Future:** unchanged.

## 6. Architecture Compliance

All prior-pass findings hold, re-confirmed live rather than only by code reading: no plan-name authorization observed anywhere in the live traffic (every gate resolved via entitlement/capability, e.g. the Free plan cleanly 403'd AI actions by capability level, not by checking a plan string); Configuration → Subscription → License/Entitlement → Usage stayed cleanly separated through the live upgrade flow; entitlements (`credits:ai` = 20000) and usage (ledger balance) were visibly distinct at every step; every credit ledger and entitlement mutation observed in Postgres was append-only, never an UPDATE-in-place or DELETE; workspace isolation held under a live attack attempt (404, not a data leak); the production bootstrap — catalog, pricing, and now the first Platform Operator — is genuinely idempotent and environment-unconditional, confirmed by literally starting from zero rows.

## Changes made in this pass

- `backend/src/Platform.Api/Program.cs` — fixed the JWT claim-mapping bug in `OnTokenValidated`; added the `InitialPlatformOperator` production bootstrap block.
- `backend/src/Platform.Api/InitialPlatformOperatorOptions.cs` (new).
- `backend/src/Platform.Api/Services/LicensingService.cs` — advisory-lock-guarded credit grant (from the prior pass, re-verified live this pass under real concurrency).
- `backend/src/Platform.Api/Services/CreditLedgerService.cs` — windowed idempotency-fingerprint dedup on debit.
- `backend/src/Platform.Api/AI/AiOrchestrator.cs` — computes and passes the fingerprint; no other AI skill file touched.
- `backend/src/Platform.Domain/CreditLedgerEntry.cs` — new `IdempotencyFingerprint` field.
- `backend/src/Platform.Infrastructure/PlatformDbContext.cs` + new migration `AddCreditLedgerIdempotencyFingerprint`.
- `backend/src/Platform.Domain.Tests/CreditLedgerEntryIdempotencyTests.cs` (new).

All verified via `dotnet build` (0 errors), `dotnet test` (66/66 passing), `npm run build` (clean), and — the substantive addition this pass — a complete, live, clean-environment run of the full commercial and learning journey with direct Postgres inspection at every stage.
