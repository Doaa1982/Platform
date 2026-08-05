namespace Platform.Domain;

/// <summary>
/// Lifecycle of a Join Request (Join Request Business Analysis §9).
///
///   Submitted → { Approved | Declined | Withdrawn }
///
/// `Submitted` is the only open state; the other three are terminal and
/// mutually exclusive.
///
/// There is deliberately no `Expired`. An Invitation expires because it carries
/// a credential that should not stay valid forever; a Join Request carries none
/// and grants nothing until someone acts on it, so timing it out makes nothing
/// safer (§10, Expiry Rules).
/// </summary>
public enum JoinRequestStatus
{
    Submitted,
    Approved,
    Declined,
    Withdrawn
}
