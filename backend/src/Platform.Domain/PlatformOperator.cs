namespace Platform.Domain;

/// <summary>
/// Platform Operator Aggregate Root — platform-level authority for one Identity.
///
/// The platform counterpart to Membership: where a Membership links an Identity
/// to one Workspace and carries the roles held there, a PlatformOperator links
/// an Identity to the platform itself. Nothing about it is Workspace-scoped.
///
/// This is the answer to Platform Administrator Business Analysis, BA-002,
/// which deliberately left the representation open. It honours the TD-005
/// follow-up warning — no global role goes back onto Identity — while still
/// giving BA-001 what it needs: a Platform Administrator holds authority over
/// Workspaces they are not, and never become, a Member of.
///
/// Deliberately narrow. It answers "may this person operate the platform?" and
/// nothing finer. Distinguishing operator tiers (support vs. billing vs. full
/// operator) is future work; today the grant is the whole permission.
/// </summary>
public class PlatformOperator
{
    public Guid Id { get; private set; }

    /// <summary>The Identity holding platform authority. Identity itself is unchanged.</summary>
    public Guid IdentityId { get; private set; }

    public PlatformOperatorStatus Status { get; private set; }
    public DateTime GrantedAt { get; private set; }

    /// <summary>
    /// The IdentityId of the operator who granted this. Null for the first
    /// operator, which has to come from a seed or deployment step because there
    /// is nobody to grant it.
    /// </summary>
    public Guid? GrantedBy { get; private set; }

    public DateTime? RevokedAt { get; private set; }

    // Required by EF Core — not for application use
    private PlatformOperator() { }

    public static PlatformOperator Grant(Guid identityId, Guid? grantedBy = null)
    {
        if (identityId == Guid.Empty)
            throw new ArgumentException("A platform operator grant requires an Identity.", nameof(identityId));

        return new PlatformOperator
        {
            Id = Guid.NewGuid(),
            IdentityId = identityId,
            Status = PlatformOperatorStatus.Active,
            GrantedAt = DateTime.UtcNow,
            GrantedBy = grantedBy
        };
    }

    /// <summary>Withdraws platform authority. Terminal — grant again to restore it.</summary>
    public void Revoke()
    {
        if (Status != PlatformOperatorStatus.Active)
            throw new InvalidOperationException("Only an active platform operator grant can be revoked.");

        Status = PlatformOperatorStatus.Revoked;
        RevokedAt = DateTime.UtcNow;
    }
}
