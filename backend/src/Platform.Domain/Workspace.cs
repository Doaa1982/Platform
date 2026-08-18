namespace Platform.Domain;

/// <summary>
/// Workspace Aggregate Root.
///
/// The tenant boundary of the platform — "What is this independent educational
/// business, and who owns it?" (Workspace Aggregate Design, Section 10).
///
/// Deliberately shallow (Section 5): it owns identity, ownership, and lifecycle,
/// but none of the business activity inside the boundary. Membership, Learning
/// Product, and Learning Asset each hold a WorkspaceId pointing back here — this
/// aggregate never holds collections of them (Section 17, AGG-003).
///
/// Invariants enforced here:
///   INV-001: Exactly one identity per Workspace.
///   INV-002: Exactly one current Owner at any time; ownership may transfer but
///            never be left unassigned once first assigned.
///   INV-004: May exist in Created/Configuring with no Memberships but the Owner's.
///   INV-007: Cannot Publish without a complete identity (Name + Public Identifier).
///
/// Enforced outside this class (they span aggregates):
///   INV-003: Owner MembershipId must reference an Active Membership of THIS
///            Workspace — requires loading the Membership, so it belongs in the
///            application service that performs the transfer.
///   INV-005: Owner's Membership cannot be suspended/archived/removed before
///            ownership transfer — enforced on the Membership side.
/// </summary>
public class Workspace
{
    private readonly List<string> _courseCategories = [];

    public Guid Id { get; private set; }
    public string Name { get; private set; } = string.Empty;

    /// <summary>Public identifier (slug) — Workspace Identity value object, Section 8.</summary>
    public string Slug { get; private set; } = string.Empty;

    public string? Description { get; private set; }
    public WorkspaceStatus Status { get; private set; }

    /// <summary>
    /// Ownership Record → Owner MembershipId (Section 8).
    /// Null only before the owning Membership exists — a Workspace and its Owner
    /// Membership cannot both be created in a single atomic step, since Membership
    /// requires a WorkspaceId. Assigned via <see cref="TransferOwnership"/>.
    /// </summary>
    public Guid? OwnerMembershipId { get; private set; }

    public DateTime? OwnershipAssignedAt { get; private set; }
    public DateTime CreatedAt { get; private set; }

    /// <summary>
    /// Whether strangers may ask to join (Join Request Business Analysis, BA-005).
    ///
    /// Off by default, deliberately. An academy that intends to work only with
    /// invited people should not silently acquire a queue of strangers, and
    /// opting in means the feature cannot surprise Workspaces that already exist.
    ///
    /// This belongs with Enabled Capabilities (Section 7) once that registry is
    /// implemented (TD-006); until then it is a plain configuration flag.
    /// </summary>
    public bool AcceptsJoinRequests { get; private set; }

    // ── Branding (Workspace Setup Business Analysis §3) ─────────────────────
    // The public-facing profile a Learner meets before ever opening a course —
    // the academy's own identity, not any one product's. Kept separate from
    // the Learning Product's own CoverImageAssetId (LearningProduct.cs):
    // a Learner sees the Workspace's logo and welcome message once, on first
    // encounter, and each course's own cover photo per course after that.

    /// <summary>The Learning Asset (LearningAssetCategory.Image) shown as this Workspace's logo/photo, if any.</summary>
    public Guid? LogoAssetId { get; private set; }

    /// <summary>Shown to a Learner meeting this Workspace for the first time (e.g. the Join Request page) — distinct from Description, which is a listing blurb, not a greeting.</summary>
    public string? WelcomeMessage { get; private set; }

    /// <summary>A curated set of subject areas this academy teaches — display/marketing metadata, independent of any one Learning Product's own Category.</summary>
    public IReadOnlyCollection<string> CourseCategories => _courseCategories.AsReadOnly();

    // Required by EF Core — not for application use
    private Workspace() { }

    /// <summary>
    /// CreateWorkspace command (Section 14). The Workspace begins in Created state
    /// with no owner; ownership is assigned once the Owner's Membership exists.
    /// </summary>
    public static Workspace Create(string name, string slug, string? description = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        ArgumentException.ThrowIfNullOrWhiteSpace(slug);

        return new Workspace
        {
            Id = Guid.NewGuid(),
            Name = name.Trim(),
            Slug = slug.ToLowerInvariant().Trim(),
            Description = description?.Trim(),
            Status = WorkspaceStatus.Created,
            CreatedAt = DateTime.UtcNow
        };
    }

    /// <summary>
    /// UpdateWorkspaceIdentity command (Section 14).
    /// </summary>
    public void UpdateIdentity(string name, string slug, string? description = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        ArgumentException.ThrowIfNullOrWhiteSpace(slug);

        Name = name.Trim();
        Slug = slug.ToLowerInvariant().Trim();
        Description = description?.Trim();
    }

