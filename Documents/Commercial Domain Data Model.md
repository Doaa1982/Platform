# Commercial Domain Data Model — Core Commercial Spine

**Version:** 0.1
**Status:** Draft — First Pass, Not Yet Reviewed
**Scope:** Product Management → Product Configuration → Subscription → Licensing & Entitlements
**Out of scope for this pass:** Billing, Usage & Metering, and Promotion & Discounts are shown only as referenced boundary entities (enough to complete the foreign keys below). Each deserves its own data-model document; modeling all eight contexts in one pass would make this unreviewable.

---

# 1. Purpose

Every Commercial Domain document describes its aggregates in prose (`License → License ID, Workspace ID...`) rather than as a real schema. This document is the first translation of that prose into entities, fields, keys, and relationships for the four bounded contexts that form the core commercial spine: **what can we sell → what did they choose → what did they commit to → what can they use.**

This is a **first pass**, not an approved schema. Several fields are explicitly marked pending sign-off against `Commercial Domain Decision Brief.md`, and a handful of modeling choices were made to translate prose into a schema where the source documents didn't specify one — those are called out separately in §6 so they can be reviewed rather than silently assumed.

---

# 2. Modeling Conventions

* All primary keys are `id` (UUID) unless noted.
* Money is modeled as `(amount, currency)`, not a bare decimal — per `CommercialDomainIntegrationArchitecture.md` §98, so the schema doesn't need to change shape when multi-currency ships later even though V1 is single-currency.
* Entities described in the source documents as **immutable snapshots** (`ConfigurationSnapshot`, `SubscriptionVersion`) are modeled as insert-only — no update path, only new rows — per CPR-008, SUB-003, and LIC-007.
* Entities described as **append-only history** (`SubscriptionEvent`, `LicenseHistory`) are event logs, not mutable state.
* Entities outside this pass's scope (Billing, Usage, Promotion) are marked **(external)** and shown only where a foreign key crosses the boundary.

---

# 3. Diagram — Catalog (Product Management)

```mermaid
erDiagram
    PRODUCT_FAMILY ||--o{ PRODUCT : contains
    PRODUCT ||--o{ PRODUCT_VERSION : has
    CAPABILITY_DOMAIN ||--o{ CAPABILITY : contains
    CAPABILITY_DOMAIN ||--o{ CAPABILITY_PROFILE : defines
    PRODUCT_VERSION ||--o{ PRODUCT_VERSION_PROFILE : grants
    CAPABILITY_PROFILE ||--o{ PRODUCT_VERSION_PROFILE : "granted by"
    CAPABILITY ||--o{ CAPABILITY_AI_POLICY : has
    AI_ASSISTANCE_LEVEL ||--o{ CAPABILITY_AI_POLICY : "assigned as"
    CAPABILITY_PACK ||--o{ CAPABILITY_PACK_COMPONENT : contains
    CAPABILITY_DOMAIN ||--o{ CAPABILITY_PACK_COMPONENT : scopes
    CAPACITY_DEFINITION ||--o{ PRODUCT_VERSION_CAPACITY : "defaulted by"
    PRODUCT_VERSION ||--o{ PRODUCT_VERSION_CAPACITY : sets

    PRODUCT_FAMILY {
        uuid id PK
        string name
        string primary_customer_segment
    }
    PRODUCT {
        uuid id PK
        uuid family_id FK
        string name
        string status
    }
    PRODUCT_VERSION {
        uuid id PK
        uuid product_id FK
        int version_number
        datetime effective_from
        datetime effective_until
        bool retired_for_new_sales
    }
    CAPABILITY_DOMAIN {
        uuid id PK
        string name
    }
    CAPABILITY {
        uuid id PK
        uuid domain_id FK
        string name
    }
    CAPABILITY_PROFILE {
        uuid id PK
        uuid domain_id FK
        string name
        int ordinal
    }
    PRODUCT_VERSION_PROFILE {
        uuid product_version_id FK
        uuid capability_domain_id FK
        uuid capability_profile_id FK
    }
    AI_ASSISTANCE_LEVEL {
        uuid id PK
        string name
        int ordinal
    }
    CAPABILITY_AI_POLICY {
        uuid id PK
        uuid capability_id FK
        uuid product_version_id FK
        uuid ai_assistance_level_id FK
    }
    CAPABILITY_PACK {
        uuid id PK
        string name
        string status
        int version
    }
    CAPABILITY_PACK_COMPONENT {
        uuid id PK
        uuid pack_id FK
        uuid capability_domain_id FK
        uuid grants_profile_id FK
        uuid grants_ai_level_id FK
        uuid requires_min_profile_id FK
    }
    CAPACITY_DEFINITION {
        uuid id PK
        string name
        string unit
    }
    PRODUCT_VERSION_CAPACITY {
        uuid product_version_id FK
        uuid capacity_definition_id FK
        string default_value
    }
```

