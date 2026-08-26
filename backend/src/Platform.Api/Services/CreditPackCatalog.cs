namespace Platform.Api.Services;

/// <summary>One sellable AI-credit top-up tier.</summary>
public sealed record CreditPackTier(string Code, string Name, int CreditAmount, decimal Price, string Currency);

/// <summary>
/// AI-credit top-up tiers — a static, in-code list rather than a database-
/// backed catalog like <see cref="Platform.Domain.CommercialProduct"/>/
/// <see cref="Platform.Domain.CommercialPack"/>. Those earned admin-editable
/// versioning because "changing a price used to mean a deploy" was a real,
/// stated pain point; three fixed tiers don't have that problem yet. If an
/// operator later needs to edit these without a deploy, that's a small,
/// isolated follow-up mirroring the catalog admin work already done for
/// Products/Packs — not needed for a first cut.
/// </summary>
public static class CreditPackCatalog
{
    public static readonly IReadOnlyList<CreditPackTier> Tiers =
    [
        new("credits-s", "5,000 AI credits", 5_000, 15m, "USD"),
        new("credits-m", "20,000 AI credits", 20_000, 50m, "USD"),
        new("credits-l", "50,000 AI credits", 50_000, 110m, "USD"),
    ];

    public static CreditPackTier? Find(string code) =>
        Tiers.FirstOrDefault(t => string.Equals(t.Code, code, StringComparison.OrdinalIgnoreCase));
}
