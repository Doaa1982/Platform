using Microsoft.EntityFrameworkCore;
using Platform.Api.Models;
using Platform.Domain;
using Platform.Infrastructure;

namespace Platform.Api.Services;

/// <summary>
/// The inbound path to Membership — Join Request Business Analysis.
///
/// Everything else in this codebase runs outward: somebody inside a Workspace
/// decides they want you and sends an Invitation. This is the only route where
/// the person decides first and the Workspace answers.
///
/// Cross-row rules the aggregate cannot enforce alone all live here:
///   §10 — the Workspace must be discoverable AND accepting requests
///   §10 — at most one Submitted request per (person, Workspace)
///   §10 — already an Active member? the answer is that they are already in
///   BA-002 — Learner is the only requestable role in Version 1
/// </summary>
public class JoinRequestService(PlatformDbContext db)
{
    /// <summary>Who may review. Same authority that manages members and setup.</summary>
    private static readonly WorkspaceRoleName[] ReviewerRoles =
        [WorkspaceRoleName.Owner, WorkspaceRoleName.Administrator];

    /// <summary>
    /// Requestable roles. Learner only (BA-002): requesting Teacher or
    /// Administrator is a claim to authority over other people's work, and
    /// nothing in a self-submitted form substantiates it. Those stay
    /// invitation-only, where somebody inside vouches first.
    /// </summary>
    private static readonly WorkspaceRoleName[] RequestableRoles = [WorkspaceRoleName.Learner];

    /// <summary>
    /// A Workspace can only be asked to join if it can be found. Private and
    /// Configuring Workspaces are not discoverable, so a request against one
    /// would mean the requester got the slug some other way.
    /// </summary>
    private static bool IsDiscoverable(Workspace w) =>
        w.Status is WorkspaceStatus.Published or WorkspaceStatus.Active;

    // ── Anonymous: what a stranger can see ───────────────────────────────────

    public async Task<ProvisioningResult<JoinPreview>> PreviewAsync(string slug, CancellationToken ct = default)
    {
        var workspace = await FindAsync(slug, ct);

        // A Workspace that is not discoverable is reported as not existing, so
        // the slug namespace cannot be probed for unpublished Workspaces.
        if (workspace is null || !IsDiscoverable(workspace))
            return ProvisioningResult<JoinPreview>.Fail(ProvisioningError.NotFound, "No such workspace.");

        return ProvisioningResult<JoinPreview>.Success(new JoinPreview(
            WorkspaceName:     workspace.Name,
            Slug:              workspace.Slug,
            Description:       workspace.Description,
            AcceptingRequests: workspace.AcceptsJoinRequests));
    }

    // ── Anonymous: submitting ────────────────────────────────────────────────

    /// <summary>
    /// Submits a request, resolving or creating the requester's Identity as it
    /// goes (BA-003) so they can sign in and watch their own request rather
    /// than waiting blind.
    ///
    /// Returns a session, so the requester lands signed in.
    /// </summary>
    public async Task<ProvisioningResult<LoginResponse>> SubmitAsync(
        string slug, SubmitJoinRequest request, TokenService tokens, CancellationToken ct = default)
    {
        var workspace = await FindAsync(slug, ct);
        if (workspace is null || !IsDiscoverable(workspace))
            return Fail<LoginResponse>("No such workspace.", ProvisioningError.NotFound);

        if (!workspace.AcceptsJoinRequests)
            return Fail<LoginResponse>(
                "This workspace isn't accepting join requests. You'll need an invitation.",
                ProvisioningError.Conflict);

        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
            return Fail<LoginResponse>("An email address and password are required.", ProvisioningError.Invalid);

        var email = request.Email.ToLowerInvariant().Trim();

        // ── Identity Resolution, at submission (BA-003) ──
        var identity = await db.Identities.FirstOrDefaultAsync(i => i.Email == email, ct);

        if (identity is null)
        {
            if (string.IsNullOrWhiteSpace(request.FullName))
                return Fail<LoginResponse>("Please tell us your name.", ProvisioningError.Invalid);

            identity = Identity.Create(email, BCrypt.Net.BCrypt.HashPassword(request.Password), request.FullName);
            db.Identities.Add(identity);
        }
        else
        {
            // Knowing someone's address must not be enough to queue up as them
            if (!BCrypt.Net.BCrypt.Verify(request.Password, identity.PasswordHash))
                return Fail<LoginResponse>(
                    "An account already exists for this email. Enter its password to continue.",
                    ProvisioningError.Forbidden);

            if (identity.Status != IdentityStatus.Active)
                return Fail<LoginResponse>("This account is not active. Please contact support.", ProvisioningError.Forbidden);

            // Already in? The answer is that they are already in.
            var alreadyMember = await db.Memberships.AnyAsync(
                m => m.IdentityId == identity.Id
                  && m.WorkspaceId == workspace.Id
                  && m.Status == MembershipStatus.Active, ct);

            if (alreadyMember)
                return Fail<LoginResponse>("You're already a member of this workspace.", ProvisioningError.Conflict);

            // §10: at most one Submitted request per (person, Workspace)
            var alreadyAsked = await db.JoinRequests.AnyAsync(
                r => r.IdentityId == identity.Id
                  && r.WorkspaceId == workspace.Id
                  && r.Status == JoinRequestStatus.Submitted, ct);

            if (alreadyAsked)
                return Fail<LoginResponse>(
                    "You've already asked to join this workspace. They haven't answered yet.",
                    ProvisioningError.Conflict);
        }

        var joinRequest = JoinRequest.Submit(
            workspaceId:   workspace.Id,
            identityId:    identity.Id,
            email:         email,
            fullName:      identity.FullName,
            requestedRole: RequestableRoles[0],
            message:       request.Message);

        db.JoinRequests.Add(joinRequest);
        await db.SaveChangesAsync(ct);

        return ProvisioningResult<LoginResponse>.Success(tokens.Issue(identity));
    }

