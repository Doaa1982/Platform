# Commercial Domain — Decisions Needed Before Design

**Version:** 1.1
**Status:** Approved — 2026-08-09 (Owner sign-off, items 1–9). See §Addendum for items 10–11.
**Purpose:** One-page summary of every open commercial-policy question blocking detailed design. Each item has a recommended default so this can be approved quickly rather than re-litigated from scratch. Full reasoning for each lives in `CommercialDomainReferenceArchitecture.md` §37 and `Commercial Domain V1 Scope.md`.

---

## How to use this document

For each row: accept the recommended default, propose an alternative, or flag as "needs discussion." Nothing downstream (data model, API design, engineering estimates) should proceed against an item still marked open.

---

| # | Decision | Recommended Default | Why | Approve? |
| - | --- | --- | --- | :-: |
| 1 | Entitlement conflict precedence when multiple sources (base product, pack, promotion, override) touch the same capability | **Override > Promotion > Pack/Capacity > Base Product** | Already drafted as the Licensing resolution rule; needs ratification before it's built into the data model | ✅ Approved |
| 2 | Studio / Academy product families in V1? | **No — Solo only.** Catalog schema should still structurally support them so no rework is needed later | Reference Architecture frames Solo as the priority customer journey; Studio/Academy are the next stage, not the first | ✅ Approved |
| 3 | Which Capability Packs ship at launch? | **AI Author, AI Assessment, AI Mentor, Branding, Collaboration.** Defer Marketing, Commerce, Live Teaching, Parent Engagement, Integration | These five align directly with the Solo AI+ value proposition; the deferred five depend on capabilities (API/SSO, campaigns) not otherwise in V1 scope | ✅ Approved |
| 4 | Subscription Pause/Resume in V1? | **Defer to Phase 2.** Cancel/reactivate covers the immediate need | Not present in Billing's explicit V1 support list; adds meaningful state-machine complexity for uncertain launch demand | ✅ Approved |
| 5 | Entitlement Overrides (manual support exceptions) in V1? | **Include.** Support will need the ability to grant time-bound exceptions from day one | Without this, the first support escalation becomes a database hotfix instead of an audited, reversible action | ✅ Approved |
| 6 | What happens to a user's content when capacity/capability is reduced (e.g., 2 tutors → 1)? | **Access is restricted; data is never deleted.** Exact reassignment/read-only behavior is a Workspace-domain follow-up, not a Commercial Domain blocker | Already encoded as a Licensing invariant (LIC-005); the remaining piece is UX, which can be designed in parallel rather than blocking Commercial Domain work | ✅ Approved |
| 7 | Enterprise / custom negotiated contracts in V1? | **Out of scope.** Catalog and Configuration Engine should not be designed in a way that precludes adding it later | Billing explicitly recommends avoiding complex enterprise billing "until there is a real business requirement" | ✅ Approved |
| 8 | Who owns each gate of the catalog change process (Draft → Business Review → Pricing Review → Architecture Review → Product Approval → Publish)? | **Assign named owners now** (low effort, high value) | The process exists on paper but has no accountable individuals; this is the cheapest item on this list to resolve | ✅ Approved |
| 9 | Multi-currency / tax / localization in V1? | **Single currency, no dedicated Tax context.** Money type should still be currency-aware in the data model | Explicitly deferred in the Integration Architecture; cheap to keep the door open in the schema, expensive to retrofit later | ✅ Approved |

---

## Addendum — Technical Items (raised during data-model drafting)

| # | Decision | Recommended Default | Status |
| - | --- | --- | :-: |
| 10 | Accept polymorphic foreign keys (Entitlement.source_ref_id, FinancialLedgerEntry.related_ref_id, InvoiceLine.component_ref_id, PromotionScope) or require separate typed FK columns? | Accept polymorphic FKs for V1; revisit if they cause real integrity issues | ✅ Approved |
| 11 | Usage & Metering throughput/latency target (every AI operation writes a usage event) | ~5 events/sec sustained peak (headroom to ~20/sec), <1–2s reservation check, ~60s counter freshness — derived from "hundreds of workspaces" + the heaviest documented usage scenario | 🟡 Provisional placeholder set 2026-08-09 |

Item 11 is now unblocked for design purposes with an explicit, sourced placeholder (see `Commercial Domain Data Model — Usage & Metering.md` §6) — not a measured figure. Replace with real telemetry once available.

## Addendum 2 — Foundational Correction (2026-08-09)

| # | Correction | Resolution |
| - | --- | --- |
| 12 | This platform does not collect payment. Billing was originally modeled as a full in-house payment system. | **Billing narrowed to Invoice generation only** — no payment method, gateway, or automated refund. An authorized actor manually marks an Invoice Paid, which triggers Subscription Management's Manual Commercial Activation (`SubscriptionManagementArchitecture.md` §27a) instead of a payment-provider webhook. |

This wasn't a policy choice among alternatives (unlike items 1–10) — it's a correction of a wrong assumption baked into the original architecture. Affected documents: `CommercialDomainReferenceArchitecture.md` §28, `SubscriptionManagementArchitecture.md` §27a/§29/§39–40/§52, `BillingArchitecture.md` (scope banner added), `Commercial Domain Data Model — Billing.md` (rewritten), `Commercial Domain Data Model.md` (`SUBSCRIPTION_EVENT` extended), `Commercial Domain V1 Scope.md` §2.6 and §3.

## What proceeds regardless of this sign-off

The core commercial data model (Product → Configuration → Subscription → License → Entitlement) can be drafted in parallel, since its shape doesn't depend on how these nine items resolve — only certain fields and enum values do. Those fields will be marked as pending confirmation in the model itself.

## What is blocked until this is signed off

Engineering estimates, sprint planning, and any schema work on Capability Packs, Subscription pause states, or Entitlement Overrides specifically.
