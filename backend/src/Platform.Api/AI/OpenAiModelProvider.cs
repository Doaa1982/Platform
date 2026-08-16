using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Platform.Api.AI;

/// <summary>
/// Second implementation of <see cref="IAiModelProvider"/>, calling OpenAI's
/// Chat Completions API directly over HTTP. Selected when <c>Ai:Provider</c>
/// is "OpenAI" (see Program.cs) — mirrors <see cref="ClaudeModelProvider"/>'s
/// shape so <see cref="AiOrchestrator"/> and Skills stay vendor-agnostic.
/// </summary>
public class OpenAiModelProvider(HttpClient http, AiOptions options) : IAiModelProvider
{
    // responseType is unused here — OpenAI supports a stricter
    // response_format.json_schema mode, but this codebase only ever hit the
    // wrong-field-name failure against the local Ollama model; jsonMode's
    // plain json_object mode plus AiOrchestrator's prompt instructions +
    // parse-retry are what keep OpenAI's output in shape today.
    public async Task<string> CompleteAsync(string systemPrompt, string userPrompt, bool jsonMode = false, Type? responseType = null, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(options.ApiKey))
            throw new InvalidOperationException(
                "Ai:ApiKey is not configured. Set it in appsettings.Development.json or user secrets before requesting an AI capability.");

        var requestBody = new OpenAiRequest(
            Model: options.Model,
            MaxTokens: options.MaxOutputTokens,
            Messages:
            [
                new OpenAiMessage("system", systemPrompt),
                new OpenAiMessage("user", userPrompt)
            ],
            // OpenAI's own JSON mode — same reasoning as OllamaModelProvider's Format.
            ResponseFormat: jsonMode ? new OpenAiResponseFormat("json_object") : null
        );

        using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.openai.com/v1/chat/completions")
        {
            Content = new StringContent(JsonSerializer.Serialize(requestBody, JsonOptions), Encoding.UTF8, "application/json")
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", options.ApiKey);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        using var response = await http.SendAsync(request, ct);
        var body = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException($"AI model call failed ({(int)response.StatusCode}): {body}");

        var parsed = JsonSerializer.Deserialize<OpenAiResponse>(body, JsonOptions)
            ?? throw new InvalidOperationException("AI model returned an empty response.");

        var text = parsed.Choices?.FirstOrDefault()?.Message?.Content;
        if (string.IsNullOrWhiteSpace(text))
            throw new InvalidOperationException("AI model response did not contain any text content.");

        return text;
    }

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private record OpenAiRequest(
        [property: JsonPropertyName("model")] string Model,
        [property: JsonPropertyName("max_tokens")] int MaxTokens,
        [property: JsonPropertyName("messages")] OpenAiMessage[] Messages,
        [property: JsonPropertyName("response_format")] OpenAiResponseFormat? ResponseFormat = null);

    private record OpenAiMessage(
        [property: JsonPropertyName("role")] string Role,
        [property: JsonPropertyName("content")] string Content);

    private record OpenAiResponseFormat(
        [property: JsonPropertyName("type")] string Type);

    private record OpenAiResponse(
        [property: JsonPropertyName("choices")] List<OpenAiChoice>? Choices);

    private record OpenAiChoice(
        [property: JsonPropertyName("message")] OpenAiResponseMessage? Message);

    private record OpenAiResponseMessage(
        [property: JsonPropertyName("content")] string? Content);
}
