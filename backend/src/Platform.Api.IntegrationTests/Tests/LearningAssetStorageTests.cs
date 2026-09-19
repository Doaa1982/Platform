using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Platform.Api.Services;
using Xunit;

namespace Platform.Api.IntegrationTests.Tests;

/// <summary>
/// The Local development provider and the temp-file helper, exercised against
/// a real directory — no database, no cloud account. Together they prove the
/// storage contract the rest of the app depends on: save, ranged read, delete,
/// missing-object behaviour, and that a temporary local copy never outlives
/// the operation that needed it.
/// </summary>
public sealed class LearningAssetStorageTests : IDisposable
{
    private readonly string _root = Path.Combine(Path.GetTempPath(), "platform-storage-tests-" + Guid.NewGuid().ToString("N"));
    private readonly LocalLearningAssetStorage _storage;

    public LearningAssetStorageTests()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Storage:LearningAssetsPath"] = _root })
            .Build();
        _storage = new LocalLearningAssetStorage(new StubEnvironment(), config);
    }

    public void Dispose()
    {
        if (Directory.Exists(_root)) Directory.Delete(_root, recursive: true);
    }

    private static byte[] Bytes(int count) => Enumerable.Range(0, count).Select(i => (byte)(i % 251)).ToArray();

    private async Task<(string Key, byte[] Data)> SaveAsync(int size = 5000, string name = "lesson.mp4")
    {
        var data = Bytes(size);
        await using var input = new MemoryStream(data);
        var key = await _storage.SaveAsync(Guid.NewGuid(), name, input, CancellationToken.None);
        return (key, data);
    }

    private static async Task<byte[]> ReadAllAsync(Stream s)
    {
        await using (s)
        {
            using var ms = new MemoryStream();
            await s.CopyToAsync(ms);
            return ms.ToArray();
        }
    }

    // ── upload ────────────────────────────────────────────────────────────

    [Fact]
    public async Task Save_StoresTheBytesUnderAWorkspaceScopedOpaqueKey_KeepingTheExtension()
    {
        var workspaceId = Guid.NewGuid();
        await using var input = new MemoryStream(Bytes(100));

        var key = await _storage.SaveAsync(workspaceId, "Lesson One.MP4", input, CancellationToken.None);

        Assert.StartsWith($"{workspaceId:N}/", key);
        Assert.EndsWith(".MP4", key);
        Assert.DoesNotContain("Lesson One", key); // the original file name is display-only, never part of the key
        Assert.Equal(Bytes(100), await ReadAllAsync(await _storage.OpenReadAsync(key, 0, null, default)));
    }

    [Fact]
    public async Task Save_TwoUploadsOfTheSameFileName_NeverCollide()
    {
        var workspaceId = Guid.NewGuid();
        await using var a = new MemoryStream(Bytes(10));
        await using var b = new MemoryStream(Bytes(20));

        var keyA = await _storage.SaveAsync(workspaceId, "same.pdf", a, default);
        var keyB = await _storage.SaveAsync(workspaceId, "same.pdf", b, default);

        Assert.NotEqual(keyA, keyB);
        Assert.Equal(10, (await ReadAllAsync(await _storage.OpenReadAsync(keyA, 0, null, default))).Length);
        Assert.Equal(20, (await ReadAllAsync(await _storage.OpenReadAsync(keyB, 0, null, default))).Length);
    }

    // ── download / ranged read ────────────────────────────────────────────

    [Fact]
    public async Task OpenRead_FromZero_ReturnsTheWholeObject()
    {
        var (key, data) = await SaveAsync();

        var read = await ReadAllAsync(await _storage.OpenReadAsync(key, 0, null, default));

        Assert.Equal(data, read);
    }

    [Fact]
    public async Task OpenRead_WithAnOffset_StartsMidObject_WithoutReadingWhatCameBefore()
    {
        var (key, data) = await SaveAsync();

        var read = await ReadAllAsync(await _storage.OpenReadAsync(key, 3000, null, default));

        Assert.Equal(data[3000..], read);
    }

    // ── missing / deleted ─────────────────────────────────────────────────

    [Fact]
    public async Task OpenRead_OfAKeyThatWasNeverStored_ThrowsNotFound()
    {
        await Assert.ThrowsAsync<StoredObjectNotFoundException>(
            () => _storage.OpenReadAsync($"{Guid.NewGuid():N}/{Guid.NewGuid():N}.mp4", 0, null, default));
    }

    [Fact]
    public async Task Delete_RemovesTheObject_SoALaterReadIsNotFound()
    {
        var (key, _) = await SaveAsync();

        await _storage.DeleteAsync(key, default);

        await Assert.ThrowsAsync<StoredObjectNotFoundException>(() => _storage.OpenReadAsync(key, 0, null, default));
    }

    [Fact]
    public async Task Delete_OfAnObjectThatIsAlreadyGone_IsNotAnError()
    {
        var (key, _) = await SaveAsync();
        await _storage.DeleteAsync(key, default);

        await _storage.DeleteAsync(key, default); // a rollback racing an earlier cleanup must not throw
    }

    // ── temporary local copies ────────────────────────────────────────────

    [Fact]
    public async Task TempFile_HoldsTheObjectsBytes_AndIsDeletedWhenDisposed()
    {
        var (key, data) = await SaveAsync();
        string path;

        await using (var temp = await StorageTempFile.DownloadAsync(_storage, key, default))
        {
            path = temp.Path;
            Assert.True(File.Exists(path));
            Assert.Equal(data, await File.ReadAllBytesAsync(path));
            Assert.EndsWith(".mp4", path); // providers pick a MIME type from the extension
        }

        Assert.False(File.Exists(path));
    }

    [Fact]
    public async Task TempFile_IsStillDeleted_WhenTheWorkUsingItThrows()
    {
        var (key, _) = await SaveAsync();
        string? path = null;

        await Assert.ThrowsAsync<InvalidOperationException>(async () =>
        {
            await using var temp = await StorageTempFile.DownloadAsync(_storage, key, default);
            path = temp.Path;
            throw new InvalidOperationException("the transcription provider blew up");
        });

        Assert.NotNull(path);
        Assert.False(File.Exists(path));
    }

    [Fact]
    public async Task TempFile_OfAMissingObject_ThrowsNotFound_AndLeavesNoFileBehind()
    {
        var before = TempFilesOnDisk();

        await Assert.ThrowsAsync<StoredObjectNotFoundException>(
            () => StorageTempFile.DownloadAsync(_storage, $"{Guid.NewGuid():N}/gone.pdf", default));

        Assert.Equal(before, TempFilesOnDisk());
    }

    [Fact]
    public async Task TempFile_WhenTheDownloadFailsHalfway_LeavesNoPartialFileBehind()
    {
        var before = TempFilesOnDisk();

        await Assert.ThrowsAsync<IOException>(
            () => StorageTempFile.DownloadAsync(new FlakyStorage(), "any/key.mp4", default));

        Assert.Equal(before, TempFilesOnDisk());
    }

    private static string[] TempFilesOnDisk()
    {
        var dir = Path.Combine(Path.GetTempPath(), "platform-asset-downloads");
        return Directory.Exists(dir) ? Directory.GetFiles(dir).OrderBy(f => f).ToArray() : [];
    }

    /// <summary>A storage whose stream yields some bytes and then fails, like a dropped network connection.</summary>
    private sealed class FlakyStorage : ILearningAssetStorage
    {
        public string ProviderName => "Flaky";
        public Task<string> SaveAsync(Guid workspaceId, string fileName, Stream content, CancellationToken ct) => throw new NotSupportedException();
        public Task DeleteAsync(string objectKey, CancellationToken ct) => Task.CompletedTask;
        public Task<Stream> OpenReadAsync(string objectKey, long offset, long? length, CancellationToken ct) =>
            Task.FromResult<Stream>(new FailingStream());

        private sealed class FailingStream : Stream
        {
            private bool _served;
            public override bool CanRead => true;
            public override bool CanSeek => false;
            public override bool CanWrite => false;
            public override long Length => throw new NotSupportedException();
            public override long Position { get => throw new NotSupportedException(); set => throw new NotSupportedException(); }
            public override void Flush() { }
            public override int Read(byte[] buffer, int offset, int count) => throw new NotSupportedException();
            public override ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken ct = default)
            {
                if (_served) throw new IOException("connection reset");
                _served = true;
                buffer.Span[..16].Fill(7);
                return ValueTask.FromResult(16);
            }
            public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
            public override void SetLength(long value) => throw new NotSupportedException();
            public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
        }
    }

    private sealed class StubEnvironment : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = "Testing";
        public string ApplicationName { get; set; } = "Platform.Api.Tests";
        public string ContentRootPath { get; set; } = Path.GetTempPath();
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}
