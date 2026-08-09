namespace Platform.Domain;

/// <summary>
/// Invoice Aggregate Root — Commercial Domain Data Model — Billing.md v0.2.
///
/// Scope-corrected 2026-08-09: this platform does not collect payment, so
/// Billing's job ends at producing the bill and tracking whether it's been
/// marked paid. <see cref="Status"/> uses the narrowed 5-state list from that
/// correction (Draft, Issued, Paid, Overdue, Voided) — not the original
/// 8-state payment-processing list. <see cref="MarkedPaidByEventId"/> is the
/// one field that replaces the entire removed Payment subsystem: a pointer to
/// the <see cref="SubscriptionEvent"/> that recorded a Platform Operator
/// manually marking this invoice paid (Manual Commercial Activation, §27a).
/// Billing stores the pointer; Subscription Management owns the actual
/// actor/reason/timestamp record, so "who said this was paid and why" lives
/// in exactly one place.
///
/// BIL-001/BIL-005: once Issued, <see cref="Lines"/> must not change —
/// enforced here by only allowing <see cref="AddLine"/> while Draft.
/// </summary>
public class Invoice
{
    private readonly List<InvoiceLine> _lines = [];

    public Guid Id { get; private set; }
    public Guid BillingAccountId { get; private set; }
    public Guid SubscriptionId { get; private set; }
    public Guid ConfigurationSnapshotId { get; private set; }
    public DateTime BillingPeriodStart { get; private set; }
    public DateTime BillingPeriodEnd { get; private set; }
    public DateTime? IssueDate { get; private set; }
    public DateTime DueDate { get; private set; }
    public string Currency { get; private set; } = string.Empty;
    public decimal SubtotalAmount { get; private set; }
    public decimal DiscountAmount { get; private set; }
    public decimal TaxAmount { get; private set; }
    public decimal TotalAmount { get; private set; }
    public InvoiceStatus Status { get; private set; }
    public Guid? MarkedPaidByEventId { get; private set; }

    public IReadOnlyCollection<InvoiceLine> Lines => _lines.AsReadOnly();

    // Required by EF Core — not for application use
    private Invoice() { }

    public static Invoice Create(
        Guid billingAccountId, Guid subscriptionId, Guid configurationSnapshotId,
        DateTime billingPeriodStart, DateTime billingPeriodEnd, DateTime dueDate, string currency)
    {
        if (billingAccountId == Guid.Empty)
            throw new ArgumentException("An Invoice belongs to exactly one Billing Account.", nameof(billingAccountId));
        if (subscriptionId == Guid.Empty)
            throw new ArgumentException("An Invoice belongs to exactly one Subscription.", nameof(subscriptionId));
        if (configurationSnapshotId == Guid.Empty)
            throw new ArgumentException("An Invoice must reference the Configuration Snapshot it prices (Pricing Snapshot Principle).", nameof(configurationSnapshotId));
        ArgumentException.ThrowIfNullOrWhiteSpace(currency);

        return new Invoice
        {
            Id = Guid.NewGuid(),
            BillingAccountId = billingAccountId,
            SubscriptionId = subscriptionId,
            ConfigurationSnapshotId = configurationSnapshotId,
            BillingPeriodStart = billingPeriodStart,
            BillingPeriodEnd = billingPeriodEnd,
            DueDate = dueDate,
            Currency = currency,
            Status = InvoiceStatus.Draft,
        };
    }

    public InvoiceLine AddLine(string description, InvoiceComponentType componentType, decimal amount)
    {
        if (Status != InvoiceStatus.Draft)
            throw new InvalidOperationException("Only a draft invoice can have lines added to it.");

        var line = InvoiceLine.Create(Id, description, componentType, amount, Currency);
        _lines.Add(line);
        Recalculate();
        return line;
    }

    /// <summary>Draft→Issued. Locks the lines and stamps the issue date — this is "the bill" from here on.</summary>
    public void Issue()
    {
        if (Status != InvoiceStatus.Draft)
            throw new InvalidOperationException("Only a draft invoice can be issued.");
        if (_lines.Count == 0)
            throw new InvalidOperationException("An invoice needs at least one line before it can be issued.");

        IssueDate = DateTime.UtcNow;
        Status = InvoiceStatus.Issued;
    }

    /// <summary>Due date passed without being marked Paid (SubscriptionManagementArchitecture.md §29) — not a failed charge, there is no charge.</summary>
    public void MarkOverdue()
    {
        if (Status != InvoiceStatus.Issued)
            throw new InvalidOperationException("Only an issued invoice can become overdue.");
        Status = InvoiceStatus.Overdue;
    }

    /// <summary>Manual Commercial Activation (§27a): an authorized Platform Operator recorded that this was paid outside the platform.</summary>
    public void MarkPaid(Guid activationEventId)
    {
        if (Status is not (InvoiceStatus.Issued or InvoiceStatus.Overdue))
            throw new InvalidOperationException("Only an issued or overdue invoice can be marked paid.");
        if (activationEventId == Guid.Empty)
            throw new ArgumentException("Marking an invoice paid must reference the Subscription Event that recorded it.", nameof(activationEventId));

        Status = InvoiceStatus.Paid;
        MarkedPaidByEventId = activationEventId;
    }

    public void Void()
    {
        if (Status is not (InvoiceStatus.Draft or InvoiceStatus.Issued or InvoiceStatus.Overdue))
            throw new InvalidOperationException($"An invoice that is {Status} cannot be voided.");
        Status = InvoiceStatus.Voided;
    }

    private void Recalculate()
    {
        SubtotalAmount = _lines.Sum(l => l.Amount);
        // No Promotion & Discounts or Tax context in this pass (both deferred) — kept as
        // explicit zeroed fields rather than omitted, so the schema doesn't need a reshape later.
        DiscountAmount = 0m;
        TaxAmount = 0m;
        TotalAmount = SubtotalAmount - DiscountAmount + TaxAmount;
    }
}
