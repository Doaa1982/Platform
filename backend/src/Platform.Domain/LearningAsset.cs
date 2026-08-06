namespace Platform.Domain;

/// <summary>
/// Learning Asset Aggregate Root (Learning Asset Aggregate Design).
///
/// Owns one uploaded digital resource — today, a video — independently of any
/// Lesson: "A Learning Asset never belongs to a Lesson" (§11). Lesson
/// Revisions reference it by identifier only (INV-003), which is what lets
/// the same recording be reused across lessons without duplicating storage.
///
/// Invariants enforced here:
///   INV-001: exactly one identity.
///   INV-002: may exist unreferenced (nothing here requires a Lesson).
///   INV-006: an archived asset refuses new attachment (see <see cref="RequireAttachable"/>);
///            existing references are left for the caller to decide about.
/// </summary>
public class LearningAsset
{
    public Guid Id { get; private set; }
    public Guid WorkspaceId { get; private set; }
    public Guid UploadedByMembershipId { get; private set; }

    public LearningAssetCategory Category { get; private set; }
    public string Title { get; private set; } = string.Empty;

    /// <summary>The name the file had when it was uploaded — display only, never used to locate storage.</summary>
    public string OriginalFileName { get; private set; } = string.Empty;
    public string ContentType { get; private set; } = string.Empty;
    public long FileSizeBytes { get; private set; }

    /// <summary>Which storage backend holds the object ("Local" today) — Learning Asset Aggregate Design §Storage Information.</summary>
    public string StorageProvider { get; private set; } = string.Empty;

    /// <summary>Opaque key the Storage Provider uses to locate the object. Never exposed to the browser directly.</summary>
    public string ObjectKey { get; private set; } = string.Empty;

    public LearningAssetStatus Status { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }

    private LearningAsset() { }

    public static LearningAsset Upload(
        Guid workspaceId, Guid uploadedByMembershipId, string title,
        string originalFileName, string contentType, long fileSizeBytes,
        string storageProvider, string objectKey)
    {
        if (workspaceId == Guid.Empty)
            throw new ArgumentException("A Learning Asset belongs to exactly one Workspace.", nameof(workspaceId));
        ArgumentException.ThrowIfNullOrWhiteSpace(title);
        ArgumentException.ThrowIfNullOrWhiteSpace(originalFileName);
        ArgumentException.ThrowIfNullOrWhiteSpace(contentType);
        ArgumentException.ThrowIfNullOrWhiteSpace(storageProvider);
        ArgumentException.ThrowIfNullOrWhiteSpace(objectKey);
        if (fileSizeBytes <= 0)
            throw new ArgumentException("An uploaded file cannot be empty.", nameof(fileSizeBytes));

        var now = DateTime.UtcNow;
        return new LearningAsset
        {
            Id = Guid.NewGuid(),
            WorkspaceId = workspaceId,
            UploadedByMembershipId = uploadedByMembershipId,
            Category = LearningAssetCategory.Video,
            Title = title.Trim(),
            OriginalFileName = originalFileName.Trim(),
            ContentType = contentType.Trim(),
            FileSizeBytes = fileSizeBytes,
            StorageProvider = storageProvider,
            ObjectKey = objectKey,
            // No transcoding/enrichment pipeline exists yet, so there is nothing
            // asynchronous to wait for — the file is playable the moment it lands.
            Status = LearningAssetStatus.Ready,
            CreatedAt = now,
            UpdatedAt = now
        };
    }

    /// <summary>Whether this asset may be attached to a Lesson Revision right now (INV-006).</summary>
    public void RequireAttachable()
    {
        if (Status == LearningAssetStatus.Archived)
            throw new InvalidOperationException("An archived learning asset cannot be attached to new lesson content.");
    }

    public void Archive()
    {
        if (Status == LearningAssetStatus.Archived)
            throw new InvalidOperationException("This asset is already archived.");
        Status = LearningAssetStatus.Archived;
        Touch();
    }

    private void Touch() => UpdatedAt = DateTime.UtcNow;
}
