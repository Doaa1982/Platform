using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using Platform.Api.IntegrationTests.Fixtures;
using Xunit;

namespace Platform.Api.IntegrationTests.Tests;

/// <summary>
/// The batch endpoint issues URLs for Image-category assets only (covers and logos on list screens). Each asset is
/// authorized on its own, and every kind of "no" looks identical, so it cannot be used to probe ids or categories.
/// </summary>
public sealed class AssetBatchAccessTests(AssetAccessFixture fixture) : IClassFixture<AssetAccessFixture>
{
    private AssetAccessWorld W => fixture.World;
    private HttpClient Client => fixture.Client;

    private async Task<HttpResponseMessage> PostAsync(string? session, string slug, object body)
    {
        using var req = new HttpRequestMessage(HttpMethod.Post, $"/api/workspaces/{slug}/learning-assets/access-batch")
        {
            Content = JsonContent.Create(body),
        };
        if (session is not null) req.Headers.Authorization = new("Bearer", session);
        return await Client.SendAsync(req);
    }

    private async Task<JsonArray> ItemsAsync(string session, params Guid[] ids)
    {
        var res = await PostAsync(session, W.Slug, new { assetIds = ids });
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        return (await res.Content.ReadFromJsonAsync<JsonObject>())!["items"]!.AsArray();
    }

    private Task<string> SessionAsync(string email) => TestOnboarding.LoginAsync(Client, email, AssetAccessWorld.LearnerPassword);

    [Fact]
    public async Task ImageAssetsAreIssuedInOneRequest_AndEachUrlOpensItsOwnAsset()
    {
        var session = await SessionAsync(W.EnrolledEmail);

        var items = await ItemsAsync(session, W.CoverOfPublished, W.Logo);

        Assert.Equal(2, items.Count);
        Assert.All(items, i => Assert.True(i!["available"]!.GetValue<bool>()));
        Assert.DoesNotContain(session, items.ToJsonString());

        var coverUrl = items.Single(i => i!["assetId"]!.GetValue<Guid>() == W.CoverOfPublished)!["url"]!.GetValue<string>();
        var opened = await Client.GetAsync(coverUrl);
        Assert.Equal(HttpStatusCode.OK, opened.StatusCode);
        Assert.Equal(W.CoverBytes, await opened.Content.ReadAsByteArrayAsync());
    }

    [Fact]
    public async Task OnlyImageCategoryAssetsAreIssued_VideosResourcesAndActivityFilesAreNot_EvenWhenPermitted()
    {
        var session = await SessionAsync(W.EnrolledEmail);

        // Each of these the enrolled learner may read one at a time — the batch still refuses them.
        var items = await ItemsAsync(session, W.Video1, W.VisibleResource, W.VisibleImageResource, W.ActivityFile);

        Assert.All(items, i =>
        {
            Assert.False(i!["available"]!.GetValue<bool>());
            Assert.Null(i["url"]);
        });
    }

    [Fact]
    public async Task EachAssetIsAuthorizedSeparately_SoOneRefusalNeverAffectsTheOthers()
    {
        var session = await SessionAsync(W.UnenrolledEmail);

        var items = await ItemsAsync(session, W.CoverOfPublished, W.CoverOfDraft, W.Logo, Guid.NewGuid());

        bool Available(Guid id) => items.Single(i => i!["assetId"]!.GetValue<Guid>() == id)!["available"]!.GetValue<bool>();
        Assert.True(Available(W.CoverOfPublished));
        Assert.False(Available(W.CoverOfDraft)); // cover of a product that is still a draft
        Assert.True(Available(W.Logo));
    }

    [Fact]
    public async Task AuthorsMayReadDraftCovers()
    {
        var items = await ItemsAsync(W.TutorToken, W.CoverOfDraft, W.CoverOfPublished);

        Assert.All(items, i => Assert.True(i!["available"]!.GetValue<bool>()));
    }

    [Fact]
    public async Task EveryKindOfRefusal_IsTheSameItemShape_SoNothingCanBeProbed()
    {
        var session = await SessionAsync(W.UnenrolledEmail);
        var unknown = Guid.NewGuid();

        var items = await ItemsAsync(session, W.CoverOfDraft /*forbidden*/, unknown /*no such asset*/, W.Video1 /*wrong category*/, W.ArchivedResource /*archived*/);

        foreach (var item in items.Select(i => i!.AsObject()))
        {
            Assert.False(item["available"]!.GetValue<bool>());
            Assert.Null(item["url"]);
            Assert.Null(item["expiresAt"]);
            Assert.Equal(new[] { "assetId", "available", "expiresAt", "url" }, item.Select(p => p.Key).Order().ToArray());
        }
    }

