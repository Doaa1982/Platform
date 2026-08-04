namespace Platform.Api.Models;

/// <summary>
/// Response body for a successful POST /api/auth/login.
///
/// Carries no role: roles are Workspace-scoped and live on Membership, so they are
/// resolved per request against a named Workspace rather than baked into the token.
/// Call GET /api/me to discover which Workspaces this Identity belongs to and with
/// which roles.
/// </summary>
public record LoginResponse(string Token, DateTime ExpiresAt, string FullName);
