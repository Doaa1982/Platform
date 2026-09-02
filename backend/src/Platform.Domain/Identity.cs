namespace Platform.Domain;

/// <summary>
/// Identity Aggregate Root.
///
/// Represents the lifelong, platform-owned digital identity of a Person,
/// independent of any Workspace.
///
/// Per Identity Aggregate Design (Section 4): Identity is the Aggregate Root.
/// It is referenced by IdentityId from Membership and every Workspace-scoped
/// aggregate that traces authorship back through a Membership.
///
/// Identity deliberately holds NO role. Per Section 3, Identity is not responsible
/// for "Workspace-specific roles, permissions, or status" — those belong to the
/// Membership Aggregate, scoped to one Workspace. The same person may be a Teacher
/// in one Workspace and a Learner in another.
///
/// Invariants enforced here:
///   INV-001: Every Person owns exactly one Identity.
///   INV-005: An Identity may hold multiple Credentials (modelled as PasswordHash here for Email/Password type).
///   INV-006: Passwords are never visible — only the BCrypt hash is stored.
/// </summary>
public class Identity
{
    public Guid Id { get; private set; }
    public string Email { get; private set; } = string.Empty;
    public string PasswordHash { get; private set; } = string.Empty;
    public string FullName { get; private set; } = string.Empty;
    public IdentityStatus Status { get; private set; }
    public DateTime CreatedAt { get; private set; }

    /// <summary>
    /// Bumped whenever every previously issued access token for this Identity
    /// should stop working — an explicit logout, or a password reset/change
    /// (someone who just proved they know the new password, or redeemed a
    /// reset link, should not leave an old, possibly-compromised session
    /// still valid). TokenService embeds the current value in every token it
    /// issues; the JWT bearer handler's OnTokenValidated rejects a token
    /// whose value no longer matches. A stateless JWT can't be revoked
    /// individually without a per-token blacklist this codebase has no
    /// infrastructure for — bumping this is the "sign out everywhere"
    /// granularity that's actually achievable here.
    /// </summary>
    public int TokenVersion { get; private set; }

    // Required by EF Core — not for application use
    private Identity() { }

    /// <summary>
    /// Creates a new Identity. Corresponds to the CreateIdentity command
    /// in Identity Aggregate Design, Section 12.
    /// </summary>
    public static Identity Create(
        string email,
        string passwordHash,
        string fullName)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(email);
        ArgumentException.ThrowIfNullOrWhiteSpace(passwordHash);
        ArgumentException.ThrowIfNullOrWhiteSpace(fullName);

        return new Identity
        {
            Id = Guid.NewGuid(),
            Email = email.ToLowerInvariant().Trim(),
            PasswordHash = passwordHash,
            FullName = fullName.Trim(),
            Status = IdentityStatus.Active,
            CreatedAt = DateTime.UtcNow
        };
    }

    /// <summary>
    /// Replaces the credential (INV-005). Used both when someone changes their
    /// own password knowingly and when a Password Reset link is redeemed —
    /// either way, the caller has already proven they are entitled to do this
    /// (a matching current password, or a valid single-use reset token), so
    /// nothing further is checked here.
    /// </summary>
    public void SetPassword(string newPasswordHash)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(newPasswordHash);
        PasswordHash = newPasswordHash;
    }

    /// <summary>Ends every currently valid access token for this Identity — see <see cref="TokenVersion"/>.</summary>
    public void InvalidateSessions() => TokenVersion++;

    /// <summary>
    /// Suspends the Identity. IdentityStatus → Suspended.
    /// </summary>
    public void Suspend() => Status = IdentityStatus.Suspended;

    /// <summary>
    /// Reactivates a Suspended Identity. IdentityStatus → Active.
    /// </summary>
    public void Reactivate() => Status = IdentityStatus.Active;

    /// <summary>
    /// Archives the Identity. Terminal state per state machine (Section 14).
    /// </summary>
    public void Archive() => Status = IdentityStatus.Archived;
}
