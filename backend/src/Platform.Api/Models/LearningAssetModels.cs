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
