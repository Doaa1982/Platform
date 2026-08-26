using Microsoft.EntityFrameworkCore;
using Platform.Api.Models;
using Platform.Domain;
using Platform.Infrastructure;

namespace Platform.Api.Services;

/// <summary>Why an operation was refused, so controllers can map it to a status code.</summary>
public enum ProvisioningError { None, NotFound, Conflict, Invalid, Forbidden }

public record ProvisioningResult<T>(T? Value, ProvisioningError Error = ProvisioningError.None, string? Message = null)
{
    public bool Ok => Error == ProvisioningError.None;
    public static ProvisioningResult<T> Success(T value) => new(value);
    public static ProvisioningResult<T> Fail(ProvisioningError error, string message) => new(default, error, message);
}

/// <summary>
/// Workspace provisioning and the Invitation lifecycle.
///
/// Implements Platform Administrator Business Analysis §7 and Invitation
/// Business Analysis §7–10. Per BA-003 no new domain method was required for
/// provisioning: this composes Workspace.Create, Invitation, Membership.Create/
/// Activate and Workspace.TransferOwnership, which already existed.
///
/// The cross-row rules the aggregates cannot enforce alone live here:
///   - at most one open Invitation per (email, Workspace)
///   - at most one open Owner Invitation for an unowned Workspace (BA-006),
///     so two people cannot both hold a link claiming the same Workspace
///   - lazy expiry: an Invitation past its date is expired the moment anyone
///     looks, with no background job (§10, "Expiry Rules")
/// </summary>
public class ProvisioningService(
    PlatformDbContext db,
    IConfiguration config,
    IInvitationDelivery delivery,
    EmailOptions email,
    CommercialSubscriptionService subscriptions)
{

    private TimeSpan ValidFor =>
        TimeSpan.FromDays(config.GetValue("Invitations:ValidForDays", 7));

    /// <summary>Relative for the client, which resolves it against its own origin.</summary>
    private static string LinkFor(string rawToken) => $"/invite/{rawToken}";

    /// <summary>Absolute for email, which has no origin to resolve against.</summary>
    private string AbsoluteLinkFor(string rawToken) =>
        $"{email.PublicBaseUrl.TrimEnd('/')}{LinkFor(rawToken)}";

    /// <summary>
    /// Hands the link to delivery and reports what happened. Failure is folded
    /// into the response rather than thrown: the Invitation is already valid,
    /// and the admin still has the link to send by hand.
    /// </summary>
    private async Task<InvitationIssuedResponse> DeliverAsync(
        Invitation invitation, string rawToken, string workspaceName, CancellationToken ct)
    {
        var outcome = await delivery.SendInvitationAsync(
            invitation.Email, workspaceName, invitation.IntendedRole.ToString(),
            AbsoluteLinkFor(rawToken), invitation.ExpiresAt, ct);

        return new InvitationIssuedResponse(
            InvitationId:    invitation.Id,
            Email:           invitation.Email,
            IntendedRole:    invitation.IntendedRole.ToString(),
            ExpiresAt:       invitation.ExpiresAt,
            InvitationLink:  LinkFor(rawToken),
            Delivered:       outcome.Delivered,
            DeliveryChannel: outcome.Channel,
            DeliveryDetail:  outcome.Detail);
    }

    // ── Admin: provisioning view ─────────────────────────────────────────────

    public async Task<IReadOnlyList<ProvisioningRow>> GetProvisioningViewAsync(CancellationToken ct = default)
    {
        var workspaces = await db.Workspaces.AsNoTracking().ToListAsync(ct);
        var invitations = await db.Invitations.AsNoTracking().ToListAsync(ct);
        var memberCounts = await db.Memberships.AsNoTracking()
            .Where(m => m.Status == MembershipStatus.Active)
            .GroupBy(m => m.WorkspaceId)
            .Select(g => new { WorkspaceId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.WorkspaceId, x => x.Count, ct);

        var now = DateTime.UtcNow;

        return workspaces
            .Select(w =>
            {
                // The invitation that still matters: the open one if any, else the latest
                var forWorkspace = invitations.Where(i => i.WorkspaceId == w.Id).ToList();
                var current = forWorkspace.FirstOrDefault(i => i.IsOpen(now))
                           ?? forWorkspace.OrderByDescending(i => i.IssuedAt).FirstOrDefault();

                return new ProvisioningRow(
                    WorkspaceId:        w.Id,
                    Name:               w.Name,
                    Slug:               w.Slug,
                    WorkspaceStatus:    w.Status.ToString(),
                    ProvisioningStatus: DeriveStatus(w, current, now),
                    HasOwner:           w.OwnerMembershipId is not null,
                    MemberCount:        memberCounts.GetValueOrDefault(w.Id, 0),
                    Invitation:         current is null ? null : Summarise(current, now));
            })
            .OrderBy(r => r.Name)
            .ToList();
    }

    /// <summary>
    /// The composed status from Platform Administrator Business Analysis §9.
    /// "Awaiting Invitation" and "Invitation Expired" are where the admin has
    /// outstanding work.
    /// </summary>
    private static string DeriveStatus(Workspace w, Invitation? current, DateTime now)
    {
        if (w.OwnerMembershipId is not null) return "Provisioned";
        if (current is null) return "Awaiting Invitation";
        if (current.IsOpen(now)) return "Invitation Sent";
        if (current.Status == InvitationStatus.Sent) return "Invitation Expired";  // lapsed but not yet written
        return current.Status switch
        {
            InvitationStatus.Expired   => "Invitation Expired",
            InvitationStatus.Cancelled => "Awaiting Invitation",
            InvitationStatus.Accepted  => "Provisioned",
            _                          => "Awaiting Invitation",
        };
    }

    private static InvitationSummary Summarise(Invitation i, DateTime now) => new(
        Id:           i.Id,
        Email:        i.Email,
        IntendedRole: i.IntendedRole.ToString(),
        // Report what the clock says, even if nothing has written Expired yet
        Status:       i.Status == InvitationStatus.Sent && i.ExpiresAt <= now
                          ? nameof(InvitationStatus.Expired)
                          : i.Status.ToString(),
        IssuedAt:     i.IssuedAt,
        ExpiresAt:    i.ExpiresAt,
        IsOpen:       i.IsOpen(now));

    // ── Admin: provision a Workspace and invite its Owner ────────────────────

    public async Task<ProvisioningResult<InvitationIssuedResponse>> ProvisionAsync(
        ProvisionWorkspaceRequest request, Guid issuedBy, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Slug))
            return ProvisioningResult<InvitationIssuedResponse>.Fail(
                ProvisioningError.Invalid, "A workspace needs a name and a slug.");

        if (string.IsNullOrWhiteSpace(request.OwnerEmail))
            return ProvisioningResult<InvitationIssuedResponse>.Fail(
                ProvisioningError.Invalid, "An owner email is required to send the invitation.");

        var slug = request.Slug.ToLowerInvariant().Trim();
        if (await db.Workspaces.AnyAsync(w => w.Slug == slug, ct))
            return ProvisioningResult<InvitationIssuedResponse>.Fail(
                ProvisioningError.Conflict, $"The slug \"{slug}\" is already taken.");

        var workspace = Workspace.Create(request.Name, slug, request.Description);
        db.Workspaces.Add(workspace);

        // The Workspace begins unowned; ownership transfers when the invitation
        // is accepted (Platform Administrator Business Analysis §7).
        var (invitation, rawToken) = Invitation.Issue(
            workspaceId:  workspace.Id,
            email:        request.OwnerEmail,
            intendedRole: WorkspaceRoleName.Owner,
            issuedBy:     issuedBy,
            validFor:     ValidFor);

        invitation.MarkSent();
        db.Invitations.Add(invitation);

        await db.SaveChangesAsync(ct);

        return ProvisioningResult<InvitationIssuedResponse>.Success(
            await DeliverAsync(invitation, rawToken, workspace.Name, ct));
    }

    // ── Admin: resend / cancel ───────────────────────────────────────────────

    public async Task<ProvisioningResult<InvitationIssuedResponse>> ResendAsync(
        Guid invitationId, CancellationToken ct = default)
    {
        var invitation = await db.Invitations.FirstOrDefaultAsync(i => i.Id == invitationId, ct);
        if (invitation is null)
            return ProvisioningResult<InvitationIssuedResponse>.Fail(ProvisioningError.NotFound, "No such invitation.");

        // Lazy expiry: fold the clock in before checking what transitions are legal
        ExpireIfLapsed(invitation);

        if (invitation.Status is not (InvitationStatus.Sent or InvitationStatus.Expired))
            return ProvisioningResult<InvitationIssuedResponse>.Fail(
                ProvisioningError.Conflict,
                invitation.Status == InvitationStatus.Accepted
                    ? "This invitation has already been accepted."
                    : "A cancelled invitation cannot be resent — issue a new one instead.");

        var rawToken = invitation.Resend(ValidFor);
        await db.SaveChangesAsync(ct);

        var workspaceName = await db.Workspaces
            .Where(w => w.Id == invitation.WorkspaceId)
            .Select(w => w.Name)
            .FirstOrDefaultAsync(ct) ?? "your workspace";

        return ProvisioningResult<InvitationIssuedResponse>.Success(
            await DeliverAsync(invitation, rawToken, workspaceName, ct));
    }

    public async Task<ProvisioningResult<bool>> CancelAsync(Guid invitationId, CancellationToken ct = default)
    {
        var invitation = await db.Invitations.FirstOrDefaultAsync(i => i.Id == invitationId, ct);
        if (invitation is null)
            return ProvisioningResult<bool>.Fail(ProvisioningError.NotFound, "No such invitation.");

        if (invitation.Status is not (InvitationStatus.Created or InvitationStatus.Sent))
            return ProvisioningResult<bool>.Fail(
                ProvisioningError.Conflict,
                invitation.Status == InvitationStatus.Accepted
                    ? "This invitation was already accepted — remove the membership instead."
                    : $"An invitation that is {invitation.Status} cannot be cancelled.");

        invitation.Cancel();
        await db.SaveChangesAsync(ct);
        return ProvisioningResult<bool>.Success(true);
    }

    // ── Invitee: preview and accept ──────────────────────────────────────────

    /// <summary>
    /// The Workspace an invitation token points at, read before acceptance
    /// consumes the token. Returns null when the token resolves to nothing.
    /// </summary>
    public async Task<Guid?> PeekWorkspaceIdAsync(string rawToken, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(rawToken)) return null;

        var hash = SecureToken.Hash(rawToken);
        return await db.Invitations.AsNoTracking()
            .Where(i => i.TokenHash == hash)
            .Select(i => (Guid?)i.WorkspaceId)
            .FirstOrDefaultAsync(ct);
    }

    public async Task<ProvisioningResult<InvitationPreview>> PreviewAsync(
        string rawToken, CancellationToken ct = default)
    {
        var (invitation, workspace, error) = await ResolveAsync(rawToken, ct);
        if (error is not null) return ProvisioningResult<InvitationPreview>.Fail(error.Value.Error, error.Value.Message);

        var accountExists = await db.Identities.AnyAsync(i => i.Email == invitation!.Email, ct);

        return ProvisioningResult<InvitationPreview>.Success(new InvitationPreview(
            WorkspaceName: workspace!.Name,
            Email:         invitation!.Email,
            IntendedRole:  invitation.IntendedRole.ToString(),
            ExpiresAt:     invitation.ExpiresAt,
            AccountExists: accountExists));
    }

    /// <summary>
    /// Accepts an Invitation: Identity Resolution, then Membership, then — for
    /// an Owner invitation — ownership transfer (§7).
    ///
    /// Covers the acceptance edge cases from Invitation Business Analysis §10
    /// explicitly, because each has a different correct answer and silently
    /// creating a second Membership would be the worst of them.
    /// </summary>
    public async Task<ProvisioningResult<LoginResponse>> AcceptAsync(
        string rawToken, AcceptInvitationRequest request, TokenService tokens, CancellationToken ct = default)
    {
        var (invitation, workspace, error) = await ResolveAsync(rawToken, ct);
        if (error is not null) return ProvisioningResult<LoginResponse>.Fail(error.Value.Error, error.Value.Message);

        if (string.IsNullOrWhiteSpace(request.Password))
            return ProvisioningResult<LoginResponse>.Fail(ProvisioningError.Invalid, "A password is required.");

        // ── Identity Resolution (Workspace_Access_Context §4.6) ──
        var identity = await db.Identities.FirstOrDefaultAsync(i => i.Email == invitation!.Email, ct);

        if (identity is null)
        {
            // The ordinary case, not an edge case: no Identity yet, so create one
            if (string.IsNullOrWhiteSpace(request.FullName))
                return ProvisioningResult<LoginResponse>.Fail(
                    ProvisioningError.Invalid, "Please tell us your name to finish setting up your account.");

            identity = Identity.Create(
                email:        invitation!.Email,
                passwordHash: BCrypt.Net.BCrypt.HashPassword(request.Password),
                fullName:     request.FullName);

            db.Identities.Add(identity);
        }
        else
        {
            // An existing Identity must prove it is really them — holding the
            // link is not enough to take over somebody else's account.
            if (!BCrypt.Net.BCrypt.Verify(request.Password, identity.PasswordHash))
                return ProvisioningResult<LoginResponse>.Fail(
                    ProvisioningError.Forbidden,
                    "That password doesn't match the existing account for this email.");

            // Edge case: resolved Identity is Suspended or Archived. Block, and
            // leave the Invitation open so the sender can see what happened.
            if (identity.Status != IdentityStatus.Active)
                return ProvisioningResult<LoginResponse>.Fail(
                    ProvisioningError.Forbidden,
                    "This account is not active. Please contact support.");

            // Edge case: already an Active Member. Rejected as a no-op rather
            // than silently creating a second Membership.
            var alreadyMember = await db.Memberships.AnyAsync(
                m => m.IdentityId == identity.Id
                  && m.WorkspaceId == invitation!.WorkspaceId
                  && m.Status == MembershipStatus.Active, ct);

            if (alreadyMember)
                return ProvisioningResult<LoginResponse>.Fail(
                    ProvisioningError.Conflict, "You're already a member of this workspace.");
        }

        var membership = Membership.Create(identity.Id, invitation!.WorkspaceId, invitation.IntendedRole);
        membership.Activate();
        db.Memberships.Add(membership);

        // §12.3 "Invite + Enroll": accepting only ever creates the Workspace
        // Membership. IntendedLearningProductId is a request to enrol, not an
        // Enrollment — the course stays paywalled until a tutor confirms
        // payment and enrols the member explicitly (WorkspaceMemberService.
        // EnrollMemberAsync). The Invitation keeps the field so the Members
        // screen can still show "invited for <course>, awaiting enrollment."

        // Ownership is held via a Membership, and only an Active one
        // (Workspace Aggregate Design, INV-003)
        if (invitation.IntendedRole == WorkspaceRoleName.Owner)
            workspace!.TransferOwnership(membership.Id);

        invitation.Accept();   // single-use from here: the token can never validate again

        await db.SaveChangesAsync(ct);

        if (invitation.IntendedRole == WorkspaceRoleName.Owner)
        {
            // Every Workspace starts with a real, active Free subscription —
            // no tutor action needed, no window where entitlements are just
            // silently absent. Best-effort: a hiccup here must never block
            // sign-in, since there is nothing commercial about accepting an
            // invitation — the tutor would otherwise just land on PlanPicker,
            // same as before this existed.
            await subscriptions.CheckoutAsync(
                workspace!.Slug, identity.Id,
                new CheckoutRequest(CommercialCatalog.FreePlanCode, null, BillingCycle.Monthly.ToString()), ct);
        }

        return ProvisioningResult<LoginResponse>.Success(tokens.Issue(identity));
    }

    // ── Shared resolution ────────────────────────────────────────────────────

    /// <summary>
    /// Finds the Invitation behind a raw token and checks everything that makes
    /// it usable. Returns the same message for "no such token" and "cancelled"
    /// so a link that never existed is indistinguishable from one withdrawn.
    /// </summary>
    private async Task<(Invitation?, Workspace?, (ProvisioningError Error, string Message)?)> ResolveAsync(
        string rawToken, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(rawToken))
            return (null, null, (ProvisioningError.NotFound, "This invitation link is not valid."));

        var hash = SecureToken.Hash(rawToken);
        var invitation = await db.Invitations.FirstOrDefaultAsync(i => i.TokenHash == hash, ct);

        if (invitation is null)
            return (null, null, (ProvisioningError.NotFound, "This invitation link is not valid."));

        ExpireIfLapsed(invitation);

        if (invitation.Status == InvitationStatus.Accepted)
            return (null, null, (ProvisioningError.Conflict, "This invitation has already been used."));

        if (invitation.Status == InvitationStatus.Expired)
            return (null, null, (ProvisioningError.Conflict, "This invitation has expired. Ask for a new one."));

        if (invitation.Status != InvitationStatus.Sent)
            return (null, null, (ProvisioningError.NotFound, "This invitation link is not valid."));

        var workspace = await db.Workspaces.FirstOrDefaultAsync(w => w.Id == invitation.WorkspaceId, ct);

        // Edge case: the Workspace was archived or deleted between Sent and
        // Accept. Fail clearly rather than marking the Invitation accepted
        // against a Workspace that no longer operates.
        if (workspace is null || workspace.Status is WorkspaceStatus.Archived or WorkspaceStatus.Deleted)
            return (null, null, (ProvisioningError.Conflict, "This workspace is no longer available."));

        return (invitation, workspace, null);
    }

    /// <summary>
    /// Lazy expiry (§10): nothing sweeps invitations in the background, so the
    /// lapse is written the first time anyone looks at one.
    /// </summary>
    private static void ExpireIfLapsed(Invitation invitation)
    {
        if (invitation.Status == InvitationStatus.Sent && invitation.ExpiresAt <= DateTime.UtcNow)
            invitation.Expire();
    }
}
