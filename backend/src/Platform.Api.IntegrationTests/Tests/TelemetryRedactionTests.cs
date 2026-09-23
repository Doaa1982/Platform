using System.Collections.Concurrent;
using System.Diagnostics;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using OpenTelemetry;
using OpenTelemetry.Trace;
using Platform.Api.IntegrationTests.Fixtures;
using Xunit;

namespace Platform.Api.IntegrationTests.Tests;

/// <summary>
/// Query-string values — asset tokens (t), presigned-URL signatures (X-Amz-*), anything — must not appear in an
/// exported trace or in a log line. Proved against a real host with a capturing trace processor and a capturing
/// log provider, with positive controls so the test can't pass by capturing nothing.
/// </summary>
public class TelemetryRedactionTests
{
    // ── the helper ───────────────────────────────────────────────────────

    [Theory]
    [InlineData("?t=abc123", "t=REDACTED")]
    [InlineData("t=abc123", "t=REDACTED")]
    [InlineData("?t=abc&d=attachment", "t=REDACTED&d=REDACTED")]
    [InlineData("?X-Amz-Signature=deadbeef&X-Amz-Credential=AKIA%2F2026%2Fauto&X-Amz-Expires=3600",
        "X-Amz-Signature=REDACTED&X-Amz-Credential=REDACTED&X-Amz-Expires=REDACTED")]
    [InlineData("?flag", "flag=REDACTED")]
    [InlineData("?a=1&&b=2", "a=REDACTED&b=REDACTED")]
    [InlineData("?", "")]
    [InlineData("", "")]
    public void RedactQuery_KeepsNamesAndReplacesEveryValue(string query, string expected)
    {
        Assert.Equal(expected, Microsoft.Extensions.Hosting.TelemetryRedaction.RedactQuery(query));
    }

    [Fact]
    public void RedactQuery_LeavesNullAlone()
    {
        Assert.Null(Microsoft.Extensions.Hosting.TelemetryRedaction.RedactQuery(null));
    }

    [Fact]
    public void RedactUrl_RedactsTheQueryAndDropsTheFragment()
    {
        var url = Microsoft.Extensions.Hosting.TelemetryRedaction.RedactUrl(
            new Uri("https://bucket.r2.cloudflarestorage.com/key.mp4?X-Amz-Signature=sig&uploadId=u1#access_token=zzz"));

        Assert.Equal("https://bucket.r2.cloudflarestorage.com/key.mp4?X-Amz-Signature=REDACTED&uploadId=REDACTED", url);
    }

    // ── a real host ──────────────────────────────────────────────────────

    public sealed class Hosted(AssetAccessFixture fixture) : IClassFixture<AssetAccessFixture>
    {
        private const string SecretToken = "TOKEN-VALUE-SHOULD-NEVER-BE-EXPORTED-9f31";
        private const string SecretSignature = "SIGNATURE-VALUE-SHOULD-NEVER-BE-EXPORTED-77ab";
        private const string SecretCredential = "CREDENTIAL-VALUE-SHOULD-NEVER-BE-EXPORTED-c2d0";

        private sealed class SnapshotProcessor(ConcurrentBag<(string Source, List<KeyValuePair<string, string?>> Tags)> spans)
            : BaseProcessor<Activity>
        {
            public override void OnEnd(Activity data) =>
                spans.Add((data.Source.Name,
                    data.TagObjects.Select(t => new KeyValuePair<string, string?>(t.Key, t.Value?.ToString()))
                        .Concat(data.Baggage).ToList()));
        }

        private sealed class CapturingLoggerProvider(ConcurrentQueue<string> lines) : ILoggerProvider
        {
            public ILogger CreateLogger(string categoryName) => new Capture(categoryName, lines);
            public void Dispose() { }

            private sealed class Capture(string category, ConcurrentQueue<string> lines) : ILogger
            {
                public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
                public bool IsEnabled(LogLevel logLevel) => true;
                public void Log<TState>(LogLevel level, EventId id, TState state, Exception? ex, Func<TState, Exception?, string> fmt) =>
                    lines.Enqueue($"[{category}] {fmt(state, ex)} {ex}");
            }
        }

        [Fact]
        public async Task TracesAndLogs_NeverContainAQueryValue_WhileStillRecordingThatARequestHappened()
        {
            var spans = new ConcurrentBag<(string Source, List<KeyValuePair<string, string?>> Tags)>();
            var logs = new ConcurrentQueue<string>();

            using var host = fixture.Host.WithWebHostBuilder(b =>
            {
                // The worst case the pinned filter exists for: configuration turns ASP.NET Core request logging all the way up.
                b.UseSetting("Logging:LogLevel:Default", "Trace");
                b.UseSetting("Logging:LogLevel:Microsoft.AspNetCore", "Trace");
                b.ConfigureLogging(l =>
                {
                    l.AddProvider(new CapturingLoggerProvider(logs));
                    l.SetMinimumLevel(LogLevel.Trace);
                });
                b.ConfigureTestServices(s => s.ConfigureOpenTelemetryTracerProvider((_, t) => t.AddProcessor(new SnapshotProcessor(spans))));
            });
            var client = host.CreateClient();
            var w = fixture.World;

            var path = $"/api/workspaces/{w.Slug}/learning-assets/{w.Video1}/content";
            var query = $"?t={SecretToken}&X-Amz-Signature={SecretSignature}&X-Amz-Credential={SecretCredential}";
            var response = await client.GetAsync(path + query);
            Assert.Equal(System.Net.HttpStatusCode.NotFound, response.StatusCode); // an invalid token, as an attacker would send

            // The server span ends just after the response is delivered, so wait for it rather than race it.
            for (var waited = 0; waited < 100 && !spans.Any(s => s.Source == "Microsoft.AspNetCore"
                    && s.Tags.Any(t => t.Key == "url.path" && t.Value!.EndsWith("/content"))); waited++)
                await Task.Delay(50);

            // A server span for that request was captured, and its query is the redacted form (so our enrichment ran).
            var serverSpan = Assert.Single(spans, s => s.Source == "Microsoft.AspNetCore"
                && s.Tags.Any(t => t.Key == "url.path" && t.Value!.EndsWith("/content")));
            Assert.Equal("t=REDACTED&X-Amz-Signature=REDACTED&X-Amz-Credential=REDACTED",
                serverSpan.Tags.Single(t => t.Key == "url.query").Value);

            // Nothing anywhere in any captured span, and no log line, carries a secret.
            string[] secrets = [SecretToken, SecretSignature, SecretCredential];
            foreach (var (source, tags) in spans)
                foreach (var tag in tags)
                    foreach (var secret in secrets)
                        Assert.False((tag.Key + "=" + tag.Value).Contains(secret), $"span from {source} leaks via tag {tag.Key}");

            Assert.NotEmpty(logs); // positive control: the capturing provider really is attached
            foreach (var line in logs)
                foreach (var secret in secrets)
                    Assert.False(line.Contains(secret), $"a log line leaks a query value: {line}");
        }
    }
}
