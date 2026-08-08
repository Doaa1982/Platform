using Microsoft.EntityFrameworkCore;
using Platform.Api.Models;
using Platform.Domain;
using Platform.Infrastructure;

namespace Platform.Api.Services;

/// <summary>
/// Learning Products inside one Workspace — Learning Product Aggregate Design.
///
/// A Learning Product is *what is offered*; a Curriculum is *what is taught*
/// (§10). Both now exist, so a product can be given real structure.
///
/// INV-006 — no publishing without an active, published Curriculum — is now
/// enforceable and enforced. Each product reports whether it has one, so a
/// client can say what is missing before the tutor tries to publish.
/// </summary>
public class LearningProductService(PlatformDbContext db)
{
    /// <summary>
    /// Who may author. Teachers are included deliberately: authoring is the job
    /// the role exists for, and requiring Owner or Administrator would make a
    /// workspace's teachers unable to write the courses they teach.
    /// </summary>
    private static readonly WorkspaceRoleName[] AuthorRoles =
        [WorkspaceRoleName.Owner, WorkspaceRoleName.Administrator, WorkspaceRoleName.Teacher];

    // ── Reading ──────────────────────────────────────────────────────────────

    public async Task<ProvisioningResult<LearningProductListResponse>> ListAsync(
        string slug, Guid callerIdentityId, CancellationToken ct = default)
    {
        var ctx = await ResolveAsync(slug, callerIdentityId, requireAuthor: false, ct);
        if (ctx.Error is not null)
            return ProvisioningResult<LearningProductListResponse>.Fail(ctx.Error.Value.Error, ctx.Error.Value.Message);

        var products = await db.LearningProducts.AsNoTracking()
            .Where(p => p.WorkspaceId == ctx.Workspace!.Id)
            // Drafts first — they are the ones still needing work
            .OrderBy(p => p.Status == LearningProductStatus.Archived ? 2
                        : p.Status == LearningProductStatus.Published ? 1 : 0)
            .ThenByDescending(p => p.UpdatedAt)
            .ToListAsync(ct);

        // One query for the whole page rather than one per product
        var withCurriculum = await db.Curricula.AsNoTracking()
            .Where(c => c.WorkspaceId == ctx.Workspace!.Id && c.Status == CurriculumStatus.Published)
            .Select(c => c.LearningProductId)
            .ToListAsync(ct);

        // Read regardless of Curriculum status — a tutor may set this before
        // ever publishing, from the product edit form rather than Content Studio.
        var sequentialByProduct = await db.Curricula.AsNoTracking()
            .Where(c => c.WorkspaceId == ctx.Workspace!.Id && c.Status != CurriculumStatus.Archived)
            .ToDictionaryAsync(c => c.LearningProductId, c => c.RequiresSequentialCompletion, ct);

        return ProvisioningResult<LearningProductListResponse>.Success(new LearningProductListResponse(
            WorkspaceName: ctx.Workspace!.Name,
            CanAuthor:     ctx.CanAuthor,
            Products:      products.Select(p => Describe(
                p, withCurriculum.Contains(p.Id), sequentialByProduct.GetValueOrDefault(p.Id))).ToList()));
    }

    private static LearningProductRow Describe(
        LearningProduct p, bool hasCurriculum = false, bool requiresSequentialCompletion = false) => new(
        Id:              p.Id,
        Title:           p.Title,
        Description:     p.Description,
        Category:        p.Category,
        Tags:            p.Tags.ToList(),
        Status:          p.Status.ToString(),
        Pacing:          p.Pacing.ToString(),
        EnrollmentMode:  p.EnrollmentMode.ToString(),
        DefaultLanguage: p.DefaultLanguage,
        CreatedAt:       p.CreatedAt,
        UpdatedAt:       p.UpdatedAt,
        PublishedAt:     p.PublishedAt,
        HasCurriculum:   hasCurriculum,
        RequiresSequentialCompletion: requiresSequentialCompletion);

    // ── Writing ──────────────────────────────────────────────────────────────

    public async Task<ProvisioningResult<LearningProductRow>> CreateAsync(
        string slug, Guid callerIdentityId, SaveLearningProductRequest request, CancellationToken ct = default)
    {
        var ctx = await ResolveAsync(slug, callerIdentityId, requireAuthor: true, ct);
        if (ctx.Error is not null) return Fail(ctx.Error.Value);

        if (string.IsNullOrWhiteSpace(request.Title))
            return Fail((ProvisioningError.Invalid, "A learning product needs a title."));

        if (!TryParseSettings(request, out var pacing, out var mode, out var settingsError))
            return Fail((ProvisioningError.Invalid, settingsError!));

        var product = LearningProduct.Create(
            workspaceId:           ctx.Workspace!.Id,
            createdByMembershipId: ctx.MembershipId,
            title:                 request.Title,
            description:           request.Description,
            pacing:                pacing,
            enrollmentMode:        mode);

        product.UpdateMetadata(request.Title, request.Description, request.Category, request.Tags);
        product.UpdateSettings(pacing, mode, request.DefaultLanguage);

        db.LearningProducts.Add(product);
        await db.SaveChangesAsync(ct);

        return ProvisioningResult<LearningProductRow>.Success(Describe(product));
    }

