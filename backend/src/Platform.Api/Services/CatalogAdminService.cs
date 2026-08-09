using Microsoft.EntityFrameworkCore;
using Platform.Api.Models;
using Platform.Domain;
using Platform.Infrastructure;

namespace Platform.Api.Services;

/// <summary>
/// Platform-Operator-facing catalog management — closes the gap the in-code
/// catalog left (Decision Brief-adjacent: changing a price used to mean a
/// deploy). No multi-stage review workflow: any Platform Operator can
/// publish directly, the same authority model as the rest of /admin.
///
/// "Editing a price" always means creating a new Draft Version and
/// publishing it — an existing Version's numbers are never patched
/// (CPR-008). Publishing a Version automatically retires whichever Version
/// was previously Published, so at most one is ever current for new sales
/// (CPR-009: retiring never invalidates a Subscription that already
/// references the old Version).
/// </summary>
public class CatalogAdminService(PlatformDbContext db)
{
    // ── Products ─────────────────────────────────────────────────────────

    public async Task<IReadOnlyList<ProductAdminRow>> ListProductsAsync(CancellationToken ct = default)
    {
        var products = await db.CommercialProducts.AsNoTracking().OrderBy(p => p.Code).ToListAsync(ct);
        var productIds = products.Select(p => p.Id).ToList();
        var versions = await db.CommercialProductVersions.AsNoTracking()
            .Where(v => productIds.Contains(v.ProductId)).ToListAsync(ct);
        var families = await db.ProductFamilies.AsNoTracking().ToDictionaryAsync(f => f.Id, ct);

        return products.Select(p => DescribeProduct(p, families.GetValueOrDefault(p.ProductFamilyId)?.Code ?? "",
            versions.Where(v => v.ProductId == p.Id).ToList())).ToList();
    }

    public async Task<ProvisioningResult<ProductAdminRow>> CreateProductAsync(
        CreateProductRequest request, CancellationToken ct = default)
    {
        var familyCode = request.FamilyCode.Trim().ToLowerInvariant();
        var family = await db.ProductFamilies.AsNoTracking().FirstOrDefaultAsync(f => f.Code == familyCode, ct);
        if (family is null) return Fail<ProductAdminRow>($"No such product family \"{request.FamilyCode}\".");

        var code = request.Code.Trim().ToLowerInvariant();
        if (await db.CommercialProducts.AnyAsync(p => p.Code == code, ct))
            return Fail<ProductAdminRow>($"A product with code \"{code}\" already exists.");

        CommercialProduct product;
        CommercialProductVersion version;
        try
        {
            product = CommercialProduct.Create(family.Id, code, request.Name);
            version = BuildProductVersion(product.Id, 1, request.Version);
        }
        catch (ArgumentException ex) { return Fail<ProductAdminRow>(ex.Message); }

        db.CommercialProducts.Add(product);
        db.CommercialProductVersions.Add(version);
        await db.SaveChangesAsync(ct);

        return ProvisioningResult<ProductAdminRow>.Success(
            DescribeProduct(product, family.Code, [version]));
    }

    public async Task<ProvisioningResult<ProductAdminRow>> CreateProductVersionAsync(
        Guid productId, ProductVersionFields fields, CancellationToken ct = default)
    {
        var product = await db.CommercialProducts.FirstOrDefaultAsync(p => p.Id == productId, ct);
        if (product is null) return Fail<ProductAdminRow>("No such product.");
        if (product.Status == CatalogStatus.Retired)
            return Fail<ProductAdminRow>("A retired product cannot have new versions created.");

        if (await db.CommercialProductVersions.AnyAsync(v => v.ProductId == productId && v.Status == CatalogStatus.Draft, ct))
            return Fail<ProductAdminRow>("This product already has a pending draft version — publish it first.");

        var nextVersionNumber = (await db.CommercialProductVersions
            .Where(v => v.ProductId == productId).MaxAsync(v => (int?)v.VersionNumber, ct) ?? 0) + 1;

        CommercialProductVersion version;
        try { version = BuildProductVersion(productId, nextVersionNumber, fields); }
        catch (ArgumentException ex) { return Fail<ProductAdminRow>(ex.Message); }

        db.CommercialProductVersions.Add(version);
        await db.SaveChangesAsync(ct);

        return await GetProductRowAsync(productId, ct);
    }

