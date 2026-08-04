namespace Platform.Api.Models;

/// <summary>Response body for a successful POST /api/auth/login</summary>
public record LoginResponse(string Token, DateTime ExpiresAt, string FullName, string Role);
