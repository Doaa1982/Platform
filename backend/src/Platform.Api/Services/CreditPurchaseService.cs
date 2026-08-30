using Microsoft.EntityFrameworkCore;
using Platform.Api.Models;
using Platform.Domain;
using Platform.Infrastructure;

namespace Platform.Api.Services;

/// <summary>
/// AI-credit top-up purchases — Manual Commercial Activation for a one-time,
/// subscription-independent purchase (see <see cref="CreditPurchaseOrder"/>'s
/// class remarks for why this doesn't reuse <see cref="Invoice"/>). A tutor
/// requests a fixed tier from <see cref="CreditPackCatalog"/>; a Platform
/// Operator marks it paid once payment is confirmed outside the platform,
/// which appends the resulting grant to the workspace's Credit Ledger.
/// </summary>
public class CreditPurchaseService(PlatformDbContext db, EntitlementResolutionService entitlements)
{
    private static readonly WorkspaceRoleName[] BillingRoles =
        [WorkspaceRoleName.Owner, WorkspaceRoleName.Administrator, WorkspaceRoleName.FinanceManager];

    /// <summary>Same four domains ConfigurationService/EntitlementResolutionService track AI assistance against — Collaboration has no AI concept.</summary>
    private static readonly CapabilityDomain[] AiDomains =
        [CapabilityDomain.Learning, CapabilityDomain.Assessment, CapabilityDomain.Analytics, CapabilityDomain.Branding];

    public IReadOnlyList<CreditPackTier> GetTiers() => CreditPackCatalog.Tiers;

    public async Task<ProvisioningResult<CreditPurchaseOrderRow>> RequestPurchaseAsync(
        string slug, Guid callerIdentityId, string creditPackCode, CancellationToken ct = default)
    {
        var workspace = await ResolveWorkspaceAsync(slug, callerIdentityId, requireBillingRole: true, ct);
        if (workspace.Error is not null) return Fail<CreditPurchaseOrderRow>(workspace.Error.Value);

        var tier = CreditPackCatalog.Find(creditPackCode);
        if (tier is null) return Fail<CreditPurchaseOrderRow>((ProvisioningError.Invalid, $"\"{creditPackCode}\" is not a credit pack tier."));

        // Buying credits nobody can spend doesn't make sense — every AI skill
        // call requires at least Assist on some domain (Foundation always
        // resolves to Manual, which blocks every call outright). Existing
        // balances (trial grants, earlier purchases) are left alone either
        // way; this only blocks adding to an unusable pile.
        var hasAnyAiDomain = false;
        foreach (var domain in AiDomains)
        {
            if (await entitlements.HasEntitlementAsync(workspace.Workspace!.Id, EntitlementResolutionService.AiKey(domain), AiAssistanceLevel.Assist.ToString(), ct))
            {
                hasAnyAiDomain = true;
                break;
            }
        }
        if (!hasAnyAiDomain)
            return Fail<CreditPurchaseOrderRow>((ProvisioningError.Conflict,
                "AI features aren't enabled on any capability for this workspace yet — upgrade your plan or add an AI-enabling pack before buying credits."));

        var order = CreditPurchaseOrder.Create(
            workspace.Workspace!.Id, callerIdentityId, tier.Code, tier.CreditAmount, tier.Price, tier.Currency);

        db.CreditPurchaseOrders.Add(order);
        await db.SaveChangesAsync(ct);

        return ProvisioningResult<CreditPurchaseOrderRow>.Success(Describe(order, tier));
    }

    /// <summary>Withdraws a request still awaiting a Platform Operator — the tutor-facing counterpart to VoidAsync, same as CommercialSubscriptionService.CancelRequestedChangeAsync's relationship to the admin Void.</summary>
    public async Task<ProvisioningResult<CreditPurchaseOrderRow>> CancelAsync(
        string slug, Guid callerIdentityId, Guid orderId, CancellationToken ct = default)
    {
        var workspace = await ResolveWorkspaceAsync(slug, callerIdentityId, requireBillingRole: true, ct);
        if (workspace.Error is not null) return Fail<CreditPurchaseOrderRow>(workspace.Error.Value);

        var order = await db.CreditPurchaseOrders
            .FirstOrDefaultAsync(o => o.Id == orderId && o.WorkspaceId == workspace.Workspace!.Id, ct);
        if (order is null) return Fail<CreditPurchaseOrderRow>((ProvisioningError.NotFound, "No such credit purchase order."));

        try { order.Cancel(callerIdentityId); }
        catch (InvalidOperationException ex) { return Fail<CreditPurchaseOrderRow>((ProvisioningError.Conflict, ex.Message)); }

        await db.SaveChangesAsync(ct);
        return ProvisioningResult<CreditPurchaseOrderRow>.Success(Describe(order, CreditPackCatalog.Find(order.CreditPackCode)));
    }

