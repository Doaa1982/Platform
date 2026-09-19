namespace Platform.Api.Services;

/// <summary>
/// A stored object materialised as a temporary local file, for the few
/// operations whose library genuinely needs a filesystem path (AI document
/// extraction, the transcription providers). Disposing deletes the file, so
/// <c>await using</c> guarantees cleanup on success, failure and cancellation.
/// </summary>
public sealed class StorageTempFile : IAsyncDisposable
{
    private const string TempSubdirectory = "platform-asset-downloads";

    private readonly ILogger? _logger;

    public string Path { get; }

    private StorageTempFile(string path, ILogger? logger)
    {
        Path = path;
        _logger = logger;
    }

    /// <summary>Downloads <paramref name="objectKey"/> into a fresh temp file. A failed download leaves no file behind.</summary>
    public static async Task<StorageTempFile> DownloadAsync(
        ILearningAssetStorage storage, string objectKey, CancellationToken ct, ILogger? logger = null)
    {
        var directory = System.IO.Path.Combine(System.IO.Path.GetTempPath(), TempSubdirectory);
        Directory.CreateDirectory(directory);
        var path = System.IO.Path.Combine(directory,
            $"{Guid.NewGuid():N}{System.IO.Path.GetExtension(objectKey)}");

        try
        {
            await using var source = await storage.OpenReadAsync(objectKey, 0, null, ct);
            await using var target = File.Create(path);
            await source.CopyToAsync(target, ct);
        }
        catch
        {
            TryDelete(path, logger);
            throw;
        }

        return new StorageTempFile(path, logger);
    }

    public ValueTask DisposeAsync()
    {
        TryDelete(Path, _logger);
        return ValueTask.CompletedTask;
    }

    private static void TryDelete(string path, ILogger? logger)
    {
        try
        {
            if (File.Exists(path)) File.Delete(path);
        }
        catch (Exception ex)
        {
            logger?.LogWarning(ex, "Failed to delete temporary asset file {FilePath}", path);
        }
    }
}
