using Microsoft.IdentityModel.Tokens;
using Platform.Api.Models;
using Platform.Domain;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace Platform.Api.Services;

/// <summary>
/// Issues the platform's access tokens.
///
/// Shared by sign-in and invitation acceptance so both mint identical tokens —
/// accepting an invitation logs the new member straight in rather than bouncing
/// them to a login form for credentials they just chose.
///
/// Identity-level claims only. Roles are Workspace-scoped and resolved per
/// request (Membership Aggregate Design, INV-005), so no role ever rides in a
/// token; nor does platform-operator status, which is checked live so a revoked
/// grant takes effect at once.
/// </summary>
public class TokenService(IConfiguration config)
{
    private static readonly TimeSpan Lifetime = TimeSpan.FromHours(8);

    public LoginResponse Issue(Identity identity)
    {
        var jwtKey = config["Jwt:Key"]
            ?? throw new InvalidOperationException("Jwt:Key is not configured.");

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expiresAt = DateTime.UtcNow.Add(Lifetime);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub,   identity.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, identity.Email),
            new Claim(JwtRegisteredClaimNames.Jti,   Guid.NewGuid().ToString()),
            new Claim(ClaimTypes.Name,               identity.FullName)
        };

        var token = new JwtSecurityToken(
            issuer:             config["Jwt:Issuer"]   ?? "platform-api",
            audience:           config["Jwt:Audience"] ?? "platform-client",
            claims:             claims,
            expires:            expiresAt,
            signingCredentials: creds
        );

        return new LoginResponse(
            Token:     new JwtSecurityTokenHandler().WriteToken(token),
            ExpiresAt: expiresAt,
            FullName:  identity.FullName
        );
    }
}
