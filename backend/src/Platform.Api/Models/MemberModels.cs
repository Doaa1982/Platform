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
    bool IsOpen,
    /// <summary>The Invitation Batch this was issued as part of, if any (§4.3).</summary>
    Guid? BatchId);

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

/// <summary>One recipient of a bulk invitation (§4).</summary>
public record BulkInviteRecipient(string Email);

/// <summary>
/// Invite many recipients into an existing Workspace at once, under one
/// Invitation Batch. One role and one source apply to the whole request
/// (§13's UI picks these once per bulk-invite operation).
/// </summary>
public record BulkInviteMemberRequest(string Role, string Source, IReadOnlyList<BulkInviteRecipient> Recipients);

/// <summary>
/// One recipient's outcome within a bulk invitation. Outcome is
/// "issued" or "skipped" — a skip never fails the whole batch (Rule 4).
/// </summary>
public record BulkInvitationRecipientResult(
    string Email,
    string Outcome,
    string? Reason,
    Guid? InvitationId,
    /// <summary>
    /// The invitation link, present only for "issued" outcomes. Returned
    /// alongside delivery status for the same reason InvitationIssuedResponse
    /// does — it's the only recovery path for an invite whose email never
    /// arrives, and the raw token cannot be recovered later.
    /// </summary>
    string? InvitationLink,
    bool? Delivered,
    string? DeliveryDetail);

/// <summary>Result of a bulk invitation request (§4.3).</summary>
public record BulkInvitationIssuedResponse(
    Guid BatchId,
    int TotalRecipients,
    int IssuedCount,
    int SkippedCount,
    IReadOnlyList<BulkInvitationRecipientResult> Results);
