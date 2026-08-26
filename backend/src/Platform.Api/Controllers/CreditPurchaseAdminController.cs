using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Platform.Api.Authorization;
using Platform.Api.Models;
using Platform.Api.Services;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace Platform.Api.Controllers;

/// <summary>
/// Platform-Operator side of AI-credit top-up purchases — the Manual
/// Commercial Activation confirmation step. Kept separate from AdminController,
/// same reasoning as EntitlementOverridesController/CatalogAdminController.
/// </summary>
[ApiController]
[Route("api/admin/credit-purchases")]
[Authorize(Policy = PlatformOperatorRequirement.PolicyName)]
public class CreditPurchaseAdminController(CreditPurchaseService purchases) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CreditPurchaseOrderAdminRow>>> ListPending(CancellationToken ct)
        => Ok(await purchases.ListPendingAsync(ct));

    [HttpPost("{id:guid}/mark-paid")]
    public async Task<ActionResult<CreditPurchaseOrderAdminRow>> MarkPaid(
        Guid id, [FromBody] ResolveCreditPurchaseRequest request, CancellationToken ct)
        => Run(await purchases.MarkPaidAsync(id, Caller(), request.ReferenceNote, ct));

    [HttpPost("{id:guid}/void")]
    public async Task<ActionResult<CreditPurchaseOrderAdminRow>> Void(
        Guid id, [FromBody] ResolveCreditPurchaseRequest request, CancellationToken ct)
        => Run(await purchases.VoidAsync(id, Caller(), request.ReferenceNote, ct));

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
