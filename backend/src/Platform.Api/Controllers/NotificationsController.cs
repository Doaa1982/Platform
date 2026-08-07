using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Platform.Api.Models;
using Platform.Api.Services;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace Platform.Api.Controllers;

/// <summary>A member's own in-app inbox, across any role.</summary>
[ApiController]
[Route("api/workspaces/{slug}/notifications")]
[Authorize]
public class NotificationsController(NotificationService notifications) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<NotificationListResponse>> GetMine(string slug, CancellationToken ct)
        => Run(await notifications.GetMineAsync(slug, Caller(), ct));

    [HttpPost("{notificationId:guid}/read")]
    public async Task<ActionResult<bool>> MarkRead(string slug, Guid notificationId, CancellationToken ct)
        => Run(await notifications.MarkReadAsync(slug, Caller(), notificationId, ct));

    private ActionResult<T> Run<T>(ProvisioningResult<T> r) => r.Error switch
    {
        ProvisioningError.None      => Ok(r.Value),
        ProvisioningError.NotFound  => NotFound(new { message = r.Message }),
        ProvisioningError.Conflict  => Conflict(new { message = r.Message }),
        ProvisioningError.Forbidden => StatusCode(StatusCodes.Status403Forbidden, new { message = r.Message }),
        _                           => BadRequest(new { message = r.Message }),
    };

    private Guid Caller()
    {
        var raw = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);
        return Guid.TryParse(raw, out var id) ? id : Guid.Empty;
    }
}
