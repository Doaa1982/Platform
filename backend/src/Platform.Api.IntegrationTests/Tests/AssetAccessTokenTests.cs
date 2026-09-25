using System.IdentityModel.Tokens.Jwt;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Platform.Api.Services;
using Xunit;

namespace Platform.Api.IntegrationTests.Tests;

/// <summary>
/// The asset-scoped token in isolation: what it accepts, and every way it must refuse — plus the startup rules
/// for its signing key. Pure unit tests; the HTTP behaviour is in <see cref="AssetAccessTokenHttpTests"/>.
/// </summary>
public class AssetAccessTokenTests
{
    private static readonly byte[] Key = RandomNumberGenerator.GetBytes(48);
    private static readonly Guid Asset = Guid.NewGuid(), Workspace = Guid.NewGuid(), User = Guid.NewGuid();

    private sealed class TestClock(DateTimeOffset now) : TimeProvider
    {
        public DateTimeOffset Now { get; set; } = now;
        public override DateTimeOffset GetUtcNow() => Now;
    }

    private static (AssetAccessTokenService Service, TestClock Clock) NewService(byte[]? key = null)
    {
        var clock = new TestClock(new DateTimeOffset(2026, 9, 21, 12, 0, 0, TimeSpan.Zero));
        return (new AssetAccessTokenService(new AssetAccessOptions { TokenKey = key ?? Key }, clock), clock);
    }

    // ── what it accepts ──────────────────────────────────────────────────

    [Fact]
    public void AFreshToken_CarriesExactlyTheAssetWorkspaceUserOperationAndExpiryItWasIssuedFor()
    {
        var (service, clock) = NewService();

        var claims = service.TryValidate(service.Issue(Asset, Workspace, User, TimeSpan.FromMinutes(10)));

        Assert.NotNull(claims);
        Assert.Equal(Asset, claims.Value.AssetId);
        Assert.Equal(Workspace, claims.Value.WorkspaceId);
        Assert.Equal(User, claims.Value.IdentityId);
        Assert.Equal(AssetTokenOperation.Read, claims.Value.Operation);
        Assert.Equal(clock.Now.AddMinutes(10).ToUnixTimeSeconds(), claims.Value.ExpiresAt.ToUnixTimeSeconds());
    }

    [Fact]
    public void ATokenIsNotAJwt_SoItCannotAuthenticateAsASession()
    {
        var (service, _) = NewService();
        var token = service.Issue(Asset, Workspace, User, TimeSpan.FromMinutes(10));

        // Three dot-separated base64url parts is only the outer shape; it has no JWT header, so it cannot be parsed as one.
        Assert.ThrowsAny<Exception>(() => new JwtSecurityTokenHandler().ReadJwtToken(token));
        Assert.DoesNotContain(User.ToString("D"), token); // the identity is inside the payload, not spelled out
    }

    // ── every way it must refuse ─────────────────────────────────────────

    [Fact]
    public void AnExpiredToken_IsRefused()
    {
        var (service, clock) = NewService();
        var token = service.Issue(Asset, Workspace, User, TimeSpan.FromMinutes(10));

        clock.Now = clock.Now.AddMinutes(10).AddSeconds(1);

        Assert.Null(service.TryValidate(token));
    }

    [Fact]
    public void ATokenIsStillValidUpToItsLastSecond()
    {
        var (service, clock) = NewService();
        var token = service.Issue(Asset, Workspace, User, TimeSpan.FromMinutes(10));

        clock.Now = clock.Now.AddMinutes(10).AddSeconds(-1);

        Assert.NotNull(service.TryValidate(token));
    }

