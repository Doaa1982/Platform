using System.Security.Cryptography;
using Platform.Api.Services;
using Xunit;

namespace Platform.Api.IntegrationTests.Tests;

/// <summary>
/// Runs only when real R2 credentials are supplied through the environment
/// (R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY) — never
/// in CI or on a machine without them, where it reports as skipped. Point it
/// at a scratch bucket: every object it writes is deleted, but it does write.
/// </summary>
public sealed class R2LiveFactAttribute : FactAttribute
{
    public R2LiveFactAttribute()
    {
        if (R2LearningAssetStorageLiveTests.Options() is null)
            Skip = "R2_ACCOUNT_ID / R2_BUCKET / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY are not set.";
    }
}

public sealed class R2LearningAssetStorageLiveTests : IDisposable
{
    private readonly R2LearningAssetStorage? _storage;

    public R2LearningAssetStorageLiveTests()
    {
        if (Options() is { } options) _storage = new R2LearningAssetStorage(options);
    }

    public void Dispose() => _storage?.Dispose();

    internal static R2StorageOptions? Options()
    {
        var accountId = Environment.GetEnvironmentVariable("R2_ACCOUNT_ID");
        var bucket = Environment.GetEnvironmentVariable("R2_BUCKET");
        var accessKey = Environment.GetEnvironmentVariable("R2_ACCESS_KEY_ID");
        var secret = Environment.GetEnvironmentVariable("R2_SECRET_ACCESS_KEY");
        if (string.IsNullOrWhiteSpace(accountId) || string.IsNullOrWhiteSpace(bucket)
            || string.IsNullOrWhiteSpace(accessKey) || string.IsNullOrWhiteSpace(secret)) return null;

        return new R2StorageOptions { AccountId = accountId, Bucket = bucket, AccessKeyId = accessKey, SecretAccessKey = secret };
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

    [R2LiveFact]
    public async Task RoundTrip_LargeUpload_FullRead_RangedReads_Delete_AndMissingObject()
    {
        var storage = _storage!;
        // 20 MB: above the SDK's single-request threshold, so this exercises multipart upload from a non-seekable stream.
        var data = RandomNumberGenerator.GetBytes(20 * 1024 * 1024);
        var workspaceId = Guid.NewGuid();
        string? key = null;

        try
        {
            await using (var input = new NonSeekableStream(data))
                key = await storage.SaveAsync(workspaceId, "live-test.mp4", input, default);

            Assert.StartsWith($"{workspaceId:N}/", key);
            Assert.Equal(SHA256.HashData(data), SHA256.HashData(await ReadAllAsync(await storage.OpenReadAsync(key, 0, null, default))));

            var slice = await ReadAllAsync(await storage.OpenReadAsync(key, 1_000_000, 4096, default));
            Assert.Equal(data[1_000_000..1_004_096], slice);

            var tail = await ReadAllAsync(await storage.OpenReadAsync(key, data.Length - 5000, null, default));
            Assert.Equal(data[^5000..], tail);

            await storage.DeleteAsync(key, default);
            await Assert.ThrowsAsync<StoredObjectNotFoundException>(() => storage.OpenReadAsync(key, 0, null, default));
            await storage.DeleteAsync(key, default); // deleting twice is fine
            key = null;
        }
        finally
        {
            if (key is not null) await storage.DeleteAsync(key, default);
        }
    }

    [R2LiveFact]
    public async Task SmallUpload_TakesTheSingleRequestPath_AndRoundTripsWithRanges()
    {
        var storage = _storage!;
        var data = RandomNumberGenerator.GetBytes(300_000);
        string? key = null;

        try
        {
            await using (var input = new NonSeekableStream(data))
                key = await storage.SaveAsync(Guid.NewGuid(), "small.pdf", input, default);

            Assert.EndsWith(".pdf", key);
            Assert.Equal(data, await ReadAllAsync(await storage.OpenReadAsync(key, 0, null, default)));
            Assert.Equal(data[100..600], await ReadAllAsync(await storage.OpenReadAsync(key, 100, 500, default)));

            await storage.DeleteAsync(key, default);
            key = null;
        }
        finally
        {
            if (key is not null) await storage.DeleteAsync(key, default);
        }
    }

    /// <summary>The shape of a raw request body: forward-only, length unknown — what forces a multipart upload.</summary>
    private sealed class NonSeekableStream(byte[] data) : Stream
    {
        private readonly MemoryStream _inner = new(data);
        public override bool CanRead => true;
        public override bool CanSeek => false;
        public override bool CanWrite => false;
        public override long Length => throw new NotSupportedException();
        public override long Position { get => throw new NotSupportedException(); set => throw new NotSupportedException(); }
        public override void Flush() { }
        public override int Read(byte[] buffer, int offset, int count) => _inner.Read(buffer, offset, count);
        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
        public override void SetLength(long value) => throw new NotSupportedException();
        public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
    }
}
