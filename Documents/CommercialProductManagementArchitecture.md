# Commercial Product Management Architecture

**Version:** 1.0
**Status:** Draft
**Bounded Context:** Commercial Product Management
**Parent Domain:** Commercial Domain
**Related Contexts:** Product Advisory, Product Configuration, Licensing & Entitlements, Usage & Metering, Subscription Management

---

# 1. Purpose

The Commercial Product Management bounded context defines **what the platform can commercially sell**.

It owns the commercial catalog from which fixed plans, custom configurations, capability packs, and future commercial products are constructed.

The context does **not** determine:

* whether a customer should buy a product;
* whether a configuration is valid;
* whether a workspace is currently licensed;
* whether an invoice has been paid;
* how a capability behaves at runtime.

Those responsibilities belong to other bounded contexts.

Its primary responsibility is:

> **Define the commercial building blocks from which valid workspace products can be constructed.**

---

# 2. Position Within the Commercial Domain

```text
                    Product Advisory
                           │
                           │ recommends
                           ▼
             ┌──────────────────────────────┐
             │ Commercial Product Management│
             │                              │
             │ Product Catalog              │
             │ Capability Catalog            │
             │ Capability Profiles           │
             │ Capability Packs              │
             │ AI Assistance Policies        │
             │ Capacity Definitions          │
             │ Usage Policies                │
             │ Pricing Policies              │
             └──────────────┬───────────────┘
                            │
                            │ provides catalog
                            ▼
                 Product Configuration
                            │
                            ▼
                    Workspace License
```

---

# 3. Core Business Question

The bounded context answers:

> **What can we sell, at what level, under what commercial conditions?**

It does not answer:

> "What should this tutor buy?"

That belongs to **Product Advisory**.

It does not answer:

> "Is this customer's selected configuration valid?"

That belongs to **Product Configuration**.

---

# 4. Commercial Product Philosophy

The platform should not model products as flat collections of technical features.

Instead:

```text
Product
   │
   ├── Capability Domains
   │       │
   │       └── Capability Profiles
   │
   ├── Capability Packs
   │
   ├── AI Assistance Policies
   │
   ├── Capacity
   │
   ├── Usage Policies
   │
   └── Pricing Policies
```

This creates a composable commercial model.

---

# 5. Ubiquitous Language

| Term                      | Definition                                                                |
| ------------------------- | ------------------------------------------------------------------------- |
| **Product Family**        | A group of products serving a common customer segment or maturity stage.  |
| **Commercial Product**    | A sellable commercial offering.                                           |
| **Fixed Product**         | A predefined commercial configuration.                                    |
| **Capability Domain**     | A business area containing related capabilities.                          |
| **Capability**            | A business function provided by the platform.                             |
| **Capability Profile**    | A commercially defined maturity level for a capability domain.            |
| **Capability Pack**       | A separately purchasable collection of capability enhancements.           |
| **AI Assistance Level**   | Defines the degree of AI participation in a capability.                   |
| **Capacity**              | A measurable commercial limit such as number of tutors.                   |
| **Usage Policy**          | Defines how metered resources are allocated or limited.                   |
| **Pricing Policy**        | Rules used to calculate the commercial price of a product or component.   |
| **Product Component**     | A reusable commercial building block included in a product.               |
| **Product Configuration** | A specific composition of commercial components selected for a workspace. |

---

# 6. Product Catalog Hierarchy

```text
Commercial Product Catalog
│
├── Product Families
│
│   ├── Solo
│   │   ├── Solo Essential
│   │   ├── Solo Professional
│   │   └── Solo AI+
│   │
│   ├── Studio
│   │   └── Studio
│   │
│   ├── Academy
│   │   └── Academy
│   │
│   └── Enterprise
│       └── Custom
│
├── Capability Domains
│
├── Capability Profiles
│
├── Capability Packs
│
├── AI Assistance Levels
│
├── Capacity Definitions
│
├── Usage Policies
│
└── Pricing Policies
```

---

# 7. Product Families

Product Families represent the broad commercial positioning of the platform.

