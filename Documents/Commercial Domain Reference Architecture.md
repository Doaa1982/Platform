# Commercial Domain Reference Architecture

**Version:** 1.0
**Status:** Draft
**Domain:** Commercial
**Audience:** Business Architects, Product Owners, Solution Architects, UX Designers, Engineering Teams

---

# 1. Purpose

The Commercial Domain defines how the platform packages, recommends, configures, licenses, monetizes, and continuously optimizes access to business capabilities.

The platform does not treat pricing as a simple collection of fixed feature tiers.

Instead, the commercial model is based on:

* Business capabilities
* Capability profiles
* AI assistance levels
* Capability packs
* Workspace capacity
* Usage policies
* Workspace entitlements
* Fixed products
* Custom product configurations
* Intelligent product recommendations

The Commercial Domain allows a tutor to start with a predefined plan and later customize or evolve the workspace according to actual business needs.

---

# 2. Commercial Vision

The platform should not ask a tutor:

> "Which pricing plan do you want?"

It should ultimately be able to ask:

> "What are you trying to accomplish with your teaching business?"

The platform then determines:

1. Which capabilities the tutor needs.
2. Which capability profiles are appropriate.
3. Which AI assistance levels provide the most value.
4. How many tutors or collaborators are required.
5. Which capability packs are useful.
6. Which commercial configuration provides the best value.

The commercial experience therefore becomes **advisory and adaptive**, rather than purely transactional.

---

# 3. Commercial Business Model

The commercial model consists of five major layers.

```text
Business Needs
      │
      ▼
Product Recommendation
      │
      ▼
Product Configuration
      │
      ▼
Commercial Subscription
      │
      ▼
Workspace License
      │
      ▼
Entitlements
      │
      ▼
Workspace Capabilities
```

The customer buys a commercial product.

The workspace receives a license.

The license produces entitlements.

The workspace uses those entitlements to determine what capabilities and levels are available.

---

# 4. Commercial Domain Principles

## 4.1 Capability-Based Commercialization

The platform sells business capabilities rather than technical features.

Example:

Instead of selling:

* Quiz Generator Button
* Lesson Generator Button
* AI Summary Button

the platform sells:

> Assessment Authoring

with different levels of assistance.

---

## 4.2 AI as a Capability Dimension

AI is not treated as a single independent feature.

AI can enhance multiple business capabilities.

For example:

```text
Learning
    ├── Manual
    ├── AI Assist
    ├── AI Co-Pilot
    └── AI Autonomous

Assessment
    ├── Manual
    ├── AI Assist
    ├── AI Co-Pilot
    └── AI Autonomous

Analytics
    ├── Standard
    ├── AI Summary
    └── AI Insights
```

This allows AI commercialization to evolve independently for every business capability.

---

## 4.3 Workspace-Centric Licensing

Commercial licenses belong to a **Workspace**, not directly to an individual user.

This is critical because a workspace may evolve from:

```text
1 Tutor
```

to:

```text
1 Tutor
+
Assistant
```

to:

```text
Multiple Tutors
```

to:

```text
Academy
```

The commercial license evolves with the workspace.

---

## 4.4 Fixed Plans and Custom Configuration Coexist

The platform supports two primary commercial purchase models.

### Fixed Plans

Predefined configurations designed for common customer profiles.

### Design Your Own Plan

A customer selects and combines capability profiles and packs.

Both models ultimately produce the same type of Workspace License.

---

## 4.5 Commercial Independence

Learning capabilities must not contain pricing logic.

The Learning Workspace should ask:

> "Does this workspace have the entitlement to use this capability?"

It should never ask:

> "Is this customer on the Professional plan?"

---

## 4.6 Commercial Flexibility

The platform must be able to introduce:

* new plans
* new capability profiles
* new packs
* promotions
* temporary entitlements
* new AI assistance levels

without requiring changes to core learning-domain logic.

---

# 5. Target Customer Evolution

The majority of the platform's customers are expected to be individual tutors.

Therefore, the commercial model prioritizes the **Solo Tutor journey**.

```text
Solo Tutor
    │
    ├── Solo Essential
    │
    ├── Solo Professional
    │
    └── Solo AI+
            │
            ▼
        Studio
            │
            ▼
        Academy
```

The progression represents business maturity rather than simply increasing technical limits.

