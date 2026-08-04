using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Platform.Api.Models;
using Platform.Api.Services;
using Platform.Infrastructure;

namespace Platform.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController(PlatformDbContext db, TokenService tokens) : ControllerBase
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
}
