namespace Platform.Domain;

/// <summary>
/// Commercial Pack Aggregate Root — the stable identity of a sellable
/// Capability Pack add-on (Commercial Domain Data Model §3's
/// CAPABILITY_PACK). Same identity/lifecycle-only split as
/// <see cref="CommercialProduct"/> vs <see cref="CommercialProductVersion"/>:
/// this owns the code and name; everything priced/granted lives on
/// <see cref="CommercialPackVersion"/>.
///
/// <see cref="Code"/> reuses the existing <see cref="CapabilityPack"/> enum
/// (AiAuthor, AiAssessment, ...) rather than a free-text string — it's
/// already the stable identifier every other part of the domain matches
/// against (ConfigurationSnapshot.SelectedPackCodes, Entitlement.Source).
/// </summary>
public class CommercialPack
{
    public Guid Id { get; private set; }
    public CapabilityPack Code { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public CatalogStatus Status { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }

    // Required by EF Core — not for application use
    private CommercialPack() { }

    public static CommercialPack Create(CapabilityPack code, string name)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);

        var now = DateTime.UtcNow;
        return new CommercialPack
        {
            Id = Guid.NewGuid(),
            Code = code,
            Name = name.Trim(),
            Status = CatalogStatus.Draft,
            CreatedAt = now,
            UpdatedAt = now,
        };
    }

    public void Publish()
    {
        if (Status == CatalogStatus.Draft) { Status = CatalogStatus.Published; Touch(); }
    }

    public void Retire()
    {
        if (Status == CatalogStatus.Retired)
            throw new InvalidOperationException("This pack is already retired.");
        Status = CatalogStatus.Retired;
        Touch();
    }

    private void Touch() => UpdatedAt = DateTime.UtcNow;
}
