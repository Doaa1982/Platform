namespace Platform.Domain;

/// <summary>
/// Capability domains carried by the Solo product family in V1 — a deliberate
/// subset of the full domain list (Commercial Product Management §10 lists 13;
/// Reference Architecture §8 lists 14, including them was never reconciled
/// between the two documents). Only the domains actually differentiated across
/// Solo Essential/Professional/AI+ (Commercial Product Management §39) are
/// modeled; Commerce/Marketing/etc. are out of scope until a pack needs them.
/// </summary>
public enum CapabilityDomain { Learning, Assessment, Analytics, Branding, Collaboration }

/// <summary>
/// The three Capability Profile levels that exist for Solo (Foundation ↔
/// Essential, Professional ↔ Professional, AiPlus ↔ AI+ — Studio/Enterprise
/// levels are out of scope, Studio/Academy product families are deferred per
/// the Decision Brief). Ordinal position (declaration order) is the MAX-comparison
/// scale used by entitlement resolution (Licensing & Entitlements §12) — scoped
/// to this one ladder, never compared across domains.
/// </summary>
public enum CapabilityProfileLevel { Foundation, Professional, AiPlus }

/// <summary>
/// AI Assistance Level, trimmed to the three levels actually ever assigned to
/// anything in Commercial Product Management §17's AI Capability Matrix.
/// "Autonomous" is the fourth canonical level (§16) but is marked "Future" for
/// every capability in Reference Architecture §11 — omitted here rather than
/// carried as a dead enum value.
/// </summary>
public enum AiAssistanceLevel { Manual, Assist, CoPilot }

/// <summary>
/// The five Capability Packs confirmed to ship at V1 launch (Decision Brief
/// #3), plus ExtraStudents/ExtraStorage — same additive-capacity shape as
/// Collaboration (extra tutor seats), added for the learner-capacity and
/// video-storage caps.
/// </summary>
public enum CapabilityPack { AiAuthor, AiAssessment, AiMentor, Branding, Collaboration, ExtraStudents, ExtraStorage }

/// <summary>
/// Subscription lifecycle (Commercial Domain V1 Scope §2.3's ratified 8-state
/// list — not SubscriptionManagementArchitecture.md §8's longer 10-state list,
/// which still includes Paused/Terminated, not yet trimmed to match the
/// approved scope). Pause/Resume is explicitly deferred to Phase 2 (Decision
/// Brief #4).
/// </summary>
public enum SubscriptionStatus { Draft, Pending, Active, PastDue, Grace, Suspended, Cancelled, Expired }

/// <summary>Billing cycles in scope for V1 (Commercial Domain V1 Scope §2.3) — Quarterly/Custom deferred.</summary>
public enum BillingCycle { Monthly, Annual }

/// <summary>
/// Workspace License status, derived — never set independently (LIC-002) —
/// from Subscription status via LicensingAndEntitlementArchitecture.md §8.
/// </summary>
public enum LicenseStatus { Pending, Active, Grace, Restricted, Expired }

/// <summary>What kind of thing an Entitlement value represents (Licensing & Entitlements §9).</summary>
public enum EntitlementType { CapabilityProfile, AiAssistanceLevel, Capacity, UsageAllowance }

/// <summary>
/// What granted an Entitlement its value — used by the precedence rule
/// (Licensing & Entitlements §13: Override &gt; Promotion &gt; Pack/Capacity &gt; Base
/// Product). Promotion is omitted — Promotion &amp; Discounts is out of scope for
/// this pass.
/// </summary>
public enum EntitlementSource { BaseProduct, CapabilityPack, ManualOverride }

/// <summary>Lifecycle of an Entitlement Override (Licensing & Entitlements §16) — not enumerated by any doc, defined here.</summary>
public enum OverrideStatus { Active, Expired, Revoked }

/// <summary>
/// Invoice status, corrected 2026-08-09: narrowed from the original 8-state
/// payment-processing list (Draft, Open, Processing, Paid, PartiallyPaid,
/// PastDue, Voided, Uncollectible) to the 5 states that make sense once
/// Billing no longer processes payment (Commercial Domain Data Model —
/// Billing.md v0.2 §3). Overdue is set when DueDate passes without the
/// invoice being manually marked Paid (SubscriptionManagementArchitecture.md §29).
/// </summary>
public enum InvoiceStatus { Draft, Issued, Paid, Overdue, Voided }

/// <summary>What an Invoice Line prices (recommended invoice structure, Billing Architecture §66).</summary>
/// <summary>Proration added 2026-08-10 for immediate Upgrade billing (Billing Architecture §25-27) — string-backed column (PlatformDbContext), so a new member needs no migration.</summary>
public enum InvoiceComponentType { BasePlan, CapabilityPack, Capacity, Proration }

/// <summary>
/// Lifecycle of a <see cref="CreditPurchaseOrder"/> — a one-time AI-credit
/// top-up, requested by a Workspace and confirmed by a Platform Operator
/// under the same Manual Commercial Activation model Invoice uses (§27a),
/// kept as its own small lifecycle rather than reusing InvoiceStatus since a
/// top-up has no Draft-line-building or Overdue-due-date concept — it's a
/// single fixed-price request that's either still waiting, paid, or rejected.
/// </summary>
public enum CreditPurchaseOrderStatus { Pending, Paid, Voided }

/// <summary>
/// Lifecycle shared by every catalog entity (CommercialProduct/CommercialProductVersion/
/// CommercialPack/CommercialPackVersion) — no review-gate workflow in this pass,
/// any Platform Operator can publish directly (same authority model as the rest
/// of /admin). Draft = being prepared, not yet sellable. Published = current for
/// new sales — at most one Version per Product/Pack at a time (CPR-008/CPR-009).
/// Retired = no longer sold; existing References (ConfigurationSnapshot) keep
/// resolving against a Retired Version exactly as before, unaffected.
/// </summary>
public enum CatalogStatus { Draft, Published, Retired }
