# Commercial Domain V1 Scope & Release Boundary

**Version:** 1.1
**Status:** Approved — 2026-08-09 (see `Commercial Domain Decision Brief.md`)
**Domain:** Commercial
**Audience:** Business Architects, Product Owners, Solution Architects, Engineering Leads

---

# 1. Purpose

Every bounded-context document in the Commercial Domain independently states its own "V1" or "initial" scope. No single document consolidates those statements into one cross-context release boundary.

This document exists to give engineering, product, and design one shared answer to: **"What are we actually building first?"** — so that Product Configuration, Licensing, Billing, Promotion, and Advisory are designed against the same boundary instead of each team inferring its own.

This was originally a **compilation and reconciliation**, not a new set of decisions: every item was traced to the document that stated it, and anywhere no document explicitly stated a boundary, it was marked *Inferred — Needs Confirmation* rather than presented as settled. All such items were reviewed and confirmed by the domain owner on 2026-08-09 (see `Commercial Domain Decision Brief.md`) and are now marked **✅ Confirmed** throughout this document rather than inferred.

---

# 2. In Scope for V1 — By Bounded Context

## 2.1 Commercial Product Management

| Item | Status | Source |
| --- | --- | --- |
| Solo Essential, Solo Professional, Solo AI+ | In scope | `CommercialProductManagementArchitecture.md` §8 |
| Capability Profiles: Foundation / Professional / AI+ | In scope | §12–13 |
| AI Assistance Levels: Manual, Assist, Co-Pilot | In scope | §16 |
| AI Assistance Level: Autonomous | **Deferred** | Reference Architecture §11 marks every capability "Future" for Autonomous |
| Capability Packs: AI Author, AI Assessment, AI Mentor, Branding, Collaboration | Inferred in scope (aligned with Solo/AI+ focus) | §19 — needs product confirmation |
| Capability Packs: Marketing, Commerce, Live Teaching, Parent Engagement, Integration | **✅ Confirmed deferred** (2026-08-09) | Not tied to stated Solo priority; Integration Pack specifically overlaps with Academy/Enterprise-only capabilities (API Access, SSO) |
| Studio, Academy product families | **✅ Confirmed deferred** (2026-08-09) | Reference Architecture §5 frames these as later stages in the customer evolution, not the initial target |
| Enterprise / Custom | **Explicitly deferred** | `BillingArchitecture.md` §65: "Avoid implementing complex enterprise billing until there is a real business requirement" |
| Integration & Organization capability domains (API Access, SSO, Departments, Branches) | **Explicitly deferred** | `CommercialProductManagementArchitecture.md` §14 shows these as unavailable until Academy tier |

## 2.2 Product Configuration Engine

| Item | Status | Source |
| --- | --- | --- |
| Configuration Builder, Validator, Dependency Resolver, Conflict Resolver, Rule Engine, Entitlement Composer, Pricing Calculator, Snapshot Manager, Explanation Service | In scope — foundational | `Product Configuration Engine Architecture.md` §10. Both Fixed Plans and Design Your Own Plan depend on this engine; there is no reduced version. |
| Fixed Plan workflow | In scope | §34 |
| Design Your Own Plan workflow | In scope | §33 |
| Upgrade / Downgrade Preview | In scope | §35–36 |
| Configuration Optimization (cost-minimization search) | **Inferred — Defer** | §41 reads as an advanced/later capability; not required for a working purchase flow |

## 2.3 Subscription Management

| Item | Status | Source |
| --- | --- | --- |
| Billing cycles: Monthly, Annual | In scope | `SubscriptionManagementArchitecture.md` §23; confirmed by `BillingArchitecture.md` §65 |
| Core lifecycle: Draft, Pending, Active, Past Due, Grace, Suspended, Cancelled, Expired | In scope | §8 |
| Trial subscriptions | In scope | §24–25; confirmed as a V1 promotion type in `PromotionAndDiscountArchitecture.md` §73 |
| Pause / Resume | **✅ Confirmed deferred** (2026-08-09) | Defined in §30–31, but not listed in Billing's explicit V1 support list (§65) |
| Quarterly / Custom billing cycles | **Deferred** | §23 explicitly frames these as post-V1 expansion |

## 2.4 Licensing & Entitlements

| Item | Status | Source |
| --- | --- | --- |
| Effective Entitlement Resolution (profiles, AI levels, capacity, usage allowances) | In scope — foundational | `LicensingAndEntitlementArchitecture.md` §11 |
| License state derivation from Subscription state | In scope | §8 |
| Entitlement source precedence (Override > Promotion > Pack/Capacity > Base) | In scope, **pending ratification** — see OD-001 | §13 |
| Entitlement Overrides (support exceptions) | **✅ Confirmed in scope** (2026-08-09) | Not explicitly listed as V1 by any document, but operationally necessary from day one for support to function |

## 2.5 Usage & Metering

| Resource | Priority | Source |
| --- | --- | --- |
| AI Credits | **P0 — In scope** | `UsageAndMeteringArchitecture.md` §7 |
| AI Tokens (internal) | **P0 — In scope** | §7 |
| Video Processing minutes | P1 — Optional | §7 |
| Storage | P1 — Optional | §7 |
| Student Seats (capacity) | P1 — Optional | §7 |
| Tutor Seats (capacity) | P1 — Optional | §7 — note this is required for Solo AI+'s 1–2 tutor capacity regardless of metering priority |
| Email | **Deferred (P2)** | §7 |
| SMS | **Deferred (P2)** | §7 |

