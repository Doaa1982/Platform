namespace Platform.Domain;

/// <summary>
/// Billing Account Aggregate Root — Commercial Domain Data Model — Billing.md
/// v0.2. "Who is billed" — narrowed from the original design (which also held
/// a default payment method) by the 2026-08-09 correction: this platform
/// collects no payment, so there is no payment method to default.
///
/// One per Workspace, created lazily the first time a Workspace checks out
/// (mirrors how <see cref="Enrollment"/> auto-creates on first access rather
/// than requiring a separate provisioning step).
/// </summary>
public class BillingAccount
{
    public Guid Id { get; private set; }
    public Guid WorkspaceId { get; private set; }
    public DateTime CreatedAt { get; private set; }

    // Required by EF Core — not for application use
    private BillingAccount() { }

    public static BillingAccount Create(Guid workspaceId)
    {
        if (workspaceId == Guid.Empty)
            throw new ArgumentException("A Billing Account belongs to exactly one Workspace.", nameof(workspaceId));

        return new BillingAccount { Id = Guid.NewGuid(), WorkspaceId = workspaceId, CreatedAt = DateTime.UtcNow };
    }
}
