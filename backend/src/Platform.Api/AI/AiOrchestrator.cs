using System.Text.Json;
using Platform.Api.Services;

namespace Platform.Api.AI;

/// <summary>
/// The pipeline every AI Skill runs through, trimmed to what this codebase
/// needs today from AIOrchestrationArchitecture.md's full sequence:
///
///   Request -&gt; (caller already checked entitlement/authorization) -&gt;
///   Credit Check-and-Debit -&gt; Context Construction -&gt; Skill's Prompt -&gt;
///   Model Call -&gt; Response Validation -&gt; Result
///
/// Authorization is still left to the caller (AssessmentService already
/// gates on entitlement before calling in). Usage estimation/reservation/
/// reconciliation is Documents/AICreditsCommercialContractAndImplementationPlan.md
/// Phase 2: every call debits <paramref name="workspaceId"/>'s AI credit
/// balance for <paramref name="skillKey"/> before the model is ever called
/// (§A6 — atomic check-then-debit, no reservation state machine), and
/// refunds that debit if the call ultimately fails.
/// </summary>
public class AiOrchestrator(IAiModelProvider provider, ICreditLedgerService credits)
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    /// <summary>
    /// Runs one AI Skill end to end. The skill supplies its system prompt
    /// (instructions) and user prompt (assembled Business Context); this
    /// method calls the model, and on malformed JSON retries once with a
    /// stricter reminder before giving up — a model call returning ordinary
    /// prose instead of the requested shape is common enough to be worth one
    /// retry rather than failing the whole request outright.
    ///
    /// <paramref name="skillKey"/> identifies the skill for both credit
    /// pricing (<see cref="Platform.Domain.SkillCreditCost"/>) and the
    /// resulting <see cref="Platform.Domain.CreditLedgerEntry"/>'s audit
    /// trail — use <see cref="AiSkillKeys"/>, never a literal string.
    /// <paramref name="band"/> is a banded skill's own size signal (open-answer
    /// count, page count, ...) — <see langword="null"/> for a flat-priced skill.
    /// Throws <see cref="CreditsExhaustedException"/> before ever calling the
    /// model if the workspace's balance can't cover the price.
    ///
    /// <paramref name="isValid"/> covers the failure mode JSON parsing can't
    /// catch: <c>System.Text.Json</c> deserializes a well-formed object even
    /// when the model used the wrong property names for its content (e.g.
    /// <c>"question"</c> instead of the requested <c>"prompt"</c>) — no
    /// exception, just target properties left at their default (<c>""</c>,
    /// <c>null</c>, <c>0</c>). Seen in practice against a local Ollama model
    /// under "json" mode, which only guarantees syntactic JSON, not schema
    /// conformance: the array parsed fine, every timestamp was real, every
    /// question's text was empty. A skill that supplies <paramref
    /// name="isValid"/> gets that case treated the same as malformed JSON —
    /// one retry, then a clear failure — instead of silently returning
    /// content-free results to the caller.
    /// </summary>
    public async Task<T> RunAsync<T>(
        string systemPrompt, string userPrompt, Guid workspaceId, string skillKey,
        IReadOnlyList<AiAttachment>? attachments = null, int? band = null,
        Func<T, bool>? isValid = null, CancellationToken ct = default)
    {
        var debit = await credits.TryDebitAsync(workspaceId, skillKey, band, ct);
        if (!debit.Success)
            throw new CreditsExhaustedException(skillKey, debit.Cost, debit.RemainingBalance);

        try
        {
            var raw = await CompleteAsync<T>(systemPrompt, userPrompt, attachments, ct);

            var result = TryParse<T>(raw);
            if (result is not null && (isValid is null || isValid(result))) return result;

            var retryPrompt = userPrompt +
                "\n\nYour previous response could not be parsed as the requested JSON shape. " +
                "Respond with JSON only — no prose, no markdown code fences.";
            var retryRaw = await CompleteAsync<T>(systemPrompt, retryPrompt, attachments, ct);

            var retryResult = TryParse<T>(retryRaw);
            if (retryResult is not null && (isValid is null || isValid(retryResult))) return retryResult;

            throw new InvalidOperationException(
                "The AI model did not return a response in the expected shape, even after a retry.");
        }
        catch
        {
            if (debit.LedgerEntryId is { } id) await credits.RefundAsync(id, ct);
            throw;
        }
    }

    /// <summary>
    /// Runs a Skill whose result is free-form text rather than structured
    /// JSON — e.g. narrative feedback. No parsing/retry logic applies here;
    /// the caller is responsible for deciding what "malformed" would even
    /// mean for its own prompt. Same credit debit/refund behavior as
    /// <see cref="RunAsync{T}"/> — see its remarks for <paramref name="skillKey"/>/<paramref name="band"/>.
    /// </summary>
    public async Task<string> RunTextAsync(
        string systemPrompt, string userPrompt, Guid workspaceId, string skillKey,
        int? band = null, CancellationToken ct = default)
    {
        var debit = await credits.TryDebitAsync(workspaceId, skillKey, band, ct);
        if (!debit.Success)
            throw new CreditsExhaustedException(skillKey, debit.Cost, debit.RemainingBalance);

        try
        {
            return await provider.CompleteAsync(systemPrompt, userPrompt, jsonMode: false, ct: ct);
        }
        catch
        {
            if (debit.LedgerEntryId is { } id) await credits.RefundAsync(id, ct);
            throw;
        }
    }

    private Task<string> CompleteAsync<T>(string systemPrompt, string userPrompt, IReadOnlyList<AiAttachment>? attachments, CancellationToken ct)
        => attachments is { Count: > 0 }
            ? provider.CompleteAsync(systemPrompt, userPrompt, attachments, jsonMode: true, responseType: typeof(T), ct)
            : provider.CompleteAsync(systemPrompt, userPrompt, jsonMode: true, responseType: typeof(T), ct);

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
