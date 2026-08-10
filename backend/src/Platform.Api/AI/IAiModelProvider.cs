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
    /// </summary>
    Task<string> CompleteAsync(string systemPrompt, string userPrompt, CancellationToken ct = default);
}
