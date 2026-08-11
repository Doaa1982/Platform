namespace Platform.Api.AI.Skills;

/// <summary>
/// AI Capability Architecture §8's "Generate Lesson Title" content-creation
/// capability. Unlike GenerateLessonBodySkill's "empty vs. non-empty" split,
/// a lesson always has *some* title by the time a tutor is in the editor
/// (required at creation) — so this skill's job isn't "fill a blank field",
/// it's "propose a sharper title than whatever placeholder is there now,"
/// grounded in what the lesson actually teaches rather than in the current
/// title itself.
///
/// Source priority: Body, then Transcript if no body exists yet (richer than
/// nothing, thinner than written content a tutor authored on purpose) — the
/// current title is passed along only as a weak hint of intent, never as the
/// primary source, since a placeholder title carries little real information.
/// </summary>
public class GenerateLessonTitleSkill(AiOrchestrator orchestrator)
{
    private const string SystemPrompt = """
        You are the Learning Workspace Platform's AI content assistant for
        writing lesson titles.

        You are given a lesson's current title (which may just be a rough
        placeholder) and the best available description of what the lesson
        actually covers — its written body, or a video transcript if no body
        exists yet.

        Propose one improved title: concise (aim for well under 10 words), a
        short descriptive phrase rather than a full sentence, specific to
        this lesson's actual content rather than generic, and free of
        clickbait or filler words like "Ultimate" or "Complete Guide" unless
        the content genuinely warrants them. Do not wrap the title in quotes.
        Respond with the title text only — no preamble, no explanation, no
        markdown.
        """;

    public async Task<string> SuggestAsync(
        string? currentTitle, string? body, string? transcript, CancellationToken ct = default)
    {
        var (sourceLabel, source) = !string.IsNullOrWhiteSpace(body)
            ? ("Lesson body", body)
            : !string.IsNullOrWhiteSpace(transcript)
                ? ("Video transcript", transcript)
                : ("(none available — base this on the current title alone)", null);

        var userPrompt = $"""
            Current title: {(string.IsNullOrWhiteSpace(currentTitle) ? "(none yet)" : currentTitle)}

            {sourceLabel}:
            {source ?? "(none)"}
            """;

        var title = await orchestrator.RunTextAsync(SystemPrompt, userPrompt, ct);
        return title.Trim().Trim('"');
    }
}
