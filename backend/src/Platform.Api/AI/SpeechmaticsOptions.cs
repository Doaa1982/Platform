namespace Platform.Api.AI;

/// <summary>
/// Configuration for the Speechmatics transcription provider. Bound from the
/// "Speechmatics" section of appsettings — same pattern as <see cref="AiOptions"/>.
/// Empty ApiKey means transcription calls fail fast with a clear error
/// rather than silently doing nothing.
/// </summary>
public class SpeechmaticsOptions
{
    public const string Section = "Speechmatics";

    public string ApiKey { get; set; } = string.Empty;

    /// <summary>
    /// "standard" (cost/turnaround) or "enhanced" (accuracy) — AI Video Transcript plan §2/§8.
    /// Defaults to "enhanced": a real lesson video came back with a near-total wrong-language
    /// transcript under "standard" (Automatic Language Identification confidently picked
    /// English for audio that was mostly Arabic, heavily code-switched with English math
    /// terms) — "enhanced" gives ALI a materially better acoustic/language model to work
    /// from, at higher cost per job.
    /// </summary>
    public string Model { get; set; } = "enhanced";

    /// <summary>
    /// "auto" (default) turns on Speechmatics' Automatic Language
    /// Identification instead of pinning one language — lesson videos are a
    /// mix of Arabic and English, and forcing one language onto audio
    /// spoken in the other silently produces wrong (not failing) text, as
    /// confirmed against faster-whisper for the same reason (see
    /// FasterWhisperOptions.Language). Set to an ISO-639-1 code only if
    /// every video this provider handles is known to be in one language.
    /// </summary>
    public string Language { get; set; } = "auto";

    /// <summary>How often to poll Speechmatics for job completion while a transcription is running.</summary>
    public int PollIntervalSeconds { get; set; } = 5;

    /// <summary>Gives up and marks the job Failed if Speechmatics hasn't finished within this window — a stuck job should not poll forever.</summary>
    public int MaxWaitMinutes { get; set; } = 60;
}
