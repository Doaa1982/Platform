using Microsoft.AspNetCore.Mvc;
using Platform.Api.Models;
using Platform.Api.Services;

namespace Platform.Api.Controllers;

/// <summary>
/// The invitee's side of the Invitation cycle.
///
/// Deliberately anonymous. An invitation link must work for someone who has no
/// account yet — that is its whole purpose — so the token is the credential
/// here, and Workspace Resolution happens before any authentication
/// (IdentityAndWorkspaceAccess, "Workspace Resolution").
/// </summary>
[ApiController]
[Route("api/invitations")]
public class InvitationsController(ProvisioningService provisioning, TokenService tokens) : ControllerBase
{
    /// <summary>
    /// GET /api/invitations/{token}
    /// What the invitee sees before deciding: which Workspace, which role, and
    /// whether they already have an account. Nothing else about the Workspace.
    /// </summary>
    [HttpGet("{token}")]
    public async Task<ActionResult<InvitationPreview>> Preview(string token, CancellationToken ct)
    {
        var result = await provisioning.PreviewAsync(token, ct);
        return result.Ok ? Ok(result.Value) : Problem(result);
    }

    /// <summary>
    /// POST /api/invitations/{token}/accept
    /// Runs Identity Resolution, creates and activates the Membership, and for
    /// an Owner invitation transfers Workspace ownership. Returns a token so
    /// the new member lands signed in rather than at a login form.
    /// </summary>
    [HttpPost("{token}/accept")]
    public async Task<ActionResult<LoginResponse>> Accept(
        string token, [FromBody] AcceptInvitationRequest request, CancellationToken ct)
    {
        var result = await provisioning.AcceptAsync(token, request, tokens, ct);
        return result.Ok ? Ok(result.Value) : Problem(result);
    }

    private ObjectResult Problem<T>(ProvisioningResult<T> result) => result.Error switch
    {
        ProvisioningError.NotFound  => NotFound(new { message = result.Message }),
        ProvisioningError.Conflict  => Conflict(new { message = result.Message }),
        ProvisioningError.Forbidden => StatusCode(StatusCodes.Status403Forbidden, new { message = result.Message }),
        _                           => BadRequest(new { message = result.Message }),
    };
}
