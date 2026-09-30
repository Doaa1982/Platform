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

    /// <summary>
    /// The ffmpeg executable used for TranscriptionInputMode.Audio's audio extraction
    /// (AudioExtractor.cs). Three shapes, resolved by AudioExtractor.ResolveExecutablePath:
    /// a bare name with no path separator (default "ffmpeg") is resolved from PATH by the OS —
    /// works in Development after `brew install ffmpeg` (see README); a rooted/absolute path is
    /// used exactly as given; anything else (contains a separator but isn't rooted, e.g.
    /// "tools/ffmpeg") is resolved relative to AppContext.BaseDirectory — what Production uses,
    /// pointing at the pinned, checksum-verified static binary the GitHub Actions build downloads
    /// and publishes alongside the app (see .github/workflows/deploy.yml). No runtime download —
    /// removed 2026-09-30 in favor of this CI-time, checksum-verified approach.
    /// </summary>
    public string FfmpegPath { get; set; } = "ffmpeg";
}
