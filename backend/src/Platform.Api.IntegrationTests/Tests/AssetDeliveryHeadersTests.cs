using System.Net;
using Microsoft.Extensions.DependencyInjection;
using Platform.Api.IntegrationTests.Fixtures;
using Platform.Api.Services;
using Xunit;

namespace Platform.Api.IntegrationTests.Tests;

/// <summary>
/// What a redeemed asset URL says about caching and framing. Caching follows what the asset IS (a cover, a logo, a
/// learner-visible lesson image) — never who asks — and anything private stays no-store even when it is an image.
/// </summary>
public sealed class AssetDeliveryHeadersTests(AssetAccessFixture fixture) : IClassFixture<AssetAccessFixture>
{
    private AssetAccessWorld W => fixture.World;

    private async Task<HttpResponseMessage> RedeemAsync(Guid identityId, Guid assetId)
    {
        var token = fixture.Host.Services.GetRequiredService<AssetAccessTokenService>()
            .Issue(assetId, W.WorkspaceId, identityId, TimeSpan.FromMinutes(10));
        return await fixture.Client.GetAsync($"/api/workspaces/{W.Slug}/learning-assets/{assetId}/content?t={token}");
    }

    private static string CacheControl(HttpResponseMessage r) =>
        string.Join(", ", r.Headers.CacheControl!.ToString().Split(", ").Order());

    // ── cacheable for five minutes ───────────────────────────────────────

    [Fact]
    public async Task ACoverALogoAndALearnerVisibleLessonImage_MayBeCachedForFiveMinutes()
    {
        var cover = await RedeemAsync(W.EnrolledIdentityId, W.CoverOfPublished);
        var logo = await RedeemAsync(W.EnrolledIdentityId, W.Logo);
        var lessonImage = await RedeemAsync(W.EnrolledIdentityId, W.VisibleImageResource);

        foreach (var (name, response) in new[] { ("cover", cover), ("logo", logo), ("lesson image", lessonImage) })
        {
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.True("max-age=300, private" == CacheControl(response), $"{name}: {response.Headers.CacheControl}");
        }
        Assert.Equal(W.ImageBytes, await lessonImage.Content.ReadAsByteArrayAsync());
    }

    [Fact]
    public async Task Authors_GetTheSameCachingForTheSameKindOfAsset()
    {
        Assert.Equal("max-age=300, private", CacheControl(await RedeemAsync(W.TutorIdentityId, W.CoverOfPublished)));
        Assert.Equal("max-age=300, private", CacheControl(await RedeemAsync(W.TutorIdentityId, W.VisibleImageResource)));
    }

    // ── one test per case that must stay no-store even though it is an image ──

    [Fact]
    public async Task ATutorOnlyResource_ThatIsAnImage_IsNeverCached()
    {
        var response = await RedeemAsync(W.TutorIdentityId, W.TutorOnlyImageResource); // learners cannot reach it at all

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("image/png", response.Content.Headers.ContentType!.MediaType);
        Assert.Equal("no-store, private", CacheControl(response));
    }

    [Fact]
    public async Task ASubmissionFile_ThatIsAnImage_IsNeverCached()
    {
        var response = await RedeemAsync(W.OtherEnrolledIdentityId, W.SubmissionImage); // its owner

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("image/png", response.Content.Headers.ContentType!.MediaType);
        Assert.Equal("no-store, private", CacheControl(response));
    }

    [Fact]
    public async Task AnActivityFile_ThatIsAnImage_IsNeverCached()
    {
        var response = await RedeemAsync(W.EnrolledIdentityId, W.ActivityImageFile);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("image/png", response.Content.Headers.ContentType!.MediaType);
        Assert.Equal("no-store, private", CacheControl(response));
    }

    // ── an asset with more than one role takes the most private one ──────

    [Fact]
    public async Task ALearnerVisibleLessonImage_ThatIsAlsoAnActivityFile_IsNotCached()
    {
        var response = await RedeemAsync(W.EnrolledIdentityId, W.VisibleAndActivityImage);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("no-store, private", CacheControl(response));
    }

    [Fact]
    public async Task ALearnerVisibleLessonImage_ThatIsAlsoATutorOnlyResource_IsNotCached()
    {
        var response = await RedeemAsync(W.TutorIdentityId, W.VisibleAndHiddenImage);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("no-store, private", CacheControl(response));
    }

    [Fact]
    public async Task AnImageCategoryCover_ThatIsAlsoASubmissionFile_IsNotCached()
    {
        var response = await RedeemAsync(W.OtherEnrolledIdentityId, W.CoverAndSubmissionImage);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("no-store, private", CacheControl(response));
    }

    [Fact]
    public async Task VideosAndDocumentResources_AreNeverCached()
    {
        Assert.Equal("no-store, private", CacheControl(await RedeemAsync(W.EnrolledIdentityId, W.Video1)));
        Assert.Equal("no-store, private", CacheControl(await RedeemAsync(W.EnrolledIdentityId, W.VisibleResource)));
    }

    // ── framing: nothing here may stop a lesson PDF loading in an iframe ─

    [Fact]
    public async Task AnInlinePdf_CarriesNoHeaderThatBlocksFraming()
    {
        var response = await RedeemAsync(W.EnrolledIdentityId, W.VisibleResource);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("application/pdf", response.Content.Headers.ContentType!.MediaType);
        Assert.StartsWith("inline", response.Content.Headers.ContentDisposition!.ToString());

        var all = response.Headers.Concat(response.Content.Headers).Select(h => h.Key.ToLowerInvariant()).ToHashSet();
        Assert.DoesNotContain("x-frame-options", all);
        Assert.DoesNotContain("content-security-policy", all);
        Assert.DoesNotContain("content-security-policy-report-only", all);
        Assert.DoesNotContain("cross-origin-resource-policy", all);
        Assert.DoesNotContain("cross-origin-opener-policy", all);
        Assert.DoesNotContain("cross-origin-embedder-policy", all);
    }
}
