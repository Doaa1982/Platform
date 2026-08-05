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
public class InvitationsController(
    ProvisioningService provisioning,
    SignupRequestService signups,
    TokenService tokens,
    ILogger<InvitationsController> logger) : ControllerBase
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
        var workspaceId = await provisioning.PeekWorkspaceIdAsync(token, ct);

        var result = await provisioning.AcceptAsync(token, request, tokens, ct);
        if (!result.Ok) return Problem(result);

        // The acceptor now holds a real Identity, so any Signup Status Link that
        // stood in for one is retired.
        //
        // Genuinely best-effort: acceptance has already committed by this point.
        // Letting a failure here surface would return 500 for a sign-up that
        // actually succeeded — and the retry would then hit "already used",
        // stranding someone who is in fact a member. A stale status link is a
        // far smaller problem than that, so it is logged and swallowed.
        if (workspaceId is not null)
        {
            try
            {
                await signups.RevokeStatusLinkForWorkspaceAsync(workspaceId.Value, ct);
            }
            catch (Exception ex)
            {
                logger.LogError(ex,
                    "Invitation accepted for workspace {WorkspaceId}, but the signup status link could not be revoked.",
                    workspaceId);
            }
        }

        return Ok(result.Value);
    }

    private ObjectResult Problem<T>(ProvisioningResult<T> result) => result.Error switch
    {
        ProvisioningError.NotFound  => NotFound(new { message = result.Message }),
        ProvisioningError.Conflict  => Conflict(new { message = result.Message }),
        ProvisioningError.Forbidden => StatusCode(StatusCodes.Status403Forbidden, new { message = result.Message }),
        _                           => BadRequest(new { message = result.Message }),
    };
}
