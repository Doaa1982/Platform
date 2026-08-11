namespace Platform.Api.AI.Skills;

/// <summary>
/// AI Capability Architecture §8's "Generate Glossary"/"Generate Keywords"
/// content-creation capabilities, combined into one skill — a glossary
/// entry inherently includes its keyword. Same source-priority pattern as
/// GenerateWhatYoullLearnSkill and GenerateLearningObjectivesSkill:
/// Transcript over Body over Title alone.
///
/// Stored as plain "Term: Definition" lines (LessonRevision.Glossary), not
/// structured JSON — same reasoning as WhatYoullLearn/LearningObjectives
/// staying plain text: no independent lifecycle per term, and it keeps the
/// tutor's edit surface a single textarea instead of an add/remove-row UI.
/// </summary>
public class GenerateGlossarySkill(AiOrchestrator orchestrator)
{
    private const string SystemPrompt = """
        You are the Learning Workspace Platform's AI content assistant for
        extracting a glossary of key terms from a lesson.

        Given a lesson's title and the best available description of what it
        covers — a video transcript, the written lesson body, or just the
        title if nothing else exists yet — identify 5 to 10 key terms a
        learner would need to know, specific to this lesson's actual
        content, not generic vocabulary.

        Respond with plain text only: one term per line, in the exact format
        "Term: one-sentence definition", no numbering, no bullet characters,
        no preamble, no heading, no meta-commentary.
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
