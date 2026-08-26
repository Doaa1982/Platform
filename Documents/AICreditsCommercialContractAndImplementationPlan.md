# AICreditsCommercialContractAndImplementationPlan.md

**Version:** 1.0
**Status:** Draft — pending product/finance sign-off on Part A
**Bounded Context:** AI Assistant / Commercial Integration / Usage & Metering
**Document Type:** Commercial decision record + engineering implementation plan.
This is **not** another conceptual architecture document — the concepts are
already fully specified across the four documents below. This document exists
to do the two things none of them do: commit actual numbers to the open
commercial placeholders, and sequence the actual code changes.

**Depends On:**

* `AIUsageAndCostArchitecture.md`
* `AIProductPackagingArchitecture.md`
* `AICommercialIntegrationArchitecture.md`
* `AICommercialRuntimeArchitecture.md`
* `LicensingAndEntitlementArchitecture.md`
* `CommercialProductManagementArchitecture.md`

---

# 1. Purpose

Four architecture documents already establish, in full conceptual detail, how
AI usage, cost, packaging, and runtime authorization should relate to the
commercial system (Usage ≠ Cost ≠ Price, ledger-based credits, entitlement
before execution, etc.). None of them commit to a number. None of them are
implemented in code.

Concretely, today:

```text
Platform.Api/AI/AiOrchestrator.cs
    "Authorization and usage estimation/reservation/reconciliation are
    left to ... a future AIUsageAndCostArchitecture slice"

Platform.Api/AI/IAiModelProvider.cs
    CompleteAsync returns Task<string> — no usage data, ever

Platform.Domain / Platform.Infrastructure
    No CreditLedgerEntry, no Wallet, no Debit, no Consume — nothing
```

Meanwhile `CommercialCatalog.cs` already seeds `AiCreditsIncluded` — 5,000 /
20,000 / 75,000 — as a public, customer-facing attribute on Solo Essential
($19), Solo Professional ($39), and Solo AI+ ($79), returned today by
`CommercialCatalogController`. **The commercial promise is already live. The
plumbing behind it is not.**

# 2. Why Phase 1 and Phase 3 Must Ship Together

`AIProductPackagingArchitecture.md` §74 lays out an evolution path where
Phase 1 is "Subscription + Included AI" and AI Credits don't appear until
Phase 3. That sequencing assumes credits haven't been promised yet. They
have — the catalog numbers above are already in the API response a pricing
page could render today. This plan therefore compresses Phases 1 and 3: we
build usage metering and the credit ledger in the same pass, because the
number on the pricing page needs to mean something the day it's not just a
seed value.

---

# PART A — Financial Base Contract

Each section below resolves one open placeholder the architecture documents
deliberately left as "a commercial rule" without deciding it. Each is a
**DECISION** — the specific number or policy this plan builds against — with
the reasoning, and the source section it resolves.

## A1. Credit Cost Basis

Claude Sonnet 5 (the configured default model, `AiOptions.Model`) prices at
$2 / M input tokens, $10 / M output tokens. The catalog's own numbers imply
three different $/credit rates depending which tier granted the credit:

| Plan | Price | Credits | $ / credit |
|---|---|---|---|
| Solo Essential | $19 | 5,000 | $0.00380 |
| Solo Professional | $39 | 20,000 | $0.00195 |
| Solo AI+ | $79 | 75,000 | $0.00105 |

**DECISION:** design skill prices (A2) against the Professional-tier rate,
**$0.002/credit**, as the canonical basis — the middle tier, and close enough
to $0.002 to keep the arithmetic simple. Essential-tier customers effectively
pay a premium per credit (already true structurally from the catalog, not
introduced by this plan); AI+ customers get a volume discount. This is the
standard SaaS shape — smaller commitment costs more per unit — and requires
no new mechanism, just this document naming it as intentional rather than
incidental.

## A2. Skill Credit Price Table

Prices below are estimated from typical prompt sizes inferred from each
skill's own code (context caps, output caps) at the A1 basis with a ~4–5x
margin multiplier over raw model cost, to absorb infra overhead, price
volatility (see A1's own caveat that provider pricing changes — Claude
Sonnet 5's scheduled September increase was cancelled days before this
document was written), and estimation error. **Treat these as the shipped
v1 defaults, not settled truth — they are exactly what Part B's Phase 6
reconciliation job exists to correct.**

