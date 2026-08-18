namespace Platform.Api.AI.Skills;

/// <summary>
/// AI Capability Architecture §8's "Generate Description" capability, scoped
/// to the Workspace's own public profile (Workspace Setup Business Analysis
/// §3's "Branding") — gated by CapabilityDomain.Branding, not Learning, since
/// this is the academy's own identity rather than any one Learning Product's.
///
/// Deliberately takes only what a tutor has already typed — name, course
/// categories, and (for the welcome message) the description too — so it
/// works while still filling in the branding form for the first time.
/// </summary>
public class GenerateWorkspaceProfileSkill(AiOrchestrator orchestrator)
{
    private const string DescriptionSystemPrompt = """
        You are the Learning Workspace Platform's AI content assistant.
        Given an academy's name and the subject categories it teaches, write
        one short listing description for its public profile.

        Rules:
        - One to two sentences. No more.
        - Say what the academy teaches and who it's for — not generic hype
          ("amazing", "unlock your potential").
        - Do not invent specific facts not implied by the name/categories (no
          fake instructor names, no fabricated statistics, no promises about
          price, duration or credentials).
        - Plain text only. No markdown, no quotation marks around the output.
        """;

    private const string WelcomeSystemPrompt = """
        You are the Learning Workspace Platform's AI content assistant.
        Given an academy's name, its listing description, and the subject
        categories it teaches, write one short welcome message greeting a
        prospective student meeting this academy for the first time (e.g. on
        a "request to join" page).

        Rules:
        - One to two sentences. Warm and direct, second person ("you"),
          addressed to the prospective student.
        - Distinct from a listing description: this is a greeting, not a
          summary — it should read like the tutor is speaking directly to them.
        - Do not invent specific facts not implied by the inputs (no fake
          instructor names, no fabricated statistics, no promises about
          price, duration or credentials).
        - Plain text only. No markdown, no quotation marks around the output.
        """;

    public async Task<string> SuggestDescriptionAsync(
        string name, IReadOnlyList<string>? courseCategories, CancellationToken ct = default)
    {
        var userPrompt = $"""
            Academy name: {name}
            Course categories: {(courseCategories is { Count: > 0 } ? string.Join(", ", courseCategories) : "(none)")}
            """;

        var description = await orchestrator.RunTextAsync(DescriptionSystemPrompt, userPrompt, ct);
        return description.Trim().Trim('"');
    }

    public async Task<string> SuggestWelcomeMessageAsync(
        string name, string? description, IReadOnlyList<string>? courseCategories, CancellationToken ct = default)
    {
        var userPrompt = $"""
            Academy name: {name}
            Listing description: {(string.IsNullOrWhiteSpace(description) ? "(not set)" : description)}
            Course categories: {(courseCategories is { Count: > 0 } ? string.Join(", ", courseCategories) : "(none)")}
            """;

        var welcome = await orchestrator.RunTextAsync(WelcomeSystemPrompt, userPrompt, ct);
        return welcome.Trim().Trim('"');
    }
}
