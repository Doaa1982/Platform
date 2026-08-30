using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Platform.Api.Models;
using Platform.Api.Services;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace Platform.Api.Controllers;

/// <summary>
/// A Workspace's own AI-credit top-up purchases — request a tier, see the
/// resulting history. Authority is Workspace-scoped and resolved per request
/// from the caller's own Membership, same pattern as SubscriptionController.
/// </summary>
[ApiController]
[Route("api/workspaces/{slug}/credit-purchases")]
[Authorize]
public class CreditPurchaseController(CreditPurchaseService purchases) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CreditPurchaseOrderRow>>> List(string slug, CancellationToken ct)
        => Run(await purchases.ListForWorkspaceAsync(slug, Caller(), ct));

    [HttpPost]
    public async Task<ActionResult<CreditPurchaseOrderRow>> Request(
        string slug, [FromBody] RequestCreditPurchaseRequest request, CancellationToken ct)
        => Run(await purchases.RequestPurchaseAsync(slug, Caller(), request.CreditPackCode, ct));

    [HttpPost("{id:guid}/cancel")]
    public async Task<ActionResult<CreditPurchaseOrderRow>> Cancel(string slug, Guid id, CancellationToken ct)
        => Run(await purchases.CancelAsync(slug, Caller(), id, ct));

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
