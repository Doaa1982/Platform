namespace Platform.Domain;

/// <summary>
/// Lifecycle status of an Identity.
/// Per Identity Aggregate Design State Machine, Section 14.
/// </summary>
public enum IdentityStatus
{
    Active,
    Suspended,
    Archived
}
