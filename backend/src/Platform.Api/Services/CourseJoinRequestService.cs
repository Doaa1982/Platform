using Microsoft.EntityFrameworkCore;
using Platform.Api.Models;
using Platform.Domain;
using Platform.Infrastructure;

namespace Platform.Api.Services;

/// <summary>
/// The course-scoped counterpart to JoinRequestService — a Member who
/// already belongs to the Workspace asking for access to one ApprovalRequired
/// course. Unlike a workspace Join Request, the requester already has an
/// Identity and an active Membership, so approval creates an Enrollment
/// directly (<see cref="Enrollment.Create"/>) rather than issuing a fresh
/// Invitation — there is no account to create, it already exists.
/// </summary>
public class CourseJoinRequestService(PlatformDbContext db)
{
    /// <summary>Same authority as JoinRequestService.ReviewerRoles — no course-scoped instructor role exists.</summary>
    private static readonly WorkspaceRoleName[] ReviewerRoles =
        [WorkspaceRoleName.Owner, WorkspaceRoleName.Administrator];

    // ── Submitting ────────────────────────────────────────────────────────────

    public async Task<ProvisioningResult<string>> SubmitAsync(
        string slug, Guid callerIdentityId, Guid learningProductId, SubmitCourseJoinRequest request, CancellationToken ct = default)
    {
        var (workspace, membershipId, error) = await ResolveLearnerAsync(slug, callerIdentityId, ct);
        if (error is not null) return Fail<string>(error.Value.Message, error.Value.Error);

        var product = await db.LearningProducts.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == learningProductId && p.WorkspaceId == workspace!.Id, ct);
        if (product is null) return Fail<string>("No such course.", ProvisioningError.NotFound);

        if (product.Status != LearningProductStatus.Published || product.EnrollmentMode != EnrollmentMode.ApprovalRequired)
            return Fail<string>("This course isn't accepting requests.", ProvisioningError.Conflict);

        var alreadyEnrolled = await db.Enrollments.AnyAsync(
            e => e.LearningProductId == learningProductId && e.MembershipId == membershipId, ct);
        if (alreadyEnrolled)
            return Fail<string>("You're already enrolled in this course.", ProvisioningError.Conflict);

        var alreadyAsked = await db.CourseJoinRequests.AnyAsync(
            r => r.LearningProductId == learningProductId && r.MembershipId == membershipId
              && r.Status == CourseJoinRequestStatus.Submitted, ct);
        if (alreadyAsked)
            return Fail<string>("You've already asked to join this course. They haven't answered yet.", ProvisioningError.Conflict);

        var courseJoinRequest = CourseJoinRequest.Submit(workspace!.Id, learningProductId, membershipId, request.Message);
        db.CourseJoinRequests.Add(courseJoinRequest);
        await db.SaveChangesAsync(ct);

