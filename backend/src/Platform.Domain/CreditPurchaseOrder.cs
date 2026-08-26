namespace Platform.Domain;

/// <summary>
/// Credit Purchase Order Aggregate Root — a one-time AI-credit top-up. This
/// platform collects no real payment (2026-08-09 correction), so this mirrors
/// <see cref="Invoice"/>'s Manual Commercial Activation shape (request → a
/// Platform Operator confirms payment happened outside the platform → the
/// credits are granted) without reusing Invoice itself: Invoice is hard-wired
/// to a Subscription and Configuration Snapshot (Pricing Snapshot Principle),
/// and <see cref="Invoice.MarkPaid"/> is paired with activating a Subscription
/// — neither concept applies to a standalone, subscription-independent
/// purchase. Kept as its own small aggregate to preserve the same bounded-
/// context separation Billing/Subscription/Credit Ledger already have from
/// each other elsewhere in this domain.
/// </summary>
public class CreditPurchaseOrder
{
    public Guid Id { get; private set; }
    public Guid WorkspaceId { get; private set; }
    public string CreditPackCode { get; private set; } = string.Empty;
    public int CreditAmount { get; private set; }
    public decimal PriceAmount { get; private set; }
    public string PriceCurrency { get; private set; } = string.Empty;
    public CreditPurchaseOrderStatus Status { get; private set; }
    public Guid RequestedByIdentityId { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public Guid? ResolvedByIdentityId { get; private set; }
    public string? ReferenceNote { get; private set; }
    public DateTime? ResolvedAt { get; private set; }

    /// <summary>Set once payment is confirmed — the CreditLedgerEntry (Purchase) this order's payment produced, same traceability idea as Invoice.MarkedPaidByEventId.</summary>
    public Guid? GrantedLedgerEntryId { get; private set; }

    // Required by EF Core — not for application use
    private CreditPurchaseOrder() { }

    public static CreditPurchaseOrder Create(
        Guid workspaceId, Guid requestedByIdentityId, string creditPackCode,
        int creditAmount, decimal priceAmount, string priceCurrency)
    {
        if (workspaceId == Guid.Empty)
            throw new ArgumentException("A Credit Purchase Order belongs to exactly one Workspace.", nameof(workspaceId));
        if (requestedByIdentityId == Guid.Empty)
            throw new ArgumentException("A Credit Purchase Order must record who requested it.", nameof(requestedByIdentityId));
        ArgumentException.ThrowIfNullOrWhiteSpace(creditPackCode);
        if (creditAmount <= 0)
            throw new ArgumentException("Credit amount must be positive.", nameof(creditAmount));
        if (priceAmount < 0)
            throw new ArgumentException("Price cannot be negative.", nameof(priceAmount));
        ArgumentException.ThrowIfNullOrWhiteSpace(priceCurrency);

        return new CreditPurchaseOrder
        {
            Id = Guid.NewGuid(),
            WorkspaceId = workspaceId,
            RequestedByIdentityId = requestedByIdentityId,
            CreditPackCode = creditPackCode,
            CreditAmount = creditAmount,
            PriceAmount = priceAmount,
            PriceCurrency = priceCurrency,
            Status = CreditPurchaseOrderStatus.Pending,
            CreatedAt = DateTime.UtcNow,
        };
    }

    /// <summary>Manual Commercial Activation: a Platform Operator recorded that this was paid outside the platform.</summary>
    public void MarkPaid(Guid operatorIdentityId, string? referenceNote)
    {
        if (Status != CreditPurchaseOrderStatus.Pending)
            throw new InvalidOperationException($"A Credit Purchase Order that is {Status} cannot be marked paid.");
        if (operatorIdentityId == Guid.Empty)
            throw new ArgumentException("Marking a purchase paid must record the operator who confirmed it.", nameof(operatorIdentityId));

        Status = CreditPurchaseOrderStatus.Paid;
        ResolvedByIdentityId = operatorIdentityId;
        ReferenceNote = referenceNote;
        ResolvedAt = DateTime.UtcNow;
    }

    /// <summary>Rejects a bogus/duplicate request — no credits are granted.</summary>
    public void Void(Guid operatorIdentityId, string? reason)
    {
        if (Status != CreditPurchaseOrderStatus.Pending)
            throw new InvalidOperationException($"A Credit Purchase Order that is {Status} cannot be voided.");
        if (operatorIdentityId == Guid.Empty)
            throw new ArgumentException("Voiding a purchase must record the operator who did it.", nameof(operatorIdentityId));

        Status = CreditPurchaseOrderStatus.Voided;
        ResolvedByIdentityId = operatorIdentityId;
        ReferenceNote = reason;
        ResolvedAt = DateTime.UtcNow;
    }

    public void AttachLedgerEntry(Guid ledgerEntryId)
    {
        if (ledgerEntryId == Guid.Empty)
            throw new ArgumentException("Must reference the Credit Ledger Entry this purchase granted.", nameof(ledgerEntryId));
        GrantedLedgerEntryId = ledgerEntryId;
    }
}