| Product Family | Primary Customer         | Primary Growth Dimension   |
| -------------- | ------------------------ | -------------------------- |
| **Solo**       | Individual tutor         | Teaching intelligence      |
| **Studio**     | Small teaching team      | Collaboration              |
| **Academy**    | Educational organization | Organizational scale       |
| **Enterprise** | Large organization       | Governance and integration |

---

# 8. Fixed Products

Fixed Products are predefined configurations designed for common customer needs.

## Solo Family

| Product               | Target Customer                                        |
| --------------------- | ------------------------------------------------------ |
| **Solo Essential**    | Tutor starting or operating a simple teaching business |
| **Solo Professional** | Tutor operating an established teaching business       |
| **Solo AI+**          | Tutor relying heavily on AI-assisted teaching          |

## Studio

Designed for small teams with multiple tutors or teaching assistants.

## Academy

Designed for organizations requiring organizational structures, governance, and multiple teaching units.

## Enterprise

A configurable commercial offering for customers requiring negotiated capabilities, limits, support, or contractual terms.

---

# 9. Product Composition

A Fixed Product is not a collection of hardcoded features.

It is a predefined product configuration.

Example:

```text
Solo AI+
│
├── Learning Profile = AI+
├── Assessment Profile = AI+
├── Content Profile = Professional
├── Analytics Profile = AI+
├── Commerce Profile = Professional
├── Branding Profile = Professional
├── Collaboration Profile = Solo+
├── Tutor Capacity = 2
├── AI Credits = 75,000
└── Support = Standard
```

The same structure can be used to create a custom product.

---

# 10. Capability Domain Model

The initial capability domains are:

|  # | Capability Domain | Purpose                                    |
| -: | ----------------- | ------------------------------------------ |
|  1 | Workspace         | Workspace administration and configuration |
|  2 | Learning          | Teaching and learning delivery             |
|  3 | Content           | Learning content creation and management   |
|  4 | Assessment        | Assessment and evaluation                  |
|  5 | Student Success   | Student progress and intervention          |
|  6 | Analytics         | Reporting and insights                     |
|  7 | Commerce          | Selling and monetization                   |
|  8 | Collaboration     | Tutors, assistants, and shared work        |
|  9 | Marketing         | Customer acquisition and engagement        |
| 10 | Community         | Groups and social learning                 |
| 11 | Branding          | Workspace identity and presentation        |
| 12 | Integration       | External system connectivity               |
| 13 | Organization      | Organizational management and governance   |

---

# 11. Capability Domain Structure

Every capability domain may contain multiple capabilities.

Example:

```text
Assessment
│
├── Quiz Authoring
├── Exam Authoring
├── Assignment Authoring
├── Question Bank
├── Automated Grading
├── Rubrics
├── Feedback
└── Assessment Analytics
```

The commercial catalog then defines which profile provides which level of each capability.

---

# 12. Capability Profile Model

A Capability Profile represents the commercial maturity of a domain.

Example:

```text
Assessment

Foundation
     ↓
Professional
     ↓
AI+
     ↓
Studio
     ↓
Enterprise
```

The levels do not necessarily need to be identical across all domains.

For example, Collaboration may use:

```text
Solo
Solo+
Team
Organization
```

while AI assistance may use:

```text
Manual
Assist
Co-Pilot
Autonomous
```

---

# 13. Capability Profile Matrix

| Capability Domain | Foundation | Professional | AI+              | Studio        | Enterprise   |
| ----------------- | ---------- | ------------ | ---------------- | ------------- | ------------ |
| Learning          | Core       | Advanced     | AI Co-Pilot      | Collaborative | Enterprise   |
| Content           | Basic      | Advanced     | AI Authoring     | Shared        | Governance   |
| Assessment        | Core       | Advanced     | AI Assessment    | Team          | Enterprise   |
| Analytics         | Basic      | Advanced     | AI Insights      | Team          | Executive    |
| Commerce          | Basic      | Advanced     | AI Assisted      | Multi-Tutor   | Enterprise   |
| Branding          | Basic      | Professional | AI Assisted      | Team          | White Label  |
| Collaboration     | Solo       | Solo+        | AI Collaboration | Multi-Tutor   | Organization |
| Marketing         | Basic      | Advanced     | AI Marketing     | Automation    | Enterprise   |
| Integration       | Basic      | Extended     | AI Workflows     | Team          | Enterprise   |

