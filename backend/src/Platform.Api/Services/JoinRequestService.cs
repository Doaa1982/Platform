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
///   §10 — an open Invitation already exists for this email? (TD-016) —
///         without this, approving would fail against InviteAsync's own
///         dedupe check, leaving the request stuck in Submitted forever
///   BA-002 — Learner is the only requestable role in Version 1
/// </summary>
public class JoinRequestService(
    PlatformDbContext db, WorkspaceMemberService members,
    IConfiguration config, IInvitationDelivery delivery, EmailOptions email)
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
    /// How long the Join Request Status Link stays live — a backstop against
    /// an abandoned link, not a deadline on the request itself (§10: Join
    /// Requests do not expire; only this bearer link does). Generous, same
    /// reasoning and same default as Signup Status Link.
    /// </summary>
    private TimeSpan StatusLinkLifetime =>
        TimeSpan.FromDays(config.GetValue("JoinRequests:StatusLinkDays", 90));

    private static string LinkFor(string rawToken) => $"/join-requests/status/{rawToken}";
    private string AbsoluteLinkFor(string rawToken) =>
        $"{email.PublicBaseUrl.TrimEnd('/')}{LinkFor(rawToken)}";

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
    /// Submits a request. No Identity is created or resolved here — this is
    /// interest data for a reviewer to decide on, nothing more (§11).
    /// </summary>
    public async Task<ProvisioningResult<JoinRequestReceipt>> SubmitAsync(
        string slug, SubmitJoinRequest request, CancellationToken ct = default)
    {
        var workspace = await FindAsync(slug, ct);
        if (workspace is null || !IsDiscoverable(workspace))
            return Fail<JoinRequestReceipt>("No such workspace.", ProvisioningError.NotFound);

        if (!workspace.AcceptsJoinRequests)
            return Fail<JoinRequestReceipt>(
                "This workspace isn't accepting join requests. You'll need an invitation.",
                ProvisioningError.Conflict);

        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.FullName))
            return Fail<JoinRequestReceipt>("Please tell us your name and email.", ProvisioningError.Invalid);

        var email = request.Email.ToLowerInvariant().Trim();

        // Already in? The answer is that they are already in.
        var alreadyMember = await (
            from m in db.Memberships
            join i in db.Identities on m.IdentityId equals i.Id
            where m.WorkspaceId == workspace.Id && i.Email == email && m.Status == MembershipStatus.Active
            select m.Id).AnyAsync(ct);

        if (alreadyMember)
            return Fail<JoinRequestReceipt>("You're already a member of this workspace.", ProvisioningError.Conflict);

        // TD-016: an open Invitation already reaches this email. Without this
        // check, a reviewer's later approval would fail against InviteAsync's
        // own dedupe rule (§8: at most one open Invitation per email/Workspace),
        // leaving the request stuck in Submitted with no way to approve it.
        var outstandingInvitations = await db.Invitations
            .Where(i => i.WorkspaceId == workspace.Id && i.Email == email)
            .ToListAsync(ct);

        if (outstandingInvitations.Any(i => i.IsOpen()))
            return Fail<JoinRequestReceipt>(
                "You already have an open invitation to this workspace. Check your email for it.",
                ProvisioningError.Conflict);

        // §10: at most one Submitted request per (email, Workspace)
        var alreadyAsked = await db.JoinRequests.AnyAsync(
            r => r.Email == email && r.WorkspaceId == workspace.Id && r.Status == JoinRequestStatus.Submitted, ct);

        if (alreadyAsked)
            return Fail<JoinRequestReceipt>(
                "You've already asked to join this workspace. They haven't answered yet.",
                ProvisioningError.Conflict);

        var (joinRequest, rawToken) = JoinRequest.Submit(
            workspaceId:   workspace.Id,
            email:         email,
            fullName:      request.FullName.Trim(),
            requestedRole: RequestableRoles[0],
            linkValidFor:  StatusLinkLifetime,
            message:       request.Message);

        db.JoinRequests.Add(joinRequest);
        await db.SaveChangesAsync(ct);

        // Best-effort: the link is also returned directly below, so delivery
        // failure here does not strand the requester the way a lost email would.
        await delivery.SendJoinRequestReceiptAsync(
            joinRequest.Email, workspace.Name, AbsoluteLinkFor(rawToken), joinRequest.TokenExpiresAt!.Value, ct);

        return ProvisioningResult<JoinRequestReceipt>.Success(
            new JoinRequestReceipt(joinRequest.Id, joinRequest.Status.ToString(), LinkFor(rawToken)));
    }

    // ── Anonymous: checking back ─────────────────────────────────────────────

    /// <summary>
    /// Resolves the Join Request Status Link (§16, "Checking back without an
    /// Identity" — TD-018). The requester has no Identity and no credential,
    /// so this token is the only way they can see what happened to their
    /// request — same mechanism as Signup Status Link (TD-011: SecureToken is
    /// shared, the aggregates are not).
    /// </summary>
    public async Task<ProvisioningResult<JoinRequestStatusResponse>> GetStatusAsync(
        string rawToken, CancellationToken ct = default)
    {
        var joinRequest = await FindByTokenAsync(rawToken, ct);
        if (joinRequest is null)
            return Fail<JoinRequestStatusResponse>("This link isn't valid.", ProvisioningError.NotFound);

        var (headline, detail) = Message(joinRequest);

        return ProvisioningResult<JoinRequestStatusResponse>.Success(new JoinRequestStatusResponse(
            FullName:    joinRequest.FullName,
            Email:       joinRequest.Email,
            Status:      joinRequest.Status.ToString(),
            Headline:    headline,
            Detail:      detail,
            SubmittedAt: joinRequest.SubmittedAt));
    }

    /// <summary>
    /// Resolves a status link, treating an expired one as no match at all. A
    /// refusal that still confirmed the request existed would leak the very
    /// thing the expiry is there to stop leaking (same reasoning as
    /// SignupRequestService.FindByTokenAsync).
    /// </summary>
    private async Task<JoinRequest?> FindByTokenAsync(string rawToken, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(rawToken)) return null;

        var hash = SecureToken.Hash(rawToken);
        var found = await db.JoinRequests.AsNoTracking().FirstOrDefaultAsync(r => r.TokenHash == hash, ct);

        return found is not null && found.StatusLinkIsValid() ? found : null;
    }

    /// <summary>
    /// The requester-facing wording for each outcome. Declined deliberately
    /// gives no reason (BA-006) — same refusal a reviewer's decline already
    /// produces, just phrased for the person on the other end of the link.
    /// </summary>
    private static (string Headline, string Detail) Message(JoinRequest r) => r.Status switch
    {
        JoinRequestStatus.Submitted =>
            ("Your request is waiting for a decision",
             "You'll be notified once the workspace has decided."),

        JoinRequestStatus.Approved =>
            ("Your request was approved",
             "Check your email for an invitation — accepting it is what creates your account and your membership."),

        JoinRequestStatus.Declined =>
            ("Your request wasn't approved",
             "This workspace decided not to approve your request at this time."),

        JoinRequestStatus.Withdrawn =>
            ("You withdrew this request",
             "No decision was made. You're welcome to ask again."),

        _ => ("Join request", string.Empty),
    };

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
    /// Approves: turns the request into a real Invitation to its email,
    /// exactly the role recorded on it (§10) — the same path anyone invited
    /// outright goes through. No Membership, and no Identity, exists yet;
    /// both wait for the invitation to be accepted (WA-105). Reuses
    /// WorkspaceMemberService's issuance so the two inbound paths cannot drift
    /// apart on dedupe rules or delivery.
    /// </summary>
    public async Task<ProvisioningResult<string>> ApproveAsync(
        string slug, Guid callerIdentityId, Guid requestId, CancellationToken ct = default)
    {
        var (workspace, error) = await ResolveReviewerAsync(slug, callerIdentityId, ct);
        if (error is not null) return ProvisioningResult<string>.Fail(error.Value.Error, error.Value.Message);

        var joinRequest = await db.JoinRequests
            .FirstOrDefaultAsync(r => r.Id == requestId && r.WorkspaceId == workspace!.Id, ct);

        if (joinRequest is null) return Fail<string>("No such request.", ProvisioningError.NotFound);

        var invited = await members.InviteAsync(
            slug, callerIdentityId,
            new InviteMemberRequest(joinRequest.Email, joinRequest.RequestedRole.ToString()), ct);

        if (invited.Error != ProvisioningError.None)
            return Fail<string>(invited.Message ?? "Could not issue an invitation.", invited.Error);

        try { joinRequest.Approve(callerIdentityId); }
        catch (InvalidOperationException ex) { return Fail<string>(ex.Message, ProvisioningError.Conflict); }

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
