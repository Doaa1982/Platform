namespace Platform.Api.Services;

/// <summary>
/// The Storage Provider behind a Learning Asset (Learning Asset Aggregate
/// Design §"Storage Information"). The aggregate only ever stores an opaque
/// ObjectKey, so the backend that holds the bytes (local disk for development,
/// object storage for production) is swappable without touching
/// Platform.Domain. The contract deliberately exposes no filesystem path — an
/// object store has none.
/// </summary>
public interface ILearningAssetStorage
{
    /// <summary>The Storage Provider name recorded on the Learning Asset.</summary>
    string ProviderName { get; }

    /// <summary>Streams <paramref name="content"/> into storage and returns the new opaque ObjectKey.</summary>
    Task<string> SaveAsync(Guid workspaceId, string fileName, Stream content, CancellationToken ct);

    /// <summary>
    /// Opens a forward-only read stream that begins at byte <paramref name="offset"/>.
    /// When <paramref name="length"/> is given the stream yields at most that many
    /// bytes; callers must still bound their own reads by what they asked for.
    /// The caller owns and disposes the stream.
    /// </summary>
    /// <exception cref="StoredObjectNotFoundException">No object exists under <paramref name="objectKey"/>.</exception>
    Task<Stream> OpenReadAsync(string objectKey, long offset, long? length, CancellationToken ct);

    /// <summary>Removes the object. Deleting an object that no longer exists is not an error.</summary>
    Task DeleteAsync(string objectKey, CancellationToken ct);

    /// <summary>
    /// Whether the backend can hand out a time-limited URL the browser fetches directly from the storage service.
    /// Local disk cannot; object storage can. Callers fall back to streaming through the API when it is false.
    /// </summary>
    bool SupportsPresignedRead => false;

    /// <summary>
    /// A time-limited GET URL for the object, signed by the storage service, carrying the given content type and
    /// disposition as response-header overrides so the browser is served exactly what the API itself would send.
    /// Callers must have authorized the read BEFORE calling this, and must never log the returned URL.
    /// </summary>
    Task<PresignedRead> CreatePresignedReadUrlAsync(
        string objectKey, string contentType, string fileName, TimeSpan lifetime, bool inline, CancellationToken ct) =>
        throw new NotSupportedException("This storage provider cannot create presigned URLs.");
}

/// <summary>A signed, expiring URL. The URL is a bearer credential until it expires — treat it like a secret.</summary>
public sealed record PresignedRead(string Url, DateTimeOffset ExpiresAt);

/// <summary>
/// A failure talking to the storage backend. Messages are deliberately generic: a provider's own error text can
/// carry a bucket name, an object key or an endpoint, and these messages can end up in front of a tutor. The
/// original exception is kept as the InnerException for the server-side log.
/// </summary>
public abstract class StorageException(string message, Exception? inner = null) : Exception(message, inner);

/// <summary>The storage backend has no object under the requested key.</summary>
public class StoredObjectNotFoundException(string objectKey)
    : StorageException("The stored file could not be found.")
{
    /// <summary>For server-side diagnostics only — never put this in a user-facing message.</summary>
    public string ObjectKey { get; } = objectKey;
}

/// <summary>The storage backend could not be reached or refused the request (network, credentials, service error).</summary>
public class StorageUnavailableException(Exception inner)
    : StorageException("The file storage is unavailable right now.", inner);