These labels are commercial profiles, not necessarily implementation tiers.

---

# 14. Capability Matrix — Initial Commercial Model

The following is the initial recommended matrix.

| Capability           | Essential | Professional |     AI+     |  Studio  |   Academy  |
| -------------------- | :-------: | :----------: | :---------: | :------: | :--------: |
| Course Authoring     |     ✓     |       ✓      |      ✓      |     ✓    |      ✓     |
| Lesson Authoring     |     ✓     |       ✓      |      ✓      |     ✓    |      ✓     |
| Learning Paths       |     —     |       ✓      |      ✓      |     ✓    |      ✓     |
| Content Library      |     ✓     |       ✓      |      ✓      |     ✓    |      ✓     |
| Quiz Authoring       |     ✓     |       ✓      |      ✓      |     ✓    |      ✓     |
| Exam Authoring       |     ✓     |       ✓      |      ✓      |     ✓    |      ✓     |
| Question Bank        |     ✓     |       ✓      |      ✓      |     ✓    |      ✓     |
| Assignment Authoring |     ✓     |       ✓      |      ✓      |     ✓    |      ✓     |
| Progress Tracking    |     ✓     |       ✓      |      ✓      |     ✓    |      ✓     |
| Student Analytics    |   Basic   |   Advanced   | AI Insights | Advanced | Enterprise |
| Revenue Analytics    |     —     |       ✓      |      ✓      |     ✓    |      ✓     |
| Live Classes         |     ✓     |       ✓      |      ✓      |     ✓    |      ✓     |
| Paid Courses         |     ✓     |       ✓      |      ✓      |     ✓    |      ✓     |
| Subscriptions        |     —     |       ✓      |      ✓      |     ✓    |      ✓     |
| Coupons              |     —     |       ✓      |      ✓      |     ✓    |      ✓     |
| Custom Domain        |     —     |       ✓      |      ✓      |     ✓    |      ✓     |
| Multiple Tutors      |     —     |       —      |      2      |    10    |  Unlimited |
| Teaching Assistants  |     —     |       —      |      1      |     ✓    |      ✓     |
| Shared Authoring     |     —     |       —      |   Limited   |     ✓    |      ✓     |
| Departments          |     —     |       —      |      —      |     —    |      ✓     |
| Branches             |     —     |       —      |      —      |     —    |      ✓     |
| API Access           |     —     |       —      |      —      |     —    |      ✓     |
| SSO                  |     —     |       —      |      —      |     —    |      ✓     |

This matrix is a **commercial baseline**, not the final pricing decision.

---

# 15. Important Principle: Core Teaching Should Not Be Artificially Restricted

For the Solo product family, core teaching functionality should generally remain available.

A tutor should be able to:

* create courses;
* create lessons;
* teach students;
* create assessments;
* track basic progress.

The commercial differentiation should primarily come from:

* intelligence;
* advanced workflows;
* collaboration;
* automation;
* commerce;
* branding;
* analytics;
* capacity;
* usage.

This prevents Solo Essential from feeling like a trial product.

---

# 16. AI Assistance Model

AI is defined separately from capability availability.

| Level          | Description                                                 |
| -------------- | ----------------------------------------------------------- |
| **Manual**     | No AI involvement.                                          |
| **Assist**     | AI suggests or drafts content.                              |
| **Co-Pilot**   | AI performs significant work with tutor review.             |
| **Autonomous** | AI executes approved workflows with configurable oversight. |

---

# 17. AI Capability Matrix

