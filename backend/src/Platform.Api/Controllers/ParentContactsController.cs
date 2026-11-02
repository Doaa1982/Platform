using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Platform.Api.Models;
using Platform.Api.Services;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace Platform.Api.Controllers;

/// <summary>
/// Parent contacts (Parent Progress Reports Business Analysis). The tutor's routes manage any
/// learner's parents in this workspace; the learner's own routes ("me") only ever reach their own.
/// </summary>
[ApiController]
[Route("api/workspaces/{slug}")]
[Authorize]
public class ParentContactsController(ParentContactService parents) : ControllerBase
{
    // ── Tutor ────────────────────────────────────────────────────────────────

    /// <summary>GET — every parent contact in this workspace (Members screen).</summary>
    [HttpGet("parent-contacts")]
    public async Task<ActionResult<WorkspaceParentContactsResponse>> List(string slug, CancellationToken ct)
        => Run(await parents.ListForWorkspaceAsync(slug, Caller(), ct));

    [HttpPost("members/{membershipId:guid}/parent-contacts")]
    public async Task<ActionResult<ParentContactRow>> Add(string slug, Guid membershipId, [FromBody] ParentDetails request, CancellationToken ct)
        => Run(await parents.AddForLearnerAsync(slug, Caller(), membershipId, request, ct));

    [HttpPut("parent-contacts/{contactId:guid}")]
    public async Task<ActionResult<ParentContactRow>> Update(string slug, Guid contactId, [FromBody] ParentDetails request, CancellationToken ct)
        => Run(await parents.UpdateAsync(slug, Caller(), contactId, request, ct));

    /// <summary>POST /resend — a new confirmation email (after an unsubscribe, or when the parent never confirmed).</summary>
    [HttpPost("parent-contacts/{contactId:guid}/resend")]
    public async Task<ActionResult<ParentContactRow>> Resend(string slug, Guid contactId, CancellationToken ct)
        => Run(await parents.ResendAsync(slug, Caller(), contactId, ct));

    [HttpDelete("parent-contacts/{contactId:guid}")]
    public async Task<IActionResult> Remove(string slug, Guid contactId, CancellationToken ct)
        => RunStatus(await parents.RemoveAsync(slug, Caller(), contactId, ct));

    /// <summary>
    /// POST /parent-contacts/import/preview?mode=invite|existing — reads an uploaded .csv/.xlsx and
    /// reports each row's problems. Saves nothing.
    /// </summary>
    [HttpPost("parent-contacts/import/preview")]
    [RequestSizeLimit(2_000_000)]
    public async Task<ActionResult<ParentImportPreviewResponse>> PreviewImport(
        string slug, IFormFile file, [FromQuery] string mode, CancellationToken ct)
    {
        await using var stream = file.OpenReadStream();
        return Run(await parents.PreviewImportAsync(slug, Caller(), mode, stream, file.FileName, ct));
    }

    /// <summary>POST /parent-contacts/import — "Import parents" for existing students: saves the rows kept after the preview.</summary>
    [HttpPost("parent-contacts/import")]
    public async Task<ActionResult<ParentImportResult>> CommitImport(string slug, [FromBody] ParentImportCommitRequest request, CancellationToken ct)
        => Run(await parents.CommitImportAsync(slug, Caller(), request, ct));

    // ── Learner ──────────────────────────────────────────────────────────────

    [HttpGet("me/parent-contacts")]
    public async Task<ActionResult<MyParentContactsResponse>> ListMine(string slug, CancellationToken ct)
        => Run(await parents.ListMineAsync(slug, Caller(), ct));

    [HttpPost("me/parent-contacts")]
    public async Task<ActionResult<ParentContactRow>> AddMine(string slug, [FromBody] ParentDetails request, CancellationToken ct)
        => Run(await parents.AddMineAsync(slug, Caller(), request, ct));

    [HttpDelete("me/parent-contacts/{contactId:guid}")]
    public async Task<IActionResult> RemoveMine(string slug, Guid contactId, CancellationToken ct)
        => RunStatus(await parents.RemoveMineAsync(slug, Caller(), contactId, ct));

    // ── Helpers ──────────────────────────────────────────────────────────────

    private ActionResult<T> Run<T>(ProvisioningResult<T> result) => result.Error switch
    {
        ProvisioningError.None      => Ok(result.Value),
        ProvisioningError.NotFound  => NotFound(new { message = result.Message }),
        ProvisioningError.Conflict  => Conflict(new { message = result.Message }),
        ProvisioningError.Forbidden => StatusCode(StatusCodes.Status403Forbidden, new { message = result.Message }),
        _                           => BadRequest(new { message = result.Message }),
    };

    private IActionResult RunStatus(ProvisioningResult<string> result) => result.Error switch
    {
        ProvisioningError.None      => Ok(new { status = result.Value }),
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

/// <summary>
/// The links in a parent's emails. No login — the signed token is the whole authorisation, and it
/// only ever does the one thing it was issued for. Rate limited like the other public endpoints.
/// </summary>
[ApiController]
[Route("api/parent-links")]
[AllowAnonymous]
public class ParentLinksController(ParentContactService parents) : ControllerBase
{
    /// <summary>POST /confirm — "Yes, send me updates".</summary>
    [HttpPost("confirm")]
    [EnableRateLimiting(RateLimitPolicies.PublicRead)]
    public async Task<ActionResult<ParentLinkResult>> Confirm([FromBody] ParentLinkRequest request, CancellationToken ct)
        => Ok(await parents.ConfirmAsync(request.Token, ct));

    /// <summary>POST /unsubscribe — one click, no questions.</summary>
    [HttpPost("unsubscribe")]
    [EnableRateLimiting(RateLimitPolicies.PublicRead)]
    public async Task<ActionResult<ParentLinkResult>> Unsubscribe([FromBody] ParentLinkRequest request, CancellationToken ct)
        => Ok(await parents.UnsubscribeAsync(request.Token, ct));
}
