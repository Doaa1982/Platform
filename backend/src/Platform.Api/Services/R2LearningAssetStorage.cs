using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;
using System.Buffers;
using System.Net.Http;
using Microsoft.Net.Http.Headers;

namespace Platform.Api.Services;

/// <summary>Cloudflare R2 connection settings — section "Storage:R2". Credentials come from secrets/environment, never appsettings.</summary>
public class R2StorageOptions
{
    public const string Section = "Storage:R2";

    /// <summary>Cloudflare account id — the host prefix of the S3 endpoint.</summary>
    public string AccountId { get; set; } = string.Empty;
    public string Bucket { get; set; } = string.Empty;
    public string AccessKeyId { get; set; } = string.Empty;
    public string SecretAccessKey { get; set; } = string.Empty;

    /// <summary>Optional endpoint override (e.g. a jurisdiction-specific R2 endpoint, or a local S3-compatible server in tests).</summary>
    public string? ServiceUrl { get; set; }

    public string ResolvedServiceUrl =>
        string.IsNullOrWhiteSpace(ServiceUrl) ? $"https://{AccountId}.r2.cloudflarestorage.com" : ServiceUrl;

    /// <summary>Fails fast at startup so a half-configured production deploy doesn't discover it on the first upload.</summary>
    public void Validate()
    {
        var missing = new List<string>();
        if (string.IsNullOrWhiteSpace(ServiceUrl) && string.IsNullOrWhiteSpace(AccountId)) missing.Add("AccountId");
        if (string.IsNullOrWhiteSpace(Bucket)) missing.Add("Bucket");
        if (string.IsNullOrWhiteSpace(AccessKeyId)) missing.Add("AccessKeyId");
        if (string.IsNullOrWhiteSpace(SecretAccessKey)) missing.Add("SecretAccessKey");
        if (missing.Count > 0)
            throw new InvalidOperationException(
                $"Storage:Provider is \"R2\" but {string.Join(", ", missing.Select(m => $"{Section}:{m}"))} " +
                "is not configured. Set it through user-secrets or environment variables.");
    }
}

/// <summary>
/// Stores Learning Asset files in Cloudflare R2 through its S3-compatible
/// API. Uploads stream from the request into the bucket one part at a time
/// (never the whole file in memory); reads use ranged GETs so video seeking
/// pulls only the bytes asked for. Egress from R2 is free, which
/// is the reason it was chosen for a video-heavy product.
/// </summary>
public sealed class R2LearningAssetStorage : ILearningAssetStorage, IDisposable
{
    /// <summary>
    /// Each part is buffered whole (one at a time) so it can be sent as a plain
    /// unsigned-payload request. 16 MiB clears R2's 5 MiB minimum part size, and
    /// the 500 MB upload cap stays far under its 10,000-part limit.
    /// </summary>
    private const int PartSize = 16 * 1024 * 1024;

    private readonly IAmazonS3 _s3;
    private readonly string _bucket;

    public R2LearningAssetStorage(R2StorageOptions options)
    {
        _bucket = options.Bucket;
        _s3 = new AmazonS3Client(
            new BasicAWSCredentials(options.AccessKeyId, options.SecretAccessKey),
            new AmazonS3Config
            {
                ServiceURL = options.ResolvedServiceUrl,
                AuthenticationRegion = "auto",
                ForcePathStyle = true,
                MaxErrorRetry = 2,
                // R2 doesn't implement the SDK's newer default trailing-checksum
                // upload framing; only compute/validate checksums when required.
                RequestChecksumCalculation = RequestChecksumCalculation.WHEN_REQUIRED,
                ResponseChecksumValidation = ResponseChecksumValidation.WHEN_REQUIRED,
            });
    }

    public string ProviderName => "R2";

    public async Task<string> SaveAsync(Guid workspaceId, string fileName, Stream content, CancellationToken ct)
    {
        try { return await SaveCoreAsync(workspaceId, fileName, content, ct); }
        catch (Exception ex) when (IsStorageFailure(ex)) { throw new StorageUnavailableException(ex); }
    }

    private async Task<string> SaveCoreAsync(Guid workspaceId, string fileName, Stream content, CancellationToken ct)
    {
        var objectKey = $"{workspaceId:N}/{Guid.NewGuid():N}{Path.GetExtension(fileName)}";

        var buffer = ArrayPool<byte>.Shared.Rent(PartSize);
        try
        {
            var filled = await FillAsync(content, buffer, ct);

            // The whole object fits in one part — a single PutObject, no multipart bookkeeping.
            if (filled < PartSize)
            {
                await _s3.PutObjectAsync(new PutObjectRequest
                {
                    BucketName = _bucket,
                    Key = objectKey,
                    InputStream = new MemoryStream(buffer, 0, filled, writable: false),
                    // R2 rejects the SDK's signed-chunk ("STREAMING-…") upload framing.
                    DisablePayloadSigning = true,
                    UseChunkEncoding = false,
                }, ct);
                return objectKey;
            }

            var upload = await _s3.InitiateMultipartUploadAsync(
                new InitiateMultipartUploadRequest { BucketName = _bucket, Key = objectKey }, ct);
            try
            {
                var parts = new List<PartETag>();
                var partNumber = 1;
                while (filled > 0)
                {
                    var uploaded = await _s3.UploadPartAsync(new UploadPartRequest
                    {
                        BucketName = _bucket,
                        Key = objectKey,
                        UploadId = upload.UploadId,
                        PartNumber = partNumber,
                        PartSize = filled,
                        InputStream = new MemoryStream(buffer, 0, filled, writable: false),
                        DisablePayloadSigning = true,
                        UseChunkEncoding = false,
                    }, ct);
                    parts.Add(new PartETag(partNumber, uploaded.ETag));
                    partNumber++;

                    if (filled < PartSize) break; // that was the last, short part
                    filled = await FillAsync(content, buffer, ct);
                }

                await _s3.CompleteMultipartUploadAsync(new CompleteMultipartUploadRequest
                {
                    BucketName = _bucket, Key = objectKey, UploadId = upload.UploadId, PartETags = parts,
                }, ct);
            }
            catch
            {
                // Don't leave orphaned parts accruing storage charges.
                try
                {
                    await _s3.AbortMultipartUploadAsync(new AbortMultipartUploadRequest
                    {
                        BucketName = _bucket, Key = objectKey, UploadId = upload.UploadId,
                    }, CancellationToken.None);
                }
                catch { /* best effort — the original failure is the one to surface */ }
                throw;
            }

            return objectKey;
        }
        finally
        {
            ArrayPool<byte>.Shared.Return(buffer);
        }
    }

