using System.Text.RegularExpressions;
using Platform.Api.Models;

namespace Platform.Api.AI;

/// <summary>
/// Independent, code-based safety net run in addition to (never instead of)
/// the model's own self-reported <see cref="TranscriptEnhancementPreservationChecks"/>.
/// The model is trusted to try; it is never trusted to grade its own work —
/// per the task this codebase implements this for, "the system never treats
/// an LLM-generated answer as mathematically verified."
///
/// Deliberately conservative: every check here is a coarse, whole-document
/// multiset comparison, not a semantic understanding of the transcript's
/// mathematics. A false positive (flagging a genuinely safe edit for review)
/// costs a tutor one extra glance; a false negative (silently letting a
/// changed "B1" become "B2" through) can corrupt a real lesson's content.
/// Bias accordingly — see each method's own reasoning.
/// </summary>
public static class TranscriptEnhancementValidator
{
    /// <summary>
    /// If the enhanced transcript is shorter than this fraction of the raw
    /// transcript's length, treat it as a likely summarization rather than an
    /// edit — the system prompt explicitly forbids summarizing, but a model
    /// can still drift toward it under length pressure.
    /// </summary>
    private const double MinLengthRatio = 0.5;

    private static readonly Regex NumberPattern = new(@"\d+(?:\.\d+)?", RegexOptions.Compiled);

    /// <summary>
    /// Point/variable-label-shaped tokens — 1-3 uppercase letters optionally
    /// followed by 1-2 digits (A, B, AB, B1, B2, CD, ...). Deliberately
    /// restricted to uppercase: this transcript format already renders real
    /// math labels capitalized (confirmed against real production
    /// transcripts), and a case-insensitive version would flag essentially
    /// every short English word as a "changed variable," making the check
    /// useless. This trades recall (a lowercase label change could slip
    /// through) for precision (not drowning every real flag in noise) —
    /// documented, not accidental.
    /// </summary>
    private static readonly Regex VariableTokenPattern = new(@"\b[A-Z]{1,3}\d{0,2}\b", RegexOptions.Compiled);

    public record ValidationResult(bool RequiresReview, IReadOnlyList<string> Reasons)
    {
        public static ValidationResult Ok() => new(false, []);
    }

    /// <summary>
    /// Runs every conservative check against one enhancement result. Never
    /// throws for a "bad" result — an enhancement that fails these checks is
    /// still saved (per the task: "if the enhancement is not safer than the
    /// original, retain the original" is the model's own job; this validator's
    /// job is only to decide Ready vs ReviewRequired, not to silently discard
    /// output a tutor might still want to read). A missing/empty
    /// <paramref name="rawTranscript"/> or <paramref name="result"/> with no
    /// <see cref="TranscriptEnhancementLlmResult.EnhancedTranscript"/> is the
    /// caller's responsibility to reject before calling this — see
    /// EnhanceTranscriptSkill's own `isValid`.
    /// </summary>
    public static ValidationResult Validate(string rawTranscript, TranscriptEnhancementLlmResult result)
    {
        var reasons = new List<string>();
        var enhanced = result.EnhancedTranscript ?? "";

        if (enhanced.Length < rawTranscript.Length * MinLengthRatio)
        {
            reasons.Add(
                $"The enhanced transcript ({enhanced.Length} characters) is under {MinLengthRatio:P0} the length " +
                $"of the raw transcript ({rawTranscript.Length} characters) — this looks like summarization, which is not permitted.");
        }

        reasons.AddRange(CompareTokenMultisets(rawTranscript, enhanced, NumberPattern, "number"));
        reasons.AddRange(CompareTokenMultisets(rawTranscript, enhanced, VariableTokenPattern, "variable/point label"));

        if (result.PreservationChecks is { } checks)
        {
            if (!checks.NumbersPreserved) reasons.Add("The model itself reported numbersPreserved: false.");
            if (!checks.VariablesPreserved) reasons.Add("The model itself reported variablesPreserved: false.");
            if (!checks.FormulasPreserved) reasons.Add("The model itself reported formulasPreserved: false.");
            if (!checks.MethodologyPreserved) reasons.Add("The model itself reported methodologyPreserved: false.");
            if (!checks.SequencePreserved) reasons.Add("The model itself reported sequencePreserved: false.");
        }
        else
        {
            reasons.Add("The model did not return a preservationChecks object.");
        }

        if (result.ReviewItems is { Count: > 0 } reviewItems)
            reasons.Add($"The model flagged {reviewItems.Count} review item(s) itself.");

        if (result.Segments is { Count: > 0 } segments)
        {
            var flaggedSegments = segments.Count(s => s.RequiresReview);
            if (flaggedSegments > 0)
                reasons.Add($"{flaggedSegments} of {segments.Count} segment(s) were marked requiresReview by the model.");
        }

        return reasons.Count > 0 ? new ValidationResult(true, reasons) : ValidationResult.Ok();
    }

    /// <summary>
    /// Order-insensitive count comparison: not just "does every original token
    /// still appear somewhere," but "does it appear the same number of times."
    /// A token that vanished, one that was added, or one whose count changed
    /// (e.g. a repeated "26" becoming a single "26") are all reported —
    /// silence here means the multiset was exactly preserved, not merely that
    /// no token was completely deleted.
    /// </summary>
    private static IEnumerable<string> CompareTokenMultisets(string original, string enhanced, Regex pattern, string label)
    {
        var originalCounts = CountTokens(original, pattern);
        var enhancedCounts = CountTokens(enhanced, pattern);

        var allTokens = originalCounts.Keys.Union(enhancedCounts.Keys);
        foreach (var token in allTokens.OrderBy(t => t, StringComparer.Ordinal))
        {
            var before = originalCounts.GetValueOrDefault(token);
            var after = enhancedCounts.GetValueOrDefault(token);
            if (before == after) continue;

            yield return before > after
                ? $"{label} \"{token}\" appears {before} time(s) in the raw transcript but only {after} time(s) in the enhanced version."
                : $"{label} \"{token}\" appears {after} time(s) in the enhanced transcript but only {before} time(s) in the raw version.";
        }
    }

    private static Dictionary<string, int> CountTokens(string text, Regex pattern)
    {
        var counts = new Dictionary<string, int>(StringComparer.Ordinal);
        foreach (Match m in pattern.Matches(text))
            counts[m.Value] = counts.GetValueOrDefault(m.Value) + 1;
        return counts;
    }
}
