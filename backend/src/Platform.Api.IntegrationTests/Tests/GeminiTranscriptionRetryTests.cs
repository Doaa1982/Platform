using System.Net;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Time.Testing;
using Platform.Api.AI;
using Platform.Domain;
using Xunit;

namespace Platform.Api.IntegrationTests.Tests;

/// <summary>
/// GeminiTranscriptionProvider retries only 429/503 on the generateContent call itself (see its
/// own remarks on RetryDelays for why only that one call, not the file-upload calls). Uses
/// FakeTimeProvider so these run in milliseconds rather than actually waiting 60s+ per case.
/// </summary>
public class GeminiTranscriptionRetryTests
{
    private sealed class StubHandler(Queue<(HttpStatusCode Status, string Body)> responses, List<string> requestUris) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            requestUris.Add(request.RequestUri!.ToString());
            var (status, body) = responses.Dequeue();
            return Task.FromResult(new HttpResponseMessage(status) { Content = new StringContent(body) });
        }
    }

    private const string SuccessBody = """
        {"candidates":[{"content":{"parts":[{"text":"hello world"}]}}],
         "usageMetadata":{"promptTokenCount":10,"candidatesTokenCount":5,"totalTokenCount":15}}
        """;
    private const string BusyBody = """{"error":{"code":503,"message":"high demand","status":"UNAVAILABLE"}}""";
    private const string RateLimitedBody = """{"error":{"code":429,"message":"rate limited","status":"RESOURCE_EXHAUSTED"}}""";
    private const string BadRequestBody = """{"error":{"code":400,"message":"bad request","status":"INVALID_ARGUMENT"}}""";

    /// <summary>Runs the call to completion while advancing the fake clock past any pending retry delay — a real Task.Delay(timeProvider) wait never actually elapses wall-clock time here.</summary>
    private static async Task<TranscriptionResult> RunWithAdvancingClockAsync(
        GeminiTranscriptionProvider provider, string filePath, FakeTimeProvider timeProvider, CancellationToken ct)
    {
        var task = provider.TranscribeAsync(filePath, "lesson.m4a", null, TranscriptionInputMode.Audio, ct);
        for (var i = 0; i < 100 && !task.IsCompleted; i++)
        {
            await Task.Delay(5, ct); // let the provider's code actually reach its Task.Delay(...) await point
            timeProvider.Advance(TimeSpan.FromMinutes(10)); // past any of the 60/120/240s schedule
        }
        return await task;
    }

    private static async Task<string> NewTempFileAsync()
    {
        var path = Path.GetTempFileName();
        await File.WriteAllBytesAsync(path, [1, 2, 3, 4]);
        return path;
    }

    [Fact]
    public async Task Retries503ThenSucceeds_WithoutWaitingRealTime()
    {
        var requestUris = new List<string>();
        var responses = new Queue<(HttpStatusCode, string)>([
            (HttpStatusCode.ServiceUnavailable, BusyBody),
            (HttpStatusCode.OK, SuccessBody),
        ]);
        using var http = new HttpClient(new StubHandler(responses, requestUris)) { BaseAddress = new Uri("https://generativelanguage.googleapis.com/") };
        var options = new GeminiTranscriptionOptions { ApiKey = "test-key" };
        var timeProvider = new FakeTimeProvider();
        var provider = new GeminiTranscriptionProvider(http, options, NullLogger<GeminiTranscriptionProvider>.Instance, timeProvider);
        var filePath = await NewTempFileAsync();

        try
        {
            var result = await RunWithAdvancingClockAsync(provider, filePath, timeProvider, default);

            Assert.Equal("hello world", result.Text);
            Assert.Equal(2, requestUris.Count); // one failed attempt, one retry
        }
        finally { File.Delete(filePath); }
    }

    [Fact]
    public async Task Retries429ThenSucceeds()
    {
        var requestUris = new List<string>();
        var responses = new Queue<(HttpStatusCode, string)>([
            (HttpStatusCode.TooManyRequests, RateLimitedBody),
            (HttpStatusCode.OK, SuccessBody),
        ]);
        using var http = new HttpClient(new StubHandler(responses, requestUris)) { BaseAddress = new Uri("https://generativelanguage.googleapis.com/") };
        var options = new GeminiTranscriptionOptions { ApiKey = "test-key" };
        var timeProvider = new FakeTimeProvider();
        var provider = new GeminiTranscriptionProvider(http, options, NullLogger<GeminiTranscriptionProvider>.Instance, timeProvider);
        var filePath = await NewTempFileAsync();

        try
        {
            var result = await RunWithAdvancingClockAsync(provider, filePath, timeProvider, default);
            Assert.Equal("hello world", result.Text);
        }
        finally { File.Delete(filePath); }
    }

    [Fact]
    public async Task GivesUpAfterExhaustingAllRetries_WithTheLastFailuresMessage()
    {
        var requestUris = new List<string>();
        // 1 initial attempt + 3 retries (RetryDelays.Length) = 4 total attempts, all busy.
        var responses = new Queue<(HttpStatusCode, string)>([
            (HttpStatusCode.ServiceUnavailable, BusyBody),
            (HttpStatusCode.ServiceUnavailable, BusyBody),
            (HttpStatusCode.ServiceUnavailable, BusyBody),
            (HttpStatusCode.ServiceUnavailable, BusyBody),
        ]);
        using var http = new HttpClient(new StubHandler(responses, requestUris)) { BaseAddress = new Uri("https://generativelanguage.googleapis.com/") };
        var options = new GeminiTranscriptionOptions { ApiKey = "test-key" };
        var timeProvider = new FakeTimeProvider();
        var provider = new GeminiTranscriptionProvider(http, options, NullLogger<GeminiTranscriptionProvider>.Instance, timeProvider);
        var filePath = await NewTempFileAsync();

        try
        {
            var ex = await Assert.ThrowsAsync<InvalidOperationException>(
                () => RunWithAdvancingClockAsync(provider, filePath, timeProvider, default));

            Assert.Contains("503", ex.Message);
            Assert.Equal(4, requestUris.Count);
        }
        finally { File.Delete(filePath); }
    }

    [Fact]
    public async Task ANonRetryableStatus_FailsImmediately_WithNoRetry()
    {
        var requestUris = new List<string>();
        var responses = new Queue<(HttpStatusCode, string)>([(HttpStatusCode.BadRequest, BadRequestBody)]);
        using var http = new HttpClient(new StubHandler(responses, requestUris)) { BaseAddress = new Uri("https://generativelanguage.googleapis.com/") };
        var options = new GeminiTranscriptionOptions { ApiKey = "test-key" };
        var timeProvider = new FakeTimeProvider();
        var provider = new GeminiTranscriptionProvider(http, options, NullLogger<GeminiTranscriptionProvider>.Instance, timeProvider);
        var filePath = await NewTempFileAsync();

        try
        {
            var ex = await Assert.ThrowsAsync<InvalidOperationException>(
                () => RunWithAdvancingClockAsync(provider, filePath, timeProvider, default));

            Assert.Contains("400", ex.Message);
            Assert.Single(requestUris); // no retry attempted for a non-429/503 failure
        }
        finally { File.Delete(filePath); }
    }
}
