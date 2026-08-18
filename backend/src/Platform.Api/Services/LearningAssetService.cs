using Microsoft.EntityFrameworkCore;
using Platform.Api.Models;
using Platform.Domain;
using Platform.Infrastructure;

namespace Platform.Api.Services;

/// <summary>
/// Uploading and serving Learning Assets (video, today) — the digital
/// resources a Lesson Revision references but never owns (Learning Asset
/// Aggregate Design §11).
/// </summary>
public class LearningAssetService(PlatformDbContext db, ILearningAssetStorage storage)
{
    private static readonly WorkspaceRoleName[] AuthorRoles =
        [WorkspaceRoleName.Owner, WorkspaceRoleName.Administrator, WorkspaceRoleName.Teacher];

    /// <summary>500MB cap on any single resource file — comfortably above a slide deck, far below "someone's whole hard drive".</summary>
    private const long MaxResourceBytes = 500_000_000;

    /// <summary>10MB cap on a cover photo — generous for a JPEG/PNG, far below a video or slide deck.</summary>
    private const long MaxImageBytes = 10_000_000;

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
        }
        else if (category == LearningAssetCategory.Image)
        {
            if (!contentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
                return Fail<LearningAssetResponse>((ProvisioningError.Invalid, "Only image files can be uploaded as a cover photo."));
            if (length > MaxImageBytes)
                return Fail<LearningAssetResponse>((ProvisioningError.Invalid, "A cover photo cannot be larger than 10MB."));
        }
        else if (length > MaxResourceBytes)
        {
            return Fail<LearningAssetResponse>((ProvisioningError.Invalid, "A resource file cannot be larger than 500MB."));
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
            storage.Delete(objectKey);
            return Fail<LearningAssetResponse>((ProvisioningError.Invalid, ex.Message));
        }

        db.LearningAssets.Add(asset);
        await db.SaveChangesAsync(ct);

        return ProvisioningResult<LearningAssetResponse>.Success(Describe(asset));
    }

    public async Task<ProvisioningResult<(string PhysicalPath, string ContentType, string FileName)>> ResolveDownloadAsync(
        string slug, Guid caller, Guid assetId, CancellationToken ct = default)
    {
        var ctx = await ResolveAsync(slug, caller, requireAuthor: false, ct);
        if (ctx.Error is not null) return Fail<(string, string, string)>(ctx.Error.Value);

        var asset = await db.LearningAssets.AsNoTracking()
            .FirstOrDefaultAsync(a => a.Id == assetId && a.WorkspaceId == ctx.Workspace!.Id, ct);
        if (asset is null) return Fail<(string, string, string)>((ProvisioningError.NotFound, "No such learning asset."));

        return ProvisioningResult<(string, string, string)>.Success(
            (storage.ResolvePath(asset.ObjectKey), asset.ContentType, asset.OriginalFileName));
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

    private static ProvisioningResult<T> Fail<T>((ProvisioningError Error, string Message) e)
        => ProvisioningResult<T>.Fail(e.Error, e.Message);
}
