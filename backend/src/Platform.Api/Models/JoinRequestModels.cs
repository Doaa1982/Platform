namespace Platform.Api.Models;

/// <summary>
/// What a stranger sees before asking to join — resolved from the slug alone,
/// with no authentication.
///
/// Deliberately thin. Anyone can call it, so it carries only what is needed to
/// decide whether to ask: the Workspace's name, and whether it is open to
/// requests at all. Nothing about its members, products or activity.
/// </summary>
public record JoinPreview(
    string WorkspaceName,
    string Slug,
    string? Description,
    bool AcceptingRequests);

/// <summary>
/// Submitting a Join Request. No password, no Identity: this is interest data
/// for a reviewer to decide on, not an account being created. An account only
/// comes into existence if and when the request is approved and the resulting
/// Invitation is accepted.
/// </summary>
public record SubmitJoinRequest(string FullName, string Email, string? Message);

/// <summary>What the requester sees immediately after submitting.</summary>
public record JoinRequestReceipt(Guid Id, string Status);

/// <summary>One row of the reviewer's queue.</summary>
public record JoinRequestRow(
    Guid Id,
    string FullName,
    string Email,
    string RequestedRole,
    string? Message,
    string Status,
    DateTime SubmittedAt,
    DateTime? DecidedAt);
