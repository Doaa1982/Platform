namespace Platform.Api.Services;

/// <summary>
/// The Storage Provider behind a Learning Asset (Learning Asset Aggregate
/// Design §"Storage Information"). One implementation exists today —
/// <see cref="LocalLearningAssetStorage"/> — but the aggregate only ever
/// stores an opaque ObjectKey, so a real object-storage backend (Azure Blob,
/// S3, …) can replace it later without touching Platform.Domain.
/// </summary>
public interface ILearningAssetStorage
{
    /// <summary>The Storage Provider name recorded on the Learning Asset.</summary>
    string ProviderName { get; }

    Task<string> SaveAsync(Guid workspaceId, string fileName, Stream content, CancellationToken ct);

    /// <summary>The physical location of a stored object, for streaming it back with range support.</summary>
    string ResolvePath(string objectKey);

    void Delete(string objectKey);
}