| Customer Stage           | Primary Need                | Product Family    |
| ------------------------ | --------------------------- | ----------------- |
| Starting Tutor           | Teach professionally        | Solo Essential    |
| Growing Tutor            | More intelligent teaching   | Solo Professional |
| AI-Driven Tutor          | Maximum AI assistance       | Solo AI+          |
| Small Teaching Team      | Collaborate                 | Studio            |
| Educational Organization | Govern and operate at scale | Academy           |

---

# 6. Commercial Product Model

The commercial catalog is composed of multiple concepts.

```text
Commercial Catalog
│
├── Product Family
│
├── Fixed Product
│
├── Capability Domain
│
├── Capability Profile
│
├── Capability Pack
│
├── Usage Policy
│
├── AI Assistance Policy
│
└── Pricing Policy
```

---

# 7. Core Commercial Concepts

| Concept                   | Definition                                                                                   |
| ------------------------- | -------------------------------------------------------------------------------------------- |
| **Product Family**        | Groups products serving a common customer stage.                                             |
| **Fixed Product**         | Predefined commercial configuration.                                                         |
| **Capability Domain**     | Business area containing related capabilities.                                               |
| **Capability Profile**    | A maturity level within a capability domain.                                                 |
| **Capability Pack**       | Optional commercial enhancement containing one or more capabilities.                         |
| **AI Assistance Level**   | Defines how deeply AI participates in a capability.                                          |
| **Usage Policy**          | Defines metered consumption or quotas.                                                       |
| **Subscription**          | Commercial agreement between customer and platform.                                          |
| **Workspace License**     | Active commercial authorization assigned to a workspace.                                     |
| **Entitlement**           | Specific permission, capability, level, capacity, or usage allowance granted to a workspace. |
| **Promotion**             | Temporary commercial modification to pricing or entitlements.                                |
| **Product Configuration** | A selected combination of products, profiles, packs, and usage policies.                     |

---

# 8. Capability Domains

The platform should organize commercial capabilities into business domains.

| Capability Domain   | Example Capabilities                     |
| ------------------- | ---------------------------------------- |
| **Workspace**       | Workspace settings, branding, domain     |
| **Learning**        | Courses, lessons, learning paths         |
| **Content**         | Content library, resources, authoring    |
| **Assessment**      | Quizzes, exams, assignments, grading     |
| **Student Success** | Progress, recommendations, interventions |
| **AI**              | AI assistance policies and AI services   |
| **Commerce**        | Payments, subscriptions, coupons         |
| **Analytics**       | Student, course, revenue analytics       |
| **Collaboration**   | Tutors, assistants, shared authoring     |
| **Marketing**       | Landing pages, campaigns, referrals      |
| **Community**       | Groups, discussions, social learning     |
| **Branding**        | Custom branding, domain, white-label     |
| **Integration**     | API, webhooks, SSO                       |
| **Organization**    | Departments, branches, governance        |

---

# 9. Capability Profiles

A capability domain may have multiple commercial profiles.

Example:

| Domain        | Foundation | Professional | AI+              | Studio        | Enterprise   |
| ------------- | ---------- | ------------ | ---------------- | ------------- | ------------ |
| Learning      | Manual     | Advanced     | AI Co-Pilot      | Collaborative | Enterprise   |
| Assessment    | Manual     | Advanced     | AI Co-Pilot      | Team          | Enterprise   |
| Analytics     | Basic      | Advanced     | AI Insights      | Team          | Executive    |
| Branding      | Basic      | Professional | AI Assisted      | Team          | White Label  |
| Collaboration | Solo       | Solo+        | AI Collaboration | Multi-Tutor   | Organization |

The profiles do not necessarily need identical names across domains.

The meaning of each profile is defined by the capability domain.

---

# 10. AI Assistance Model

AI participation is modeled independently from basic capability availability.

| AI Level       | Meaning                                                              |
| -------------- | -------------------------------------------------------------------- |
| **Manual**     | Tutor performs the work without AI assistance.                       |
| **Assist**     | AI provides suggestions, drafts, or recommendations.                 |
| **Co-Pilot**   | AI performs substantial work while the tutor reviews and approves.   |
| **Autonomous** | AI may execute approved workflows with configurable human oversight. |

---

# 11. AI Assistance Across Capabilities

The same AI maturity model can be applied differently to different business capabilities.

