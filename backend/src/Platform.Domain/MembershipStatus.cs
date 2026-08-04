namespace Platform.Domain;

/// <summary>
/// Lifecycle status of a Membership.
/// Per Membership Aggregate Design, Section 8 (Value Objects) and Section 15
/// (State Machine); values per Identity &amp; Workspace Access Architecture, Section II.
/// </summary>
public enum MembershipStatus
{
    Pending,
    Active,
    Suspended,
    Archived,
    Removed
}
