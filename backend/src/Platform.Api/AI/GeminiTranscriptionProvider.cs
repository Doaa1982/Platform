using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Platform.Api.AI;

/// <summary>
/// Fourth implementation of <see cref="IAudioTranscriptionProvider"/> —
/// unlike Deepgram/Speechmatics/Whisper (dedicated ASR engines), this sends
/// the video/audio itself to Gemini (Flash tier — see
/// <see cref="GeminiTranscriptionOptions.Model"/>) and prompts it to
/// transcribe what it hears: native audio/video understanding rather than a
/// classic speech-to-text pipeline, the same approach NotebookLM uses. Registered as
/// a distinct, opt-in choice (Transcription:Provider = "Gemini") — Deepgram
/// remains the default; see Program.cs's provider switch, same "kept fully
/// wired and selectable, not replaced" pattern Speechmatics was left in.
///
/// A file at or under <see cref="InlineThresholdBytes"/> is sent inline
/// (base64-encoded in the request body); a larger one is uploaded first via
/// Gemini's resumable Files API and referenced by URI — Gemini caps inline
/// requests at ~20MB, and lesson videos routinely exceed that.
/// </summary>
public class GeminiTranscriptionProvider(HttpClient http, GeminiTranscriptionOptions options) : IAudioTranscriptionProvider
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    /// <summary>Stays comfortably under Gemini's ~20MB inline-request cap even after base64's ~33% size inflation.</summary>
    private const long InlineThresholdBytes = 15_000_000;

    /// <summary>Gemini 2.5 Flash's documented output ceiling — set explicitly so a long lesson's transcript doesn't get silently truncated at whatever a lower implicit default would be.</summary>
    private const int MaxOutputTokens = 65536;

    private static readonly TimeSpan FileActivePollInterval = TimeSpan.FromSeconds(3);
    private static readonly TimeSpan FileActiveMaxWait = TimeSpan.FromMinutes(10);

    public async Task<TranscriptionResult> TranscribeAsync(string filePath, string fileName, string? languageOverride = null, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(options.ApiKey))
            throw new InvalidOperationException(
                "GeminiTranscription:ApiKey is not configured. Set it via user secrets before requesting a transcript.");

        var mimeType = ResolveMimeType(fileName);
        var fileLength = new FileInfo(filePath).Length;

        Part mediaPart;
        if (fileLength > InlineThresholdBytes)
        {
            var fileUri = await UploadAndAwaitActiveAsync(filePath, fileName, mimeType, fileLength, ct);
            mediaPart = new Part(FileData: new FileData(mimeType, fileUri));
        }
        else
        {
            var bytes = await File.ReadAllBytesAsync(filePath, ct);
            mediaPart = new Part(InlineData: new InlineData(mimeType, Convert.ToBase64String(bytes)));
        }

        var language = languageOverride ?? options.Language;
        var promptPart = new Part(Text: BuildPrompt(language));

        var requestBody = new GenerateContentRequest(
            Contents: [new ContentBlock([promptPart, mediaPart])],
            GenerationConfig: new GenerationConfig(0, MaxOutputTokens));

        using var request = new HttpRequestMessage(HttpMethod.Post, $"v1beta/models/{options.Model}:generateContent")
        {
            Content = new StringContent(JsonSerializer.Serialize(requestBody, JsonOptions), Encoding.UTF8, "application/json")
        };
        request.Headers.Add("x-goog-api-key", options.ApiKey);

        using var response = await http.SendAsync(request, ct);
        var body = await response.Content.ReadAsStringAsync(ct);
        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException($"Gemini transcription call failed ({(int)response.StatusCode}): {body}");

        var parsed = JsonSerializer.Deserialize<GenerateContentResponse>(body, JsonOptions)
            ?? throw new InvalidOperationException("Gemini returned an empty response.");

        var text = parsed.Candidates?.FirstOrDefault()?.Content?.Parts?.FirstOrDefault(p => p.Text is not null)?.Text;
        if (string.IsNullOrWhiteSpace(text))
            throw new InvalidOperationException(BuildEmptyTranscriptMessage(parsed));

        // No real chapter/segment timing signal from a plain generateContent
        // call — same "empty, not an error" contract Deepgram's own
        // transcript-only path documents.
        return new TranscriptionResult(text.Trim(), [], []);
    }

    /// <summary>
    /// Same inline-label convention ("SPEAKER: S1") Deepgram/Speechmatics
    /// transcripts already use, so every downstream text-based AI skill
    /// reading LessonRevision.Transcript keeps seeing the same shape
    /// regardless of which provider produced it. Deliberately conservative —
    /// this is a transcription prompt, not a correction/summarization one
    /// (that pass, if wanted, is the separate "Enhance Transcript" feature).
    /// </summary>
    private static string BuildPrompt(string language)
    {
        var languageHint = language.Equals("auto", StringComparison.OrdinalIgnoreCase)
            ? "The audio may switch between Egyptian Arabic and English mid-sentence (common in tutoring lessons covering math/science terms) — transcribe each language as spoken, do not translate."
            : $"The primary spoken language is: {language}.";

        return "Listen to the full audio track of this file and produce a verbatim, complete transcript of everything spoken, start to finish.\n\n" +
               languageHint + "\n\n" +
               "Rules:\n" +
               "- Transcribe exactly what is said. Do not summarize, shorten, paraphrase, correct grammar, or skip any portion, no matter how long the file is.\n" +
               "- Identify distinct speakers and label each turn on its own line as \"SPEAKER: S1\", \"SPEAKER: S2\", etc. (a new label only when the speaker actually changes).\n" +
               "- Preserve numbers, variable names, formulas, units, and any code-switched English technical terms exactly as spoken.\n" +
               "- Do not add any commentary, headers, timestamps, or notes of your own — output only the transcript itself in the SPEAKER-labeled format above.\n" +
               "- If a short stretch is truly inaudible, write \"[inaudible]\" there instead of guessing.";
    }

    private static string BuildEmptyTranscriptMessage(GenerateContentResponse parsed)
    {
        var finishReason = parsed.Candidates?.FirstOrDefault()?.FinishReason;
        return finishReason is { Length: > 0 }
            ? $"Gemini didn't return any transcript text (finishReason: {finishReason}). This can happen on a very long video, a file it safety-filtered, or a transient error — try again, or switch providers in Transcription:Provider."
            : "Gemini didn't return any transcript text. Check that the video has clear, audible speech, then try again.";
    }

    /// <summary>
    /// Gemini's resumable Files API: (1) POST metadata to reserve an upload
    /// session and get back an upload URL in the X-Goog-Upload-URL response
    /// header, (2) PUT the raw bytes to that URL with upload+finalize
    /// commands, (3) poll the returned file resource until it leaves the
    /// PROCESSING state — a large video isn't usable the instant its bytes
    /// finish uploading.
    /// </summary>
    private async Task<string> UploadAndAwaitActiveAsync(string filePath, string fileName, string mimeType, long fileLength, CancellationToken ct)
    {
        using var startRequest = new HttpRequestMessage(HttpMethod.Post, "upload/v1beta/files")
        {
            Content = new StringContent(
                JsonSerializer.Serialize(new UploadStartRequest(new UploadFileMetadata(fileName)), JsonOptions),
                Encoding.UTF8, "application/json")
        };
        startRequest.Headers.Add("x-goog-api-key", options.ApiKey);
        startRequest.Headers.Add("X-Goog-Upload-Protocol", "resumable");
        startRequest.Headers.Add("X-Goog-Upload-Command", "start");
        startRequest.Headers.Add("X-Goog-Upload-Header-Content-Length", fileLength.ToString());
        startRequest.Headers.Add("X-Goog-Upload-Header-Content-Type", mimeType);

        using var startResponse = await http.SendAsync(startRequest, ct);
        if (!startResponse.IsSuccessStatusCode)
            throw new InvalidOperationException($"Gemini file upload failed to start ({(int)startResponse.StatusCode}): {await startResponse.Content.ReadAsStringAsync(ct)}");

        var uploadUrl = startResponse.Headers.TryGetValues("X-Goog-Upload-URL", out var values) ? values.FirstOrDefault() : null;
        if (string.IsNullOrEmpty(uploadUrl))
            throw new InvalidOperationException("Gemini file upload did not return an upload URL.");

        await using var fileStream = File.OpenRead(filePath);
        using var uploadRequest = new HttpRequestMessage(HttpMethod.Put, uploadUrl)
        {
            Content = new StreamContent(fileStream)
        };
        uploadRequest.Content.Headers.ContentLength = fileLength;
        uploadRequest.Headers.Add("X-Goog-Upload-Offset", "0");
        uploadRequest.Headers.Add("X-Goog-Upload-Command", "upload, finalize");

        using var uploadResponse = await http.SendAsync(uploadRequest, ct);
        var uploadBody = await uploadResponse.Content.ReadAsStringAsync(ct);
        if (!uploadResponse.IsSuccessStatusCode)
            throw new InvalidOperationException($"Gemini file upload failed ({(int)uploadResponse.StatusCode}): {uploadBody}");

        var uploaded = JsonSerializer.Deserialize<UploadedFileEnvelope>(uploadBody, JsonOptions)
            ?? throw new InvalidOperationException("Gemini file upload returned an empty response.");
        var file = uploaded.File ?? throw new InvalidOperationException("Gemini file upload response did not contain a file.");

        return await AwaitFileActiveAsync(file, ct);
    }

    private async Task<string> AwaitFileActiveAsync(UploadedFile file, CancellationToken ct)
    {
        var deadline = DateTime.UtcNow + FileActiveMaxWait;
        var current = file;
        while (current.State == "PROCESSING")
        {
            if (DateTime.UtcNow > deadline)
                throw new InvalidOperationException("Gemini took too long to finish processing the uploaded file.");

            await Task.Delay(FileActivePollInterval, ct);

            using var statusRequest = new HttpRequestMessage(HttpMethod.Get, $"v1beta/{current.Name}");
            statusRequest.Headers.Add("x-goog-api-key", options.ApiKey);
            using var statusResponse = await http.SendAsync(statusRequest, ct);
            var statusBody = await statusResponse.Content.ReadAsStringAsync(ct);
            if (!statusResponse.IsSuccessStatusCode)
                throw new InvalidOperationException($"Gemini file status check failed ({(int)statusResponse.StatusCode}): {statusBody}");

            current = JsonSerializer.Deserialize<UploadedFile>(statusBody, JsonOptions)
                ?? throw new InvalidOperationException("Gemini file status check returned an empty response.");
        }

        if (current.State != "ACTIVE")
            throw new InvalidOperationException($"Gemini could not process the uploaded file (state: {current.State}).");

        return current.Uri ?? throw new InvalidOperationException("Gemini's uploaded file has no URI.");
    }

    /// <summary>Matches ContentStudioService.SupportedTranscriptionExtensions — every format that reaches a provider today.</summary>
    private static string ResolveMimeType(string fileName) =>
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

    private record GenerateContentRequest(
        [property: JsonPropertyName("contents")] ContentBlock[] Contents,
        [property: JsonPropertyName("generationConfig")] GenerationConfig? GenerationConfig = null);

    private record GenerationConfig(
        [property: JsonPropertyName("temperature")] double Temperature,
        [property: JsonPropertyName("maxOutputTokens")] int MaxOutputTokens);

    private record ContentBlock([property: JsonPropertyName("parts")] Part[] Parts);

    private record Part(
        [property: JsonPropertyName("text")] string? Text = null,
        [property: JsonPropertyName("inline_data")] InlineData? InlineData = null,
        [property: JsonPropertyName("file_data")] FileData? FileData = null);

    private record InlineData(
        [property: JsonPropertyName("mime_type")] string MimeType,
        [property: JsonPropertyName("data")] string Data);

    private record FileData(
        [property: JsonPropertyName("mime_type")] string MimeType,
        [property: JsonPropertyName("file_uri")] string FileUri);

    private record GenerateContentResponse([property: JsonPropertyName("candidates")] List<ResponseCandidate>? Candidates);

    private record ResponseCandidate(
        [property: JsonPropertyName("content")] ResponseContent? Content,
        [property: JsonPropertyName("finishReason")] string? FinishReason);

    private record ResponseContent([property: JsonPropertyName("parts")] List<Part>? Parts);

    private record UploadStartRequest([property: JsonPropertyName("file")] UploadFileMetadata File);

    private record UploadFileMetadata([property: JsonPropertyName("display_name")] string DisplayName);

    private record UploadedFileEnvelope([property: JsonPropertyName("file")] UploadedFile? File);

    private record UploadedFile(
        [property: JsonPropertyName("name")] string Name,
        [property: JsonPropertyName("uri")] string? Uri,
        [property: JsonPropertyName("state")] string? State);
}