    [Fact]
    public void ATamperedPayload_IsRefused_WhetherItNamesAnotherAssetUserOrTheOperation()
    {
        var (service, _) = NewService();
        var parts = service.Issue(Asset, Workspace, User, TimeSpan.FromMinutes(10)).Split('.');
        var payload = Convert.FromBase64String(Pad(parts[1]));

        foreach (var index in new[] { 0, 16, 32, 48, 56 }) // asset, workspace, identity, operation, expiry
        {
            var tampered = (byte[])payload.Clone();
            tampered[index] ^= 0x01;
            Assert.Null(service.TryValidate($"{parts[0]}.{Url(tampered)}.{parts[2]}"));
        }
    }

    [Fact]
    public void ATamperedOrSubstitutedSignature_IsRefused()
    {
        var (service, _) = NewService();
        var parts = service.Issue(Asset, Workspace, User, TimeSpan.FromMinutes(10)).Split('.');
        var signature = Convert.FromBase64String(Pad(parts[2]));
        signature[0] ^= 0x01;

        Assert.Null(service.TryValidate($"{parts[0]}.{parts[1]}.{Url(signature)}"));
        Assert.Null(service.TryValidate($"{parts[0]}.{parts[1]}.{Url(new byte[32])}"));
        Assert.Null(service.TryValidate($"{parts[0]}.{parts[1]}."));
    }

    [Fact]
    public void ATokenSignedWithAnotherKey_IsRefused()
    {
        var (mine, _) = NewService();
        var (other, _) = NewService(RandomNumberGenerator.GetBytes(48));

        Assert.Null(mine.TryValidate(other.Issue(Asset, Workspace, User, TimeSpan.FromMinutes(10))));
    }

    [Fact]
    public void AnOperationOtherThanRead_IsRefused_EvenWithACorrectSignature()
    {
        var (service, clock) = NewService();

        var forged = Forge(Key, Asset, Workspace, User, operation: 2, clock.Now.AddMinutes(5).ToUnixTimeSeconds());

        Assert.Null(service.TryValidate(forged));
        Assert.NotNull(service.TryValidate(Forge(Key, Asset, Workspace, User, operation: 1, clock.Now.AddMinutes(5).ToUnixTimeSeconds())));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("v1")]
    [InlineData("v1..")]
    [InlineData("v1.a.b")]
    [InlineData("v2.AAAA.BBBB")]
    [InlineData("not a token at all")]
    [InlineData("a.b.c.d")]
    public void MalformedInput_IsRefusedWithoutThrowing(string? token)
    {
        var (service, _) = NewService();

        Assert.Null(service.TryValidate(token));
    }

    [Fact]
    public void AnActualSessionJwt_IsNotAnAssetToken()
    {
        var (service, _) = NewService();
        var jwt = new JwtSecurityTokenHandler().WriteToken(new JwtSecurityToken(expires: DateTime.UtcNow.AddMinutes(5)));

        Assert.Null(service.TryValidate(jwt));
    }

    // ── the signing key's startup rules ──────────────────────────────────

