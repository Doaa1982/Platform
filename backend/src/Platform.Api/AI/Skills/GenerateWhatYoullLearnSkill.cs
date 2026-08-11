namespace Platform.Api.AI.Skills;

/// <summary>
/// A short, learner-facing preview shown before a learner starts a lesson —
/// deliberately narrower than the "Generate Learning Objectives" family in AI
/// Capability Architecture §9 (formal, Bloom's-taxonomy-style outcome
/// statements aimed at the tutor's own instructional design). This skill only
/// produces the ~3-line teaser a prospective learner sees on the lesson
/// itself, not the tutor-facing objectives capability — see "AI 'What You'll
/// Learn' - Implementation Plan" §1.
///
/// Picks the best available source, closest to what's actually taught first:
///
///   Transcript ready -&gt; base it on the real video content.
///   No transcript     -&gt; fall back to the lesson body.
///   Neither           -&gt; fall back to the title alone.
///
/// Same "take whatever the tutor currently has, unsaved or not" choice as
/// GenerateLessonBodySkill and GenerateProductDescriptionSkill.
/// </summary>
public class GenerateWhatYoullLearnSkill(AiOrchestrator orchestrator)
{
    private const string SystemPrompt = """
        You are the Learning Workspace Platform's AI content assistant for
        writing a short learner-facing preview of a lesson.

        You are given a lesson's title and the best available description of
        what it actually covers — either the video's transcript, the
        written lesson body, or just the title alone if nothing else exists
        yet.

        Write exactly 3 short lines telling a prospective learner what
        they'll learn or be able to do after completing this lesson. Each
        line should be concrete and specific to this lesson's actual
        content, not generic filler. Write in plain text, one line per
        sentence or short phrase, no numbering, no bullet characters, no
        preamble, no heading, no meta-commentary. Just the 3 lines.
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
