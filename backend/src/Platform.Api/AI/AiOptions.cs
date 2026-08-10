namespace Platform.Api.AI;

/// <summary>
/// Configuration for the AI Model Provider. Bound from the "Ai" section of
/// appsettings — same pattern as <c>EmailOptions</c>. Empty ApiKey means AI
/// calls will fail fast with a clear error rather than silently doing nothing.
/// </summary>
public class AiOptions
{
    public const string Section = "Ai";

    /// <summary>Which provider implementation is active. Only "Claude" exists today.</summary>
    public string Provider { get; set; } = "Claude";

    public string ApiKey { get; set; } = string.Empty;

    public string Model { get; set; } = "claude-sonnet-5";

    public int MaxOutputTokens { get; set; } = 1536;
}
