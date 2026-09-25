using System.Buffers.Binary;
using System.Security.Cryptography;
using System.Text;

namespace Platform.Api.Services;

/// <summary>
/// Settings for asset-scoped tokens. The signing key is Storage:AssetTokenKey — a dedicated
/// secret that is never the session JWT key and is never stored in the repository.
/// </summary>
public sealed class AssetAccessOptions
{
    public const string TokenKeyConfig = "Storage:AssetTokenKey";
    public const string PresignedLifetimeConfig = "Storage:PresignedReadLifetimeSeconds";
    public const string VideoDeliveryConfig = "Storage:VideoDelivery";
    private const int DefaultPresignedSeconds = 3600;
    private const int ProductionMinimumPresignedSeconds = 300;
    private const int MaximumPresignedSeconds = 7 * 24 * 3600; // the longest a presigned URL can live
    private const int MinimumKeyBytes = 32;

    public required byte[] TokenKey { get; init; }

    /// <summary>Images, PDFs, resources, activity and submission files.</summary>
    public TimeSpan AssetTokenLifetime { get; init; } = TimeSpan.FromMinutes(10);

    /// <summary>
    /// Video served through the API proxy: the Local provider's only option, the fallback when the storage
    /// provider can't sign a URL, and production when <see cref="VideoDelivery"/> is <see cref="VideoDeliveryMode.Proxy"/>.
    /// </summary>
    public TimeSpan VideoProxyTokenLifetime { get; init; } = TimeSpan.FromMinutes(15);

    /// <summary>
    /// Which URL kind <c>/access</c> hands out for a video when the storage provider supports both: a direct
    /// presigned URL (default — no bytes through this API), or the token + <c>/content</c> proxy (routes every
    /// video byte through this server instead of straight to the storage edge). An operator-flippable emergency
    /// lever for TD-023 (a suspected Chrome/R2 QUIC stall) — not a new default, and no rebuild needed to flip it.
    /// </summary>
    public VideoDeliveryMode VideoDelivery { get; init; } = VideoDeliveryMode.Presigned;

    /// <summary>
    /// How long a presigned R2 video URL lives. One hour by default. Shorter than five minutes exists only so
    /// the expiry and refresh path can be exercised in development and tests; production refuses it at startup.
    /// </summary>
    public TimeSpan PresignedReadLifetime { get; init; } = TimeSpan.FromSeconds(DefaultPresignedSeconds);

    private static readonly string[] KnownPlaceholders =
    [
        "platform-dev-secret-key-minimum-32-chars!!", "changeme", "change-me", "placeholder", "replace-me", "your-secret-here",
    ];

    /// <summary>
    /// Reads and validates the key. Outside Development a missing, short, placeholder or JWT-equal key stops
    /// startup. In Development a missing key falls back to a random per-process one, so no key is ever committed
    /// (tokens then simply stop working across a restart, which a 10-minute token tolerates).
    /// </summary>
    public static AssetAccessOptions Resolve(IConfiguration config, IHostEnvironment env, string jwtKey)
    {
        var presigned = ResolvePresignedLifetime(config, env);
        var videoDelivery = ResolveVideoDelivery(config);
        var configured = config[TokenKeyConfig];

        if (string.IsNullOrWhiteSpace(configured))
        {
            if (!env.IsDevelopment())
                throw new InvalidOperationException(
                    $"{TokenKeyConfig} must be configured outside Development (a secret of at least {MinimumKeyBytes} bytes, " +
                    "different from Jwt:Key). Set it through your host's secret store or an environment variable.");
            return new AssetAccessOptions
            {
                TokenKey = RandomNumberGenerator.GetBytes(48), PresignedReadLifetime = presigned, VideoDelivery = videoDelivery,
            };
        }

        var bytes = Encoding.UTF8.GetBytes(configured);
        if (bytes.Length < MinimumKeyBytes)
            throw new InvalidOperationException($"{TokenKeyConfig} must be at least {MinimumKeyBytes} bytes.");
        if (string.Equals(configured, jwtKey, StringComparison.Ordinal))
            throw new InvalidOperationException($"{TokenKeyConfig} must not be the same value as Jwt:Key.");
        if (!env.IsDevelopment() && LooksLikeAPlaceholder(configured))
            throw new InvalidOperationException($"{TokenKeyConfig} is still a placeholder value. Configure a real secret for this environment.");

        return new AssetAccessOptions { TokenKey = bytes, PresignedReadLifetime = presigned, VideoDelivery = videoDelivery };
    }

