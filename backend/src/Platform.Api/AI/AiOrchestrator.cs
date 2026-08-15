using System.Text.Json;

namespace Platform.Api.AI;

/// <summary>
/// The pipeline every AI Skill runs through, trimmed to what this codebase
/// needs today from AIOrchestrationArchitecture.md's full sequence:
///
///   Request -&gt; (caller already checked entitlement/authorization) -&gt;
///   Context Construction -&gt; Skill's Prompt -&gt; Model Call -&gt;
///   Response Validation -&gt; Result
///
/// Authorization and usage estimation/reservation/reconciliation are left to
/// the caller (AssessmentService already gates on entitlement before calling
/// in) and to a future AIUsageAndCostArchitecture slice, respectively — this
/// class's only job is turning a Skill's instructions + context into a
/// validated, typed result.
/// </summary>
public class AiOrchestrator(IAiModelProvider provider)
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    /// <summary>
    /// Runs one AI Skill end to end. The skill supplies its system prompt
    /// (instructions) and user prompt (assembled Business Context); this
    /// method calls the model, and on malformed JSON retries once with a
    /// stricter reminder before giving up — a model call returning ordinary
    /// prose instead of the requested shape is common enough to be worth one
    /// retry rather than failing the whole request outright.
    /// </summary>
    public async Task<T> RunAsync<T>(
        string systemPrompt, string userPrompt, CancellationToken ct = default)
    {
        var raw = await provider.CompleteAsync(systemPrompt, userPrompt, jsonMode: true, ct);

        var result = TryParse<T>(raw);
        if (result is not null) return result;

        var retryPrompt = userPrompt +
            "\n\nYour previous response could not be parsed as the requested JSON shape. " +
            "Respond with JSON only — no prose, no markdown code fences.";
        var retryRaw = await provider.CompleteAsync(systemPrompt, retryPrompt, jsonMode: true, ct);

        var retryResult = TryParse<T>(retryRaw);
        if (retryResult is not null) return retryResult;

        throw new InvalidOperationException(
            "The AI model did not return a response in the expected shape, even after a retry.");
    }

    /// <summary>
    /// Runs a Skill whose result is free-form text rather than structured
    /// JSON — e.g. narrative feedback. No parsing/retry logic applies here;
    /// the caller is responsible for deciding what "malformed" would even
    /// mean for its own prompt, and for handling <see cref="IAiModelProvider"/>
    /// exceptions (unreachable model, bad key, etc.) the same way <see cref="RunAsync{T}"/> callers do.
    /// </summary>
    public Task<string> RunTextAsync(string systemPrompt, string userPrompt, CancellationToken ct = default)
        => provider.CompleteAsync(systemPrompt, userPrompt, jsonMode: false, ct);

    private static T? TryParse<T>(string raw)
    {
        var json = StripMarkdownFence(raw);
        try
        {
            return JsonSerializer.Deserialize<T>(json, JsonOptions);
        }
        catch (JsonException)
        {
            // A model asked for a bare top-level array will still sometimes
            // wrap it in an envelope object instead — e.g. {"checkpoints":
            // [...]} rather than [...] — even when told not to. Common
            // enough (seen from a local Ollama model in practice, not
            // theoretical) that it's worth unwrapping automatically rather
            // than burning the one real retry on a formatting quirk: if the
            // response is an object with exactly one array-valued property,
            // try that property's contents instead.
            var unwrapped = TryUnwrapSingleArrayProperty(json);
            if (unwrapped is null) return default;

            try { return JsonSerializer.Deserialize<T>(unwrapped, JsonOptions); }
            catch (JsonException) { return default; }
        }
    }

    private static string? TryUnwrapSingleArrayProperty(string json)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.ValueKind != JsonValueKind.Object) return null;

            JsonElement? arrayProperty = null;
            foreach (var property in doc.RootElement.EnumerateObject())
            {
                if (property.Value.ValueKind != JsonValueKind.Array) continue;
                if (arrayProperty is not null) return null; // ambiguous — more than one array property
                arrayProperty = property.Value;
            }

            return arrayProperty?.GetRawText();
        }
        catch (JsonException)
        {
            return null;
        }
    }

    /// <summary>Models routinely wrap JSON in ```json ... ``` even when told not to. Strip it before parsing.</summary>
    private static string StripMarkdownFence(string raw)
    {
        var trimmed = raw.Trim();
        if (!trimmed.StartsWith("```")) return trimmed;

        var firstNewline = trimmed.IndexOf('\n');
        if (firstNewline < 0) return trimmed;

        var withoutOpeningFence = trimmed[(firstNewline + 1)..];
        var closingFenceIndex = withoutOpeningFence.LastIndexOf("```", StringComparison.Ordinal);
        return closingFenceIndex >= 0 ? withoutOpeningFence[..closingFenceIndex].Trim() : withoutOpeningFence.Trim();
    }
}
