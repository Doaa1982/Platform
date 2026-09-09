namespace Platform.Api.Models;

/// <summary>One sellable Solo tier, as the public catalog shows it.</summary>
public record PlanSummary(
    string Code,
    string Name,
    decimal MonthlyPrice,
    decimal AnnualPrice,
    string Currency,
    int TutorCapacityBase,
    int TutorCapacityMax,
    int LearnerCapacityBase,
    int LearnerCapacityMax,
    int VideoStorageGbBase,
    int VideoStorageGbMax,
    int ResourceStorageGbBase,
    int ResourceStorageGbMax,
    int AiCreditsIncluded,
    string LearningProfile,
    string AssessmentProfile,
    string AnalyticsProfile,
    string BrandingProfile);

/// <summary>One optional Capability Pack add-on.</summary>
public record PackSummary(
    string Code,
    string Name,
    decimal MonthlyPrice,
    string Currency,
    IReadOnlyDictionary<string, string> DomainGrants,
    int ExtraTutorCapacity,
    int ExtraLearnerCapacity,
    int ExtraVideoStorageGb,
    int ExtraResourceStorageGb,
    /// <summary>e.g. "Assessment >= Professional" — null when the pack has no dependency.</summary>
    string? RequiresMinProfile);

/// <summary>Fixed-Plan checkout: a base plan plus optional add-ons (Design-Your-Own-Plan is not built in this pass).</summary>
public record CheckoutRequest(
    string PlanCode,
    IReadOnlyList<string>? PackCodes,
    string BillingCycle);

/// <summary>
/// Cancellation is otherwise a bare POST — Reason is optional and purely for
/// the churn-signal audit trail (recorded on the resulting SubscriptionEvent,
/// same ReferenceNote mechanism MarkInvoicePaidRequest already uses). Never
/// required, never blocks the cancellation itself.
/// </summary>
public record CancelSubscriptionRequest(string? Reason);

/// <summary>
/// A Downgrade request — same shape as CheckoutRequest minus BillingCycle
/// (Subscription Management Architecture §17: a plan/pack change, not a
/// billing-cycle change; ChangeBillingCycle is a separate, unbuilt command).
/// Resolved and Impact-Analyzed against the *current* Configuration Snapshot,
/// then scheduled rather than applied immediately (§14).
/// </summary>
public record DowngradeRequest(string PlanCode, IReadOnlyList<string>? PackCodes);

/// <summary>
/// An Upgrade request — same shape as DowngradeRequest, but applied
/// immediately with a prorated Invoice rather than scheduled (Billing
/// Architecture §25-29: Upgrade is Immediate/Prorated, Downgrade is
/// Next-Period/No-Refund). Rejected if the target plan isn't actually more
/// expensive than the current one at the subscription's billing cycle —
/// use Downgrade for that direction instead.
/// </summary>
public record UpgradeRequest(string PlanCode, IReadOnlyList<string>? PackCodes);

/// <summary>One resolved entry from a Workspace's effective Entitlement Set.</summary>
/// <summary>
/// One resolved entitlement. <see cref="UsedAmount"/> is only populated for
/// the metered capacity keys (tutor/learner seats, video/resource storage) —
/// null everywhere else (profile levels, AI assistance levels), since those
/// aren't a "used out of total" quantity.
/// </summary>
public record EntitlementRow(
    string Type,
    string? Domain,
    string Key,
    string Value,
    string Source,
    string? UsedAmount = null);

