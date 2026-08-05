using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Platform.Api.Models;
using Platform.Api.Services;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace Platform.Api.Controllers;

/// <summary>
/// The Workspace Owner's setup surface — Workspace Setup Business Analysis §7.
///
/// Every route returns the full setup state, so a client never has to re-derive
/// what changed or which transition is available next after acting.
///
/// Platform-level Suspend/Reinstate/Archive deliberately live on AdminController
/// instead: an Owner configures their Workspace, they do not suspend it (§5).
/// </summary>
[ApiController]
[Route("api/workspaces/{slug}/setup")]
[Authorize]
public class WorkspaceSetupController(WorkspaceSetupService setup) : ControllerBase
{
    /// <summary>GET — current identity, status, completeness and the next step.</summary>
    [HttpGet]
    public async Task<ActionResult<WorkspaceSetupResponse>> Get(string slug, CancellationToken ct)
        => Run(await setup.GetAsync(slug, Caller(), ct));

    /// <summary>PUT /identity — amend name, public identifier and description.</summary>
    [HttpPut("identity")]
    public async Task<ActionResult<WorkspaceSetupResponse>> UpdateIdentity(
        string slug, [FromBody] UpdateWorkspaceIdentityRequest request, CancellationToken ct)
        => Run(await setup.UpdateIdentityAsync(slug, Caller(), request, ct));

    /// <summary>
    /// PUT /join-requests — open or close the Workspace to unsolicited requests.
    /// Off by default (Join Request Business Analysis, BA-005).
    /// </summary>
    [HttpPut("join-requests")]
    public async Task<ActionResult<WorkspaceSetupResponse>> SetAcceptsJoinRequests(
        string slug, [FromBody] SetJoinRequestsRequest request, CancellationToken ct)
        => Run(await setup.SetAcceptsJoinRequestsAsync(slug, Caller(), request.Accepts, ct));

    /// <summary>Created → Configuring.</summary>
    [HttpPost("begin-configuration")]
    public async Task<ActionResult<WorkspaceSetupResponse>> BeginConfiguration(string slug, CancellationToken ct)
        => Run(await setup.BeginConfigurationAsync(slug, Caller(), ct));

    /// <summary>Configuring → Private. Workable inside, not publicly discoverable.</summary>
    [HttpPost("make-private")]
    public async Task<ActionResult<WorkspaceSetupResponse>> MakePrivate(string slug, CancellationToken ct)
        => Run(await setup.MakePrivateAsync(slug, Caller(), ct));

    /// <summary>Private → Published. Enforces INV-007.</summary>
    [HttpPost("publish")]
    public async Task<ActionResult<WorkspaceSetupResponse>> Publish(string slug, CancellationToken ct)
        => Run(await setup.PublishAsync(slug, Caller(), ct));

    /// <summary>
    /// Published → Active. Implements Workspace Setup Business Analysis BA-002's
    /// recommendation (Owner-declared) while that decision is still open.
    /// </summary>
    [HttpPost("activate")]
    public async Task<ActionResult<WorkspaceSetupResponse>> Activate(string slug, CancellationToken ct)
        => Run(await setup.ActivateAsync(slug, Caller(), ct));

    private ActionResult<WorkspaceSetupResponse> Run(ProvisioningResult<WorkspaceSetupResponse> result)
        => result.Error switch
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
