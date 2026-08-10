# Capability Tier Reference — Foundation / Professional / AI+, AI Assistance Levels, and Capability Packs

**Status:** Reference — derived from seeded code + architecture docs, 2026-08-10
**Purpose:** One place that ties the commercial tier names a tutor sees to the concrete system properties behind them. Written for three audiences: support/sales explaining plans today, whoever builds the on-screen comparison UI, and whoever eventually builds the AI Assistant chat feature (`Documents/AI /AIAssistantArchitecture.md`) that will need to explain this to a tutor by voice instead of by table.

This is a reference, not a new architecture decision. Every fact below is sourced from either seeded code (`backend/src/Platform.Domain/CommercialCatalog.cs`, `CommercialEnums.cs`, `Platform.Api/Services/EntitlementResolutionService.cs`) or the design docs listed at the bottom. Where the docs are silent, this file says so rather than inventing an answer.

---

## 1. The three Solo plans, as actually seeded

| | Solo Essential | Solo Professional | Solo AI+ |
|---|---|---|---|
| Code | `solo-essential` | `solo-professional` | `solo-ai-plus` |
| Price | $19/mo · $190/yr | $39/mo · $390/yr | $79/mo · $790/yr |
| Tutors | 1 | 1 | 1–2 |
| AI credits/mo | 5,000 | 20,000 | 75,000 |
| Learning | Foundation | Professional | AiPlus |
| Assessment | Foundation | Professional | AiPlus |
| Analytics | Foundation | Professional | AiPlus |
| Branding | Foundation | Professional | **Professional** (not AiPlus) |

Branding is capped at Professional on the AI+ tier deliberately — branding isn't part of the AI value proposition, so it doesn't ride along with the other three domains (code comment, `CommercialCatalog.cs:117-119`).

Prices are dev-seed placeholders, not committed V1 pricing (`CommercialCatalog.cs:10-11`, citing Commercial Product Management §25).

## 2. Two separate axes: Capability Profile and AI Assistance Level

Every domain (Learning, Assessment, Analytics, Branding) carries **two** independent values, not one:

- **Capability Profile** (`CapabilityProfileLevel`: `Foundation` → `Professional` → `AiPlus`) — the commercial maturity tier. This is what a plan or pack actually grants.
- **AI Assistance Level** (`AiAssistanceLevel`: `Manual` → `Assist` → `CoPilot`) — how much of the work AI does in that domain. This is **derived** from the profile, not stored independently.

The mapping is fixed and domain-independent (`EntitlementResolutionService.AiLevelFor`, `Platform.Api/Services/EntitlementResolutionService.cs:164-170`):

| Profile | → AI Assistance Level |
|---|---|
| Foundation | Manual |
| Professional | Assist |
| AiPlus | CoPilot |

One runtime exception that doesn't apply to plan/pack catalog data: a `Restricted` or `Expired` Workspace License forces `ai:{domain}` to `Manual` regardless of profile (same file, line 64). A prospective plan being compared has no license, so this never applies to catalog-only display.

**Practical read for Solo AI+:** Learning/Assessment/Analytics get CoPilot; Branding, capped at Professional, only gets Assist.

A fourth level, **Autonomous** ("AI executes approved workflows with configurable oversight"), exists in the design docs (Commercial Product Management §16) but is explicitly deferred and does not exist in the `AiAssistanceLevel` enum at all — there is no code path that ever produces it.

## 3. What the tier names concretely unlock — the only itemized list that exists

Beyond the profile/AI-level ladder, the design docs (Commercial Product Management §14) name a small set of concrete features per commercial tier. This is the **entire** itemized list — nothing else is documented feature-by-feature:

| Feature | Essential | Professional | AI+ |
|---|:---:|:---:|:---:|
| Learning Paths | — | ✓ | ✓ |
| Subscriptions | — | ✓ | ✓ |
| Coupons | — | ✓ | ✓ |
| Custom Domain | — | ✓ | ✓ |
| Multiple Tutors | — | — | 2 |
| Teaching Assistants | — | — | 1 |
| Shared Authoring | — | — | Limited |
| Revenue Analytics | — | ✓ | ✓ |

Everything else (course/lesson/quiz/exam authoring, question banks, live classes, progress tracking) is available on **every** Solo tier, including Essential — a deliberate principle (§15): core teaching should never be the thing gated, so Essential doesn't feel like a trial product. Commercial differentiation comes from intelligence, advanced workflows, collaboration, automation, commerce, branding, analytics, and capacity — not from whether a tutor can teach at all.

Labels like "Advanced Learning" or "AI Insights Analytics" appear only as single cells in the profile matrix (§13) with no further doc unpacking what they concretely do beyond the table above. **This is the honest boundary of what's specified** — anything more granular would have to be designed, not extracted.

## 4. AI Assistance Level mapped to concrete tutor-facing tasks

Separately from the domain-level ladder above, Commercial Product Management §17 maps AI Assistance Levels onto specific generation/feedback tasks per tier (documented as a plan-level table, not enforced per-task in code — the code only tracks one `AiAssistanceLevel` per domain):

