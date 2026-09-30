using Platform.Api.AI;
using Platform.Domain;

namespace Platform.Api.IntegrationTests.Fixtures;

/// <summary>
/// Replaces the real Deepgram/Speechmatics/Gemini transcription provider in every integration
/// test — same reasoning as <see cref="FakeAiModelProvider"/>: these tests exist to prove the
/// mode-selection/credit-charge/background-job plumbing around a transcription call is correct,
/// not to exercise a real vendor. Deterministic, instant, no external dependency (no live
/// GeminiTranscription:ApiKey required in CI). Echoes <paramref name="inputMode"/> back into the
/// returned text so a test can assert which mode the background job actually ran with, purely
/// from the resulting transcript, without reaching into internals.
/// </summary>
public class FakeAudioTranscriptionProvider : IAudioTranscriptionProvider
{
    public Task<TranscriptionResult> TranscribeAsync(string filePath, string fileName, string? languageOverride = null,
        TranscriptionInputMode inputMode = TranscriptionInputMode.Audio, CancellationToken ct = default)
        => Task.FromResult(new TranscriptionResult($"Fake transcript ({inputMode}) for integration testing.", [], []));
}
