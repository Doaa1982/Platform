# Product Configuration Engine Architecture

**Version:** 1.0
**Status:** Draft
**Bounded Context:** Product Configuration
**Parent Domain:** Commercial Domain
**Depends On:** Commercial Product Management
**Consumed By:** Product Advisory, Subscription Management, Licensing & Entitlements

---

# 1. Purpose

The Product Configuration Engine is responsible for transforming a customer's selected commercial components into a **valid, complete, priced Product Configuration**.

It is the core engine behind:

* Fixed Plans
* Design Your Own Plan
* Capability Pack upgrades
* Capability Profile upgrades
* Additional tutor capacity
* AI credit configuration
* Commercial recommendations
* Upgrade and downgrade previews
* Internal sales configuration
* Future self-service commercial experiences

The engine must allow commercial products to be configured without hardcoding business rules into the Learning Workspace.

---

# 2. Core Responsibility

The engine answers:

> **"Given these commercial selections, what is the resulting valid product configuration?"**

It must determine:

1. Whether the configuration is valid.
2. Whether required dependencies exist.
3. Whether selected components conflict.
4. What components must be added.
5. What entitlements will result.
6. What usage allowances will result.
7. What the final price is.
8. What warnings or recommendations should be presented.

---

# 3. What the Engine Does Not Own

The engine does not own:

| Concern                     | Owner                         |
| --------------------------- | ----------------------------- |
| Product definitions         | Commercial Product Management |
| Customer needs              | Product Advisory              |
| Payment                     | Billing                       |
| Subscription lifecycle      | Subscription Management       |
| Runtime authorization       | Licensing & Entitlements      |
| Actual resource consumption | Usage & Metering              |
| Customer identity           | Identity                      |
| Workspace configuration     | Workspace                     |

---

# 4. Architectural Position

```text
                         Product Advisory
                                │
                                │ Recommendation
                                ▼
Customer ───────────────► Product Configuration
                                │
                                │ reads
                                ▼
                  Commercial Product Catalog
                                │
                                │
                 ┌──────────────┴──────────────┐
                 ▼                             ▼
           Rule Engine                 Pricing Calculator
                 │                             │
                 └──────────────┬──────────────┘
                                ▼
                    Entitlement Composer
                                │
                                ▼
                     Configuration Result
                                │
                  ┌─────────────┼─────────────┐
                  ▼             ▼             ▼
             Subscription    License       Customer UI
```

---

# 5. Core Concepts

| Concept                    | Definition                                                        |
| -------------------------- | ----------------------------------------------------------------- |
| **Configuration Request**  | Customer's requested commercial selections                        |
| **Configuration**          | Current set of selected commercial components                     |
| **Configuration Rule**     | Business rule determining validity or behavior                    |
| **Dependency**             | Component required by another component                           |
| **Conflict**               | Combination that cannot coexist                                   |
| **Configuration Result**   | Resolved output of the engine                                     |
| **Entitlement Set**        | Effective permissions and limits resulting from the configuration |
| **Price Breakdown**        | Detailed commercial calculation                                   |
| **Recommendation**         | Suggested improvement to the configuration                        |
| **Configuration Snapshot** | Immutable representation of a validated configuration             |

---

# 6. Configuration Lifecycle

```text
Draft
  │
  ▼
Validate
  │
  ├── Invalid ──────► Fix Configuration
  │
  ▼
Resolve Dependencies
  │
  ▼
Resolve Conflicts
  │
  ▼
Calculate Entitlements
  │
  ▼
Calculate Price
  │
  ▼
Generate Recommendations
  │
  ▼
Validated
  │
  ▼
Ready for Purchase
```

---

# 7. Configuration Request

A configuration request may contain:

```text
Base Product
Capability Profiles
Capability Packs
Capacity
Usage Allowances
AI Credit Package
Support Level
Billing Frequency
Promotional Code
```

Example:

```text id="9j7o3n"
Base Product:
    Solo Professional

Capability Profiles:
    Learning = AI+
    Assessment = AI+
    Analytics = Professional
    Commerce = Essential

Capability Packs:
    Marketing Pack

Capacity:
    Tutors = 2

AI Credits:
    50,000/month
```

---

# 8. Configuration Structure

```text
Product Configuration
│
├── Base Product
│
├── Capability Profiles
│
├── Capability Packs
│
├── Capacity
│
├── Usage Policies
│
├── AI Policies
│
├── Support
│
└── Pricing
```

---

# 9. Configuration State

The engine should distinguish between:

