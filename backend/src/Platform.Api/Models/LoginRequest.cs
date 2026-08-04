namespace Platform.Api.Models;

/// <summary>Request body for POST /api/auth/login</summary>
public record LoginRequest(string Email, string Password);
