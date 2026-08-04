using Microsoft.EntityFrameworkCore;
using Platform.Api.Models;
using Platform.Domain;
using Platform.Infrastructure;

namespace Platform.Api.Services;

/// <summary>
/// The Workspace Owner's own setup journey — Workspace Setup Business Analysis §7.
///
/// Picks up exactly where Platform Administrator provisioning stops. The admin
/// hands over a Workspace in Created with an Owner attached and takes no further
/// part; everything from there to publication belongs here.
///
/// Introduces no new domain method. Every transition is a command that already
/// existed on the Workspace aggregate and already enforces its own invariants —
/// what was missing was an authorized caller (TD-009).
/// </summary>
public class WorkspaceSetupService(PlatformDbContext db)
{
    /// <summary>
    /// Owner and Administrator may both configure (BA-001). Ownership transfer
    /// is deliberately not part of setup — an Administrator who could reassign
    /// ownership could take the Workspace.
    /// </summary>
    private static readonly WorkspaceRoleName[] SetupRoles =
        [WorkspaceRoleName.Owner, WorkspaceRoleName.Administrator];

    // ── Reading ──────────────────────────────────────────────────────────────

    public async Task<ProvisioningResult<WorkspaceSetupResponse>> GetAsync(
        string slug, Guid callerIdentityId, CancellationToken ct = default)
    {
        var (workspace, canManage, error) = await ResolveAsync(slug, callerIdentityId, requireManage: false, ct);
        if (error is not null)
            return ProvisioningResult<WorkspaceSetupResponse>.Fail(error.Value.Error, error.Value.Message);

        return ProvisioningResult<WorkspaceSetupResponse>.Success(Describe(workspace!, canManage));
    }

    private static WorkspaceSetupResponse Describe(Workspace w, bool canManage)
    {
        var completeness = Assess(w);
        var (next, blocker) = NextStep(w, completeness);

        return new WorkspaceSetupResponse(
            WorkspaceId:    w.Id,
            Name:           w.Name,
            Slug:           w.Slug,
            Description:    w.Description,
            Status:         w.Status.ToString(),
            CanManage:      canManage,
            Completeness:   completeness,
            NextTransition: next,
            Blocker:        blocker);
    }

    /// <summary>
    /// INV-007's publication conditions, evaluated against current state.
    ///
    /// BA-003: INV-007 also requires at least one registered, Active Entry Point.
    /// The Entry Point Registry does not exist yet (TD-006), so addressability is
    /// satisfied here by the Public Identifier acting as an implicit
    /// platform-subdomain entry point. That is genuinely how a Workspace is
    /// reached today, so the rule's intent holds even though its stated
    /// mechanism does not exist — but it is reported as its own flag rather than
    /// folded into the identity check, so the distinction stays visible.
    /// </summary>
    private static SetupCompleteness Assess(Workspace w)
    {
        var hasName = !string.IsNullOrWhiteSpace(w.Name);
        var hasSlug = !string.IsNullOrWhiteSpace(w.Slug);

        return new SetupCompleteness(
            HasName:             hasName,
            HasPublicIdentifier: hasSlug,
            HasDescription:      !string.IsNullOrWhiteSpace(w.Description),
            IsAddressable:       hasSlug,
            ReadyToPublish:      hasName && hasSlug);
    }

    /// <summary>
    /// The one transition available now. Returning a single next step rather
    /// than a set of buttons keeps the client from having to re-derive the
    /// ordered lifecycle (BA-004 — it is strictly ordered).
    /// </summary>
    private static (string? Next, string? Blocker) NextStep(Workspace w, SetupCompleteness c) => w.Status switch
    {
        WorkspaceStatus.Created     => ("BeginConfiguration", null),
        WorkspaceStatus.Configuring => ("MakePrivate", null),
        WorkspaceStatus.Private     => c.ReadyToPublish
                                           ? ("Publish", null)
                                           : (null, "Add a name and a public identifier before publishing."),
        WorkspaceStatus.Published   => ("Activate", null),
        WorkspaceStatus.Active      => (null, null),
        WorkspaceStatus.Suspended   => (null, "This workspace is suspended. Contact platform support."),
        WorkspaceStatus.Archived    => (null, "This workspace is archived."),
        _                           => (null, null),
    };

    // ── Identity ─────────────────────────────────────────────────────────────

