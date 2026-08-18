namespace Platform.Domain;

/// <summary>
/// Invitation Aggregate Root.
///
/// A Workspace-owned record authorising one named person, by email, to join
/// that Workspace with an intended role (Invitation Business Analysis §4).
///
/// An Invitation is an *intention* to create a Membership, never the Membership
/// itself (Workspace_Access_Context §4.5). Accepting it starts onboarding;
/// onboarding is what eventually produces a Membership (WA-105).
///
/// Rules enforced here:
///   §9  — the reconciled lifecycle; exactly one of Accepted/Expired/Cancelled
///   §8  — the token is single-use: once Accepted it can never validate again
///   §10 — an expired Invitation cannot be accepted, however valid its token
///
/// Enforced outside this class (it spans rows):
///   §8 "Single Active Invitation" — at most one Created/Sent Invitation per
///      (email, Workspace). Requires querying siblings, so it belongs to the
///      application service that issues invitations.
/// </summary>
public class Invitation
{
    public Guid Id { get; private set; }
    public Guid WorkspaceId { get; private set; }

    /// <summary>The invitee, by email. There may be no Identity behind it yet.</summary>
    public string Email { get; private set; } = string.Empty;

    public WorkspaceRoleName IntendedRole { get; private set; }

    /// <summary>Hash of the token. The raw value is never persisted (§8).</summary>
    public string TokenHash { get; private set; } = string.Empty;

    public InvitationStatus Status { get; private set; }
    public DateTime IssuedAt { get; private set; }
    public DateTime ExpiresAt { get; private set; }

    /// <summary>IdentityId of the sender — the Platform Administrator in Version 1 (BA-007).</summary>
    public Guid IssuedBy { get; private set; }

    public DateTime? SentAt { get; private set; }
    public DateTime? AcceptedAt { get; private set; }
    public DateTime? ClosedAt { get; private set; }

    /// <summary>
    /// The Invitation Batch this was issued as part of, if any (§4.3).
    /// Reference by identifier only — an Invitation Batch never owns or
    /// gates this Invitation's own lifecycle.
    /// </summary>
    public Guid? BatchId { get; private set; }

    /// <summary>
    /// The Learning Product to enrol the invitee into once they accept, if
    /// this Invitation was issued via "Invite + Enroll" (Student Workspace
    /// Access &amp; Admission Architecture §12.3). Reference by identifier
    /// only — set at issue time, acted on only once the resulting Membership
    /// is Active (Enrollment_Aggregate_Design INV-002).
    /// </summary>
    public Guid? IntendedLearningProductId { get; private set; }

    // Required by EF Core — not for application use
    private Invitation() { }

    /// <summary>
    /// Issues a new Invitation in Created state. Returns the raw token
    /// alongside it — the only moment it exists in readable form.
    /// </summary>
    public static (Invitation Invitation, string RawToken) Issue(
        Guid workspaceId,
        string email,
        WorkspaceRoleName intendedRole,
        Guid issuedBy,
        TimeSpan validFor,
        Guid? batchId = null,
        Guid? intendedLearningProductId = null)
    {
        if (workspaceId == Guid.Empty)
            throw new ArgumentException("An Invitation must name exactly one Workspace.", nameof(workspaceId));
        ArgumentException.ThrowIfNullOrWhiteSpace(email);
        if (issuedBy == Guid.Empty)
            throw new ArgumentException("An Invitation must record who issued it.", nameof(issuedBy));
        if (validFor <= TimeSpan.Zero)
            throw new ArgumentException("An Invitation must expire in the future.", nameof(validFor));

        var (raw, hash) = SecureToken.Generate();
        var now = DateTime.UtcNow;

        var invitation = new Invitation
        {
            Id = Guid.NewGuid(),
            WorkspaceId = workspaceId,
            Email = email.ToLowerInvariant().Trim(),
            IntendedRole = intendedRole,
            TokenHash = hash,
            Status = InvitationStatus.Created,
            IssuedAt = now,
            ExpiresAt = now.Add(validFor),
            IssuedBy = issuedBy,
            BatchId = batchId,
            IntendedLearningProductId = intendedLearningProductId
        };

        return (invitation, raw);
    }

    /// <summary>Created → Sent, once the invitation link has been handed off for delivery.</summary>
    public void MarkSent()
    {
        Require(InvitationStatus.Created);
        Status = InvitationStatus.Sent;
        SentAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Whether this Invitation can still be accepted right now. Expiry is a
    /// function of the clock, so a Sent Invitation past its date is already
    /// unusable even before anything has written Expired to it.
    /// </summary>
    public bool IsOpen(DateTime? asOf = null) =>
        Status == InvitationStatus.Sent && ExpiresAt > (asOf ?? DateTime.UtcNow);

    /// <summary>
    /// Sent → Accepted. Single-use: the token can never validate again (§8).
    /// Rejects an expired Invitation regardless of token validity (§10).
    /// </summary>
    public void Accept()
    {
        Require(InvitationStatus.Sent);

        if (ExpiresAt <= DateTime.UtcNow)
            throw new InvalidOperationException("This invitation has expired.");

        Status = InvitationStatus.Accepted;
        AcceptedAt = DateTime.UtcNow;
        ClosedAt = AcceptedAt;
    }

    /// <summary>
    /// Resends: a fresh token and a reset expiry on the SAME Invitation, never a
    /// second parallel one (§10, "Resend Rules"). The previous token stops
    /// working immediately. Legal from Sent or Expired only — a Cancelled
    /// invitation needs a brand-new one, and an Accepted one is finished.
    ///
    /// Returns the new raw token.
    /// </summary>
    public string Resend(TimeSpan validFor)
    {
        Require(InvitationStatus.Sent, InvitationStatus.Expired);

        if (validFor <= TimeSpan.Zero)
            throw new ArgumentException("An Invitation must expire in the future.", nameof(validFor));

        var (raw, hash) = SecureToken.Generate();

        TokenHash = hash;
        Status = InvitationStatus.Sent;
        IssuedAt = DateTime.UtcNow;
        ExpiresAt = IssuedAt.Add(validFor);
        SentAt = IssuedAt;
        ClosedAt = null;

        return raw;
    }

    /// <summary>Sent → Expired. Recording what the clock already made true.</summary>
    public void Expire()
    {
        Require(InvitationStatus.Sent);
        Status = InvitationStatus.Expired;
        ClosedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Cancelled by the sender. Legal from Created or Sent (§9) — cancelling
    /// before ever sending is a real case.
    /// </summary>
    public void Cancel()
    {
        Require(InvitationStatus.Created, InvitationStatus.Sent);
        Status = InvitationStatus.Cancelled;
        ClosedAt = DateTime.UtcNow;
    }

    private void Require(params InvitationStatus[] permitted)
    {
        if (!permitted.Contains(Status))
            throw new InvalidOperationException(
                $"An Invitation in {Status} cannot make this transition. Permitted from: {string.Join(", ", permitted)} (Invitation Business Analysis, Section 9).");
    }
}
