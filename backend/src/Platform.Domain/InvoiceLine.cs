namespace Platform.Domain;

/// <summary>
/// One priced line on an Invoice — recommended invoice structure, Billing
/// Architecture §66. Child of <see cref="Invoice"/>, only addable while the
/// invoice is still Draft (Invoice immutability, BIL-001/BIL-005: once
/// Issued, lines must not change).
/// </summary>
public class InvoiceLine
{
    public Guid Id { get; private set; }
    public Guid InvoiceId { get; private set; }
    public string Description { get; private set; } = string.Empty;
    public InvoiceComponentType ComponentType { get; private set; }
    public decimal Amount { get; private set; }
    public string Currency { get; private set; } = string.Empty;

    // Required by EF Core — not for application use
    private InvoiceLine() { }

    internal static InvoiceLine Create(
        Guid invoiceId, string description, InvoiceComponentType componentType, decimal amount, string currency)
    {
        if (invoiceId == Guid.Empty)
            throw new ArgumentException("An Invoice Line belongs to exactly one Invoice.", nameof(invoiceId));
        ArgumentException.ThrowIfNullOrWhiteSpace(description);
        if (amount < 0)
            throw new ArgumentException("An invoice line cannot be negative.", nameof(amount));
        ArgumentException.ThrowIfNullOrWhiteSpace(currency);

        return new InvoiceLine
        {
            Id = Guid.NewGuid(),
            InvoiceId = invoiceId,
            Description = description.Trim(),
            ComponentType = componentType,
            Amount = amount,
            Currency = currency,
        };
    }
}
