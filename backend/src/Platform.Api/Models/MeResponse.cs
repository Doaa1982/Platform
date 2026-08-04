namespace Platform.Api.Models;

/// <summary>
/// Response body for GET /api/me — the authenticated Identity plus every Workspace
/// it can reach, with the roles held in each.
///
/// This is what drives role-based navigation in the single web app: the client
/// renders tutor or learner surfaces from the roles of the *selected* Workspace,
/// not from any global property of the person.
/// </summary>
public record MeResponse(
    Guid IdentityId,
    string Email,
    string FullName,
    IReadOnlyList<WorkspaceAccessResponse> Workspaces);

/// <summary>One Workspace the Identity belongs to, and the roles held there.</summary>
public record WorkspaceAccessResponse(
    Guid WorkspaceId,
    string Name,
    string Slug,
    string MembershipStatus,
    IReadOnlyList<string> Roles);