/// <summary>The commercial state of one Workspace, as its own members see it.</summary>
public record SubscriptionSummary(
    Guid SubscriptionId,
    string Status,
    string PlanCode,
    IReadOnlyList<string> SelectedPackCodes,
    string BillingCycle,
    DateTime StartDate,
    DateTime CurrentPeriodEnd,
    DateTime RenewalDate,
    DateTime? CancellationEffectiveDate,
    /// <summary>Null unless a Downgrade is scheduled (Subscription §14/§17). Resolved from PendingConfigurationSnapshotId — the raw id is never exposed to the client.</summary>
    string? PendingPlanCode,
    DateTime? PendingChangeEffectiveDate,
    /// <summary>Null unless a price-increasing plan/pack change is awaiting Platform Operator confirmation — entitlements stay on the current (confirmed) plan until then. Resolved from RequestedConfigurationSnapshotId.</summary>
    string? RequestedPlanCode,
    IReadOnlyList<string>? RequestedPackCodes,
    Guid? CurrentInvoiceId,
    string? CurrentInvoiceStatus,
    DateTime? CurrentInvoiceDueDate,
    decimal? CurrentInvoiceAmount,
    string? CurrentInvoiceCurrency,
    string LicenseStatus,
    IReadOnlyList<EntitlementRow> Entitlements,
    /// <summary>Live ledger balance (ICreditLedgerService.GetBalanceAsync) — distinct from the "credits:ai" entitlement, which is the plan's static monthly grant, not what's actually left.</summary>
    int AiCreditsRemaining,
    /// <summary>How much of <see cref="AiCreditsRemaining"/> is still attributable to the one-time trial grant (§A7) — see ICreditLedgerService.GetBalanceBreakdownAsync. 0 once spent, expired (30 days, or an earlier free→paid conversion per §A4), or never granted (not this workspace's first-ever subscription).</summary>
    int AiCreditsTrialRemaining);

/// <summary>
/// One confirmed plan/pack change with a real before/after diff — read from
/// a SubscriptionEvent's PreviousConfigurationSnapshotId/NewConfigurationSnapshotId
/// pair, joined against those two ConfigurationSnapshot rows. Only entries
/// with an actual pack-code diff are returned (a pure plan upgrade that kept
/// the same packs isn't "add-on history").
/// </summary>
public record SubscriptionHistoryEntry(
    DateTime ConfirmedAt,
    IReadOnlyList<string> AddedPackNames,
    IReadOnlyList<string> RemovedPackNames,
    int TutorCapacityBefore, int TutorCapacityAfter,
    int LearnerCapacityBefore, int LearnerCapacityAfter,
    int VideoStorageGbBefore, int VideoStorageGbAfter,
    int ResourceStorageGbBefore, int ResourceStorageGbAfter,
    int AiCreditsIncludedBefore, int AiCreditsIncludedAfter);

/// <summary>Manual Commercial Activation: an authorized Platform Operator recording that an invoice was settled outside the platform.</summary>
public record MarkInvoicePaidRequest(string? ReferenceNote);

public record EntitlementOverrideRequest(
    string EntitlementKey,
    string Value,
    string Reason,
    DateTime? EffectiveUntil);

public record EntitlementOverrideRow(
    Guid Id,
    Guid WorkspaceId,
    string EntitlementKey,
    string Value,
    string Reason,
    Guid AppliedByIdentityId,
    DateTime EffectiveFrom,
    DateTime? EffectiveUntil,
    string Status);

/// <summary>One Subscription as the Platform Administrator console sees it — every Workspace's commercial state in one table.</summary>
public record SubscriptionAdminRow(
    Guid SubscriptionId,
    string WorkspaceSlug,
    string WorkspaceName,
    string Status,
    string PlanCode,
    string BillingCycle,
    DateTime CurrentPeriodEnd,
    DateTime? CancellationEffectiveDate,
    string? PendingPlanCode,
    DateTime? PendingChangeEffectiveDate,
    Guid? CurrentInvoiceId,
    string? CurrentInvoiceStatus,
    DateTime? CurrentInvoiceDueDate,
    decimal? CurrentInvoiceTotal);

// ── AI-credit top-up purchases ──────────────────────────────────────────────

public record RequestCreditPurchaseRequest(string CreditPackCode);
public record ResolveCreditPurchaseRequest(string? ReferenceNote);

public record CreditPurchaseOrderRow(
    Guid Id,
    string CreditPackCode,
    string CreditPackName,
    int CreditAmount,
    decimal PriceAmount,
    string PriceCurrency,
    string Status,
    DateTime CreatedAt,
    DateTime? ResolvedAt,
    string? ReferenceNote);

/// <summary>One pending Credit Purchase Order across all Workspaces, for the Platform Administrator console.</summary>
public record CreditPurchaseOrderAdminRow(
    Guid Id,
    string WorkspaceSlug,
    string WorkspaceName,
    string CreditPackCode,
    string CreditPackName,
    int CreditAmount,
    decimal PriceAmount,
    string PriceCurrency,
    string Status,
    DateTime CreatedAt);

