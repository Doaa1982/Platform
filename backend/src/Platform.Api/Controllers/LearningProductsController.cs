using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Platform.Api.Models;
using Platform.Api.Services;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace Platform.Api.Controllers;

/// <summary>
/// Learning Products inside one Workspace.
///
/// Authority is Workspace-scoped and resolved per request from the caller's own
/// Membership. Teachers may author, not just owners — it is the job the role
/// exists for.
/// </summary>
[ApiController]
[Route("api/workspaces/{slug}/products")]
[Authorize]
public class LearningProductsController(LearningProductService products, WorkspaceMemberService members) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<LearningProductListResponse>> List(string slug, CancellationToken ct)
        => Run(await products.ListAsync(slug, Caller(), ct));

    [HttpPost]
    public async Task<ActionResult<LearningProductRow>> Create(
        string slug, [FromBody] SaveLearningProductRequest request, CancellationToken ct)
        => Run(await products.CreateAsync(slug, Caller(), request, ct));

    /// <summary>Drafts a listing description from whatever the tutor has typed so far — no product needs to exist yet.</summary>
    [HttpPost("ai-suggest-description")]
    public async Task<ActionResult<AiSuggestDescriptionResponse>> SuggestDescription(
        string slug, [FromBody] AiSuggestDescriptionRequest request, CancellationToken ct)
        => Run(await products.SuggestDescriptionAsync(slug, Caller(), request, ct));

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<LearningProductRow>> Update(
        string slug, Guid id, [FromBody] SaveLearningProductRequest request, CancellationToken ct)
        => Run(await products.UpdateAsync(slug, Caller(), id, request, ct));

    /// <summary>POST .../products/{id}/cover-image — attach (or, with a null id, clear) an uploaded cover photo.</summary>
    [HttpPost("{id:guid}/cover-image")]
    public async Task<ActionResult<LearningProductRow>> AttachCoverImage(
        string slug, Guid id, [FromBody] AttachCoverImageRequest request, CancellationToken ct)
        => Run(await products.AttachCoverImageAsync(slug, Caller(), id, request.LearningAssetId, ct));

    /// <summary>submit | return | publish | unpublish | archive (Section 16).</summary>
    [HttpPost("{id:guid}/{transition}")]
    public async Task<ActionResult<LearningProductRow>> Transition(
        string slug, Guid id, string transition, CancellationToken ct)
        => Run(await products.TransitionAsync(slug, Caller(), id, transition, ct));

    /// <summary>
    /// GET .../products/{id}/roster — who is enrolled in this course, and who
    /// has an outstanding invitation naming it (§12.3 course-management view).
    /// </summary>
    [HttpGet("{id:guid}/roster")]
    public async Task<ActionResult<ProductRosterResponse>> Roster(string slug, Guid id, CancellationToken ct)
        => Run(await members.GetProductRosterAsync(slug, Caller(), id, ct));

    /// <summary>
    /// POST .../products/{id}/enrollments/{membershipId}/unenroll — removes
    /// the Enrollment only; the member's Workspace Membership is untouched.
    /// </summary>
    [HttpPost("{id:guid}/enrollments/{membershipId:guid}/unenroll")]
    public async Task<IActionResult> Unenroll(string slug, Guid id, Guid membershipId, CancellationToken ct)
        => Run(await members.UnenrollMemberAsync(slug, Caller(), id, membershipId, ct));

    private ActionResult<T> Run<T>(ProvisioningResult<T> result) => result.Error switch
    {
        ProvisioningError.None      => Ok(result.Value),
        ProvisioningError.NotFound  => NotFound(new { message = result.Message }),
        ProvisioningError.Conflict  => Conflict(new { message = result.Message }),
        ProvisioningError.Forbidden => StatusCode(StatusCodes.Status403Forbidden, new { message = result.Message }),
        ProvisioningError.CreditsExhausted => StatusCode(StatusCodes.Status402PaymentRequired,
            new { message = result.Message, code = "credits_exhausted", requiredCredits = result.RequiredCredits, remainingCredits = result.RemainingCredits }),
        _                           => BadRequest(new { message = result.Message }),
    };

    private IActionResult Run(ProvisioningResult<string> result) => result.Error switch
    {
        ProvisioningError.None      => Ok(new { status = result.Value }),
        ProvisioningError.NotFound  => NotFound(new { message = result.Message }),
        ProvisioningError.Conflict  => Conflict(new { message = result.Message }),
        ProvisioningError.Forbidden => StatusCode(StatusCodes.Status403Forbidden, new { message = result.Message }),
        ProvisioningError.CreditsExhausted => StatusCode(StatusCodes.Status402PaymentRequired,
            new { message = result.Message, code = "credits_exhausted", requiredCredits = result.RequiredCredits, remainingCredits = result.RemainingCredits }),
        _                           => BadRequest(new { message = result.Message }),
    };

    private Guid Caller()
    {
        var raw = User.FindFirstValue(ClaimTypes.NameIdentifier)
               ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);
        return Guid.TryParse(raw, out var id) ? id : Guid.Empty;
    }
}
