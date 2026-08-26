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

    /// <summary>Confirmed add-on/plan changes with a real before/after diff, newest first — the Billing "purchase history" popup.</summary>
    [HttpGet("history")]
    public async Task<ActionResult<IReadOnlyList<SubscriptionHistoryEntry>>> History(string slug, CancellationToken ct)
        => Run(await subscriptions.GetHistoryAsync(slug, Caller(), ct));

    [HttpPost("checkout")]
    public async Task<ActionResult<SubscriptionSummary>> Checkout(
        string slug, [FromBody] CheckoutRequest request, CancellationToken ct)
        => Run(await subscriptions.CheckoutAsync(slug, Caller(), request, ct));

    [HttpPost("cancel")]
    public async Task<ActionResult<SubscriptionSummary>> Cancel(
        string slug, [FromBody] CancelSubscriptionRequest? request, CancellationToken ct)
        => Run(await subscriptions.CancelAsync(slug, Caller(), request?.Reason, ct));

    /// <summary>Schedules a plan/pack change for the end of the current billing period (Subscription Management Architecture §14, §17-18) — the retention off-ramp alongside Cancel, not a Cancel prerequisite.</summary>
    [HttpPost("downgrade")]
    public async Task<ActionResult<SubscriptionSummary>> Downgrade(
        string slug, [FromBody] DowngradeRequest request, CancellationToken ct)
        => Run(await subscriptions.DowngradeAsync(slug, Caller(), request, ct));

    /// <summary>Requests a price-increasing plan/pack change and issues its prorated invoice — stays on the current plan until a Platform Operator confirms it (Subscription Management Architecture §15-16, Billing Architecture §25-27, Manual Commercial Activation §27a).</summary>
    [HttpPost("upgrade")]
    public async Task<ActionResult<SubscriptionSummary>> Upgrade(
        string slug, [FromBody] UpgradeRequest request, CancellationToken ct)
        => Run(await subscriptions.UpgradeAsync(slug, Caller(), request, ct));

    [HttpPost("cancel-pending-change")]
    public async Task<ActionResult<SubscriptionSummary>> CancelPendingChange(string slug, CancellationToken ct)
        => Run(await subscriptions.CancelPendingChangeAsync(slug, Caller(), ct));

    /// <summary>Withdraws an unconfirmed plan/pack change request before a Platform Operator ever acts on it.</summary>
    [HttpPost("cancel-requested-change")]
    public async Task<ActionResult<SubscriptionSummary>> CancelRequestedChange(string slug, CancellationToken ct)
        => Run(await subscriptions.CancelRequestedChangeAsync(slug, Caller(), ct));

    /// <summary>Undoes a Cancel while still within the paid period (SUB-004) — the "changed my mind" counterpart to Cancel itself.</summary>
    [HttpPost("reactivate")]
    public async Task<ActionResult<SubscriptionSummary>> Reactivate(string slug, CancellationToken ct)
        => Run(await subscriptions.ReactivateAsync(slug, Caller(), ct));

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
