using Microsoft.EntityFrameworkCore;
using Platform.Domain;
using Platform.Infrastructure;

namespace Platform.Api.Services;

public sealed record AssetAccessDecision(
    LearningAsset? Asset, Guid WorkspaceId, Guid MembershipId, bool IsAuthor,
    (ProvisioningError Error, string Message)? Denied)
{
    public bool Allowed => Denied is null;
}

/// <summary>
/// The single answer to "may this person read this Learning Asset". Every route
/// that hands out asset bytes — the proxy download, and later the presigned
/// video URL and the asset token — asks this class, so there is exactly one
/// rule set. It reuses <see cref="LearnerAccess"/> (the same admission,
/// enrollment, lock and assignment-visibility code lesson and assignment
/// delivery run), and decides by looking up where the asset is referenced:
///
///   Authors (Owner/Administrator/Teacher)  any asset in their own workspace, archived included.
///   Learners, never                        an Archived asset.
///   Lesson video / resource                Learner role, Published lesson, Active or Completed enrollment,
///                                          lesson not locked, and the asset is on the revision the learner is
///                                          served (their pinned one, else the current one). Resources must also
///                                          be VisibleToLearners.
///   Activity file                          the assignment view's rule (LearnerAccess.EvaluateAssignmentAccessAsync) AND the
///                                          lesson must be Published — stricter than the assignment view, which does not check it.
///   Submission file                        the submitting learner (with the assignment still visible to them).
///   Cover image                            any Active member, while the product is Published.
///   Workspace logo                         any Active member.
///   Unreferenced asset                     its uploader, who must still be an Active member.
///
/// Non-members and cross-workspace or unknown asset ids all get the same
/// NotFound so ids cannot be probed. A member who lacks access to an asset that
/// does exist in their workspace gets Forbidden.
/// </summary>
public class LearningAssetAccessPolicy(
    PlatformDbContext db, LearnerAccess learnerAccess, ILogger<LearningAssetAccessPolicy> logger)
{
    private static readonly WorkspaceRoleName[] AuthorRoles =
        [WorkspaceRoleName.Owner, WorkspaceRoleName.Administrator, WorkspaceRoleName.Teacher];

    private const string NotFoundMessage = "No such learning asset.";
    private const string ForbiddenMessage = "You don't have access to this file.";

    /// <summary>The caller as this workspace knows them: an Active member, and which of the roles this policy cares about.</summary>
    public sealed record AssetReader(Workspace Workspace, Membership Member, Guid IdentityId)
    {
        public bool IsAuthor => Member.Roles.Any(r => AuthorRoles.Contains(r.Name));
        public bool IsLearner => Member.Roles.Any(r => r.Name == WorkspaceRoleName.Learner);
    }

    /// <summary>Workspace and Active-membership lookup, done once so a batch of assets doesn't repeat it. Null for a non-member or unknown workspace.</summary>
    public async Task<AssetReader?> ResolveReaderAsync(string slug, Guid callerIdentityId, CancellationToken ct = default)
    {
        var normalised = slug.ToLowerInvariant().Trim();

        var workspace = await db.Workspaces.AsNoTracking().FirstOrDefaultAsync(w => w.Slug == normalised, ct);
        var member = workspace is null ? null : await db.Memberships.Include(m => m.Roles).AsNoTracking()
            .FirstOrDefaultAsync(m => m.WorkspaceId == workspace.Id && m.IdentityId == callerIdentityId
                                   && m.Status == MembershipStatus.Active, ct);
        return workspace is null || member is null ? null : new AssetReader(workspace, member, callerIdentityId);
    }

    public async Task<AssetAccessDecision> AuthorizeReadAsync(
        string slug, Guid callerIdentityId, Guid assetId, CancellationToken ct = default)
    {
        var reader = await ResolveReaderAsync(slug, callerIdentityId, ct);
        if (reader is null)
            return Deny(null, Guid.Empty, Guid.Empty, false, ProvisioningError.NotFound, NotFoundMessage,
                "non-member or unknown workspace", assetId, null, callerIdentityId);

        return await AuthorizeAsync(reader, assetId, ct);
    }

    /// <summary>Authorizes one asset for an already-resolved reader. Each asset in a batch is decided on its own.</summary>
    public async Task<AssetAccessDecision> AuthorizeAsync(AssetReader reader, Guid assetId, CancellationToken ct = default)
    {
        var workspace = reader.Workspace;
        var member = reader.Member;
        var callerIdentityId = reader.IdentityId;

        var asset = await db.LearningAssets.AsNoTracking()
            .FirstOrDefaultAsync(a => a.Id == assetId && a.WorkspaceId == workspace.Id, ct);
        if (asset is null)
            return Deny(null, workspace.Id, member.Id, false, ProvisioningError.NotFound, NotFoundMessage,
                "no such asset in this workspace", assetId, workspace.Id, callerIdentityId);

        if (reader.IsAuthor) return Allow(asset, workspace.Id, member.Id, true);

        if (asset.Status == LearningAssetStatus.Archived)
            return Deny(asset, workspace.Id, member.Id, false, ProvisioningError.Forbidden, ForbiddenMessage,
                "archived", assetId, workspace.Id, callerIdentityId);

        var isLearner = reader.IsLearner;
        var referenced = false;

        // ── Workspace logo / product cover: any Active member ────────────────
        if (await db.Workspaces.AsNoTracking().AnyAsync(w => w.Id == workspace.Id && w.LogoAssetId == assetId, ct))
            return Allow(asset, workspace.Id, member.Id, false);

        var coverProducts = await db.LearningProducts.AsNoTracking()
            .Where(p => p.WorkspaceId == workspace.Id && p.CoverImageAssetId == assetId)
            .Select(p => p.Status).ToListAsync(ct);
        if (coverProducts.Count > 0) referenced = true;
        if (coverProducts.Contains(LearningProductStatus.Published))
            return Allow(asset, workspace.Id, member.Id, false);

        // ── Lesson video and resources ───────────────────────────────────────
        var videoRevisionIds = await db.Set<LessonRevision>().AsNoTracking()
            .Where(r => r.VideoAssetId == assetId).Select(r => r.Id).ToListAsync(ct);
        var resources = await db.LessonResources.AsNoTracking()
            .Where(r => r.LearningAssetId == assetId)
            .Select(r => new { r.LessonRevisionId, r.VisibleToLearners }).ToListAsync(ct);
        var lessonRevisionIds = videoRevisionIds
            .Concat(resources.Where(r => r.VisibleToLearners).Select(r => r.LessonRevisionId))
            .ToHashSet();
        if (videoRevisionIds.Count > 0 || resources.Count > 0) referenced = true;

        if (isLearner && lessonRevisionIds.Count > 0
            && await LessonRevisionServedToLearnerAsync(workspace.Id, member.Id, lessonRevisionIds, ct))
            return Allow(asset, workspace.Id, member.Id, false);

        // ── Activity file: the assignment view's rule, plus the lesson must be Published ──
        var activities = await (
            from a in db.LearningActivities.AsNoTracking()
            join r in db.Set<LessonRevision>().AsNoTracking() on a.LessonRevisionId equals r.Id
            join l in db.Lessons.AsNoTracking() on r.LessonId equals l.Id
            where a.ActivityFileAssetId == assetId
            select new { ActivityId = a.Id, LessonPublished = l.Status == LessonStatus.Published && l.WorkspaceId == workspace.Id }
        ).ToListAsync(ct);
        if (activities.Count > 0) referenced = true;
        if (isLearner)
        {
            foreach (var activity in activities.Where(a => a.LessonPublished))
            {
                var access = await learnerAccess.EvaluateAssignmentAccessAsync(workspace.Id, member.Id, activity.ActivityId, ct);
                if (access.Denied is null) return Allow(asset, workspace.Id, member.Id, false);
            }
        }

        // ── Submission file: the submitting learner only ─────────────────────
        var submissions = await db.Submissions.AsNoTracking()
            .Where(s => s.ResponseLearningAssetId == assetId)
            .Select(s => new { s.MembershipId, s.AssignmentId }).ToListAsync(ct);
        if (submissions.Count > 0) referenced = true;
        if (isLearner)
        {
            foreach (var mine in submissions.Where(s => s.MembershipId == member.Id))
            {
                var activityId = await db.Assignments.AsNoTracking()
                    .Where(a => a.Id == mine.AssignmentId && a.WorkspaceId == workspace.Id)
                    .Select(a => (Guid?)a.LearningActivityId).FirstOrDefaultAsync(ct);
                if (activityId is null) continue;
                var access = await learnerAccess.EvaluateAssignmentAccessAsync(workspace.Id, member.Id, activityId.Value, ct);
                if (access.Denied is null) return Allow(asset, workspace.Id, member.Id, false);
            }
        }

        // ── Unreferenced: its uploader (who is an Active member — resolved above) ──
        if (!referenced && asset.UploadedByMembershipId == member.Id)
            return Allow(asset, workspace.Id, member.Id, false);

        return Deny(asset, workspace.Id, member.Id, false, ProvisioningError.Forbidden, ForbiddenMessage,
            "not authorized by any reference", assetId, workspace.Id, callerIdentityId);
    }

    /// <summary>
    /// Whether a response for this asset may be held in the browser cache for a few minutes. Decided by what the asset
    /// IS, not by who is asking: only a cover or logo (Image category) or a learner-visible lesson resource that is an
    /// image. An asset that is also a tutor-only resource, an activity file or a submission file is never cacheable,
    /// even when it is an image — those must stay private.
    /// </summary>
    public async Task<bool> IsSafeToCacheAsync(LearningAsset asset, CancellationToken ct = default)
    {
        var resourceVisibility = await db.LessonResources.AsNoTracking()
            .Where(r => r.LearningAssetId == asset.Id).Select(r => r.VisibleToLearners).ToListAsync(ct);
        if (resourceVisibility.Contains(false)) return false;
        if (await db.LearningActivities.AsNoTracking().AnyAsync(a => a.ActivityFileAssetId == asset.Id, ct)) return false;
        if (await db.Submissions.AsNoTracking().AnyAsync(s => s.ResponseLearningAssetId == asset.Id, ct)) return false;

        var isCoverOrLogo = asset.Category == LearningAssetCategory.Image
            && (await db.Workspaces.AsNoTracking().AnyAsync(w => w.Id == asset.WorkspaceId && w.LogoAssetId == asset.Id, ct)
                || await db.LearningProducts.AsNoTracking().AnyAsync(p => p.WorkspaceId == asset.WorkspaceId && p.CoverImageAssetId == asset.Id, ct));
        if (isCoverOrLogo) return true;

        return resourceVisibility.Contains(true) && asset.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// True when some Published lesson whose served revision is one of <paramref name="revisionIds"/> is open
    /// to this learner: actively enrolled (Active/Completed, never auto-created here) and not locked. The served
    /// revision is the one the learner's progress is pinned to, else the lesson's current one — the same choice
    /// LearningDeliveryService.GetLessonAsync makes.
    /// </summary>
    private async Task<bool> LessonRevisionServedToLearnerAsync(
        Guid workspaceId, Guid membershipId, HashSet<Guid> revisionIds, CancellationToken ct)
    {
        var lessons = await db.Lessons.AsNoTracking()
            .Where(l => l.WorkspaceId == workspaceId && l.Status == LessonStatus.Published
                     && l.Revisions.Any(r => revisionIds.Contains(r.Id)))
            .Select(l => new { l.Id, l.LearningProductId, l.CurrentRevisionId }).ToListAsync(ct);

        foreach (var lesson in lessons)
        {
            var enrollment = await learnerAccess.FindLessonEnrollmentAsync(lesson.LearningProductId, membershipId, ct);
            if (enrollment is null) continue;

            if (await learnerAccess.IsLessonLockedAsync(lesson.LearningProductId, lesson.Id, enrollment.Id, ct)) continue;

            var pinnedRevisionId = await db.LessonProgresses.AsNoTracking()
                .Where(p => p.EnrollmentId == enrollment.Id && p.LessonId == lesson.Id)
                .Select(p => (Guid?)p.LessonRevisionId).FirstOrDefaultAsync(ct);

            var servedRevisionId = pinnedRevisionId ?? lesson.CurrentRevisionId;
            if (servedRevisionId is { } served && revisionIds.Contains(served)) return true;
        }

        return false;
    }

    private static AssetAccessDecision Allow(LearningAsset asset, Guid workspaceId, Guid membershipId, bool isAuthor) =>
        new(asset, workspaceId, membershipId, isAuthor, null);

    /// <summary>Logs the denial (ids and reason only — never a token, URL or credential) and builds the decision.</summary>
    private AssetAccessDecision Deny(
        LearningAsset? asset, Guid workspaceId, Guid membershipId, bool isAuthor,
        ProvisioningError error, string message, string reason,
        Guid assetId, Guid? logWorkspaceId, Guid identityId)
    {
        logger.LogInformation(
            "Learning asset read denied ({Reason}): asset {AssetId}, workspace {WorkspaceId}, identity {IdentityId}",
            reason, assetId, logWorkspaceId, identityId);
        return new AssetAccessDecision(asset, workspaceId, membershipId, isAuthor, (error, message));
    }
}
