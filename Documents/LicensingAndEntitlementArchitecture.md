# Licensing & Entitlement Architecture

**Version:** 1.0
**Status:** Draft
**Bounded Context:** Licensing & Entitlements
**Parent Domain:** Commercial Domain

---

# 1. Purpose

The Licensing & Entitlement bounded context is responsible for translating a commercial subscription into the **effective rights, capabilities, limits, and usage allowances** of a Workspace.

It answers:

> **"What is this Workspace currently entitled to use?"**

It does not determine what the customer should buy or how products are configured.

---

# 2. Core Responsibility

The context is responsible for:

* creating Workspace licenses;
* activating licenses;
* maintaining license state;
* resolving effective entitlements;
* controlling entitlement dates;
* handling suspension and expiration;
* supporting upgrades and downgrades;
* enforcing capacity limits;
* exposing entitlement decisions to the Workspace;
* maintaining entitlement history;
* handling grace periods;
* supporting entitlement overrides where commercially permitted.

---

# 3. What This Context Does Not Own

| Concern                 | Owner                         |
| ----------------------- | ----------------------------- |
| Product catalog         | Commercial Product Management |
| Product configuration   | Product Configuration         |
| Customer recommendation | Product Advisory              |
| Subscription            | Subscription Management       |
| Payment                 | Billing                       |
| Actual usage            | Usage & Metering              |
| Workspace identity      | Identity                      |
| Workspace business data | Learning Workspace            |

---

# 4. Architectural Position

```text
                    Commercial Product Management
                              │
                              ▼
                   Product Configuration Engine
                              │
                              ▼
                         Subscription
                              │
                              ▼
                ┌─────────────────────────────┐
                │  Licensing & Entitlements   │
                │                             │
                │  License                    │
                │  Entitlement Resolution     │
                │  Entitlement Overrides      │
                │  Grace / Suspension Policy  │
                └──────────────┬──────────────┘
                               │
                               ▼
                     Effective Entitlements
                               │
                               ▼
                        Learning Workspace
```

---

# 5. License vs Entitlement

These two concepts are related but must not be collapsed into one.

```text
License
"The commercial authorization record for a Workspace."

Entitlement
"One specific right, level, or allowance granted by that license."
```

Example:

```text
Workspace License WL-4471
│
├── Status: Active
├── Subscription: SUB-1002
│
└── Entitlements
     ├── Learning Profile = AI+
     ├── Assessment Profile = Professional
     ├── Tutor Capacity = 2
     ├── AI Credits = 75,000
     └── Custom Domain = Enabled
```

A License is the container. Entitlements are its contents.

---

# 6. License Aggregate

Conceptually:

```text
WorkspaceLicense
│
├── License ID
├── Workspace ID
├── Subscription ID
├── Configuration Snapshot Reference
│
├── Status
├── Effective From
├── Effective Until
│
├── Entitlement Set
├── Entitlement Overrides
│
├── Grace State
├── Restriction State
│
└── License History
```

A license always references the Configuration Snapshot that produced it, so the entitlements it grants can be reconstructed and audited later, even if the Product Catalog subsequently changes.

---

# 7. License States

| State          | Meaning                                                           |
| -------------- | ------------------------------------------------------------------ |
| **Pending**    | License created but not yet active (e.g., awaiting first payment)  |
| **Active**     | Workspace may use its full entitlement set                         |
| **Grace**      | Subscription is Past Due, but access remains active per policy     |
| **Restricted** | Access limited to a reduced entitlement set (e.g., paid AI disabled) |
| **Suspended**  | Access to paid entitlements is blocked                             |
| **Expired**    | License period has ended; entitlements are no longer granted       |
| **Revoked**    | License permanently terminated                                     |

---

# 8. License State Derivation

Licensing does not invent its own commercial judgment. License state is **derived** from Subscription state according to a fixed policy table, first introduced in `SubscriptionManagementArchitecture.md` §28 and restated here as the authoritative mapping this context implements:

| Subscription State | License State                 |
| ------------------- | ------------------------------ |
| Active               | Active                         |
| Trial                | Active                         |
| Paused               | Restricted (policy-dependent)  |
| Past Due             | Grace                          |
| Grace                | Grace                          |
| Suspended            | Restricted                     |
| Cancelled            | Active until effective end date |
| Expired              | Expired                        |
| Terminated           | Revoked                        |

```text
Subscription State Changed
         │
         ▼
Licensing & Entitlements
         │
         ▼
Recompute License State
         │
         ▼
Recompute Effective Entitlements
```

Licensing must never hold a Subscription or Billing state of its own that could drift from the source of truth.

---

# 9. Entitlement Types

Reused from the Commercial Domain Reference Architecture (§24), an entitlement may represent:

```text
Capability
Capability Level (Profile)
AI Assistance Level
Capacity
Usage Allowance
Integration
Branding Right
Administrative Permission
```

Every entitlement in the Entitlement Set must be traceable to exactly one of the sources below.

---

# 10. Entitlement Sources

An effective entitlement can be contributed by more than one source at the same time.

