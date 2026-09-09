using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Platform.Api.AI;

/// <summary>
/// First (and currently only) implementation of <see cref="IAudioTranscriptionProvider"/>,
/// calling Speechmatics' Batch Transcription API directly over HTTP.
/// Registered as a typed HttpClient in Program.cs, base address set to the
/// EU1 region (AI Video Transcript Implementation Plan §2/§8) — no other
/// class should reference the Speechmatics API shape directly.
///
/// Accepts the video file as-is: Speechmatics' supported-format list
/// includes `mp4` directly, so unlike a Whisper-based provider this needs no
/// audio-extraction step before submitting (Implementation Plan §4).
///
/// Also requests Speechmatics' Auto Chapters on the same job (AI
/// Video-Grounded Questions Implementation Plan §2) — real, deterministic
/// chapter boundaries used downstream to place quiz-checkpoint timestamps
/// without an LLM having to guess one.
/// </summary>
public class SpeechmaticsTranscriptionProvider(HttpClient http, SpeechmaticsOptions options) : IAudioTranscriptionProvider
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<TranscriptionResult> TranscribeAsync(string filePath, string fileName, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(options.ApiKey))
            throw new InvalidOperationException(
                "Speechmatics:ApiKey is not configured. Set it in appsettings.Development.json or user secrets before requesting a transcript.");

        var jobId = await SubmitJobAsync(filePath, fileName, ct);
        await WaitForCompletionAsync(jobId, ct);

        // Two GET requests against the same completed job, not two jobs — no
        // re-processing, no extra billing event, just a second read of
        // results already computed (AI Video-Grounded Questions
        // Implementation Plan §3). Reconstructing correctly-punctuated plain
        // text from the JSON word-level output is fiddly enough that it's
        // not worth risking a subtle regression in the transcript every
        // other AI skill already reads — kept as a separate, unchanged fetch.
        var text = await FetchTranscriptTextAsync(jobId, ct);
        var chapters = await FetchChaptersAsync(jobId, ct);

        // No per-segment timing parsed from Speechmatics today — the plain
        // "format=txt" fetch above discards word/segment timestamps, and
        // "format=json-v2" is only read for its chapters array (see
        // FetchChaptersAsync). Chapters remain the accurate-timestamp source
        // for this provider; an empty segments list is the documented,
        // normal case (see TranscriptSegment).
        return new TranscriptionResult(text, chapters, []);
    }

    private async Task<string> SubmitJobAsync(string filePath, string fileName, CancellationToken ct)
    {
        var config = JsonSerializer.Serialize(new JobConfig(
            Type: "transcription",
            // Speaker diarization requested specifically because Speechmatics'
            // own Auto Chapters docs recommend it for better chapter quality
            // — not because this platform does anything with speaker labels
            // itself. Side effect worth knowing: the plain-text transcript
            // this job returns will now be prefixed per line with "SPEAKER
            // S1:" (single-speaker lesson videos get one consistent label),
            // which flows into every text-based skill reading
            // LessonRevision.Transcript (body drafting, "what you'll learn",
            // the duration-based question fallback). Harmless for a single
            // tutor speaking, but worth remembering if multi-speaker lesson
            // videos ever become common — the labels would then carry real
            // information current skills don't use.
            TranscriptionConfig: new TranscriptionConfig(options.Language, options.Model, "speaker",
                // Speechmatics' default behavior for Automatic Language
                // Identification is to reject the whole job outright when its
                // confidence is low ("Language identification could not
                // identify any language with sufficient confidence") — seen
                // in practice on a real lesson video whose audio transcribed
                // fine once a language was picked manually on Speechmatics'
                // own web console, so the audio itself was transcribable; ALI
                // just wasn't confident enough on its own. ExpectedLanguages
                // narrows ALI's guess to the two languages lesson videos
                // actually use (see options.Language's own doc comment) and
                // LowConfidenceAction "allow" stops a shaky-but-plausible
                // guess from failing the entire job, without hard-pinning one
                // language the way setting options.Language itself would.
                options.Language.Equals("auto", StringComparison.OrdinalIgnoreCase)
                    ? new LanguageIdentificationConfig(["en", "ar"], "allow")
                    : null),
            AutoChaptersConfig: new AutoChaptersConfig()), JsonOptions);

        await using var fileStream = File.OpenRead(filePath);
        using var content = new MultipartFormDataContent();

        var fileContent = new StreamContent(fileStream);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
        content.Add(fileContent, "data_file", fileName);
        content.Add(new StringContent(config, Encoding.UTF8, "application/json"), "config");

        using var request = new HttpRequestMessage(HttpMethod.Post, "jobs") { Content = content };
        AddAuth(request);

        using var response = await http.SendAsync(request, ct);
        var body = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException($"Speechmatics job submission failed ({(int)response.StatusCode}): {body}");

        var parsed = JsonSerializer.Deserialize<CreateJobResponse>(body, JsonOptions)
            ?? throw new InvalidOperationException("Speechmatics returned an empty response when submitting the job.");

        return parsed.Id ?? throw new InvalidOperationException("Speechmatics did not return a job id.");
    }

    private async Task WaitForCompletionAsync(string jobId, CancellationToken ct)
    {
        var deadline = DateTime.UtcNow.AddMinutes(options.MaxWaitMinutes);
        var pollDelay = TimeSpan.FromSeconds(Math.Max(options.PollIntervalSeconds, 1));

        while (true)
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, $"jobs/{jobId}");
            AddAuth(request);

            using var response = await http.SendAsync(request, ct);
            var body = await response.Content.ReadAsStringAsync(ct);

            if (!response.IsSuccessStatusCode)
                throw new InvalidOperationException($"Speechmatics job status check failed ({(int)response.StatusCode}): {body}");

            var parsed = JsonSerializer.Deserialize<JobStatusResponse>(body, JsonOptions);
            var status = parsed?.Job?.Status;

            if (status == "done") return;
            if (status == "rejected")
                throw new InvalidOperationException($"Speechmatics rejected this transcription job: {body}");

            if (DateTime.UtcNow >= deadline)
                throw new InvalidOperationException(
                    $"Speechmatics transcription did not finish within {options.MaxWaitMinutes} minutes.");

            await Task.Delay(pollDelay, ct);
        }
    }

    private async Task<string> FetchTranscriptTextAsync(string jobId, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, $"jobs/{jobId}/transcript?format=txt");
        AddAuth(request);

        using var response = await http.SendAsync(request, ct);
        var body = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException($"Fetching the Speechmatics transcript failed ({(int)response.StatusCode}): {body}");

        return body.Trim();
    }

    /// <summary>
    /// Fetches the same job's JSON output solely to read its <c>chapters</c>
    /// array. Best-effort: a video under Speechmatics' ~10-minute chaptering
    /// minimum, an unsupported language, or a chaptering failure all legally
    /// come back with no chapters (AI Video-Grounded Questions Implementation
    /// Plan §2/§6) — that's a normal outcome, not an error, so this returns
    /// an empty list rather than throwing when the array is simply absent.
    /// </summary>
    private async Task<IReadOnlyList<TranscriptChapter>> FetchChaptersAsync(string jobId, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, $"jobs/{jobId}/transcript?format=json-v2");
        AddAuth(request);

        using var response = await http.SendAsync(request, ct);
        var body = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException($"Fetching the Speechmatics chapters failed ({(int)response.StatusCode}): {body}");

        var parsed = JsonSerializer.Deserialize<ChaptersResponse>(body, JsonOptions);
        if (parsed?.Chapters is not { Count: > 0 } chapters)
            return [];

        return chapters
            .Where(c => c.Title is not null)
            .Select(c => new TranscriptChapter(c.Title!, c.Summary, c.StartTime, c.EndTime))
            .ToList();
    }

    private void AddAuth(HttpRequestMessage request) =>
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", options.ApiKey);

    private record JobConfig(
        [property: JsonPropertyName("type")] string Type,
        [property: JsonPropertyName("transcription_config")] TranscriptionConfig TranscriptionConfig,
        [property: JsonPropertyName("auto_chapters_config")] AutoChaptersConfig AutoChaptersConfig);

    private record TranscriptionConfig(
        [property: JsonPropertyName("language")] string Language,
        [property: JsonPropertyName("model")] string Model,
        [property: JsonPropertyName("diarization")] string Diarization,
        [property: JsonPropertyName("language_identification_config")] LanguageIdentificationConfig? LanguageIdentificationConfig);

    private record LanguageIdentificationConfig(
        [property: JsonPropertyName("expected_languages")] string[] ExpectedLanguages,
        [property: JsonPropertyName("low_confidence_action")] string LowConfidenceAction);

    /// <summary>Empty object enables the feature with defaults — Speechmatics' documented config shape.</summary>
    private record AutoChaptersConfig;

    private record CreateJobResponse([property: JsonPropertyName("id")] string? Id);

    private record JobStatusResponse([property: JsonPropertyName("job")] JobStatus? Job);

    private record JobStatus([property: JsonPropertyName("status")] string? Status);

    private record ChaptersResponse([property: JsonPropertyName("chapters")] List<ChapterJson>? Chapters);

    private record ChapterJson(
        [property: JsonPropertyName("title")] string? Title,
        [property: JsonPropertyName("summary")] string? Summary,
        [property: JsonPropertyName("start_time")] double StartTime,
        [property: JsonPropertyName("end_time")] double EndTime);
}
