namespace Platform.Domain;

/// <summary>
/// Lifecycle of a Course Join Request.
///
///   Submitted → { Approved | Declined }
///
/// Unlike <see cref="JoinRequestStatus"/> there is no Cancelled: the requester
/// is already an authenticated Member (this is a request for a specific
/// course, not for the Workspace itself), so a reviewer simply declines it
/// if it is no longer wanted rather than the requester retracting it.
/// </summary>
public enum CourseJoinRequestStatus
{
    Submitted,
    Approved,
    Declined
}
