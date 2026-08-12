namespace Platform.Api.AI;

/// <summary>
/// Which speech-to-text vendor is active. Bound from the "Transcription"
/// section of appsettings — same provider-switch pattern as
/// <see cref="AiOptions"/>. Vendor-specific settings (API keys, base URLs,
/// model names) live in their own options class (<see cref="SpeechmaticsOptions"/>,
/// <see cref="FasterWhisperOptions"/>), since a setting from one vendor is
/// meaningless to another.
/// </summary>
public class TranscriptionOptions
{
    public const string Section = "Transcription";

    /// <summary>
    /// "Speechmatics" (default — hosted, used in production) or
    /// "FasterWhisper" (local, no API key or billing — used in development,
    /// see Program.cs's branching on this value).
    /// </summary>
    public string Provider { get; set; } = "Speechmatics";
}
