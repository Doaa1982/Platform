using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Platform.Api.Models;
using Platform.Api.Services;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace Platform.Api.Controllers;

/// <summary>
/// The tutor-facing gradebook — every Assessment across every product in the
/// workspace, and per-assessment submission/item detail. Distinct from
/// AssessmentsController (that one edits one lesson's questions); this one
/// only reads, workspace-wide, what submissions have already written.
/// </summary>
[ApiController]
[Route("api/workspaces/{slug}/assessments")]
[Authorize]
public class AssessmentOverviewController(AssessmentService assessments) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<AssessmentOverviewResponse>> GetOverview(string slug, CancellationToken ct)
        => Run(await assessments.GetOverviewAsync(slug, Caller(), ct));

    [HttpGet("{assessmentId:guid}")]
    public async Task<ActionResult<AssessmentDetailResponse>> GetDetail(string slug, Guid assessmentId, CancellationToken ct)
        => Run(await assessments.GetDetailAsync(slug, Caller(), assessmentId, ct));

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
