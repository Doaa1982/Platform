using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Platform.Api.IntegrationTests.Fixtures;
using Platform.Api.Services;
using Xunit;

namespace Platform.Api.IntegrationTests.Tests;

/// <summary>
/// Video playback URLs signed by the storage service. Run against a real host whose storage has a fake signer, so we
/// can prove the two things that matter without a network: nothing is signed for anyone who was refused, and a signed
/// URL is never written to a log.
/// </summary>
public sealed class PresignedVideoAccessTests(AssetAccessFixture fixture) : IClassFixture<AssetAccessFixture>
{
    private const string FakeSignature = "FAKE-SIGNATURE-MUST-NEVER-BE-LOGGED-4471";

    private sealed record SignCall(string Key, string ContentType, string FileName, TimeSpan Lifetime, bool Inline);

    private sealed class SigningStorage(ILearningAssetStorage inner, ConcurrentQueue<SignCall> calls) : ILearningAssetStorage
    {
        public string ProviderName => inner.ProviderName;
        public Task<string> SaveAsync(Guid workspaceId, string fileName, Stream content, CancellationToken ct) => inner.SaveAsync(workspaceId, fileName, content, ct);
        public Task<Stream> OpenReadAsync(string objectKey, long offset, long? length, CancellationToken ct) => inner.OpenReadAsync(objectKey, offset, length, ct);
        public Task DeleteAsync(string objectKey, CancellationToken ct) => inner.DeleteAsync(objectKey, ct);

        public bool SupportsPresignedRead => true;

        public Task<PresignedRead> CreatePresignedReadUrlAsync(
            string objectKey, string contentType, string fileName, TimeSpan lifetime, bool inline, CancellationToken ct)
        {
            calls.Enqueue(new SignCall(objectKey, contentType, fileName, lifetime, inline));
            return Task.FromResult(new PresignedRead(
                $"https://bucket.example.r2.test/{objectKey}?X-Amz-Expires={(int)lifetime.TotalSeconds}&X-Amz-Signature={FakeSignature}",
                DateTimeOffset.UtcNow.Add(lifetime)));
        }
    }

    private sealed class CapturingLoggerProvider(ConcurrentQueue<string> lines) : ILoggerProvider
    {
        public ILogger CreateLogger(string categoryName) => new Capture(categoryName, lines);
        public void Dispose() { }
        private sealed class Capture(string category, ConcurrentQueue<string> lines) : ILogger
        {
            public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
            public bool IsEnabled(LogLevel logLevel) => true;
            public void Log<TState>(LogLevel level, EventId id, TState state, Exception? ex, Func<TState, Exception?, string> fmt) =>
                lines.Enqueue($"[{category}] {fmt(state, ex)} {ex}");
        }
    }

    private (HttpClient Client, ConcurrentQueue<SignCall> Calls, ConcurrentQueue<string> Logs, IDisposable Host) SigningHost(string? lifetimeSeconds = null)
    {
        var calls = new ConcurrentQueue<SignCall>();
        var logs = new ConcurrentQueue<string>();
        var host = fixture.Host.WithWebHostBuilder(b =>
        {
            if (lifetimeSeconds is not null) b.UseSetting("Storage:PresignedReadLifetimeSeconds", lifetimeSeconds);
            b.UseSetting("Logging:LogLevel:Default", "Trace");
            b.ConfigureLogging(l => { l.AddProvider(new CapturingLoggerProvider(logs)); l.SetMinimumLevel(LogLevel.Trace); });
            b.ConfigureTestServices(s =>
            {
                s.RemoveAll<ILearningAssetStorage>();
                s.AddSingleton<ILearningAssetStorage>(sp => new SigningStorage(
                    new LocalLearningAssetStorage(sp.GetRequiredService<IHostEnvironment>(), sp.GetRequiredService<IConfiguration>()), calls));
            });
        });
        return (host.CreateClient(), calls, logs, host);
    }

    private AssetAccessWorld W => fixture.World;

    private static async Task<HttpResponseMessage> AccessAsync(HttpClient client, string? session, string slug, Guid assetId, string query = "")
    {
        using var req = new HttpRequestMessage(HttpMethod.Post, $"/api/workspaces/{slug}/learning-assets/{assetId}/access{query}");
        if (session is not null) req.Headers.Authorization = new("Bearer", session);
        return await client.SendAsync(req);
    }

    private Task<string> SessionAsync(HttpClient client, string email) => TestOnboarding.LoginAsync(client, email, AssetAccessWorld.LearnerPassword);

    // ── the video is signed, inline, for an hour ─────────────────────────

    [Fact]
    public async Task AnAuthorizedLearner_GetsAPresignedVideoUrl_InlineWithTheContentTypeOverride_ForAnHour()
    {
        var (client, calls, _, host) = SigningHost();
        using var _ = host;

        var res = await AccessAsync(client, await SessionAsync(client, W.EnrolledEmail), W.Slug, W.Video1);

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var json = (await res.Content.ReadFromJsonAsync<JsonObject>())!;
        Assert.Equal("presigned", json["kind"]!.GetValue<string>());
        Assert.StartsWith("https://bucket.example.r2.test/", json["url"]!.GetValue<string>());
        Assert.InRange((json["expiresAt"]!.GetValue<DateTimeOffset>() - DateTimeOffset.UtcNow).TotalMinutes, 59, 60.1);

        var call = Assert.Single(calls);
        Assert.Equal("video/mp4", call.ContentType);
        Assert.Equal("video1.mp4", call.FileName);
        Assert.True(call.Inline, "playback is inline; attachment is only for an explicit download link");
        Assert.Equal(TimeSpan.FromHours(1), call.Lifetime);
    }

