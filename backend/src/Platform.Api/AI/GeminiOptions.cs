namespace Platform.Api.AI;

/// <summary>
/// Configuration for the Gemini text provider — same pattern as
/// <see cref="AiOptions"/>, kept as its own options class rather than reusing
/// AiOptions because it's a different vendor with its own API key and model
/// naming, not a value of the same setting.
/// </summary>
public class GeminiOptions
{
    public const string Section = "Gemini";

    public string ApiKey { get; set; } = string.Empty;

    /// <summary>
    /// Gemini 3.6 Flash. Originally "gemini-3.5-flash", but confirmed
    /// 2026-09-16 that this key's project can't call 3.5 (403
    /// "project has been denied access" via generateContent) while 3.6
    /// works — same finding GeminiTranscriptionOptions.Model documents for
    /// the transcription side. "gemini-2.5-flash" no longer works for a
    /// newly issued key either (404 "no longer available to new users").
    /// </summary>
    public string Model { get; set; } = "gemini-3.6-flash";
}