    /// <summary>Publishes a Draft version and retires whichever Version was previously current — at most one Published Version at a time (CPR-009).</summary>
    public async Task<ProvisioningResult<ProductAdminRow>> PublishProductVersionAsync(
        Guid productId, Guid versionId, CancellationToken ct = default)
    {
        var product = await db.CommercialProducts.FirstOrDefaultAsync(p => p.Id == productId, ct);
        if (product is null) return Fail<ProductAdminRow>("No such product.");

        var version = await db.CommercialProductVersions.FirstOrDefaultAsync(v => v.Id == versionId && v.ProductId == productId, ct);
        if (version is null) return Fail<ProductAdminRow>("No such version on this product.");

        var previouslyPublished = await db.CommercialProductVersions
            .FirstOrDefaultAsync(v => v.ProductId == productId && v.Status == CatalogStatus.Published, ct);

        try
        {
            version.Publish();
            previouslyPublished?.Retire();
            product.Publish();
        }
        catch (InvalidOperationException ex) { return Fail<ProductAdminRow>(ex.Message); }

        await db.SaveChangesAsync(ct);
        return await GetProductRowAsync(productId, ct);
    }

    /// <summary>No longer sold — existing Subscriptions keep resolving against whichever Version they already reference (CPR-009).</summary>
    public async Task<ProvisioningResult<ProductAdminRow>> RetireProductAsync(Guid productId, CancellationToken ct = default)
    {
        var product = await db.CommercialProducts.FirstOrDefaultAsync(p => p.Id == productId, ct);
        if (product is null) return Fail<ProductAdminRow>("No such product.");

        var current = await db.CommercialProductVersions
            .FirstOrDefaultAsync(v => v.ProductId == productId && v.Status == CatalogStatus.Published, ct);

        try { product.Retire(); current?.Retire(); }
        catch (InvalidOperationException ex) { return Fail<ProductAdminRow>(ex.Message); }

        await db.SaveChangesAsync(ct);
        return await GetProductRowAsync(productId, ct);
    }

    // ── Packs ────────────────────────────────────────────────────────────

    public async Task<IReadOnlyList<PackAdminRow>> ListPacksAsync(CancellationToken ct = default)
    {
        var packs = await db.CommercialPacks.AsNoTracking().OrderBy(p => p.Code).ToListAsync(ct);
        var packIds = packs.Select(p => p.Id).ToList();
        var versions = await db.CommercialPackVersions.AsNoTracking()
            .Where(v => packIds.Contains(v.PackId)).ToListAsync(ct);

        return packs.Select(p => DescribePack(p, versions.Where(v => v.PackId == p.Id).ToList())).ToList();
    }

    public async Task<ProvisioningResult<PackAdminRow>> CreatePackAsync(
        CreatePackRequest request, CancellationToken ct = default)
    {
        if (!Enum.TryParse<CapabilityPack>(request.Code, ignoreCase: true, out var code))
            return Fail<PackAdminRow>($"\"{request.Code}\" is not a Capability Pack code.");
        if (await db.CommercialPacks.AnyAsync(p => p.Code == code, ct))
            return Fail<PackAdminRow>($"A pack with code \"{code}\" already exists.");

        CommercialPack pack;
        CommercialPackVersion version;
        try
        {
            pack = CommercialPack.Create(code, request.Name);
            version = BuildPackVersion(pack.Id, 1, request.Version);
        }
        catch (ArgumentException ex) { return Fail<PackAdminRow>(ex.Message); }

        db.CommercialPacks.Add(pack);
        db.CommercialPackVersions.Add(version);
        await db.SaveChangesAsync(ct);

        return ProvisioningResult<PackAdminRow>.Success(DescribePack(pack, [version]));
    }

    public async Task<ProvisioningResult<PackAdminRow>> CreatePackVersionAsync(
        Guid packId, PackVersionFields fields, CancellationToken ct = default)
    {
        var pack = await db.CommercialPacks.FirstOrDefaultAsync(p => p.Id == packId, ct);
        if (pack is null) return Fail<PackAdminRow>("No such pack.");
        if (pack.Status == CatalogStatus.Retired)
            return Fail<PackAdminRow>("A retired pack cannot have new versions created.");

        if (await db.CommercialPackVersions.AnyAsync(v => v.PackId == packId && v.Status == CatalogStatus.Draft, ct))
            return Fail<PackAdminRow>("This pack already has a pending draft version — publish it first.");

        var nextVersionNumber = (await db.CommercialPackVersions
            .Where(v => v.PackId == packId).MaxAsync(v => (int?)v.VersionNumber, ct) ?? 0) + 1;

        CommercialPackVersion version;
        try { version = BuildPackVersion(packId, nextVersionNumber, fields); }
        catch (ArgumentException ex) { return Fail<PackAdminRow>(ex.Message); }

        db.CommercialPackVersions.Add(version);
        await db.SaveChangesAsync(ct);

        return await GetPackRowAsync(packId, ct);
    }

