namespace Platform.Api.Models;

/// <summary>One Learning Product as the workspace sees it.</summary>
public record LearningProductRow(
    Guid Id,
    string Title,
    string? Description,
    string? Category,
    IReadOnlyList<string> Tags,
    string Status,
    string Pacing,
    string EnrollmentMode,
    string? DefaultLanguage,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    DateTime? PublishedAt,
    /// <summary>Whether the product has a published Curriculum behind it (INV-006).</summary>
    bool HasCurriculum,
    /// <summary>
    /// Mirrors the product's Curriculum.RequiresSequentialCompletion (Curriculum
    /// Aggregate Design §18) — surfaced here so a tutor can set it from the same
    /// place they edit the product, rather than needing to open Content Studio.
    /// </summary>
    bool RequiresSequentialCompletion,
    /// <summary>The cover photo shown on this product's card, if one was uploaded.</summary>
    Guid? CoverImageAssetId);

public record LearningProductListResponse(
    string WorkspaceName,
    /// <summary>Whether the caller may create and edit, or only look.</summary>
    bool CanAuthor,
    IReadOnlyList<LearningProductRow> Products);

/// <summary>
/// Create or amend a Learning Product. Only a title is required — INV-004 makes
/// a bare Draft a valid, complete state, so a tutor can write down an idea
/// before deciding anything else about it.
/// </summary>
public record SaveLearningProductRequest(
    string Title,
    string? Description,
    string? Category,
    IReadOnlyList<string>? Tags,
    string? Pacing,
    string? EnrollmentMode,
    string? DefaultLanguage);

/// <summary>
/// What the AI needs to draft a description — exactly what a tutor has
/// already typed into the product form, whether or not the product has been
/// saved yet. Deliberately not keyed by product id: this works while
/// creating a brand-new product too, before any row exists to load.
/// </summary>
public record AiSuggestDescriptionRequest(string Title, string? Category, IReadOnlyList<string>? Tags);

public record AiSuggestDescriptionResponse(string Description);

/// <summary>Sets (or, with null, clears) a product's cover photo — a previously uploaded Learning Asset, by identifier.</summary>
public record AttachCoverImageRequest(Guid? LearningAssetId);
