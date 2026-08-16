using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Platform.Api.AI;

/// <summary>
/// Second implementation of <see cref="IAiModelProvider"/>, calling Google's
/// Gemini API — added as a free-tier-eligible alternative to Claude while
/// exercising the AI pipeline without live billing (Gemini 2.5 Flash's free
/// tier: 250 requests/day, no card required, as of when this was written —
/// check current limits at ai.google.dev/gemini-api/docs/rate-limits, they
/// change).
///
/// Uses the older, stable `generateContent` REST endpoint rather than the
/// newer Interactions API: generateContent's JSON request/response shape is
/// fully documented and has been stable for a long time, whereas the
/// Interactions API's SDK docs describe convenience properties
/// (`output_text`) without fully specifying the raw JSON shape — not a safe
/// thing to hand-guess for a hand-rolled HTTP client. generateContent
/// remains fully supported, just no longer the recommended default for new
/// SDK-based projects.
/// </summary>
public class GeminiModelProvider(HttpClient http, GeminiOptions options) : IAiModelProvider
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    // responseType is unused here — Gemini's responseSchema config exists but
    // wiring it up is left for if/when Gemini's local-dev-free-tier path
    // shows the same wrong-field-name failures Ollama did; jsonMode's plain
    // "application/json" mime type plus AiOrchestrator's prompt instructions
    // + parse-retry are what keep Gemini's output in shape today.
    public async Task<string> CompleteAsync(string systemPrompt, string userPrompt, bool jsonMode = false, Type? responseType = null, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(options.ApiKey))
            throw new InvalidOperationException(
                "Gemini:ApiKey is not configured. Set it in appsettings.Development.json or user secrets before requesting an AI capability.");

        var requestBody = new GenerateContentRequest(
            SystemInstruction: new ContentPart(new[] { new TextPart(systemPrompt) }),
            Contents: new[] { new ContentPart(new[] { new TextPart(userPrompt) }) },
            // Gemini's own JSON mode — same reasoning as OllamaModelProvider's Format.
            GenerationConfig: jsonMode ? new GenerationConfig("application/json") : null);

        using var request = new HttpRequestMessage(
            HttpMethod.Post, $"models/{options.Model}:generateContent")
        {
            Content = new StringContent(JsonSerializer.Serialize(requestBody, JsonOptions), Encoding.UTF8, "application/json")
        };
        request.Headers.Add("x-goog-api-key", options.ApiKey);

        using var response = await http.SendAsync(request, ct);
        var body = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException($"Gemini model call failed ({(int)response.StatusCode}): {body}");

        var parsed = JsonSerializer.Deserialize<GenerateContentResponse>(body, JsonOptions)
            ?? throw new InvalidOperationException("Gemini returned an empty response.");

        var text = parsed.Candidates?.FirstOrDefault()?.Content?.Parts?.FirstOrDefault()?.Text;
        if (string.IsNullOrWhiteSpace(text))
            throw new InvalidOperationException("Gemini response did not contain any text content.");

        return text;
    }

    private record GenerateContentRequest(
        [property: JsonPropertyName("system_instruction")] ContentPart SystemInstruction,
        [property: JsonPropertyName("contents")] ContentPart[] Contents,
        [property: JsonPropertyName("generationConfig")] GenerationConfig? GenerationConfig = null);

    private record GenerationConfig(
        [property: JsonPropertyName("responseMimeType")] string ResponseMimeType);

    private record ContentPart([property: JsonPropertyName("parts")] TextPart[] Parts);

    private record TextPart([property: JsonPropertyName("text")] string Text);

    private record GenerateContentResponse([property: JsonPropertyName("candidates")] List<Candidate>? Candidates);

    private record Candidate([property: JsonPropertyName("content")] ResponseContent? Content);

    private record ResponseContent([property: JsonPropertyName("parts")] List<TextPart>? Parts);
}
