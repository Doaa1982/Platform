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
/// </summary>
public class SpeechmaticsTranscriptionProvider(HttpClient http, SpeechmaticsOptions options) : IAudioTranscriptionProvider
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<string> TranscribeAsync(string filePath, string fileName, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(options.ApiKey))
            throw new InvalidOperationException(
                "Speechmatics:ApiKey is not configured. Set it in appsettings.Development.json or user secrets before requesting a transcript.");

        var jobId = await SubmitJobAsync(filePath, fileName, ct);
        await WaitForCompletionAsync(jobId, ct);
        return await FetchTranscriptAsync(jobId, ct);
    }

    private async Task<string> SubmitJobAsync(string filePath, string fileName, CancellationToken ct)
    {
        var config = JsonSerializer.Serialize(new JobConfig(
            Type: "transcription",
            TranscriptionConfig: new TranscriptionConfig(options.Language, options.Model)), JsonOptions);

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

    private async Task<string> FetchTranscriptAsync(string jobId, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, $"jobs/{jobId}/transcript?format=txt");
        AddAuth(request);

        using var response = await http.SendAsync(request, ct);
        var body = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException($"Fetching the Speechmatics transcript failed ({(int)response.StatusCode}): {body}");

        return body.Trim();
    }

    private void AddAuth(HttpRequestMessage request) =>
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", options.ApiKey);

    private record JobConfig(
        [property: JsonPropertyName("type")] string Type,
        [property: JsonPropertyName("transcription_config")] TranscriptionConfig TranscriptionConfig);

    private record TranscriptionConfig(
        [property: JsonPropertyName("language")] string Language,
        [property: JsonPropertyName("model")] string Model);

    private record CreateJobResponse([property: JsonPropertyName("id")] string? Id);

    private record JobStatusResponse([property: JsonPropertyName("job")] JobStatus? Job);

    private record JobStatus([property: JsonPropertyName("status")] string? Status);
}