| Capability               | Essential | Professional | AI+         | Studio      | Academy     |
| ------------------------ | --------- | ------------ | ----------- | ----------- | ----------- |
| Course Planning          | Manual    | Assist       | Co-Pilot    | Co-Pilot    | Co-Pilot    |
| Lesson Generation        | Assist    | Assist       | Co-Pilot    | Co-Pilot    | Co-Pilot    |
| Quiz Generation          | Assist    | Assist       | Co-Pilot    | Co-Pilot    | Co-Pilot    |
| Question Generation      | Assist    | Assist       | Co-Pilot    | Co-Pilot    | Co-Pilot    |
| Worksheet Generation     | Assist    | Assist       | Co-Pilot    | Co-Pilot    | Co-Pilot    |
| Assessment Feedback      | Manual    | Assist       | Co-Pilot    | Co-Pilot    | Co-Pilot    |
| Student Feedback         | Manual    | Assist       | Co-Pilot    | Co-Pilot    | Co-Pilot    |
| Learning Recommendations | Manual    | Assist       | Co-Pilot    | Co-Pilot    | Co-Pilot    |
| Student Insights         | Manual    | Assist       | AI Insights | AI Insights | AI Insights |
| Marketing Content        | Manual    | Assist       | Co-Pilot    | Co-Pilot    | Co-Pilot    |

This allows each capability to evolve its AI maturity independently.

---

# 18. AI Is Not One Commercial Capability

The platform must avoid this model:

```text
AI = Enabled
```

Instead:

```text
Learning AI        = Co-Pilot
Assessment AI      = Co-Pilot
Analytics AI       = Insights
Marketing AI       = Assist
Commerce AI        = Disabled
```

This is much more expressive and allows precise commercial packaging.

---

# 19. Capability Packs

A Capability Pack is a separately purchasable commercial component.

| Pack                       | Main Capabilities                                 |
| -------------------------- | ------------------------------------------------- |
| **AI Author Pack**         | Lesson generation, content generation, worksheets |
| **AI Assessment Pack**     | Question generation, grading, rubrics, feedback   |
| **AI Mentor Pack**         | Student insights and recommendations              |
| **Commerce Pack**          | Advanced subscriptions, coupons, bundles          |
| **Marketing Pack**         | Landing pages, campaigns, referrals               |
| **Branding Pack**          | Custom domain, advanced branding                  |
| **Collaboration Pack**     | Additional tutors, assistants                     |
| **Live Teaching Pack**     | Advanced live teaching workflows                  |
| **Parent Engagement Pack** | Parent communication and insights                 |
| **Integration Pack**       | API, webhooks, external integrations              |

---

# 20. Pack Composition

A pack may contain multiple capability upgrades.

Example:

```text
AI Assessment Pack
│
├── Assessment AI = Co-Pilot
├── AI Question Generation
├── AI Distractor Generation
├── AI Feedback
├── AI Grading
└── AI Rubric Suggestions
```

The pack should not be implemented as a technical feature bundle.

It is a commercial bundle of entitlements.

---

# 21. Pack Dependency Example

A pack may have commercial dependencies.

Example:

```text
AI Assessment Pack
        │
        ▼
Assessment Profile >= Professional
```

If the dependency is not satisfied, the Product Configuration Engine may:

1. reject the configuration; or
2. recommend the required profile; or
3. automatically include the required component where the commercial policy allows it.

---

# 22. Tutor Capacity

Number of tutors is a commercial dimension independent from feature capability.

| Product           | Default Tutor Capacity |
| ----------------- | ---------------------: |
| Solo Essential    |                      1 |
| Solo Professional |                      1 |
| Solo AI+          |                    1–2 |
| Studio            |                     10 |
| Academy           |              Unlimited |
| Enterprise        |            Contractual |

Capacity may also be sold independently.

Example:

```text
Solo Professional
+
Additional Tutor Pack
```

---

# 23. Capacity Dimensions

The platform should eventually support multiple commercial capacity dimensions.

| Capacity            | Example                            |
| ------------------- | ---------------------------------- |
| Tutors              | 1, 2, 5, 10, Unlimited             |
| Teaching Assistants | 0, 1, 5, Unlimited                 |
| Students            | Unlimited / fair use / contractual |
| Workspaces          | 1, multiple                        |
| Departments         | 0, 5, unlimited                    |
| Branches            | 0, 5, unlimited                    |
| Storage             | GB                                 |
| Video Processing    | Minutes                            |
| AI Credits          | Monthly allowance                  |

---

# 24. Usage Policies

Usage policies define measurable resource consumption.

Examples:

```text
AI Credits = 50,000 / month

Storage = 100 GB

Video Processing = 500 minutes / month

Email = 10,000 messages / month
```

Usage policies are separate from capability profiles.

A capability can be enabled while its usage is metered.

---

