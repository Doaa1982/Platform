namespace Platform.Api.Models;

/// <summary>One person's standing inside a Workspace, as the tutor sees it.</summary>
public record WorkspaceMemberRow(
    Guid MembershipId,
    Guid IdentityId,
    string Email,
    string FullName,
    string Status,
    IReadOnlyList<string> Roles,
    bool IsOwner,
    DateTime CreatedAt,
    DateTime? LastActiveAt);

/// <summary>A pending or recently closed invitation into this Workspace.</summary>
public record WorkspaceInvitationRow(
    Guid Id,
    string Email,
    string IntendedRole,
    string Status,
    DateTime IssuedAt,
    DateTime ExpiresAt,
    bool IsOpen);

/// <summary>Everything the members screen needs in one call.</summary>
public record WorkspaceMembersResponse(
    string WorkspaceName,
    string WorkspaceSlug,
    /// <summary>Whether the caller may change anything here, or only look.</summary>
    bool CanManage,
    IReadOnlyList<WorkspaceMemberRow> Members,
    IReadOnlyList<WorkspaceInvitationRow> Invitations);

/// <summary>Invite someone into an existing Workspace.</summary>
public record InviteMemberRequest(string Email, string Role);

/// <summary>Assign or remove one Workspace role on a Membership.</summary>
public record MemberRoleRequest(string Role);
