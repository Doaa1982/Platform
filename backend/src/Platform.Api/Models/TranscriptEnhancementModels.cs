using System.Text.Json.Serialization;

namespace Platform.Api.Models;

/// <summary>
/// The exact structured-JSON shape EnhanceTranscriptSkill's system prompt
/// requires from the model. Deliberately mirrors the model's own vocabulary
/// (camelCase JSON property names) rather than this codebase's usual C#
/// naming — these records exist only to deserialize/validate the LLM's raw
/// response, not to be a general-purpose domain shape.
/// </summary>
public record TranscriptEnhancementLlmResult(
    [property: JsonPropertyName("enhancedTranscript")] string? EnhancedTranscript,
    [property: JsonPropertyName("segments")] List<TranscriptEnhancementSegment>? Segments,
    [property: JsonPropertyName("reviewItems")] List<TranscriptEnhancementReviewItem>? ReviewItems,
    [property: JsonPropertyName("preservationChecks")] TranscriptEnhancementPreservationChecks? PreservationChecks);

/// <summary>One segment's before/after, only present when the model could confidently ground its edits in real segment boundaries — see the system prompt's instruction not to fabricate segmentId/timestamps when none exist in the input.</summary>
public record TranscriptEnhancementSegment(
    [property: JsonPropertyName("segmentId")] string? SegmentId,
    [property: JsonPropertyName("startSeconds")] double? StartSeconds,
    [property: JsonPropertyName("endSeconds")] double? EndSeconds,
    [property: JsonPropertyName("speaker")] string? Speaker,
    [property: JsonPropertyName("originalText")] string? OriginalText,
    [property: JsonPropertyName("enhancedText")] string? EnhancedText,
    [property: JsonPropertyName("status")] string? Status,
    [property: JsonPropertyName("confidence")] string? Confidence,
    [property: JsonPropertyName("reason")] string? Reason,
    [property: JsonPropertyName("requiresReview")] bool RequiresReview);

/// <summary>A specific thing the model itself flagged as needing a human look — distinct from a hard validation failure; the enhancement is still saved.</summary>
public record TranscriptEnhancementReviewItem(
    [property: JsonPropertyName("segmentId")] string? SegmentId,
    [property: JsonPropertyName("issue")] string? Issue,
    [property: JsonPropertyName("originalText")] string? OriginalText,
    [property: JsonPropertyName("reason")] string? Reason);

/// <summary>The model's own self-reported preservation checks — one input (not the only one) to whether the result lands on Ready or ReviewRequired; see TranscriptEnhancementValidator for the independent, code-based checks run alongside it.</summary>
public record TranscriptEnhancementPreservationChecks(
    [property: JsonPropertyName("numbersPreserved")] bool NumbersPreserved,
    [property: JsonPropertyName("variablesPreserved")] bool VariablesPreserved,
    [property: JsonPropertyName("formulasPreserved")] bool FormulasPreserved,
    [property: JsonPropertyName("methodologyPreserved")] bool MethodologyPreserved,
    [property: JsonPropertyName("sequencePreserved")] bool SequencePreserved,
    [property: JsonPropertyName("uncertaintiesMarked")] bool UncertaintiesMarked);
