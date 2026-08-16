using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Platform.Api.AI;

/// <summary>
/// First (and currently only) implementation of <see cref="IAiModelProvider"/>,
/// calling the Claude Messages API directly over HTTP. Registered as a typed
/// HttpClient in Program.cs — no other class in the codebase should reference
/// the Anthropic API shape directly.
/// </summary>
public class ClaudeModelProvider(HttpClient http, AiOptions options) : IAiModelProvider
{
    private const string ApiVersion = "2023-06-01";

    // jsonMode/responseType are unused here — Claude has no simple
    // "constrain to JSON/schema" request flag equivalent to Ollama's/OpenAI's/
    // Gemini's (forcing valid JSON would mean switching to tool-use with a
    // forced tool_choice, a bigger structural change than this fix warrants);
    // AiOrchestrator's prompt instructions + parse-retry are what keep
    // Claude's output in shape.
    public async Task<string> CompleteAsync(string systemPrompt, string userPrompt, bool jsonMode = false, Type? responseType = null, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(options.ApiKey))
            throw new InvalidOperationException(
                "Ai:ApiKey is not configured. Set it in appsettings.Development.json or user secrets before requesting an AI capability.");

        var requestBody = new ClaudeRequest(
            Model: options.Model,
            MaxTokens: options.MaxOutputTokens,
            System: systemPrompt,
            Messages: [new ClaudeMessage("user", userPrompt)]
        );

        using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.anthropic.com/v1/messages")
        {
            Content = new StringContent(JsonSerializer.Serialize(requestBody, JsonOptions), Encoding.UTF8, "application/json")
        };
        request.Headers.Add("x-api-key", options.ApiKey);
        request.Headers.Add("anthropic-version", ApiVersion);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        using var response = await http.SendAsync(request, ct);
        var body = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException($"AI model call failed ({(int)response.StatusCode}): {body}");

        var parsed = JsonSerializer.Deserialize<ClaudeResponse>(body, JsonOptions)
            ?? throw new InvalidOperationException("AI model returned an empty response.");

        var text = parsed.Content?.FirstOrDefault(c => c.Type == "text")?.Text;
        if (string.IsNullOrWhiteSpace(text))
            throw new InvalidOperationException("AI model response did not contain any text content.");

        return text;
    }

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private record ClaudeRequest(
        [property: JsonPropertyName("model")] string Model,
        [property: JsonPropertyName("max_tokens")] int MaxTokens,
        [property: JsonPropertyName("system")] string System,
        [property: JsonPropertyName("messages")] ClaudeMessage[] Messages);

    private record ClaudeMessage(
        [property: JsonPropertyName("role")] string Role,
        [property: JsonPropertyName("content")] string Content);

    private record ClaudeResponse(
        [property: JsonPropertyName("content")] List<ClaudeContentBlock>? Content);

    private record ClaudeContentBlock(
        [property: JsonPropertyName("type")] string Type,
        [property: JsonPropertyName("text")] string? Text);
}
