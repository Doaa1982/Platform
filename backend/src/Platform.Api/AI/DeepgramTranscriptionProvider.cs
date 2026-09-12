using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Platform.Api.AI;

/// <summary>
/// Third implementation of <see cref="IAudioTranscriptionProvider"/>, calling
/// Deepgram's pre-recorded transcription API directly over HTTP
/// (<c>POST /v1/listen</c>, the file sent as a raw binary body — not
/// multipart, not JSON). Registered as a typed HttpClient in Program.cs,
/// selected as the hosted production default as of 2026-09-11, replacing
/// <see cref="SpeechmaticsTranscriptionProvider"/> in that role.
/// Speechmatics remains fully wired up and selectable
/// (Transcription:Provider = "Speechmatics") rather than removed.
///
/// Unlike Speechmatics' job-submit-then-poll flow, Deepgram's pre-recorded
/// API is synchronous — the transcript comes back in the same HTTP response,
/// no job id and no polling loop needed.
/// </summary>
public class DeepgramTranscriptionProvider(HttpClient http, DeepgramOptions options) : IAudioTranscriptionProvider
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<TranscriptionResult> TranscribeAsync(string filePath, string fileName, string? languageOverride = null, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(options.ApiKey))
            throw new InvalidOperationException(
                "Deepgram:ApiKey is not configured. Set it via user secrets before requesting a transcript.");

        // A tutor-supplied override always wins over the configured default —
        // see IAudioTranscriptionProvider.TranscribeAsync.
        var language = languageOverride ?? options.Language;

        // "auto" maps to Deepgram's own single-dominant-language detection,
        // not genuine code-switching — see DeepgramOptions.Language's doc
        // comment for why Arabic+English specifically isn't solved by this.
        var query = $"model={Uri.EscapeDataString(options.Model)}&punctuate=true&smart_format=true&diarize=true";
        query += language.Equals("auto", StringComparison.OrdinalIgnoreCase)
            ? "&detect_language=true"
            : $"&language={Uri.EscapeDataString(language)}";

        await using var fileStream = File.OpenRead(filePath);
        using var content = new StreamContent(fileStream);
        content.Headers.ContentType = new MediaTypeHeaderValue(ResolveContentType(fileName));

        using var request = new HttpRequestMessage(HttpMethod.Post, $"v1/listen?{query}") { Content = content };
        AddAuth(request);

        using var response = await http.SendAsync(request, ct);
        var body = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException($"Deepgram transcription failed ({(int)response.StatusCode}): {body}");

        var parsed = JsonSerializer.Deserialize<DeepgramResponse>(body, JsonOptions)
            ?? throw new InvalidOperationException("Deepgram returned an empty response.");

        var channel = parsed.Results?.Channels?.FirstOrDefault();
        var text = channel?.Alternatives?.FirstOrDefault()?.Transcript;
        if (string.IsNullOrWhiteSpace(text))
            throw new InvalidOperationException(BuildEmptyTranscriptMessage(channel));

        // No chapter-detection equivalent to Speechmatics' Auto Chapters, and
        // no segment-level timing mapped here either (Deepgram can expose
        // per-utterance timing with utterances=true — not requested today,
        // matching the level of ambition already accepted for Speechmatics'
        // own segments, which stay empty too) — both empty lists are the
        // normal, non-error outcome per IAudioTranscriptionProvider's contract.
        return new TranscriptionResult(text.Trim(), [], []);
    }

    private void AddAuth(HttpRequestMessage request) =>
        request.Headers.Authorization = new AuthenticationHeaderValue("Token", options.ApiKey);

    /// <summary>
    /// A raw "no text" message tells the tutor nothing they can act on — this
    /// stored string is exactly what LessonRevisionRow.TranscriptError surfaces
    /// verbatim in ContentStudioScreen's transcript panel (see the "Failed"
    /// state there), so it's the only place a tutor ever sees why this failed.
    /// When Deepgram's own automatic language detection is the likely culprit
    /// (present with low confidence — seen in practice at 22.7% on a real,
    /// quiet/short lesson clip that came back with zero recognized words),
    /// name that specifically and point at the language dropdown already in
    /// the UI, instead of a generic "try again".
    /// </summary>
    private static string BuildEmptyTranscriptMessage(DeepgramChannel? channel)
    {
        if (channel is { DetectedLanguage: { Length: > 0 } detectedLanguage, LanguageConfidence: { } confidence } && confidence < 0.5)
        {
            return $"Deepgram couldn't find any recognizable speech in this video — its automatic language " +
                   $"detection guessed \"{detectedLanguage}\" but was only {confidence:P0} confident, which usually " +
                   "means the audio is too quiet, unclear, or too short for it to work reliably. Pick \"Arabic\" or " +
                   "\"English\" directly from the language dropdown above (instead of \"Auto-detect\") and try again. " +
                   "If it still fails, check that the video actually has clear, audible speech.";
        }

        return "Deepgram couldn't find any recognizable speech in this video. Check that it has clear, audible " +
               "speech, then try again — if it keeps failing, try picking a specific language (Arabic or English) " +
               "from the dropdown above instead of \"Auto-detect\".";
    }

    /// <summary>Deepgram accepts many audio/video containers directly (like Speechmatics does with mp4) — matches ContentStudioService.SupportedTranscriptionExtensions.</summary>
    private static string ResolveContentType(string fileName) =>
        Path.GetExtension(fileName).ToLowerInvariant() switch
        {
            ".wav" => "audio/wav",
            ".mp3" => "audio/mpeg",
            ".aac" => "audio/aac",
            ".ogg" => "audio/ogg",
            ".mpeg" => "video/mpeg",
            ".amr" => "audio/amr",
            ".m4a" => "audio/mp4",
            ".mp4" => "video/mp4",
            ".flac" => "audio/flac",
            _ => "application/octet-stream",
        };

    private record DeepgramResponse([property: JsonPropertyName("results")] DeepgramResults? Results);
    private record DeepgramResults([property: JsonPropertyName("channels")] List<DeepgramChannel>? Channels);

    private record DeepgramChannel(
        [property: JsonPropertyName("alternatives")] List<DeepgramAlternative>? Alternatives,
        [property: JsonPropertyName("detected_language")] string? DetectedLanguage,
        [property: JsonPropertyName("language_confidence")] double? LanguageConfidence);

    private record DeepgramAlternative([property: JsonPropertyName("transcript")] string? Transcript);
}
