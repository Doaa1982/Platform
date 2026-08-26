namespace Platform.Domain;

/// <summary>
/// Tutor Signup Request Aggregate Root.
///
/// A prospective tutor's application to join the platform, submitted before any
/// Workspace or Invitation exists (Platform Administrator Business Analysis §4,
/// §7.1). It answers exactly one question — "should this person be allowed to
/// become a Workspace Owner at all?" — decided by a reviewer, never by payment
/// (2026-08-24 correction: see <see cref="SignupRequestStatus"/>).
///
/// Deliberately NOT merged with JoinRequest, which is the same business pattern
/// one scope down (Technical Debt Backlog TD-011). They share the token-link
/// mechanism via <see cref="SecureToken"/> and nothing else: the reviewing
/// authority and what approval produces still differ enough to make a shared
/// discriminator nearly every rule conditional.
///
/// Rules enforced here:
///   §7.1  — the lifecycle
///   BA-007 — Rejected is a deliberate decision, never conflated with anything else
///   BA-008 — the applicant has no Identity, so status is reached by token
/// </summary>
public class SignupRequest
{
    public Guid Id { get; private set; }
    public string FullName { get; private set; } = string.Empty;
    public string Email { get; private set; } = string.Empty;

    /// <summary>What they teach, in their own words. Gives a reviewer something to decide on.</summary>
    public string? About { get; private set; }

    /// <summary>
    /// Hash of the Signup Status Link token (BA-008). The applicant has no
    /// Identity — necessarily, at this stage — so this link is the only way
    /// they can check back. Raw value is never persisted.
    ///
    /// Cleared when the link is revoked, so a spent token cannot resolve at all
    /// rather than merely being refused.
    /// </summary>
    public string? TokenHash { get; private set; }

    /// <summary>
    /// When the status link stops working regardless of anything else.
    ///
    /// The link is a bearer credential: whoever holds the URL sees the
    /// applicant's name, email and progress. An Invitation limits that exposure
    /// with an expiry and single use; this had neither, so a forwarded email or
    /// a browser history entry stayed live indefinitely. The window is generous
    /// because a real application can sit unreviewed for a while — it is a
    /// backstop, not a deadline.
    /// </summary>
    public DateTime TokenExpiresAt { get; private set; }

    public SignupRequestStatus Status { get; private set; }

    public DateTime SubmittedAt { get; private set; }

    /// <summary>The deciding Platform Administrator's IdentityId — they hold no Membership (BA-001).</summary>
    public Guid? ReviewedBy { get; private set; }
    public DateTime? ReviewedAt { get; private set; }

    /// <summary>Admin-authored. Shown to the applicant only if <see cref="RejectionReasonVisible"/>.</summary>
    public string? RejectionReason { get; private set; }
    public bool RejectionReasonVisible { get; private set; }

    /// <summary>Set once §7.2 provisioning has been run for this applicant, so it happens once.</summary>
    public Guid? ProvisionedWorkspaceId { get; private set; }

    // Required by EF Core — not for application use
    private SignupRequest() { }

    /// <summary>
    /// Submits an application. Returns the raw status-link token — the only
    /// moment it exists in readable form.
    /// </summary>
    public static (SignupRequest Request, string RawToken) Submit(
        string fullName, string email, string? about, TimeSpan linkValidFor)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(fullName);
        ArgumentException.ThrowIfNullOrWhiteSpace(email);

        if (linkValidFor <= TimeSpan.Zero)
            throw new ArgumentException("The status link must expire in the future.", nameof(linkValidFor));

        var (raw, hash) = SecureToken.Generate();
        var now = DateTime.UtcNow;

        return (new SignupRequest
        {
            Id = Guid.NewGuid(),
            FullName = fullName.Trim(),
            Email = email.ToLowerInvariant().Trim(),
            About = string.IsNullOrWhiteSpace(about) ? null : about.Trim(),
            TokenHash = hash,
            TokenExpiresAt = now.Add(linkValidFor),
            Status = SignupRequestStatus.Submitted,
            SubmittedAt = now
        }, raw);
    }

    /// <summary>Whether the status link still resolves.</summary>
    public bool StatusLinkIsValid(DateTime? asOf = null) =>
        TokenHash is not null && TokenExpiresAt > (asOf ?? DateTime.UtcNow);

    /// <summary>
    /// Retires the status link permanently.
    ///
    /// Called once the applicant has a real Identity — at which point the whole
    /// reason this token exists has gone (BA-008: "they have no Identity yet,
    /// necessarily"). Clearing the hash rather than flagging it means a spent
    /// token stops resolving entirely, instead of resolving to a refusal that
    /// still confirms the application exists.
    /// </summary>
    public void RevokeStatusLink() => TokenHash = null;

    /// <summary>
    /// Submitted → UnderReview, once the Signup Status Link has been handed off
    /// for delivery. Mirrors Invitation's Created → Sent.
    /// </summary>
    public void MarkUnderReview()
    {
        Require(SignupRequestStatus.Submitted);
        Status = SignupRequestStatus.UnderReview;
    }

    /// <summary>Whether a reviewer still has to decide this one.</summary>
    public bool AwaitsDecision =>
        Status is SignupRequestStatus.Submitted or SignupRequestStatus.UnderReview;

    /// <summary>
    /// Approved and immediately ready for a Platform Operator to provision a
    /// Workspace for (§7.2) — there is nothing else to wait on. Before the
    /// 2026-08-24 correction this used to move to an intermediate
    /// "awaiting payment" state instead; that no longer exists (see
    /// <see cref="SignupRequestStatus"/>).
    /// </summary>
    public void Approve(Guid reviewerIdentityId)
    {
        Require(SignupRequestStatus.Submitted, SignupRequestStatus.UnderReview);

        ReviewedBy = reviewerIdentityId;
        ReviewedAt = DateTime.UtcNow;
        Status = SignupRequestStatus.Approved;
    }

    /// <summary>
    /// Rejected by a reviewer. Terminal (BA-007). The reason is optional and
    /// shown to the applicant only when the reviewer marks it visible (§8).
    /// </summary>
    public void Reject(Guid reviewerIdentityId, string? reason, bool reasonVisible)
    {
        Require(SignupRequestStatus.Submitted, SignupRequestStatus.UnderReview);

        ReviewedBy = reviewerIdentityId;
        ReviewedAt = DateTime.UtcNow;
        RejectionReason = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim();
        RejectionReasonVisible = reasonVisible && RejectionReason is not null;
        Status = SignupRequestStatus.Rejected;
    }

    /// <summary>
    /// Records the Workspace provisioned for this applicant, so §7.2 runs once
    /// per approved application rather than once per admin click.
    /// </summary>
    public void MarkProvisioned(Guid workspaceId)
    {
        Require(SignupRequestStatus.Approved);

        if (ProvisionedWorkspaceId is not null)
            throw new InvalidOperationException("A workspace has already been provisioned for this application.");

        ProvisionedWorkspaceId = workspaceId;
    }

    private void Require(params SignupRequestStatus[] permitted)
    {
        if (!permitted.Contains(Status))
            throw new InvalidOperationException(
                $"An application that is {Status} cannot make this transition. Permitted from: {string.Join(", ", permitted)} (Platform Administrator Business Analysis, Section 7.1).");
    }
}
