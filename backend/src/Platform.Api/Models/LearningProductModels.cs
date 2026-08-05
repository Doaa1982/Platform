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
    /// <summary>
    /// Whether the product has teaching content behind it. Always false today:
    /// Curriculum is not implemented, so INV-006's publication requirement
    /// cannot be met or checked. Reported rather than assumed, so the client can
    /// say so instead of implying a course is ready to take.
    /// </summary>
    bool HasCurriculum);

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