## 2.6 Billing

> **Corrected 2026-08-09: this platform does not collect payment.** Billing is scoped to Invoice generation only. See `CommercialDomainReferenceArchitecture.md` §28 and `BillingArchitecture.md`'s scope-correction banner.

| Item | Status | Source |
| --- | --- | --- |
| Invoice generation (amount owed, line items, tax, currency) | In scope | `BillingArchitecture.md` §9–15 (still applicable portion) |
| Monthly, Annual billing periods | In scope | §65 (invoicing portion) |
| Fixed Plans, Design Your Plan invoicing | In scope | §65 |
| Upgrade (immediate, prorated invoice) | In scope | §25–27 |
| Downgrade (next billing period, reflected on next invoice) | In scope | §28–29 |
| Credits (bookkeeping adjustment to a future invoice) | In scope | §30–31 |
| Manual Commercial Activation (marking an invoice Paid, triggering Subscription activation) | In scope — this is the actual V1 mechanism | `SubscriptionManagementArchitecture.md` §27a |
| Grace period for overdue invoices | In scope | `SubscriptionManagementArchitecture.md` §29 |
| Card payment, payment gateway integration, automated refunds | **Out of scope entirely — no payment collection in this platform** | 2026-08-09 correction |
| Complex enterprise billing (negotiated terms, custom invoicing) | **Explicitly deferred** | §65 |
| Multi-currency | **Explicitly deferred** | `CommercialDomainIntegrationArchitecture.md` §98 — "designed for but not necessarily implemented in V1" |
| Dedicated Tax bounded context | **Explicitly deferred** | §99 |

## 2.7 Promotion & Discounts

| Item | Status | Source |
| --- | --- | --- |
| Percentage discounts, fixed discounts | In scope | `PromotionAndDiscountArchitecture.md` §73 |
| Introductory pricing, free trials, annual discount | In scope | §73 |
| Coupon codes, referral credits | In scope | §73 |
| Promotional AI credits | In scope | §73 |
| Rules: date range, new/existing customer, product scope, billing cycle, redemption limit | In scope | §73 |
| Stacking | **Explicitly deferred** — "No stacking by default" | §27 |
| Complex campaign orchestration | **Explicitly deferred** | §73 |

## 2.8 Product Advisory

| Item | Status | Source |
| --- | --- | --- |
| Rule-based recommendations, usage thresholds | In scope | `Product Advisory Architecture.md` §80 |
| Upgrade, add-on, AI credit, capacity, annual-billing, promotion recommendations | In scope | §80 |
| Recommendation explanation, dismissal, cooldown, analytics | In scope | §80 |
| Design Your Plan integration | In scope | §80 |
| AI-generated recommendations, predictive churn/demand, personalized configuration, price optimization, cross-Workspace recommendations | **Explicitly deferred** | §80 |

## 2.9 Commercial Analytics / AI Commercial Strategy

Not yet written (see Reference Architecture §36). Out of design scope for V1 by definition. Every other context should still publish the domain events it already defines (§18 of Licensing, §31 of the Reference Architecture, etc.) so that when Commercial Analytics is eventually built, historical events are already available rather than requiring backfill.

---

# 3. Cross-Cutting Non-Goals for V1

These apply across every bounded context and are called out once here rather than repeated per-context:

* **Payment collection of any kind** — no payment methods, no gateway integration, no automated payment lifecycle, no automated refunds. Billing produces an invoice; a human marks it paid. Corrected 2026-08-09.
* Multi-currency pricing — single currency for V1.
* Dedicated Tax bounded context — tax handled via integration/manual process, not a first-class domain.
* Localization / per-market pricing (Price Books).
* Enterprise negotiated contracts.
* SSO, API access, departments/branches (Academy/Enterprise-tier governance capabilities).
* AI Autonomous assistance level.
* Promotion stacking.
* Complex campaign orchestration.

---

# 4. Items Requiring Sign-off Before Design Starts

**All five resolved 2026-08-09** — see `Commercial Domain Decision Brief.md`.

1. ✅ **OD-001 (entitlement precedence rule)** — ratified: Override > Promotion > Pack/Capacity > Base Product.
2. ✅ **Studio/Academy inclusion** — confirmed out of V1; catalog remains structurally capable of supporting them later.
3. ✅ **Capability Pack list** — confirmed: AI Author, AI Assessment, AI Mentor, Branding, Collaboration ship at launch; the other five are deferred.
4. ✅ **Pause/Resume** — confirmed deferred to Phase 2.
5. ✅ **Entitlement Overrides** — confirmed in scope for V1, designed alongside the core resolution engine (`LicensingAndEntitlementArchitecture.md` §16).

One additional item surfaced later, during data-model drafting: the Usage & Metering throughput/latency target (tracked as OD-006 in `CommercialDomainReferenceArchitecture.md` §37). A provisional placeholder was derived and set on 2026-08-09 (~5 events/sec sustained peak, sub-1–2s reservation checks, ~60s counter freshness) — not blocking, but flagged for replacement with real telemetry before or shortly after launch.

---

# 5. Status

**Approved — 2026-08-09.** Reviewed and signed off by the domain owner alongside the Open Decisions in `CommercialDomainReferenceArchitecture.md` §37 (see `Commercial Domain Decision Brief.md`). This is now the ratified scope boundary for V1.