        return ProvisioningResult<string>.Success(courseJoinRequest.Status.ToString());
    }

    // ── Reviewer: the queue and the decision ─────────────────────────────────

    public async Task<ProvisioningResult<IReadOnlyList<CourseJoinRequestRow>>> ListForReviewAsync(
        string slug, Guid callerIdentityId, CancellationToken ct = default)
    {
        var (workspace, error) = await ResolveReviewerAsync(slug, callerIdentityId, ct);
        if (error is not null)
            return ProvisioningResult<IReadOnlyList<CourseJoinRequestRow>>.Fail(error.Value.Error, error.Value.Message);

        var rows = await (
            from r in db.CourseJoinRequests.AsNoTracking()
            where r.WorkspaceId == workspace!.Id
            join p in db.LearningProducts.AsNoTracking() on r.LearningProductId equals p.Id
            join m in db.Memberships.AsNoTracking() on r.MembershipId equals m.Id
            join i in db.Identities.AsNoTracking() on m.IdentityId equals i.Id
            // Open requests first — they are the only ones needing action. Ordered
            // here, on the entity's own fields, and only projected to the record
            // afterwards — EF cannot translate an OrderBy over an already-projected
            // record constructor.
            orderby r.Status == CourseJoinRequestStatus.Submitted ? 0 : 1, r.SubmittedAt descending
            select new CourseJoinRequestRow(
                r.Id, r.LearningProductId, p.Title, r.MembershipId, i.FullName, i.Email,
                r.Message, r.Status.ToString(), r.SubmittedAt, r.DecidedAt))
            .ToListAsync(ct);

        return ProvisioningResult<IReadOnlyList<CourseJoinRequestRow>>.Success(rows);
    }

    /// <summary>
    /// Approves: creates an Enrollment for the recorded Membership/Product
    /// directly (the requester is already a Member — no Invitation needed).
    /// Guards the same race EnsureEnrolledAsync already handles, in case the
    /// learner was enrolled some other way (e.g. manually, by a tutor) in the meantime.
    /// </summary>
    public async Task<ProvisioningResult<string>> ApproveAsync(
        string slug, Guid callerIdentityId, Guid requestId, CancellationToken ct = default)
    {
        var (workspace, error) = await ResolveReviewerAsync(slug, callerIdentityId, ct);
        if (error is not null) return ProvisioningResult<string>.Fail(error.Value.Error, error.Value.Message);

        var courseJoinRequest = await db.CourseJoinRequests
            .FirstOrDefaultAsync(r => r.Id == requestId && r.WorkspaceId == workspace!.Id, ct);
        if (courseJoinRequest is null) return Fail<string>("No such request.", ProvisioningError.NotFound);

        var alreadyEnrolled = await db.Enrollments.AnyAsync(
            e => e.LearningProductId == courseJoinRequest.LearningProductId && e.MembershipId == courseJoinRequest.MembershipId, ct);
        if (!alreadyEnrolled)
        {
            var enrollment = Enrollment.Create(workspace!.Id, courseJoinRequest.LearningProductId, courseJoinRequest.MembershipId);
            db.Enrollments.Add(enrollment);
        }

        try { courseJoinRequest.Approve(callerIdentityId); }
        catch (InvalidOperationException ex) { return Fail<string>(ex.Message, ProvisioningError.Conflict); }

        await db.SaveChangesAsync(ct);
        return ProvisioningResult<string>.Success(courseJoinRequest.Status.ToString());
    }

    public async Task<ProvisioningResult<string>> DeclineAsync(
        string slug, Guid callerIdentityId, Guid requestId, CancellationToken ct = default)
    {
        var (workspace, error) = await ResolveReviewerAsync(slug, callerIdentityId, ct);
        if (error is not null) return ProvisioningResult<string>.Fail(error.Value.Error, error.Value.Message);

        var courseJoinRequest = await db.CourseJoinRequests
            .FirstOrDefaultAsync(r => r.Id == requestId && r.WorkspaceId == workspace!.Id, ct);
        if (courseJoinRequest is null) return Fail<string>("No such request.", ProvisioningError.NotFound);

        try { courseJoinRequest.Decline(callerIdentityId); }
        catch (InvalidOperationException ex) { return Fail<string>(ex.Message, ProvisioningError.Conflict); }

        await db.SaveChangesAsync(ct);
        return ProvisioningResult<string>.Success(courseJoinRequest.Status.ToString());
    }

    // ── Shared ───────────────────────────────────────────────────────────────

    private Task<Workspace?> FindAsync(string slug, CancellationToken ct) =>
        db.Workspaces.FirstOrDefaultAsync(w => w.Slug == slug.ToLowerInvariant().Trim(), ct);

    private async Task<(Workspace? Workspace, Guid MembershipId, (ProvisioningError Error, string Message)? Error)> ResolveLearnerAsync(
        string slug, Guid callerIdentityId, CancellationToken ct)
    {
        var workspace = await FindAsync(slug, ct);
        if (workspace is null) return (null, Guid.Empty, (ProvisioningError.NotFound, "No such workspace."));

        var caller = await db.Memberships.Include(m => m.Roles).AsNoTracking()
            .FirstOrDefaultAsync(m => m.WorkspaceId == workspace.Id && m.IdentityId == callerIdentityId
                                   && m.Status == MembershipStatus.Active, ct);

        // Non-members get 404, so status codes cannot map which Workspaces exist
        if (caller is null) return (null, Guid.Empty, (ProvisioningError.NotFound, "No such workspace."));

        if (!caller.Roles.Any(r => r.Name == WorkspaceRoleName.Learner))
            return (null, caller.Id, (ProvisioningError.Forbidden, "Only a Learner in this workspace can request course access."));

        return (workspace, caller.Id, null);
    }

    private async Task<(Workspace?, (ProvisioningError Error, string Message)?)> ResolveReviewerAsync(
        string slug, Guid callerIdentityId, CancellationToken ct)
    {
        var workspace = await FindAsync(slug, ct);
        if (workspace is null) return (null, (ProvisioningError.NotFound, "No such workspace."));

        var caller = await db.Memberships.Include(m => m.Roles).AsNoTracking()
            .FirstOrDefaultAsync(m => m.WorkspaceId == workspace.Id && m.IdentityId == callerIdentityId
                                   && m.Status == MembershipStatus.Active, ct);

        if (caller is null) return (null, (ProvisioningError.NotFound, "No such workspace."));

        if (!caller.Roles.Any(r => ReviewerRoles.Contains(r.Name)))
            return (null, (ProvisioningError.Forbidden, "Only an owner or administrator can review course requests."));

        return (workspace, null);
    }

    private static ProvisioningResult<T> Fail<T>(string message, ProvisioningError error)
        => ProvisioningResult<T>.Fail(error, message);
}
