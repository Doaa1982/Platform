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

        Your task is to identify the most important terms, concepts, names,
        expressions, or vocabulary that a learner needs to understand this
        specific lesson.

        The glossary is a suggestion for the tutor to review, edit, accept, or
        remove. It is not automatically published to students.

        SOURCE PRIORITY

        Use the best available lesson information in this order:

        1. Timestamped video transcript, when available
        2. Written lesson content, when available
        3. Lesson title, only when no meaningful lesson content is available

        When multiple sources are available, use them together.

        The glossary must be grounded in the actual lesson content.

        TERM SELECTION

        Select terms that are genuinely important for understanding the lesson.

        Prefer terms that are:

        - explicitly introduced or explained in the lesson
        - repeatedly used in the lesson
        - central to the lesson's main concepts
        - necessary to understand the procedures, examples, or explanations
        - important subject-specific vocabulary introduced by the lesson

        Do not select words merely because they are related to the lesson topic.

        Do not add terminology from general world knowledge that is not present
        or clearly supported by the lesson.

        Do not try to make the glossary comprehensive.

        Prioritize the most instructionally important terms.

        Avoid including:

        - common everyday words that require no explanation
        - generic academic words such as "example", "important", or "process"
          unless the lesson gives them a specific subject meaning
        - terms that appear only incidentally and are not important to the lesson
        - duplicate terms or multiple entries for the same concept
        - concepts that are not taught or supported by the lesson

        NUMBER OF TERMS

        Generate between 5 and 10 terms when the lesson contains enough
        meaningful terminology.

        If the lesson contains fewer than 5 genuinely important terms, return
        fewer rather than inventing additional terms.

        Do not generate more than 10 terms.

        DEFINITIONS

        Write a concise, learner-friendly, one-sentence definition for each term.

        The definition must reflect the meaning of the term as it is used in
        this lesson.

        Prefer the lesson's own terminology and framing when it provides a clear
        definition.

        Do not introduce information that is not supported by the lesson.

        Do not make definitions unnecessarily technical when the lesson itself
        uses simpler language.

        Do not merely repeat the term in the definition.

        If the lesson gives a specific meaning to a term that differs from a
        common everyday meaning, use the lesson's meaning.

        LANGUAGE

        Use the same language as the lesson unless the requested output
        language is explicitly provided.

        Preserve important technical terms in their original form when
        appropriate.

        For language-learning lessons, preserve the target-language term and
        provide the definition in the language appropriate for the learner.

        OUTPUT RULES

        Return plain text only.

        Return exactly one glossary entry per line.

        Every line must use exactly this format:

        Term: one-sentence definition

        Do not use:

        - numbering
        - bullet characters
        - headings
        - introductory text
        - concluding text
        - explanations about how the terms were selected
        - metadata
        - timestamps
        - citations
        - multiple definitions for one term

        Do not place the term on a separate line from its definition.

        The output should be concise and suitable for direct display in the
        tutor's glossary-generation interface.
        """;

    public async Task<string> SuggestAsync(
        string title, string? body, string? transcript, string? outputLanguage, CancellationToken ct = default)
    {
        var (sourceLabel, source) = !string.IsNullOrWhiteSpace(transcript)
            ? ("Video transcript", transcript)
            : !string.IsNullOrWhiteSpace(body)
                ? ("Lesson body", body)
                : ("(none available — base this on the title alone)", null);

        var languageDirective = string.IsNullOrWhiteSpace(outputLanguage)
            ? ""
            : $"Output language: {outputLanguage}\n\n";

        var userPrompt = languageDirective + $"""
            Lesson title: {title}

            {sourceLabel}:
            {source ?? "(none)"}
            """;

        var result = await orchestrator.RunTextAsync(SystemPrompt, userPrompt, ct);
        return result.Trim();
    }
}
