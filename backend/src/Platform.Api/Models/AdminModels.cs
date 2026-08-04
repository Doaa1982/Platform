namespace Platform.Api.Models;

/// <summary>Request to provision a Workspace for a subscribed Tutor.</summary>
public record ProvisionWorkspaceRequest(
    string Name,
    string Slug,
    string OwnerEmail,
    string? Description);

/// <summary>
/// One row of the Platform Administrator's provisioning view.
///
/// Composed from Workspace + Invitation + Membership rather than stored
/// (Platform Administrator Business Analysis §9). Whether it eventually earns
/// its own tracked entity is deferred there.
/// </summary>
public record ProvisioningRow(
    Guid WorkspaceId,
    string Name,
    string Slug,
    string WorkspaceStatus,
    /// <summary>Awaiting Invitation | Invitation Sent | Invitation Expired | Provisioned</summary>
    string ProvisioningStatus,
    bool HasOwner,
    int MemberCount,
    InvitationSummary? Invitation);

public record InvitationSummary(
    Guid Id,
    string Email,
    string IntendedRole,
    string Status,
    DateTime IssuedAt,
    DateTime ExpiresAt,
    bool IsOpen);

/// <summary>
/// Returned when an Invitation is issued or resent.
///
/// Carries the invitation link, which contains the raw token — the only moment
/// it exists in readable form (Invitation Business Analysis §8). In Version 1
/// there is no email delivery, so the admin copies this link and sends it
/// themselves (BA-005 leaves delivery ownership open).
/// </summary>
public record InvitationIssuedResponse(
    Guid InvitationId,
    string Email,
    string IntendedRole,
    DateTime ExpiresAt,
    string InvitationLink);

/// <summary>Platform-level status change on a Workspace or Identity.</summary>
public record AdminStatusChangeRequest(string Reason);
