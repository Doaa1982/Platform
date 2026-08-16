using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Schema;
using System.Text.Json.Serialization;
using System.Text.Json.Serialization.Metadata;

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

    // A separate options instance for schema generation only — deliberately
    // without JsonSerializerDefaults.Web's JsonNumberHandling.AllowReadingFromString,
    // which makes JsonSchemaExporter emit every int/long property as
    // {"type":["string","integer"],"pattern":"^-?(?:0|[1-9]\\d*)$"} to allow
    // both representations. Confirmed against the real local Ollama server
    // (qwen2.5:7b): that pattern-based union is enough to make its
    // llama.cpp-backed grammar compiler reject the whole request with
    // "Failed to initialize samplers: failed to parse grammar" (HTTP 400) —
    // not a hypothetical concern, reproduced directly. Plain "integer" is
    // all Ollama's grammar converter needs and all our own field types are.
    private static readonly JsonSerializerOptions SchemaJsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        TypeInfoResolver = new DefaultJsonTypeInfoResolver()
    };

    // Without this, JsonSchemaExporter treats every reference-typed property
    // (and the root List<T> itself) as nullable, since a bare reflection
    // Type carries no nullable-annotation context. Also reproduced directly:
    // an unconstrained-at-the-root schema let the model satisfy it by
    // emitting the single token `null` instead of an array of questions —
    // schema-valid, useless. This forces "no explicit nullable annotation"
    // to mean non-nullable, matching what our records actually require.
    private static readonly JsonSchemaExporterOptions SchemaExporterOptions = new()
    {
        TreatNullObliviousAsNonNullable = true
    };

    public async Task<string> CompleteAsync(string systemPrompt, string userPrompt, bool jsonMode = false, Type? responseType = null, CancellationToken ct = default)
    {
        var requestBody = new OllamaRequest(
            Model: options.Model,
            Stream: false,
            Messages:
            [
                new OllamaMessage("system", systemPrompt),
                new OllamaMessage("user", userPrompt)
            ],
            // Ollama's "format" field accepts either the bare string "json"
            // (syntactically-valid-JSON-only — no guarantee the *fields*
            // match what was asked for) or a full JSON Schema object, which
            // constrains decoding to that exact shape. Plain "json" mode was
            // observed in practice returning well-formed arrays with real
            // timestamps but the question text under the wrong property
            // name — silently wrong, not silently malformed, so the schema
            // mode is worth the extra specificity whenever the caller knows
            // its target type.
            Format: responseType is not null
                ? JsonSchemaExporter.GetJsonSchemaAsNode(SchemaJsonOptions, responseType, SchemaExporterOptions)
                : jsonMode ? JsonValue.Create("json") : null
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
        [property: JsonPropertyName("format")] JsonNode? Format = null);

    private record OllamaMessage(
        [property: JsonPropertyName("role")] string Role,
        [property: JsonPropertyName("content")] string Content);

    private record OllamaResponse(
        [property: JsonPropertyName("message")] OllamaResponseMessage? Message);

    private record OllamaResponseMessage(
        [property: JsonPropertyName("content")] string? Content);
}
