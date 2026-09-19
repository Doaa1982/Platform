using Microsoft.EntityFrameworkCore;
using Platform.Api.Models;
using Platform.Domain;
using Platform.Infrastructure;

namespace Platform.Api.Services;

/// <summary>
/// Uploading and serving Learning Assets (video, resource files, and cover
/// images) — the digital resources a Lesson Revision references but never
/// owns (Learning Asset Aggregate Design §11). Video and Resource+Image each
/// draw against their own plan-resolved storage entitlement, checked before
/// the file is written.
/// </summary>
public class LearningAssetService(PlatformDbContext db, ILearningAssetStorage storage, EntitlementResolutionService entitlements)
{
    private static readonly WorkspaceRoleName[] AuthorRoles =
        [WorkspaceRoleName.Owner, WorkspaceRoleName.Administrator, WorkspaceRoleName.Teacher];

    /// <summary>500MB cap on any single resource file — comfortably above a slide deck, far below "someone's whole hard drive".</summary>
    private const long MaxResourceBytes = 500_000_000;

    /// <summary>10MB cap on a cover photo — generous for a JPEG/PNG, far below a video or slide deck.</summary>
    private const long MaxImageBytes = 10_000_000;

    /// <summary>
    /// What a lesson Resource may be — documents and the images Extract already
    /// reads (PDF & Image Lesson Content Extraction §5), deliberately excluding
    /// video/audio: those belong to the Video upload path (with its own,
    /// separate storage entitlement), never disguised as a "resource".
    /// </summary>
    private static readonly HashSet<string> AllowedResourceContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "application/pdf",
        "text/plain",
        "text/csv",
        "application/rtf", "text/rtf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp",
    };

    public async Task<ProvisioningResult<LearningAssetResponse>> UploadAsync(
        string slug, Guid caller, string fileName, string contentType, long length, Stream content,
        string? title, LearningAssetCategory category = LearningAssetCategory.Video, CancellationToken ct = default)
    {
        var ctx = await ResolveAsync(slug, caller, requireAuthor: true, ct);
        if (ctx.Error is not null) return Fail<LearningAssetResponse>(ctx.Error.Value);

        if (length <= 0)
            return Fail<LearningAssetResponse>((ProvisioningError.Invalid, "The uploaded file is empty."));

        if (category == LearningAssetCategory.Video)
        {
            if (!contentType.StartsWith("video/", StringComparison.OrdinalIgnoreCase))
                return Fail<LearningAssetResponse>((ProvisioningError.Invalid, "Only video files can be uploaded as a lesson's video today."));
            // Image/Resource both had this friendly check already — Video was
            // relying solely on the controller's [RequestSizeLimit] to reject
            // an oversized file, which returns a bare 413 instead of this
            // same on-brand message.
            if (length > MaxResourceBytes)
                return Fail<LearningAssetResponse>((ProvisioningError.Invalid, "A video file cannot be larger than 500MB."));

            var storageError = await CheckVideoStorageCapacityAsync(ctx.Workspace!.Id, length, ct);
            if (storageError is not null)
                return Fail<LearningAssetResponse>((ProvisioningError.Conflict, storageError));
        }
        else if (category == LearningAssetCategory.Image)
        {
            if (!contentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
                return Fail<LearningAssetResponse>((ProvisioningError.Invalid, "Only image files can be uploaded as a cover photo."));
            if (length > MaxImageBytes)
                return Fail<LearningAssetResponse>((ProvisioningError.Invalid, "A cover photo cannot be larger than 10MB."));

            var storageError = await CheckResourceStorageCapacityAsync(ctx.Workspace!.Id, length, ct);
            if (storageError is not null)
                return Fail<LearningAssetResponse>((ProvisioningError.Conflict, storageError));
        }
        else
        {
            if (!AllowedResourceContentTypes.Contains(contentType))
            {
                return Fail<LearningAssetResponse>((ProvisioningError.Invalid,
                    contentType.StartsWith("video/", StringComparison.OrdinalIgnoreCase)
                    || contentType.StartsWith("audio/", StringComparison.OrdinalIgnoreCase)
                        ? "Video and audio files can't be uploaded as a resource — use the lesson's video upload for those."
                        : "That file type isn't supported as a resource. Allowed: PDF, Word, Excel, PowerPoint, plain text, CSV, RTF, or an image."));
            }

            if (length > MaxResourceBytes)
                return Fail<LearningAssetResponse>((ProvisioningError.Invalid, "A resource file cannot be larger than 500MB."));

            var storageError = await CheckResourceStorageCapacityAsync(ctx.Workspace!.Id, length, ct);
            if (storageError is not null)
                return Fail<LearningAssetResponse>((ProvisioningError.Conflict, storageError));
        }

        var objectKey = await storage.SaveAsync(ctx.Workspace!.Id, fileName, content, ct);

        LearningAsset asset;
        try
        {
            asset = LearningAsset.Upload(
                ctx.Workspace!.Id, ctx.MembershipId, category,
                title: string.IsNullOrWhiteSpace(title) ? fileName : title,
                originalFileName: fileName, contentType: contentType, fileSizeBytes: length,
                storageProvider: storage.ProviderName, objectKey: objectKey);
        }
        catch (ArgumentException ex)
        {
            await storage.DeleteAsync(objectKey, ct);
            return Fail<LearningAssetResponse>((ProvisioningError.Invalid, ex.Message));
        }

        db.LearningAssets.Add(asset);
        await db.SaveChangesAsync(ct);

        return ProvisioningResult<LearningAssetResponse>.Success(Describe(asset));
    }

    /// <summary>
    /// The learner-facing counterpart to <see cref="UploadAsync"/> — a
    /// student attaching their completed work (e.g. a filled-out worksheet)
    /// to an Assignment Submission's Response (Assessment and Submission
    /// Aggregate Design v1.1 §8). Deliberately a separate method rather than
    /// widening UploadAsync's own author check: authoring a Learning Asset
    /// for lesson content and a learner attaching evidence to their own
    /// Submission are different actions with different callers, and keeping
    /// them apart means neither check has to reason about the other's
    /// case. Always Resource category (a student's file is never a lesson
    /// video or a cover image) — same content-type/size rules and the same
    /// resource storage quota apply, since it is real storage either way.
    /// </summary>
    public async Task<ProvisioningResult<LearningAssetResponse>> UploadForSubmissionAsync(
        string slug, Guid caller, string fileName, string contentType, long length, Stream content,
        CancellationToken ct = default)
    {
        var ctx = await ResolveLearnerAsync(slug, caller, ct);
        if (ctx.Error is not null) return Fail<LearningAssetResponse>(ctx.Error.Value);

        if (length <= 0)
            return Fail<LearningAssetResponse>((ProvisioningError.Invalid, "The uploaded file is empty."));

        if (!AllowedResourceContentTypes.Contains(contentType))
        {
            return Fail<LearningAssetResponse>((ProvisioningError.Invalid,
                contentType.StartsWith("video/", StringComparison.OrdinalIgnoreCase)
                || contentType.StartsWith("audio/", StringComparison.OrdinalIgnoreCase)
                    ? "Video and audio files can't be attached to a submission."
                    : "That file type isn't supported. Allowed: PDF, Word, Excel, PowerPoint, plain text, CSV, RTF, or an image."));
        }
        if (length > MaxResourceBytes)
            return Fail<LearningAssetResponse>((ProvisioningError.Invalid, "A file cannot be larger than 500MB."));

        var storageError = await CheckResourceStorageCapacityAsync(ctx.Workspace!.Id, length, ct);
        if (storageError is not null)
            return Fail<LearningAssetResponse>((ProvisioningError.Conflict, storageError));

        var objectKey = await storage.SaveAsync(ctx.Workspace!.Id, fileName, content, ct);

        LearningAsset asset;
        try
        {
            asset = LearningAsset.Upload(
                ctx.Workspace!.Id, ctx.MembershipId, LearningAssetCategory.Resource,
                title: fileName, originalFileName: fileName, contentType: contentType, fileSizeBytes: length,
                storageProvider: storage.ProviderName, objectKey: objectKey);
        }
        catch (ArgumentException ex)
        {
            await storage.DeleteAsync(objectKey, ct);
            return Fail<LearningAssetResponse>((ProvisioningError.Invalid, ex.Message));
        }

        db.LearningAssets.Add(asset);
        await db.SaveChangesAsync(ct);

        return ProvisioningResult<LearningAssetResponse>.Success(Describe(asset));
    }

    /// <summary>
    /// Authorises a download and describes the object to stream — never the
    /// bytes themselves and never a filesystem path, so the same flow works for
    /// any storage backend. <see cref="LearningAssetDownload.ETag"/> is derived
    /// from the (immutable) asset id, not the ObjectKey, which is never exposed
    /// to the browser.
    /// </summary>
    public async Task<ProvisioningResult<LearningAssetDownload>> ResolveDownloadAsync(
        string slug, Guid caller, Guid assetId, CancellationToken ct = default)
    {
        var ctx = await ResolveAsync(slug, caller, requireAuthor: false, ct);
        if (ctx.Error is not null) return Fail<LearningAssetDownload>(ctx.Error.Value);

        var asset = await db.LearningAssets.AsNoTracking()
            .FirstOrDefaultAsync(a => a.Id == assetId && a.WorkspaceId == ctx.Workspace!.Id, ct);
        if (asset is null) return Fail<LearningAssetDownload>((ProvisioningError.NotFound, "No such learning asset."));

        return ProvisioningResult<LearningAssetDownload>.Success(new LearningAssetDownload(
            asset.ObjectKey, asset.ContentType, asset.OriginalFileName, asset.FileSizeBytes,
            ETag: $"\"{asset.Id:N}-{asset.FileSizeBytes}\""));
    }

    public async Task<ProvisioningResult<LearningAssetResponse>> ArchiveAsync(
        string slug, Guid caller, Guid assetId, CancellationToken ct = default)
    {
        var ctx = await ResolveAsync(slug, caller, requireAuthor: true, ct);
        if (ctx.Error is not null) return Fail<LearningAssetResponse>(ctx.Error.Value);

        var asset = await db.LearningAssets.FirstOrDefaultAsync(a => a.Id == assetId && a.WorkspaceId == ctx.Workspace!.Id, ct);
        if (asset is null) return Fail<LearningAssetResponse>((ProvisioningError.NotFound, "No such learning asset."));

        try { asset.Archive(); }
        catch (InvalidOperationException ex) { return Fail<LearningAssetResponse>((ProvisioningError.Conflict, ex.Message)); }

        await db.SaveChangesAsync(ct);
        return ProvisioningResult<LearningAssetResponse>.Success(Describe(asset));
    }

    /// <summary>
    /// Sum of stored video bytes for a workspace, excluding archived assets —
    /// an archived asset's own reference may still be attached to a lesson
    /// (LearningAsset.Archive's INV-006 deliberately leaves existing
    /// references alone), so its bytes are never actually reclaimed on disk,
    /// but excluding it from this sum still gives a tutor "I archived it, it
    /// no longer counts against my quota" — the commercial promise a storage
    /// cap is meant to keep, without touching bytes something might still play.
    /// </summary>
    private async Task<long> GetVideoStorageUsedBytesAsync(Guid workspaceId, CancellationToken ct) =>
        await db.LearningAssets
            .Where(a => a.WorkspaceId == workspaceId && a.Category == LearningAssetCategory.Video && a.Status != LearningAssetStatus.Archived)
            .SumAsync(a => a.FileSizeBytes, ct);

    /// <summary>
    /// Checks whether uploading `incomingBytes` more video would exceed the
    /// plan's video-storage entitlement, mirroring
    /// WorkspaceMemberService.CheckTutorCapacityAsync's shape (live usage vs.
    /// resolved entitlement, friendly rejection message). A Workspace with no
    /// License yet is left unrestricted, same reasoning as tutor capacity.
    /// </summary>
    private async Task<string?> CheckVideoStorageCapacityAsync(Guid workspaceId, long incomingBytes, CancellationToken ct)
    {
        var capacityValue = await entitlements.GetEntitlementValueAsync(
            workspaceId, EntitlementResolutionService.VideoStorageGbKey, ct);
        if (capacityValue is null || !int.TryParse(capacityValue, out var capacityGb))
            return null;

        // Matches this codebase's existing decimal-MB convention (e.g.
        // MaxResourceBytes = 500_000_000), not binary GiB.
        var capacityBytes = capacityGb * 1_000_000_000L;
        var usedBytes = await GetVideoStorageUsedBytesAsync(workspaceId, ct);

        if (usedBytes + incomingBytes <= capacityBytes)
            return null;

        var usedGb = usedBytes / 1_000_000_000.0;
        return $"This workspace's plan allows {capacityGb}GB of video storage — {usedGb:0.#}GB is already used, and this upload would go over. Archive an unused video or upgrade the plan.";
    }

    /// <summary>
    /// Sum of stored Resource+Image bytes for a workspace, excluding archived
    /// assets — same reasoning as <see cref="GetVideoStorageUsedBytesAsync"/>,
    /// a separate pool from video since non-video material (slides, handouts,
    /// cover photos) is typically a much smaller quota.
    /// </summary>
    private async Task<long> GetResourceStorageUsedBytesAsync(Guid workspaceId, CancellationToken ct) =>
        await db.LearningAssets
            .Where(a => a.WorkspaceId == workspaceId
                     && (a.Category == LearningAssetCategory.Resource || a.Category == LearningAssetCategory.Image)
                     && a.Status != LearningAssetStatus.Archived)
            .SumAsync(a => a.FileSizeBytes, ct);

    /// <summary>Mirrors <see cref="CheckVideoStorageCapacityAsync"/>, for the separate resource-storage entitlement.</summary>
    private async Task<string?> CheckResourceStorageCapacityAsync(Guid workspaceId, long incomingBytes, CancellationToken ct)
    {
        var capacityValue = await entitlements.GetEntitlementValueAsync(
            workspaceId, EntitlementResolutionService.ResourceStorageGbKey, ct);
        if (capacityValue is null || !int.TryParse(capacityValue, out var capacityGb))
            return null;

        var capacityBytes = capacityGb * 1_000_000_000L;
        var usedBytes = await GetResourceStorageUsedBytesAsync(workspaceId, ct);

        if (usedBytes + incomingBytes <= capacityBytes)
            return null;

        var usedGb = usedBytes / 1_000_000_000.0;
        return $"This workspace's plan allows {capacityGb}GB of resource storage — {usedGb:0.#}GB is already used, and this upload would go over. Archive an unused file or upgrade the plan.";
    }

    internal async Task<LearningAsset?> FindAsync(Guid workspaceId, Guid assetId, CancellationToken ct = default) =>
        await db.LearningAssets.FirstOrDefaultAsync(a => a.Id == assetId && a.WorkspaceId == workspaceId, ct);

    internal static LearningAssetResponse Describe(LearningAsset a) => new(
        a.Id, a.Title, a.OriginalFileName, a.ContentType, a.FileSizeBytes,
        a.Category.ToString(), a.Status.ToString(), a.CreatedAt);

    private record Context(Workspace? Workspace, Guid MembershipId, (ProvisioningError Error, string Message)? Error);

    private async Task<Context> ResolveAsync(string slug, Guid caller, bool requireAuthor, CancellationToken ct)
    {
        var normalised = slug.ToLowerInvariant().Trim();

        var workspace = await db.Workspaces.AsNoTracking().FirstOrDefaultAsync(w => w.Slug == normalised, ct);
        if (workspace is null) return new Context(null, Guid.Empty, (ProvisioningError.NotFound, "No such workspace."));

        var member = await db.Memberships.Include(m => m.Roles).AsNoTracking()
            .FirstOrDefaultAsync(m => m.WorkspaceId == workspace.Id && m.IdentityId == caller
                                   && m.Status == MembershipStatus.Active, ct);
        if (member is null) return new Context(null, Guid.Empty, (ProvisioningError.NotFound, "No such workspace."));

        if (requireAuthor && !member.Roles.Any(r => AuthorRoles.Contains(r.Name)))
            return new Context(null, member.Id, (ProvisioningError.Forbidden, "Only an owner, administrator or teacher can author content."));

        return new Context(workspace, member.Id, null);
    }

    /// <summary>Same resolution as <see cref="ResolveAsync"/>, gated to the Learner role instead of AuthorRoles — matches AssignmentService's own learner-context resolver.</summary>
    private async Task<Context> ResolveLearnerAsync(string slug, Guid caller, CancellationToken ct)
    {
        var normalised = slug.ToLowerInvariant().Trim();

        var workspace = await db.Workspaces.AsNoTracking().FirstOrDefaultAsync(w => w.Slug == normalised, ct);
        if (workspace is null) return new Context(null, Guid.Empty, (ProvisioningError.NotFound, "No such workspace."));

        var member = await db.Memberships.Include(m => m.Roles).AsNoTracking()
            .FirstOrDefaultAsync(m => m.WorkspaceId == workspace.Id && m.IdentityId == caller && m.Status == MembershipStatus.Active, ct);
        if (member is null) return new Context(null, Guid.Empty, (ProvisioningError.NotFound, "No such workspace."));

        if (!member.Roles.Any(r => r.Name == WorkspaceRoleName.Learner))
            return new Context(null, member.Id, (ProvisioningError.Forbidden, "Only a Learner in this workspace can access this."));

        return new Context(workspace, member.Id, null);
    }

    private static ProvisioningResult<T> Fail<T>((ProvisioningError Error, string Message) e)
        => ProvisioningResult<T>.Fail(e.Error, e.Message);
}

/// <summary>Everything the download endpoint needs to stream one Learning Asset from storage.</summary>
public record LearningAssetDownload(string ObjectKey, string ContentType, string FileName, long Length, string ETag);
