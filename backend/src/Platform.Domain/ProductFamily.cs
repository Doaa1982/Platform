namespace Platform.Domain;

/// <summary>
/// Product Family Aggregate Root — the top of the catalog hierarchy
/// (Commercial Domain Data Model §3's PRODUCT_FAMILY). Kept deliberately
/// minimal: only the "Solo" family is seeded and there is no
/// family-management UI in this pass. It exists as a real entity — not a
/// bare string column on <see cref="CommercialProduct"/> — purely so Studio
/// and Academy (confirmed deferred, Decision Brief #2) can be added later
/// without a schema reshape, per that same decision's requirement that the
/// catalog "structurally support them so no rework is needed later."
/// </summary>
public class ProductFamily
{
    public Guid Id { get; private set; }
    public string Code { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public DateTime CreatedAt { get; private set; }

    // Required by EF Core — not for application use
    private ProductFamily() { }

    public static ProductFamily Create(string code, string name)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(code);
        ArgumentException.ThrowIfNullOrWhiteSpace(name);

        return new ProductFamily
        {
            Id = Guid.NewGuid(),
            Code = code.Trim().ToLowerInvariant(),
            Name = name.Trim(),
            CreatedAt = DateTime.UtcNow,
        };
    }
}
