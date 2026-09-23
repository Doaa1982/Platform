using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Platform.Api.AI;
using Platform.Api.IntegrationTests.Fixtures;
using Platform.Api.Services;
using Platform.Domain;
using Platform.Infrastructure;
using Xunit;

namespace Platform.Api.IntegrationTests.Tests;

/// <summary>
/// A storage failure's own text can carry a bucket, an object key, an endpoint or a local path. The transcription
/// job saves its failure on the lesson revision, where the tutor reads it, so none of that may get there.
/// </summary>
public class TranscriptErrorSanitizationTests
{
    private const string Bucket = "very-secret-bucket-name";
    private const string Key = "tenant-9f2c/abc123.mp4";
    private const string Endpoint = "acct0123456789.r2.cloudflarestorage.com";
    private const string LocalPath = "/Users/someone/Platform/App_Data/learning-assets";
    private static readonly string[] Markers = [Bucket, Key, "abc123", Endpoint, "acct0123456789", LocalPath, "App_Data"];

    // ── the exception types ──────────────────────────────────────────────

    [Fact]
    public void NotFound_KeepsTheKeyOnAPropertyForLogs_ButNotInItsMessage()
    {
        var ex = new StoredObjectNotFoundException(Key);

        Assert.Equal(Key, ex.ObjectKey);
        Assert.DoesNotContain("tenant", ex.Message);
        Assert.DoesNotContain(Key, ex.ToString().Split('\n')[0]);
    }

    // ── the R2 boundary, against an endpoint that cannot be reached ──────

    [Fact]
    public async Task R2_NetworkAndServiceFailures_BecomeAGenericStorageException_WithNoEndpointBucketOrKeyInTheMessage()
    {
        using var storage = new R2LearningAssetStorage(new R2StorageOptions
        {
            ServiceUrl = "http://127.0.0.1:1", // nothing listens here
            AccountId = "unused", Bucket = Bucket, AccessKeyId = "k", SecretAccessKey = "s",
        });

        var read = await Assert.ThrowsAsync<StorageUnavailableException>(() => storage.OpenReadAsync(Key, 0, null, default));
        var delete = await Assert.ThrowsAsync<StorageUnavailableException>(() => storage.DeleteAsync(Key, default));
        await using var body = new MemoryStream(new byte[100]);
        var save = await Assert.ThrowsAsync<StorageUnavailableException>(() => storage.SaveAsync(Guid.NewGuid(), "x.mp4", body, default));

        foreach (var ex in new Exception[] { read, delete, save })
        {
            Assert.Equal("The file storage is unavailable right now.", ex.Message);
            Assert.NotNull(ex.InnerException); // the real cause is kept for the log
            foreach (var marker in new[] { Bucket, Key, "127.0.0.1" })
                Assert.DoesNotContain(marker, ex.Message);
        }
    }

    // ── what a tutor is shown when a transcription cannot read the video ─

    public sealed class Job(AssetAccessFixture fixture) : IClassFixture<AssetAccessFixture>
    {
        private sealed class LeakyStorage(Exception toThrow) : ILearningAssetStorage
        {
            public string ProviderName => "Leaky";
            public Task<string> SaveAsync(Guid workspaceId, string fileName, Stream content, CancellationToken ct) => throw new NotSupportedException();
            public Task<Stream> OpenReadAsync(string objectKey, long offset, long? length, CancellationToken ct) => throw toThrow;
            public Task DeleteAsync(string objectKey, CancellationToken ct) => Task.CompletedTask;
        }

        private async Task<string> FailedTranscriptErrorAsync(Exception storageFailure)
        {
            var w = fixture.World;
            using var host = fixture.Host.WithWebHostBuilder(b => b.ConfigureTestServices(s =>
            {
                s.RemoveAll<ILearningAssetStorage>();
                s.AddSingleton<ILearningAssetStorage>(new LeakyStorage(storageFailure));
            }));
            using var _ = host.CreateClient(); // starts the host, and its background workers

            Guid revisionId, jobId;
            using (var scope = host.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<PlatformDbContext>();
                var lesson = await db.Lessons.Include(l => l.Revisions).SingleAsync(l => l.Id == w.DraftLessonId);
                var revision = lesson.DraftRevision!;
                jobId = revision.BeginTranscription();
                revisionId = revision.Id;
                await db.SaveChangesAsync();
            }

            host.Services.GetRequiredService<TranscriptionQueue>().Enqueue(new TranscriptionJob(
                w.WorkspaceId, w.DraftLessonId, revisionId, "video3.mp4", jobId, StorageObjectKey: Key));

            for (var i = 0; i < 200; i++)
            {
                using var scope = host.Services.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<PlatformDbContext>();
                var revision = await db.Set<LessonRevision>().AsNoTracking().SingleAsync(r => r.Id == revisionId);
                if (revision.TranscriptStatus == TranscriptStatus.Failed) return revision.TranscriptError!;
                await Task.Delay(50);
            }
            throw new TimeoutException("the transcription job never reached Failed");
        }

        [Fact]
        public async Task AFilesystemOrProviderErrorFullOfPathsAndEndpoints_IsReplacedByAFixedMessage()
        {
            var error = await FailedTranscriptErrorAsync(new IOException(
                $"Could not open '{LocalPath}/{Key}' via https://{Endpoint}/{Bucket}/{Key}: access denied"));

            Assert.Equal("The lesson's video file could not be read from storage. Please try again in a few minutes.", error);
            foreach (var marker in Markers) Assert.DoesNotContain(marker, error);
        }

        [Fact]
        public async Task AMissingFile_TellsTheTutorToReattachTheVideo_WithoutNamingTheKey()
        {
            var error = await FailedTranscriptErrorAsync(new StoredObjectNotFoundException(Key));

            Assert.Equal("The lesson's video file could not be found in storage. Please re-attach the video and try again.", error);
            foreach (var marker in Markers) Assert.DoesNotContain(marker, error);
        }

        [Fact]
        public async Task AStorageOutage_IsAlsoAFixedMessage()
        {
            var error = await FailedTranscriptErrorAsync(new StorageUnavailableException(
                new HttpRequestException($"Connection refused ({Endpoint}:443) for bucket {Bucket}")));

            Assert.Equal("The lesson's video file could not be read from storage. Please try again in a few minutes.", error);
            foreach (var marker in Markers) Assert.DoesNotContain(marker, error);
        }
    }
}
