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
public record EntitlementRow(
    string Type,
    string? Domain,
    string Key,
    string Value,
    string Source);

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
    Guid? CurrentInvoiceId,
    string? CurrentInvoiceStatus,
    DateTime? CurrentInvoiceDueDate,
    decimal? CurrentInvoiceAmount,
    string? CurrentInvoiceCurrency,
    string LicenseStatus,
    IReadOnlyList<EntitlementRow> Entitlements);

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

// ── Commercial Catalog administration (database-backed Products/Packs) ─────

/// <summary>The priced/entitled fields shared by "create a product" and "create a new version of an existing product."</summary>
public record ProductVersionFields(
    decimal MonthlyPrice,
    decimal AnnualPrice,
    string Currency,
    int TutorCapacityBase,
    int TutorCapacityMax,
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
    int RetiredVersionCount);

public record CreateProductRequest(string FamilyCode, string Code, string Name, ProductVersionFields Version);
public record CreateProductVersionRequest(ProductVersionFields Version);

/// <summary>The priced/granted fields shared by "create a pack" and "create a new version of an existing pack." Grant/Requires values are CapabilityDomain/CapabilityProfileLevel names, or null.</summary>
public record PackVersionFields(
    decimal MonthlyPrice,
    string Currency,
    string? LearningGrant,
    string? AssessmentGrant,
    string? AnalyticsGrant,
    string? BrandingGrant,
    int ExtraTutorCapacity,
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
    int RetiredVersionCount);

public record CreatePackRequest(string Code, string Name, PackVersionFields Version);
public record CreatePackVersionRequest(PackVersionFields Version);