    /// <summary>Reads until <paramref name="buffer"/>'s first <see cref="PartSize"/> bytes are full or the stream ends.</summary>
    private static async Task<int> FillAsync(Stream source, byte[] buffer, CancellationToken ct)
    {
        var total = 0;
        while (total < PartSize)
        {
            var read = await source.ReadAsync(buffer.AsMemory(total, PartSize - total), ct);
            if (read == 0) break;
            total += read;
        }
        return total;
    }

    public async Task<Stream> OpenReadAsync(string objectKey, long offset, long? length, CancellationToken ct)
    {
        var request = new GetObjectRequest { BucketName = _bucket, Key = objectKey };
        if (length is { } count)
            request.ByteRange = new ByteRange(offset, offset + count - 1);
        else if (offset > 0)
            request.ByteRange = new ByteRange($"bytes={offset}-");

        try
        {
            var response = await _s3.GetObjectAsync(request, ct);
            return new ResponseOwningStream(response);
        }
        catch (AmazonS3Exception ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound || ex.ErrorCode == "NoSuchKey")
        {
            throw new StoredObjectNotFoundException(objectKey);
        }
        catch (Exception ex) when (IsStorageFailure(ex))
        {
            throw new StorageUnavailableException(ex);
        }
    }

    public async Task DeleteAsync(string objectKey, CancellationToken ct)
    {
        try { await _s3.DeleteObjectAsync(_bucket, objectKey, ct); }
        catch (Exception ex) when (IsStorageFailure(ex)) { throw new StorageUnavailableException(ex); }
    }

    public bool SupportsPresignedRead => true;

    /// <summary>
    /// Signs locally (no network call). The content type and disposition are baked into the signature as response-header
    /// overrides, so the browser gets what the proxy would have sent, and cannot alter them.
    /// </summary>
    public async Task<PresignedRead> CreatePresignedReadUrlAsync(
        string objectKey, string contentType, string fileName, TimeSpan lifetime, bool inline, CancellationToken ct)
    {
        var expires = DateTime.UtcNow.Add(lifetime);
        var disposition = new ContentDispositionHeaderValue(inline ? "inline" : "attachment");
        disposition.SetHttpFileName(fileName);

        var request = new GetPreSignedUrlRequest
        {
            BucketName = _bucket,
            Key = objectKey,
            Verb = HttpVerb.GET,
            Expires = expires,
            ResponseHeaderOverrides = new ResponseHeaderOverrides
            {
                ContentType = contentType,
                ContentDisposition = disposition.ToString(),
            },
        };

        try
        {
            return new PresignedRead(await _s3.GetPreSignedURLAsync(request), new DateTimeOffset(expires, TimeSpan.Zero));
        }
        catch (Exception ex) when (IsStorageFailure(ex))
        {
            throw new StorageUnavailableException(ex);
        }
    }

    /// <summary>Anything the SDK or the network raises — but never a caller's own cancellation.</summary>
    private static bool IsStorageFailure(Exception ex) =>
        ex is AmazonServiceException or AmazonClientException or HttpRequestException or IOException or TimeoutException
        || (ex is OperationCanceledException && ex.InnerException is not null);

    public void Dispose() => _s3.Dispose();

    /// <summary>Read-only view over a GetObject body that releases the HTTP response when disposed.</summary>
    private sealed class ResponseOwningStream(GetObjectResponse response) : Stream
    {
        private readonly Stream _inner = response.ResponseStream;

        public override bool CanRead => true;
        public override bool CanSeek => false;
        public override bool CanWrite => false;
        public override long Length => throw new NotSupportedException();
        public override long Position { get => throw new NotSupportedException(); set => throw new NotSupportedException(); }

        public override int Read(byte[] buffer, int offset, int count) => _inner.Read(buffer, offset, count);
        public override ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken ct = default) => _inner.ReadAsync(buffer, ct);
        public override Task<int> ReadAsync(byte[] buffer, int offset, int count, CancellationToken ct) => _inner.ReadAsync(buffer, offset, count, ct);
        public override void Flush() { }
        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
        public override void SetLength(long value) => throw new NotSupportedException();
        public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();

        protected override void Dispose(bool disposing)
        {
            if (disposing) response.Dispose();
            base.Dispose(disposing);
        }
    }
}
