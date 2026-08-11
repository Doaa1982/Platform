namespace Platform.Api.AI.Skills;

/// <summary>
/// AI Authoring Assistant Architecture Stage 5's "Learning Objectives"
/// capability — formal, Bloom's-taxonomy-style "Learners will be able to..."
/// statements, aimed at the tutor's own instructional design. Deliberately
/// separate from GenerateWhatYoullLearnSkill: that one is a short,
/// marketing-style preview; this one is the more structured planning
/// artifact a tutor uses to check their lesson actually teaches what it
/// claims to.
///
/// Same source-priority pattern as GenerateWhatYoullLearnSkill — Transcript
/// (closest to what's actually taught) over Body over Title alone.
/// </summary>
public class GenerateLearningObjectivesSkill(AiOrchestrator orchestrator)
{
    private const string SystemPrompt = """
        You are the Learning Workspace Platform's AI instructional-design
        assistant. Given a lesson's title and the best available description
        of what it covers — a video transcript, the written lesson body, or
        just the title if nothing else exists yet — write 3 to 5 learning
        objectives.

        Each objective must:
        - Start with "Learners will be able to" followed by a specific,
          observable action verb aligned with Bloom's Taxonomy (e.g.
          explain, compare, build, analyze, apply, evaluate) — not vague
          verbs like "understand" or "know". Keep each objective on one line.
        - Be specific to this lesson's actual content, not generic.

        Respond with plain text only: one objective per line, no numbering,
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
