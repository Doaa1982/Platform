using Microsoft.EntityFrameworkCore;
using Platform.Api.Models;
using Platform.Domain;
using Platform.Infrastructure;

namespace Platform.Api.Services;

/// <summary>
/// Tutor Signup Requests — Platform Administrator Business Analysis §7.1.
///
/// The platform's front door for someone with no relationship to it at all: no
/// account, no workspace, no payment (2026-08-24 correction — see
/// <see cref="SignupRequestStatus"/>). It is the stage that used to be an
/// unexplained "external signal" before v1.2 replaced it with a real process
/// (BA-006).
/// </summary>
public class SignupRequestService(
    PlatformDbContext db,
    IConfiguration config,
    IInvitationDelivery delivery,
    EmailOptions email)
{
    /// <summary>
    /// How long the Signup Status Link stays live. Generous — an application
    /// can legitimately sit unreviewed for a while — because this is a backstop
    /// against an abandoned link living forever, not a deadline for the
    /// applicant.
    /// </summary>
    private TimeSpan StatusLinkLifetime =>
        TimeSpan.FromDays(config.GetValue("Signup:StatusLinkDays", 90));

    private static string LinkFor(string rawToken) => $"/apply/status/{rawToken}";
    private string AbsoluteLinkFor(string rawToken) =>
        $"{email.PublicBaseUrl.TrimEnd('/')}{LinkFor(rawToken)}";

    // ── Applying ─────────────────────────────────────────────────────────────

    public async Task<ProvisioningResult<SignupSubmittedResponse>> SubmitAsync(
        SubmitSignupRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.FullName) || string.IsNullOrWhiteSpace(request.Email))
            return Fail<SignupSubmittedResponse>("A name and email address are required.", ProvisioningError.Invalid);

        var applicantEmail = request.Email.ToLowerInvariant().Trim();

        // One live application per person. A second while one is open would give
        // the reviewer two of the same thing to decide.
        var live = await db.SignupRequests.FirstOrDefaultAsync(r =>
            r.Email == applicantEmail &&
            (r.Status == SignupRequestStatus.Submitted
                || r.Status == SignupRequestStatus.UnderReview
                || r.Status == SignupRequestStatus.Approved), ct);

        if (live is not null)
        {
            return Fail<SignupSubmittedResponse>(
                "There's already an application in progress for this email. Check the link we sent you.",
                ProvisioningError.Conflict);
        }

        var (signup, rawToken) = SignupRequest.Submit(
            request.FullName, applicantEmail, request.About, StatusLinkLifetime);
        signup.MarkUnderReview();
        db.SignupRequests.Add(signup);
        await db.SaveChangesAsync(ct);

        // Reuses the invitation delivery channel — this is a platform-level
        // notification for the same reason an invitation is (BA-005): no
        // Workspace, and therefore no Workspace community, exists yet.
        var outcome = await delivery.SendInvitationAsync(
            signup.Email, "your Platform application", "Tutor",
            AbsoluteLinkFor(rawToken), signup.SubmittedAt.AddDays(365), ct);

        return ProvisioningResult<SignupSubmittedResponse>.Success(
            new SignupSubmittedResponse(signup.Id, LinkFor(rawToken), outcome.Delivered));
    }

    // ── Checking back ────────────────────────────────────────────────────────

    public async Task<ProvisioningResult<SignupStatusResponse>> GetStatusAsync(
        string rawToken, CancellationToken ct = default)
    {
        var signup = await FindByTokenAsync(rawToken, ct);
        if (signup is null)
            return Fail<SignupStatusResponse>("This link isn't valid.", ProvisioningError.NotFound);

        var (headline, detail) = Message(signup);

        return ProvisioningResult<SignupStatusResponse>.Success(new SignupStatusResponse(
            FullName:    signup.FullName,
            Email:       signup.Email,
            Status:      signup.Status.ToString(),
            Headline:    headline,
            Detail:      detail,
            SubmittedAt: signup.SubmittedAt));
    }

    /// <summary>The applicant-facing wording from §7.1, "What the Prospective Tutor Sees".</summary>
    private static (string Headline, string Detail) Message(SignupRequest r) => r.Status switch
    {
        SignupRequestStatus.Submitted or SignupRequestStatus.UnderReview =>
            ("Your application is under review",
             "We'll email you once a decision has been made."),

        // Approved covers two genuinely different situations for the applicant,
        // and telling them "we're setting up your workspace" after it already
        // exists is simply untrue. ProvisionedWorkspaceId distinguishes them.
        SignupRequestStatus.Approved when r.ProvisionedWorkspaceId is not null =>
            ("Your workspace is ready",
             "Check your email for an invitation to it. Opening that invitation creates your account and hands the workspace to you."),

        SignupRequestStatus.Approved =>
            ("Your application has been approved",
             "We're setting up your workspace and will email you the moment it's ready."),

        SignupRequestStatus.Rejected =>
            ("Thank you for applying",
             r.RejectionReasonVisible && r.RejectionReason is not null
                 ? r.RejectionReason
                 : "After review, we're not able to approve your application at this time."),

        _ => ("Application", string.Empty),
    };

    // ── Reviewing ────────────────────────────────────────────────────────────

    public async Task<IReadOnlyList<SignupRequestRow>> ListAsync(CancellationToken ct = default)
    {
        var all = await db.SignupRequests.ToListAsync(ct);

        return all
            // Waiting-on-me first, then approved-and-not-yet-provisioned, then the rest
            .OrderBy(r => r.AwaitsDecision ? 0
                        : r.Status == SignupRequestStatus.Approved && r.ProvisionedWorkspaceId is null ? 1 : 2)
            .ThenByDescending(r => r.SubmittedAt)
            .Select(r => new SignupRequestRow(
                r.Id, r.FullName, r.Email, r.About,
                r.Status.ToString(), r.SubmittedAt, r.ReviewedAt, r.ProvisionedWorkspaceId))
            .ToList();
    }

    public async Task<ProvisioningResult<string>> ApproveAsync(
        Guid id, Guid reviewerIdentityId, CancellationToken ct = default)
        => await DecideAsync(id, r => r.Approve(reviewerIdentityId), ct);

    public async Task<ProvisioningResult<string>> RejectAsync(
        Guid id, Guid reviewerIdentityId, RejectSignupRequest request, CancellationToken ct = default)
        => await DecideAsync(id, r => r.Reject(reviewerIdentityId, request.Reason, request.ReasonVisible), ct);

    private async Task<ProvisioningResult<string>> DecideAsync(
        Guid id, Action<SignupRequest> decide, CancellationToken ct)
    {
        var signup = await db.SignupRequests.FirstOrDefaultAsync(r => r.Id == id, ct);
        if (signup is null) return Fail<string>("No such application.", ProvisioningError.NotFound);

        try { decide(signup); }
        catch (InvalidOperationException ex) { return Fail<string>(ex.Message, ProvisioningError.Conflict); }
        catch (ArgumentException ex) { return Fail<string>(ex.Message, ProvisioningError.Invalid); }

        await db.SaveChangesAsync(ct);
        return ProvisioningResult<string>.Success(signup.Status.ToString());
    }

    /// <summary>
    /// Links an approved application to the Workspace provisioned for it, so
    /// §7.2 runs once per applicant rather than once per admin click.
    /// </summary>
    public async Task<ProvisioningResult<string>> MarkProvisionedAsync(
        Guid id, Guid workspaceId, CancellationToken ct = default)
    {
        var signup = await db.SignupRequests.FirstOrDefaultAsync(r => r.Id == id, ct);
        if (signup is null) return Fail<string>("No such application.", ProvisioningError.NotFound);

        try { signup.MarkProvisioned(workspaceId); }
        catch (InvalidOperationException ex) { return Fail<string>(ex.Message, ProvisioningError.Conflict); }

        await db.SaveChangesAsync(ct);
        return ProvisioningResult<string>.Success(signup.Status.ToString());
    }

    // ── Shared ───────────────────────────────────────────────────────────────

    /// <summary>
    /// Resolves a status link, treating an expired or revoked one as no match
    /// at all. A refusal that still confirmed the application existed would
    /// leak the very thing the expiry is there to stop leaking.
    /// </summary>
    private async Task<SignupRequest?> FindByTokenAsync(string rawToken, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(rawToken)) return null;

        var hash = SecureToken.Hash(rawToken);
        var found = await db.SignupRequests.FirstOrDefaultAsync(r => r.TokenHash == hash, ct);

        return found is not null && found.StatusLinkIsValid() ? found : null;
    }

    /// <summary>
    /// Retires the status link for whichever application produced this
    /// Workspace. Called when the applicant accepts their invitation: they now
    /// hold a real Identity, so the token that stood in for one has no further
    /// purpose (BA-008).
    ///
    /// Matched on ProvisionedWorkspaceId rather than email — an exact link
    /// recorded at provisioning, not a guess.
    /// </summary>
    public async Task RevokeStatusLinkForWorkspaceAsync(Guid workspaceId, CancellationToken ct = default)
    {
        var signup = await db.SignupRequests
            .FirstOrDefaultAsync(r => r.ProvisionedWorkspaceId == workspaceId && r.TokenHash != null, ct);

        if (signup is null) return;

        signup.RevokeStatusLink();
        await db.SaveChangesAsync(ct);
    }

    private static ProvisioningResult<T> Fail<T>(string message, ProvisioningError error)
        => ProvisioningResult<T>.Fail(error, message);
}