| State                  | Meaning                                                |
| ---------------------- | ------------------------------------------------------ |
| **Draft**              | User is still configuring                              |
| **Valid**              | Configuration satisfies all rules                      |
| **Invalid**            | One or more rules fail                                 |
| **Resolved**           | Dependencies and defaults have been applied            |
| **Priced**             | Valid configuration has a calculated price             |
| **Ready for Purchase** | Configuration can be converted into a subscription     |
| **Expired**            | Configuration snapshot is no longer valid for purchase |

---

# 10. Configuration Engine Components

```text
Product Configuration Engine
│
├── Configuration Builder
│
├── Configuration Validator
│
├── Dependency Resolver
│
├── Conflict Resolver
│
├── Rule Engine
│
├── Entitlement Composer
│
├── Pricing Calculator
│
├── Recommendation Adapter
│
├── Configuration Snapshot Manager
│
└── Configuration Explanation Service
```

---

# 11. Configuration Builder

The Configuration Builder creates and modifies configurations.

Typical operations:

```text
Create Configuration
Select Base Product
Change Capability Profile
Add Pack
Remove Pack
Increase Capacity
Change AI Credits
Apply Promotion
Change Billing Frequency
```

The builder should allow an incomplete configuration because the customer may construct the plan incrementally.

---

# 12. Configuration Validator

The validator evaluates all applicable rules.

Example:

```text
Solo Essential
+
10 Tutors
```

Result:

```text
INVALID

Reason:
Solo Essential supports a maximum of 1 tutor.

Suggested alternatives:
1. Upgrade to Solo AI+
2. Add Collaboration Pack
3. Select Studio
```

---

# 13. Validation Categories

| Validation Type    | Example                                        |
| ------------------ | ---------------------------------------------- |
| Required Component | AI Assessment requires Assessment Professional |
| Capacity           | Solo supports maximum 1 tutor                  |
| Compatibility      | Enterprise-only integration selected           |
| Dependency         | Custom Domain requires Branding Professional   |
| Product Family     | Academy capability cannot be used with Solo    |
| Usage              | Requested AI credits exceed product allowance  |
| Commercial         | Component unavailable in selected region       |
| Lifecycle          | Product version no longer purchasable          |

---

# 14. Rule Model

Rules should be data-driven rather than hardcoded into individual modules.

Conceptually:

```text
Rule
│
├── Rule ID
├── Name
├── Description
├── Trigger
├── Condition
├── Action
├── Severity
└── Version
```

---

# 15. Rule Types

| Rule Type               | Purpose                                   |
| ----------------------- | ----------------------------------------- |
| **Validation Rule**     | Determines whether configuration is valid |
| **Dependency Rule**     | Adds or requires another component        |
| **Conflict Rule**       | Prevents incompatible combinations        |
| **Upgrade Rule**        | Determines required higher profile        |
| **Pricing Rule**        | Modifies price                            |
| **Capacity Rule**       | Validates capacity                        |
| **Usage Rule**          | Validates usage allowance                 |
| **Recommendation Rule** | Suggests a better configuration           |
| **Migration Rule**      | Handles changes between products          |

---

# 16. Dependency Rules

Example:

```text
IF
Custom Domain = Enabled

THEN
Branding Profile >= Professional
```

Another:

```text
IF
AI Assessment Pack = Enabled

THEN
Assessment Profile >= Professional
```

Another:

```text
IF
Additional Tutor = Enabled

THEN
Collaboration Profile >= Solo+
```

---

# 17. Dependency Resolution Strategies

A dependency can be handled in several ways.

| Strategy         | Behavior                                      |
| ---------------- | --------------------------------------------- |
| **Reject**       | Configuration is invalid                      |
| **Recommend**    | Suggest required component                    |
| **Auto-Include** | Automatically include dependency              |
| **Upgrade**      | Replace current profile with required profile |
| **Ask**          | Ask customer to choose                        |

The strategy should be defined by the commercial policy.

---

# 18. Example: Auto-Include

Customer selects:

```text
Custom Domain
```

Engine determines:

```text
Branding Professional
```

is required.

If the commercial policy allows automatic dependency inclusion:

```text
Configuration

Custom Domain
+
Branding Professional
```

The UI explains:

> Branding Professional was added because Custom Domain requires it.

---

# 19. Example: Recommendation Instead of Auto-Include

Customer selects:

```text
AI Assessment Pack
```

Engine returns:

```text
Requires:

Assessment Professional

Recommendation:

Upgrade Assessment from Foundation → Professional
```

The customer explicitly chooses whether to upgrade.

---

# 20. Conflict Rules

Example:

```text
Solo Essential
+
Academy Organization Profile
```

Result:

```text
CONFLICT

Solo products cannot contain Academy organization capabilities.
```

