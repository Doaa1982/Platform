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

    /// <summary>"standard" (cost/turnaround) or "enhanced" (accuracy) — AI Video Transcript plan §2/§8.</summary>
    public string Model { get; set; } = "standard";

    public string Language { get; set; } = "en";

    /// <summary>How often to poll Speechmatics for job completion while a transcription is running.</summary>
    public int PollIntervalSeconds { get; set; } = 5;

    /// <summary>Gives up and marks the job Failed if Speechmatics hasn't finished within this window — a stuck job should not poll forever.</summary>
    public int MaxWaitMinutes { get; set; } = 60;
}