| Skill | Band | Credits | Notes |
|---|---|---|---|
| `LessonAssistantSkill` (mentor chat) | — | 20 / question | 12,000-char transcript cap bounds worst case |
| `GradeAssessmentSkill` | ≤10 open answers | 8 | |
| `GradeAssessmentSkill` | 11–30 open answers | 20 | |
| `GradeAssessmentSkill` | 31+ open answers | 35 | rare; still capped by `MaxOutputTokens` |
| `GenerateQuestionsSkill.SuggestAsync` | — | 15 | |
| `GenerateStandaloneQuestionsSkill` | ≤15 questions requested | 15 | |
| `GenerateStandaloneQuestionsSkill` | 16+ questions requested | 30 | |
| `GenerateLessonQuizSkill` | ≤10 transcript segments | 15 | |
| `GenerateLessonQuizSkill` | 11+ segments | 30 | |
| `GenerateLessonTitleSkill` | — | 5 | small, fixed-shape output |
| `GenerateWorkspaceProfileSkill` | — | 10 | |
| `GenerateLearningObjectivesSkill` | — | 10 | |
| `GenerateWhatYoullLearnSkill` | — | 8 | |
| `GenerateLessonBodySkill` | — | 30 | runs near the 1,536-token output cap |
| `GenerateHomeworkSkill` | — | 15 | |
| `GenerateGlossarySkill` | — | 10 | |
| `GenerateProductDescriptionSkill` | — | 8 | |
| `ExtractLessonContentFromResourceSkill` | ≤2 pages / attachments | 25 | vision/document tokens run well above text |
| `ExtractLessonContentFromResourceSkill` | 3+ pages / attachments | 60 | highest single-call cost in the system; consider a hard attachment cap regardless of price |

## A3. Credit Consumption Order

`AIProductPackagingArchitecture.md` §41 and `AICommercialIntegrationArchitecture.md`
§31 both flag this as needing a deterministic rule and don't set one.

**DECISION:** consume in this order — **Trial → Promotional → Subscription
(current period) → Purchased (top-up packs)**. Rationale: burn the credits
that expire soonest first (trial and promotional grants are the most
time-boxed), preserve purchased credits the customer paid real money for
until last, since those are the ones a customer will notice and complain
about if consumed "unfairly" early.

## A4. Credit Expiration

`AIProductPackagingArchitecture.md` §40 leaves this as "may expire after N
days, or never."

**DECISION:**
- Subscription-granted (included) credits expire at the end of the billing
  period they were granted in — no rollover. This matches §44's renewal
  model ("grant on every cycle") and is simplest to reason about: the
  balance a customer sees is always "this period's included amount minus
  this period's usage."
- Trial and promotional credits expire 30 days after grant, or at first
  paid conversion, whichever comes first.
- Purchased top-up credits **never expire.** The customer paid cash for
  them; clawing them back on a timer is the single most common source of
  AI-credit-system complaints industry-wide, and it's easy to avoid.

## A5. Overage Policy

`AIProductPackagingArchitecture.md` §27–30 lists Block, Consume Credits,
Charge Overage, Downgrade Quality as options without picking one.

