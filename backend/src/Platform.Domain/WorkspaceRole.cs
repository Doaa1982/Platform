namespace Platform.Domain;

/// <summary>
/// One role assignment held by a Membership within its Workspace.
/// Entity of the Membership Aggregate (Membership Aggregate Design, Section 7).
///
/// INV-005: the role is scoped entirely to its Membership's own Workspace and
/// confers no permission in any other (Workspace Access Context, Rule 1).
/// </summary>
public class WorkspaceRole
{
    public Guid Id { get; private set; }
    public Guid MembershipId { get; private set; }
    public WorkspaceRoleName Name { get; private set; }
    public DateTime AssignedAt { get; private set; }

    /// <summary>MembershipId of the actor who assigned this role, where applicable.</summary>
    public Guid? AssignedBy { get; private set; }

    // Required by EF Core — not for application use
    private WorkspaceRole() { }

    internal static WorkspaceRole Create(Guid membershipId, WorkspaceRoleName name, Guid? assignedBy)
        => new()
        {
            Id = Guid.NewGuid(),
            MembershipId = membershipId,
            Name = name,
            AssignedAt = DateTime.UtcNow,
            AssignedBy = assignedBy
        };
}
