using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Platform.Api.Models;
using Platform.Api.Services;
using Platform.Infrastructure;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace Platform.Api.Controllers;

/// <summary>
/// The authenticated Identity's own view of the platform.
/// Every endpoint here requires a valid bearer token.
/// </summary>
[ApiController]
[Route("api/me")]
[Authorize]
public class MeController(PlatformDbContext db, WorkspaceAccessService access) : ControllerBase
{
    /// <summary>
    /// GET /api/me
    /// The current Identity and every Workspace it belongs to, with roles per Workspace.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<MeResponse>> Get(CancellationToken ct)
    {
        if (!TryGetIdentityId(out var identityId))
            return Unauthorized(new { message = "Token does not carry a valid identity." });

        var identity = await db.Identities
            .AsNoTracking()
            .FirstOrDefaultAsync(i => i.Id == identityId, ct);

        // The token signature was valid, but the Identity is gone or no longer active
        if (identity is null || identity.Status != Domain.IdentityStatus.Active)
            return Unauthorized(new { message = "This account is not active." });

        var workspaces = await access.GetAccessibleWorkspacesAsync(identityId, ct);

        return Ok(new MeResponse(
            IdentityId: identity.Id,
            Email:      identity.Email,
            FullName:   identity.FullName,
            Workspaces: workspaces.Select(w => new WorkspaceAccessResponse(
                WorkspaceId:      w.WorkspaceId,
                Name:             w.WorkspaceName,
                Slug:             w.WorkspaceSlug,
                MembershipStatus: w.MembershipStatus.ToString(),
                Roles:            w.Roles.Select(r => r.ToString()).ToList()
            )).ToList()));
    }

    /// <summary>
    /// GET /api/me/workspaces/{slug}
    /// The roles this Identity actively holds in one Workspace — the per-request
    /// role resolution that replaces a role claim in the token.
    /// </summary>
    [HttpGet("workspaces/{slug}")]
    public async Task<ActionResult<WorkspaceAccessResponse>> GetWorkspaceAccess(
        string slug, CancellationToken ct)
    {
        if (!TryGetIdentityId(out var identityId))
            return Unauthorized(new { message = "Token does not carry a valid identity." });

        var resolved = await access.ResolveAccessAsync(identityId, slug, ct);

        // Deliberately indistinguishable from "no such Workspace" — a non-member
        // should not be able to probe which Workspaces exist (Workspace isolation,
        // Workspace Context Rule 1).
        if (resolved is null)
            return NotFound(new { message = "No active membership in this workspace." });

        return Ok(new WorkspaceAccessResponse(
            WorkspaceId:      resolved.WorkspaceId,
            Name:             resolved.WorkspaceName,
            Slug:             resolved.WorkspaceSlug,
            MembershipStatus: resolved.MembershipStatus.ToString(),
            Roles:            resolved.Roles.Select(r => r.ToString()).ToList()));
    }

    private bool TryGetIdentityId(out Guid identityId)
    {
        // JwtSecurityTokenHandler maps "sub" to ClaimTypes.NameIdentifier by default,
        // so accept either form rather than depending on that mapping staying put.
        var raw = User.FindFirstValue(ClaimTypes.NameIdentifier)
               ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);

        return Guid.TryParse(raw, out identityId);
    }
}
