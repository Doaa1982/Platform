namespace Platform.Domain;

/// <summary>
/// Lifecycle of a Join Request (Join Request Business Analysis §9).
///
///   Submitted → { Approved | Declined | Cancelled }
///
/// `Submitted` is the only open state; the other three are terminal and
/// mutually exclusive. Named Cancelled (the domain used to call this
/// Withdrawn) to match the term used everywhere this is shown to a person —
/// "cancel this request" — rather than carrying two different words for the
/// same action.
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
    Cancelled
}
