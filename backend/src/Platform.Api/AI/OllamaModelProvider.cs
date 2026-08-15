using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Platform.Api.AI;

/// <summary>
/// Fourth implementation of <see cref="IAiModelProvider"/>, calling a
/// locally-running Ollama server's native chat API — no API key, no
/// per-token billing, nothing leaves the machine. Selected when
/// <c>Ai:Provider</c> is "Ollama" (see Program.cs). Response shape confirmed
/// against Ollama's own API docs (ollama/ollama, docs/api.md, "Chat request
/// (No streaming)"): <c>{ model, created_at, message: { role, content },
/// done, ... }</c> — this only reads <c>message.content</c>.
///
/// Mirrors <see cref="OpenAiModelProvider"/>'s shape so
/// <see cref="AiOrchestrator"/> and Skills stay vendor-agnostic; the request
/// body (role/content messages array) happens to look almost identical to
/// OpenAI's, which is coincidental to Ollama's own API design, not shared
/// code with the OpenAI-compatibility endpoint Ollama also exposes.
/// </summary>
public class OllamaModelProvider(HttpClient http, OllamaOptions options) : IAiModelProvider
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<string> CompleteAsync(string systemPrompt, string userPrompt, bool jsonMode = false, CancellationToken ct = default)
    {
        var requestBody = new OllamaRequest(
            Model: options.Model,
            Stream: false,
            Messages:
            [
                new OllamaMessage("system", systemPrompt),
                new OllamaMessage("user", userPrompt)
            ],
            // Ollama's own JSON mode — constrains decoding to syntactically
            // valid JSON. Doesn't guarantee every field gets meaningful
            // content from a small model, but it's a large, well-documented
            // improvement over hoping the prompt alone is followed, which is
            // what smaller local models (llama3.2 in particular) are prone
            // to ignore, wrap in prose, or fill with nulls.
            Format: jsonMode ? "json" : null
        );

        using var request = new HttpRequestMessage(HttpMethod.Post, "api/chat")
        {
            Content = new StringContent(JsonSerializer.Serialize(requestBody, JsonOptions), Encoding.UTF8, "application/json")
        };

        HttpResponseMessage response;
        try
        {
            response = await http.SendAsync(request, ct);
        }
        catch (HttpRequestException ex)
        {
            // The most likely failure here is "Ollama isn't running" —
            // surfaced as a clear message rather than a generic connection
            // error, since there's no vendor status page to check instead.
            throw new InvalidOperationException(
                $"Could not reach Ollama at {options.BaseUrl} — is `ollama serve` running? ({ex.Message})", ex);
        }

        var body = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException($"AI model call failed ({(int)response.StatusCode}): {body}");

        var parsed = JsonSerializer.Deserialize<OllamaResponse>(body, JsonOptions)
            ?? throw new InvalidOperationException("AI model returned an empty response.");

        var text = parsed.Message?.Content;
        if (string.IsNullOrWhiteSpace(text))
            throw new InvalidOperationException("AI model response did not contain any text content.");

        return text;
    }

    private record OllamaRequest(
        [property: JsonPropertyName("model")] string Model,
        [property: JsonPropertyName("stream")] bool Stream,
        [property: JsonPropertyName("messages")] OllamaMessage[] Messages,
        [property: JsonPropertyName("format")] string? Format = null);

    private record OllamaMessage(
        [property: JsonPropertyName("role")] string Role,
        [property: JsonPropertyName("content")] string Content);

    private record OllamaResponse(
        [property: JsonPropertyName("message")] OllamaResponseMessage? Message);

    private record OllamaResponseMessage(
        [property: JsonPropertyName("content")] string? Content);
}
