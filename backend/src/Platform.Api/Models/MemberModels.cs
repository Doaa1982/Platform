namespace Platform.Api.Models;

/// <summary>One Learning Product a member is enrolled in (§12.3).</summary>
public record EnrolledCourseInfo(Guid LearningProductId, string Title);

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
    DateTime? LastActiveAt,
    IReadOnlyList<EnrolledCourseInfo> EnrolledCourses,
    /// <summary>
    /// Set when this member's most recent accepted Invitation named a course
    /// (§12.3 "Invite + Enroll") that they are not yet enrolled in — i.e.
    /// still waiting on payment/confirmation. Null once enrolled, or if they
    /// were never invited with a course attached.
    /// </summary>
    Guid? PendingInvitedProductId,
    string? PendingInvitedProductTitle);

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
    Guid? BatchId,
    /// <summary>The course this invitation will enrol the invitee into on acceptance, if any (§12.3).</summary>
    Guid? IntendedLearningProductId,
    /// <summary>Denormalised for display — null if no course was selected, or the course was later deleted.</summary>
    string? IntendedLearningProductTitle);

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

/// <summary>
/// Enrols an already-Active member into a specific, Published Learning
/// Product (§12.3) — the "payment confirmed" moment for a course they were
/// either invited to, or simply already belong to the workspace and are now
/// being added to a course directly.
/// </summary>
public record EnrollMemberRequest(Guid LearningProductId);

/// <summary>One member currently enrolled in a course, for the per-course roster view.</summary>
public record EnrolledMemberRow(Guid MembershipId, string Email, string FullName, DateTime EnrolledAt);

/// <summary>
/// One Learning Product's roster: who is enrolled, and who has an
/// outstanding (not yet accepted) Invitation naming this course as its
/// Intended Learning Product (§12.3).
/// </summary>
public record ProductRosterResponse(
    Guid ProductId,
    string ProductTitle,
    bool CanManage,
    IReadOnlyList<EnrolledMemberRow> Enrolled,
    IReadOnlyList<WorkspaceInvitationRow> Invited);

/// <summary>One recipient of a bulk invitation (§4).</summary>
public record BulkInviteRecipient(string Email);

/// <summary>
/// Invite many recipients into an existing Workspace at once, under one
/// Invitation Batch. One role and one source apply to the whole request
/// (§13's UI picks these once per bulk-invite operation).
/// </summary>
/// <param name="IntendedLearningProductId">
/// "Invite + Enroll" (§12.3): when set, every Invitation issued in this
/// batch carries the same course as its Intended Learning Product — one
/// course per batch, not per recipient. Null means "add to workspace only."
/// </param>
public record BulkInviteMemberRequest(
    string Role, string Source, IReadOnlyList<BulkInviteRecipient> Recipients,
    Guid? IntendedLearningProductId = null);

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
