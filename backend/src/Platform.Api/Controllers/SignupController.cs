using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Platform.Api.Models;
using Platform.Api.Services;

namespace Platform.Api.Controllers;

/// <summary>
/// The prospective tutor's side of signup — Platform Administrator Business
/// Analysis §7.1.
///
/// Entirely anonymous, necessarily: an applicant has no Identity at this stage
/// and gets one only much later, when they accept the invitation to their
/// provisioned Workspace. They check back via their Signup Status Link, not by
/// logging in (BA-008).
///
/// Rate limited for the same reason the join endpoint is: it is reachable by
/// anyone and writes a row.
/// </summary>
[ApiController]
[Route("api/signup-requests")]
public class SignupController(SignupRequestService signups) : ControllerBase
{
    /// <summary>POST /api/signup-requests — apply to become a tutor.</summary>
    [HttpPost]
    [EnableRateLimiting(RateLimitPolicies.JoinRequests)]
    public async Task<ActionResult<SignupSubmittedResponse>> Submit(
        [FromBody] SubmitSignupRequest request, CancellationToken ct)
        => Run(await signups.SubmitAsync(request, ct));

    /// <summary>GET /api/signup-requests/status/{token} — the Signup Status Link.</summary>
    [HttpGet("status/{token}")]
    [EnableRateLimiting(RateLimitPolicies.PublicRead)]
    public async Task<ActionResult<SignupStatusResponse>> Status(string token, CancellationToken ct)
        => Run(await signups.GetStatusAsync(token, ct));

    /// <summary>
    /// POST /api/signup-requests/status/{token}/payment — record a payment outcome.
    ///
    /// The processor call itself is the one genuinely external step (BA-006);
    /// this records what it said. Failure is not rejection — the applicant may
    /// retry while the window is open.
    /// </summary>
    [HttpPost("status/{token}/payment")]
    [EnableRateLimiting(RateLimitPolicies.JoinRequests)]
    public async Task<ActionResult<SignupStatusResponse>> Payment(
        string token, [FromQuery] bool succeeded = true, CancellationToken ct = default)
        => Run(await signups.RecordPaymentAsync(token, succeeded, ct));

    private ActionResult<T> Run<T>(ProvisioningResult<T> result) => result.Error switch
    {
        ProvisioningError.None      => Ok(result.Value),
        ProvisioningError.NotFound  => NotFound(new { message = result.Message }),
        ProvisioningError.Conflict  => Conflict(new { message = result.Message }),
        ProvisioningError.Forbidden => StatusCode(StatusCodes.Status403Forbidden, new { message = result.Message }),
        _                           => BadRequest(new { message = result.Message }),
    };
}
