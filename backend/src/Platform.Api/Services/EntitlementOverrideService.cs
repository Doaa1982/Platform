using Microsoft.EntityFrameworkCore;
using Platform.Api.Models;
using Platform.Domain;
using Platform.Infrastructure;

namespace Platform.Api.Services;

/// <summary>
/// Entitlement Overrides — Licensing &amp; Entitlements Architecture §16,
/// confirmed in scope for V1 (Decision Brief #5). Callers are Platform
/// Operators (checked by <c>PlatformOperatorRequirement</c> at the
/// controller) — a support exception is a back-office action, not something a
/// Workspace grants itself.
///
/// <see cref="EntitlementOverrideRequest.EntitlementKey"/> matches the keys
/// <see cref="EntitlementResolutionService"/> resolves against — e.g.
/// <c>"profile:Assessment"</c> or <c>"capacity:tutors"</c> (see that
/// service's <c>ProfileKey</c>/<c>AiKey</c>/<c>TutorCapacityKey</c>/
/// <c>AiCreditsKey</c> helpers) — a typo here simply never matches anything
/// during resolution rather than throwing, which keeps override creation
/// decoupled from having to know every valid key up front.
/// </summary>
public class EntitlementOverrideService(PlatformDbContext db, LicensingService licensing)
{
    public async Task<ProvisioningResult<EntitlementOverrideRow>> CreateAsync(
        string slug, Guid operatorIdentityId, EntitlementOverrideRequest request, CancellationToken ct = default)
    {
        var workspace = await FindWorkspaceAsync(slug, ct);
        if (workspace is null)
            return ProvisioningResult<EntitlementOverrideRow>.Fail(ProvisioningError.NotFound, "No such workspace.");

        EntitlementOverride entity;
        try
        {
            entity = EntitlementOverride.Create(
                workspace.Id, request.EntitlementKey, request.Value, request.Reason, operatorIdentityId, request.EffectiveUntil);
        }
        catch (ArgumentException ex)
        {
            return ProvisioningResult<EntitlementOverrideRow>.Fail(ProvisioningError.Invalid, ex.Message);
        }

        db.EntitlementOverrides.Add(entity);
        await db.SaveChangesAsync(ct);
        await RecomputeIfSubscribedAsync(workspace.Id, ct);

        return ProvisioningResult<EntitlementOverrideRow>.Success(Describe(entity));
    }

    public async Task<ProvisioningResult<EntitlementOverrideRow>> RevokeAsync(
        string slug, Guid overrideId, CancellationToken ct = default)
    {
        var workspace = await FindWorkspaceAsync(slug, ct);
        if (workspace is null)
            return ProvisioningResult<EntitlementOverrideRow>.Fail(ProvisioningError.NotFound, "No such workspace.");

        var entity = await db.EntitlementOverrides
            .FirstOrDefaultAsync(o => o.Id == overrideId && o.WorkspaceId == workspace.Id, ct);
        if (entity is null)
            return ProvisioningResult<EntitlementOverrideRow>.Fail(ProvisioningError.NotFound, "No such override.");

        try { entity.Revoke(); }
        catch (InvalidOperationException ex)
        {
            return ProvisioningResult<EntitlementOverrideRow>.Fail(ProvisioningError.Conflict, ex.Message);
        }

        await db.SaveChangesAsync(ct);
        await RecomputeIfSubscribedAsync(workspace.Id, ct);

        return ProvisioningResult<EntitlementOverrideRow>.Success(Describe(entity));
    }

    public async Task<ProvisioningResult<IReadOnlyList<EntitlementOverrideRow>>> ListAsync(
        string slug, CancellationToken ct = default)
    {
        var workspace = await FindWorkspaceAsync(slug, ct);
        if (workspace is null)
            return ProvisioningResult<IReadOnlyList<EntitlementOverrideRow>>.Fail(ProvisioningError.NotFound, "No such workspace.");

        var entities = await db.EntitlementOverrides.AsNoTracking()
            .Where(o => o.WorkspaceId == workspace.Id)
            .OrderByDescending(o => o.EffectiveFrom)
            .ToListAsync(ct);

        return ProvisioningResult<IReadOnlyList<EntitlementOverrideRow>>.Success(entities.Select(Describe).ToList());
    }

    private Task<Workspace?> FindWorkspaceAsync(string slug, CancellationToken ct) =>
        db.Workspaces.AsNoTracking().FirstOrDefaultAsync(w => w.Slug == slug.ToLowerInvariant().Trim(), ct);

    /// <summary>An override only takes effect once resolution reruns — find the Workspace's most recent Subscription, if it has one, and recompute through it.</summary>
    private async Task RecomputeIfSubscribedAsync(Guid workspaceId, CancellationToken ct)
    {
        var subscriptionId = await db.Subscriptions.AsNoTracking()
            .Where(s => s.WorkspaceId == workspaceId)
            .OrderByDescending(s => s.CreatedAt)
            .Select(s => (Guid?)s.Id)
            .FirstOrDefaultAsync(ct);

        if (subscriptionId is { } id)
            await licensing.RecomputeLicenseAsync(id, ct);
    }

    private static EntitlementOverrideRow Describe(EntitlementOverride o) => new(
        Id: o.Id,
        WorkspaceId: o.WorkspaceId,
        EntitlementKey: o.EntitlementKey,
        Value: o.Value,
        Reason: o.Reason,
        AppliedByIdentityId: o.AppliedByIdentityId,
        EffectiveFrom: o.EffectiveFrom,
        EffectiveUntil: o.EffectiveUntil,
        Status: o.Status.ToString());
}
