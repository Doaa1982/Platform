using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.DependencyInjection;
using Platform.Api.IntegrationTests.Fixtures;
using Platform.Api.Services;
using Xunit;

namespace Platform.Api.IntegrationTests.Tests;

/// <summary>
/// Asset tokens end to end over real HTTP: who can obtain one, what a token opens, and — the part that matters —
/// that every way of failing to redeem one is the very same empty 404, that a token is not a session and a
/// session is not a token, and that none of it puts the session JWT in a URL. Read-only; the "access is revoked
/// after the token was issued" cases are in <see cref="LearningAssetAccessRevocationTests"/>.
/// </summary>
public sealed class AssetAccessTokenHttpTests(AssetAccessFixture fixture) : IClassFixture<AssetAccessFixture>
{
    private AssetAccessWorld W => fixture.World;
    private HttpClient Client => fixture.Client;

    private AssetAccessTokenService Tokens => fixture.Host.Services.GetRequiredService<AssetAccessTokenService>();
    private AssetAccessOptions Options => fixture.Host.Services.GetRequiredService<AssetAccessOptions>();

    private async Task<(string Url, DateTimeOffset ExpiresAt)> IssueAsync(string sessionToken, string slug, Guid assetId, string query = "")
    {
        using var req = new HttpRequestMessage(HttpMethod.Post, $"/api/workspaces/{slug}/learning-assets/{assetId}/access{query}");
        req.Headers.Authorization = new("Bearer", sessionToken);
        var res = await Client.SendAsync(req);
        res.EnsureSuccessStatusCode();
        var json = (await res.Content.ReadFromJsonAsync<JsonObject>())!;
        return (json["url"]!.GetValue<string>(), json["expiresAt"]!.GetValue<DateTimeOffset>());
    }

    private Task<HttpResponseMessage> GetAnonymouslyAsync(string url) => Client.GetAsync(url);

    private string ContentUrl(string slug, Guid assetId, string? token) =>
        $"/api/workspaces/{slug}/learning-assets/{assetId}/content" + (token is null ? "" : $"?t={token}");

    private async Task<string> LearnerSessionAsync(string email) =>
        await TestOnboarding.LoginAsync(Client, email, AssetAccessWorld.LearnerPassword);

    // ── issuance ─────────────────────────────────────────────────────────

    [Fact]
    public async Task Issuance_ReturnsAUrlWithAnAssetTokenAndNeverTheSessionJwt_WithTheRightLifetimePerKind()
    {
        var session = await LearnerSessionAsync(W.EnrolledEmail);

        var (videoUrl, videoExpiry) = await IssueAsync(session, W.Slug, W.Video1);
        var (resourceUrl, resourceExpiry) = await IssueAsync(session, W.Slug, W.VisibleResource);

        foreach (var url in new[] { videoUrl, resourceUrl })
        {
            Assert.Contains("/content?t=v1.", url);
            Assert.DoesNotContain(session, url);
            Assert.DoesNotContain("access_token", url);
        }
        Assert.InRange((videoExpiry - DateTimeOffset.UtcNow).TotalMinutes, 14, 15.1);
        Assert.InRange((resourceExpiry - DateTimeOffset.UtcNow).TotalMinutes, 9, 10.1);
        Assert.Equal(TimeSpan.FromMinutes(15), Options.VideoProxyTokenLifetime);
        Assert.Equal(TimeSpan.FromMinutes(10), Options.AssetTokenLifetime);
    }

