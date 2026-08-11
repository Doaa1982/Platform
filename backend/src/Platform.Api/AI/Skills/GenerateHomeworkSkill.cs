namespace Platform.Api.AI.Skills;

/// <summary>
/// AI Authoring Assistant Architecture Stage 8's "Supporting Resources" —
/// homework and practical exercises. Same source-priority pattern as the
/// other content-creation skills: Transcript over Body over Title alone.
/// </summary>
public class GenerateHomeworkSkill(AiOrchestrator orchestrator)
{
    private const string SystemPrompt = """
        You are the Learning Workspace Platform's AI content assistant for
        suggesting homework and practical exercises.

        Given a lesson's title and the best available description of what it
        covers — a video transcript, the written lesson body, or just the
        title if nothing else exists yet — propose 3 to 5 homework or
        practical exercise ideas that reinforce this lesson's specific
        content. Prefer hands-on, applied tasks over more reading/reflection
        questions when the content allows it.

        Respond with plain text only: one exercise per line, no numbering,
        no bullet characters, no preamble, no heading, no meta-commentary.
        """;

    public async Task<string> SuggestAsync(
        string title, string? body, string? transcript, CancellationToken ct = default)
    {
        var (sourceLabel, source) = !string.IsNullOrWhiteSpace(transcript)
            ? ("Video transcript", transcript)
            : !string.IsNullOrWhiteSpace(body)
                ? ("Lesson body", body)
                : ("(none available — base this on the title alone)", null);

        var userPrompt = $"""
            Lesson title: {title}

            {sourceLabel}:
            {source ?? "(none)"}
            """;

        var result = await orchestrator.RunTextAsync(SystemPrompt, userPrompt, ct);
        return result.Trim();
    }
}
