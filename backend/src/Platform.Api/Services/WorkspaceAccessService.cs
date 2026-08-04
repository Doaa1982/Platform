using Microsoft.EntityFrameworkCore;
using Platform.Domain;
using Platform.Infrastructure;

namespace Platform.Api.Services;

/// <summary>
/// Resolves what an authenticated Identity may do inside a given Workspace.
///
/// Because the JWT carries identity-level claims only, every authorization decision
/// resolves roles here, per request, from the Membership Aggregate. This is the one
/// place that translates "who is this person" into "what are they in this Workspace",
/// so endpoints never reach for a role claim that does not exist.
/// </summary>
public class WorkspaceAccessService(PlatformDbContext db)
{
    /// <summary>
    /// Every Workspace this Identity has a Membership in, with the roles held in each.
    ///
    /// Removed Memberships are excluded — they represent revoked access. Suspended and
    /// Pending are included so a caller can explain *why* a Workspace is unavailable
    /// rather than silently hiding it.
    /// </summary>
    public async Task<IReadOnlyList<WorkspaceAccess>> GetAccessibleWorkspacesAsync(
        Guid identityId, CancellationToken ct = default)
    {
        var query =
            from m in db.Memberships.Include(m => m.Roles).AsNoTracking()
            join w in db.Workspaces.AsNoTracking() on m.WorkspaceId equals w.Id
            where m.IdentityId == identityId && m.Status != MembershipStatus.Removed
            select new { Membership = m, Workspace = w };

        var rows = await query.ToListAsync(ct);

        return rows
            .Select(r => new WorkspaceAccess(
                r.Workspace.Id,
                r.Workspace.Name,
                r.Workspace.Slug,
                r.Membership.Id,
                r.Membership.Status,
                r.Membership.Roles.Select(role => role.Name).OrderBy(n => n).ToList()))
            .OrderBy(a => a.WorkspaceName)
            .ToList();
    }

    /// <summary>
    /// The roles this Identity actively holds in one Workspace, identified by slug.
    /// Returns null when there is no Active Membership — which covers "not a member",
    /// "invitation still Pending", and "suspended" alike, so callers cannot
    /// accidentally treat a non-Active Membership as access.
    /// </summary>
    public async Task<WorkspaceAccess?> ResolveAccessAsync(
        Guid identityId, string workspaceSlug, CancellationToken ct = default)
    {
        var slug = workspaceSlug.ToLowerInvariant().Trim();

        var row = await (
            from m in db.Memberships.Include(m => m.Roles).AsNoTracking()
            join w in db.Workspaces.AsNoTracking() on m.WorkspaceId equals w.Id
            where m.IdentityId == identityId
               && w.Slug == slug
               && m.Status == MembershipStatus.Active
            select new { Membership = m, Workspace = w }
        ).FirstOrDefaultAsync(ct);

        if (row is null) return null;

        return new WorkspaceAccess(
            row.Workspace.Id,
            row.Workspace.Name,
            row.Workspace.Slug,
            row.Membership.Id,
            row.Membership.Status,
            row.Membership.Roles.Select(role => role.Name).OrderBy(n => n).ToList());
    }
}

/// <summary>
/// One Identity's resolved standing in one Workspace.
/// INV-005: these roles confer nothing in any other Workspace.
/// </summary>
public record WorkspaceAccess(
    Guid WorkspaceId,
    string WorkspaceName,
    string WorkspaceSlug,
    Guid MembershipId,
    MembershipStatus MembershipStatus,
    IReadOnlyList<WorkspaceRoleName> Roles)
{
    public bool HasRole(WorkspaceRoleName role) => Roles.Contains(role);
}