    public async Task<ProvisioningResult<IReadOnlyList<CreditPurchaseOrderRow>>> ListForWorkspaceAsync(
        string slug, Guid callerIdentityId, CancellationToken ct = default)
    {
        // Viewable by any active member, same as CommercialSubscriptionService.GetCurrentAsync —
        // only requesting a new purchase requires a billing role.
        var workspace = await ResolveWorkspaceAsync(slug, callerIdentityId, requireBillingRole: false, ct);
        if (workspace.Error is not null)
            return ProvisioningResult<IReadOnlyList<CreditPurchaseOrderRow>>.Fail(workspace.Error.Value.Error, workspace.Error.Value.Message);

        var orders = await db.CreditPurchaseOrders.AsNoTracking()
            .Where(o => o.WorkspaceId == workspace.Workspace!.Id)
            .OrderByDescending(o => o.CreatedAt)
            .ToListAsync(ct);

        return ProvisioningResult<IReadOnlyList<CreditPurchaseOrderRow>>.Success(
            orders.Select(o => Describe(o, CreditPackCatalog.Find(o.CreditPackCode))).ToList());
    }

    /// <summary>Every Workspace's pending top-up requests, for the Platform Administrator console — same "one query, join in memory" style as CommercialOpsService.ListSubscriptionsAsync.</summary>
    public async Task<IReadOnlyList<CreditPurchaseOrderAdminRow>> ListPendingAsync(CancellationToken ct = default)
    {
        var pending = await db.CreditPurchaseOrders.AsNoTracking()
            .Where(o => o.Status == CreditPurchaseOrderStatus.Pending)
            .OrderBy(o => o.CreatedAt)
            .ToListAsync(ct);

        var workspaces = await db.Workspaces.AsNoTracking()
            .Where(w => pending.Select(o => o.WorkspaceId).Contains(w.Id))
            .ToDictionaryAsync(w => w.Id, ct);

        return pending.Select(o =>
        {
            var workspace = workspaces.GetValueOrDefault(o.WorkspaceId);
            var tier = CreditPackCatalog.Find(o.CreditPackCode);
            return new CreditPurchaseOrderAdminRow(
                Id: o.Id,
                WorkspaceSlug: workspace?.Slug ?? "",
                WorkspaceName: workspace?.Name ?? "(unknown workspace)",
                CreditPackCode: o.CreditPackCode,
                CreditPackName: tier?.Name ?? o.CreditPackCode,
                CreditAmount: o.CreditAmount,
                PriceAmount: o.PriceAmount,
                PriceCurrency: o.PriceCurrency,
                Status: o.Status.ToString(),
                CreatedAt: o.CreatedAt);
        }).ToList();
    }

    public async Task<ProvisioningResult<CreditPurchaseOrderAdminRow>> MarkPaidAsync(
        Guid orderId, Guid operatorIdentityId, string? referenceNote, CancellationToken ct = default)
    {
        var order = await db.CreditPurchaseOrders.FirstOrDefaultAsync(o => o.Id == orderId, ct);
        if (order is null) return Fail<CreditPurchaseOrderAdminRow>((ProvisioningError.NotFound, "No such credit purchase order."));

        try { order.MarkPaid(operatorIdentityId, referenceNote); }
        catch (InvalidOperationException ex) { return Fail<CreditPurchaseOrderAdminRow>((ProvisioningError.Conflict, ex.Message)); }

        var entry = CreditLedgerEntry.Grant(order.WorkspaceId, CreditLedgerEntryType.Purchase, order.CreditAmount, expiresAtUtc: null);
        db.CreditLedgerEntries.Add(entry);
        order.AttachLedgerEntry(entry.Id);

        await db.SaveChangesAsync(ct);

        return ProvisioningResult<CreditPurchaseOrderAdminRow>.Success(await DescribeAdminRowAsync(order, ct));
    }

