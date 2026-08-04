namespace Platform.Domain;

/// <summary>
/// Membership Aggregate Root.
///
/// The formal relationship between an Identity and one Workspace — "Does this
/// person belong to this Workspace, and with what role?" (Membership Aggregate
/// Design, Section 10). It converts a globally authenticated Identity into a
/// locally authorized participant in exactly one Workspace.
///
/// This is where roles live. Identity is explicitly NOT responsible for
/// "Workspace-specific roles, permissions, or status" (Identity Aggregate Design,
/// Section 3), so a person may hold Teacher here and Learner in another Workspace.
///
/// Invariants enforced here:
///   INV-001: Belongs to exactly one Workspace, references exactly one Identity.
///   INV-002: Status transitions follow the Section 15 state machine.
///   INV-003: Cannot be created without a resolved IdentityId.
///   INV-005: Roles are scoped to this Membership's Workspace (see WorkspaceRole).
///
/// Enforced outside this class (it spans aggregates):
///   INV-006: A Membership designated as its Workspace's Owner cannot be
///            suspended, archived, or removed until ownership has been
///            transferred. That requires reading the Workspace's Ownership
///            Record, so it belongs in the application service.
/// </summary>
public class Membership
{
    private readonly List<WorkspaceRole> _roles = [];

    public Guid Id { get; private set; }
    public Guid IdentityId { get; private set; }
    public Guid WorkspaceId { get; private set; }
    public MembershipStatus Status { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime? LastActiveAt { get; private set; }

    /// <summary>
    /// Workspace Roles held by this Membership. A Membership may hold more than one
    /// simultaneously (Section 7).
    /// </summary>
    public IReadOnlyCollection<WorkspaceRole> Roles => _roles.AsReadOnly();

    // Required by EF Core — not for application use
    private Membership() { }

    /// <summary>
    /// CreateMembership command (Section 13). Begins in Pending.
    /// INV-003: Identity Resolution must already have produced an IdentityId.
    /// </summary>
    public static Membership Create(Guid identityId, Guid workspaceId, params WorkspaceRoleName[] roles)
    {
        if (identityId == Guid.Empty)
            throw new ArgumentException("A Membership requires a resolved IdentityId (INV-003).", nameof(identityId));
        if (workspaceId == Guid.Empty)
            throw new ArgumentException("A Membership must belong to exactly one Workspace (INV-001).", nameof(workspaceId));

        var membership = new Membership
        {
            Id = Guid.NewGuid(),
            IdentityId = identityId,
            WorkspaceId = workspaceId,
            Status = MembershipStatus.Pending,
            CreatedAt = DateTime.UtcNow
        };

        foreach (var role in roles)
            membership.AssignRole(role);

        return membership;
    }

    // ── Roles (Section 13) ───────────────────────────────────────────────────────

    /// <summary>
    /// AssignRole command. Assigning a role the Membership already holds is a no-op
    /// rather than an error — the post-condition (holds the role) is already met.
    /// </summary>
    public void AssignRole(WorkspaceRoleName role, Guid? assignedBy = null)
    {
        if (HasRole(role)) return;
        _roles.Add(WorkspaceRole.Create(Id, role, assignedBy));
    }

    /// <summary>RemoveRole command.</summary>
    public void RemoveRole(WorkspaceRoleName role)
        => _roles.RemoveAll(r => r.Name == role);

    public bool HasRole(WorkspaceRoleName role) => _roles.Any(r => r.Name == role);

    // ── Lifecycle (Section 15) ───────────────────────────────────────────────────

    /// <summary>ActivateMembership command. Pending → Active.</summary>
    public void Activate() => Transition(MembershipStatus.Active, MembershipStatus.Pending);

    /// <summary>SuspendMembership command. Active → Suspended.</summary>
    public void Suspend() => Transition(MembershipStatus.Suspended, MembershipStatus.Active);

    /// <summary>ReinstateMembership command. Suspended → Active.</summary>
    public void Reinstate() => Transition(MembershipStatus.Active, MembershipStatus.Suspended);

    /// <summary>
    /// ArchiveMembership command. Permitted from Active or Pending.
    ///
    /// NOTE: Section 15 permits Pending → Archived, while INV-002's parenthetical
    /// example calls that same transition illegal. The Section 15 state machine is
    /// followed here as the normative diagram — see Technical Debt Backlog TD-007.
    /// </summary>
    public void Archive() => Transition(MembershipStatus.Archived, MembershipStatus.Active, MembershipStatus.Pending);

    /// <summary>
    /// RemoveMembership command. Active → Removed.
    /// INV-004: this never removes the referenced Identity.
    /// </summary>
    public void Remove() => Transition(MembershipStatus.Removed, MembershipStatus.Active);

    /// <summary>Records Workspace activity (Membership Metadata, Section 8).</summary>
    public void Touch() => LastActiveAt = DateTime.UtcNow;

    private void Transition(MembershipStatus target, params MembershipStatus[] permittedFrom)
    {
        if (!permittedFrom.Contains(Status))
            throw new InvalidOperationException(
                $"A Membership cannot move from {Status} to {target}. Permitted from: {string.Join(", ", permittedFrom)} (Membership Aggregate Design, Section 15, INV-002).");

        Status = target;
    }
}
