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
    /// Gemini 3.5 Flash. Note: the confirmed free-tier-without-billing quota
    /// (250 req/day, no card) was specifically documented for the 2.5 series
    /// (Flash/Flash-Lite/Pro) — if 3.5 returns a billing/quota error, that's
    /// why; switch back to "gemini-2.5-flash" if so.
    /// </summary>
    public string Model { get; set; } = "gemini-3.5-flash";
}