    private sealed class Env(string name) : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = name;
        public string ApplicationName { get; set; } = "Tests";
        public string ContentRootPath { get; set; } = Path.GetTempPath();
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }

    private static IConfiguration Config(string? key) =>
        new ConfigurationBuilder().AddInMemoryCollection(
            key is null ? [] : new Dictionary<string, string?> { [AssetAccessOptions.TokenKeyConfig] = key }).Build();

    private const string JwtKey = "integration-test-signing-key-at-least-32-chars!!";
    private static readonly string GoodKey = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));

    [Fact]
    public void OutsideDevelopment_AGoodDedicatedKey_IsAccepted()
    {
        var options = AssetAccessOptions.Resolve(Config(GoodKey), new Env("Production"), JwtKey);

        Assert.Equal(Encoding.UTF8.GetBytes(GoodKey), options.TokenKey);
    }

    [Theory]
    [InlineData(null, "missing")]
    [InlineData("", "empty")]
    [InlineData("   ", "blank")]
    [InlineData("too-short-key", "under 32 bytes")]
    [InlineData("platform-dev-secret-key-minimum-32-chars!!", "the committed development placeholder")]
    [InlineData("replace-me-with-a-real-secret-please-0123456789", "a placeholder phrase")]
    [InlineData("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "a single repeated character")]
    [InlineData("1212121212121212121212121212121212121212", "low entropy")]
    public void OutsideDevelopment_AnUnusableKey_StopsStartup(string? key, string why)
    {
        var ex = Assert.Throws<InvalidOperationException>(() => AssetAccessOptions.Resolve(Config(key), new Env("Production"), JwtKey));

        Assert.Contains(AssetAccessOptions.TokenKeyConfig, ex.Message);
        _ = why;
    }

    [Fact]
    public void TheKeyMayNeverEqualTheSessionJwtKey_InAnyEnvironment()
    {
        foreach (var env in new[] { "Production", "Development", "Staging" })
            Assert.Throws<InvalidOperationException>(() => AssetAccessOptions.Resolve(Config(JwtKey), new Env(env), JwtKey));
    }

    [Fact]
    public void InDevelopment_AMissingKey_FallsBackToARandomPerProcessOne_SoNoKeyIsEverCommitted()
    {
        var a = AssetAccessOptions.Resolve(Config(null), new Env("Development"), JwtKey);
        var b = AssetAccessOptions.Resolve(Config(null), new Env("Development"), JwtKey);

        Assert.True(a.TokenKey.Length >= 32);
        Assert.NotEqual(a.TokenKey, b.TokenKey);
    }

    [Fact]
    public void InDevelopment_AProvidedButTooShortKey_IsStillRejected()
    {
        Assert.Throws<InvalidOperationException>(() => AssetAccessOptions.Resolve(Config("short"), new Env("Development"), JwtKey));
    }

    // ── the presigned-video lifetime ─────────────────────────────────────

    private static IConfiguration WithLifetime(string? seconds) =>
        new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            [AssetAccessOptions.TokenKeyConfig] = GoodKey,
            [AssetAccessOptions.PresignedLifetimeConfig] = seconds,
        }).Build();

    [Fact]
    public void ThePresignedLifetime_DefaultsToOneHour()
    {
        Assert.Equal(TimeSpan.FromHours(1), AssetAccessOptions.Resolve(WithLifetime(null), new Env("Production"), JwtKey).PresignedReadLifetime);
        Assert.Equal(TimeSpan.FromHours(1), AssetAccessOptions.Resolve(WithLifetime(""), new Env("Production"), JwtKey).PresignedReadLifetime);
    }

    [Theory]
    [InlineData("300", 300)]
    [InlineData("3600", 3600)]
    [InlineData("604800", 604800)]
    public void ProductionAcceptsFiveMinutesUpToSevenDays(string seconds, int expected)
    {
        var options = AssetAccessOptions.Resolve(WithLifetime(seconds), new Env("Production"), JwtKey);

        Assert.Equal(TimeSpan.FromSeconds(expected), options.PresignedReadLifetime);
    }

    [Theory]
    [InlineData("299")]
    [InlineData("30")]
    [InlineData("1")]
    public void ProductionAndStaging_RefuseAnyLifetimeUnderFiveMinutes_AtStartup(string seconds)
    {
        foreach (var env in new[] { "Production", "Staging" })
        {
            var ex = Assert.Throws<InvalidOperationException>(() => AssetAccessOptions.Resolve(WithLifetime(seconds), new Env(env), JwtKey));
            Assert.Contains(AssetAccessOptions.PresignedLifetimeConfig, ex.Message);
        }
    }

    [Theory]
    [InlineData("Development")]
    [InlineData("IntegrationTesting")]
    [InlineData("Testing")]
    public void DevelopmentAndTestHosts_MayUseAShortLifetime_ForTheExpiryAndRefreshPath(string environment)
    {
        var options = AssetAccessOptions.Resolve(WithLifetime("30"), new Env(environment), JwtKey);

        Assert.Equal(TimeSpan.FromSeconds(30), options.PresignedReadLifetime);
    }

    [Theory]
    [InlineData("0")]
    [InlineData("-5")]
    [InlineData("abc")]
    [InlineData("12.5")]
    [InlineData("604801")]
    public void ANonsenseLifetime_IsRefusedInEveryEnvironment(string seconds)
    {
        foreach (var env in new[] { "Production", "Development", "IntegrationTesting" })
            Assert.Throws<InvalidOperationException>(() => AssetAccessOptions.Resolve(WithLifetime(seconds), new Env(env), JwtKey));
    }

    // ── the video delivery switch (TD-023's emergency lever) ─────────────

    private static IConfiguration WithVideoDelivery(string? value) =>
        new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            [AssetAccessOptions.TokenKeyConfig] = GoodKey,
            [AssetAccessOptions.VideoDeliveryConfig] = value,
        }).Build();

    [Fact]
    public void VideoDelivery_DefaultsToPresigned_WhenNotConfigured()
    {
        Assert.Equal(VideoDeliveryMode.Presigned, AssetAccessOptions.Resolve(WithVideoDelivery(null), new Env("Production"), JwtKey).VideoDelivery);
        Assert.Equal(VideoDeliveryMode.Presigned, AssetAccessOptions.Resolve(WithVideoDelivery(""), new Env("Production"), JwtKey).VideoDelivery);
    }

    [Theory]
    [InlineData("Presigned", VideoDeliveryMode.Presigned)]
    [InlineData("presigned", VideoDeliveryMode.Presigned)]
    [InlineData("Proxy", VideoDeliveryMode.Proxy)]
    [InlineData("PROXY", VideoDeliveryMode.Proxy)]
    public void VideoDelivery_AcceptsEitherValue_CaseInsensitively(string configured, VideoDeliveryMode expected)
    {
        Assert.Equal(expected, AssetAccessOptions.Resolve(WithVideoDelivery(configured), new Env("Production"), JwtKey).VideoDelivery);
    }

    [Theory]
    [InlineData("Banana")]
    [InlineData("0")]  // Enum.TryParse would accept these as Presigned/Proxy/undefined —
    [InlineData("1")]  // a typo must never silently pick a delivery mode
    [InlineData("7")]
    public void VideoDelivery_AnUnknownValue_StopsStartup(string configured)
    {
        var ex = Assert.Throws<InvalidOperationException>(
            () => AssetAccessOptions.Resolve(WithVideoDelivery(configured), new Env("Production"), JwtKey));

        Assert.Contains(AssetAccessOptions.VideoDeliveryConfig, ex.Message);
    }

    // ── helpers: re-derive the documented wire format independently of the service ──

    private static string Forge(byte[] key, Guid asset, Guid workspace, Guid user, byte operation, long expiresAt)
    {
        var payload = new byte[49 + 8 - 0];
        payload = new byte[57];
        asset.TryWriteBytes(payload.AsSpan(0, 16));
        workspace.TryWriteBytes(payload.AsSpan(16, 16));
        user.TryWriteBytes(payload.AsSpan(32, 16));
        payload[48] = operation;
        System.Buffers.Binary.BinaryPrimitives.WriteInt64BigEndian(payload.AsSpan(49, 8), expiresAt);

        using var hmac = new HMACSHA256(key);
        var domain = "platform.asset-access-token.v1"u8.ToArray();
        hmac.TransformBlock(domain, 0, domain.Length, null, 0);
        hmac.TransformFinalBlock(payload, 0, payload.Length);
        return $"v1.{Url(payload)}.{Url(hmac.Hash!)}";
    }

    private static string Url(byte[] bytes) => Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static string Pad(string s)
    {
        s = s.Replace('-', '+').Replace('_', '/');
        return s.PadRight(s.Length + (4 - s.Length % 4) % 4, '=');
    }
}