Another:

```text
Solo
+
Unlimited Tutors
```

Result:

```text
CONFLICT

Unlimited tutor capacity requires Studio or Academy.
```

---

# 21. Capability Profile Resolution

The engine must calculate the effective profile for each capability domain.

Example:

```text
Base Product:
Solo Professional

Selected:
Learning AI+
```

Result:

```text
Learning = AI+
```

If multiple components affect the same domain:

```text
Solo Professional
+
AI Author Pack
+
AI Assessment Pack
```

the engine resolves each domain independently.

---

# 22. Profile Resolution Rule

For each capability domain:

```text
Effective Profile =
Highest applicable profile
subject to compatibility rules
```

However, a higher profile must not automatically imply every commercial entitlement unless explicitly defined by the catalog.

This prevents accidental entitlement leakage.

---

# 23. AI Assistance Resolution

AI must be resolved per capability.

Example:

| Capability       | Effective AI Level |
| ---------------- | ------------------ |
| Lesson Authoring | Co-Pilot           |
| Assessment       | Co-Pilot           |
| Analytics        | Insights           |
| Marketing        | Assist             |
| Commerce         | Manual             |

The engine must not produce a single:

```text
AI = Premium
```

value.

---

# 24. Capacity Resolution

The engine resolves capacity independently.

Example:

```text
Base Product:
Solo Professional
Tutor Capacity:
1

Selected:
Additional Tutor Pack
```

Result:

```text
Tutor Capacity = 2
```

---

# 25. Entitlement Composition

After resolving the configuration, the engine creates an effective entitlement set.

Example:

| Entitlement        | Value        |
| ------------------ | ------------ |
| Course Authoring   | Enabled      |
| Learning Profile   | AI+          |
| Assessment Profile | AI+          |
| Analytics Profile  | Professional |
| Custom Domain      | Enabled      |
| Tutors             | 2            |
| AI Credits         | 50,000       |
| Marketing          | Enabled      |

This entitlement set becomes the basis for licensing.

---

# 26. Pricing Calculation

The Pricing Calculator determines the commercial price of the resolved configuration.

```text
Base Product
      +
Profile Upgrades
      +
Capability Packs
      +
Capacity
      +
Usage
      +
Support
      -
Discounts
      =
Final Price
```

---

# 27. Price Breakdown

The engine should return an explainable breakdown.

Example:

| Component         |  Amount |
| ----------------- | ------: |
| Solo Professional |     $25 |
| Learning AI+      |      $7 |
| Assessment AI+    |      $5 |
| Additional Tutor  |      $5 |
| AI Credits        |      $8 |
| Marketing Pack    |      $6 |
| **Subtotal**      | **$56** |
| Promotion         |    -$10 |
| **Total**         | **$46** |

The customer should be able to understand why the price is what it is.

---

# 28. Price Calculation Principle

The price calculation must be deterministic.

Given:

```text
Same Catalog Version
+
Same Configuration
+
Same Pricing Context
```

the engine must produce the same price.

---

# 29. Pricing Context

Pricing may depend on:

* Billing cycle
* Currency
* Region
* Promotion
* Contract type
* Customer eligibility
* Tax policy

The engine should therefore accept a Pricing Context.

---

# 30. Configuration Result

The engine returns:

```text
ConfigurationResult
│
├── Status
├── ResolvedConfiguration
├── ValidationMessages
├── Dependencies
├── Conflicts
├── Entitlements
├── UsagePolicies
├── PriceBreakdown
├── Recommendations
└── ConfigurationVersion
```

---

# 31. Example Result

```text
Status:
VALID

Base Product:
Solo Professional

Effective Profiles:

Learning = AI+
Assessment = AI+
Analytics = Professional
Commerce = Essential
Branding = Professional

Capacity:

Tutors = 2

Usage:

AI Credits = 50,000/month

Price:

$46/month
```

---

# 32. Explanation Service

The engine should not simply return:

```text
Invalid
```

It should explain the business reason.

Example:

> You selected 3 tutors, but Solo Professional supports one tutor. Choose Studio or add an eligible collaboration capacity upgrade.

This explanation is important for both UX and customer trust.

---

# 33. Design Your Own Plan Workflow

```text
Customer
   │
   ▼
Select Base Product
   │
   ▼
Configure Capabilities
   │
   ▼
Select AI Levels
   │
   ▼
Select Packs
   │
   ▼
Select Capacity
   │
   ▼
Select Usage
   │
   ▼
Validate
   │
   ├── Errors → Modify
   │
   ▼
Resolve Dependencies
   │
   ▼
Calculate Price
   │
   ▼
Show Recommendations
   │
   ▼
Confirm
   │
   ▼
Create Subscription
```