# 25. Pricing Model

Pricing should be composed from commercial components rather than hardcoded only at the plan level.

```text
Base Product Price
        +
Capability Profile Upgrades
        +
Capability Packs
        +
Capacity
        +
Usage
        -
Discounts
        =
Subscription Price
```

Example:

| Component         | Monthly Price |
| ----------------- | ------------: |
| Solo Professional |           $25 |
| Learning → AI+    |            $7 |
| Assessment → AI+  |            $5 |
| Additional Tutor  |            $5 |
| AI Credits        |            $8 |
| **Total**         |       **$50** |

Actual prices will be defined separately from the architecture.

---

# 26. Design Your Own Plan

The customer may construct a commercial product using:

```text
Base Product
+
Capability Profiles
+
Capability Packs
+
Capacity
+
Usage
+
Support
```

Example:

```text
Base Product
Solo Professional

Learning
AI+

Assessment
AI+

Analytics
Professional

Commerce
Essential

Marketing
Disabled

Tutors
1

AI Credits
50,000
```

The result is a valid Product Configuration.

---

# 27. Fixed Product vs Custom Product

| Dimension           | Fixed Product   | Design Your Own        |
| ------------------- | --------------- | ---------------------- |
| Base configuration  | Predefined      | Customer-selected      |
| Capability profiles | Preselected     | Customizable           |
| Packs               | Optional        | Optional               |
| Capacity            | Predefined      | Selectable             |
| Pricing             | Predictable     | Calculated             |
| Validation          | Catalog-defined | Configuration Engine   |
| Recommendation      | Optional        | Strongly recommended   |
| Target customer     | Majority        | Advanced / specialized |

---

# 28. Product Recommendation Relationship

Product Management provides the catalog.

Product Advisory uses the catalog.

```text
Commercial Product Management
            │
            │ Catalog
            ▼
      Product Advisory
            │
            │ Recommendation
            ▼
      Customer
            │
            │ Selection
            ▼
 Product Configuration Engine
```

Product Management therefore does not make customer-specific recommendations.

---

# 29. Product Versioning

Commercial products must be versioned.

Example:

```text
Solo Professional v1
Solo Professional v2
```

A product version defines the commercial configuration at a point in time.

This is important because existing customers should not unexpectedly change when the product catalog changes.

---

# 30. Product Lifecycle

A commercial product follows:

```text
Draft
  ↓
Internal Review
  ↓
Scheduled
  ↓
Published
  ↓
Available
  ↓
Retiring
  ↓
Retired
```

A retired product should generally remain resolvable for existing subscriptions and licenses.

---

# 31. Product Change Policy

Changes should be classified.

| Change                       | Existing Customers           |
| ---------------------------- | ---------------------------- |
| New capability added to plan | Policy dependent             |
| Price increase               | Renewal / contractual policy |
| Capability removed           | Requires migration policy    |
| New AI level                 | Usually additive             |
| New capability pack          | No impact                    |
| Internal catalog metadata    | No impact                    |

Commercial Product Management should never silently invalidate an active workspace license.

---

# 32. Commercial Product Aggregate Model

Conceptually:

```text
Product
│
├── Product Version
│
├── Product Components
│      │
│      ├── Capability Profile
│      ├── Capability Pack
│      ├── Capacity
│      ├── Usage Policy
│      └── Support Policy
│
└── Pricing Policy
```

---

# 33. Capability Aggregate Model

```text
Capability Domain
│
├── Capability
│
├── Capability Profiles
│
│   ├── Foundation
│   ├── Professional
│   ├── AI+
│   └── Enterprise
│
└── AI Assistance Policies
```

---

# 34. Commercial Product Rules

### CPR-001

Every sellable product must reference a valid product version.

### CPR-002

A Fixed Product is a predefined Product Configuration.

### CPR-003

Capability Profiles are independently definable per Capability Domain.

### CPR-004

AI Assistance Levels are independently configurable per capability.

### CPR-005

Capability Packs may contain multiple capability entitlements.

### CPR-006

Capacity is modeled separately from capability availability.

### CPR-007

Usage policies are modeled separately from capability availability.

### CPR-008

Product definitions must be versioned.

### CPR-009

