namespace Platform.Api.Models;

/// <summary>
/// What an invitee sees before accepting — resolved from the token alone,
/// before any authentication.
///
/// Deliberately thin. Anyone holding the link sees this, so it carries only
/// what is needed to decide whether to accept: which Workspace, which role,
/// and whether an account already exists for the invited email. It never
/// reveals anything else about the Workspace or its members.
/// </summary>
public record InvitationPreview(
    string WorkspaceName,
    string Email,
    string IntendedRole,
    DateTime ExpiresAt,
    /// <summary>True when the invited email already owns an Identity, so the
    /// accept form asks for their existing password rather than a new one.</summary>
    bool AccountExists);

/// <summary>
/// Accepting an invitation.
///
/// FullName is required only when no Identity exists for the invited email —
/// that is the Identity Resolution branch which creates one. Password is
/// required either way: a new one to set, or the existing one to prove the
/// invitee is that person rather than merely holding the link.
/// </summary>
public record AcceptInvitationRequest(string? FullName, string Password);
