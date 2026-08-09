using Microsoft.EntityFrameworkCore;
using Platform.Domain;
using Platform.Infrastructure;

namespace Platform.Api.Services;

/// <summary>
/// Read-only catalog lookups shared by the public catalog controller and
/// checkout (<see cref="ConfigurationService"/>) — "current" always means
/// the one <see cref="CatalogStatus.Published"/> Version for a Product/Pack,
/// which by construction (<see cref="CatalogAdminService"/> retires the
/// previous one on every publish) is at most one row.
/// </summary>
public class CatalogQueryService(PlatformDbContext db)
{
    public async Task<IReadOnlyList<(CommercialProduct Product, CommercialProductVersion Version)>> ListPublishedProductsAsync(
        CancellationToken ct = default)
    {
        var products = await db.CommercialProducts.AsNoTracking()
            .Where(p => p.Status == CatalogStatus.Published)
            .ToListAsync(ct);

        var productIds = products.Select(p => p.Id).ToList();
        var currentVersions = await db.CommercialProductVersions.AsNoTracking()
            .Where(v => productIds.Contains(v.ProductId) && v.Status == CatalogStatus.Published)
            .ToListAsync(ct);

        return products
            .Join(currentVersions, p => p.Id, v => v.ProductId, (p, v) => (p, v))
            .ToList();
    }

    public async Task<(CommercialProduct Product, CommercialProductVersion Version)?> FindPublishedProductAsync(
        string code, CancellationToken ct = default)
    {
        var normalised = code.Trim().ToLowerInvariant();
        var product = await db.CommercialProducts.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Code == normalised && p.Status == CatalogStatus.Published, ct);
        if (product is null) return null;

        var version = await db.CommercialProductVersions.AsNoTracking()
            .FirstOrDefaultAsync(v => v.ProductId == product.Id && v.Status == CatalogStatus.Published, ct);
        return version is null ? null : (product, version);
    }

    public async Task<IReadOnlyList<(CommercialPack Pack, CommercialPackVersion Version)>> ListPublishedPacksAsync(
        CancellationToken ct = default)
    {
        var packs = await db.CommercialPacks.AsNoTracking()
            .Where(p => p.Status == CatalogStatus.Published)
            .ToListAsync(ct);

        var packIds = packs.Select(p => p.Id).ToList();
        var currentVersions = await db.CommercialPackVersions.AsNoTracking()
            .Where(v => packIds.Contains(v.PackId) && v.Status == CatalogStatus.Published)
            .ToListAsync(ct);

        return packs
            .Join(currentVersions, p => p.Id, v => v.PackId, (p, v) => (p, v))
            .ToList();
    }

    public async Task<(CommercialPack Pack, CommercialPackVersion Version)?> FindPublishedPackAsync(
        CapabilityPack code, CancellationToken ct = default)
    {
        var pack = await db.CommercialPacks.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Code == code && p.Status == CatalogStatus.Published, ct);
        if (pack is null) return null;

        var version = await db.CommercialPackVersions.AsNoTracking()
            .FirstOrDefaultAsync(v => v.PackId == pack.Id && v.Status == CatalogStatus.Published, ct);
        return version is null ? null : (pack, version);
    }
}
