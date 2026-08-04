using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Platform.Domain;
using Platform.Infrastructure;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace Platform.Api.Authorization;

/// <summary>
/// Requires the caller to hold an Active PlatformOperator grant.
///
/// This is the authorization half of Platform Administrator Business Analysis
/// BA-001: authority over a Workspace deliberately does NOT come from holding a
/// Membership in it, because an admin must act on Workspaces they are not a
/// member of — and on brand-new ones where no Membership exists at all.
///
/// Checked against the database per request rather than carried in the token,
/// for the same reason Workspace roles are: a revoked grant must take effect
/// immediately, not whenever the holder's JWT happens to expire.
/// </summary>
public class PlatformOperatorRequirement : IAuthorizationRequirement
{
    public const string PolicyName = "PlatformOperator";
}

public class PlatformOperatorHandler(PlatformDbContext db)
    : AuthorizationHandler<PlatformOperatorRequirement>
{
    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context, PlatformOperatorRequirement requirement)
    {
        // JwtSecurityTokenHandler maps "sub" to NameIdentifier by default, so
        // accept either rather than depending on that mapping staying put.
        var raw = context.User.FindFirstValue(ClaimTypes.NameIdentifier)
               ?? context.User.FindFirstValue(JwtRegisteredClaimNames.Sub);

        if (!Guid.TryParse(raw, out var identityId)) return;

        var isOperator = await db.PlatformOperators
            .AsNoTracking()
            .AnyAsync(o => o.IdentityId == identityId && o.Status == PlatformOperatorStatus.Active);

        // The Identity itself must also still be usable — a suspended person
        // does not keep platform authority just because the grant is untouched.
        if (!isOperator) return;

        var identityActive = await db.Identities
            .AsNoTracking()
            .AnyAsync(i => i.Id == identityId && i.Status == IdentityStatus.Active);

        if (identityActive) context.Succeed(requirement);
    }
}