    public async Task<ProvisioningResult<PackAdminRow>> PublishPackVersionAsync(
        Guid packId, Guid versionId, CancellationToken ct = default)
    {
        var pack = await db.CommercialPacks.FirstOrDefaultAsync(p => p.Id == packId, ct);
        if (pack is null) return Fail<PackAdminRow>("No such pack.");

        var version = await db.CommercialPackVersions.FirstOrDefaultAsync(v => v.Id == versionId && v.PackId == packId, ct);
        if (version is null) return Fail<PackAdminRow>("No such version on this pack.");

        var previouslyPublished = await db.CommercialPackVersions
            .FirstOrDefaultAsync(v => v.PackId == packId && v.Status == CatalogStatus.Published, ct);

        try
        {
            version.Publish();
            previouslyPublished?.Retire();
            pack.Publish();
        }
        catch (InvalidOperationException ex) { return Fail<PackAdminRow>(ex.Message); }

        await db.SaveChangesAsync(ct);
        return await GetPackRowAsync(packId, ct);
    }

    public async Task<ProvisioningResult<PackAdminRow>> RetirePackAsync(Guid packId, CancellationToken ct = default)
    {
        var pack = await db.CommercialPacks.FirstOrDefaultAsync(p => p.Id == packId, ct);
        if (pack is null) return Fail<PackAdminRow>("No such pack.");

        var current = await db.CommercialPackVersions
            .FirstOrDefaultAsync(v => v.PackId == packId && v.Status == CatalogStatus.Published, ct);

        try { pack.Retire(); current?.Retire(); }
        catch (InvalidOperationException ex) { return Fail<PackAdminRow>(ex.Message); }

        await db.SaveChangesAsync(ct);
        return await GetPackRowAsync(packId, ct);
    }

    // ── Shared ───────────────────────────────────────────────────────────

    private async Task<ProvisioningResult<ProductAdminRow>> GetProductRowAsync(Guid productId, CancellationToken ct)
    {
        var product = await db.CommercialProducts.AsNoTracking().FirstOrDefaultAsync(p => p.Id == productId, ct);
        if (product is null) return Fail<ProductAdminRow>("No such product.");

        var family = await db.ProductFamilies.AsNoTracking().FirstOrDefaultAsync(f => f.Id == product.ProductFamilyId, ct);
        var versions = await db.CommercialProductVersions.AsNoTracking().Where(v => v.ProductId == productId).ToListAsync(ct);

        return ProvisioningResult<ProductAdminRow>.Success(DescribeProduct(product, family?.Code ?? "", versions));
    }

    private async Task<ProvisioningResult<PackAdminRow>> GetPackRowAsync(Guid packId, CancellationToken ct)
    {
        var pack = await db.CommercialPacks.AsNoTracking().FirstOrDefaultAsync(p => p.Id == packId, ct);
        if (pack is null) return Fail<PackAdminRow>("No such pack.");

        var versions = await db.CommercialPackVersions.AsNoTracking().Where(v => v.PackId == packId).ToListAsync(ct);
        return ProvisioningResult<PackAdminRow>.Success(DescribePack(pack, versions));
    }

    private static CommercialProductVersion BuildProductVersion(Guid productId, int versionNumber, ProductVersionFields fields) =>
        CommercialProductVersion.Create(
            productId, versionNumber,
            fields.MonthlyPrice, fields.AnnualPrice, fields.Currency,
            fields.TutorCapacityBase, fields.TutorCapacityMax, fields.AiCreditsIncluded,
            ParseProfile(fields.LearningProfile, "Learning"), ParseProfile(fields.AssessmentProfile, "Assessment"),
            ParseProfile(fields.AnalyticsProfile, "Analytics"), ParseProfile(fields.BrandingProfile, "Branding"));

