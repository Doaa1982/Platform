namespace Platform.Api.Services;

/// <summary>
/// Stores Learning Asset files on local disk, under the content root. No
/// object-storage account exists in this environment yet (Platform.AppHost
/// declares only Postgres) — this keeps uploads real and durable across
/// restarts without taking on a cloud storage dependency the project hasn't
/// adopted. ObjectKey is workspace-scoped so a listing or bulk-delete by
/// Workspace stays a directory operation.
///
/// Durability today is real but scoped to this machine: RootPath sits beside
/// the project's own source (App_Data/, gitignored), which survives a
/// `dotnet build`/restart same as Postgres's own bind-mounted-by-default data
/// does. It stops being durable the moment the API is containerized rather
/// than run as a plain Aspire project — App_Data would then live inside the
/// container's own ephemeral filesystem and vanish on recreation. Whenever
/// that happens, this needs a mounted volume at RootPath, the same pattern
/// Platform.AppHost/Program.cs already uses for Postgres
/// (`.WithDataVolume("PlatformData")`) and speaches (`.WithVolume(...)`) —
/// not a code change here, an AppHost one.
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
        var fullPath = ResolvePath(objectKey);

        Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);
        await using var fileStream = File.Create(fullPath);
        await content.CopyToAsync(fileStream, ct);

        return objectKey;
    }

    public string ResolvePath(string objectKey) =>
        Path.Combine(RootPath, objectKey.Replace('/', Path.DirectorySeparatorChar));

    public void Delete(string objectKey)
    {
        var fullPath = ResolvePath(objectKey);
        if (File.Exists(fullPath)) File.Delete(fullPath);
    }
}
