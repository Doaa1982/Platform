namespace Platform.Api.AI;

/// <summary>
/// The Platform's boundary to a specific AI model vendor.
///
/// AIModelProviderArchitecture.md's central principle: "the Platform owns AI
/// capabilities; providers supply model execution." Every AI Skill talks to
/// this interface only — never to a vendor SDK or HTTP client directly — so
/// swapping providers later (or adding a second one) means writing a new
/// class behind this interface, with no change to <see cref="AiOrchestrator"/>
/// or any Skill.
/// </summary>
public interface IAiModelProvider
{
    /// <summary>
    /// Sends a system prompt (the Skill's instructions) and a user prompt
    /// (the assembled Business Context) to the model, and returns its raw
    /// text response. Callers are responsible for parsing/validating the
    /// response shape — this interface makes no assumption about it.
    ///
    /// <paramref name="jsonMode"/> is set by <see cref="AiOrchestrator.RunAsync{T}"/>
    /// for Skills whose result is structured JSON (never by <see cref="AiOrchestrator.RunTextAsync"/>,
    /// whose Skills expect plain text). A provider with a native
    /// JSON-constrained decoding mode should use it here — smaller/local
    /// models (e.g. Ollama's llama3.2) are otherwise prone to returning
    /// syntactically valid but semantically incomplete JSON (fields present
    /// but null) that <see cref="AiOrchestrator"/>'s parse-retry can't catch,
    /// since it only detects parse failures, not missing content. Providers
    /// without such a mode may ignore the flag.
    /// </summary>
    Task<string> CompleteAsync(string systemPrompt, string userPrompt, bool jsonMode = false, CancellationToken ct = default);
}