| Capability         | Manual | Assist | Co-Pilot | Autonomous |
| ------------------ | :----: | :----: | :------: | :--------: |
| Course Design      |    ✓   |    ✓   |     ✓    |   Future   |
| Lesson Authoring   |    ✓   |    ✓   |     ✓    |   Future   |
| Assessment         |    ✓   |    ✓   |     ✓    |   Future   |
| Student Feedback   |    ✓   |    ✓   |     ✓    |   Future   |
| Learning Path      |    ✓   |    ✓   |     ✓    |   Future   |
| Analytics          |    ✓   |    ✓   |     ✓    |   Future   |
| Content Management |    ✓   |    ✓   |     ✓    |   Future   |
| Marketing          |    ✓   |    ✓   |     ✓    |   Future   |

The availability of a level is determined by the commercial product configuration.

---

# 12. Fixed Product Families

The initial commercial product structure is:

| Product Family | Products                     | Target Customer          |
| -------------- | ---------------------------- | ------------------------ |
| **Solo**       | Essential, Professional, AI+ | Individual tutor         |
| **Studio**     | Studio                       | Small teaching team      |
| **Academy**    | Academy                      | Educational organization |
| **Enterprise** | Custom                       | Large organization       |

---

# 13. Solo Product Family

Because individual tutors are the primary customer segment, Solo is divided into three levels.

| Capability Dimension | Solo Essential | Solo Professional | Solo AI+    |
| -------------------- | -------------- | ----------------- | ----------- |
| Core Teaching        | Full           | Full              | Full        |
| Courses              | Unlimited      | Unlimited         | Unlimited   |
| Students             | Unlimited*     | Unlimited*        | Unlimited*  |
| Core Assessments     | Full           | Full              | Full        |
| AI Assistance        | Basic          | Advanced          | Maximum     |
| Advanced AI          | Limited        | Expanded          | Full        |
| Analytics            | Basic          | Advanced          | AI Insights |
| Tutor Capacity       | 1              | 1                 | 1–2         |
| Collaboration        | Minimal        | Optional          | Limited     |
| Branding             | Basic          | Professional      | Advanced    |

* Subject to fair-use and infrastructure policies where applicable.

The precise entitlements will be defined in the Commercial Product Management Architecture.

---

# 14. Capability Packs

Capability Packs allow customers to purchase specific business capabilities without upgrading the entire product.

Examples:

| Pack                       | Purpose                                   |
| -------------------------- | ----------------------------------------- |
| **AI Author Pack**         | AI-assisted lesson and content creation   |
| **AI Assessment Pack**     | AI question generation, grading, feedback |
| **AI Mentor Pack**         | Student insights and recommendations      |
| **Commerce Pack**          | Advanced selling and subscriptions        |
| **Marketing Pack**         | Marketing and customer acquisition        |
| **Branding Pack**          | Advanced branding and custom domain       |
| **Collaboration Pack**     | Additional tutors and assistants          |
| **Live Teaching Pack**     | Advanced live teaching capabilities       |
| **Parent Engagement Pack** | Parent communication and insights         |
| **Integration Pack**       | API and external integrations             |

---

# 15. Design Your Own Plan

Design Your Own Plan is not a separate licensing architecture.

It is another way of producing a Workspace License.

```text
Customer Needs
      │
      ▼
Base Product
      │
      ▼
Capability Profiles
      │
      ▼
Capability Packs
      │
      ▼
AI Assistance Levels
      │
      ▼
Capacity
      │
      ▼
Usage Policies
      │
      ▼
Product Configuration Engine
      │
      ▼
Workspace License
```

---

# 16. Product Configuration Engine

The Product Configuration Engine is responsible for turning a commercial configuration into a valid commercial product.

### Responsibilities

| Responsibility          | Description                              |
| ----------------------- | ---------------------------------------- |
| Validation              | Determine whether configuration is valid |
| Dependency Resolution   | Resolve required capabilities            |
| Conflict Detection      | Detect incompatible selections           |
| Rule Evaluation         | Apply commercial rules                   |
| Pricing                 | Calculate commercial price               |
| Entitlement Composition | Build final entitlements                 |
| License Generation      | Produce workspace license                |
| Recommendations         | Suggest better configurations            |

---

# 17. Configuration Example

A tutor selects:

| Configuration      | Selection         |
| ------------------ | ----------------- |
| Base Product       | Solo Professional |
| Tutors             | 2                 |
| Learning Profile   | AI+               |
| Assessment Profile | Professional      |
| Analytics Profile  | Professional      |
| Commerce Profile   | Essential         |
| Marketing          | Enabled           |
| AI Credits         | 50,000            |

The engine validates the configuration and produces:

```text
Workspace License

Learning              = AI+
Assessment            = Professional
Analytics             = Professional
Commerce              = Essential
Marketing             = Enabled
Tutor Capacity        = 2
AI Credits            = 50,000
```

---

# 18. Product Recommendation Engine

The Product Recommendation Engine answers:

> "What commercial configuration is most appropriate for this customer?"

It is different from the Product Configuration Engine.

| Engine                    | Primary Question                   |
| ------------------------- | ---------------------------------- |
| **Recommendation Engine** | What should the customer choose?   |
| **Configuration Engine**  | Is the customer's selection valid? |

---

# 19. Product Advisory

Product Advisory provides the business context needed for recommendations.

It may analyze:

* Teaching model
* Number of students
* Course types
* Live vs recorded teaching
* Assessment frequency
* Content creation workload
* AI usage
* Collaboration needs
* Commerce activity
* Growth patterns

---

# 20. Tutor Business Profile

Example:

| Attribute        | Value            |
| ---------------- | ---------------- |
| Teaching Model   | Live + Recorded  |
| Customer Type    | Individual Tutor |
| Students         | 80               |
| Content Creation | High             |
| Assessments      | Weekly           |
| AI Need          | High             |
| Collaboration    | None             |
| Commerce         | Active           |
| Growth Potential | Medium           |

The Product Recommendation Engine can use this profile to recommend a commercial configuration.

---

# 21. Recommendation Example

```text
Based on your teaching business:

Recommended Product:
Solo Professional

Recommended Upgrades:
Learning → AI+
Assessment → AI+
AI Credits → 25,000/month

Not Recommended:
Marketing Pack

Reason:
Your current workspace does not use marketing capabilities.

Estimated Monthly Cost:
$XX
```

---

# 22. Continuous Commercial Optimization

The recommendation system should not only operate during initial purchase.

It may periodically analyze actual workspace usage.

Example:

```text
Workspace Usage

AI Assessment Usage       High
Marketing Usage           None
Tutor Capacity            2
Active Tutors             1
AI Credits                95%
```

Possible recommendation:

```text
You are not using Marketing capabilities.

You may save by removing Marketing.

Your Assessment usage is high.

We recommend upgrading Assessment AI.
```

This creates a continuous commercial optimization loop.

---

# 23. Commercial Licensing

The commercial lifecycle eventually produces a Workspace License.

```text
Product Configuration
        │
        ▼
Subscription
        │
        ▼
Workspace License
        │
        ▼
Entitlements
```

The license represents what the workspace is commercially authorized to use.

---

# 24. Entitlement Model

An entitlement may represent:

* Capability
* Capability level
* AI assistance level
* Capacity
* Usage allowance
* Integration
* Branding right
* Administrative permission

Example:

| Entitlement            | Value        |
| ---------------------- | ------------ |
| Learning Profile       | AI+          |
| Assessment Profile     | Professional |
| Tutor Capacity         | 2            |
| Custom Domain          | Enabled      |
| AI Credits             | 50,000       |
| Marketplace Publishing | Enabled      |

---

# 25. Runtime Principle

The Learning Workspace must never depend directly on commercial plan names.

Incorrect:

```text
if plan == "Solo AI+"
```

Correct:

```text
if workspace.HasEntitlement(
    Learning,
    AIPlus)
```

The runtime cares about entitlements.

The commercial domain cares about products.

---

# 26. Usage Metering

Some commercial resources should be metered because they have variable infrastructure cost.

Examples:

| Resource         | Possible Meter     |
| ---------------- | ------------------ |
| AI               | Credits / tokens   |
| Video            | Storage GB         |
| Video Processing | Processing minutes |
| Live Classes     | Minutes            |
| Email            | Messages           |
| SMS              | Messages           |
| API              | Requests           |

Usage metering is independent from capability authorization.

A workspace may have the capability enabled while still being subject to a usage allowance.

---

# 27. Commercial Lifecycle

