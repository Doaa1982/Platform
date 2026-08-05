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
/// Submitting a Join Request.
///
/// Password is required either way (BA-003): a new one when no Identity exists
/// for this email, or the existing one to prove the requester is that person
/// rather than someone who merely knows their address.
/// </summary>
public record SubmitJoinRequest(string FullName, string Email, string Password, string? Message);

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

/// <summary>The requester's own view of a request they submitted.</summary>
public record MyJoinRequest(
    Guid Id,
    string WorkspaceName,
    string WorkspaceSlug,
    string RequestedRole,
    string Status,
    DateTime SubmittedAt);
