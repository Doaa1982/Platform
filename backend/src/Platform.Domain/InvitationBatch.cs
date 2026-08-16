namespace Platform.Domain;

/// <summary>
/// Invitation Batch — operational grouping for a bulk invitation operation
/// (Student Workspace Access &amp; Admission Architecture §4.3).
///
/// This is metadata only: it records that N invitations were requested
/// together, by whom, and how. It does not own the Invitations it groups —
/// each Invitation is its own aggregate root with its own lifecycle (§9),
/// referenced back to this batch by <see cref="Invitation.BatchId"/> alone
/// (reference-by-identifier, no FK, matching this codebase's cross-aggregate
/// convention). A batch never gates or mutates a member Invitation's status.
///
/// Sent/Accepted/Failed counts (§4.3) are deliberately NOT stored here: the
/// whole bulk request is resolved synchronously within one call, so there is
/// never an "in progress" state for a persisted rollup to observe, and
/// storing one would require every Invitation lifecycle transition elsewhere
/// (Accept/Expire/Cancel/Resend) to remember to keep it in sync. Callers
/// compute the rollup by grouping Invitations on BatchId at read time.
/// </summary>
public class InvitationBatch
{
    public Guid Id { get; private set; }
    public Guid WorkspaceId { get; private set; }

    /// <summary>IdentityId of the workspace manager who triggered the batch.</summary>
    public Guid CreatedBy { get; private set; }

    public DateTime CreatedAt { get; private set; }
    public InvitationBatchSource Source { get; private set; }

    /// <summary>Count of recipients submitted, before any per-recipient outcome.</summary>
    public int TotalRecipients { get; private set; }

    // Required by EF Core — not for application use
    private InvitationBatch() { }

    public static InvitationBatch Create(
        Guid workspaceId,
        Guid createdBy,
        InvitationBatchSource source,
        int totalRecipients)
    {
        if (workspaceId == Guid.Empty)
            throw new ArgumentException("An Invitation Batch must name exactly one Workspace.", nameof(workspaceId));
        if (createdBy == Guid.Empty)
            throw new ArgumentException("An Invitation Batch must record who created it.", nameof(createdBy));
        if (totalRecipients <= 0)
            throw new ArgumentException("An Invitation Batch must have at least one recipient.", nameof(totalRecipients));

        return new InvitationBatch
        {
            Id = Guid.NewGuid(),
            WorkspaceId = workspaceId,
            CreatedBy = createdBy,
            CreatedAt = DateTime.UtcNow,
            Source = source,
            TotalRecipients = totalRecipients
        };
    }
}
