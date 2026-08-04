namespace Platform.Domain;

/// <summary>
/// Lifecycle of an Invitation.
///
/// Per Invitation Business Analysis §9, which reconciles the two conflicting
/// lifecycles in the corpus: Workspace_Access_Context §4.5 is the base, with
/// Cancelled folded in from IdentityAndWorkspaceAccess WA-104.
///
///   Created → Sent → { Accepted | Expired | Cancelled }
///   Created → Cancelled  (a sender may cancel before ever sending)
///
/// Accepted, Expired and Cancelled are alternatives, never a sequence: an
/// Invitation reaches exactly one of them.
///
/// The underlying documentary contradiction is recorded as TD-008; it still
/// needs a maintainer's ruling.
/// </summary>
public enum InvitationStatus
{
    Created,
    Sent,
    Accepted,
    Expired,
    Cancelled
}
