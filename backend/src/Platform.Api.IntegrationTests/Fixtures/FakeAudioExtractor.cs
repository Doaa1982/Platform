using Platform.Api.AI;

namespace Platform.Api.IntegrationTests.Fixtures;

/// <summary>
/// Replaces the real FFmpeg-backed <see cref="AudioExtractor"/> in every integration test — same
/// reasoning as <see cref="FakeAiModelProvider"/>/<see cref="FakeAudioTranscriptionProvider"/>:
/// proving the surrounding plumbing is correct shouldn't require downloading a real ~70-100MB
/// ffmpeg binary (and running a real conversion) in every CI run. Just copies the source file to
/// a new temp path — TranscriptionBackgroundService's "delete the extracted file afterward"
/// cleanup still exercises a real, distinct file, the same shape a real extraction would leave.
/// </summary>
public class FakeAudioExtractor : IAudioExtractor
{
    public bool? IsAvailable => true; // never exercises the ffmpeg-unavailable fallback path in these tests

    public Task<bool> ProbeAsync(CancellationToken ct = default) => Task.FromResult(true);

    public async Task<string> ExtractAsync(string sourcePath, CancellationToken ct)
    {
        var outputPath = Path.Combine(Path.GetTempPath(), $"fake-extracted-audio-{Guid.NewGuid():N}.tmp");
        await using var source = File.OpenRead(sourcePath);
        await using var destination = File.Create(outputPath);
        await source.CopyToAsync(destination, ct);
        return outputPath;
    }
}
