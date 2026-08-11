namespace Platform.Domain;

/// <summary>
/// Password Reset Aggregate Root.
///
/// Lets a Tutor or Student who has forgotten their password recover their
/// account without a Platform Operator's involvement — the self-service
/// counterpart to Invitation and Signup Status Link, reusing the same token
/// machinery (SecureToken) for the same reasons: the raw value is shown
/// exactly once, only its hash is persisted, and it is single-use.
///
/// Deliberately its own aggregate rather than a field on Identity. A password
/// reset is a request that happens *to* an Identity, with its own short
/// lifecycle (issued, used once, expires quickly) — folding that lifecycle
/// into Identity itself would make an aggregate meant to be "lifelong and
/// platform-owned" (Identity Aggregate Design §4) carry state that is
/// meaningful for a few minutes at a time.
///
/// Rules enforced here, deliberately mirroring Invitation's (Invitation
/// Business Analysis §8–10) rather than inventing new ones:
///   · the token is single-use: once Used it can never validate again
///   · an expired reset cannot be used, however valid its token
///   · at most one open reset per Identity is enforced outside this class
///     (it spans rows), by the application service that issues them —
///     requesting again cancels whichever one was still open, so a stale
///     link in an old inbox stops working the moment a fresher one is sent
/// </summary>
public class PasswordReset
{
    public Guid Id { get; private set; }
    public Guid IdentityId { get; private set; }

    /// <summary>Hash of the token. The raw value is never persisted.</summary>
    public string TokenHash { get; private set; } = string.Empty;

    public PasswordResetStatus Status { get; private set; }
    public DateTime IssuedAt { get; private set; }
    public DateTime ExpiresAt { get; private set; }
    public DateTime? UsedAt { get; private set; }

    // Required by EF Core — not for application use
    private PasswordReset() { }

    /// <summary>
    /// Issues a new PasswordReset in Issued state. Returns the raw token
    /// alongside it — the only moment it exists in readable form.
    /// </summary>
    public static (PasswordReset Reset, string RawToken) Issue(Guid identityId, TimeSpan validFor)
    {
        if (identityId == Guid.Empty)
            throw new ArgumentException("A Password Reset must name exactly one Identity.", nameof(identityId));
        if (validFor <= TimeSpan.Zero)
            throw new ArgumentException("A Password Reset must expire in the future.", nameof(validFor));

        var (raw, hash) = SecureToken.Generate();
        var now = DateTime.UtcNow;

        var reset = new PasswordReset
        {
            Id = Guid.NewGuid(),
            IdentityId = identityId,
            TokenHash = hash,
            Status = PasswordResetStatus.Issued,
            IssuedAt = now,
            ExpiresAt = now.Add(validFor)
        };

        return (reset, raw);
    }

    /// <summary>
    /// Whether this link can still be used right now. Expiry is a function of
    /// the clock, so an Issued reset past its date is already unusable even
    /// before anything has written Expired to it.
    /// </summary>
    public bool IsOpen(DateTime? asOf = null) =>
        Status == PasswordResetStatus.Issued && ExpiresAt > (asOf ?? DateTime.UtcNow);

    /// <summary>
    /// Issued → Used. Single-use: the token can never validate again.
    /// Rejects an expired reset regardless of token validity.
    /// </summary>
    public void Use()
    {
        Require(PasswordResetStatus.Issued);

        if (ExpiresAt <= DateTime.UtcNow)
            throw new InvalidOperationException("This password reset link has expired.");

        Status = PasswordResetStatus.Used;
        UsedAt = DateTime.UtcNow;
    }

    /// <summary>Issued → Expired. Recording what the clock already made true.</summary>
    public void Expire()
    {
        Require(PasswordResetStatus.Issued);
        Status = PasswordResetStatus.Expired;
    }

    /// <summary>
    /// Issued → Cancelled. Called when a fresher request supersedes this one,
    /// or the password changed another way while it was still open — either
    /// way, this link must stop working immediately rather than linger as a
    /// second valid way in.
    /// </summary>
    public void Cancel()
    {
        Require(PasswordResetStatus.Issued);
        Status = PasswordResetStatus.Cancelled;
    }

    private void Require(params PasswordResetStatus[] permitted)
    {
        if (!permitted.Contains(Status))
            throw new InvalidOperationException(
                $"A Password Reset in {Status} cannot make this transition. Permitted from: {string.Join(", ", permitted)}.");
    }
}
