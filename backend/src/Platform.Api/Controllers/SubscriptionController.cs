using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Platform.Api.Models;
using Platform.Api.Services;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace Platform.Api.Controllers;

/// <summary>
/// A Workspace's own commercial subscription — checkout, cancel, and the
/// current state (subscription + invoice + license + resolved entitlements).
/// Authority is Workspace-scoped and resolved per request from the caller's
/// own Membership, same pattern as LearningProductsController.
/// </summary>
[ApiController]
[Route("api/workspaces/{slug}/subscription")]
[Authorize]
public class SubscriptionController(CommercialSubscriptionService subscriptions) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<SubscriptionSummary>> Get(string slug, CancellationToken ct)
        => Run(await subscriptions.GetCurrentAsync(slug, Caller(), ct));

    [HttpPost("checkout")]
    public async Task<ActionResult<SubscriptionSummary>> Checkout(
        string slug, [FromBody] CheckoutRequest request, CancellationToken ct)
        => Run(await subscriptions.CheckoutAsync(slug, Caller(), request, ct));

    [HttpPost("cancel")]
    public async Task<ActionResult<SubscriptionSummary>> Cancel(string slug, CancellationToken ct)
        => Run(await subscriptions.CancelAsync(slug, Caller(), ct));

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
