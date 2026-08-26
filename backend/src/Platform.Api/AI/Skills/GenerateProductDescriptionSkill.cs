namespace Platform.Api.AI.Skills;

/// <summary>
/// AI Capability Architecture §8's "Generate Description" capability, scoped
/// to Learning Product listings (Learning Product Aggregate Design §8's
/// Description metadata field). Gated by CapabilityDomain.Learning — the
/// same domain the product's own Learning capability profile already uses
/// (Licensing &amp; Entitlement Architecture), rather than inventing a new key.
///
/// Deliberately takes only what a tutor has already typed — title, category,
/// tags — and nothing from the database, so it works identically while
/// creating a brand-new product (nothing saved yet) or editing an existing
/// one.
/// </summary>
public class GenerateProductDescriptionSkill(AiOrchestrator orchestrator)
{
    private const string SystemPrompt = """
        You are the Learning Workspace Platform's AI content assistant.
        Given a course/programme's title, its category, and its tags, write
        one short marketing description for its listing page.

        Rules:
        - One to two sentences. No more.
        - Say who it's for and what they'll come away with — not generic
          hype ("amazing", "unlock your potential").
        - Do not invent specific facts not implied by the title/category/tags
          (no fake instructor names, no fabricated statistics, no promises
          about duration or price).
        - Plain text only. No markdown, no quotation marks around the output.
        """;

    public async Task<string> SuggestAsync(
        string title, string? category, IReadOnlyList<string>? tags, Guid workspaceId, CancellationToken ct = default)
    {
        var userPrompt = $"""
            Title: {title}
            Category: {(string.IsNullOrWhiteSpace(category) ? "(not set)" : category)}
            Tags: {(tags is { Count: > 0 } ? string.Join(", ", tags) : "(none)")}
            """;

        var description = await orchestrator.RunTextAsync(SystemPrompt, userPrompt, workspaceId, AiSkillKeys.GenerateProductDescription, ct: ct);
        return description.Trim().Trim('"');
    }
}