    public async Task<ProvisioningResult<CreditPurchaseOrderAdminRow>> VoidAsync(
        Guid orderId, Guid operatorIdentityId, string? reason, CancellationToken ct = default)
    {
        var order = await db.CreditPurchaseOrders.FirstOrDefaultAsync(o => o.Id == orderId, ct);
        if (order is null) return Fail<CreditPurchaseOrderAdminRow>((ProvisioningError.NotFound, "No such credit purchase order."));

        try { order.Void(operatorIdentityId, reason); }
        catch (InvalidOperationException ex) { return Fail<CreditPurchaseOrderAdminRow>((ProvisioningError.Conflict, ex.Message)); }

        await db.SaveChangesAsync(ct);

        return ProvisioningResult<CreditPurchaseOrderAdminRow>.Success(await DescribeAdminRowAsync(order, ct));
    }

    // ── Shared ───────────────────────────────────────────────────────────────

    private record WorkspaceResolution(Workspace? Workspace, (ProvisioningError Error, string Message)? Error);

    /// <summary>A non-member gets 404, never 403 — same reasoning as CommercialSubscriptionService.ResolveAsync.</summary>
    private async Task<WorkspaceResolution> ResolveWorkspaceAsync(string slug, Guid callerIdentityId, bool requireBillingRole, CancellationToken ct)
    {
        var normalised = slug.ToLowerInvariant().Trim();

        var workspace = await db.Workspaces.AsNoTracking().FirstOrDefaultAsync(w => w.Slug == normalised, ct);
        if (workspace is null) return new WorkspaceResolution(null, (ProvisioningError.NotFound, "No such workspace."));

        var caller = await db.Memberships
            .Include(m => m.Roles)
            .AsNoTracking()
            .FirstOrDefaultAsync(m => m.WorkspaceId == workspace.Id
                                   && m.IdentityId == callerIdentityId
                                   && m.Status == MembershipStatus.Active, ct);
        if (caller is null) return new WorkspaceResolution(null, (ProvisioningError.NotFound, "No such workspace."));

        if (requireBillingRole && !caller.Roles.Any(r => BillingRoles.Contains(r.Name)))
            return new WorkspaceResolution(null,
                (ProvisioningError.Forbidden, "Only an owner, administrator or finance manager can manage this workspace's AI credits."));

        return new WorkspaceResolution(workspace, null);
    }

    private static CreditPurchaseOrderRow Describe(CreditPurchaseOrder order, CreditPackTier? tier) => new(
        Id: order.Id,
        CreditPackCode: order.CreditPackCode,
        CreditPackName: tier?.Name ?? order.CreditPackCode,
        CreditAmount: order.CreditAmount,
        PriceAmount: order.PriceAmount,
        PriceCurrency: order.PriceCurrency,
        Status: order.Status.ToString(),
        CreatedAt: order.CreatedAt,
        ResolvedAt: order.ResolvedAt,
        ReferenceNote: order.ReferenceNote);

    private async Task<CreditPurchaseOrderAdminRow> DescribeAdminRowAsync(CreditPurchaseOrder order, CancellationToken ct)
    {
        var workspace = await db.Workspaces.AsNoTracking().FirstOrDefaultAsync(w => w.Id == order.WorkspaceId, ct);
        var tier = CreditPackCatalog.Find(order.CreditPackCode);
        return new CreditPurchaseOrderAdminRow(
            Id: order.Id,
            WorkspaceSlug: workspace?.Slug ?? "",
            WorkspaceName: workspace?.Name ?? "(unknown workspace)",
            CreditPackCode: order.CreditPackCode,
            CreditPackName: tier?.Name ?? order.CreditPackCode,
            CreditAmount: order.CreditAmount,
            PriceAmount: order.PriceAmount,
            PriceCurrency: order.PriceCurrency,
            Status: order.Status.ToString(),
            CreatedAt: order.CreatedAt);
    }

    private static ProvisioningResult<T> Fail<T>((ProvisioningError Error, string Message) e) => ProvisioningResult<T>.Fail(e.Error, e.Message);
}