    [Fact]
    public async Task Issuance_IsDeniedWithNoTokenInTheBody_ForTheSameReasonsDownloadIs()
    {
        var unenrolled = await LearnerSessionAsync(W.UnenrolledEmail);
        var enrolled = await LearnerSessionAsync(W.EnrolledEmail);

        async Task<HttpResponseMessage> Post(string? session, string slug, Guid asset)
        {
            using var req = new HttpRequestMessage(HttpMethod.Post, $"/api/workspaces/{slug}/learning-assets/{asset}/access");
            if (session is not null) req.Headers.Authorization = new("Bearer", session);
            return await Client.SendAsync(req);
        }

        var forbidden = await Post(unenrolled, W.Slug, W.Video1);
        Assert.Equal(HttpStatusCode.Forbidden, forbidden.StatusCode);
        Assert.DoesNotContain("v1.", await forbidden.Content.ReadAsStringAsync());

        Assert.Equal(HttpStatusCode.Forbidden, (await Post(enrolled, W.Slug, W.TutorOnlyResource)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Post(W.OtherTutorToken, W.Slug, W.Video1)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Post(W.OtherTutorToken, W.OtherSlug, W.Video1)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Post(W.TutorToken, W.Slug, Guid.NewGuid())).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Post(null, W.Slug, W.Video1)).StatusCode);
    }

    // ── redemption: what a valid token opens ─────────────────────────────

    [Fact]
    public async Task ARedeemedToken_ServesTheBytesInlineWithoutAnySession_AndSupportsRanges()
    {
        var (url, _) = await IssueAsync(await LearnerSessionAsync(W.EnrolledEmail), W.Slug, W.Video1);

        var full = await GetAnonymouslyAsync(url);
        Assert.Equal(HttpStatusCode.OK, full.StatusCode);
        Assert.Equal(W.Video1Bytes, await full.Content.ReadAsByteArrayAsync());
        Assert.StartsWith("inline", full.Content.Headers.ContentDisposition!.ToString());
        Assert.Equal("video/mp4", full.Content.Headers.ContentType!.MediaType);

        using var ranged = new HttpRequestMessage(HttpMethod.Get, url);
        ranged.Headers.TryAddWithoutValidation("Range", "bytes=100-199");
        var partial = await Client.SendAsync(ranged);
        Assert.Equal(HttpStatusCode.PartialContent, partial.StatusCode);
        Assert.Equal(W.Video1Bytes[100..200], await partial.Content.ReadAsByteArrayAsync());
    }

    [Fact]
    public async Task TheDownloadLinkVariant_IsAnAttachment_WhileEverythingElseIsInline()
    {
        var (url, _) = await IssueAsync(W.TutorToken, W.Slug, W.VisibleResource, "?disposition=attachment");

        var res = await GetAnonymouslyAsync(url);

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.StartsWith("attachment", res.Content.Headers.ContentDisposition!.ToString());
        Assert.Equal(W.ResourceBytes, await res.Content.ReadAsByteArrayAsync());
    }

    [Fact]
    public async Task TokenizedResponses_CarryTheReferrerAndCachePolicyForTheirKind()
    {
        var session = await LearnerSessionAsync(W.EnrolledEmail);

        var video = await GetAnonymouslyAsync((await IssueAsync(session, W.Slug, W.Video1)).Url);
        var pdf = await GetAnonymouslyAsync((await IssueAsync(session, W.Slug, W.VisibleResource)).Url);
        var cover = await GetAnonymouslyAsync((await IssueAsync(session, W.Slug, W.CoverOfPublished)).Url);

        foreach (var res in new[] { video, pdf, cover })
        {
            Assert.Equal(HttpStatusCode.OK, res.StatusCode);
            Assert.Equal("no-referrer", res.Headers.GetValues("Referrer-Policy").Single());
            Assert.Equal("nosniff", res.Headers.GetValues("X-Content-Type-Options").Single());
        }
        Assert.Equal("no-store, private", string.Join(", ", video.Headers.CacheControl!.ToString().Split(", ").Order()));
        Assert.Equal("no-store, private", string.Join(", ", pdf.Headers.CacheControl!.ToString().Split(", ").Order()));
        Assert.Equal("max-age=300, private", string.Join(", ", cover.Headers.CacheControl!.ToString().Split(", ").Order()));
        Assert.Equal(W.CoverBytes, await cover.Content.ReadAsByteArrayAsync());
    }

    // ── redemption: every failure is the same 404 ────────────────────────

    private async Task<List<(string Label, HttpResponseMessage Response)>> FailingRedemptionsAsync()
    {
        var enrolledSession = await LearnerSessionAsync(W.EnrolledEmail);
        var (goodUrl, _) = await IssueAsync(enrolledSession, W.Slug, W.Video1);
        var goodToken = goodUrl[(goodUrl.IndexOf("t=", StringComparison.Ordinal) + 2)..];

        var parts = goodToken.Split('.');
        var tamperedSignature = $"{parts[0]}.{parts[1]}.{(parts[2][0] == 'A' ? 'B' : 'A')}{parts[2][1..]}";
        var tamperedPayload = $"{parts[0]}.{(parts[1][0] == 'A' ? 'B' : 'A')}{parts[1][1..]}.{parts[2]}";

        var options = Options;
        var pastClock = new PastClock(DateTimeOffset.UtcNow.AddHours(-1));
        var expired = new AssetAccessTokenService(options, pastClock).Issue(W.Video1, W.WorkspaceId, W.EnrolledIdentityId, TimeSpan.FromMinutes(10));
        var otherWorkspaceClaim = Tokens.Issue(W.Video1, Guid.NewGuid(), W.EnrolledIdentityId, TimeSpan.FromMinutes(10));
        var unauthorizedUser = Tokens.Issue(W.Video1, W.WorkspaceId, W.UnenrolledIdentityId, TimeSpan.FromMinutes(10));
        var tokenForAnotherAsset = Tokens.Issue(W.VisibleResource, W.WorkspaceId, W.EnrolledIdentityId, TimeSpan.FromMinutes(10));
        var strangerIdentity = Tokens.Issue(W.Video1, W.WorkspaceId, Guid.NewGuid(), TimeSpan.FromMinutes(10));

        var list = new List<(string, HttpResponseMessage)>
        {
            ("no token", await GetAnonymouslyAsync(ContentUrl(W.Slug, W.Video1, null))),
            ("empty token", await GetAnonymouslyAsync(ContentUrl(W.Slug, W.Video1, ""))),
            ("garbage token", await GetAnonymouslyAsync(ContentUrl(W.Slug, W.Video1, "not-a-token"))),
            ("tampered signature", await GetAnonymouslyAsync(ContentUrl(W.Slug, W.Video1, tamperedSignature))),
            ("tampered payload", await GetAnonymouslyAsync(ContentUrl(W.Slug, W.Video1, tamperedPayload))),
            ("expired token", await GetAnonymouslyAsync(ContentUrl(W.Slug, W.Video1, expired))),
            ("token for another asset", await GetAnonymouslyAsync(ContentUrl(W.Slug, W.Video1, tokenForAnotherAsset))),
            ("token naming another workspace", await GetAnonymouslyAsync(ContentUrl(W.Slug, W.Video1, otherWorkspaceClaim))),
            ("token of a user with no access", await GetAnonymouslyAsync(ContentUrl(W.Slug, W.Video1, unauthorizedUser))),
            ("token of a stranger", await GetAnonymouslyAsync(ContentUrl(W.Slug, W.Video1, strangerIdentity))),
            ("valid token, other workspace's slug", await GetAnonymouslyAsync(ContentUrl(W.OtherSlug, W.Video1, goodToken))),
            ("valid token, unknown workspace", await GetAnonymouslyAsync(ContentUrl("no-such-workspace", W.Video1, goodToken))),
            ("valid token, unknown asset id", await GetAnonymouslyAsync(ContentUrl(W.Slug, Guid.NewGuid(), goodToken))),
            ("session JWT as the token", await GetAnonymouslyAsync(ContentUrl(W.Slug, W.Video1, enrolledSession))),
        };
        return list;
    }

    private sealed class PastClock(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }

    [Fact]
    public async Task EveryFailedRedemption_IsTheSameEmpty404_WithTheSameHeaders()
    {
        var failures = await FailingRedemptionsAsync();

        async Task<(HttpStatusCode Status, string Body, string Headers)> Shape(HttpResponseMessage r) => (
            r.StatusCode,
            await r.Content.ReadAsStringAsync(),
            string.Join("|", r.Headers.Concat(r.Content.Headers)
                .Where(h => h.Key is not ("Date" or "Server" or "traceparent"))
                .OrderBy(h => h.Key).Select(h => $"{h.Key}={string.Join(",", h.Value)}")));

        var reference = await Shape(failures[0].Response);
        Assert.Equal(HttpStatusCode.NotFound, reference.Status);
        Assert.Equal("", reference.Body);
        Assert.Contains("Cache-Control=no-store, private", reference.Headers);
        Assert.Contains("Referrer-Policy=no-referrer", reference.Headers);

        foreach (var (label, response) in failures)
            Assert.True(reference == await Shape(response), $"'{label}' is distinguishable from the others");
    }

    // ── a token is not a session, a session is not a token ───────────────

    [Fact]
    public async Task AnAssetToken_CannotAuthenticateAsASession_AnywhereItIsPresented()
    {
        var (url, _) = await IssueAsync(await LearnerSessionAsync(W.EnrolledEmail), W.Slug, W.Video1);
        var token = url[(url.IndexOf("t=", StringComparison.Ordinal) + 2)..];

        async Task<HttpStatusCode> Send(HttpMethod method, string path, Action<HttpRequestMessage> configure)
        {
            using var req = new HttpRequestMessage(method, path);
            configure(req);
            return (await Client.SendAsync(req)).StatusCode;
        }

        var download = $"/api/workspaces/{W.Slug}/learning-assets/{W.Video1}/download";
        var access = $"/api/workspaces/{W.Slug}/learning-assets/{W.Video1}/access";

        Assert.Equal(HttpStatusCode.Unauthorized, await Send(HttpMethod.Get, download, r => r.Headers.Authorization = new("Bearer", token)));
        Assert.Equal(HttpStatusCode.Unauthorized, await Send(HttpMethod.Post, access, r => r.Headers.Authorization = new("Bearer", token)));
        Assert.Equal(HttpStatusCode.Unauthorized, await Send(HttpMethod.Get, download + $"?t={token}", _ => { }));   // right route family, wrong route
        Assert.Equal(HttpStatusCode.Unauthorized, await Send(HttpMethod.Get, download + $"?access_token={token}", _ => { }));
        Assert.Equal(HttpStatusCode.Unauthorized, await Send(HttpMethod.Get, $"/api/workspaces/{W.Slug}/learn/products?t={token}", _ => { }));
    }

    [Fact]
    public async Task IssuedUrls_NeverContainASessionCredential_ForAnyAssetCategory()
    {
        var session = await LearnerSessionAsync(W.EnrolledEmail);

        foreach (var asset in new[] { W.Video1, W.VisibleResource, W.CoverOfPublished, W.Logo, W.ActivityFile, W.EnrolledSubmissionFile })
        {
            var (url, _) = await IssueAsync(session, W.Slug, asset);
            Assert.DoesNotContain(session, url);
            Assert.DoesNotContain("access_token", url);
            Assert.DoesNotContain("eyJ", url); // no JWT-shaped value anywhere in it
        }
    }
}
