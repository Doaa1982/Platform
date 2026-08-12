namespace Platform.Api.AI;

/// <summary>
/// Configuration for the Ollama text provider — a local LLM running on the
/// tutor's own machine, no vendor API key, no billing, no network call
/// beyond localhost. Same options-class-per-vendor pattern as
/// <see cref="GeminiOptions"/>.
/// </summary>
public class OllamaOptions
{
    public const string Section = "Ollama";

    /// <summary>Ollama's default local address. Change only if Ollama is running elsewhere (a different port, or a remote host).</summary>
    public string BaseUrl { get; set; } = "http://localhost:11434/";

    /// <summary>Must match a model already pulled locally (`ollama pull &lt;model&gt;`) — Ollama returns a 404 otherwise.</summary>
    public string Model { get; set; } = "llama3.2";
}
