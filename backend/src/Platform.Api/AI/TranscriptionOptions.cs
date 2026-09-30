namespace Platform.Api.AI;

/// <summary>
/// Which speech-to-text vendor is active. Bound from the "Transcription"
/// section of appsettings — same provider-switch pattern as
/// <see cref="AiOptions"/>. Vendor-specific settings (API keys, base URLs,
/// model names) live in their own options class (<see cref="DeepgramOptions"/>,
/// <see cref="SpeechmaticsOptions"/>, <see cref="FasterWhisperOptions"/>),
/// since a setting from one vendor is meaningless to another.
/// </summary>
public class TranscriptionOptions
{
    public const string Section = "Transcription";

    /// <summary>
    /// "Deepgram" (default as of 2026-09-11 — hosted, used in production),
    /// "Speechmatics" (the previous hosted default — kept fully selectable
    /// for rollback, see Program.cs's branching on this value), "Gemini"
    /// (Gemini 2.5 Flash listening to the audio/video directly instead of a
    /// dedicated ASR engine — see <see cref="GeminiTranscriptionProvider"/>),
    /// or "FasterWhisper"/"LocalWhisper" (local, no API key or billing — used
    /// in development).
    /// </summary>
    public string Provider { get; set; } = "Deepgram";

    /// <summary>
    /// How many times AiSkillKeys.GenerateTranscript's flat credit price is charged for a
    /// TranscriptionInputMode.VideoLowRes attempt instead of Audio's 1x — a live config value,
    /// not a second seeded SkillCreditCost row, so tuning it takes effect on the very next
    /// charge (see CreditLedgerService.TryDebitExactAsync). Default 3: a video call to Gemini
    /// carries materially more request tokens (whole frames, not just an audio track) than an
    /// audio-only call — this is a starting estimate, not a measured ratio; the transcript-vs-
    /// transcript real-lesson comparison this feature shipped with is where an actual measured
    /// ratio would come from, if one turns out to be needed.
    /// </summary>
    public int VideoLowResCostMultiplier { get; set; } = 3;
}
