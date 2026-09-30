using Microsoft.Extensions.Logging.Abstractions;
using Platform.Api.AI;
using Xunit;

namespace Platform.Api.IntegrationTests.Tests;

/// <summary>
/// AudioExtractor.ResolveExecutablePath's three-way path resolution (Transcription:FfmpegPath):
/// a bare command name is left for the OS to resolve from PATH, a rooted path is used as-is, and
/// anything else is resolved relative to AppContext.BaseDirectory (where the CI-published
/// "tools/ffmpeg" actually lands on Azure App Service). Deliberately doesn't require a real
/// ffmpeg binary — the CI runner that runs `dotnet test` doesn't have one (it's downloaded in a
/// separate, later build step) — see ProbeAsync's own tests below for "not found" behaviour.
/// </summary>
public class AudioExtractorPathResolutionTests
{
    [Fact]
    public void ABareCommandName_IsLeftAsIs_ForTheOsToResolveFromPath()
    {
        Assert.Equal("ffmpeg", AudioExtractor.ResolveExecutablePath("ffmpeg"));
    }

    [Fact]
    public void ARootedAbsolutePath_IsUsedExactlyAsGiven()
    {
        var rooted = OperatingSystem.IsWindows() ? @"C:\tools\ffmpeg.exe" : "/usr/local/bin/ffmpeg";
        Assert.Equal(rooted, AudioExtractor.ResolveExecutablePath(rooted));
    }

    [Fact]
    public void ARelativePathWithASeparator_IsResolvedAgainstAppContextBaseDirectory()
    {
        var resolved = AudioExtractor.ResolveExecutablePath("tools/ffmpeg");

        Assert.Equal(Path.Combine(AppContext.BaseDirectory, "tools/ffmpeg"), resolved);
        Assert.True(Path.IsPathRooted(resolved)); // never a second relative hop from an unpredictable cwd
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public void AnEmptyOrMissingConfiguredPath_FallsBackToTheBareFfmpegCommand(string? configured)
    {
        Assert.Equal("ffmpeg", AudioExtractor.ResolveExecutablePath(configured!));
    }

    // ── ProbeAsync: "can't be found/executed" is detected, not thrown ───────────────────

    [Fact]
    public async Task ProbeAsync_AgainstAPathThatDoesNotExist_ReturnsFalse_WithoutThrowing()
    {
        var options = new TranscriptionOptions { FfmpegPath = $"/definitely/not/a/real/path-{Guid.NewGuid():N}/ffmpeg" };
        var extractor = new AudioExtractor(options, NullLogger<AudioExtractor>.Instance);

        var available = await extractor.ProbeAsync();

        Assert.False(available);
        Assert.False(extractor.IsAvailable);
    }

    [Fact]
    public async Task ProbeAsync_CachesItsResult_OnlyProbingOnce()
    {
        var options = new TranscriptionOptions { FfmpegPath = $"/definitely/not/a/real/path-{Guid.NewGuid():N}/ffmpeg" };
        var extractor = new AudioExtractor(options, NullLogger<AudioExtractor>.Instance);

        var first = await extractor.ProbeAsync();
        var second = await extractor.ProbeAsync(); // must not re-probe or throw differently

        Assert.Equal(first, second);
    }

    [Fact]
    public void IsAvailable_IsNullBeforeProbeAsyncHasEverRun()
    {
        var options = new TranscriptionOptions { FfmpegPath = "ffmpeg" };
        var extractor = new AudioExtractor(options, NullLogger<AudioExtractor>.Instance);

        Assert.Null(extractor.IsAvailable);
    }
}