```text
Discover
   │
   ▼
Evaluate Needs
   │
   ▼
Recommend
   │
   ▼
Configure
   │
   ▼
Validate
   │
   ▼
Purchase
   │
   ▼
Subscribe
   │
   ▼
License Workspace
   │
   ▼
Grant Entitlements
   │
   ▼
Measure Usage
   │
   ▼
Optimize
   │
   ├── Upgrade
   ├── Downgrade
   ├── Add Pack
   └── Remove Pack
```

---

# 28. Bounded Contexts

The Commercial Domain is divided into the following bounded contexts.

| Bounded Context                   | Responsibility                                                         |
| --------------------------------- | ---------------------------------------------------------------------- |
| **Product Advisory**              | Understand customer needs and recommend commercial configurations      |
| **Commercial Product Management** | Define products, capabilities, profiles, packs, and commercial catalog |
| **Product Configuration**         | Validate and compose customer-selected configurations                  |
| **Licensing & Entitlements**      | Translate commercial decisions into workspace entitlements             |
| **Usage & Metering**              | Measure variable resource consumption                                  |
| **Subscription Management**       | Manage commercial subscription lifecycle, **including manual commercial activation** |
| **Billing**                       | **Invoice generation and issuance only** — amount owed, line items, pricing/tax shown on the invoice, invoice status. Does **not** collect payment. |
| **Promotion & Discounts**         | Coupons, campaigns, discounts, and promotional policies, applied to the invoice as a line item — not to an automated payment |
| **Commercial Analytics**          | Analyze commercial behavior, adoption, churn, and optimization         |

> **Correction — 2026-08-09: This platform does not process payment.** Billing is narrowed to **Invoice generation only** — it produces the bill (amount owed, line items, tax) but owns no payment method, payment gateway, payment transaction, or automated refund. Payment happens entirely outside this platform (bank transfer, cash, external means). An authorized actor manually marks an Invoice as **Paid**, and that manual action — not a payment-provider webhook — is what triggers Subscription Management's activation (see `SubscriptionManagementArchitecture.md` §27a, "Manual Commercial Activation"). `BillingArchitecture.md` and its data model describe a full in-house payment system (payment methods, gateway abstraction, webhooks, refund transactions) that will not be built here; the Invoice-related portions remain applicable, the Payment-related portions are marked **Not Applicable**. Every other document's insistence that "Billing must never become the source of truth for Workspace access" turned out to be exactly the right boundary to have already drawn — narrowing Billing to invoice-only required no change to Licensing's resolution logic at all, only to what triggers Subscription state.

---

# 29. Context Map

```text
                         Product Advisory
                               │
                               ▼
                 Commercial Product Management
                               │
                               ▼
                    Product Configuration
                               │
                               ▼
                    Licensing & Entitlements
                               │
                               ▼
                      Learning Workspace
                               ▲
                               │
                       Usage & Metering
                               │
                               ▼
                    Subscription Management
                               ▲
                               │ manually marked Paid
                               │
                            Billing
                        (Invoice only —
                       no payment collection)

Promotion & Discounts ────────┐
                              │
                              ▼
                   Subscription Management

Commercial Analytics ◄────────────
        ▲
        │
Usage & Metering
Subscription Management
Licensing & Entitlements
```

---

# 30. Important Context Boundaries

## Commercial Product Management

Owns:

> What can the platform sell?

---

## Product Configuration

Owns:

> Is this commercial configuration valid?

---

## Product Advisory

Owns:

> What should this customer buy?

---

## Licensing & Entitlements

Owns:

> What is this workspace authorized to use?

---

## Usage & Metering

Owns:

> How much of a metered resource has been consumed?

---

## Subscription Management

Owns:

> What commercial agreement is currently active?

---

## Billing

Owns:

> What does this workspace owe, and has that invoice been marked paid?

Does **not** own payment collection, payment methods, or financial transaction processing — see the correction note in §28. "Has been marked paid" is a manually recorded fact, not a payment confirmation.

## Subscription Management — Manual Commercial Activation

Owns:

> Who authorized this subscription's current commercial state, and on what basis?

This is the actual trigger for Active/Past Due/Suspended/Cancelled transitions in this platform — see `SubscriptionManagementArchitecture.md` §27a.

---

# 31. Domain Events

Important commercial events may include:

```text
ProductConfigurationCreated

ProductConfigurationValidated

ProductConfigurationChanged

SubscriptionStarted

SubscriptionRenewed

SubscriptionCancelled

SubscriptionUpgraded

SubscriptionDowngraded

WorkspaceLicenseCreated

WorkspaceLicenseChanged

EntitlementGranted

EntitlementRevoked

UsageLimitReached

CapabilityPackAdded

CapabilityPackRemoved

CommercialRecommendationGenerated

CommercialOptimizationSuggested
```

---

# 32. Commercial Rules

## CR-001

A subscription must produce a valid workspace license before commercial capabilities become available.

## CR-002

Workspace capabilities are controlled by entitlements, not plan names.

## CR-003

Fixed plans are predefined product configurations.

## CR-004

Design Your Own Plan uses the same configuration engine as fixed plans.

## CR-005

Capability Packs may extend an existing product configuration.

## CR-006

Capability dependencies must be validated before a configuration becomes active.

## CR-007

AI assistance levels are independently configurable by capability domain.

## CR-008

Usage limits do not determine whether a capability exists; they determine how much of the capability may be consumed.

## CR-009

Licenses belong to workspaces.

## CR-010

A workspace may change its commercial configuration without changing its identity or membership.

## CR-011

Commercial recommendations must not directly change a customer's license without customer authorization, except where an explicitly agreed automatic optimization policy exists.

---

# 33. Commercial Capability Architecture

The commercial system therefore operates across four dimensions.

| Dimension            | Example           |
| -------------------- | ----------------- |
| **Capability**       | Assessment        |
| **Capability Level** | Professional      |
| **AI Assistance**    | Co-Pilot          |
| **Usage**            | 50,000 AI credits |

This is the core commercial model.

---

# 34. Strategic Model

The complete model can be summarized as:

```text
                   BUSINESS NEEDS
                         │
                         ▼
                 PRODUCT ADVISORY
                         │
                         ▼
                 PRODUCT CATALOG
                         │
                         ▼
              PRODUCT CONFIGURATION
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
       Capability Profiles     Capability Packs
              │                     │
              └──────────┬──────────┘
                         ▼
                  AI + CAPACITY
                         │
                         ▼
                CONFIGURATION ENGINE
                         │
                         ▼
                    SUBSCRIPTION
                         │
                         ▼
                  WORKSPACE LICENSE
                         │
                         ▼
                   ENTITLEMENTS
                         │
                         ▼
                LEARNING WORKSPACE
                         │
                         ▼
                    USAGE DATA
                         │
                         ▼
                COMMERCIAL ANALYTICS
                         │
                         ▼
              PRODUCT OPTIMIZATION
                         │
                         └──────────────► PRODUCT ADVISORY
```

---

# 35. Architectural Outcome

The Commercial Domain establishes a separation between:

**What the platform does**

→ Business Capabilities

**How capable it is**

→ Capability Profiles

**How intelligently it helps**

→ AI Assistance Levels

**How much the customer can use**

→ Usage Policies

**What the customer purchased**

→ Product Configuration

**What the workspace is allowed to use**

→ Entitlements

**What the customer pays**

→ Subscription & Billing

**What the platform recommends**

→ Product Advisory

This separation allows the commercial model to evolve independently from the Learning Workspace and other operational domains.

---

# 36. Related Documents

The following documents provide detailed definitions for this domain.

## Written