---

# 34. Fixed Plan Workflow

Fixed plans use exactly the same engine.

```text
Solo AI+
    │
    ▼
Load Product Definition
    │
    ▼
Create Product Configuration
    │
    ▼
Resolve
    │
    ▼
Validate
    │
    ▼
Price
    │
    ▼
Ready for Purchase
```

Therefore:

> Fixed Plans and Design Your Own Plan are two different customer experiences over the same configuration infrastructure.

---

# 35. Upgrade Preview

The engine should support:

> "What happens if I upgrade?"

Example:

```text
Current

Solo Professional
Assessment = Professional

Future

Solo Professional
Assessment = AI+
AI Assessment Pack
```

The engine calculates:

| Item          | Current |      New |
| ------------- | ------: | -------: |
| Monthly Price |     $30 |      $39 |
| Assessment AI |  Assist | Co-Pilot |
| AI Credits    |     20K |      30K |

---

# 36. Downgrade Preview

The engine must also determine whether downgrade is possible.

Example:

```text
Current:
Studio
10 Tutors

Requested:
Solo Professional
1 Tutor
```

Result:

```text
Downgrade Possible

Impact:

9 tutor memberships must be removed.

Shared authoring will be disabled.

Some team-owned resources may require reassignment.
```

The configuration engine identifies the commercial impact.

The Licensing context handles actual license transition.

---

# 37. Configuration Snapshots

Every finalized configuration should be represented by an immutable snapshot.

Example:

```text
Configuration Snapshot

Product Version:
Solo Professional v3

Learning:
AI+

Assessment:
AI+

Tutors:
2

AI Credits:
50,000

Price:
$46/month
```

This protects historical commercial decisions from later catalog changes.

---

# 38. Versioning

Configuration evaluation should use:

```text
Product Version
+
Rule Version
+
Pricing Version
```

This guarantees reproducibility.

---

# 39. Configuration Comparison

The engine should support:

```text
Compare(Configuration A, Configuration B)
```

Output:

| Dimension  | Current      | Proposed |
| ---------- | ------------ | -------- |
| Learning   | Professional | AI+      |
| Assessment | Professional | AI+      |
| Tutors     | 1            | 2        |
| AI Credits | 20K          | 50K      |
| Price      | $30          | $46      |

This supports upgrade and downgrade experiences.

---

# 40. Product Recommendation Integration

The Configuration Engine should expose enough information for Product Advisory to determine:

* cheapest valid configuration;
* recommended configuration;
* upgrade path;
* unnecessary components;
* configuration conflicts;
* savings opportunities.

However:

> **The Configuration Engine validates and calculates. Product Advisory recommends.**

---

# 41. Configuration Optimization

The engine should support an optimization request.

Example:

```text
Optimize Configuration

Goal:
Minimum cost

Constraints:
Learning >= Professional
Assessment >= AI+
Tutors >= 2
AI Credits >= 25K
```

The engine can return:

```text
Recommended Configuration

Solo AI+
+
Additional AI Credits

Estimated Savings:
$6/month
```

This is particularly valuable for the future Commercial Optimization capability.

---

# 42. Rule Evaluation Order

Recommended evaluation sequence:

```text
1. Load Product
2. Load Product Version
3. Apply Customer Selections
4. Resolve Dependencies
5. Evaluate Conflicts
6. Resolve Capability Profiles
7. Resolve AI Assistance
8. Resolve Capacity
9. Resolve Usage
10. Calculate Entitlements
11. Calculate Price
12. Apply Promotions
13. Generate Recommendations
14. Produce Snapshot
```

---

# 43. Configuration Engine APIs — Conceptual

The exact API contract will be defined later, but the engine should conceptually support:

```text
CreateConfiguration()

GetConfiguration()

UpdateConfiguration()

ValidateConfiguration()

ResolveConfiguration()

PriceConfiguration()

CompareConfigurations()

PreviewUpgrade()

PreviewDowngrade()

OptimizeConfiguration()

FinalizeConfiguration()
```

---

# 44. Domain Events

The context may publish:

```text
ConfigurationCreated

ConfigurationChanged

ConfigurationValidated

ConfigurationInvalidated

ConfigurationResolved

ConfigurationPriced

ConfigurationFinalized

ConfigurationExpired
```

These events can be consumed by other contexts.

---

# 45. Integration With Subscription Management

The flow is:

```text
Configuration Engine
        │
        │ Validated Configuration
        ▼
Subscription Management
        │
        │ Subscription Created
        ▼
Licensing & Entitlements
        │
        ▼
Workspace License
```

