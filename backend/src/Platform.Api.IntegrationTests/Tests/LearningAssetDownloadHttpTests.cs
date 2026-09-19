using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.EntityFrameworkCore;
using Platform.Api.IntegrationTests.Fixtures;
using Platform.Api.Services;
using Platform.Infrastructure;
using Xunit;

namespace Platform.Api.IntegrationTests.Tests;

/// <summary>
/// The whole Learning Asset upload → download path through the real HTTP
/// pipeline (real auth, real EF/Postgres, real controller) on top of the
/// storage abstraction: streamed upload, full and ranged download, workspace
/// isolation, missing objects and unchanged validation errors. Storage is the
/// Local provider pointed at a throwaway directory, so this proves the
/// application flow independent of which storage backend is plugged in.
/// </summary>
public sealed class LearningAssetDownloadHttpTests(PlatformApiTestFixture fixture)
    : IClassFixture<PlatformApiTestFixture>, IDisposable
{
    private readonly string _storageRoot = Path.Combine(Path.GetTempPath(), "platform-asset-http-tests-" + Guid.NewGuid().ToString("N"));

    public void Dispose()
    {
        if (Directory.Exists(_storageRoot)) Directory.Delete(_storageRoot, recursive: true);
    }

    private static readonly byte[] VideoBytes =
        Enumerable.Range(0, 300_000).Select(i => (byte)((i * 31 + 7) % 251)).ToArray();

    private static async Task<Guid> UploadAsync(
        HttpClient client, string token, string slug, byte[] bytes, string fileName, string contentType, string category)
    {
        using var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(bytes);
        file.Headers.ContentType = MediaTypeHeaderValue.Parse(contentType);
        form.Add(file, "file", fileName);
        form.Add(new StringContent(category), "category");

        using var req = new HttpRequestMessage(HttpMethod.Post, $"/api/workspaces/{slug}/learning-assets") { Content = form };
        req.Headers.Authorization = new("Bearer", token);
        var res = await client.SendAsync(req);
        res.EnsureSuccessStatusCode();
        return (await res.Content.ReadFromJsonAsync<JsonObject>())!["id"]!.GetValue<Guid>();
    }

    private static Task<HttpResponseMessage> DownloadAsync(
        HttpClient client, string? token, string slug, Guid assetId, string? range = null)
    {
        var req = new HttpRequestMessage(HttpMethod.Get, $"/api/workspaces/{slug}/learning-assets/{assetId}/download");
        if (token is not null) req.Headers.Authorization = new("Bearer", token);
        if (range is not null) req.Headers.TryAddWithoutValidation("Range", range);
        return client.SendAsync(req);
    }

    private async Task<(HttpClient Client, WebApplicationFactoryHandle Host, TestOnboarding.OnboardedTutor Tutor)> ArrangeAsync(string unique)
    {
        var host = new WebApplicationFactoryHandle(fixture, _storageRoot);
        var client = host.Factory.CreateClient();
        var adminToken = await TestOnboarding.LoginAsync(client, PlatformApiTestFixture.AdminEmail, PlatformApiTestFixture.AdminPassword);
        var tutor = await TestOnboarding.OnboardTutorAsync(client, adminToken, $"{unique}@integrationtest.local", unique);
        return (client, host, tutor);
    }

    [Fact]
    public async Task UploadedVideo_DownloadsInFull_ThenServesRanges_ThenRejectsAnOutOfBoundsRange()
    {
        var (client, host, tutor) = await ArrangeAsync("asset-range-ws");
        using var _ = host;
        var id = await UploadAsync(client, tutor.Token, tutor.WorkspaceSlug, VideoBytes, "Lesson 1.mp4", "video/mp4", "Video");

        var full = await DownloadAsync(client, tutor.Token, tutor.WorkspaceSlug, id);
        Assert.Equal(HttpStatusCode.OK, full.StatusCode);
        Assert.Equal(VideoBytes, await full.Content.ReadAsByteArrayAsync());
        Assert.Equal("video/mp4", full.Content.Headers.ContentType?.MediaType);
        Assert.Equal("bytes", string.Join(",", full.Headers.AcceptRanges));
        Assert.Contains("Lesson 1.mp4", full.Content.Headers.ContentDisposition?.ToString());

        var slice = await DownloadAsync(client, tutor.Token, tutor.WorkspaceSlug, id, "bytes=1000-1999");
        Assert.Equal(HttpStatusCode.PartialContent, slice.StatusCode);
        Assert.Equal(VideoBytes[1000..2000], await slice.Content.ReadAsByteArrayAsync());
        Assert.Equal($"bytes 1000-1999/{VideoBytes.Length}", slice.Content.Headers.ContentRange?.ToString());

        var tail = await DownloadAsync(client, tutor.Token, tutor.WorkspaceSlug, id, "bytes=299000-");
        Assert.Equal(HttpStatusCode.PartialContent, tail.StatusCode);
        Assert.Equal(VideoBytes[299000..], await tail.Content.ReadAsByteArrayAsync());

        var beyond = await DownloadAsync(client, tutor.Token, tutor.WorkspaceSlug, id, "bytes=900000-");
        Assert.Equal(HttpStatusCode.RequestedRangeNotSatisfiable, beyond.StatusCode);
    }

    [Fact]
    public async Task Download_RequiresAuthentication_AndIsIsolatedByWorkspace()
    {
        var (client, host, tutorA) = await ArrangeAsync("asset-iso-a");
        using var _ = host;
        var adminToken = await TestOnboarding.LoginAsync(client, PlatformApiTestFixture.AdminEmail, PlatformApiTestFixture.AdminPassword);
        var tutorB = await TestOnboarding.OnboardTutorAsync(client, adminToken, "asset-iso-b@integrationtest.local", "asset-iso-b");
        var id = await UploadAsync(client, tutorA.Token, tutorA.WorkspaceSlug, VideoBytes, "private.mp4", "video/mp4", "Video");

        var anonymous = await DownloadAsync(client, null, tutorA.WorkspaceSlug, id);
        Assert.Equal(HttpStatusCode.Unauthorized, anonymous.StatusCode);

        // Another workspace's owner cannot read it through workspace A's route…
        var crossRoute = await DownloadAsync(client, tutorB.Token, tutorA.WorkspaceSlug, id);
        Assert.True(crossRoute.StatusCode is HttpStatusCode.Forbidden or HttpStatusCode.NotFound, $"was {crossRoute.StatusCode}");

        // …nor by asking their own workspace's route for A's asset id.
        var crossId = await DownloadAsync(client, tutorB.Token, tutorB.WorkspaceSlug, id);
        Assert.Equal(HttpStatusCode.NotFound, crossId.StatusCode);
    }

    [Fact]
    public async Task Download_OfAnAssetThatDoesNotExist_Is404()
    {
        var (client, host, tutor) = await ArrangeAsync("asset-missing-row");
        using var _ = host;

        var res = await DownloadAsync(client, tutor.Token, tutor.WorkspaceSlug, Guid.NewGuid());

        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
    }

    [Fact]
    public async Task Download_WhenTheRowExistsButTheStoredBytesAreGone_Is404_NotA500()
    {
        var (client, host, tutor) = await ArrangeAsync("asset-missing-bytes");
        using var _ = host;
        var id = await UploadAsync(client, tutor.Token, tutor.WorkspaceSlug, VideoBytes, "gone.mp4", "video/mp4", "Video");

        using (var scope = host.Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<PlatformDbContext>();
            var key = await db.LearningAssets.Where(a => a.Id == id).Select(a => a.ObjectKey).SingleAsync();
            await scope.ServiceProvider.GetRequiredService<ILearningAssetStorage>().DeleteAsync(key, default);
        }

        var res = await DownloadAsync(client, tutor.Token, tutor.WorkspaceSlug, id);

        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
    }

    [Fact]
    public async Task Upload_KeepsItsExistingValidationErrors()
    {
        var (client, host, tutor) = await ArrangeAsync("asset-validation");
        using var _ = host;

        using var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(VideoBytes);
        file.Headers.ContentType = MediaTypeHeaderValue.Parse("video/mp4");
        form.Add(file, "file", "clip.mp4");
        form.Add(new StringContent("Resource"), "category"); // a video can't be filed as a downloadable resource
        using var req = new HttpRequestMessage(HttpMethod.Post, $"/api/workspaces/{tutor.WorkspaceSlug}/learning-assets") { Content = form };
        req.Headers.Authorization = new("Bearer", tutor.Token);

        var res = await client.SendAsync(req);

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.Contains("can't be uploaded as a resource", await res.Content.ReadAsStringAsync());
    }

    /// <summary>A per-test derived host whose storage root is the throwaway directory, disposed with the test.</summary>
    private sealed class WebApplicationFactoryHandle : IDisposable
    {
        public Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactory<Program> Factory { get; }

        public WebApplicationFactoryHandle(PlatformApiTestFixture fixture, string storageRoot) =>
            Factory = fixture.WithWebHostBuilder(b => b.UseSetting("Storage:LearningAssetsPath", storageRoot));

        public void Dispose() => Factory.Dispose();
    }
}
