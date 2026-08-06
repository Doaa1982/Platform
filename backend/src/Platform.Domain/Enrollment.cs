namespace Platform.Domain;

/// <summary>
/// Enrollment Aggregate Root — simplified.
///
/// The full aggregate (Enrollment Aggregate Design) has Invited/Active/
/// Suspended/Cancelled/Expired states, an Access Window, and a Source, and
/// Learning Delivery is documented to check for an Active Enrollment before
/// granting a Learner access to a Lesson (§12). This app builds that
/// gate for real — a Learner cannot reach a Lesson's content without one —
/// but not the request/approval machinery behind it: Learning Product's own
/// EnrollmentMode (Open/InvitationOnly/ApprovalRequired) is documented as
/// "descriptive... enforces nothing by itself" (Learning Product Aggregate
/// Design §8), so no invariant anywhere actually gates who may enrol today.
/// Given that gap, this Enrollment auto-creates the moment a Learner-role
/// member first opens a Published product — honest about what is actually
/// enforced right now, the same spirit as Pacing being hidden and hardcoded
/// until Scheduling Context exists.
///
/// Progress belongs here, not to Lesson or Identity directly (Learning
/// Progress Tracking Business Analysis PR-001) — see <see cref="LessonProgress"/>.
/// </summary>
public class Enrollment
{
    public Guid Id { get; private set; }
    public Guid WorkspaceId { get; private set; }
    public Guid LearningProductId { get; private set; }
    public Guid MembershipId { get; private set; }
    public EnrollmentStatus Status { get; private set; }
    public DateTime CreatedAt { get; private set; }

    private Enrollment() { }

    public static Enrollment Create(Guid workspaceId, Guid learningProductId, Guid membershipId)
    {
        if (workspaceId == Guid.Empty)
            throw new ArgumentException("An Enrollment belongs to exactly one Workspace.", nameof(workspaceId));
        if (learningProductId == Guid.Empty)
            throw new ArgumentException("An Enrollment belongs to exactly one Learning Product.", nameof(learningProductId));
        if (membershipId == Guid.Empty)
            throw new ArgumentException("An Enrollment belongs to exactly one Membership.", nameof(membershipId));

        return new Enrollment
        {
            Id = Guid.NewGuid(),
            WorkspaceId = workspaceId,
            LearningProductId = learningProductId,
            MembershipId = membershipId,
            Status = EnrollmentStatus.Active,
            CreatedAt = DateTime.UtcNow
        };
    }
}