    [Fact]
    public async Task AnExplicitDownloadRequest_IsTheOnlyWayToGetAnAttachment()
    {
        var (client, calls, _, host) = SigningHost();
        using var _ = host;

        var res = await AccessAsync(client, W.TutorToken, W.Slug, W.Video1, "?disposition=attachment");

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.False(Assert.Single(calls).Inline);
    }

    [Fact]
    public async Task TheConfiguredLifetimeIsWhatIsSigned()
    {
        var (client, calls, _, host) = SigningHost(lifetimeSeconds: "45");
        using var _ = host;

        var res = await AccessAsync(client, W.TutorToken, W.Slug, W.Video1);

        var json = (await res.Content.ReadFromJsonAsync<JsonObject>())!;
        Assert.Equal(TimeSpan.FromSeconds(45), Assert.Single(calls).Lifetime);
        Assert.InRange((json["expiresAt"]!.GetValue<DateTimeOffset>() - DateTimeOffset.UtcNow).TotalSeconds, 40, 46);
    }

    // ── no URL is created for anyone who was refused ─────────────────────

    [Fact]
    public async Task NothingIsSigned_ForAnyoneWhoIsRefused()
    {
        var (client, calls, _, host) = SigningHost();
        using var _ = host;
        var unenrolled = await SessionAsync(client, W.UnenrolledEmail);

        Assert.Equal(HttpStatusCode.Forbidden, (await AccessAsync(client, unenrolled, W.Slug, W.Video1)).StatusCode);      // not enrolled
        Assert.Equal(HttpStatusCode.Forbidden, (await AccessAsync(client, unenrolled, W.Slug, W.Video3)).StatusCode);      // draft lesson
        Assert.Equal(HttpStatusCode.NotFound, (await AccessAsync(client, W.OtherTutorToken, W.Slug, W.Video1)).StatusCode); // other workspace
        Assert.Equal(HttpStatusCode.NotFound, (await AccessAsync(client, W.TutorToken, W.Slug, Guid.NewGuid())).StatusCode); // unknown asset
        Assert.Equal(HttpStatusCode.Unauthorized, (await AccessAsync(client, null, W.Slug, W.Video1)).StatusCode);         // no session

        Assert.Empty(calls);
    }

    [Fact]
    public async Task ARefusedRequest_ReturnsNoUrlAtAll()
    {
        var (client, _, _, host) = SigningHost();
        using var _ = host;

        var res = await AccessAsync(client, await SessionAsync(client, W.UnenrolledEmail), W.Slug, W.Video1);
        var body = await res.Content.ReadAsStringAsync();

        Assert.DoesNotContain("https://", body);
        Assert.DoesNotContain("X-Amz", body);
        Assert.DoesNotContain(FakeSignature, body);
    }

    // ── only video is signed; everything else still goes through the API ─

    [Fact]
    public async Task ResourcesAndImages_AreNeverSigned_TheyStayOnTheTokenProxy()
    {
        var (client, calls, _, host) = SigningHost();
        using var _ = host;
        var session = await SessionAsync(client, W.EnrolledEmail);

        foreach (var asset in new[] { W.VisibleResource, W.CoverOfPublished, W.ActivityFile })
        {
            var json = (await (await AccessAsync(client, session, W.Slug, asset)).Content.ReadFromJsonAsync<JsonObject>())!;
            Assert.Equal("proxy", json["kind"]!.GetValue<string>());
            Assert.Contains("/content?t=v1.", json["url"]!.GetValue<string>());
        }
        Assert.Empty(calls);
    }

    [Fact]
    public async Task WhenTheProviderCannotSign_VideoFallsBackToTheFifteenMinuteProxyToken()
    {
        // The regular fixture host uses the Local provider, which cannot presign.
        var session = await TestOnboarding.LoginAsync(fixture.Client, W.EnrolledEmail, AssetAccessWorld.LearnerPassword);

        var res = await AccessAsync(fixture.Client, session, W.Slug, W.Video1);

        var json = (await res.Content.ReadFromJsonAsync<JsonObject>())!;
        Assert.Equal("proxy", json["kind"]!.GetValue<string>());
        Assert.InRange((json["expiresAt"]!.GetValue<DateTimeOffset>() - DateTimeOffset.UtcNow).TotalMinutes, 14, 15.1);
    }

    // ── a signed URL is a credential: never in a log ─────────────────────

    [Fact]
    public async Task ASignedUrl_IsNeverWrittenToALog_EvenWithEveryLevelTurnedOn()
    {
        var (client, _, logs, host) = SigningHost();
        using var _ = host;

        var res = await AccessAsync(client, await SessionAsync(client, W.EnrolledEmail), W.Slug, W.Video1);
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);

        Assert.NotEmpty(logs); // positive control: the capturing provider is attached and saw the request
        foreach (var line in logs)
        {
            Assert.DoesNotContain(FakeSignature, line);
            Assert.DoesNotContain("X-Amz-Signature", line);
            Assert.DoesNotContain("bucket.example.r2.test", line);
        }
    }
}
