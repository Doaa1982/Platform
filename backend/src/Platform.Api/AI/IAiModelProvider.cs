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
    /// models (e.g. Ollama's qwen2.5:7b) are otherwise prone to returning
    /// syntactically valid but semantically incomplete JSON (fields present
    /// but null, or under the wrong property names entirely) that
    /// <see cref="AiOrchestrator"/>'s parse-retry can't catch on its own,
    /// since it only detects parse failures, not wrong/missing content.
    /// Providers without such a mode may ignore the flag.
    ///
    /// <paramref name="responseType"/> is the concrete <c>T</c> the caller
    /// will deserialize the response into. A provider whose JSON mode
    /// supports constraining decoding to a full schema (not just "valid
    /// JSON") should use this to build one — see <see cref="OllamaModelProvider"/>,
    /// where hoping a small local model follows the system prompt's
    /// hand-written shape unaided was not reliable enough in practice.
    /// Providers without that capability may ignore it.
    /// </summary>
    Task<string> CompleteAsync(string systemPrompt, string userPrompt, bool jsonMode = false, Type? responseType = null, CancellationToken ct = default);
}