The Configuration Engine does not create the subscription.

---

# 46. Integration With Licensing

The engine produces the effective entitlement set.

Licensing determines whether those entitlements should become active.

```text
Configuration
      │
      ▼
Effective Entitlements
      │
      ▼
Subscription
      │
      ▼
License
      │
      ▼
Active Entitlements
```

---

# 47. Product Configuration Rules Matrix

| Scenario                                     | Engine Behavior                                                  |
| -------------------------------------------- | ---------------------------------------------------------------- |
| Valid fixed plan                             | Accept                                                           |
| Valid custom configuration                   | Accept                                                           |
| Missing dependency                           | Reject / Recommend / Auto-resolve                                |
| Conflicting capabilities                     | Reject                                                           |
| Unsupported capacity                         | Reject / Recommend upgrade                                       |
| Unsupported AI level                         | Recommend valid alternative                                      |
| Expired product version                      | Reject new purchase                                              |
| Existing configuration with retiring product | Allow existing snapshot                                          |
| Promotion expired                            | Recalculate without promotion                                    |
| Usage exceeds plan allowance                 | Configuration may remain valid; usage policy handles consumption |

---

# 48. Security and Trust

The engine must not allow a client application to directly define arbitrary entitlements.

For example, a client must never be able to submit:

```text
TutorCapacity = 100
AILevel = Autonomous
WhiteLabel = true
```

and receive those entitlements.

All values must be resolved against the authoritative Product Catalog and commercial rules.

---

# 49. Auditability

Configuration decisions should be auditable.

For important commercial operations, record:

* configuration ID;
* product version;
* rule versions;
* pricing version;
* selected components;
* resolved components;
* applied promotions;
* final price;
* resulting entitlements;
* timestamp;
* actor/source.

---

# 50. Architectural Principle

The Product Configuration Engine should be **configuration-driven, deterministic, explainable, and independent from the Learning Workspace**.

Its fundamental transformation is:

```text
Commercial Selections
        │
        ▼
Rules + Dependencies + Pricing
        │
        ▼
Resolved Product Configuration
        │
        ├── Price
        ├── Entitlements
        ├── Usage Policies
        └── Recommendations
```

---

# 51. Final Model

The complete commercial configuration model is:

```text
                         CUSTOMER NEEDS
                               │
                               ▼
                      PRODUCT ADVISORY
                               │
                               ▼
                         SELECTIONS
                               │
                               ▼
                  PRODUCT CONFIGURATION ENGINE
                               │
          ┌────────────────────┼────────────────────┐
          ▼                    ▼                    ▼
     DEPENDENCIES          CONFLICTS             RULES
          │                    │                    │
          └────────────────────┼────────────────────┘
                               ▼
                     PROFILE RESOLUTION
                               │
                               ▼
                      AI RESOLUTION
                               │
                               ▼
                     CAPACITY RESOLUTION
                               │
                               ▼
                      USAGE RESOLUTION
                               │
                               ▼
                    ENTITLEMENT COMPOSITION
                               │
                               ▼
                       PRICE CALCULATION
                               │
                               ▼
                     CONFIGURATION RESULT
                               │
                ┌──────────────┼──────────────┐
                ▼              ▼              ▼
             Purchase       Compare       Optimize
                │
                ▼
           Subscription
                │
                ▼
          Workspace License
```

---

# 52. Architectural Outcome

The Product Configuration Engine gives the platform one commercial mechanism for:

* Fixed Plans
* Design Your Own Plan
* Capability Packs
* Capability Upgrades
* AI Upgrades
* Additional Tutors
* Usage Upgrades
* Promotions
* Upgrade Preview
* Downgrade Preview
* Configuration Optimization
* Future negotiated products

The most important architectural decision is:

> **A Plan is not a special technical object. It is simply a predefined Product Configuration.**

This means the platform can evolve its commercial strategy without continuously changing its operational software architecture.

---

# 53. Related Documents

This document depends on:

* `CommercialDomainReferenceArchitecture.md`
* `CommercialProductManagementArchitecture.md`

This document feeds:

* `LicensingAndEntitlementArchitecture.md`
* `ProductAdvisoryArchitecture.md`
* `SubscriptionManagementArchitecture.md`
* `PromotionAndDiscountArchitecture.md`
* `CommercialAnalyticsArchitecture.md`

---

# 54. Status

**Draft — Version 1.0**

The next architectural document should define the other side of this process:

> **How a validated commercial configuration becomes an active Workspace License and how those entitlements control the actual Learning Workspace.**

**Next: `LicensingAndEntitlementArchitecture.md`**
