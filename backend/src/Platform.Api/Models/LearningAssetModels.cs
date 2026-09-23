namespace Platform.Api.Models;

public record LearningAssetResponse(
    Guid Id,
    string Title,
    string OriginalFileName,
    string ContentType,
    long FileSizeBytes,
    string Category,
    string Status,
    DateTime CreatedAt);

/// <summary>A short-lived, asset-scoped URL a browser element can load without an Authorization header.</summary>
/// <param name="Kind">"presigned" — a URL signed by the storage service (video); "proxy" — a token URL served through this API.</param>
public record AssetAccessResponse(string Url, DateTimeOffset ExpiresAt, string Kind = "proxy");

public record AssetAccessBatchRequest(IReadOnlyList<Guid> AssetIds);

/// <summary>One asset in a batch. When Available is false there is nothing else — no reason, no category.</summary>
public record AssetAccessBatchItem(Guid AssetId, bool Available, string? Url, DateTimeOffset? ExpiresAt);

public record AssetAccessBatchResponse(IReadOnlyList<AssetAccessBatchItem> Items);