    /// <summary>
    /// TransferOwnership command (Section 14). Enforces INV-002 — ownership is never
    /// left unassigned, so the target Membership must be supplied.
    ///
    /// The caller is responsible for INV-003: <paramref name="membershipId"/> must
    /// name an Active Membership belonging to THIS Workspace. That check requires
    /// loading the Membership aggregate and so cannot live here.
    /// </summary>
    public void TransferOwnership(Guid membershipId)
    {
        if (membershipId == Guid.Empty)
            throw new ArgumentException("Owner MembershipId is required (INV-002).", nameof(membershipId));

        OwnerMembershipId = membershipId;
        OwnershipAssignedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Opens or closes the Workspace to unsolicited join requests.
    ///
    /// Independent of the lifecycle: an Owner may decide this at any point, and
    /// it does not move the Workspace through Section 15. Whether a request can
    /// actually be submitted also depends on the Workspace being discoverable,
    /// which the caller checks — a Workspace can be open to requests while still
    /// Private, it simply cannot be found yet.
    /// </summary>
    public void SetAcceptsJoinRequests(bool accepts) => AcceptsJoinRequests = accepts;

    /// <summary>
    /// UpdateWorkspaceBranding. Independent of the lifecycle, same reasoning
    /// as SetAcceptsJoinRequests — an Owner may set their logo, welcome
    /// message and course categories at any point, including before the
    /// Workspace is even discoverable.
    /// </summary>
    public void UpdateBranding(Guid? logoAssetId, string? welcomeMessage, IEnumerable<string>? courseCategories)
    {
        LogoAssetId = logoAssetId;
        WelcomeMessage = string.IsNullOrWhiteSpace(welcomeMessage) ? null : welcomeMessage.Trim();

        _courseCategories.Clear();
        if (courseCategories is not null)
            _courseCategories.AddRange(courseCategories.Select(c => c.Trim()).Where(c => c.Length > 0).Distinct(StringComparer.OrdinalIgnoreCase));
    }

    // ── Lifecycle (Section 15) ───────────────────────────────────────────────────

    /// <summary>Created → Configuring.</summary>
    public void BeginConfiguration() => Transition(WorkspaceStatus.Configuring, WorkspaceStatus.Created);

    /// <summary>Configuring → Private (configured, not publicly discoverable).</summary>
    public void MakePrivate() => Transition(WorkspaceStatus.Private, WorkspaceStatus.Configuring);

    /// <summary>
    /// PublishWorkspace command. Private → Published.
    ///
    /// INV-007 additionally requires at least one registered, Active Entry Point.
    /// The Entry Point Registry is not yet implemented, so only the Workspace
    /// Identity half of INV-007 is enforced here — see Technical Debt Backlog TD-006.
    /// </summary>
    public void Publish()
    {
        if (string.IsNullOrWhiteSpace(Name) || string.IsNullOrWhiteSpace(Slug))
            throw new InvalidOperationException(
                "A Workspace requires a Name and Public Identifier before it can be published (INV-007).");

        Transition(WorkspaceStatus.Published, WorkspaceStatus.Private);
    }

    /// <summary>Published → Active.</summary>
    public void Activate() => Transition(WorkspaceStatus.Active, WorkspaceStatus.Published);

    /// <summary>SuspendWorkspace command. Active → Suspended.</summary>
    public void Suspend() => Transition(WorkspaceStatus.Suspended, WorkspaceStatus.Active);

    /// <summary>Suspended → Active.</summary>
    public void Reinstate() => Transition(WorkspaceStatus.Active, WorkspaceStatus.Suspended);

    /// <summary>
    /// ArchiveWorkspace command. Permitted from any operational state.
    /// INV-009: archiving deletes no Identity, Learning Product, Enrollment, or
    /// Commerce record — those retain independent lifecycles.
    /// </summary>
    public void Archive() => Transition(
        WorkspaceStatus.Archived,
        WorkspaceStatus.Created, WorkspaceStatus.Configuring, WorkspaceStatus.Private,
        WorkspaceStatus.Published, WorkspaceStatus.Active, WorkspaceStatus.Suspended);

    /// <summary>Archived → Deleted (terminal).</summary>
    public void Delete() => Transition(WorkspaceStatus.Deleted, WorkspaceStatus.Archived);

    private void Transition(WorkspaceStatus target, params WorkspaceStatus[] permittedFrom)
    {
        if (!permittedFrom.Contains(Status))
            throw new InvalidOperationException(
                $"A Workspace cannot move from {Status} to {target}. Permitted from: {string.Join(", ", permittedFrom)} (Workspace Aggregate Design, Section 15).");

        Status = target;
    }
}