// ── Commercial Catalog administration (database-backed Products/Packs) ─────

/// <summary>The priced/entitled fields shared by "create a product" and "create a new version of an existing product."</summary>
public record ProductVersionFields(
    decimal MonthlyPrice,
    decimal AnnualPrice,
    string Currency,
    int TutorCapacityBase,
    int TutorCapacityMax,
    int LearnerCapacityBase,
    int LearnerCapacityMax,
    int VideoStorageGbBase,
    int VideoStorageGbMax,
    int ResourceStorageGbBase,
    int ResourceStorageGbMax,
    int AiCreditsIncluded,
    string LearningProfile,
    string AssessmentProfile,
    string AnalyticsProfile,
    string BrandingProfile);

public record ProductVersionRow(
    Guid Id,
    int VersionNumber,
    string Status,
    decimal MonthlyPrice,
    decimal AnnualPrice,
    string Currency,
    int TutorCapacityBase,
    int TutorCapacityMax,
    int LearnerCapacityBase,
    int LearnerCapacityMax,
    int VideoStorageGbBase,
    int VideoStorageGbMax,
    int ResourceStorageGbBase,
    int ResourceStorageGbMax,
    int AiCreditsIncluded,
    string LearningProfile,
    string AssessmentProfile,
    string AnalyticsProfile,
    string BrandingProfile,
    DateTime CreatedAt,
    DateTime? PublishedAt,
    DateTime? RetiredAt);

/// <summary>One Product as the Catalog admin tab sees it — current (Published), pending (Draft), and how much history exists behind it.</summary>
public record ProductAdminRow(
    Guid Id,
    string FamilyCode,
    string Code,
    string Name,
    string Status,
    ProductVersionRow? CurrentVersion,
    ProductVersionRow? DraftVersion,
    int RetiredVersionCount,
    /// <summary>True when no live Subscription references CurrentVersion yet — it can be edited in place instead of requiring a new Draft version.</summary>
    bool CurrentVersionEditable);

public record CreateProductRequest(string FamilyCode, string Code, string Name, ProductVersionFields Version);
public record CreateProductVersionRequest(ProductVersionFields Version);
public record UpdateProductVersionRequest(ProductVersionFields Version);

/// <summary>The priced/granted fields shared by "create a pack" and "create a new version of an existing pack." Grant/Requires values are CapabilityDomain/CapabilityProfileLevel names, or null.</summary>
public record PackVersionFields(
    decimal MonthlyPrice,
    string Currency,
    string? LearningGrant,
    string? AssessmentGrant,
    string? AnalyticsGrant,
    string? BrandingGrant,
    int ExtraTutorCapacity,
    int ExtraLearnerCapacity,
    int ExtraVideoStorageGb,
    int ExtraResourceStorageGb,
    string? RequiresDomain,
    string? RequiresMinLevel);

public record PackVersionRow(
    Guid Id,
    int VersionNumber,
    string Status,
    decimal MonthlyPrice,
    string Currency,
    string? LearningGrant,
    string? AssessmentGrant,
    string? AnalyticsGrant,
    string? BrandingGrant,
    int ExtraTutorCapacity,
    int ExtraLearnerCapacity,
    int ExtraVideoStorageGb,
    int ExtraResourceStorageGb,
    string? RequiresDomain,
    string? RequiresMinLevel,
    DateTime CreatedAt,
    DateTime? PublishedAt,
    DateTime? RetiredAt);

public record PackAdminRow(
    Guid Id,
    string Code,
    string Name,
    string Status,
    PackVersionRow? CurrentVersion,
    PackVersionRow? DraftVersion,
    int RetiredVersionCount,
    /// <summary>True when no live Subscription references CurrentVersion yet — it can be edited in place instead of requiring a new Draft version.</summary>
    bool CurrentVersionEditable);

public record CreatePackRequest(string Code, string Name, PackVersionFields Version);
public record CreatePackVersionRequest(PackVersionFields Version);
public record UpdatePackVersionRequest(PackVersionFields Version);
