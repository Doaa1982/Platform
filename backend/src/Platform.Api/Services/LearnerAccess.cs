using Microsoft.EntityFrameworkCore;
using Platform.Domain;
using Platform.Infrastructure;

namespace Platform.Api.Services;

/// <summary>
/// The learner-side access rules that used to live as private copies inside
/// <see cref="LearningDeliveryService"/> and <see cref="AssignmentService"/>,
/// extracted so lesson delivery, assignment delivery and Learning Asset
/// access all evaluate the very same code. Behaviour is unchanged from the
/// originals; the pure (non-mutating) enrollment check is new only in that it
/// is callable without EnsureEnrolledAsync's auto-enroll side effect.
/// </summary>
public class LearnerAccess(PlatformDbContext db)
{
    public record Resolved(Workspace? Workspace, Guid MembershipId, (ProvisioningError Error, string Message)? Error);

    /// <summary>
    /// Workspace admission for a learner-facing call: the workspace must exist,
    /// the caller must be an Active member (non-members get 404 so status codes
    /// cannot map which workspaces exist), and must hold the Learner role.
    /// </summary>
    public async Task<Resolved> ResolveLearnerAsync(string slug, Guid caller, CancellationToken ct)
    {
        var normalised = slug.ToLowerInvariant().Trim();

        var workspace = await db.Workspaces.AsNoTracking().FirstOrDefaultAsync(w => w.Slug == normalised, ct);
        if (workspace is null) return new Resolved(null, Guid.Empty, (ProvisioningError.NotFound, "No such workspace."));

        var member = await db.Memberships.Include(m => m.Roles).AsNoTracking()
            .FirstOrDefaultAsync(m => m.WorkspaceId == workspace.Id && m.IdentityId == caller
                                   && m.Status == MembershipStatus.Active, ct);
        if (member is null) return new Resolved(null, Guid.Empty, (ProvisioningError.NotFound, "No such workspace."));

        if (!member.Roles.Any(r => r.Name == WorkspaceRoleName.Learner))
            return new Resolved(workspace, member.Id, (ProvisioningError.Forbidden, "Only a Learner in this workspace can access this."));

        return new Resolved(workspace, member.Id, null);
    }

    /// <summary>Assignment rule: an Active enrollment only (a Completed one no longer counts).</summary>
    public Task<bool> IsActivelyEnrolledAsync(Guid learningProductId, Guid membershipId, CancellationToken ct) =>
        db.Enrollments.AsNoTracking()
            .AnyAsync(e => e.LearningProductId == learningProductId && e.MembershipId == membershipId
                        && e.Status == EnrollmentStatus.Active, ct);

    /// <summary>
    /// The read-only half of lesson delivery's EnsureEnrolledAsync: an existing
    /// Active or Completed enrollment. Never creates or reactivates one, so
    /// asking "may this learner have this file" cannot enroll anybody.
    /// </summary>
    public Task<Enrollment?> FindLessonEnrollmentAsync(Guid learningProductId, Guid membershipId, CancellationToken ct) =>
        db.Enrollments.AsNoTracking()
            .FirstOrDefaultAsync(e => e.LearningProductId == learningProductId && e.MembershipId == membershipId
                                   && (e.Status == EnrollmentStatus.Active || e.Status == EnrollmentStatus.Completed), ct);

    /// <summary>
    /// Sequential-completion locking: a lesson is locked until the one before it is Completed. A lesson the
    /// Published Curriculum doesn't place anywhere is never locked. This is the actual enforcement;
    /// GetCurriculumAsync's per-lesson Locked flag is only a preview of it for the UI.
    /// </summary>
    public async Task<bool> IsLessonLockedAsync(Guid learningProductId, Guid lessonId, Guid enrollmentId, CancellationToken ct)
    {
        var curriculum = await db.Curricula.Include(c => c.Units).ThenInclude(u => u.Lessons).AsNoTracking()
            .FirstOrDefaultAsync(c => c.LearningProductId == learningProductId && c.Status == CurriculumStatus.Published, ct);
        if (curriculum is null || !curriculum.RequiresSequentialCompletion) return false;

        var orderedLessonIds = curriculum.Units.OrderBy(u => u.Position)
            .SelectMany(u => u.Lessons.OrderBy(l => l.Position))
            .Select(l => l.LessonId).ToList();

        var index = orderedLessonIds.IndexOf(lessonId);
        if (index <= 0) return false;

        var previousLessonId = orderedLessonIds[index - 1];
        var previousProgress = await db.LessonProgresses.AsNoTracking()
            .FirstOrDefaultAsync(p => p.EnrollmentId == enrollmentId && p.LessonId == previousLessonId, ct);

        return previousProgress?.Status != LessonProgressStatus.Completed;
    }

    public sealed record AssignmentAccess(
        Assignment? Assignment, bool Promoted, (ProvisioningError Error, string Message)? Denied);

    /// <summary>
    /// "May this learner see this activity's assignment": it exists in the workspace, the learner is actively
    /// enrolled in its course, and it is not Draft/Scheduled/hidden. Date-driven promotion is applied in
    /// memory; <see cref="AssignmentAccess.Promoted"/> tells the caller whether the row changed, so a caller
    /// that owns the write (the assignment view) can persist it and a read-only caller can ignore it.
    /// </summary>
    public async Task<AssignmentAccess> EvaluateAssignmentAccessAsync(
        Guid workspaceId, Guid membershipId, Guid learningActivityId, CancellationToken ct)
    {
        // WorkspaceId checked directly as defense-in-depth — every other service scopes by it explicitly.
        var assignment = await db.Assignments
            .FirstOrDefaultAsync(a => a.LearningActivityId == learningActivityId && a.WorkspaceId == workspaceId, ct);
        if (assignment is null)
            return new AssignmentAccess(null, false, (ProvisioningError.NotFound, "No such assignment."));

        if (!await IsActivelyEnrolledAsync(assignment.LearningProductId, membershipId, ct))
            return new AssignmentAccess(assignment, false, (ProvisioningError.Forbidden, "You are not enrolled in this course."));

        var promoted = assignment.PromoteIfDue(DateTime.UtcNow);
        if (assignment.Status is AssignmentStatus.Draft or AssignmentStatus.Scheduled || !assignment.Visible)
            return new AssignmentAccess(assignment, promoted, (ProvisioningError.NotFound, "No such assignment."));

        return new AssignmentAccess(assignment, promoted, null);
    }
}