    /// <summary>Development and test hosts may shorten the presigned lifetime; anything else may not go under five minutes.</summary>
    public static bool IsDevelopmentOrTest(IHostEnvironment env) =>
        env.IsDevelopment() || env.EnvironmentName.Contains("Test", StringComparison.OrdinalIgnoreCase);

    private static TimeSpan ResolvePresignedLifetime(IConfiguration config, IHostEnvironment env)
    {
        var raw = config[PresignedLifetimeConfig];
        if (string.IsNullOrWhiteSpace(raw)) return TimeSpan.FromSeconds(DefaultPresignedSeconds);

        if (!int.TryParse(raw, System.Globalization.NumberStyles.None, System.Globalization.CultureInfo.InvariantCulture, out var seconds)
            || seconds < 1 || seconds > MaximumPresignedSeconds)
            throw new InvalidOperationException(
                $"{PresignedLifetimeConfig} must be a whole number of seconds between 1 and {MaximumPresignedSeconds}.");

        if (seconds < ProductionMinimumPresignedSeconds && !IsDevelopmentOrTest(env))
            throw new InvalidOperationException(
                $"{PresignedLifetimeConfig} is {seconds} s. Outside Development and Test it must be at least " +
                $"{ProductionMinimumPresignedSeconds} s.");

        return TimeSpan.FromSeconds(seconds);
    }

    private static bool LooksLikeAPlaceholder(string key) =>
        KnownPlaceholders.Any(p => key.Contains(p, StringComparison.OrdinalIgnoreCase))
        || key.Distinct().Count() < 8; // "aaaaaaaa…", "12121212…"

    private static VideoDeliveryMode ResolveVideoDelivery(IConfiguration config)
    {
        var raw = config[VideoDeliveryConfig];
        if (string.IsNullOrWhiteSpace(raw)) return VideoDeliveryMode.Presigned;
        // Names only: Enum.TryParse also accepts numbers ("1", "7"), which would silently pick a mode — or an
        // undefined value that behaves like Proxy — from a typo. Only the two spelled-out names are valid.
        if (!raw.Trim().All(char.IsDigit)
            && Enum.TryParse<VideoDeliveryMode>(raw.Trim(), ignoreCase: true, out var mode)
            && Enum.IsDefined(mode))
            return mode;
        throw new InvalidOperationException(
            $"{VideoDeliveryConfig} is \"{raw}\" — must be \"Presigned\" or \"Proxy\".");
    }
}

/// <summary>How <c>/access</c> hands out a video URL. See <see cref="AssetAccessOptions.VideoDelivery"/>.</summary>
public enum VideoDeliveryMode { Presigned, Proxy }

public enum AssetTokenOperation : byte { Read = 1 }

public readonly record struct AssetTokenClaims(
    Guid AssetId, Guid WorkspaceId, Guid IdentityId, AssetTokenOperation Operation, DateTimeOffset ExpiresAt);