---

# 4. Diagram — Commercial Spine (Configuration → Subscription → License → Entitlement)

```mermaid
erDiagram
    CONFIGURATION ||--o{ CONFIGURATION_PACK_SELECTION : selects
    CONFIGURATION ||--o{ CONFIGURATION_CAPACITY_SELECTION : selects
    CONFIGURATION ||--|| CONFIGURATION_SNAPSHOT : resolves_to
    CONFIGURATION_SNAPSHOT ||--o{ SUBSCRIPTION_VERSION : "used by"
    SUBSCRIPTION ||--o{ SUBSCRIPTION_VERSION : has
    SUBSCRIPTION ||--o{ SUBSCRIPTION_EVENT : logs
    SUBSCRIPTION ||--|| WORKSPACE_LICENSE : produces
    WORKSPACE_LICENSE ||--o{ ENTITLEMENT : grants
    WORKSPACE_LICENSE ||--o{ LICENSE_HISTORY : logs
    ENTITLEMENT_OVERRIDE ||--o{ ENTITLEMENT : influences
    SUBSCRIPTION }o--|| BILLING_ACCOUNT_EXT : "billed via"
    CONFIGURATION_SNAPSHOT }o--o| PROMOTION_EXT : "priced with"

    CONFIGURATION {
        uuid id PK
        uuid workspace_id FK
        uuid base_product_version_id FK
        string status
    }
    CONFIGURATION_PACK_SELECTION {
        uuid configuration_id FK
        uuid capability_pack_id FK
    }
    CONFIGURATION_CAPACITY_SELECTION {
        uuid configuration_id FK
        uuid capacity_definition_id FK
        int selected_value
    }
    CONFIGURATION_SNAPSHOT {
        uuid id PK
        uuid configuration_id FK
        string rule_version
        string pricing_version
        uuid promotion_id FK
        decimal price_amount
        string price_currency
        datetime created_at
    }
    SUBSCRIPTION {
        uuid id PK
        uuid workspace_id FK
        uuid customer_id FK
        uuid billing_account_id FK
        uuid current_configuration_snapshot_id FK
        string status
        string billing_cycle
        date start_date
        date current_period_end
        date renewal_date
        date cancellation_effective_date
    }
    SUBSCRIPTION_VERSION {
        uuid id PK
        uuid subscription_id FK
        int version_number
        uuid configuration_snapshot_id FK
        string change_type
        datetime effective_from
        datetime effective_until
    }
    SUBSCRIPTION_EVENT {
        uuid id PK
        uuid subscription_id FK
        string event_type
        datetime occurred_at
    }
    WORKSPACE_LICENSE {
        uuid id PK
        uuid workspace_id FK
        uuid subscription_id FK
        uuid configuration_snapshot_id FK
        string status
        datetime effective_from
        datetime effective_until
    }
    ENTITLEMENT {
        uuid id PK
        uuid license_id FK
        string entitlement_type
        uuid capability_domain_id FK
        string value
        string source
        uuid source_ref_id
        datetime effective_from
        datetime effective_until
    }
    ENTITLEMENT_OVERRIDE {
        uuid id PK
        uuid workspace_id FK
        string entitlement_key
        string value
        string reason
        uuid applied_by FK
        datetime effective_from
        datetime effective_until
        string status
    }
    LICENSE_HISTORY {
        uuid id PK
        uuid license_id FK
        string event_type
        datetime occurred_at
    }
    BILLING_ACCOUNT_EXT {
        uuid id PK
    }
    PROMOTION_EXT {
        uuid id PK
    }
```

---

# 5. Cross-Context Foreign Key Summary