    public async Task<ProvisioningResult<LearningProductRow>> UpdateAsync(
        string slug, Guid callerIdentityId, Guid productId, SaveLearningProductRequest request, CancellationToken ct = default)
        => await MutateAsync(slug, callerIdentityId, productId, p =>
        {
            if (!TryParseSettings(request, out var pacing, out var mode, out var err))
                throw new ArgumentException(err);

            p.UpdateMetadata(request.Title, request.Description, request.Category, request.Tags);
            p.UpdateSettings(pacing, mode, request.DefaultLanguage);
        }, ct);

    /// <summary>
    /// Applies a state transition by name, so the client does not need one
    /// endpoint per verb and the legal set stays defined in one place.
    /// </summary>
    public async Task<ProvisioningResult<LearningProductRow>> TransitionAsync(
        string slug, Guid callerIdentityId, Guid productId, string transition, CancellationToken ct = default)
    {
        // Established before the mutation so INV-006 can be checked without the
        // aggregate reaching into another one
        var hasPublishedCurriculum = await db.Curricula.AsNoTracking()
            .AnyAsync(c => c.LearningProductId == productId && c.Status == CurriculumStatus.Published, ct);

        return await MutateAsync(slug, callerIdentityId, productId, p =>
        {
            switch (transition.ToLowerInvariant())
            {
                case "submit":    p.SubmitForReview(); break;
                case "return":    p.ReturnToDraft();   break;
                case "publish":   p.Publish(hasPublishedCurriculum); break;
                case "unpublish": p.Unpublish();       break;
                case "archive":   p.Archive();         break;
                default: throw new ArgumentException($"\"{transition}\" is not a learning product transition.");
            }
        }, ct);
    }

    private async Task<ProvisioningResult<LearningProductRow>> MutateAsync(
        string slug, Guid callerIdentityId, Guid productId, Action<LearningProduct> mutate, CancellationToken ct)
    {
        var ctx = await ResolveAsync(slug, callerIdentityId, requireAuthor: true, ct);
        if (ctx.Error is not null) return Fail(ctx.Error.Value);

        var product = await db.LearningProducts
            .FirstOrDefaultAsync(p => p.Id == productId && p.WorkspaceId == ctx.Workspace!.Id, ct);

        if (product is null) return Fail((ProvisioningError.NotFound, "No such learning product."));

        try { mutate(product); }
        // The aggregate rejects illegal transitions and edits to archived
        // products with its own message; surface it rather than a 500
        catch (InvalidOperationException ex) { return Fail((ProvisioningError.Conflict, ex.Message)); }
        catch (ArgumentException ex) { return Fail((ProvisioningError.Invalid, ex.Message)); }

        await db.SaveChangesAsync(ct);
        return ProvisioningResult<LearningProductRow>.Success(Describe(product));
    }

    // ── Shared ───────────────────────────────────────────────────────────────

    private static bool TryParseSettings(
        SaveLearningProductRequest r, out PacingModel pacing, out EnrollmentMode mode, out string? error)
    {
        pacing = PacingModel.SelfPaced;
        mode = EnrollmentMode.Open;
        error = null;

        if (!string.IsNullOrWhiteSpace(r.Pacing) && !Enum.TryParse(r.Pacing, out pacing))
        { error = $"\"{r.Pacing}\" is not a pacing model."; return false; }

        if (!string.IsNullOrWhiteSpace(r.EnrollmentMode) && !Enum.TryParse(r.EnrollmentMode, out mode))
        { error = $"\"{r.EnrollmentMode}\" is not an enrollment mode."; return false; }

        return true;
    }

    private record Context(Workspace? Workspace, Guid MembershipId, bool CanAuthor,
                           (ProvisioningError Error, string Message)? Error);

    /// <summary>
    /// A non-member gets 404, never 403, so status codes cannot be used to
    /// discover which Workspaces exist (Workspace Context, Rule 1).
    /// </summary>
    private async Task<Context> ResolveAsync(
        string slug, Guid callerIdentityId, bool requireAuthor, CancellationToken ct)
    {
        var normalised = slug.ToLowerInvariant().Trim();

        var workspace = await db.Workspaces.AsNoTracking().FirstOrDefaultAsync(w => w.Slug == normalised, ct);
        if (workspace is null)
            return new Context(null, Guid.Empty, false, (ProvisioningError.NotFound, "No such workspace."));

        var caller = await db.Memberships
            .Include(m => m.Roles)
            .AsNoTracking()
            .FirstOrDefaultAsync(m => m.WorkspaceId == workspace.Id
                                   && m.IdentityId == callerIdentityId
                                   && m.Status == MembershipStatus.Active, ct);

        if (caller is null)
            return new Context(null, Guid.Empty, false, (ProvisioningError.NotFound, "No such workspace."));

        var canAuthor = caller.Roles.Any(r => AuthorRoles.Contains(r.Name));

        if (requireAuthor && !canAuthor)
            return new Context(null, caller.Id, false,
                (ProvisioningError.Forbidden, "Only an owner, administrator or teacher can author learning products."));

        return new Context(workspace, caller.Id, canAuthor, null);
    }

    private static ProvisioningResult<LearningProductRow> Fail((ProvisioningError Error, string Message) e)
        => ProvisioningResult<LearningProductRow>.Fail(e.Error, e.Message);
}