    [Fact]
    public async Task AnAssetFromAnotherWorkspace_LooksLikeAnyOtherUnavailableAsset()
    {
        var items = await ItemsAsync(W.TutorToken, W.CoverOfPublished); // sanity: through its own workspace it works
        Assert.True(items[0]!["available"]!.GetValue<bool>());

        // The other workspace's owner asking through their own slug for workspace A's cover.
        var res = await PostAsync(W.OtherTutorToken, W.OtherSlug, new { assetIds = new[] { W.CoverOfPublished } });
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var item = (await res.Content.ReadFromJsonAsync<JsonObject>())!["items"]![0]!;
        Assert.False(item["available"]!.GetValue<bool>());
    }

    [Fact]
    public async Task DuplicatesAreAnsweredOnce_AndTheLimitIsFifty()
    {
        var session = await SessionAsync(W.EnrolledEmail);

        var duplicated = await ItemsAsync(session, W.Logo, W.Logo, W.Logo);
        Assert.Single(duplicated);

        var fifty = Enumerable.Range(0, 50).Select(_ => Guid.NewGuid()).ToArray();
        Assert.Equal(HttpStatusCode.OK, (await PostAsync(session, W.Slug, new { assetIds = fifty })).StatusCode);

        var fiftyOne = Enumerable.Range(0, 51).Select(_ => Guid.NewGuid()).ToArray();
        Assert.Equal(HttpStatusCode.BadRequest, (await PostAsync(session, W.Slug, new { assetIds = fiftyOne })).StatusCode);
    }

    [Fact]
    public async Task BadRequests_AndNonMembers_AndAnonymousCallers_AreRefused()
    {
        var session = await SessionAsync(W.EnrolledEmail);

        Assert.Equal(HttpStatusCode.BadRequest, (await PostAsync(session, W.Slug, new { assetIds = Array.Empty<Guid>() })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await PostAsync(session, W.Slug, new { })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await PostAsync(W.OtherTutorToken, W.Slug, new { assetIds = new[] { W.Logo } })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await PostAsync(session, "no-such-workspace", new { assetIds = new[] { W.Logo } })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await PostAsync(null, W.Slug, new { assetIds = new[] { W.Logo } })).StatusCode);
    }

    // ── the session token is never accepted from a query string ──────────

    [Fact]
    public async Task ASessionTokenInTheQueryString_IsNotAccepted_OnAnyRoute()
    {
        var session = await SessionAsync(W.EnrolledEmail);
        var slug = W.Slug;

        async Task<HttpStatusCode> Get(string path) => (await Client.GetAsync(path)).StatusCode;
        async Task<HttpStatusCode> Post(string path) => (await Client.PostAsync(path, null)).StatusCode;

        // The route that used to honour it, and every other learning-assets route.
        Assert.Equal(HttpStatusCode.Unauthorized, await Get($"/api/workspaces/{slug}/learning-assets/{W.Video1}/download?access_token={session}"));
        Assert.Equal(HttpStatusCode.Unauthorized, await Post($"/api/workspaces/{slug}/learning-assets/{W.Video1}/access?access_token={session}"));
        Assert.Equal(HttpStatusCode.Unauthorized, await Post($"/api/workspaces/{slug}/learning-assets/access-batch?access_token={session}"));
        Assert.Equal(HttpStatusCode.Unauthorized, await Get($"/api/workspaces/{slug}/learn/products?access_token={session}"));

        // And a valid session token is not an asset token either.
        Assert.Equal(HttpStatusCode.NotFound, await Get($"/api/workspaces/{slug}/learning-assets/{W.Video1}/content?t={session}"));

        // Positive control: the same session, sent the right way, works.
        using var ok = new HttpRequestMessage(HttpMethod.Get, $"/api/workspaces/{slug}/learning-assets/{W.Video1}/download");
        ok.Headers.Authorization = new("Bearer", session);
        Assert.Equal(HttpStatusCode.OK, (await Client.SendAsync(ok)).StatusCode);
    }
}
