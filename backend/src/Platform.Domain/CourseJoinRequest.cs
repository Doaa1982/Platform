namespace Platform.Domain;

/// <summary>
/// Course Join Request Aggregate Root.
///
/// The course-scoped counterpart to <see cref="JoinRequest"/>: a Member who
/// already belongs to the Workspace asking for access to one specific
/// Learning Product whose EnrollmentMode is ApprovalRequired. Unlike
/// JoinRequest, the requester already has an Identity and an active
/// Membership — there is no anonymous submission and no status-link token to
/// carry, since they can just check back while signed in.
///
/// Confers nothing by itself. Approval is the caller's job (issuing an
/// Enrollment directly, since a Membership already exists) — this aggregate
/// only records the request and its decision.
/// </summary>
public class CourseJoinRequest
{
    public Guid Id { get; private set; }
    public Guid WorkspaceId { get; private set; }
    public Guid LearningProductId { get; private set; }
    public Guid MembershipId { get; private set; }

    /// <summary>Optional note from the requester, so a reviewer has something to decide on.</summary>
    public string? Message { get; private set; }

    public CourseJoinRequestStatus Status { get; private set; }
    public DateTime SubmittedAt { get; private set; }

    /// <summary>IdentityId of the reviewer who decided. Null while Submitted.</summary>
    public Guid? DecidedBy { get; private set; }
    public DateTime? DecidedAt { get; private set; }

    // Required by EF Core — not for application use
    private CourseJoinRequest() { }

    public static CourseJoinRequest Submit(
        Guid workspaceId, Guid learningProductId, Guid membershipId, string? message = null)
    {
        if (workspaceId == Guid.Empty)
            throw new ArgumentException("A course join request must name one Workspace.", nameof(workspaceId));
        if (learningProductId == Guid.Empty)
            throw new ArgumentException("A course join request must name one Learning Product.", nameof(learningProductId));
        if (membershipId == Guid.Empty)
            throw new ArgumentException("A course join request must name one Membership.", nameof(membershipId));

        return new CourseJoinRequest
        {
            Id = Guid.NewGuid(),
            WorkspaceId = workspaceId,
            LearningProductId = learningProductId,
            MembershipId = membershipId,
            Message = string.IsNullOrWhiteSpace(message) ? null : message.Trim(),
            Status = CourseJoinRequestStatus.Submitted,
            SubmittedAt = DateTime.UtcNow
        };
    }

    /// <summary>
    /// Approved by a reviewer. The caller then creates an Enrollment for the
    /// recorded Membership/Product directly — this aggregate never touches
    /// Enrollment itself, same separation of concerns as JoinRequest/Invitation.
    /// </summary>
    public void Approve(Guid reviewerIdentityId)
    {
        Require(CourseJoinRequestStatus.Approved);
        DecidedBy = reviewerIdentityId;
        DecidedAt = DateTime.UtcNow;
        Status = CourseJoinRequestStatus.Approved;
    }

    /// <summary>Declined. Terminal, and deliberately carries no reason (mirrors JoinRequest.Decline, BA-006).</summary>
    public void Decline(Guid reviewerIdentityId)
    {
        Require(CourseJoinRequestStatus.Declined);
        DecidedBy = reviewerIdentityId;
        DecidedAt = DateTime.UtcNow;
        Status = CourseJoinRequestStatus.Declined;
    }

    private void Require(CourseJoinRequestStatus target)
    {
        if (Status != CourseJoinRequestStatus.Submitted)
            throw new InvalidOperationException(
                $"A course join request that is already {Status} cannot become {target}. Only a Submitted request can be decided.");
    }
}