/// <summary>
/// Stateless, signed, asset-scoped tokens for the URLs a browser element (&lt;img&gt;, &lt;a&gt;,
/// &lt;iframe&gt;, &lt;video&gt;) fetches without an Authorization header. A token names exactly one asset,
/// one workspace, one user and one operation (read) and expires in minutes; it embeds no session credential
/// and is not a JWT, so it can never authenticate as a session. Signed with HMAC-SHA256 under a dedicated key
/// and compared in constant time. Stateless on purpose: nothing to store or clean up, and any instance can
/// verify it. Possession alone never grants access — redemption re-runs the full authorization check.
///
/// Wire format: v1.&lt;base64url payload&gt;.&lt;base64url signature&gt;, payload = assetId(16) workspaceId(16)
/// identityId(16) operation(1) expiresAtUnixSeconds(8, big-endian).
/// </summary>
public sealed class AssetAccessTokenService(AssetAccessOptions options, TimeProvider clock)
{
    private const string Version = "v1";
    private const int PayloadLength = 16 + 16 + 16 + 1 + 8;
    private static readonly byte[] Domain = "platform.asset-access-token.v1"u8.ToArray();

    public string Issue(Guid assetId, Guid workspaceId, Guid identityId, TimeSpan lifetime,
        AssetTokenOperation operation = AssetTokenOperation.Read)
    {
        var expires = clock.GetUtcNow().Add(lifetime).ToUnixTimeSeconds();

        var payload = new byte[PayloadLength];
        assetId.TryWriteBytes(payload.AsSpan(0, 16));
        workspaceId.TryWriteBytes(payload.AsSpan(16, 16));
        identityId.TryWriteBytes(payload.AsSpan(32, 16));
        payload[48] = (byte)operation;
        BinaryPrimitives.WriteInt64BigEndian(payload.AsSpan(49, 8), expires);

        return $"{Version}.{Base64Url(payload)}.{Base64Url(Sign(payload))}";
    }

    /// <summary>
    /// Verifies signature, structure, operation and expiry. Returns null for every failure without saying which
    /// — callers must not distinguish them either. Binding to a particular asset/workspace is the caller's check.
    /// </summary>
    public AssetTokenClaims? TryValidate(string? token)
    {
        // Always do the same amount of cryptographic work, so a malformed token isn't faster to reject than a forged one.
        var signatureOk = false;
        byte[] payload = new byte[PayloadLength];

        if (!string.IsNullOrEmpty(token))
        {
            var parts = token.Split('.');
            if (parts.Length == 3 && parts[0] == Version
                && FromBase64Url(parts[1]) is { Length: PayloadLength } decodedPayload
                && FromBase64Url(parts[2]) is { Length: 32 } signature)
            {
                payload = decodedPayload;
                signatureOk = CryptographicOperations.FixedTimeEquals(Sign(payload), signature);
            }
        }
        if (!signatureOk) _ = Sign(payload); // burn the same HMAC cost on the failure path

        if (!signatureOk) return null;

        var operation = (AssetTokenOperation)payload[48];
        var expiresAt = DateTimeOffset.FromUnixTimeSeconds(BinaryPrimitives.ReadInt64BigEndian(payload.AsSpan(49, 8)));

        if (operation != AssetTokenOperation.Read) return null;
        if (expiresAt <= clock.GetUtcNow()) return null;

        return new AssetTokenClaims(
            new Guid(payload.AsSpan(0, 16)), new Guid(payload.AsSpan(16, 16)), new Guid(payload.AsSpan(32, 16)),
            operation, expiresAt);
    }

    public DateTimeOffset ExpiryFor(TimeSpan lifetime) => clock.GetUtcNow().Add(lifetime);

    private byte[] Sign(byte[] payload)
    {
        using var hmac = new HMACSHA256(options.TokenKey);
        hmac.TransformBlock(Domain, 0, Domain.Length, null, 0);
        hmac.TransformFinalBlock(payload, 0, payload.Length);
        return hmac.Hash!;
    }

    private static string Base64Url(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static byte[]? FromBase64Url(string value)
    {
        try
        {
            var s = value.Replace('-', '+').Replace('_', '/');
            s = s.PadRight(s.Length + (4 - s.Length % 4) % 4, '=');
            return Convert.FromBase64String(s);
        }
        catch (FormatException) { return null; }
    }
}
