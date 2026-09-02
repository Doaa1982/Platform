using Platform.Api.Models;

namespace Platform.Api.AI.Skills;

/// <summary>
/// AI Capability Architecture's document-extraction slice (PDF & Image Lesson
/// Content Extraction design proposal, EXT-006) — reads an uploaded PDF or
/// image resource and drafts the same five fields the ai-suggest-* Skills
/// draft individually (title, body, what-you'll-learn, learning objectives,
/// glossary), from the document's actual content instead of the tutor's
/// typed title/body/transcript.
///
/// One Skill handling both PDF and image rather than two separately
/// registered ones: the output contract and review UX are identical either
/// way, and which Claude content-block type wraps the bytes (document vs.
/// image) is already resolved by <see cref="AiAttachment.MediaType"/> at the
/// provider layer (see <c>ClaudeModelProvider.BuildContentBlocks</c>) — this
/// Skill needs no MIME-type branch of its own.
///
/// SkillId: <c>learning.extract_resource_content</c> (AISkillArchitecture
/// §15's dot-namespaced convention, sibling to <c>learning.generate_lesson</c>).
/// </summary>
public class ExtractLessonContentFromResourceSkill(AiOrchestrator orchestrator)
{
    public const string SkillId = "learning.extract_resource_content";

    private const string SystemPrompt = """
        You are the Learning Workspace Platform's AI content assistant for
        turning an uploaded document (a PDF or an image) into draft lesson
        content. You are given the document itself as an attachment. Your
        task is to read it and draft up to five fields for a tutor to
        review, edit, accept, or reject. Nothing you suggest is saved
        automatically.

        The five fields, each optional:
        - title: A short, specific lesson title reflecting the document's
          actual subject.
        - body: The learner-facing lesson material — the document's content,
          organized as a lesson (an opening that frames the topic, a
          logically organized core explanation, a short wrap-up), not a
          verbatim transcription and not a summary so brief it drops the
          teaching content.
        - whatYoullLearn: A short (~3 line) learner-facing preview of what
          the lesson teaches.
        - learningObjectives: Bloom's-taxonomy-style "Learners will be able
          to..." statements.
        - glossary: Key terms specific to this document and their one-line
          definitions, one "Term: Definition" per line.

        Rules:
        - Do not invent facts, claims, examples, explanations, terminology,
          or content the document does not support. Every field must be
          traceable to what is actually in the document.
        - If the document does not clearly support a field — e.g. it has no
          natural title, or offers nothing that reads as learning
          objectives — return null for that field rather than fabricating
          something to fill it in. A field left null is a normal, expected
          outcome, not an error.
        - If the document is blank, unreadable (e.g. a low-quality scan), or
          in a form you cannot extract meaningful content from at all,
          return null for every field. This is a valid result, not a
          failure — do not guess at content that might be there.
        - Write every field in the same language as the document.
        - Do not include meta-commentary about the AI, the extraction
          process, or the document's quality — only the lesson content
          itself.

        Respond with JSON only — no prose, no markdown code fences —
        matching exactly this shape:

        {
          "title": "string" | null,
          "body": "string" | null,
          "whatYoullLearn": "string" | null,
          "learningObjectives": "string" | null,
          "glossary": "string" | null
        }
        """;

    /// <summary>Same fields/rules/output contract as <see cref="SystemPrompt"/>, framed around pasted text instead of an attached document — used by <see cref="StructureFromTextAsync"/>.</summary>
    private const string TextSystemPrompt = """
        You are the Learning Workspace Platform's AI content assistant for
        turning source material a tutor pastes in (e.g. text copied out of a
        PDF or other document) into draft lesson content. Your task is to
        read the pasted text and draft up to five fields for a tutor to
        review, edit, accept, or reject. Nothing you suggest is saved
        automatically.

        The five fields, each optional:
        - title: A short, specific lesson title reflecting the pasted
          text's actual subject.
        - body: The learner-facing lesson material — the pasted text's
          content, organized as a lesson (an opening that frames the topic,
          a logically organized core explanation, a short wrap-up), not a
          verbatim transcription and not a summary so brief it drops the
          teaching content.
        - whatYoullLearn: A short (~3 line) learner-facing preview of what
          the lesson teaches.
        - learningObjectives: Bloom's-taxonomy-style "Learners will be able
          to..." statements.
        - glossary: Key terms specific to this text and their one-line
          definitions, one "Term: Definition" per line.

        Rules:
        - Do not invent facts, claims, examples, explanations, terminology,
          or content the pasted text does not support. Every field must be
          traceable to what is actually in the text.
        - If the text does not clearly support a field — e.g. it has no
          natural title, or offers nothing that reads as learning
          objectives — return null for that field rather than fabricating
          something to fill it in. A field left null is a normal, expected
          outcome, not an error.
        - If the pasted text is blank, garbled, or too sparse to draw
          meaningful content from at all, return null for every field. This
          is a valid result, not a failure — do not guess at content that
          might be there.
        - Write every field in the same language as the pasted text.
        - Do not include meta-commentary about the AI, the extraction
          process, or the text's quality — only the lesson content itself.

        Respond with JSON only — no prose, no markdown code fences —
        matching exactly this shape:

        {
          "title": "string" | null,
          "body": "string" | null,
          "whatYoullLearn": "string" | null,
          "learningObjectives": "string" | null,
          "glossary": "string" | null
        }
        """;

