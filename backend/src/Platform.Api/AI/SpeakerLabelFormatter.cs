using System.Text.RegularExpressions;

namespace Platform.Api.AI;

/// <summary>
/// Canonicalizes every provider's speaker-diarization label to "S1: ", "S2: ", etc., one per
/// line — the single shape every downstream reader (ContentStudioScreen's transcript panel,
/// EnhanceTranscriptSkill's prompt, any future text-based AI skill over LessonRevision.Transcript)
/// can rely on, regardless of which provider actually produced the text.
///
/// Needed because providers don't agree on the raw label shape: Speechmatics' own format=txt
/// diarization output and Gemini's prompted-but-not-strictly-guaranteed output have both been
/// seen, in practice, as "SPEAKER: S1:", "SPEAKER S1:", and "SPEAKER_S1:" — DeepgramTranscriptionProvider
/// builds its label in Platform code already in the canonical shape, so normalizing it here too is
/// a harmless no-op rather than a special case to carve out.
/// </summary>
public static partial class SpeakerLabelFormatter
{
    [GeneratedRegex(@"^SPEAKER[:_\s]+S?(\d+)\s*:\s*", RegexOptions.Multiline | RegexOptions.IgnoreCase)]
    private static partial Regex LabelPattern();

    public static string Normalize(string transcript) =>
        string.IsNullOrEmpty(transcript) ? transcript : LabelPattern().Replace(transcript, "S$1: ");
}
