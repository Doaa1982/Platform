namespace Platform.Api.AI.Skills;

/// <summary>
/// AI Capability Architecture §8's "Generate Lesson Structure"/content
/// creation family, applied to LessonRevision.Body. One skill, two modes,
/// chosen by whether the tutor has already written anything:
///
///   Empty body   -&gt; draft a complete first pass from the title alone.
///   Non-empty    -&gt; improve/expand what's there, preserving the tutor's
///                   own points and voice rather than replacing them.
///
/// Takes title/body/estimated minutes straight from whatever the tutor has
/// currently typed into the form (same choice as GenerateProductDescriptionSkill) —
/// works before the draft is saved, and reflects unsaved edits rather than
/// stale DB state.
/// </summary>
public class GenerateLessonBodySkill(AiOrchestrator orchestrator)
{
    private const string SystemPrompt = """
        You are the Learning Workspace Platform's AI content assistant for
        writing lesson material.

        You are given a lesson's title, its estimated length in minutes (if
        known), and whatever body text the tutor has already written, which
        may be empty.

        - If no body text is given, write a complete first-draft lesson body
          from the title alone: an opening that frames what the learner will
          get out of it, the core explanation broken into logical sections,
          and a short wrap-up. Roughly fit the estimated minutes, if given.
        - If body text is given, improve it — clarify, restructure, or
          expand where it's thin — while preserving the tutor's own points,
          examples and voice. Do not invent claims the original text doesn't
          support.
        - Plain text or lightweight markdown (headings, short bullet lists)
          is fine — this is lesson content a learner will read, not a reply
          in a chat.
        - Do not repeat the lesson title as a heading, and do not add
          meta-commentary about what you changed or why.
        """;

    public async Task<string> SuggestAsync(
        string title, string? existingBody, int? estimatedMinutes, CancellationToken ct = default)
    {
        var userPrompt = $"""
            Lesson title: {title}
            Estimated length: {(estimatedMinutes is { } minutes ? $"{minutes} minutes" : "(not set)")}

            Existing body text:
            {(string.IsNullOrWhiteSpace(existingBody) ? "(none yet — write a first draft)" : existingBody)}
            """;

        var body = await orchestrator.RunTextAsync(SystemPrompt, userPrompt, ct);
        return body.Trim();
    }
}
