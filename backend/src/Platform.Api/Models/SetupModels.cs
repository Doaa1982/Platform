namespace Platform.Api.Models;

/// <summary>
/// The Owner's view of their Workspace setup.
///
/// Completeness is derived on every read, never stored (Workspace Setup
/// Business Analysis, BA-005): a stored flag can disagree with the data it
/// summarises and then has to be repaired, while a question asked of current
/// state cannot drift.
/// </summary>
public record WorkspaceSetupResponse(
    Guid WorkspaceId,
    string Name,
    string Slug,
    string? Description,
    string Status,
    /// <summary>Whether the caller may change any of this, or only look.</summary>
    bool CanManage,
    /// <summary>
    /// Whether strangers may ask to join (Join Request Business Analysis, BA-005).
    /// Off by default; independent of the lifecycle.
    /// </summary>
    bool AcceptsJoinRequests,
    SetupCompleteness Completeness,
    /// <summary>The single transition available now, or null when there is none.</summary>
    string? NextTransition,
    /// <summary>Why NextTransition is unavailable, when something blocks it.</summary>
    string? Blocker,
    Guid? LogoAssetId,
    string? WelcomeMessage,
    IReadOnlyList<string> CourseCategories);

/// <summary>Amend the Workspace's public-facing profile — logo, welcome message and taught subject areas.</summary>
public record UpdateWorkspaceBrandingRequest(Guid? LogoAssetId, string? WelcomeMessage, IReadOnlyList<string>? CourseCategories);

/// <summary>What a tutor has already typed into the branding form, for the AI to draft a listing description from.</summary>
public record AiSuggestWorkspaceDescriptionRequest(string Name, IReadOnlyList<string>? CourseCategories);

/// <summary>What a tutor has already typed into the branding form, for the AI to draft a welcome message from.</summary>
public record AiSuggestWorkspaceWelcomeRequest(string Name, string? Description, IReadOnlyList<string>? CourseCategories);

public record AiSuggestTextResponse(string Text);

/// <summary>
/// What INV-007 asks of a Workspace before it may be published.
///
/// Addressability is reported separately from identity because INV-007 names
/// them separately — and because only one of the two can currently be enforced
/// as written (BA-003).
/// </summary>
public record SetupCompleteness(
    bool HasName,
    bool HasPublicIdentifier,
    bool HasDescription,
    bool IsAddressable,
    bool ReadyToPublish);

/// <summary>Amend the Workspace Identity value object (Workspace Aggregate Design §8).</summary>
public record UpdateWorkspaceIdentityRequest(string Name, string Slug, string? Description);

/// <summary>Open or close the Workspace to unsolicited join requests.</summary>
public record SetJoinRequestsRequest(bool Accepts);
