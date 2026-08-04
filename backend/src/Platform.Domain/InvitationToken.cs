using System.Security.Cryptography;

namespace Platform.Domain;

/// <summary>
/// Generation and verification of Invitation Tokens.
///
/// Per Invitation Business Analysis §8 ("Token Generation and Storage"):
///   - cryptographically random, never derived from the invitation id, the
///     email, or anything else guessable
///   - the raw token is shown exactly once, inside the Invitation Link; only
///     its hash is persisted, mirroring how PasswordHash protects credentials
///     (Identity Aggregate Design, INV-006)
///
/// SHA-256 rather than BCrypt, deliberately. BCrypt's work factor exists to
/// make *low-entropy* human passwords expensive to guess. A 256-bit random
/// token has nothing to brute-force, so the slow hash would buy no security
/// and would instead make every invitation-link visit expensive.
/// </summary>
public static class InvitationToken
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
        return Convert.ToHexString(SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(rawToken)));
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
            System.Text.Encoding.UTF8.GetBytes(Hash(rawToken)),
            System.Text.Encoding.UTF8.GetBytes(storedHash));
    }

    /// <summary>URL-safe Base64 — the token travels in an invitation link.</summary>
    private static string Base64Url(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