    public Task<ExtractResourceContentResponse> ExtractAsync(
        byte[] fileBytes, string mediaType, Guid workspaceId, CancellationToken ct = default)
    {
        const string userPrompt =
            "Extract this document's content into the lesson fields described above.";

        return orchestrator.RunAsync<ExtractResourceContentResponse>(
            SystemPrompt, userPrompt, workspaceId, AiSkillKeys.ExtractLessonContentFromResource,
            attachments: [new AiAttachment(fileBytes, mediaType)], band: EstimatePageCount(fileBytes, mediaType), ct: ct);
    }

    /// <summary>
    /// A page count for the credit-pricing band (SkillCreditCost's seeded
    /// (2, 25) / (unbounded, 60) rows, §A2) — this was never passed to
    /// RunAsync, so every extraction silently priced at the top (60-credit)
    /// tier regardless of actual size. A single image is always one page. A
    /// PDF's page count is estimated by counting "/Type/Page" object markers
    /// in the raw bytes (excluding "/Type/Pages", the parent tree node) — a
    /// common lightweight heuristic that avoids pulling in a full PDF-parsing
    /// library for a credit-pricing estimate. It can undercount a PDF that
    /// doesn't follow this convention, but that only ever falls toward the
    /// cheaper band — never an overcharge, which is the direction this fix
    /// cares about getting right.
    /// </summary>
    private static int EstimatePageCount(byte[] fileBytes, string mediaType)
    {
        if (!mediaType.Equals("application/pdf", StringComparison.OrdinalIgnoreCase)) return 1;

        var raw = System.Text.Encoding.Latin1.GetString(fileBytes);
        var pageCount = System.Text.RegularExpressions.Regex.Matches(raw, @"/Type\s*/Page(?!s)\b").Count;
        return Math.Max(pageCount, 1);
    }

    /// <summary>
    /// The manual-entry counterpart to <see cref="ExtractAsync"/>: a tutor
    /// pastes text themselves (e.g. copied out of a PDF reader) instead of
    /// letting AI read the file. This is a plain text-only model call — no
    /// attachment involved — so unlike <see cref="ExtractAsync"/> it works
    /// with every <see cref="IAiModelProvider"/>, including ones that don't
    /// implement the attachment overload (see the "does not support
    /// attachments" NotSupportedException it throws by default).
    /// </summary>
    public Task<ExtractResourceContentResponse> StructureFromTextAsync(
        string pastedText, Guid workspaceId, CancellationToken ct = default)
    {
        var userPrompt = $"""
            Turn the following pasted text into the lesson fields described
            above. The text was pasted in by the tutor, not read from a
            document by you directly — treat it exactly as you would the
            content of a document, applying the same rules.

            ---
            {pastedText}
            ---
            """;

        // Same pricing-band reasoning as ExtractAsync's EstimatePageCount —
        // pasted text has no literal page count, so this approximates one at
        // roughly 3,000 characters per page rather than always pricing at
        // the top tier.
        var band = Math.Max(1, (int)Math.Ceiling(pastedText.Length / 3000.0));

        return orchestrator.RunAsync<ExtractResourceContentResponse>(
            TextSystemPrompt, userPrompt, workspaceId, AiSkillKeys.ExtractLessonContentFromResource, band: band, ct: ct);
    }
}
