using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Platform.Api.AI;

/// <summary>
/// Third implementation of <see cref="IAudioTranscriptionProvider"/>,
/// calling the locally-running <c>services/transcription</c> FastAPI
/// (faster-whisper medium model) via its custom <c>POST /api/transcriptions</c>
/// endpoint. No API key, no billing, nothing leaves the machine.
///
/// Selected when <c>Transcription:Provider</c> is "LocalWhisper" (see
/// Program.cs) — the intended default for local development when the medium
/// model is already downloaded and running. <see cref="SpeechmaticsTranscriptionProvider"/>
/// remains the production default, and <see cref="FasterWhisperTranscriptionProvider"/>
/// remains available for the <c>speaches</c> OpenAI-compatible server.
///
/// The service returns a segments-based response shape — this provider joins
/// all segment texts into a single transcript string for <see cref="Transcript"/>-style
/// reading, but also keeps each segment's own start/end time as a
/// <see cref="TranscriptSegment"/> (AI Video-Grounded Questions Implementation
/// Plan), since that's real ASR timing the provider computed, not something
/// a downstream LLM should have to estimate for a checkpoint's timestamp.
/// Like <see cref="FasterWhisperTranscriptionProvider"/>, there is no
/// chapter-detection equivalent to Speechmatics' Auto Chapters, so
/// <see cref="TranscribeAsync"/> always returns an empty chapters list.
/// </summary>
public class LocalWhisperTranscriptionProvider(HttpClient http, LocalWhisperOptions options) : IAudioTranscriptionProvider
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<TranscriptionResult> TranscribeAsync(string filePath, string fileName, CancellationToken ct = default)
    {
        await using var fileStream = File.OpenRead(filePath);
        using var content = new MultipartFormDataContent();

        var fileContent = new StreamContent(fileStream);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
        content.Add(fileContent, "file", fileName);

        using var request = new HttpRequestMessage(HttpMethod.Post, "api/transcriptions") { Content = content };

        HttpResponseMessage response;
        try
        {
            response = await http.SendAsync(request, ct);
        }
        catch (HttpRequestException ex)
        {
            // The most common failure here is "the local transcription
            // service isn't running" — surfaced as a clear, actionable
            // message rather than a raw connection error.
            // Start it with: uvicorn app.main:app --reload --port 9000
            // (from the services/transcription directory)
            throw new InvalidOperationException(
                $"Could not reach the local Whisper service at {options.BaseUrl} — " +
                $"is it running? (cd services/transcription && uvicorn app.main:app --reload --port 9000) ({ex.Message})", ex);
        }

        var body = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException($"Local Whisper transcription failed ({(int)response.StatusCode}): {body}");

        var parsed = JsonSerializer.Deserialize<TranscriptionResponse>(body, JsonOptions)
            ?? throw new InvalidOperationException("Local Whisper service returned an empty response.");

        if (parsed.Segments is not { Count: > 0 })
            throw new InvalidOperationException("Local Whisper response contained no transcript segments.");

        // Join all segments into a single transcript string, preserving
        // natural sentence spacing. Segments already have their text stripped
        // (the Python service calls .strip() on each), so a single space
        // between them is sufficient.
        var transcript = new StringBuilder();
        foreach (var segment in parsed.Segments)
        {
            if (!string.IsNullOrWhiteSpace(segment.Text))
            {
                if (transcript.Length > 0)
                    transcript.Append(' ');
                transcript.Append(segment.Text.Trim());
            }
        }

        var text = transcript.ToString();
        if (string.IsNullOrWhiteSpace(text))
            throw new InvalidOperationException("Local Whisper transcript was empty after joining all segments.");

        var segments = parsed.Segments
            .Where(s => !string.IsNullOrWhiteSpace(s.Text))
            .Select(s => new TranscriptSegment(s.Start, s.End, s.Text!.Trim()))
            .ToList();

        // No chapter-detection equivalent to Speechmatics' Auto Chapters —
        // an empty list is the expected, non-error result here (same as
        // FasterWhisperTranscriptionProvider). Segments, unlike chapters, are
        // real data this provider actually has.
        return new TranscriptionResult(text, [], segments);
    }

    // ── Response shape from services/transcription (POST /api/transcriptions) ──

    private record TranscriptionResponse(
        [property: JsonPropertyName("id")] string? Id,
        [property: JsonPropertyName("filename")] string? Filename,
        [property: JsonPropertyName("language")] string? Language,
        [property: JsonPropertyName("language_probability")] double? LanguageProbability,
        [property: JsonPropertyName("segments")] List<TranscriptionSegment>? Segments);

    private record TranscriptionSegment(
        [property: JsonPropertyName("start")] double Start,
        [property: JsonPropertyName("end")] double End,
        [property: JsonPropertyName("text")] string? Text);
}
