using Microsoft.EntityFrameworkCore;
using Platform.Api.Models;
using Platform.Domain;
using Platform.Infrastructure;

namespace Platform.Api.Services;

/// <summary>
/// Member management inside one Workspace — the tutor's side of the Membership
/// lifecycle, as opposed to the Platform Administrator's cross-Workspace one.
///
/// Authority here is Workspace-scoped and comes from the caller's own
/// Membership: Owner or Administrator may manage, everyone else may look. That
/// is the opposite of AdminController, whose authority deliberately comes from
/// no Membership at all (BA-001) — the two surfaces answer to different things
/// on purpose.
///
/// Enforces the invariants that span aggregates and so cannot live on Membership:
///   INV-006 — the Membership currently designated Workspace Owner cannot be
///             suspended, archived or removed until ownership has been
///             transferred (Workspace Aggregate Design, INV-005)
///   §8      — at most one open Invitation per (email, Workspace)
///   BA-006  — Owner is never granted by inviting into an already-owned
///             Workspace; ownership moves by transfer, not by a second claim
/// </summary>
public class WorkspaceMemberService(
    PlatformDbContext db,
    IConfiguration config,
    IInvitationDelivery delivery,
    EmailOptions email)
{
    /// <summary>Roles that may manage members. Everyone else gets a read-only view.</summary>
    private static readonly WorkspaceRoleName[] ManagerRoles =
        [WorkspaceRoleName.Owner, WorkspaceRoleName.Administrator];

    private TimeSpan ValidFor => TimeSpan.FromDays(config.GetValue("Invitations:ValidForDays", 7));

    // ── Reading ──────────────────────────────────────────────────────────────

    public async Task<ProvisioningResult<WorkspaceMembersResponse>> ListAsync(
        string slug, Guid callerIdentityId, CancellationToken ct = default)
    {
        var context = await ResolveAsync(slug, callerIdentityId, requireManage: false, ct);
        if (context.Error is not null)
            return ProvisioningResult<WorkspaceMembersResponse>.Fail(context.Error.Value.Error, context.Error.Value.Message);

        var workspace = context.Workspace!;

        var memberships = await db.Memberships
            .Include(m => m.Roles)
            .AsNoTracking()
            .Where(m => m.WorkspaceId == workspace.Id && m.Status != MembershipStatus.Removed)
            .ToListAsync(ct);

        var identityIds = memberships.Select(m => m.IdentityId).ToList();
        var identities = await db.Identities.AsNoTracking()
            .Where(i => identityIds.Contains(i.Id))
            .ToDictionaryAsync(i => i.Id, ct);

        var invitations = await db.Invitations.AsNoTracking()
            .Where(i => i.WorkspaceId == workspace.Id)
            .OrderByDescending(i => i.IssuedAt)
            .ToListAsync(ct);

        var now = DateTime.UtcNow;

        var members = memberships
            .Select(m =>
            {
                identities.TryGetValue(m.IdentityId, out var identity);
                return new WorkspaceMemberRow(
                    MembershipId: m.Id,
                    IdentityId:   m.IdentityId,
                    Email:        identity?.Email ?? "(unknown)",
                    FullName:     identity?.FullName ?? "(unknown)",
                    Status:       m.Status.ToString(),
                    Roles:        m.Roles.Select(r => r.Name.ToString()).OrderBy(r => r).ToList(),
                    IsOwner:      workspace.OwnerMembershipId == m.Id,
                    CreatedAt:    m.CreatedAt,
                    LastActiveAt: m.LastActiveAt);
            })
            // Owner first, then everyone else alphabetically — the owner is the
            // one row whose available actions differ, so it should not be hunted for
            .OrderByDescending(r => r.IsOwner)
            .ThenBy(r => r.FullName)
            .ToList();

        return ProvisioningResult<WorkspaceMembersResponse>.Success(new WorkspaceMembersResponse(
            WorkspaceName: workspace.Name,
            WorkspaceSlug: workspace.Slug,
            CanManage:     context.CanManage,
            Members:       members,
            Invitations:   invitations.Select(i => new WorkspaceInvitationRow(
                               Id:           i.Id,
                               Email:        i.Email,
                               IntendedRole: i.IntendedRole.ToString(),
                               Status:       i.Status == InvitationStatus.Sent && i.ExpiresAt <= now
                                                 ? nameof(InvitationStatus.Expired)
                                                 : i.Status.ToString(),
                               IssuedAt:     i.IssuedAt,
                               ExpiresAt:    i.ExpiresAt,
                               IsOpen:       i.IsOpen(now))).ToList()));
    }

    // ── Inviting ─────────────────────────────────────────────────────────────

    public async Task<ProvisioningResult<InvitationIssuedResponse>> InviteAsync(
        string slug, Guid callerIdentityId, InviteMemberRequest request, CancellationToken ct = default)
    {
        var context = await ResolveAsync(slug, callerIdentityId, requireManage: true, ct);
        if (context.Error is not null)
            return ProvisioningResult<InvitationIssuedResponse>.Fail(context.Error.Value.Error, context.Error.Value.Message);

        var workspace = context.Workspace!;

        if (string.IsNullOrWhiteSpace(request.Email))
            return Fail("An email address is required.", ProvisioningError.Invalid);

        if (!Enum.TryParse<WorkspaceRoleName>(request.Role, out var role))
            return Fail($"\"{request.Role}\" is not a workspace role.", ProvisioningError.Invalid);

        // BA-006: ownership moves by transfer, never by inviting a second claimant
        if (role == WorkspaceRoleName.Owner)
            return Fail("Ownership is transferred, not invited. Invite an Administrator instead.", ProvisioningError.Invalid);

        // Named to avoid shadowing the injected EmailOptions
        var inviteeEmail = request.Email.ToLowerInvariant().Trim();

        // Already a member? Say so rather than issuing a link that would be
        // rejected at the last step.
        var existing = await (
            from m in db.Memberships
            join i in db.Identities on m.IdentityId equals i.Id
            where m.WorkspaceId == workspace.Id && i.Email == inviteeEmail && m.Status == MembershipStatus.Active
            select m.Id).AnyAsync(ct);

        if (existing)
            return Fail("That person is already an active member of this workspace.", ProvisioningError.Conflict);

        // §8: at most one open Invitation per (email, Workspace)
        var open = await db.Invitations
            .Where(i => i.WorkspaceId == workspace.Id && i.Email == inviteeEmail)
            .ToListAsync(ct);

        if (open.Any(i => i.IsOpen()))
            return Fail("There's already an open invitation for that email — resend it instead of creating another.",
                        ProvisioningError.Conflict);

        var (invitation, rawToken) = Invitation.Issue(
            workspaceId:  workspace.Id,
            email:        inviteeEmail,
            intendedRole: role,
            issuedBy:     callerIdentityId,
            validFor:     ValidFor);

        invitation.MarkSent();
        db.Invitations.Add(invitation);
        await db.SaveChangesAsync(ct);

        var outcome = await delivery.SendInvitationAsync(
            invitation.Email, workspace.Name, invitation.IntendedRole.ToString(),
            AbsoluteLink(rawToken), invitation.ExpiresAt, ct);

        return ProvisioningResult<InvitationIssuedResponse>.Success(new InvitationIssuedResponse(
            InvitationId:    invitation.Id,
            Email:           invitation.Email,
            IntendedRole:    invitation.IntendedRole.ToString(),
            ExpiresAt:       invitation.ExpiresAt,
            InvitationLink:  $"/invite/{rawToken}",
            Delivered:       outcome.Delivered,
            DeliveryChannel: outcome.Channel,
            DeliveryDetail:  outcome.Detail));
    }

    private string AbsoluteLink(string rawToken) =>
        $"{email.PublicBaseUrl.TrimEnd('/')}/invite/{rawToken}";

    // ── Membership lifecycle ─────────────────────────────────────────────────

    public Task<ProvisioningResult<string>> ActivateAsync(string slug, Guid caller, Guid membershipId, CancellationToken ct = default)
        => MutateAsync(slug, caller, membershipId, m => m.Activate(), protectOwner: false, ct);

    public Task<ProvisioningResult<string>> SuspendAsync(string slug, Guid caller, Guid membershipId, CancellationToken ct = default)
        => MutateAsync(slug, caller, membershipId, m => m.Suspend(), protectOwner: true, ct);

    public Task<ProvisioningResult<string>> ReinstateAsync(string slug, Guid caller, Guid membershipId, CancellationToken ct = default)
        => MutateAsync(slug, caller, membershipId, m => m.Reinstate(), protectOwner: false, ct);

    public Task<ProvisioningResult<string>> ArchiveAsync(string slug, Guid caller, Guid membershipId, CancellationToken ct = default)
        => MutateAsync(slug, caller, membershipId, m => m.Archive(), protectOwner: true, ct);

    public Task<ProvisioningResult<string>> RemoveAsync(string slug, Guid caller, Guid membershipId, CancellationToken ct = default)
        => MutateAsync(slug, caller, membershipId, m => m.Remove(), protectOwner: true, ct);

    public Task<ProvisioningResult<string>> AssignRoleAsync(
        string slug, Guid caller, Guid membershipId, string role, CancellationToken ct = default)
    {
        if (!Enum.TryParse<WorkspaceRoleName>(role, out var parsed))
            return Task.FromResult(Fail<string>($"\"{role}\" is not a workspace role.", ProvisioningError.Invalid));

        if (parsed == WorkspaceRoleName.Owner)
            return Task.FromResult(Fail<string>(
                "Owner is held through workspace ownership, not assigned as a role.", ProvisioningError.Invalid));

        return MutateAsync(slug, caller, membershipId, m => m.AssignRole(parsed, caller), protectOwner: false, ct);
    }

    public Task<ProvisioningResult<string>> RemoveRoleAsync(
        string slug, Guid caller, Guid membershipId, string role, CancellationToken ct = default)
    {
        if (!Enum.TryParse<WorkspaceRoleName>(role, out var parsed))
            return Task.FromResult(Fail<string>($"\"{role}\" is not a workspace role.", ProvisioningError.Invalid));

        // Stripping Owner from the owner's Membership would leave the Workspace
        // owned by someone with no owner role — INV-002's spirit
        if (parsed == WorkspaceRoleName.Owner)
            return Task.FromResult(Fail<string>(
                "Owner is removed by transferring ownership, not by removing the role.", ProvisioningError.Invalid));

        return MutateAsync(slug, caller, membershipId, m => m.RemoveRole(parsed), protectOwner: false, ct);
    }

    /// <summary>
    /// Applies a change to one Membership after checking the caller may manage
    /// this Workspace and, where it matters, that the target is not the Owner.
    /// </summary>
    private async Task<ProvisioningResult<string>> MutateAsync(
        string slug, Guid callerIdentityId, Guid membershipId,
        Action<Membership> mutate, bool protectOwner, CancellationToken ct)
    {
        var context = await ResolveAsync(slug, callerIdentityId, requireManage: true, ct);
        if (context.Error is not null)
            return ProvisioningResult<string>.Fail(context.Error.Value.Error, context.Error.Value.Message);

        var workspace = context.Workspace!;

        var membership = await db.Memberships
            .Include(m => m.Roles)
            .FirstOrDefaultAsync(m => m.Id == membershipId && m.WorkspaceId == workspace.Id, ct);

        if (membership is null)
            return Fail<string>("No such member in this workspace.", ProvisioningError.NotFound);

        // INV-006: the Owner's Membership is protected until ownership moves.
        // Without this, a Workspace could be left owned by a suspended or
        // removed Membership, which Workspace INV-002 forbids.
        if (protectOwner && workspace.OwnerMembershipId == membership.Id)
            return Fail<string>(
                "This is the workspace owner. Transfer ownership before suspending, archiving or removing them.",
                ProvisioningError.Conflict);

        try { mutate(membership); }
        // The aggregate rejects illegal lifecycle moves; report rather than 500
        catch (InvalidOperationException ex) { return Fail<string>(ex.Message, ProvisioningError.Conflict); }
        catch (ArgumentException ex) { return Fail<string>(ex.Message, ProvisioningError.Invalid); }

        await db.SaveChangesAsync(ct);
        return ProvisioningResult<string>.Success(membership.Status.ToString());
    }

    // ── Caller resolution ────────────────────────────────────────────────────

    private record Context(Workspace? Workspace, bool CanManage, (ProvisioningError Error, string Message)? Error);

    /// <summary>
    /// Resolves the Workspace and what this caller may do in it.
    ///
    /// A non-member gets 404 rather than 403, so nobody can probe which
    /// Workspaces exist by watching status codes (Workspace isolation,
    /// Workspace Context Rule 1).
    /// </summary>
    private async Task<Context> ResolveAsync(string slug, Guid callerIdentityId, bool requireManage, CancellationToken ct)
    {
        var normalised = slug.ToLowerInvariant().Trim();

        var workspace = await db.Workspaces.FirstOrDefaultAsync(w => w.Slug == normalised, ct);
        if (workspace is null)
            return new Context(null, false, (ProvisioningError.NotFound, "No such workspace."));

        var caller = await db.Memberships
            .Include(m => m.Roles)
            .AsNoTracking()
            .FirstOrDefaultAsync(m => m.WorkspaceId == workspace.Id
                                   && m.IdentityId == callerIdentityId
                                   && m.Status == MembershipStatus.Active, ct);

        if (caller is null)
            return new Context(null, false, (ProvisioningError.NotFound, "No such workspace."));

        var canManage = caller.Roles.Any(r => ManagerRoles.Contains(r.Name));

        if (requireManage && !canManage)
            return new Context(null, false,
                (ProvisioningError.Forbidden, "Only an owner or administrator can manage members."));

        return new Context(workspace, canManage, null);
    }

    private static ProvisioningResult<InvitationIssuedResponse> Fail(string message, ProvisioningError error)
        => ProvisioningResult<InvitationIssuedResponse>.Fail(error, message);

    private static ProvisioningResult<T> Fail<T>(string message, ProvisioningError error)
        => ProvisioningResult<T>.Fail(error, message);
}