Retiring a product must not invalidate active licenses.

### CPR-010

Commercial Product Management does not directly grant runtime workspace entitlements.

### CPR-011

Product Configuration is responsible for validating customer-selected combinations.

### CPR-012

Product Advisory may recommend products but cannot modify the catalog.

---

# 35. Product Configuration Contract

The Product Configuration Engine consumes catalog definitions such as:

```text
Product
Capability Profile
Capability Pack
AI Assistance Policy
Capacity Definition
Usage Policy
Pricing Policy
Compatibility Rules
Dependency Rules
```

It produces:

```text
Validated Product Configuration
```

The detailed behavior will be defined in:

**Product Configuration Engine Architecture**

---

# 36. Licensing Contract

Commercial Product Management defines **what can be sold**.

Licensing & Entitlements defines **what a workspace has been granted**.

```text
Product Definition
        │
        ▼
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

---

# 37. Product Catalog Governance

Changes to the commercial catalog should follow controlled governance.

```text
Draft
  ↓
Business Review
  ↓
Pricing Review
  ↓
Architecture Review
  ↓
Product Approval
  ↓
Publish
```

Different changes may require different approval levels.

---

# 38. Commercial Catalog as Source of Truth

The Product Catalog is the source of truth for:

* available commercial products;
* capability profiles;
* capability packs;
* commercial capacity;
* usage policies;
* pricing components;
* product dependencies;
* product versions.

It is **not** the source of truth for:

* customer payment;
* active subscription state;
* runtime authorization;
* actual resource consumption.

Those belong to other contexts.

---

# 39. Example Complete Commercial Catalog

```text
SOLO FAMILY
│
├── Solo Essential
│   ├── Learning = Foundation
│   ├── Assessment = Foundation
│   ├── Analytics = Basic
│   ├── Branding = Basic
│   ├── Tutors = 1
│   └── AI Credits = 5,000
│
├── Solo Professional
│   ├── Learning = Professional
│   ├── Assessment = Professional
│   ├── Analytics = Advanced
│   ├── Branding = Professional
│   ├── Tutors = 1
│   └── AI Credits = 20,000
│
└── Solo AI+
    ├── Learning = AI+
    ├── Assessment = AI+
    ├── Analytics = AI+
    ├── Branding = Professional
    ├── Tutors = 1–2
    └── AI Credits = 75,000
```

---

# 40. Strategic Outcome

The Commercial Product Management model separates four concepts that are often incorrectly combined:

```text
WHAT
Capability

HOW WELL
Capability Profile

HOW INTELLIGENTLY
AI Assistance Level

HOW MUCH
Capacity / Usage
```

A commercial product is simply a predefined composition of these dimensions.

---

# 41. Final Commercial Product Model

```text
                    PRODUCT FAMILY
                          │
                          ▼
                   COMMERCIAL PRODUCT
                          │
          ┌───────────────┼────────────────┐
          ▼               ▼                ▼
     CAPABILITIES      CAPACITY          USAGE
          │
          ▼
    CAPABILITY PROFILE
          │
          ▼
    AI ASSISTANCE LEVEL
          │
          ▼
    OPTIONAL PACKS
          │
          ▼
    PRICING POLICY
```

This model allows the platform to support:

* simple fixed plans;
* sophisticated AI-first plans;
* capability-based upgrades;
* capability packs;
* additional tutors;
* usage-based AI consumption;
* Design Your Own Plan;
* negotiated enterprise products;
* future commercial models not yet defined.

---

# 42. Related Documents

This document is the source for the following detailed architectures:

1. **Product Configuration Engine Architecture**
2. **Product Advisory Architecture**
3. **Licensing & Entitlement Architecture**
4. **Usage & Metering Architecture**
5. **Subscription Management Architecture**
6. **Billing Architecture**
7. **Promotion & Discount Architecture**
8. **Commercial Analytics Architecture**
9. **AI Commercial Strategy Architecture**

---

# 43. Status

**Draft — Version 1.0**

This document establishes the commercial product vocabulary and catalog model.

The next document should define how the platform takes these catalog components and turns them into a **valid, priced, dependency-resolved Product Configuration**.

**Next: `ProductConfigurationEngineArchitecture.md`**
