namespace Platform.Domain;

/// <summary>
/// Lifecycle of a Platform Operator grant.
/// Revoked is terminal — authority is withdrawn by revoking and, if needed,
/// granting again, so the history of who held platform access stays readable.
/// </summary>
public enum PlatformOperatorStatus
{
    Active,
    Revoked
}
