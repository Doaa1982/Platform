using System.Security.Cryptography;
using System.Text;

namespace Platform.Domain;

/// <summary>
/// Generation and verification of unguessable link tokens.
///
/// Extracted per Technical Debt Backlog TD-011, which recorded that Tutor
/// Signup Request and Join Request are the same business pattern at two scopes
/// and asked whether they should share an abstraction. The answer taken — and
/// already implied by Platform Administrator Business Analysis BA-008 — is to
/// share the *mechanism* while keeping the concepts separate:
///
///   · Invitation Link      → resolves to a Workspace you have been offered
///   · Signup Status Link   → resolves to an application's status; no Workspace
///                            exists yet, and the holder has no Identity
///
/// Those are different things reached the same way. Sharing the token
/// machinery stops a third hand-rolled copy drifting from the first two;
/// sharing the aggregates would have made almost every rule conditional on
/// which kind of request it was.
///
/// Properties, per Invitation Business Analysis §8:
///   · cryptographically random, never derived from anything guessable
///   · the raw value is shown exactly once, inside the link; only its hash is
///     persisted, mirroring how PasswordHash protects credentials
///     (Identity Aggregate Design, INV-006)
///
/// SHA-256 rather than BCrypt, deliberately. BCrypt's work factor exists to
/// make *low-entropy* human passwords expensive to guess. A 256-bit random
/// token has nothing to brute-force, so a slow hash would buy no security and
/// would instead make every link visit expensive.
/// </summary>
public static class SecureToken
{
    private const int TokenBytes = 32; // 256 bits

    /// <summary>
    /// Creates a new token. Returns the raw value — the only time it exists in
    /// readable form — alongside the hash to persist.
    /// </summary>
    public static (string Raw, string Hash) Generate()
    {
        var raw = Base64Url(RandomNumberGenerator.GetBytes(TokenBytes));
        return (raw, Hash(raw));
    }

    /// <summary>Hashes a raw token for storage or comparison.</summary>
    public static string Hash(string rawToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(rawToken);
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rawToken)));
    }

    /// <summary>
    /// Compares a presented token against a stored hash in constant time, so
    /// the comparison cannot leak how much of a guess was correct.
    /// </summary>
    public static bool Verify(string rawToken, string storedHash)
    {
        if (string.IsNullOrWhiteSpace(rawToken) || string.IsNullOrWhiteSpace(storedHash))
            return false;

        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(Hash(rawToken)),
            Encoding.UTF8.GetBytes(storedHash));
    }

    /// <summary>URL-safe Base64 — these tokens travel in links.</summary>
    private static string Base64Url(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