    // ── Requester: their own requests ────────────────────────────────────────

    public async Task<IReadOnlyList<MyJoinRequest>> MineAsync(Guid identityId, CancellationToken ct = default)
    {
        var rows = await (
            from r in db.JoinRequests.AsNoTracking()
            join w in db.Workspaces.AsNoTracking() on r.WorkspaceId equals w.Id
            where r.IdentityId == identityId
            orderby r.SubmittedAt descending
            select new { r, w }).ToListAsync(ct);

        return rows.Select(x => new MyJoinRequest(
            Id:            x.r.Id,
            WorkspaceName: x.w.Name,
            WorkspaceSlug: x.w.Slug,
            RequestedRole: x.r.RequestedRole.ToString(),
            Status:        x.r.Status.ToString(),
            SubmittedAt:   x.r.SubmittedAt)).ToList();
    }

    /// <summary>Withdrawn by the requester — only ever their own request.</summary>
    public async Task<ProvisioningResult<string>> WithdrawAsync(
        Guid requestId, Guid callerIdentityId, CancellationToken ct = default)
    {
        var joinRequest = await db.JoinRequests.FirstOrDefaultAsync(r => r.Id == requestId, ct);

        // Someone else's request is reported as not found, not forbidden
        if (joinRequest is null || joinRequest.IdentityId != callerIdentityId)
            return Fail<string>("No such request.", ProvisioningError.NotFound);

        try { joinRequest.Withdraw(); }
        catch (InvalidOperationException ex) { return Fail<string>(ex.Message, ProvisioningError.Conflict); }

        await db.SaveChangesAsync(ct);
        return ProvisioningResult<string>.Success(joinRequest.Status.ToString());
    }

    // ── Reviewer: the queue and the decision ─────────────────────────────────

    public async Task<ProvisioningResult<IReadOnlyList<JoinRequestRow>>> ListAsync(
        string slug, Guid callerIdentityId, CancellationToken ct = default)
    {
        var (workspace, error) = await ResolveReviewerAsync(slug, callerIdentityId, ct);
        if (error is not null)
            return ProvisioningResult<IReadOnlyList<JoinRequestRow>>.Fail(error.Value.Error, error.Value.Message);

        var rows = await db.JoinRequests.AsNoTracking()
            .Where(r => r.WorkspaceId == workspace!.Id)
            // Open requests first — they are the only ones needing action
            .OrderBy(r => r.Status == JoinRequestStatus.Submitted ? 0 : 1)
            .ThenByDescending(r => r.SubmittedAt)
            .Select(r => new JoinRequestRow(
                r.Id, r.FullName, r.Email, r.RequestedRole.ToString(),
                r.Message, r.Status.ToString(), r.SubmittedAt, r.DecidedAt))
            .ToListAsync(ct);

        return ProvisioningResult<IReadOnlyList<JoinRequestRow>>.Success(rows);
    }

