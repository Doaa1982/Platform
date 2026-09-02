using Platform.Api.AI;

namespace Platform.Api.IntegrationTests.Fixtures;

/// <summary>
/// Replaces the real Ollama/OpenAI/Gemini provider in every integration test
/// — these tests exist to prove the credit/auth/bootstrap plumbing around an
/// AI call is correct, not to exercise a real model. Deterministic, instant,
/// no external dependency (no `ollama serve` required in CI).
/// </summary>
public class FakeAiModelProvider : IAiModelProvider
{
    public Task<string> CompleteAsync(string systemPrompt, string userPrompt, bool jsonMode = false, Type? responseType = null, CancellationToken ct = default)
        => Task.FromResult(jsonMode ? "{}" : "This is a fake AI response for integration testing.");

    public Task<string> CompleteAsync(string systemPrompt, string userPrompt, IReadOnlyList<AiAttachment> attachments, bool jsonMode = false, Type? responseType = null, CancellationToken ct = default)
        => CompleteAsync(systemPrompt, userPrompt, jsonMode, responseType, ct);
}
