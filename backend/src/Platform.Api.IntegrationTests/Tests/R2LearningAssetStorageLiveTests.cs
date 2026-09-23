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

    /// <summary>
    /// A real presigned GET against the dev bucket. The URL is a credential, so nothing here prints it: assertions compare
    /// status codes, headers and bytes only.
    /// </summary>
    [R2LiveFact]
    public async Task PresignedRead_ServesInlineWithTheOverrides_SupportsRanges_RejectsTampering_AndExpires()
    {
        var storage = _storage!;
        Assert.True(storage.SupportsPresignedRead);
        var data = RandomNumberGenerator.GetBytes(300_000);
        string? key = null;
        using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(60) };

        try
        {
            await using (var input = new NonSeekableStream(data))
                key = await storage.SaveAsync(Guid.NewGuid(), "presign-live-test.mp4", input, default);

            // Full read: 200, the bytes, and the response-header overrides we signed (inline + the content type + the file name).
            var signed = await storage.CreatePresignedReadUrlAsync(key, "video/mp4", "Lesson One.mp4", TimeSpan.FromSeconds(120), inline: true, default);
            var full = await http.GetAsync(signed.Url);
            Assert.Equal(System.Net.HttpStatusCode.OK, full.StatusCode);
            Assert.Equal(data, await full.Content.ReadAsByteArrayAsync());
            Assert.Equal("video/mp4", full.Content.Headers.ContentType!.MediaType);
            var disposition = full.Content.Headers.ContentDisposition!.ToString();
            Assert.StartsWith("inline", disposition);
            Assert.Contains("Lesson One.mp4", disposition);

            // A ranged read, the shape a <video> seek makes: 206 and exactly those bytes.
            using (var ranged = new HttpRequestMessage(HttpMethod.Get, signed.Url))
            {
                ranged.Headers.Range = new System.Net.Http.Headers.RangeHeaderValue(100_000, 100_999);
                var partial = await http.SendAsync(ranged);
                Assert.Equal(System.Net.HttpStatusCode.PartialContent, partial.StatusCode);
                Assert.Equal(data[100_000..101_000], await partial.Content.ReadAsByteArrayAsync());
                Assert.Equal(100_000, partial.Content.Headers.ContentRange!.From);
                Assert.Equal(300_000, partial.Content.Headers.ContentRange.Length);
            }

            // An explicit download link is the only thing that signs an attachment.
            var attachment = await storage.CreatePresignedReadUrlAsync(key, "video/mp4", "Lesson One.mp4", TimeSpan.FromSeconds(120), inline: false, default);
            var downloaded = await http.GetAsync(attachment.Url);
            Assert.Equal(System.Net.HttpStatusCode.OK, downloaded.StatusCode);
            Assert.StartsWith("attachment", downloaded.Content.Headers.ContentDisposition!.ToString());

            // Altering the signed content type (an override baked into the signature) is refused.
            var forgedType = signed.Url.Replace("response-content-type=video%2Fmp4", "response-content-type=text%2Fhtml");
            Assert.NotEqual(signed.Url, forgedType);
            Assert.Equal(System.Net.HttpStatusCode.Forbidden, (await http.GetAsync(forgedType)).StatusCode);

            // A damaged signature is refused.
            var signature = System.Text.RegularExpressions.Regex.Match(signed.Url, "X-Amz-Signature=([0-9a-f]{64})").Groups[1].Value;
            Assert.Equal(64, signature.Length);
            var flipped = (signature[0] == 'a' ? 'b' : 'a') + signature[1..]; // same length, wrong value
            var damaged = signed.Url.Replace(signature, flipped);
            Assert.NotEqual(signed.Url, damaged);
            Assert.Equal(System.Net.HttpStatusCode.Forbidden, (await http.GetAsync(damaged)).StatusCode);

            // Expiry: a URL signed for three seconds works now and is refused once that has passed.
            var brief = await storage.CreatePresignedReadUrlAsync(key, "video/mp4", "Lesson One.mp4", TimeSpan.FromSeconds(3), inline: true, default);
            Assert.Equal(System.Net.HttpStatusCode.OK, (await http.GetAsync(brief.Url)).StatusCode);
            await Task.Delay(TimeSpan.FromSeconds(7));
            Assert.Equal(System.Net.HttpStatusCode.Forbidden, (await http.GetAsync(brief.Url)).StatusCode);
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
