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
/// Rules enforced here:
///   §9  — Submitted → { Approved | Declined | Withdrawn }, exactly one
///   §10 — approval grants precisely the role recorded on the request
///
/// Enforced outside this class (they span rows):
///   §10 — the Workspace must be discoverable and accepting requests
///   §10 — at most one Submitted request per (person, Workspace)
///   §10 — a person already holding an Active Membership cannot request
/// </summary>
public class JoinRequest
{
    public Guid Id { get; private set; }
    public Guid WorkspaceId { get; private set; }

    /// <summary>
    /// The requester's Identity. Resolved or created at submission, never at
    /// approval (BA-003) — so the requester can sign in and watch their own
    /// request rather than waiting blind.
    /// </summary>
    public Guid IdentityId { get; private set; }

    public string Email { get; private set; } = string.Empty;
    public string FullName { get; private set; } = string.Empty;

    /// <summary>Learner only in Version 1 (BA-002). Enforced by the caller.</summary>
    public WorkspaceRoleName RequestedRole { get; private set; }

    /// <summary>Optional note from the requester, so a reviewer has something to decide on.</summary>
    public string? Message { get; private set; }

    public JoinRequestStatus Status { get; private set; }
    public DateTime SubmittedAt { get; private set; }

    /// <summary>IdentityId of the reviewer who decided. Null while Submitted or Withdrawn.</summary>
    public Guid? DecidedBy { get; private set; }
    public DateTime? DecidedAt { get; private set; }

    // Required by EF Core — not for application use
    private JoinRequest() { }

    public static JoinRequest Submit(
        Guid workspaceId,
        Guid identityId,
        string email,
        string fullName,
        WorkspaceRoleName requestedRole,
        string? message = null)
    {
        if (workspaceId == Guid.Empty)
            throw new ArgumentException("A join request must name one Workspace.", nameof(workspaceId));
        if (identityId == Guid.Empty)
            throw new ArgumentException("A join request requires a resolved Identity (BA-003).", nameof(identityId));
        ArgumentException.ThrowIfNullOrWhiteSpace(email);
        ArgumentException.ThrowIfNullOrWhiteSpace(fullName);

        return new JoinRequest
        {
            Id = Guid.NewGuid(),
            WorkspaceId = workspaceId,
            IdentityId = identityId,
            Email = email.ToLowerInvariant().Trim(),
            FullName = fullName.Trim(),
            RequestedRole = requestedRole,
            Message = string.IsNullOrWhiteSpace(message) ? null : message.Trim(),
            Status = JoinRequestStatus.Submitted,
            SubmittedAt = DateTime.UtcNow
        };
    }

    /// <summary>Whether this request is still awaiting a decision.</summary>
    public bool IsOpen => Status == JoinRequestStatus.Submitted;

    /// <summary>
    /// Approved by a reviewer. The caller then creates and activates the
    /// Membership — this aggregate never touches Membership itself (§5).
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

    /// <summary>Withdrawn by the requester before any decision was made.</summary>
    public void Withdraw()
    {
        Require(JoinRequestStatus.Withdrawn);
        DecidedAt = DateTime.UtcNow;   // when it left the queue; no reviewer decided
        Status = JoinRequestStatus.Withdrawn;
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