    /// <summary>
    /// Approves: the Membership is created and activated in one step (BA-004).
    /// The waiting happened in the request's own Submitted state; leaving the
    /// Membership Pending afterwards would invent a second confirmation nobody
    /// asked for.
    /// </summary>
    public async Task<ProvisioningResult<string>> ApproveAsync(
        string slug, Guid callerIdentityId, Guid requestId, CancellationToken ct = default)
    {
        var (workspace, error) = await ResolveReviewerAsync(slug, callerIdentityId, ct);
        if (error is not null) return ProvisioningResult<string>.Fail(error.Value.Error, error.Value.Message);

        var joinRequest = await db.JoinRequests
            .FirstOrDefaultAsync(r => r.Id == requestId && r.WorkspaceId == workspace!.Id, ct);

        if (joinRequest is null) return Fail<string>("No such request.", ProvisioningError.NotFound);

        // Between submission and approval they may have joined another way
        var alreadyMember = await db.Memberships.AnyAsync(
            m => m.IdentityId == joinRequest.IdentityId
              && m.WorkspaceId == workspace!.Id
              && m.Status == MembershipStatus.Active, ct);

        if (alreadyMember)
            return Fail<string>("That person is already a member of this workspace.", ProvisioningError.Conflict);

        try { joinRequest.Approve(callerIdentityId); }
        catch (InvalidOperationException ex) { return Fail<string>(ex.Message, ProvisioningError.Conflict); }

        // Exactly the role recorded on the request (§10). A reviewer wanting to
        // grant more approves first, then assigns — which leaves its own trail.
        var membership = Membership.Create(joinRequest.IdentityId, workspace!.Id, joinRequest.RequestedRole);
        membership.Activate();
        db.Memberships.Add(membership);

        await db.SaveChangesAsync(ct);
        return ProvisioningResult<string>.Success(joinRequest.Status.ToString());
    }

    public async Task<ProvisioningResult<string>> DeclineAsync(
        string slug, Guid callerIdentityId, Guid requestId, CancellationToken ct = default)
    {
        var (workspace, error) = await ResolveReviewerAsync(slug, callerIdentityId, ct);
        if (error is not null) return ProvisioningResult<string>.Fail(error.Value.Error, error.Value.Message);

        var joinRequest = await db.JoinRequests
            .FirstOrDefaultAsync(r => r.Id == requestId && r.WorkspaceId == workspace!.Id, ct);

        if (joinRequest is null) return Fail<string>("No such request.", ProvisioningError.NotFound);

        try { joinRequest.Decline(callerIdentityId); }
        catch (InvalidOperationException ex) { return Fail<string>(ex.Message, ProvisioningError.Conflict); }

        await db.SaveChangesAsync(ct);
        return ProvisioningResult<string>.Success(joinRequest.Status.ToString());
    }

    // ── Shared ───────────────────────────────────────────────────────────────

    private Task<Workspace?> FindAsync(string slug, CancellationToken ct) =>
        db.Workspaces.FirstOrDefaultAsync(w => w.Slug == slug.ToLowerInvariant().Trim(), ct);

    private async Task<(Workspace?, (ProvisioningError Error, string Message)?)> ResolveReviewerAsync(
        string slug, Guid callerIdentityId, CancellationToken ct)
    {
        var workspace = await FindAsync(slug, ct);
        if (workspace is null) return (null, (ProvisioningError.NotFound, "No such workspace."));

        var caller = await db.Memberships
            .Include(m => m.Roles)
            .AsNoTracking()
            .FirstOrDefaultAsync(m => m.WorkspaceId == workspace.Id
                                   && m.IdentityId == callerIdentityId
                                   && m.Status == MembershipStatus.Active, ct);

        // Non-members get 404, so status codes cannot map which Workspaces exist
        if (caller is null) return (null, (ProvisioningError.NotFound, "No such workspace."));

        if (!caller.Roles.Any(r => ReviewerRoles.Contains(r.Name)))
            return (null, (ProvisioningError.Forbidden, "Only an owner or administrator can review join requests."));

        return (workspace, null);
    }

    private static ProvisioningResult<T> Fail<T>(string message, ProvisioningError error)
        => ProvisioningResult<T>.Fail(error, message);
}
