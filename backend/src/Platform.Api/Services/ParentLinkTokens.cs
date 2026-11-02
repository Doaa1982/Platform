using System.Buffers.Binary;
using System.Security.Cryptography;
using System.Text;

namespace Platform.Api.Services;

public enum ParentLinkPurpose : byte { Confirm = 1, Unsubscribe = 2 }

public readonly record struct ParentLinkClaims(ParentLinkPurpose Purpose, Guid ContactId, int LinkVersion, DateTimeOffset ExpiresAt);

/// <summary>
/// Signed, single-purpose links for parents, who have no login (Parent Progress Reports Business
/// Analysis §7). A token names exactly one parent contact and one purpose — a confirm token can't
/// unsubscribe, and neither works for another contact — and a confirm token also names the
/// confirmation round (<see cref="Platform.Domain.ParentContact.LinkVersion"/>), so a resent
/// invitation retires the older link.
///
/// Stateless (HMAC-SHA256), like <see cref="AssetAccessTokenService"/>: the unsubscribe link has
/// to be printed in every report, so a hash-only, show-once token (SecureToken) can't serve it.
/// The key is derived (HKDF) from the asset-token key with its own label — no extra secret to
/// configure, and a token minted for one never verifies as the other.
///
/// Wire format: p1.&lt;base64url payload&gt;.&lt;base64url signature&gt;, payload = purpose(1)
/// contactId(16) linkVersion(4, big-endian) expiresAtUnixSeconds(8, big-endian).
/// </summary>
public sealed class ParentLinkTokens
{
    private const string Prefix = "p1.";
    private const int PayloadLength = 1 + 16 + 4 + 8;
    private static readonly byte[] KeyLabel = Encoding.UTF8.GetBytes("teach-tandem/parent-contact-links/v1");

    /// <summary>An unsubscribe link must keep working in an old email; this is "practically forever".</summary>
    public static readonly TimeSpan UnsubscribeLifetime = TimeSpan.FromDays(3650);

    private readonly byte[] _key;
    private readonly TimeProvider _clock;

    public ParentLinkTokens(AssetAccessOptions options, TimeProvider clock)
    {
        _key = HKDF.DeriveKey(HashAlgorithmName.SHA256, options.TokenKey, 32, info: KeyLabel);
        _clock = clock;
    }

    public string Issue(ParentLinkPurpose purpose, Guid contactId, int linkVersion, DateTimeOffset expiresAt)
    {
        var payload = new byte[PayloadLength];
        payload[0] = (byte)purpose;
        contactId.TryWriteBytes(payload.AsSpan(1, 16));
        BinaryPrimitives.WriteInt32BigEndian(payload.AsSpan(17, 4), linkVersion);
        BinaryPrimitives.WriteInt64BigEndian(payload.AsSpan(21, 8), expiresAt.ToUnixTimeSeconds());
        return Prefix + Base64Url(payload) + "." + Base64Url(Sign(payload));
    }

    /// <summary>Null unless the token is well-formed, correctly signed, of <paramref name="purpose"/>, and not expired.</summary>
    public ParentLinkClaims? Verify(string? token, ParentLinkPurpose purpose)
    {
        if (string.IsNullOrWhiteSpace(token) || !token.StartsWith(Prefix, StringComparison.Ordinal) || token.Length > 200) return null;
        var parts = token[Prefix.Length..].Split('.');
        if (parts.Length != 2) return null;

        var payload = FromBase64Url(parts[0]);
        var signature = FromBase64Url(parts[1]);
        if (payload is not { Length: PayloadLength } || signature is null) return null;
        if (!CryptographicOperations.FixedTimeEquals(signature, Sign(payload))) return null;

        if (payload[0] != (byte)purpose) return null;
        var expiresAt = DateTimeOffset.FromUnixTimeSeconds(BinaryPrimitives.ReadInt64BigEndian(payload.AsSpan(21, 8)));
        if (expiresAt <= _clock.GetUtcNow()) return null;

        return new ParentLinkClaims(purpose, new Guid(payload.AsSpan(1, 16)),
            BinaryPrimitives.ReadInt32BigEndian(payload.AsSpan(17, 4)), expiresAt);
    }

    private byte[] Sign(byte[] payload) => HMACSHA256.HashData(_key, payload);

    private static string Base64Url(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static byte[]? FromBase64Url(string value)
    {
        var s = value.Replace('-', '+').Replace('_', '/');
        s = s.PadRight(s.Length + (4 - s.Length % 4) % 4, '=');
        try { return Convert.FromBase64String(s); }
        catch (FormatException) { return null; }
    }
}
