namespace Platform.Api.AI;

/// <summary>
/// Configuration for the Deepgram transcription provider — the hosted
/// production default as of 2026-09-11, replacing <see cref="SpeechmaticsOptions"/>
/// in that role. Speechmatics itself is left fully wired up and selectable
/// (Transcription:Provider = "Speechmatics" — see Program.cs's provider
/// switch) rather than removed, so it can be switched back to without
/// rebuilding anything if Deepgram needs to be rolled back.
/// </summary>
public class DeepgramOptions
{
    public const string Section = "Deepgram";

    public string ApiKey { get; set; } = string.Empty;

    /// <summary>Deepgram's current flagship model — highest accuracy across its supported languages, including Arabic.</summary>
    public string Model { get; set; } = "nova-3";

    /// <summary>
    /// "auto" (default) uses Deepgram's own language detection
    /// (<c>detect_language=true</c>) — like Speechmatics' Automatic Language
    /// Identification, this picks ONE dominant language for the whole file,
    /// not per-utterance code-switching. "en"/"ar" pin a single language
    /// instead (same tradeoffs as pinning ever had under Speechmatics: the
    /// other language's words come back as phonetic approximations rather
    /// than failing loudly).
    ///
    /// IMPORTANT — checked 2026-09-11: Deepgram's documented multilingual
    /// code-switching mode (<c>language=multi</c> on Nova-3) lists English,
    /// Spanish, French, German, Hindi, Russian, Portuguese, Japanese,
    /// Italian, and Dutch. Arabic is NOT in that list. So unlike the
    /// ar_en-pack / melia-1 fix identified for Speechmatics (see
    /// docs/audits/Speechmatics-Arabic-English-Codeswitching-Research.md),
    /// Deepgram currently has no documented equivalent for genuine
    /// Arabic+English code-switching within one job — this "auto" default
    /// carries the same single-dominant-language risk Speechmatics' ALI had.
    /// Re-verify against Deepgram's current docs (or ask Deepgram support)
    /// before treating an Arabic-dominant, English-code-switched lesson video
    /// as solved by switching providers alone.
    /// </summary>
    public string Language { get; set; } = "auto";
}
