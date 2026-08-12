namespace Platform.Api.AI;

/// <summary>
/// Configuration for the AI Model Provider. Bound from the "Ai" section of
/// appsettings — same pattern as <c>EmailOptions</c>. Empty ApiKey means AI
/// calls will fail fast with a clear error rather than silently doing nothing.
/// </summary>
public class AiOptions
{
    public const string Section = "Ai";

    /// <summary>
    /// Which provider implementation is active — "Claude" (default), "OpenAI",
    /// "Gemini", or "Ollama" (see Program.cs's branching on this value). Model
    /// name for Claude/OpenAI is <see cref="Model"/> below; Gemini and Ollama
    /// each have their own options class with their own Model, since a model
    /// name from one vendor is meaningless to another.
    /// </summary>
    public string Provider { get; set; } = "Claude";

    public string ApiKey { get; set; } = string.Empty;

    /// <summary>Model name for Claude or OpenAI, whichever Provider is currently set to — not used by Gemini/Ollama.</summary>
    public string Model { get; set; } = "claude-sonnet-5";

    public int MaxOutputTokens { get; set; } = 1536;
}
