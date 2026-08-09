namespace Platform.Domain;

/// <summary>
/// Commercial Product Aggregate Root — the stable identity of a sellable
/// Solo tier (Commercial Domain Data Model §3's PRODUCT). Named
/// "CommercialProduct" rather than bare "Product" because this codebase
/// already has an unrelated <see cref="LearningProduct"/> (a course) in the
/// same flat namespace — bare "Product" next to it would be a real
/// ambiguity risk.
///
/// Deliberately shallow, same split as <see cref="LearningProduct"/> vs
/// Curriculum: this aggregate owns identity and lifecycle only. Everything
/// priced or entitled — the numbers that actually change over time — lives
/// on <see cref="CommercialProductVersion"/>, never mutated here (CPR-008).
/// </summary>
public class CommercialProduct
{
    public Guid Id { get; private set; }
    public Guid ProductFamilyId { get; private set; }
    public string Code { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public CatalogStatus Status { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }

    // Required by EF Core — not for application use
    private CommercialProduct() { }

    public static CommercialProduct Create(Guid productFamilyId, string code, string name)
    {
        if (productFamilyId == Guid.Empty)
            throw new ArgumentException("A Commercial Product belongs to exactly one Product Family.", nameof(productFamilyId));
        ArgumentException.ThrowIfNullOrWhiteSpace(code);
        ArgumentException.ThrowIfNullOrWhiteSpace(name);

        var now = DateTime.UtcNow;
        return new CommercialProduct
        {
            Id = Guid.NewGuid(),
            ProductFamilyId = productFamilyId,
            Code = code.Trim().ToLowerInvariant(),
            Name = name.Trim(),
            Status = CatalogStatus.Draft,
            CreatedAt = now,
            UpdatedAt = now,
        };
    }

    /// <summary>Draft→Published — called the first time one of this Product's Versions is published (Product Configuration Engine, Product Lifecycle §30).</summary>
    public void Publish()
    {
        if (Status == CatalogStatus.Draft) { Status = CatalogStatus.Published; Touch(); }
    }

    /// <summary>No longer sold. CPR-009: existing Subscriptions keep resolving against whichever Version they already reference, unaffected.</summary>
    public void Retire()
    {
        if (Status == CatalogStatus.Retired)
            throw new InvalidOperationException("This product is already retired.");
        Status = CatalogStatus.Retired;
        Touch();
    }

    private void Touch() => UpdatedAt = DateTime.UtcNow;
}
