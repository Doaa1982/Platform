using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Platform.Api.Models;
using Platform.Api.Services;
using Platform.Infrastructure;

namespace Platform.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController(PlatformDbContext db, TokenService tokens, PasswordResetService passwordResets)
    : ControllerBase
{
    /// <summary>
    /// Sign in.
    /// POST /api/auth/login
    /// Returns a signed JWT valid for 8 hours, carrying identity-level claims
    /// only — roles are Workspace-scoped and resolved per request.
    /// </summary>
    [HttpPost("login")]
    public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
            return BadRequest(new { message = "Email and password are required." });

        var identity = await db.Identities
            .FirstOrDefaultAsync(i => i.Email == request.Email.ToLowerInvariant().Trim());

        // Never reveal which field was wrong (INV-006)
        if (identity is null || !BCrypt.Net.BCrypt.Verify(request.Password, identity.PasswordHash))
            return Unauthorized(new { message = "Invalid email or password." });

        if (identity.Status != Platform.Domain.IdentityStatus.Active)
            return Unauthorized(new { message = "This account is not active. Please contact support." });

        return Ok(tokens.Issue(identity));
    }

    /* ── Account recovery ─────────────────────────────────────────────────
       A Tutor or Student who has forgotten their password needs a way back
       in that doesn't involve a Platform Operator. All three endpoints below
       are anonymous by necessity — the whole point is to work for someone
       who currently cannot authenticate.
       ------------------------------------------------------------------- */

    /// <summary>
    /// POST /api/auth/forgot-password
    /// Always answers the same way, whether or not the email belongs to an
    /// account (PasswordResetService.RequestAsync — INV-006 applied to this
    /// form). Rate limited: this is the one endpoint a stranger can hit
    /// repeatedly to spam an inbox.
    /// </summary>
    [HttpPost("forgot-password")]
    [EnableRateLimiting(RateLimitPolicies.PasswordReset)]
    public async Task<ActionResult<ForgotPasswordResponse>> ForgotPassword(
        [FromBody] ForgotPasswordRequest request, CancellationToken ct)
        => Ok(await passwordResets.RequestAsync(request, ct));

    /// <summary>
    /// GET /api/auth/reset-password/{token}
    /// What the link resolves to before the visitor has chosen a new password.
    /// </summary>
    [HttpGet("reset-password/{token}")]
    [EnableRateLimiting(RateLimitPolicies.PublicRead)]
    public async Task<ActionResult<PasswordResetPreview>> PreviewResetPassword(string token, CancellationToken ct)
    {
        var result = await passwordResets.PreviewAsync(token, ct);
        return result.Ok ? Ok(result.Value) : Problem(result);
    }

    /// <summary>
    /// POST /api/auth/reset-password/{token}
    /// Spends the link and signs the caller straight in, rather than bouncing
    /// them to a login form for the password they just chose.
    /// </summary>
    [HttpPost("reset-password/{token}")]
    [EnableRateLimiting(RateLimitPolicies.PasswordReset)]
    public async Task<ActionResult<LoginResponse>> ResetPassword(
        string token, [FromBody] ResetPasswordRequest request, CancellationToken ct)
    {
        var result = await passwordResets.ResetAsync(token, request, tokens, ct);
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
