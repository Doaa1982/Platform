namespace Platform.Api.Services;

/// <summary>
/// Stores Learning Asset files on local disk, under the content root. This is
/// the development default — production selects an object-storage provider
/// via Storage:Provider (see <see cref="R2LearningAssetStorage"/>), because a
/// container's own filesystem is ephemeral and would lose every upload on
/// recreation. ObjectKey is workspace-scoped so a listing or bulk-delete by
/// Workspace stays a directory operation.
/// </summary>
public class LocalLearningAssetStorage(IHostEnvironment env, IConfiguration config) : ILearningAssetStorage
{
    public string ProviderName => "Local";

    private string RootPath =>
        config["Storage:LearningAssetsPath"] is { Length: > 0 } configured
            ? configured
            : Path.Combine(env.ContentRootPath, "App_Data", "learning-assets");

    public async Task<string> SaveAsync(Guid workspaceId, string fileName, Stream content, CancellationToken ct)
    {
        var extension = Path.GetExtension(fileName);
        var objectKey = $"{workspaceId:N}/{Guid.NewGuid():N}{extension}";
        var fullPath = PathFor(objectKey);

        Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);
        await using var fileStream = File.Create(fullPath);
        await content.CopyToAsync(fileStream, ct);

        return objectKey;
    }

    public Task<Stream> OpenReadAsync(string objectKey, long offset, long? length, CancellationToken ct)
    {
        var fullPath = PathFor(objectKey);
        if (!File.Exists(fullPath)) throw new StoredObjectNotFoundException(objectKey);

        var stream = new FileStream(fullPath, FileMode.Open, FileAccess.Read, FileShare.Read,
            bufferSize: 81920, FileOptions.Asynchronous | FileOptions.SequentialScan);
        if (offset > 0) stream.Seek(offset, SeekOrigin.Begin);
        return Task.FromResult<Stream>(stream);
    }

    public Task DeleteAsync(string objectKey, CancellationToken ct)
    {
        var fullPath = PathFor(objectKey);
        if (File.Exists(fullPath)) File.Delete(fullPath);
        return Task.CompletedTask;
    }

    private string PathFor(string objectKey) =>
        Path.Combine(RootPath, objectKey.Replace('/', Path.DirectorySeparatorChar));
}
