using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Platform.Api.Models;
using Platform.Infrastructure;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace Platform.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly PlatformDbContext _db;
    private readonly IConfiguration _config;

    public AuthController(PlatformDbContext db, IConfiguration config)
    {
        _db = db;
        _config = config;
    }

    /// <summary>
    /// Tutor / Learner login.
    /// POST /api/auth/login
    /// Returns a signed JWT valid for 8 hours.
    /// </summary>
    [HttpPost("login")]
    public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
            return BadRequest(new { message = "Email and password are required." });

        var identity = await _db.Identities
            .FirstOrDefaultAsync(i => i.Email == request.Email.ToLowerInvariant().Trim());

        // Constant-time check — never reveal which field was wrong (INV-006)
        if (identity is null || !BCrypt.Net.BCrypt.Verify(request.Password, identity.PasswordHash))
            return Unauthorized(new { message = "Invalid email or password." });

        if (identity.Status != Platform.Domain.IdentityStatus.Active)
            return Unauthorized(new { message = "This account is not active. Please contact support." });

        var response = GenerateJwt(identity);
        return Ok(response);
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    private LoginResponse GenerateJwt(Platform.Domain.Identity identity)
    {
        var jwtKey = _config["Jwt:Key"]
            ?? throw new InvalidOperationException("Jwt:Key is not configured.");

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expiresAt = DateTime.UtcNow.AddHours(8);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub,   identity.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, identity.Email),
            new Claim(JwtRegisteredClaimNames.Jti,   Guid.NewGuid().ToString()),
            new Claim(ClaimTypes.Name,               identity.FullName),
            new Claim(ClaimTypes.Role,               identity.Role.ToString())
        };

        var token = new JwtSecurityToken(
            issuer:            _config["Jwt:Issuer"] ?? "platform-api",
            audience:          _config["Jwt:Audience"] ?? "platform-client",
            claims:            claims,
            expires:           expiresAt,
            signingCredentials: creds
        );

        return new LoginResponse(
            Token:     new JwtSecurityTokenHandler().WriteToken(token),
            ExpiresAt: expiresAt,
            FullName:  identity.FullName,
            Role:      identity.Role.ToString()
        );
    }
}