| Task | Essential | Professional | AI+ |
|---|---|---|---|
| Course Planning | Manual | Assist | Co-Pilot |
| Lesson/Quiz/Question/Worksheet Generation | Assist | Assist | Co-Pilot |
| Assessment Feedback | Manual | Assist | Co-Pilot |
| Student Feedback | Manual | Assist | Co-Pilot |
| Learning Recommendations | Manual | Assist | Co-Pilot |
| Student Insights | Manual | Assist | **AI Insights** (its own label, not quite Co-Pilot) |

## 5. Capability Packs — the V1 launch set (as seeded)

Packs let a tutor push one domain to AiPlus without upgrading the whole plan. Resolved by MAX comparison against the base plan's profile (not additive) — a pack's only effect is what it grants (`CommercialCatalog.cs:29-35`).

| Pack | Price/mo | Grants | Extra tutors | Dependency |
|---|---|---|---|---|
| AI Author | $9 | Learning → AiPlus | — | none |
| AI Assessment | $9 | Assessment → AiPlus | — | **Assessment ≥ Professional** |
| AI Mentor | $9 | Analytics → AiPlus | — | none |
| Branding | $5 | Branding → AiPlus | — | none |
| Collaboration | $5 | (no domain grant) | +1 | none |

AI Assessment's dependency is the only concrete pack dependency modeled anywhere in the codebase (`CommercialCatalog.cs:147-148`, citing Product Configuration Engine §21's worked example). Practically: a tutor on Solo Essential cannot buy AI Assessment directly — Assessment must already be at Professional or above first (either by plan or by override).

These five are the confirmed V1 launch set (`Commercial Domain V1 Scope.md §2.1`, 2026-08-09). Five more named in the architecture docs — Marketing, Commerce, Live Teaching, Parent Engagement, Integration — are confirmed **deferred**, not built.

## 6. What is explicitly NOT documented or NOT modeled

- No feature-by-feature spec exists for what "Advanced" Learning or "AI Insights" Analytics concretely does, beyond §3's named items and the AI-task mapping in §4.
- The **Collaboration** domain exists in `CapabilityDomain` and is referenced by the Collaboration pack, but no Solo plan sets a Collaboration profile — only Learning/Assessment/Analytics/Branding are modeled per plan (`CommercialEnums.cs:4-11`). The Collaboration pack only adds tutor capacity; it grants no domain profile.
- Pricing is a placeholder throughout, not committed V1 pricing.
- Autonomous AI Assistance Level is designed but not implemented (§2 above).

## 7. Where this lives in the system today

| Surface | File | Shows |
|---|---|---|
| Public landing page | `frontend/src/screens/LandingScreen.jsx` | Plan grid + per-domain profile/AI tag + add-on catalog (teaser, no checkout — single CTA per ADR-EA-002) |
| Workspace home | `frontend/src/screens/WorkspaceHomeScreen.jsx` | Same teaser, plus current-plan badge if subscribed |
| Billing | `frontend/src/screens/SubscriptionScreen.jsx` | Full picker, pack selection with dependency enforcement, live entitlement grid (profile + AI level per domain) |
| Shared labels | `frontend/src/i18n/subscriptionLabels.js` | `levelLabel`, `aiLabel`, `domainLabel`, `aiLevelForProfile`, `parseRequirement`, `packGrants` — single source so the three screens above never drift into different wording |
| Catalog API | `backend/src/Platform.Api/Controllers/CommercialCatalogController.cs` | `GET /api/catalog/plans`, `GET /api/catalog/packs` — public, no auth, always reflects the currently published catalog version |

**For a future AI Assistant chat feature:** as of this writing, no such feature exists in code — the frontend's "AI" nav item renders a `NotBuiltYet` placeholder, and there is no backend AI controller, provider, or skill resolver anywhere in `Platform.Api`/`Platform.Domain`. When it is built, per `AIAssistantArchitecture.md` §70 and invariant AI-003, it must answer "what's the difference between my plan and AI+" by calling the same `GET /api/catalog/plans`/`/packs` endpoints (or a future effective-entitlements endpoint) — never by hardcoding tier copy into a prompt, and never by granting or implying entitlement changes itself.

---

## Sources

- `backend/src/Platform.Domain/CommercialCatalog.cs` — seed data
- `backend/src/Platform.Domain/CommercialEnums.cs` — enum definitions + provenance comments
- `backend/src/Platform.Api/Services/EntitlementResolutionService.cs` — profile → AI level mapping
- `backend/src/Platform.Api/Controllers/CommercialCatalogController.cs` — public catalog API
- `Documents/CommercialProductManagementArchitecture.md` §10–25, §39
- `Documents/Commercial Domain Reference Architecture.md` §8–15
- `Documents/LicensingAndEntitlementArchitecture.md` §9–14
- `Documents/Product Configuration Engine Architecture.md` §21
- `Documents/Commercial Domain V1 Scope.md` §2.1
- `Documents/AI /AIAssistantArchitecture.md` §70, AI-002, AI-003