    private static CommercialPackVersion BuildPackVersion(Guid packId, int versionNumber, PackVersionFields fields) =>
        CommercialPackVersion.Create(
            packId, versionNumber, fields.MonthlyPrice, fields.Currency,
            ParseOptionalProfile(fields.LearningGrant), ParseOptionalProfile(fields.AssessmentGrant),
            ParseOptionalProfile(fields.AnalyticsGrant), ParseOptionalProfile(fields.BrandingGrant),
            fields.ExtraTutorCapacity,
            ParseOptionalDomain(fields.RequiresDomain), ParseOptionalProfile(fields.RequiresMinLevel));

    private static ProductAdminRow DescribeProduct(CommercialProduct product, string familyCode, IReadOnlyList<CommercialProductVersion> versions)
    {
        var current = versions.Where(v => v.Status == CatalogStatus.Published).OrderByDescending(v => v.VersionNumber).FirstOrDefault();
        var draft = versions.Where(v => v.Status == CatalogStatus.Draft).OrderByDescending(v => v.VersionNumber).FirstOrDefault();
        var retiredCount = versions.Count(v => v.Status == CatalogStatus.Retired);

        return new ProductAdminRow(
            Id: product.Id, FamilyCode: familyCode, Code: product.Code, Name: product.Name, Status: product.Status.ToString(),
            CurrentVersion: current is null ? null : DescribeVersion(current),
            DraftVersion: draft is null ? null : DescribeVersion(draft),
            RetiredVersionCount: retiredCount);
    }

    private static PackAdminRow DescribePack(CommercialPack pack, IReadOnlyList<CommercialPackVersion> versions)
    {
        var current = versions.Where(v => v.Status == CatalogStatus.Published).OrderByDescending(v => v.VersionNumber).FirstOrDefault();
        var draft = versions.Where(v => v.Status == CatalogStatus.Draft).OrderByDescending(v => v.VersionNumber).FirstOrDefault();
        var retiredCount = versions.Count(v => v.Status == CatalogStatus.Retired);

        return new PackAdminRow(
            Id: pack.Id, Code: pack.Code.ToString(), Name: pack.Name, Status: pack.Status.ToString(),
            CurrentVersion: current is null ? null : DescribePackVersion(current),
            DraftVersion: draft is null ? null : DescribePackVersion(draft),
            RetiredVersionCount: retiredCount);
    }

    private static ProductVersionRow DescribeVersion(CommercialProductVersion v) => new(
        v.Id, v.VersionNumber, v.Status.ToString(), v.MonthlyPrice, v.AnnualPrice, v.Currency,
        v.TutorCapacityBase, v.TutorCapacityMax, v.AiCreditsIncluded,
        v.LearningProfile.ToString(), v.AssessmentProfile.ToString(), v.AnalyticsProfile.ToString(), v.BrandingProfile.ToString(),
        v.CreatedAt, v.PublishedAt, v.RetiredAt);

    private static PackVersionRow DescribePackVersion(CommercialPackVersion v) => new(
        v.Id, v.VersionNumber, v.Status.ToString(), v.MonthlyPrice, v.Currency,
        v.LearningGrant?.ToString(), v.AssessmentGrant?.ToString(), v.AnalyticsGrant?.ToString(), v.BrandingGrant?.ToString(),
        v.ExtraTutorCapacity, v.RequiresDomain?.ToString(), v.RequiresMinLevel?.ToString(),
        v.CreatedAt, v.PublishedAt, v.RetiredAt);

    private static CapabilityProfileLevel ParseProfile(string value, string field)
    {
        if (!Enum.TryParse<CapabilityProfileLevel>(value, ignoreCase: true, out var parsed))
            throw new ArgumentException($"\"{value}\" is not a valid capability level for {field}.");
        return parsed;
    }

    private static CapabilityProfileLevel? ParseOptionalProfile(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : ParseProfile(value, "grant/requirement");

    private static CapabilityDomain? ParseOptionalDomain(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        if (!Enum.TryParse<CapabilityDomain>(value, ignoreCase: true, out var domain))
            throw new ArgumentException($"\"{value}\" is not a capability domain.");
        return domain;
    }

    private static ProvisioningResult<T> Fail<T>(string message) => ProvisioningResult<T>.Fail(ProvisioningError.Invalid, message);
}