1. Commercial Product Management Architecture — `CommercialProductManagementArchitecture.md`
2. Product Configuration Engine Architecture — `Product Configuration Engine Architecture.md`
3. Product Advisory Architecture — `Product Advisory Architecture.md`
4. Licensing & Entitlement Architecture — `LicensingAndEntitlementArchitecture.md`
5. Usage & Metering Architecture — `UsageAndMeteringArchitecture.md`
6. Subscription Management Architecture — `SubscriptionManagementArchitecture.md`
7. Billing Architecture — `BillingArchitecture.md` — **scope narrowed 2026-08-09 to Invoice generation only; see the correction banner at the top of that document**
8. Promotion & Discount Architecture — `PromotionAndDiscountArchitecture.md`
9. Commercial Domain Integration Architecture — `CommercialDomainIntegrationArchitecture.md` (cross-context integration, events, sagas, and the complete customer journey — the primary companion to this document)
10. Commercial Domain V1 Scope & Release Boundary — `Commercial Domain V1 Scope.md` (consolidates each bounded context's stated V1/Future boundary into one cross-context release scope; approved 2026-08-09 — see §37 below)

## Planned, Not Yet Written

10. Commercial Analytics Architecture — referenced throughout this document set (bounded context table, context map, event flows) but not yet defined. Until it exists, Commercial Analytics has no owned aggregate model, KPI definitions, or data contract.
11. AI Commercial Strategy Architecture — referenced as a dependency of `UsageAndMeteringArchitecture.md` and `CommercialProductManagementArchitecture.md` but not yet defined.

## Superseded — Historical Reference Only

* `Subscription & Licensing Architecture.md` — predates the split into Subscription Management and Licensing & Entitlements. Do not use as a source of truth.
* `Commerce Context.md` — predates this domain's Billing/Subscription/Promotion split and has unreconciled overlapping ownership claims. See the note at the top of that document.

---

# 37. Open Decisions

The following commercial-policy questions are referenced by one or more bounded-context documents but are not yet resolved. They are listed here so they are tracked at the domain level instead of being silently assumed by whichever document happens to touch them first.

A related artifact is `Commercial Domain V1 Scope.md`, which consolidates each bounded context's stated V1/Future boundary into one release scope.

**All five items below were reviewed and approved by the domain owner on 2026-08-09** (see `Commercial Domain Decision Brief.md`). They are retained here, marked Resolved, for traceability — the reasoning stays useful even after the decision is made.

## OD-001 — Entitlement Conflict Resolution — ✅ Resolved

When multiple configuration components (base product, capability pack, promotion, manual override) target the same capability domain, resolution must be deterministic. **Approved:** precedence order `Override > Promotion > Pack/Capacity > Base Product`, plus the same-domain scoping rule that a pack may only affect the capability domains it explicitly lists. Ratified as domain-level policy; implemented in `LicensingAndEntitlementArchitecture.md` §12–13.

## OD-002 — Downgrade / Capacity Reduction Data Impact — ✅ Resolved (Commercial Domain portion)

When a workspace loses capacity or a capability (e.g., Tutor Capacity drops from 2 to 1, or AI Assessment is removed), Licensing guarantees access is restricted rather than data deleted. **Approved.** The Commercial Domain's obligation ends there; the specific reassignment/read-only UX for the affected user's content remains a Workspace/Learning-domain follow-up, tracked in that domain, not this one.

## OD-003 — Enterprise Custom Contract Handling — ✅ Resolved

**Approved:** Enterprise/custom negotiated contracts are explicitly out of V1 scope. The catalog and Configuration Engine should not be designed in a way that precludes adding Enterprise support later, but no operational process for it will be built in this phase.

## OD-004 — Governance Ownership of the Catalog Change Process — ✅ Resolved (action assigned)

**Approved:** named owners must be assigned to each gate of the catalog change lifecycle (Draft → Business Review → Pricing Review → Architecture Review → Product Approval → Publish) before the process is relied upon operationally. Assigning the actual names is an outstanding action item, not an open question.

## OD-005 — Internationalization — ✅ Resolved

**Approved:** single currency, no dedicated Tax bounded context for V1. The data model remains currency-aware (`Money = amount + currency`, not a bare decimal) so this doesn't require a schema rewrite when multi-currency is eventually built.

## OD-006 — Usage & Metering Throughput/Latency Target — 🟡 Provisional (placeholder set 2026-08-09)

Raised during data-model drafting (`Commercial Domain Data Model — Usage & Metering.md`). No default existed to fall back on, so unlike OD-001–005 this was not approved against a recommendation — instead, a placeholder was derived from stated launch scale ("hundreds" of workspaces) and the heaviest usage scenario already documented in `Product Advisory Architecture.md`: ~5 events/second sustained peak (headroom to ~20/sec), sub-1–2-second reservation checks, ~60-second counter freshness. This unblocks design work but is explicitly **not** a validated commitment — it should be revisited against real telemetry before or shortly after launch.

---

# 38. Status

This document is the **reference architecture** for the Commercial Domain.

Detailed business rules, aggregates, workflows, and data models should be defined in the individual bounded-context documents rather than duplicated here. Open policy questions should be tracked in §37 until they are resolved and folded into the relevant bounded-context document.
