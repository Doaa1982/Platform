using Microsoft.EntityFrameworkCore;
using Npgsql;
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
    EmailOptions email,
    EntitlementResolutionService entitlements)
{
    /// <summary>Roles that may manage members. Everyone else gets a read-only view.</summary>
    private static readonly WorkspaceRoleName[] ManagerRoles =
        [WorkspaceRoleName.Owner, WorkspaceRoleName.Administrator];

    /// <summary>
    /// Roles that draw against the plan's tutor-capacity entitlement — the
    /// platform's own staff, not Learners/Parents/FinanceManagers.
    /// A List, not an array: EF Core's query translator cannot evaluate an
    /// array field's Contains() inside a nested Any() subquery on .NET 10 —
    /// it resolves to the ReadOnlySpan-based MemoryExtensions.Contains
    /// overload, which is a ref struct the interpreter cannot instantiate as
    /// a generic argument. List&lt;T&gt;.Contains has no such overload.
    /// </summary>
    private static readonly List<WorkspaceRoleName> TutorRoles =
        [WorkspaceRoleName.Owner, WorkspaceRoleName.Administrator, WorkspaceRoleName.Teacher, WorkspaceRoleName.AssistantTeacher];

    /// <summary>Roles that draw against the plan's learner-capacity entitlement. Same List&lt;T&gt; reasoning as TutorRoles above.</summary>
    private static readonly List<WorkspaceRoleName> LearnerRoles = [WorkspaceRoleName.Learner];

    private TimeSpan ValidFor => TimeSpan.FromDays(config.GetValue("Invitations:ValidForDays", 7));

    /// <summary>
    /// Ceiling on recipients per bulk-invite request (§4). SMTP delivery has no
    /// connection pooling — a fresh connect/send/disconnect per message — so an
    /// unbounded batch risks a slow or timed-out request rather than a domain
    /// problem. Configurable so ops can tune it without a redeploy.
    /// </summary>
    private int MaxBulkRecipients => config.GetValue("Invitations:MaxBulkRecipients", 50);

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

        var enrollments = await db.Enrollments.AsNoTracking()
            .Where(e => e.WorkspaceId == workspace.Id)
            .ToListAsync(ct);
        var enrollmentsByMembership = enrollments
            .GroupBy(e => e.MembershipId)
            .ToDictionary(g => g.Key, g => g.Select(e => e.LearningProductId).ToHashSet());

        // Denormalised for display only — one query for the whole list
        // rather than N+1 per invitation/enrollment.
        var productIds = invitations
            .Where(i => i.IntendedLearningProductId is not null)
            .Select(i => i.IntendedLearningProductId!.Value)
            .Concat(enrollments.Select(e => e.LearningProductId))
            .Distinct()
            .ToList();
        var productTitles = await db.LearningProducts.AsNoTracking()
            .Where(p => productIds.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, p => p.Title, ct);

        var now = DateTime.UtcNow;

        var members = memberships
            .Select(m =>
            {
                identities.TryGetValue(m.IdentityId, out var identity);
                var enrolledIds = enrollmentsByMembership.GetValueOrDefault(m.Id) ?? [];
                var enrolledCourses = enrolledIds
                    .Select(pid => new EnrolledCourseInfo(pid, productTitles.GetValueOrDefault(pid) ?? "(deleted course)"))
                    .ToList();

                // §12.3: the most recent accepted Invitation that named a
                // course this member isn't enrolled in yet — "awaiting
                // enrollment" from the tutor's side, i.e. awaiting payment.
                var pendingInvite = identity is null
                    ? null
                    : invitations.FirstOrDefault(i =>
                        i.Email == identity.Email
                        && i.Status == InvitationStatus.Accepted
                        && i.IntendedLearningProductId is not null
                        && !enrolledIds.Contains(i.IntendedLearningProductId!.Value));

                return new WorkspaceMemberRow(
                    MembershipId: m.Id,
                    IdentityId:   m.IdentityId,
                    Email:        identity?.Email ?? "(unknown)",
                    FullName:     identity?.FullName ?? "(unknown)",
                    Status:       m.Status.ToString(),
                    Roles:        m.Roles.Select(r => r.Name.ToString()).OrderBy(r => r).ToList(),
                    IsOwner:      workspace.OwnerMembershipId == m.Id,
                    CreatedAt:    m.CreatedAt,
                    LastActiveAt: m.LastActiveAt,
                    EnrolledCourses: enrolledCourses,
                    PendingInvitedProductId:    pendingInvite?.IntendedLearningProductId,
                    PendingInvitedProductTitle: pendingInvite?.IntendedLearningProductId is Guid pendingId
                                                     ? productTitles.GetValueOrDefault(pendingId)
                                                     : null);
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
                               IsOpen:       i.IsOpen(now),
                               BatchId:      i.BatchId,
                               IntendedLearningProductId:    i.IntendedLearningProductId,
                               IntendedLearningProductTitle: i.IntendedLearningProductId is Guid pid
                                                                  ? productTitles.GetValueOrDefault(pid)
                                                                  : null)).ToList()));
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

        if (TutorRoles.Contains(role))
        {
            var capacityError = await CheckTutorCapacityAsync(workspace.Id, ct);
            if (capacityError is not null)
                return Fail(capacityError, ProvisioningError.Conflict);
        }

        if (LearnerRoles.Contains(role))
        {
            var capacityError = await CheckLearnerCapacityAsync(workspace.Id, ct);
            if (capacityError is not null)
                return Fail(capacityError, ProvisioningError.Conflict);
        }

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

        var outcome = await SendInvitationEmailAsync(invitation, rawToken, workspace.Name, ct);

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

    /// <summary>
    /// Invites many recipients at once under one Invitation Batch (§4). Each
    /// recipient still gets its own independent Invitation with its own status
    /// (Rule 4) — a bad recipient (already a member, a duplicate open invite,
    /// or one that would exceed tutor capacity) is skipped individually rather
    /// than failing the whole request. Role, source and authority are resolved
    /// once for the batch, not per recipient (§13's UI picks one role per
    /// bulk-invite operation).
    /// </summary>
    public async Task<ProvisioningResult<BulkInvitationIssuedResponse>> InviteBulkAsync(
        string slug, Guid callerIdentityId, BulkInviteMemberRequest request, CancellationToken ct = default)
    {
        var context = await ResolveAsync(slug, callerIdentityId, requireManage: true, ct);
        if (context.Error is not null)
            return ProvisioningResult<BulkInvitationIssuedResponse>.Fail(context.Error.Value.Error, context.Error.Value.Message);

        var workspace = context.Workspace!;

        if (!Enum.TryParse<WorkspaceRoleName>(request.Role, out var role))
            return FailBulk($"\"{request.Role}\" is not a workspace role.", ProvisioningError.Invalid);

        // BA-006: ownership moves by transfer, never by inviting a second claimant
        if (role == WorkspaceRoleName.Owner)
            return FailBulk("Ownership is transferred, not invited. Invite an Administrator instead.", ProvisioningError.Invalid);

        if (!Enum.TryParse<InvitationBatchSource>(request.Source, out var source))
            return FailBulk($"\"{request.Source}\" is not a recognised invitation source.", ProvisioningError.Invalid);

        // §12.3 "Invite + Enroll": one course applies to the whole batch. Only
        // a Published product is enrollable anywhere else in the platform
        // (Learning Delivery gates curriculum access the same way), so the
        // same rule applies here rather than letting an invite promise access
        // to a Draft nobody can actually open yet.
        if (request.IntendedLearningProductId is Guid productId)
        {
            var productIsPublished = await db.LearningProducts.AnyAsync(
                p => p.Id == productId && p.WorkspaceId == workspace.Id && p.Status == LearningProductStatus.Published, ct);
            if (!productIsPublished)
                return FailBulk("The selected course isn't a published learning product in this workspace.", ProvisioningError.Invalid);
        }

        var emails = (request.Recipients ?? [])
            .Select(r => r.Email?.ToLowerInvariant().Trim() ?? string.Empty)
            .Where(e => !string.IsNullOrWhiteSpace(e))
            .Distinct()
            .ToList();

        if (emails.Count == 0)
            return FailBulk("At least one recipient email is required.", ProvisioningError.Invalid);

        if (emails.Count > MaxBulkRecipients)
            return FailBulk(
                $"A bulk invitation may include at most {MaxBulkRecipients} recipients at a time; this one has {emails.Count}.",
                ProvisioningError.Invalid);

        // Already-active-member and §8 duplicate-open-invitation checks,
        // batched once for the whole request rather than per recipient.
        var activeMemberEmails = await (
            from m in db.Memberships
            join i in db.Identities on m.IdentityId equals i.Id
            where m.WorkspaceId == workspace.Id && emails.Contains(i.Email) && m.Status == MembershipStatus.Active
            select i.Email).ToListAsync(ct);
        var activeMemberSet = activeMemberEmails.ToHashSet();

        var candidateInvitations = await db.Invitations
            .Where(i => i.WorkspaceId == workspace.Id && emails.Contains(i.Email))
            .ToListAsync(ct);
        var openInviteSet = candidateInvitations.Where(i => i.IsOpen()).Select(i => i.Email).ToHashSet();

        // Tutor/learner capacity are batch-wide questions (one role for the
        // whole request), computed once — not re-checked per recipient.
        int? remainingTutorSeats = null;
        if (TutorRoles.Contains(role))
        {
            var capacityValue = await entitlements.GetEntitlementValueAsync(
                workspace.Id, EntitlementResolutionService.TutorCapacityKey, ct);
            if (capacityValue is not null && int.TryParse(capacityValue, out var capacity))
            {
                var (activeTutorSeats, pendingTutorSeats) = await GetTutorSeatUsageAsync(workspace.Id, ct);
                remainingTutorSeats = Math.Max(0, capacity - activeTutorSeats - pendingTutorSeats);
            }
        }

        int? remainingLearnerSeats = null;
        if (LearnerRoles.Contains(role))
        {
            var capacityValue = await entitlements.GetEntitlementValueAsync(
                workspace.Id, EntitlementResolutionService.LearnerCapacityKey, ct);
            if (capacityValue is not null && int.TryParse(capacityValue, out var capacity))
            {
                var (activeLearnerSeats, pendingLearnerSeats) = await GetLearnerSeatUsageAsync(workspace.Id, ct);
                remainingLearnerSeats = Math.Max(0, capacity - activeLearnerSeats - pendingLearnerSeats);
            }
        }

        var batch = InvitationBatch.Create(workspace.Id, callerIdentityId, source, emails.Count);
        db.InvitationBatches.Add(batch);

        // Phase 1 (sequential, DB-bound): decide each recipient's outcome and
        // issue+persist the ones that pass, in one SaveChanges for the batch.
        var pending = new List<(Invitation Invitation, string RawToken)>();
        var results = new List<BulkInvitationRecipientResult>();

        foreach (var recipientEmail in emails)
        {
            if (activeMemberSet.Contains(recipientEmail))
            {
                results.Add(new BulkInvitationRecipientResult(
                    recipientEmail, "skipped", "Already an active member of this workspace.", null, null, null, null));
                continue;
            }

            if (openInviteSet.Contains(recipientEmail))
            {
                results.Add(new BulkInvitationRecipientResult(
                    recipientEmail, "skipped", "There's already an open invitation for that email.", null, null, null, null));
                continue;
            }

            if (remainingTutorSeats is 0)
            {
                results.Add(new BulkInvitationRecipientResult(
                    recipientEmail, "skipped", "This workspace's plan has no remaining tutor seats.", null, null, null, null));
                continue;
            }

            if (remainingLearnerSeats is 0)
            {
                results.Add(new BulkInvitationRecipientResult(
                    recipientEmail, "skipped", "This workspace's plan has no remaining learner seats.", null, null, null, null));
                continue;
            }

            var (invitation, rawToken) = Invitation.Issue(
                workspaceId:  workspace.Id,
                email:        recipientEmail,
                intendedRole: role,
                issuedBy:     callerIdentityId,
                validFor:     ValidFor,
                batchId:      batch.Id,
                intendedLearningProductId: request.IntendedLearningProductId);

            invitation.MarkSent();
            db.Invitations.Add(invitation);
            pending.Add((invitation, rawToken));

            if (remainingTutorSeats is not null)
                remainingTutorSeats--;
            if (remainingLearnerSeats is not null)
                remainingLearnerSeats--;
        }

        await db.SaveChangesAsync(ct);

        // Phase 2 (network-bound): deliver the issued invitations with bounded
        // concurrency — SMTP has no connection pooling, and sending 50 emails
        // strictly sequentially would make the request needlessly slow.
        // Delivery never throws (failure is captured in the outcome), so
        // Task.WhenAll needs no exception-aggregation handling here.
        using var deliveryThrottle = new SemaphoreSlim(8);
        var deliveryTasks = pending.Select(async p =>
        {
            await deliveryThrottle.WaitAsync(ct);
            try
            {
                var outcome = await SendInvitationEmailAsync(p.Invitation, p.RawToken, workspace.Name, ct);
                return new BulkInvitationRecipientResult(
                    p.Invitation.Email, "issued", null, p.Invitation.Id, $"/invite/{p.RawToken}",
                    outcome.Delivered, outcome.Detail);
            }
            finally { deliveryThrottle.Release(); }
        });

        results.AddRange(await Task.WhenAll(deliveryTasks));

        // Preserve the caller's original recipient order in the response.
        var order = emails.Select((e, i) => (e, i)).ToDictionary(x => x.e, x => x.i);
        results = results.OrderBy(r => order[r.Email]).ToList();

        return ProvisioningResult<BulkInvitationIssuedResponse>.Success(new BulkInvitationIssuedResponse(
            BatchId:         batch.Id,
            TotalRecipients: emails.Count,
            IssuedCount:     results.Count(r => r.Outcome == "issued"),
            SkippedCount:    results.Count(r => r.Outcome == "skipped"),
            Results:         results));
    }

    // ── Resend / cancel ──────────────────────────────────────────────────────

    /// <summary>
    /// Resends an outstanding invitation: fresh token, reset expiry, same
    /// Invitation row (§9, §10 "Resend Rules") — never a second parallel one.
    /// Legal from Sent or Expired only.
    /// </summary>
    public async Task<ProvisioningResult<InvitationIssuedResponse>> ResendInvitationAsync(
        string slug, Guid callerIdentityId, Guid invitationId, CancellationToken ct = default)
    {
        var context = await ResolveAsync(slug, callerIdentityId, requireManage: true, ct);
        if (context.Error is not null)
            return ProvisioningResult<InvitationIssuedResponse>.Fail(context.Error.Value.Error, context.Error.Value.Message);

        var workspace = context.Workspace!;

        var invitation = await db.Invitations
            .FirstOrDefaultAsync(i => i.Id == invitationId && i.WorkspaceId == workspace.Id, ct);
        if (invitation is null)
            return Fail("No such invitation.", ProvisioningError.NotFound);

        // Lazy expiry: fold the clock in before checking what transitions are legal
        ExpireIfLapsed(invitation);

        if (invitation.Status is not (InvitationStatus.Sent or InvitationStatus.Expired))
            return Fail(
                invitation.Status == InvitationStatus.Accepted
                    ? "This invitation has already been accepted."
                    : "A cancelled invitation cannot be resent — send a new one instead.",
                ProvisioningError.Conflict);

        var rawToken = invitation.Resend(ValidFor);
        await db.SaveChangesAsync(ct);

        var outcome = await SendInvitationEmailAsync(invitation, rawToken, workspace.Name, ct);

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

    /// <summary>
    /// Cancels an invitation before it's been accepted (§9). Legal from
    /// Created or Sent only — an accepted Invitation is a Membership concern
    /// now (§10.1), not an Invitation one.
    /// </summary>
    public async Task<ProvisioningResult<string>> CancelInvitationAsync(
        string slug, Guid callerIdentityId, Guid invitationId, CancellationToken ct = default)
    {
        var context = await ResolveAsync(slug, callerIdentityId, requireManage: true, ct);
        if (context.Error is not null)
            return ProvisioningResult<string>.Fail(context.Error.Value.Error, context.Error.Value.Message);

        var workspace = context.Workspace!;

        var invitation = await db.Invitations
            .FirstOrDefaultAsync(i => i.Id == invitationId && i.WorkspaceId == workspace.Id, ct);
        if (invitation is null)
            return Fail<string>("No such invitation.", ProvisioningError.NotFound);

        ExpireIfLapsed(invitation);

        if (invitation.Status is not (InvitationStatus.Created or InvitationStatus.Sent))
            return Fail<string>(
                invitation.Status == InvitationStatus.Accepted
                    ? "This invitation was already accepted — remove the membership instead."
                    : $"An invitation that is {invitation.Status} cannot be cancelled.",
                ProvisioningError.Conflict);

        invitation.Cancel();
        await db.SaveChangesAsync(ct);
        return ProvisioningResult<string>.Success(invitation.Status.ToString());
    }

    private static void ExpireIfLapsed(Invitation invitation)
    {
        if (invitation.Status == InvitationStatus.Sent && invitation.ExpiresAt <= DateTime.UtcNow)
            invitation.Expire();
    }

    /// <summary>
    /// Counts active tutor Memberships plus still-open tutor Invitations —
    /// the two ingredients of the tutor-capacity check (LIC-008 consumer),
    /// extracted so a bulk invite can compute this once for the whole batch
    /// instead of once per recipient.
    /// </summary>
    private async Task<(int ActiveTutorSeats, int PendingTutorSeats)> GetTutorSeatUsageAsync(Guid workspaceId, CancellationToken ct)
    {
        var activeTutorSeats = await db.Memberships
            .Where(m => m.WorkspaceId == workspaceId && m.Status == MembershipStatus.Active)
            .Where(m => m.Roles.Any(r => TutorRoles.Contains(r.Name)))
            .CountAsync(ct);

        var openTutorInvites = await db.Invitations
            .Where(i => i.WorkspaceId == workspaceId && TutorRoles.Contains(i.IntendedRole))
            .ToListAsync(ct);
        var pendingTutorSeats = openTutorInvites.Count(i => i.IsOpen());

        return (activeTutorSeats, pendingTutorSeats);
    }

    /// <summary>
    /// Counts active tutor Memberships plus still-open tutor Invitations
    /// against the plan's tutor-capacity entitlement (LIC-008 consumer).
    /// A Workspace with no License yet (never subscribed) is left
    /// unrestricted here — capacity is a plan constraint, and there is no
    /// plan to constrain against until checkout happens.
    /// </summary>
    private async Task<string?> CheckTutorCapacityAsync(Guid workspaceId, CancellationToken ct)
    {
        var capacityValue = await entitlements.GetEntitlementValueAsync(
            workspaceId, EntitlementResolutionService.TutorCapacityKey, ct);
        if (capacityValue is null || !int.TryParse(capacityValue, out var capacity))
            return null;

        var (activeTutorSeats, pendingTutorSeats) = await GetTutorSeatUsageAsync(workspaceId, ct);

        if (activeTutorSeats + pendingTutorSeats + 1 <= capacity)
            return null;

        return pendingTutorSeats > 0
            ? $"This workspace's plan allows up to {capacity} tutor seat{(capacity == 1 ? "" : "s")} ({activeTutorSeats} active, {pendingTutorSeats} pending). Remove a member, wait for a pending invitation to lapse, or upgrade the plan."
            : $"This workspace's plan allows up to {capacity} tutor seat{(capacity == 1 ? "" : "s")} and is already at capacity. Remove a member or upgrade the plan to invite another tutor.";
    }

    /// <summary>
    /// Counts active Learner Memberships plus still-open Learner Invitations —
    /// the two ingredients of the learner-capacity check, mirroring
    /// <see cref="GetTutorSeatUsageAsync"/> exactly.
    /// </summary>
    private async Task<(int ActiveLearnerSeats, int PendingLearnerSeats)> GetLearnerSeatUsageAsync(Guid workspaceId, CancellationToken ct)
    {
        var activeLearnerSeats = await db.Memberships
            .Where(m => m.WorkspaceId == workspaceId && m.Status == MembershipStatus.Active)
            .Where(m => m.Roles.Any(r => LearnerRoles.Contains(r.Name)))
            .CountAsync(ct);

        var openLearnerInvites = await db.Invitations
            .Where(i => i.WorkspaceId == workspaceId && LearnerRoles.Contains(i.IntendedRole))
            .ToListAsync(ct);
        var pendingLearnerSeats = openLearnerInvites.Count(i => i.IsOpen());

        return (activeLearnerSeats, pendingLearnerSeats);
    }

    /// <summary>
    /// Counts active Learner Memberships plus still-open Learner Invitations
    /// against the plan's learner-capacity entitlement, mirroring
    /// <see cref="CheckTutorCapacityAsync"/> exactly. A Workspace with no
    /// License yet is left unrestricted, same reasoning as the tutor check.
    /// </summary>
    private async Task<string?> CheckLearnerCapacityAsync(Guid workspaceId, CancellationToken ct)
    {
        var capacityValue = await entitlements.GetEntitlementValueAsync(
            workspaceId, EntitlementResolutionService.LearnerCapacityKey, ct);
        if (capacityValue is null || !int.TryParse(capacityValue, out var capacity))
            return null;

        var (activeLearnerSeats, pendingLearnerSeats) = await GetLearnerSeatUsageAsync(workspaceId, ct);

        if (activeLearnerSeats + pendingLearnerSeats + 1 <= capacity)
            return null;

        return pendingLearnerSeats > 0
            ? $"This workspace's plan allows up to {capacity} learner{(capacity == 1 ? "" : "s")} ({activeLearnerSeats} active, {pendingLearnerSeats} pending). Wait for a pending invitation to lapse, or upgrade the plan."
            : $"This workspace's plan allows up to {capacity} learner{(capacity == 1 ? "" : "s")} and is already at capacity. Upgrade the plan to invite more learners.";
    }

    private Task<DeliveryOutcome> SendInvitationEmailAsync(
        Invitation invitation, string rawToken, string workspaceName, CancellationToken ct) =>
        delivery.SendInvitationAsync(
            invitation.Email, workspaceName, invitation.IntendedRole.ToString(),
            AbsoluteLink(rawToken), invitation.ExpiresAt, ct);

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
    /// Enrols an already-Active member into a Published Learning Product
    /// (§12.3) — the tutor's "payment confirmed" action, whether this member
    /// was invited with that course attached or is simply already in the
    /// workspace and being added to a course directly. Never implicit: this
    /// is the only place (besides a Learner opening a Published product
    /// themselves) that creates an Enrollment.
    /// </summary>
    public async Task<ProvisioningResult<WorkspaceMemberRow>> EnrollMemberAsync(
        string slug, Guid callerIdentityId, Guid membershipId, Guid learningProductId, CancellationToken ct = default)
    {
        var context = await ResolveAsync(slug, callerIdentityId, requireManage: true, ct);
        if (context.Error is not null)
            return ProvisioningResult<WorkspaceMemberRow>.Fail(context.Error.Value.Error, context.Error.Value.Message);

        var workspace = context.Workspace!;

        var membership = await db.Memberships
            .Include(m => m.Roles)
            .FirstOrDefaultAsync(m => m.Id == membershipId && m.WorkspaceId == workspace.Id, ct);
        if (membership is null)
            return FailMember("No such member in this workspace.", ProvisioningError.NotFound);
        if (membership.Status != MembershipStatus.Active)
            return FailMember("Only an active member can be enrolled in a course.", ProvisioningError.Conflict);

        var product = await db.LearningProducts
            .FirstOrDefaultAsync(p => p.Id == learningProductId && p.WorkspaceId == workspace.Id, ct);
        if (product is null)
            return FailMember("No such learning product in this workspace.", ProvisioningError.NotFound);
        // Same rule as the invite-time check (§12.3): nothing enrolls into a
        // Draft nobody could actually open yet.
        if (product.Status != LearningProductStatus.Published)
            return FailMember("Only a published learning product can be enrolled into.", ProvisioningError.Invalid);

        var alreadyEnrolled = await db.Enrollments.AnyAsync(
            e => e.MembershipId == membership.Id && e.LearningProductId == learningProductId, ct);
        if (alreadyEnrolled)
            return FailMember("This member is already enrolled in that course.", ProvisioningError.Conflict);

        db.Enrollments.Add(Enrollment.Create(workspace.Id, learningProductId, membership.Id));
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex))
        {
            // Lost a concurrent enroll of the same (membership, product) — the
            // post-condition (enrolled) holds either way, just not via us.
            return FailMember("This member is already enrolled in that course.", ProvisioningError.Conflict);
        }

        var identity = await db.Identities.AsNoTracking().FirstOrDefaultAsync(i => i.Id == membership.IdentityId, ct);
        var enrolledCourses = await db.Enrollments.AsNoTracking()
            .Where(e => e.MembershipId == membership.Id)
            .Join(db.LearningProducts.AsNoTracking(), e => e.LearningProductId, p => p.Id,
                  (e, p) => new EnrolledCourseInfo(p.Id, p.Title))
            .ToListAsync(ct);

        return ProvisioningResult<WorkspaceMemberRow>.Success(new WorkspaceMemberRow(
            MembershipId: membership.Id,
            IdentityId:   membership.IdentityId,
            Email:        identity?.Email ?? "(unknown)",
            FullName:     identity?.FullName ?? "(unknown)",
            Status:       membership.Status.ToString(),
            Roles:        membership.Roles.Select(r => r.Name.ToString()).OrderBy(r => r).ToList(),
            IsOwner:      workspace.OwnerMembershipId == membership.Id,
            CreatedAt:    membership.CreatedAt,
            LastActiveAt: membership.LastActiveAt,
            EnrolledCourses: enrolledCourses,
            PendingInvitedProductId:    null,
            PendingInvitedProductTitle: null));
    }

    private static ProvisioningResult<WorkspaceMemberRow> FailMember(string message, ProvisioningError error) =>
        ProvisioningResult<WorkspaceMemberRow>.Fail(error, message);

    /// <summary>
    /// One Learning Product's roster (§12.3 course-management view): who is
    /// enrolled, and who has an outstanding Invitation naming this course —
    /// the two lists a tutor needs to manage a single course's admissions
    /// without hunting through the whole-workspace Members screen.
    /// </summary>
    public async Task<ProvisioningResult<ProductRosterResponse>> GetProductRosterAsync(
        string slug, Guid callerIdentityId, Guid productId, CancellationToken ct = default)
    {
        var context = await ResolveAsync(slug, callerIdentityId, requireManage: true, ct);
        if (context.Error is not null)
            return ProvisioningResult<ProductRosterResponse>.Fail(context.Error.Value.Error, context.Error.Value.Message);

        var workspace = context.Workspace!;

        var product = await db.LearningProducts.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == productId && p.WorkspaceId == workspace.Id, ct);
        if (product is null)
            return ProvisioningResult<ProductRosterResponse>.Fail(ProvisioningError.NotFound, "No such learning product in this workspace.");

        var enrollments = await db.Enrollments.AsNoTracking()
            .Where(e => e.LearningProductId == productId && e.WorkspaceId == workspace.Id)
            .OrderByDescending(e => e.CreatedAt)
            .ToListAsync(ct);

        var membershipIds = enrollments.Select(e => e.MembershipId).ToList();
        var memberships = await db.Memberships.AsNoTracking()
            .Where(m => membershipIds.Contains(m.Id))
            .ToDictionaryAsync(m => m.Id, ct);
        var identityIds = memberships.Values.Select(m => m.IdentityId).Distinct().ToList();
        var identities = await db.Identities.AsNoTracking()
            .Where(i => identityIds.Contains(i.Id))
            .ToDictionaryAsync(i => i.Id, ct);

        var enrolled = enrollments.Select(e =>
        {
            memberships.TryGetValue(e.MembershipId, out var membership);
            identities.TryGetValue(membership?.IdentityId ?? Guid.Empty, out var identity);
            return new EnrolledMemberRow(
                MembershipId: e.MembershipId,
                Email:        identity?.Email ?? "(unknown)",
                FullName:     identity?.FullName ?? "(unknown)",
                EnrolledAt:   e.CreatedAt);
        }).ToList();

        var now = DateTime.UtcNow;
        // Only outstanding invitations — Resend/Cancel are legal from Sent or
        // Expired only (§9), same scope as the Pending Invitations tab.
        var invited = await db.Invitations.AsNoTracking()
            .Where(i => i.WorkspaceId == workspace.Id && i.IntendedLearningProductId == productId)
            .OrderByDescending(i => i.IssuedAt)
            .ToListAsync(ct);

        var invitedRows = invited
            .Select(i => new WorkspaceInvitationRow(
                Id:           i.Id,
                Email:        i.Email,
                IntendedRole: i.IntendedRole.ToString(),
                Status:       i.Status == InvitationStatus.Sent && i.ExpiresAt <= now
                                  ? nameof(InvitationStatus.Expired)
                                  : i.Status.ToString(),
                IssuedAt:     i.IssuedAt,
                ExpiresAt:    i.ExpiresAt,
                IsOpen:       i.IsOpen(now),
                BatchId:      i.BatchId,
                IntendedLearningProductId:    i.IntendedLearningProductId,
                IntendedLearningProductTitle: product.Title))
            .Where(r => r.Status is nameof(InvitationStatus.Sent) or nameof(InvitationStatus.Expired))
            .ToList();

        return ProvisioningResult<ProductRosterResponse>.Success(new ProductRosterResponse(
            ProductId:    product.Id,
            ProductTitle: product.Title,
            CanManage:    context.CanManage,
            Enrolled:     enrolled,
            Invited:      invitedRows));
    }

    /// <summary>
    /// Un-enrols a member from one course (§12.3) — removes only the
    /// Enrollment (and any progress recorded against it); the Membership,
    /// and every other course they're enrolled in, are untouched. Reopening
    /// the course later starts a fresh Enrollment from scratch (Enrollment.cs
    /// remarks — this simplified aggregate has no "was previously enrolled"
    /// state to restore).
    /// </summary>
    public async Task<ProvisioningResult<string>> UnenrollMemberAsync(
        string slug, Guid callerIdentityId, Guid productId, Guid membershipId, CancellationToken ct = default)
    {
        var context = await ResolveAsync(slug, callerIdentityId, requireManage: true, ct);
        if (context.Error is not null)
            return ProvisioningResult<string>.Fail(context.Error.Value.Error, context.Error.Value.Message);

        var workspace = context.Workspace!;

        var enrollment = await db.Enrollments.FirstOrDefaultAsync(
            e => e.WorkspaceId == workspace.Id && e.LearningProductId == productId && e.MembershipId == membershipId, ct);
        if (enrollment is null)
            return Fail<string>("This member isn't enrolled in that course.", ProvisioningError.NotFound);

        var progress = await db.LessonProgresses
            .Where(p => p.EnrollmentId == enrollment.Id)
            .ToListAsync(ct);
        db.LessonProgresses.RemoveRange(progress);
        db.Enrollments.Remove(enrollment);

        await db.SaveChangesAsync(ct);
        return ProvisioningResult<string>.Success("Unenrolled");
    }

    private static bool IsUniqueViolation(DbUpdateException ex) =>
        ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation };

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

    private static ProvisioningResult<BulkInvitationIssuedResponse> FailBulk(string message, ProvisioningError error)
        => ProvisioningResult<BulkInvitationIssuedResponse>.Fail(error, message);

    private static ProvisioningResult<T> Fail<T>(string message, ProvisioningError error)
        => ProvisioningResult<T>.Fail(error, message);
}
