using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Platform.Api.AI;

/// <summary>
/// Second implementation of <see cref="IAudioTranscriptionProvider"/>,
/// calling a locally-running faster-whisper server's OpenAI-compatible
/// transcription endpoint (<c>POST /v1/audio/transcriptions</c> — the same
/// shape as <c>speaches</c>/`faster-whisper-server` and OpenAI's own Whisper
/// API). No API key, no per-minute billing, nothing leaves the machine.
/// Selected when <c>Transcription:Provider</c> is "FasterWhisper" (see
/// Program.cs) — the intended default for local development, with
/// <see cref="SpeechmaticsTranscriptionProvider"/> remaining the production
/// default.
///
/// Unlike Speechmatics, faster-whisper has no chapter-detection feature —
/// <see cref="TranscribeAsync"/> always returns an empty chapters list,
/// which <see cref="IAudioTranscriptionProvider"/>'s contract treats as a
/// normal outcome, not an error.
/// </summary>
public class FasterWhisperTranscriptionProvider(HttpClient http, FasterWhisperOptions options) : IAudioTranscriptionProvider
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<TranscriptionResult> TranscribeAsync(string filePath, string fileName, CancellationToken ct = default)
    {
        await using var fileStream = File.OpenRead(filePath);
        using var content = new MultipartFormDataContent();

        var fileContent = new StreamContent(fileStream);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
        content.Add(fileContent, "file", fileName);
        content.Add(new StringContent(options.Model), "model");
        // Omitting "language" entirely (rather than sending "auto") is what
        // makes faster-whisper detect it per file — see FasterWhisperOptions.Language.
        if (!options.Language.Equals("auto", StringComparison.OrdinalIgnoreCase))
            content.Add(new StringContent(options.Language), "language");
        content.Add(new StringContent("json"), "response_format");

        using var request = new HttpRequestMessage(HttpMethod.Post, "v1/audio/transcriptions") { Content = content };

        HttpResponseMessage response;
        try
        {
            response = await http.SendAsync(request, ct);
        }
        catch (HttpRequestException ex)
        {
            // The most likely failure here is "the faster-whisper server
            // isn't running" — surfaced as a clear message rather than a
            // generic connection error, since there's no vendor status page
            // to check instead (same convention as OllamaModelProvider).
            throw new InvalidOperationException(
                $"Could not reach faster-whisper at {options.BaseUrl} — is the local transcription server running? ({ex.Message})", ex);
        }

        var body = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException($"faster-whisper transcription failed ({(int)response.StatusCode}): {body}");

        var parsed = JsonSerializer.Deserialize<TranscriptionResponse>(body, JsonOptions)
            ?? throw new InvalidOperationException("faster-whisper returned an empty response.");

        var text = parsed.Text;
        if (string.IsNullOrWhiteSpace(text))
            throw new InvalidOperationException("faster-whisper response did not contain any transcribed text.");

        // No chapter-detection equivalent to Speechmatics' Auto Chapters —
        // an empty list is the expected, non-error result here.
        return new TranscriptionResult(text.Trim(), []);
    }

    private record TranscriptionResponse([property: JsonPropertyName("text")] string? Text);
}
