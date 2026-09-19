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
}

/// <summary>The storage backend has no object under the requested key.</summary>
public class StoredObjectNotFoundException(string objectKey)
    : Exception($"No stored object exists for key \"{objectKey}\".");
