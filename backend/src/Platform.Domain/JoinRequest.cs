namespace Platform.Domain;

/// <summary>
/// Join Request Aggregate Root.
///
/// A person asking to be let into one Workspace, awaiting that Workspace's
/// decision (Join Request Business Analysis §4).
///
/// The mirror image of Invitation. An Invitation runs outward — somebody inside
/// decides they want you. A Join Request runs inward — you decide first, and
/// they answer. Both end at an Active Membership; everything between differs,
/// which is why they are separate aggregates and not one concept with a
/// direction flag (BA-001).
///
/// A Join Request confers nothing. It is a request for a Membership, never a
/// Membership itself.
///
/// Carries no Identity. Account creation is deliberately deferred past
/// approval: a request is just a name, an email and a message until a
/// reviewer decides it is worth an Invitation (§11) — the same Invitation
/// anyone invited outright receives, which is where a real account first
/// gets made, on acceptance.
///
/// Rules enforced here:
///   §9  — Submitted → { Approved | Declined | Cancelled }, exactly one
///   §10 — approval grants precisely the role recorded on the request
///
/// Enforced outside this class (they span rows):
///   §10 — the Workspace must be discoverable and accepting requests
///   §10 — at most one Submitted request per (email, Workspace)
///   §10 — an email already holding an Active Membership cannot request
///   §10 — an email already holding an open Invitation cannot request (TD-016)
/// </summary>
public class JoinRequest
{
    public Guid Id { get; private set; }
    public Guid WorkspaceId { get; private set; }

    public string Email { get; private set; } = string.Empty;
    public string FullName { get; private set; } = string.Empty;

    /// <summary>Learner only in Version 1 (BA-002). Enforced by the caller.</summary>
    public WorkspaceRoleName RequestedRole { get; private set; }

    /// <summary>Optional note from the requester, so a reviewer has something to decide on.</summary>
    public string? Message { get; private set; }

    public JoinRequestStatus Status { get; private set; }
    public DateTime SubmittedAt { get; private set; }

    /// <summary>IdentityId of the reviewer who decided. Null while Submitted or Cancelled.</summary>
    public Guid? DecidedBy { get; private set; }
    public DateTime? DecidedAt { get; private set; }

    /// <summary>
    /// Hash of the Join Request Status Link token (Join Request Business
    /// Analysis §16, "Checking back without an Identity" — TD-018). The
    /// requester has no Identity at submission, necessarily, since one is
    /// never created here — so this link is the only way they can check back,
    /// the same shape as SignupRequest's own TokenHash (Technical Debt Backlog
    /// TD-011: the two share the SecureToken mechanism, not the aggregate).
    /// Raw value is never persisted. Null on rows written before this existed.
    /// </summary>
    public string? TokenHash { get; private set; }

    /// <summary>
    /// When the status link stops working, regardless of anything else. A
    /// backstop against an abandoned link living forever, not a deadline for
    /// the requester — separate from §10's "Join Requests do not expire,"
    /// which is about the request itself staying in the reviewer's queue
    /// indefinitely, not about how long this bearer link keeps resolving to it.
    /// </summary>
    public DateTime? TokenExpiresAt { get; private set; }

    // Required by EF Core — not for application use
    private JoinRequest() { }

    /// <summary>Submits a request. Returns the raw status-link token — the only moment it exists in readable form.</summary>
    public static (JoinRequest Request, string RawToken) Submit(
        Guid workspaceId,
        string email,
        string fullName,
        WorkspaceRoleName requestedRole,
        TimeSpan linkValidFor,
        string? message = null)
    {
        if (workspaceId == Guid.Empty)
            throw new ArgumentException("A join request must name one Workspace.", nameof(workspaceId));
        ArgumentException.ThrowIfNullOrWhiteSpace(email);
        ArgumentException.ThrowIfNullOrWhiteSpace(fullName);
        if (linkValidFor <= TimeSpan.Zero)
            throw new ArgumentException("The status link must expire in the future.", nameof(linkValidFor));

        var (raw, hash) = SecureToken.Generate();
        var now = DateTime.UtcNow;

        return (new JoinRequest
        {
            Id = Guid.NewGuid(),
            WorkspaceId = workspaceId,
            Email = email.ToLowerInvariant().Trim(),
            FullName = fullName.Trim(),
            RequestedRole = requestedRole,
            Message = string.IsNullOrWhiteSpace(message) ? null : message.Trim(),
            TokenHash = hash,
            TokenExpiresAt = now.Add(linkValidFor),
            Status = JoinRequestStatus.Submitted,
            SubmittedAt = now
        }, raw);
    }

    /// <summary>Whether the status link still resolves.</summary>
    public bool StatusLinkIsValid(DateTime? asOf = null) =>
        TokenHash is not null && TokenExpiresAt > (asOf ?? DateTime.UtcNow);

    /// <summary>Whether this request is still awaiting a decision.</summary>
    public bool IsOpen => Status == JoinRequestStatus.Submitted;

    /// <summary>
    /// Approved by a reviewer. The caller then issues an Invitation to the
    /// recorded email — this aggregate never touches Invitation or Membership
    /// itself (§5); a Membership exists only once that Invitation is accepted.
    /// </summary>
    public void Approve(Guid reviewerIdentityId)
    {
        Require(JoinRequestStatus.Approved);
        DecidedBy = reviewerIdentityId;
        DecidedAt = DateTime.UtcNow;
        Status = JoinRequestStatus.Approved;
    }

    /// <summary>
    /// Declined. Terminal, and deliberately carries no reason (BA-006): a
    /// reason is either boilerplate, which is worse than nothing, or specific,
    /// which exposes internal judgement to someone outside the Workspace.
    /// </summary>
    public void Decline(Guid reviewerIdentityId)
    {
        Require(JoinRequestStatus.Declined);
        DecidedBy = reviewerIdentityId;
        DecidedAt = DateTime.UtcNow;
        Status = JoinRequestStatus.Declined;
    }

    /// <summary>Cancelled by the requester before any decision was made.</summary>
    public void Cancel()
    {
        Require(JoinRequestStatus.Cancelled);
        DecidedAt = DateTime.UtcNow;   // when it left the queue; no reviewer decided
        Status = JoinRequestStatus.Cancelled;
    }

    /// <summary>
    /// Every transition is legal only from Submitted — the three outcomes are
    /// alternatives, never a sequence (§9).
    /// </summary>
    private void Require(JoinRequestStatus target)
    {
        if (Status != JoinRequestStatus.Submitted)
            throw new InvalidOperationException(
                $"A join request that is already {Status} cannot become {target}. Only a Submitted request can be decided (Join Request Business Analysis, Section 9).");
    }
}
