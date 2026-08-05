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
public class LearningProductsController(LearningProductService products) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<LearningProductListResponse>> List(string slug, CancellationToken ct)
        => Run(await products.ListAsync(slug, Caller(), ct));

    [HttpPost]
    public async Task<ActionResult<LearningProductRow>> Create(
        string slug, [FromBody] SaveLearningProductRequest request, CancellationToken ct)
        => Run(await products.CreateAsync(slug, Caller(), request, ct));

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<LearningProductRow>> Update(
        string slug, Guid id, [FromBody] SaveLearningProductRequest request, CancellationToken ct)
        => Run(await products.UpdateAsync(slug, Caller(), id, request, ct));

    /// <summary>submit | return | publish | unpublish | archive (Section 16).</summary>
    [HttpPost("{id:guid}/{transition}")]
    public async Task<ActionResult<LearningProductRow>> Transition(
        string slug, Guid id, string transition, CancellationToken ct)
        => Run(await products.TransitionAsync(slug, Caller(), id, transition, ct));

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