```text
Base Product
Capability Pack
Capacity Add-on
Promotion (bonus/temporary grant)
Manual Override (support/commercial exception)
```

Example — the Assessment capability domain may be influenced simultaneously by:

```text
Base Product:        Assessment = Foundation
Capability Pack:      AI Assessment Pack → Assessment >= Professional
Promotion:            +25K bonus AI credits (30-day expiry)
```

The Entitlement Resolution process (§11) is responsible for combining these into one effective, non-ambiguous entitlement set.

---

# 11. Entitlement Resolution Model

This is the core responsibility of the bounded context and the piece of the architecture every other document assumes exists. Resolution runs whenever the Subscription's Configuration Snapshot changes, whenever a Promotion is applied or expires, and whenever a manual override is applied or expires.

```text
1. Load Configuration Snapshot (from Subscription)
2. For each Capability Domain:
       Resolve Effective Profile
3. For each Capability:
       Resolve Effective AI Assistance Level
4. Resolve Capacity (sum of base + add-ons, tracked separately from promotional/temporary capacity)
5. Resolve Usage Allowances (included + purchased + promotional, each tagged with its source)
6. Apply Entitlement Overrides (highest precedence, time-bound)
7. Apply License State Policy (Active / Grace / Restricted / Suspended)
8. Produce Effective Entitlement Set (with per-entitlement source attribution)
```

The output is never computed ad hoc inside the Learning Workspace. It is always the published result of this pipeline.

---

# 12. Effective Profile Resolution Rule

For each capability domain, the effective profile is the **highest applicable profile among all contributing sources, constrained to only the capabilities that source explicitly lists.**

```text
Effective Profile (domain) =
    MAX(
        Base Product Profile(domain),
        Pack Profile(domain)   [only if the pack explicitly targets this domain],
        Override Profile(domain) [if present]
    )
```

This directly enforces the principle already stated in `ProductConfigurationEngineArchitecture.md` §22: *"a higher profile must not automatically imply every commercial entitlement... this prevents accidental entitlement leakage."* Licensing is the context that actually enforces that principle at resolution time, not just at configuration time — a pack that upgrades Assessment must never be allowed to silently upgrade Analytics as a side effect.

---

# 13. Entitlement Source Precedence

When two sources disagree about the same entitlement (rather than simply combining), resolution must be deterministic. Recommended precedence, highest to lowest:

```text
1. Manual Override            (explicit, time-bound, audited exception)
2. Promotional Grant          (temporary, expiring)
3. Capacity / Pack Add-on     (purchased, persistent while active)
4. Base Product Profile       (default)
```

Example:

```text
Base Product:     Assessment = Foundation
AI Assessment Pack: Assessment = Professional
Override:          none

Effective Assessment Profile = Professional
```

```text
Base Product:     Assessment = Professional
Support Override: Assessment = Foundation (temporary downgrade during dispute)

Effective Assessment Profile = Foundation (Override wins)
```

Every resolved entitlement must retain a record of which source determined the final value, so support and audit can answer "why does this Workspace have this entitlement?" without guessing.

---

# 14. Capacity and Usage Resolution

Capacity and usage allowances are **additive**, not MAX-resolved, and promotional/temporary grants must remain distinguishable from persistent ones so they can expire independently.

```text
Tutor Capacity =
    Base Product Capacity + Sum(Capacity Add-ons)

AI Credit Allowance =
    Included Credits + Purchased Pack Credits + Promotional Credits
```

Consumption order for usage allowances follows the priority already defined in `PromotionAndDiscountArchitecture.md` §39:

```text
1. Expiring Promotional Credits
2. Purchased Add-on Credits
3. Included Subscription Credits
```

---

# 15. Downgrade and Capacity Reduction Policy

When a configuration change reduces capacity or removes a capability, Licensing must apply one governing rule:

> **Reducing an entitlement restricts access. It does not delete data.**

Example — Tutor Capacity reduced from 2 to 1:

```text
Before:
Tutor Capacity = 2
Tutor A (Owner), Tutor B (Seat 2)

After Downgrade:
Tutor Capacity = 1

Tutor B's seat access is restricted.
Tutor B's authored content is NOT deleted.
Content ownership/visibility follows Workspace/Learning domain retention policy.
```

Licensing is responsible for guaranteeing that a capacity or capability reduction never triggers deletion as a side effect. It is not responsible for deciding what happens to the affected user's ongoing role in the Workspace — that decision belongs to the Workspace/Identity and Learning domains, which must consume the `EntitlementRevoked` event (§18) to apply their own reassignment or read-only policy. This boundary should be treated as an explicit open coordination point between the Commercial Domain and the Workspace domain, not something Licensing decides unilaterally.

The same principle applies to capability removal (e.g., disabling AI Assessment): access is revoked; previously generated content remains subject to normal data-retention policy, not immediate deletion.

---

# 16. Entitlement Overrides

Commercial exceptions (goodwill access during a support case, a temporarily extended trial, a manually corrected entitlement) are modeled explicitly rather than by mutating the base configuration.

