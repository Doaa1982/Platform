# Subscription & Licensing Architecture

Version: 1.0

Bounded Context: Subscription & Licensing

---

> **SUPERSEDED — Reference Only**
>
> This document predates the split of the Commercial Domain into separate bounded contexts and is retained for historical context only. It is **not** the current architecture.
>
> Current documents:
> * `CommercialDomainReferenceArchitecture.md` (entry point)
> * `SubscriptionManagementArchitecture.md`
> * `LicensingAndEntitlementArchitecture.md`
> * `CommercialProductManagementArchitecture.md`
>
> Do not use this document as a source of truth for terminology, ownership, or business rules. Where this document conflicts with the documents above, the documents above govern.

---

# 1. Vision

The Subscription & Licensing bounded context defines how commercial products are composed, licensed, and delivered to workspaces.

Rather than selling isolated features, the platform licenses business capabilities, AI assistance levels, collaboration limits, and operational entitlements.

The objective is to allow fixed plans, custom plans, and future commercial offerings to coexist without changing the business architecture.

---

# 2. Core Concepts

| Concept | Description |
|----------|-------------|
| Product | Commercial offering sold by the platform |
| Plan | Predefined collection of capabilities |
| Capability | Business function that may be licensed |
| Capability Level | Functional maturity of a capability |
| AI Assistance Level | Degree of AI participation |
| Capability Pack | Optional upgrade for one capability |
| Workspace License | Active license assigned to a workspace |
| Entitlement | Permission to use a capability |
| Usage Policy | Metered usage constraints |
| Subscription | Commercial agreement |
| Promotion | Temporary commercial modification |

---

# 3. Business Principles

## Capability First

Customers purchase business capabilities.

Not technical features.

---

## AI is a Dimension

AI is not a feature.

AI enhances every capability independently.

---

## Workspace Driven

Licenses belong to workspaces.

Never individual users.

---

## Commercial Flexibility

Marketing can introduce

- new plans
- new packs
- promotions

without engineering changes.

---

# 4. Product Model

```
Commercial Catalog
│
├── Fixed Plans
├── Custom Plans
├── Capability Packs
└── Promotions
```

---

# 5. Plan Hierarchy

| Family | Plans |
|---------|-------|
| Solo | Essential, Professional, AI+ |
| Studio | Studio |
| Academy | Academy |
| Enterprise | Custom |

---

# 6. Capability Domains

| Domain | Example Capabilities |
|----------|---------------------|
| Workspace | Branding, Domain, Workspace Settings |
| Learning | Courses, Lessons, Learning Paths |
| Assessment | Quizzes, Exams, Assignments |
| AI | Lesson Generation, Assessment Generation |
| Commerce | Payments, Coupons, Memberships |
| Analytics | Student Analytics, Revenue Analytics |
| Collaboration | Tutors, Assistants, Roles |
| Marketing | Landing Pages, Campaigns |
| Community | Groups, Discussion |
| Integration | API, SSO, Webhooks |

---

# 7. Capability Availability Matrix

| Capability | Solo Essential | Solo Professional | Solo AI+ | Studio | Academy |
|------------|:--------------:|:-----------------:|:--------:|:-------:|:--------:|
| Course Authoring | ✔ | ✔ | ✔ | ✔ | ✔ |
| Assessments | ✔ | ✔ | ✔ | ✔ | ✔ |
| Live Classes | ✔ | ✔ | ✔ | ✔ | ✔ |
| Learning Paths | — | ✔ | ✔ | ✔ | ✔ |
| Marketplace | — | ✔ | ✔ | ✔ | ✔ |
| Team Collaboration | — | — | Limited | ✔ | ✔ |
| Organization Management | — | — | — | — | ✔ |

---

# 8. AI Assistance Matrix

| Capability | Essential | Professional | AI+ |
|------------|-----------|--------------|------|
| Lesson Authoring | Manual | AI Assist | AI Co-Pilot |
| Course Planning | Manual | Suggestions | Full Generation |
| Assessment | Manual | AI Assist | AI Generation |
| Feedback | Manual | Templates | Personalized AI |
| Learning Path | Manual | Suggestions | AI Optimized |
| Student Analytics | Manual | AI Summary | AI Insights |
| Certificates | Manual | Templates | AI Design |
| Workspace Setup | Manual | Guided | AI Auto Setup |

---

# 9. Collaboration Matrix

| Capability | Essential | Professional | AI+ | Studio | Academy |
|------------|-----------|--------------|------|---------|----------|
| Tutors | 1 | 1 | 2 | 10 | Unlimited |
| Teaching Assistants | — | — | 1 | Unlimited | Unlimited |
| Workspace Roles | — | — | Limited | Advanced | Enterprise |
| Shared Resources | — | — | ✔ | ✔ | ✔ |

---

# 10. AI Credit Matrix

| Plan | Monthly Credits |
|------|----------------:|
| Essential | 5,000 |
| Professional | 20,000 |
| AI+ | 75,000 |
| Studio | 200,000 |
| Academy | Custom |

---

# 11. Capability Packs

| Pack | Upgrades |
|------|----------|
| AI Author Pack | Lesson generation, worksheets, quizzes |
| AI Assessment Pack | Grading, rubrics, feedback |
| Marketing Pack | Landing pages, CRM, referrals |
| Commerce Pack | Coupons, subscriptions |
| Branding Pack | Domain, white label |
| Team Pack | Additional tutors |

---

# 12. Design Your Own Plan

```
Workspace
↓
Select Base Plan
↓
Choose Capability Packs
↓
Select AI Level
↓
Select Tutor Capacity
↓
Review Price
↓
Workspace License Created
```

---

# 13. Workspace License

Example

| Entitlement | Value |
|-------------|-------|
| Max Tutors | 2 |
| AI Lesson Authoring | Co-Pilot |
| AI Assessment | Assist |
| Marketing | Enabled |
| Marketplace | Enabled |
| AI Credits | 50,000 |
| White Label | Disabled |

The workspace never knows its commercial plan.

It only knows its entitlements.

---

# 14. Business Rules

BR-001

Plans are predefined collections of entitlements.

---

BR-002

Capability Packs extend plans.

---

BR-003

Capabilities may evolve independently.

---

BR-004

AI Assistance is licensed separately from capability availability.

---

BR-005

Workspace licenses determine runtime behavior.

---

BR-006

Billing never directly enables features.

Billing activates licenses.

Licenses create entitlements.

Entitlements unlock capabilities.

---

# 15. Context Relationships

```
Billing
      │
      ▼
Subscription & Licensing
      │
      ▼
Workspace License
      │
      ▼
Learning Workspace
      │
      ▼
Capability Authorization
```