**DECISION: Block, not silent overage billing.** When the combined balance
(subscription + trial/promo + purchased, per A3's order) reaches zero, force
`AiAssistanceLevel.Manual` for that workspace — reusing the exact mechanism
`EntitlementResolutionService.RecomputeAsync` already uses for `Restricted`/
`Expired` license states — and surface the commercial actions from §66–67
(`PurchaseCredits`, `UpgradePlan`) in the UI. A self-serve tutoring SaaS
audience should never see a surprise charge; a hard, clearly-explained stop
with an obvious top-up path is the safer default. Usage-based overage
billing can be revisited once there's a segment (e.g. an Enterprise tier)
that explicitly wants it.

## A6. Reservation vs. Direct Debit

`AICommercialIntegrationArchitecture.md` §21–23 and `AIUsageAndCostArchitecture.md`
§31–35 describe a full reserve → execute → reconcile flow, aimed at
scenarios where consumption is uncertain before execution (their own worked
example is a 90-minute video transcription).

**DECISION: skip the reservation state machine for v1.** Every skill in
scope here uses flat or banded pricing (A2) — the price is fully known
before the provider is ever called, so there is nothing to reconcile after
the fact. Use one atomic check-then-debit inside a single DB transaction at
the `AiOrchestrator` chokepoint instead: check balance ≥ price, debit, call
the provider; if the provider call throws, write a compensating refund
entry. This satisfies the same intent as §35 ("don't spend provider money on
a request that can't be fulfilled commercially") with far less machinery.
Revisit true reservation only if/when a genuinely variable-cost operation
(long-form video processing, say) enters scope.

## A7. Trial Credits

**DECISION:** every new workspace is granted **200 trial credits** on
creation (`GrantType = Trial`), consumed first per A3, expiring per A4.
200 credits covers roughly 6–10 typical AI-assist calls at A2's prices —
enough to demonstrate value across a couple of skills without giving away a
meaningful fraction of even the cheapest paid tier's monthly allowance
(5,000).

## A8. AI Credit Top-Up Packs

`AIProductPackagingArchitecture.md` §39 calls for credits to be "themselves
a commercial product." Today's `CapabilityPackDefinition` (`Platform.Domain/CommercialCatalog.cs`)
has `DomainGrants` and `ExtraTutorCapacity` — **no credit-shaped field at
all.** Without this, a customer who runs out mid-cycle has no option but a
full plan upgrade.

**DECISION:** add `ExtraAiCredits` to `CapabilityPackDefinition`, resolved
additively (the same rule already governing `ExtraTutorCapacity` per
Licensing & Entitlements §12), and seed three packs:

| Pack | Credits | Price | $ / credit |
|---|---|---|---|
| Credit Pack S | 5,000 | $15 | $0.0030 |
| Credit Pack M | 20,000 | $50 | $0.0025 |
| Credit Pack L | 50,000 | $110 | $0.0022 |

Priced slightly above the A1 basis (purchased credits should cost a bit more
per unit than subscription-included ones — that's the standard incentive to
prefer the subscription tier over ad-hoc top-ups) with the same volume-discount
shape already present in the Solo tiers.

## A9. Upgrade / Downgrade / Cancellation

`AIProductPackagingArchitecture.md` §45, §47–48 flag these without deciding
forfeiture rules.

**DECISION:**
- **Purchased credits are never forfeited** — by downgrade, upgrade, or
  cancellation. They were paid for outright.
- **Subscription-included credits are forfeited immediately on downgrade**
  to the new tier's lower allowance (no negative balance is created; the
  workspace simply now has the new tier's allowance going forward).
- **Cancellation** revokes future subscription grants but does not claw back
  credits already granted for the current, already-paid period, and does
  not touch purchased-credit balance — consistent with §45's "existing
  historical usage remains intact."
- **Upgrade** grants the new tier's higher allowance immediately if the
  commercial system supports immediate entitlement activation (per §48),
  rather than waiting for the next renewal.

## A10. Worked Example — Mid-Cycle Top-Up

Ties A5, A6, A8, and A9 together, since this is the single most common
real-world trigger for this whole feature: a tutor exhausts their monthly
allowance before the plan's renewal date.

```text
Day 12 of billing period
Solo Professional (20,000 credits/mo) — balance reaches 0
        ↓
EntitlementResolutionService forces AiAssistanceLevel.Manual (A5)
UI shows: [Upgrade Plan] [Buy AI Credits]
        ↓
Tutor buys Credit Pack M — 20,000 credits, $50 (A8)
        ↓
CreditLedgerEntry: EntryType = Purchase, Amount = +20,000, ExpiresAtUtc = null
        ↓
No reservation delay (A6) — balance updates and AiAssistanceLevel
returns to normal on the same request that confirms payment
        ↓
Day 30 — subscription renews
        ↓
New SubscriptionGrant entry: +20,000 (this period's included allowance)
Prior period's unused subscription credits: none carried, N/A here (balance was 0)
Purchased 20,000 from Day 12: still present, untouched (A9 — never expires,
never forfeited by renewal)
        ↓
Balance on Day 30: 20,000 (new subscription grant) + whatever remains of
the Day-12 purchase — the purchase was never plan-specific and outlives
the renewal that triggered it.
```

The tutor's plan and renewal date never change because of the top-up — it's
a pure ledger event, orthogonal to the subscription lifecycle.

---

# PART B — Implementation Plan

Six phases, each mapped to real files. Phases 0–3 are the minimum to make
the existing `AiCreditsIncluded` promise real; 4–6 complete the commercial
surface and the feedback loop that corrects Part A's price table over time.

## Phase 0 — Data Model

**New Domain entities** (`Platform.Domain/`):

```text
CreditLedgerEntry
├── Id
├── WorkspaceId
├── EntryType        (SubscriptionGrant, TrialGrant, PromotionalGrant,
│                      Purchase, Consumption, Refund, Expiration)
├── Amount            (signed: positive = grant/refund, negative = consumption)
├── SkillKey          (nullable — set only on Consumption entries)
├── OccurredAtUtc
├── ExpiresAtUtc       (nullable — set per A4's rules by EntryType)
└── BillingPeriodId    (nullable — set on SubscriptionGrant entries)

SkillCreditCost
├── SkillKey
├── Band              (nullable — null for flat-priced skills)
├── CreditCost
└── EffectiveFrom      (versioned, per PACKAGING-013 — same pattern as
                         CommercialProductVersion's pinning)
```

Balance is **derived**, never stored as a mutable counter — sum non-expired
`CreditLedgerEntry.Amount` for a workspace, ordered per A3's priority for
consumption-time selection. This satisfies PACKAGING-010 ("AI Credits must
be managed through a commercial ledger") directly.

**Migration:** `AddAiCreditLedger` in `Platform.Infrastructure/Migrations/`,
following the existing migration conventions in that folder.

## Phase 1 — Balance & Debit Service

New `ICreditLedgerService` (`Platform.Api/Services/`):

```text
GetBalanceAsync(workspaceId, ct)      → int
TryDebitAsync(workspaceId, skillKey, band, ct)
                                       → atomic check-then-debit,
                                         single DB transaction (A6)
RefundAsync(ledgerEntryId, ct)        → compensating entry on provider failure
```

Registered in `Program.cs` next to the existing `AiOrchestrator` scoped
registration.

## Phase 2 — AiOrchestrator Integration

`Platform.Api/AI/AiOrchestrator.cs`: wrap the existing `CompleteAsync<T>`
private method (and `RunTextAsync`) with a debit check immediately before
the provider call, and a refund call in the failure path. A new
`CreditsExhaustedException`, distinct from the existing
`InvalidOperationException` used for parse failures, lets callers and the
API layer distinguish "out of credits" from "model failed" — this is what
lets the UI show the §65 upgrade/buy-credits prompt instead of a generic
error.

The three banded skills need their band-determining value threaded through:
`GradeAssessmentSkill`, `GenerateStandaloneQuestionsSkill`, and
`GenerateLessonQuizSkill` gain a small addition to their `RunAsync`/`RunTextAsync`
call — an optional `int? bandSize` parameter — while the other ~13 skills'
call sites are untouched. This keeps PACKAGING-007 ("AI Skills must not
contain subscription or pricing logic") intact: skills supply a size signal,
never a price.

## Phase 3 — Zero-Balance Behavior

`Platform.Api/Services/EntitlementResolutionService.cs`: extend the existing
`restrictAi` logic in `RecomputeAsync` (currently `license.Status is
Restricted or Expired`) to also check `ICreditLedgerService.GetBalanceAsync`
and force `AiAssistanceLevel.Manual` at zero balance — without touching
license status itself. This is a few lines added to logic that's already
written, tested, and in production shape.

## Phase 4 — Commercial Surface: Packs & Renewal Grants

- `Platform.Domain/CommercialCatalog.cs`: add `ExtraAiCredits` to
  `CapabilityPackDefinition`; seed the three packs from A8.
- Wherever subscription renewal is currently raised (locate the existing
  renewal event/handler in the Subscription/Billing integration — not yet
  inspected as part of this plan): on renewal, write a `SubscriptionGrant`
  ledger entry sized from the plan's `AiCreditsIncluded`, and an
  `Expiration` entry zeroing the prior period's unused subscription balance
  per A4.

## Phase 5 — Customer-Facing Surface

- `GET /workspaces/{id}/ai-credits/balance` — returns remaining balance in
  credits, never raw tokens (§64: "73 AI interactions remaining," not
  "12,473 input tokens").
- The `CreditsExhaustedException` path (Phase 2) surfaces
  `CommercialActions: [PurchaseCredits, UpgradePlan]` per §66–67, rather
  than a flat error string — so the frontend never hard-codes "limit
  reached → upgrade" logic itself.

## Phase 6 — Reconciliation

A nightly background job pulling actual token usage from each provider's
usage/billing API, diffed against `CreditLedgerEntry` consumption for the
same period. This is what turns Part A2's estimated prices into measured
ones, and is the trigger condition for ever moving a specific skill from
banded pricing to real per-token metering: if reconciliation shows a
skill's margin off by more than ~20% for two consecutive billing cycles,
that skill — not the whole system — becomes a token-metering candidate.

---

# 3. Architectural Invariants This Plan Must Not Violate

Carried forward from the documents this plan implements — not new, just the
ones most load-bearing for the phases above:

**USAGE-005 / PACKAGING-006** — Provider cost must not automatically
determine customer price. (Honored: A2's prices are set with margin, not
pass-through.)

**PACKAGING-007** — AI Skills must not contain subscription or pricing
logic. (Honored: `SkillCreditCost` lives outside `AI/Skills/`; skills pass
size signals, not prices.)

**PACKAGING-010** — AI Credits must be managed through a commercial ledger.
(Honored: `CreditLedgerEntry` is the source of truth; no mutable balance
field anywhere.)

**USAGE-008** — Usage recording must be idempotent. (Phase 1's
`TryDebitAsync` must be called at most once per successful skill execution —
enforce via the same request/operation identity the orchestrator already
has, before this ships.)

**USAGE-011** — Historical usage must remain auditable. (Honored: ledger is
append-only; corrections are new `Refund`/`Adjustment` entries, never
mutated rows.)

---

# 4. Status

**Draft — Version 1.0.**

Part A's nine decisions need explicit product/finance sign-off before Phase
4 (packs, real money) ships — everything in Phase 0–3 can be built and
tested against them as working assumptions in the meantime. Part B's phase
order is designed so each phase is independently shippable and testable:
Phase 0–3 alone makes the existing `AiCreditsIncluded` catalog promise real
without touching billing at all.