| Field | Points To | Owning Context | In Scope Here? |
| --- | --- | --- | --- |
| `Configuration.workspace_id` | Workspace | Workspace Domain | External |
| `Subscription.customer_id` | Customer | Identity Domain | External |
| `Subscription.billing_account_id` | BillingAccount | Billing | External |
| `ConfigurationSnapshot.promotion_id` | Promotion | Promotion & Discounts | External |
| `Entitlement.source_ref_id` (when source = Promotion) | AppliedPromotion | Promotion & Discounts | External |
| `ConfigurationCapacitySelection` / `Entitlement` usage-type rows | Meter / UsageCounter | Usage & Metering | External |
| `EntitlementOverride.applied_by` | User/Actor | Identity Domain | External |

No table in this document is a second source of truth for an externally-owned entity — these are foreign keys only, matching the Source of Truth Matrix already defined in `CommercialDomainIntegrationArchitecture.md` §7.

---

# 6. Modeling Decisions Made While Translating Prose to Schema

These weren't specified by any source document; they're reasonable defaults chosen to produce a workable schema, and should be explicitly reviewed rather than assumed correct:

1. **`Entitlement.source_ref_id` is polymorphic** (its meaning depends on `source`: a Product Version, a Capability Pack, a Promotion, or an Entitlement Override). This is the simplest way to model "one of several possible sources," but polymorphic associations are harder to enforce referential integrity on in most relational databases. An alternative is four nullable FK columns instead of one polymorphic pair — worth a decision before implementation, not a modeling detail to skip past.
2. **`CapabilityProfile.ordinal` is scoped per domain, not global**, because the Reference Architecture explicitly states profiles "do not necessarily need identical names across domains" (§9) — Collaboration's `Solo → Solo+ → Team → Organization` and Assessment's `Foundation → Professional → AI+` are different ordinal scales that must never be compared to each other.
3. **`ConfigurationSnapshot` and `SubscriptionVersion` are insert-only tables**, not soft-deleted/updated rows, to satisfy the immutability invariants (CPR-008, SUB-003) without relying on application code to enforce it.
4. **Capacity is stored as a string `default_value`/`selected_value`** rather than a strict integer, to accommodate the `"Unlimited"` sentinel used throughout the catalog (e.g., Academy tutor capacity) without a separate nullable "is unlimited" flag. This is a minor call but affects every capacity-reading query, so it's flagged rather than hidden.

---

# 7. Fields Pending Decision Brief Sign-off

| Field / Entity | Depends On | Decision Brief Item |
| --- | --- | --- |
| `Entitlement.source` precedence logic (Override > Promotion > Pack > Base) | Ratification of the precedence rule | #1 |
| Whether `PRODUCT_FAMILY` needs `Studio`/`Academy` rows populated at launch vs. structurally present but unpublished | Studio/Academy V1 inclusion | #2 |
| Which `CAPABILITY_PACK` rows are seeded at launch | Capability Pack launch list | #3 |
| Whether `Subscription.status` needs to support `Paused`/`Resume` transitions in V1 | Pause/Resume scope | #4 |
| Whether `ENTITLEMENT_OVERRIDE` ships in V1 or is deferred | Entitlement Overrides scope | #5 |
| Whether `Subscription.billing_cycle` enum includes `Quarterly`/`Custom` at launch | Billing cycle scope | (V1 Scope §2.3) |

---

# 8. Explicitly Not Modeled in This Pass

* Billing (`Invoice`, `Payment`, `CreditLedgerEntry`, `BillingAccount` internals) — now modeled in `Commercial Domain Data Model — Billing.md`
* Usage & Metering (`Meter`, `UsageEvent`, `UsageCounter` internals) — now modeled in `Commercial Domain Data Model — Usage & Metering.md`
* Promotion & Discounts (`Promotion`, `Coupon`, `Redemption`, `AppliedPromotion` internals) — now modeled in `Commercial Domain Data Model — Promotion & Discounts.md`

All four documents independently arrived at the same modeling question — a polymorphic foreign key for "this entitlement/ledger-entry/scope came from one of several possible source types" (`Entitlement.source_ref_id`, `FinancialLedgerEntry.related_ref_id`, `InvoiceLine.component_ref_id`, `PromotionScope`'s generic join). That recurrence across four independently modeled contexts is a signal, not a coincidence — it should be resolved once, as a shared data-modeling convention, rather than reviewed separately in each document.

---

# 9. Status

**Draft — First Pass.** Has not been reviewed by engineering or validated against the Decision Brief. Next step: review against `Commercial Domain Decision Brief.md`, resolve §7, then proceed to model Billing, Usage & Metering, and Promotion & Discounts using the same pattern.
