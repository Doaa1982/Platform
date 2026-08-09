using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Platform.Api.Authorization;
using Platform.Api.Models;
using Platform.Api.Services;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace Platform.Api.Controllers;

/// <summary>
/// Entitlement Overrides — Licensing &amp; Entitlements Architecture §16.
/// Platform-Operator-only, same policy AdminController checks: a support
/// exception is a back-office action on a Workspace, not something the
/// Workspace grants itself.
/// </summary>
[ApiController]
[Route("api/workspaces/{slug}/entitlement-overrides")]
[Authorize(Policy = PlatformOperatorRequirement.PolicyName)]
public class EntitlementOverridesController(EntitlementOverrideService overrides) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<EntitlementOverrideRow>>> List(string slug, CancellationToken ct)
        => Run(await overrides.ListAsync(slug, ct));

    [HttpPost]
    public async Task<ActionResult<EntitlementOverrideRow>> Create(
        string slug, [FromBody] EntitlementOverrideRequest request, CancellationToken ct)
        => Run(await overrides.CreateAsync(slug, Caller(), request, ct));

    [HttpPost("{id:guid}/revoke")]
    public async Task<ActionResult<EntitlementOverrideRow>> Revoke(string slug, Guid id, CancellationToken ct)
        => Run(await overrides.RevokeAsync(slug, id, ct));

    private ActionResult<T> Run<T>(ProvisioningResult<T> result) => result.Error switch
    {
        ProvisioningError.None      => Ok(result.Value),
        ProvisioningError.NotFound  => NotFound(new { message = result.Message }),
        ProvisioningError.Conflict  => Conflict(new { message = result.Message }),
        ProvisioningError.Forbidden => StatusCode(StatusCodes.Status403Forbidden, new { message = result.Message }),
        _                           => BadRequest(new { message = result.Message }),
    };

    private Guid Caller()
    {
        var raw = User.FindFirstValue(ClaimTypes.NameIdentifier)
               ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);
        return Guid.TryParse(raw, out var id) ? id : Guid.Empty;
    }
}