```text
EntitlementOverride
│
├── Override ID
├── Workspace ID
├── Entitlement
├── Value
├── Reason
├── Applied By
├── Effective From
├── Effective Until
└── Status
```

Overrides must always be time-bound or explicitly reviewed; a permanent, unexplained override defeats the purpose of a catalog-driven commercial model and should be treated as an operational exception, not a normal path.

---

# 17. Runtime Entitlement Check

The Learning Workspace must only ever ask Licensing one kind of question:

```text
HasEntitlement(workspace, capability, level?)
```

Never:

```text
GetPlan(workspace) == "Solo AI+"
```

This is the concrete implementation of the Runtime Principle already stated in the Commercial Domain Reference Architecture (§25). The entitlement check reads the last resolved Effective Entitlement Set — it does not re-run resolution synchronously on every Workspace request.

---

# 18. Domain Events

Licensing & Entitlements should publish:

```text
LicenseCreated
LicenseActivated
LicenseStateChanged
LicenseSuspended
LicenseRestricted
LicenseExpired
LicenseRevoked

EntitlementGranted
EntitlementChanged
EntitlementRevoked
EntitlementOverrideApplied
EntitlementOverrideExpired
```

`EntitlementRevoked` is the event other domains (Workspace, Learning, Identity) must consume to apply their own downstream policy when access is reduced — see §15.

---

# 19. Entitlement and License History

Every change to the Entitlement Set must be recorded, not overwritten in place.

```text
License History

Aug 08 — License Created — Source: Subscription Activated
Aug 08 — Entitlement Granted — Learning = AI+ (Base Product)
Aug 20 — Entitlement Changed — AI Credits 75K → 100K (Pack Added)
Sep 08 — License State Changed — Active → Grace (Payment Failed)
Sep 12 — License State Changed — Grace → Active (Payment Recovered)
```

This history is what allows support and audit to reconstruct "why is this Workspace entitled to this, as of this date" — the same discipline already required of Subscription history and Usage events elsewhere in the domain.

---

# 20. License Invariants

### LIC-001

A license must always reference a valid Configuration Snapshot.

### LIC-002

License state must be derived from Subscription state and commercial policy — never set independently.

### LIC-003

An effective entitlement must always be attributable to exactly one determining source.

### LIC-004

A capability profile granted by one component must never implicitly upgrade an unrelated capability domain.

### LIC-005

Reducing or removing an entitlement must restrict access; it must never itself delete Workspace data.

### LIC-006

Entitlement Overrides must be time-bound or subject to explicit periodic review.

### LIC-007

License and entitlement history must be immutable and append-only.

### LIC-008

The Learning Workspace must query entitlements only through `HasEntitlement`, never through plan names.

### LIC-009

Promotional and purchased usage allowances must remain distinguishable so each can expire independently.

### LIC-010

Every entitlement change must publish a domain event so dependent domains can react without polling.

---

# 21. End-to-End Example

A tutor's Subscription is upgraded from Solo Professional to Solo AI+, and a 25K AI Credit promotional bonus is applied.

```text
1. Subscription Updated
        ↓
2. New Configuration Snapshot received
        ↓
3. Resolve Profiles
   Learning = AI+, Assessment = AI+
        ↓
4. Resolve Capacity
   Tutors = 1 (unchanged)
        ↓
5. Resolve Usage
   Included AI Credits = 75,000
   Promotional AI Credits = +25,000 (30-day expiry)
        ↓
6. No Overrides Active
        ↓
7. License State = Active
        ↓
8. Effective Entitlement Set Published

Learning = AI+
Assessment = AI+
Tutors = 1
AI Credits = 100,000 (75,000 included + 25,000 promotional)
```

`EntitlementGranted` and `EntitlementChanged` events are published; the Workspace reacts by unlocking AI+ capabilities without ever knowing the plan name that produced them.

---

# 22. Related Documents

### Depends On

* `CommercialDomainReferenceArchitecture.md`
* `CommercialProductManagementArchitecture.md`
* `ProductConfigurationEngineArchitecture.md`
* `SubscriptionManagementArchitecture.md`
* `PromotionAndDiscountArchitecture.md`

### Feeds

* `UsageAndMeteringArchitecture.md`
* `ProductAdvisoryArchitecture.md`
* `BillingArchitecture.md` (indirectly, via Subscription)
* Learning Workspace / Identity & Workspace Access (via `EntitlementRevoked`, `EntitlementGranted`)

---

# 23. Status

**Draft — Version 1.0**

This document now defines Licensing & Entitlements as the runtime authority of the Commercial Domain: the single place where a Configuration Snapshot, capacity, usage allowances, promotions, and manual overrides are resolved into one effective, source-attributed, auditable Entitlement Set.

Two decisions remain explicitly open and are tracked in the Reference Architecture's Open Decisions appendix rather than resolved here: the exact Workspace/Learning-domain behavior when a reduced entitlement affects a specific user's content (§15), and the operational process for Enterprise custom/negotiated entitlements that fall outside the standard catalog.
