namespace Platform.Domain;

/// <summary>
/// Tutor Signup Request Aggregate Root.
///
/// A prospective tutor's application to join the platform, submitted before any
/// Workspace, Invitation or payment exists (Platform Administrator Business
/// Analysis §4, §7.1).
///
/// It answers "should this person be allowed to become a Workspace Owner at
/// all?", which is a different question from "has this approved person paid?" —
/// hence a separate <see cref="PaymentStatus"/> alongside the lifecycle.
///
/// Deliberately NOT merged with JoinRequest, which is the same business pattern
/// one scope down (Technical Debt Backlog TD-011). They share the token-link
/// mechanism via <see cref="SecureToken"/> and nothing else: the reviewing
/// authority, what approval produces, and the presence of a payment stage all
/// differ, and a shared discriminator would make nearly every rule conditional.
///
/// Rules enforced here:
///   §7.1  — the lifecycle, including the payment branch
///   BA-007 — Rejected and Expired are distinct outcomes, never conflated
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
    /// </summary>
    public string TokenHash { get; private set; } = string.Empty;

    public SignupRequestStatus Status { get; private set; }
    public PaymentStatus Payment { get; private set; }

    public DateTime SubmittedAt { get; private set; }

    /// <summary>The deciding Platform Administrator's IdentityId — they hold no Membership (BA-001).</summary>
    public Guid? ReviewedBy { get; private set; }
    public DateTime? ReviewedAt { get; private set; }

    /// <summary>Admin-authored. Shown to the applicant only if <see cref="RejectionReasonVisible"/>.</summary>
    public string? RejectionReason { get; private set; }
    public bool RejectionReasonVisible { get; private set; }

    /// <summary>When the payment window closes. Set on approval.</summary>
    public DateTime? PaymentWindowEndsAt { get; private set; }
    public DateTime? PaidAt { get; private set; }

    /// <summary>Set once §7.2 provisioning has been run for this applicant, so it happens once.</summary>
    public Guid? ProvisionedWorkspaceId { get; private set; }

    // Required by EF Core — not for application use
    private SignupRequest() { }

    /// <summary>
    /// Submits an application. Returns the raw status-link token — the only
    /// moment it exists in readable form.
    /// </summary>
    public static (SignupRequest Request, string RawToken) Submit(string fullName, string email, string? about)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(fullName);
        ArgumentException.ThrowIfNullOrWhiteSpace(email);

        var (raw, hash) = SecureToken.Generate();

        return (new SignupRequest
        {
            Id = Guid.NewGuid(),
            FullName = fullName.Trim(),
            Email = email.ToLowerInvariant().Trim(),
            About = string.IsNullOrWhiteSpace(about) ? null : about.Trim(),
            TokenHash = hash,
            Status = SignupRequestStatus.Submitted,
            Payment = PaymentStatus.NotStarted,
            SubmittedAt = DateTime.UtcNow
        }, raw);
    }

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
    /// Approved — but not yet a tutor. Payment comes next, inside this flow
    /// rather than as an assumed external event (BA-006).
    /// </summary>
    public void Approve(Guid reviewerIdentityId, TimeSpan paymentWindow)
    {
        Require(SignupRequestStatus.Submitted, SignupRequestStatus.UnderReview);

        if (paymentWindow <= TimeSpan.Zero)
            throw new ArgumentException("The payment window must be in the future.", nameof(paymentWindow));

        ReviewedBy = reviewerIdentityId;
        ReviewedAt = DateTime.UtcNow;
        PaymentWindowEndsAt = ReviewedAt.Value.Add(paymentWindow);
        Status = SignupRequestStatus.ApprovedAwaitingPayment;
    }

    /// <summary>
    /// Rejected by a reviewer. Terminal, and distinct from Expired (BA-007).
    /// The reason is optional and shown to the applicant only when the reviewer
    /// marks it visible (§8).
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

    /// <summary>Whether payment can still be attempted right now.</summary>
    public bool CanPay(DateTime? asOf = null) =>
        Status is SignupRequestStatus.ApprovedAwaitingPayment or SignupRequestStatus.PaymentFailed
        && PaymentWindowEndsAt > (asOf ?? DateTime.UtcNow);

    /// <summary>Records that a payment attempt is in flight.</summary>
    public void BeginPayment()
    {
        if (!CanPay())
            throw new InvalidOperationException("This application is not awaiting payment.");

        Payment = PaymentStatus.Pending;
    }

    /// <summary>
    /// Payment succeeded. This is the trigger for §7.2 provisioning — and is
    /// what BA-006 replaced the old unexplained "external signal" with.
    /// </summary>
    public void PaymentSucceeded()
    {
        Require(SignupRequestStatus.ApprovedAwaitingPayment, SignupRequestStatus.PaymentFailed);

        if (PaymentWindowEndsAt <= DateTime.UtcNow)
            throw new InvalidOperationException("The payment window for this application has closed.");

        Payment = PaymentStatus.Succeeded;
        PaidAt = DateTime.UtcNow;
        Status = SignupRequestStatus.Paid;
    }

    /// <summary>
    /// Payment failed. NOT terminal and NOT a rejection: the applicant may
    /// retry while the window is open, and is told so rather than being told
    /// they were declined (§7.1, "What the Prospective Tutor Sees").
    /// </summary>
    public void PaymentFailed()
    {
        Require(SignupRequestStatus.ApprovedAwaitingPayment, SignupRequestStatus.PaymentFailed);
        Payment = PaymentStatus.Failed;
        Status = SignupRequestStatus.PaymentFailed;
    }

    /// <summary>
    /// The payment window lapsed. Terminal, and deliberately not Rejected: the
    /// application was never declined, only unpaid (BA-007). The applicant is
    /// invited to apply again.
    /// </summary>
    public void Expire()
    {
        Require(SignupRequestStatus.ApprovedAwaitingPayment, SignupRequestStatus.PaymentFailed);
        Status = SignupRequestStatus.Expired;
    }

    /// <summary>
    /// Records the Workspace provisioned for this applicant, so §7.2 runs once
    /// per paid application rather than once per admin click.
    /// </summary>
    public void MarkProvisioned(Guid workspaceId)
    {
        Require(SignupRequestStatus.Paid);

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
