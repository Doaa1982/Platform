using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Platform.Api.Authorization;
using Platform.Api.Models;
using Platform.Api.Services;

namespace Platform.Api.Controllers;

/// <summary>
/// Catalog management — Products (Solo plans) and Packs (Capability Packs),
/// database-backed. Platform-Operator-only, kept separate from the
/// already-large AdminController, same reasoning as
/// EntitlementOverridesController.
/// </summary>
[ApiController]
[Route("api/admin/catalog")]
[Authorize(Policy = PlatformOperatorRequirement.PolicyName)]
public class CatalogAdminController(CatalogAdminService catalog) : ControllerBase
{
    [HttpGet("products")]
    public async Task<ActionResult<IReadOnlyList<ProductAdminRow>>> ListProducts(CancellationToken ct)
        => Ok(await catalog.ListProductsAsync(ct));

    [HttpPost("products")]
    public async Task<ActionResult<ProductAdminRow>> CreateProduct([FromBody] CreateProductRequest request, CancellationToken ct)
        => Run(await catalog.CreateProductAsync(request, ct));

    [HttpPost("products/{id:guid}/versions")]
    public async Task<ActionResult<ProductAdminRow>> CreateProductVersion(
        Guid id, [FromBody] CreateProductVersionRequest request, CancellationToken ct)
        => Run(await catalog.CreateProductVersionAsync(id, request.Version, ct));

    [HttpPut("products/{id:guid}/versions/{versionId:guid}")]
    public async Task<ActionResult<ProductAdminRow>> UpdateProductVersion(
        Guid id, Guid versionId, [FromBody] UpdateProductVersionRequest request, CancellationToken ct)
        => Run(await catalog.UpdateProductVersionAsync(id, versionId, request.Version, ct));

    [HttpPost("products/{id:guid}/versions/{versionId:guid}/publish")]
    public async Task<ActionResult<ProductAdminRow>> PublishProductVersion(Guid id, Guid versionId, CancellationToken ct)
        => Run(await catalog.PublishProductVersionAsync(id, versionId, ct));

    [HttpPost("products/{id:guid}/retire")]
    public async Task<ActionResult<ProductAdminRow>> RetireProduct(Guid id, CancellationToken ct)
        => Run(await catalog.RetireProductAsync(id, ct));

    [HttpGet("packs")]
    public async Task<ActionResult<IReadOnlyList<PackAdminRow>>> ListPacks(CancellationToken ct)
        => Ok(await catalog.ListPacksAsync(ct));

    [HttpPost("packs")]
    public async Task<ActionResult<PackAdminRow>> CreatePack([FromBody] CreatePackRequest request, CancellationToken ct)
        => Run(await catalog.CreatePackAsync(request, ct));

    [HttpPost("packs/{id:guid}/versions")]
    public async Task<ActionResult<PackAdminRow>> CreatePackVersion(
        Guid id, [FromBody] CreatePackVersionRequest request, CancellationToken ct)
        => Run(await catalog.CreatePackVersionAsync(id, request.Version, ct));

    [HttpPut("packs/{id:guid}/versions/{versionId:guid}")]
    public async Task<ActionResult<PackAdminRow>> UpdatePackVersion(
        Guid id, Guid versionId, [FromBody] UpdatePackVersionRequest request, CancellationToken ct)
        => Run(await catalog.UpdatePackVersionAsync(id, versionId, request.Version, ct));

    [HttpPost("packs/{id:guid}/versions/{versionId:guid}/publish")]
    public async Task<ActionResult<PackAdminRow>> PublishPackVersion(Guid id, Guid versionId, CancellationToken ct)
        => Run(await catalog.PublishPackVersionAsync(id, versionId, ct));

    [HttpPost("packs/{id:guid}/retire")]
    public async Task<ActionResult<PackAdminRow>> RetirePack(Guid id, CancellationToken ct)
        => Run(await catalog.RetirePackAsync(id, ct));

    private ActionResult<T> Run<T>(ProvisioningResult<T> result) => result.Error switch
    {
        ProvisioningError.None      => Ok(result.Value),
        ProvisioningError.NotFound  => NotFound(new { message = result.Message }),
        ProvisioningError.Conflict  => Conflict(new { message = result.Message }),
        ProvisioningError.Forbidden => StatusCode(StatusCodes.Status403Forbidden, new { message = result.Message }),
        _                           => BadRequest(new { message = result.Message }),
    };
}