    /// <summary>
    /// UpdateWorkspaceIdentity. Permitted in any operational state — amending
    /// identity after publication does not move the Workspace backwards through
    /// its lifecycle (§10, Lifecycle Rules).
    /// </summary>
    public async Task<ProvisioningResult<WorkspaceSetupResponse>> UpdateIdentityAsync(
        string slug, Guid callerIdentityId, UpdateWorkspaceIdentityRequest request, CancellationToken ct = default)
    {
        var (workspace, canManage, error) = await ResolveAsync(slug, callerIdentityId, requireManage: true, ct);
        if (error is not null)
            return ProvisioningResult<WorkspaceSetupResponse>.Fail(error.Value.Error, error.Value.Message);

        if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Slug))
            return Fail("A workspace needs a name and a public identifier.", ProvisioningError.Invalid);

        var newSlug = request.Slug.ToLowerInvariant().Trim();

        // The identifier is how a Workspace is addressed, so it must stay unique
        if (newSlug != workspace!.Slug &&
            await db.Workspaces.AnyAsync(w => w.Slug == newSlug && w.Id != workspace.Id, ct))
            return Fail($"The identifier \"{newSlug}\" is already taken.", ProvisioningError.Conflict);

        try { workspace.UpdateIdentity(request.Name, newSlug, request.Description); }
        catch (ArgumentException ex) { return Fail(ex.Message, ProvisioningError.Invalid); }

        await db.SaveChangesAsync(ct);
        return ProvisioningResult<WorkspaceSetupResponse>.Success(Describe(workspace, canManage));
    }

    // ── Lifecycle (§7) ───────────────────────────────────────────────────────

    public Task<ProvisioningResult<WorkspaceSetupResponse>> BeginConfigurationAsync(
        string slug, Guid caller, CancellationToken ct = default)
        => TransitionAsync(slug, caller, w => w.BeginConfiguration(), ct);

    public Task<ProvisioningResult<WorkspaceSetupResponse>> MakePrivateAsync(
        string slug, Guid caller, CancellationToken ct = default)
        => TransitionAsync(slug, caller, w => w.MakePrivate(), ct);

    /// <summary>
    /// Publish. The aggregate enforces INV-007's identity half; the Entry Point
    /// half is satisfied by the Public Identifier for now (BA-003).
    /// </summary>
    public Task<ProvisioningResult<WorkspaceSetupResponse>> PublishAsync(
        string slug, Guid caller, CancellationToken ct = default)
        => TransitionAsync(slug, caller, w => w.Publish(), ct);

    /// <summary>
    /// Activate — "we are open for business".
    ///
    /// BA-002 IS UNRESOLVED. Workspace Aggregate Design §15 justifies splitting
    /// Private from Published but gives no meaning to Published → Active. This
    /// implements the Business Analysis's recommendation: Owner-declared, a
    /// deliberate act distinct from being publicly discoverable.
    ///
    /// It is deliberately a separate command with no side effects beyond the
    /// status change, so if the ruling instead makes it automatic on publish, or
    /// driven by first real use, only this method and NextStep change. Nothing
    /// else in the codebase depends on which reading is chosen.
    /// </summary>
    public Task<ProvisioningResult<WorkspaceSetupResponse>> ActivateAsync(
        string slug, Guid caller, CancellationToken ct = default)
        => TransitionAsync(slug, caller, w => w.Activate(), ct);

    private async Task<ProvisioningResult<WorkspaceSetupResponse>> TransitionAsync(
        string slug, Guid callerIdentityId, Action<Workspace> transition, CancellationToken ct)
    {
        var (workspace, canManage, error) = await ResolveAsync(slug, callerIdentityId, requireManage: true, ct);
        if (error is not null)
            return ProvisioningResult<WorkspaceSetupResponse>.Fail(error.Value.Error, error.Value.Message);

        try { transition(workspace!); }
        // The aggregate rejects out-of-order transitions and incomplete
        // publication with its own message; surface it rather than a 500
        catch (InvalidOperationException ex) { return Fail(ex.Message, ProvisioningError.Conflict); }

        await db.SaveChangesAsync(ct);
        return ProvisioningResult<WorkspaceSetupResponse>.Success(Describe(workspace!, canManage));
    }

    // ── Caller resolution ────────────────────────────────────────────────────

    /// <summary>
    /// A non-member gets 404, never 403, so status codes cannot be used to
    /// discover which Workspaces exist (Workspace Context, Rule 1).
    /// </summary>
    private async Task<(Workspace?, bool CanManage, (ProvisioningError Error, string Message)?)> ResolveAsync(
        string slug, Guid callerIdentityId, bool requireManage, CancellationToken ct)
    {
        var normalised = slug.ToLowerInvariant().Trim();

        var workspace = await db.Workspaces.FirstOrDefaultAsync(w => w.Slug == normalised, ct);
        if (workspace is null)
            return (null, false, (ProvisioningError.NotFound, "No such workspace."));

        var caller = await db.Memberships
            .Include(m => m.Roles)
            .AsNoTracking()
            .FirstOrDefaultAsync(m => m.WorkspaceId == workspace.Id
                                   && m.IdentityId == callerIdentityId
                                   && m.Status == MembershipStatus.Active, ct);

        if (caller is null)
            return (null, false, (ProvisioningError.NotFound, "No such workspace."));

        var canManage = caller.Roles.Any(r => SetupRoles.Contains(r.Name));

        if (requireManage && !canManage)
            return (null, false,
                (ProvisioningError.Forbidden, "Only an owner or administrator can set up this workspace."));

        return (workspace, canManage, null);
    }

    private static ProvisioningResult<WorkspaceSetupResponse> Fail(string message, ProvisioningError error)
        => ProvisioningResult<WorkspaceSetupResponse>.Fail(error, message);
}
