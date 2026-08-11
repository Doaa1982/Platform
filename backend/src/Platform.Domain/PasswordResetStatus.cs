namespace Platform.Domain;

/// <summary>
/// PasswordReset's lifecycle. See PasswordReset.cs for the transitions this
/// governs.
/// </summary>
public enum PasswordResetStatus
{
    /// <summary>A live link, not yet used. The only state a token can be spent from.</summary>
    Issued,

    /// <summary>Spent — the password was changed. Terminal; the token can never validate again.</summary>
    Used,

    /// <summary>Past its expiry, never used. Terminal.</summary>
    Expired,

    /// <summary>
    /// Superseded before it could be used — either a fresher request for the
    /// same Identity replaced it, or the password changed some other way
    /// while it was still open. Terminal.
    /// </summary>
    Cancelled,
}
