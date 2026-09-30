using Platform.Api.AI;

namespace Platform.Api.IntegrationTests.Fixtures;

/// <summary>
/// Simulates ffmpeg being missing/broken — swapped in (via WithWebHostBuilder, same per-test
/// override pattern used elsewhere in these tests) for the specific tests that exercise
/// ContentStudioService.GenerateTranscriptAsync's fallback: a Gemini request falls back to
/// VideoLowRes, a non-Gemini request is refused up front. ExtractAsync should never actually be
/// called in either case — it throws if it somehow is, so a bug that calls it anyway fails loudly.
/// </summary>
public class UnavailableAudioExtractor : IAudioExtractor
{
    public bool? IsAvailable => false;

    public Task<bool> ProbeAsync(CancellationToken ct = default) => Task.FromResult(false);

    public Task<string> ExtractAsync(string sourcePath, CancellationToken ct)
        => throw new InvalidOperationException("ExtractAsync should never be called when IsAvailable is false.");
}
