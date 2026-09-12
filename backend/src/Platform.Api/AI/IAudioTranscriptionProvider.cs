namespace Platform.Api.AI;

/// <summary>
/// One detected chapter of a transcription — a real, deterministic time range
/// the provider computed (AI Video-Grounded Questions Implementation Plan §2),
/// not something a downstream LLM has to estimate. <see cref="Title"/> and
/// <see cref="Summary"/> come from the provider's own chaptering model, if it
/// has one; a provider that can't chapter simply returns no chapters at all.
/// </summary>
public record TranscriptChapter(string Title, string? Summary, double StartSeconds, double EndSeconds);

/// <summary>
/// One raw ASR segment (a sentence or short phrase) with its own real start/end
/// time, as the speech-to-text engine produced it — finer-grained than
/// <see cref="TranscriptChapter"/>. Used to ground AI-suggested interactive
/// checkpoint timestamps in an actual moment from the video instead of a
/// number an LLM estimated (AI Video-Grounded Questions Implementation Plan).
/// Empty for providers that don't expose segment-level timing (e.g.
/// Speechmatics here, which is read only for its chapters).
/// </summary>
public record TranscriptSegment(double Start, double End, string Text);

/// <summary>
/// The result of one transcription attempt: the plain-text transcript, plus
/// whatever chapters the provider was able to detect (empty, not null, if
/// none — e.g. the video was too short for the provider's chaptering minimum),
/// plus whatever per-segment timing the provider exposes (also empty, not
/// null, when unavailable).
/// </summary>
public record TranscriptionResult(string Text, IReadOnlyList<TranscriptChapter> Chapters, IReadOnlyList<TranscriptSegment> Segments);

/// <summary>
/// The Platform's boundary to a specific speech-to-text vendor — the audio
/// equivalent of <see cref="IAiModelProvider"/>. Separate interface, not a
/// method on IAiModelProvider, because this is a genuinely different kind of
/// call (a file in, not a prompt; asynchronous by nature, not a single
/// request/response) handled by a different vendor (Claude doesn't do
/// speech-to-text) — AI Video Transcript Implementation Plan §2.
/// </summary>
public interface IAudioTranscriptionProvider
{
    /// <summary>
    /// Transcribes the video/audio file at <paramref name="filePath"/> and
    /// returns the plain-text transcript plus any detected chapters. May take
    /// a long time for a real video — callers must not call this from inside
    /// a request a user is waiting on; it belongs on a background worker (AI
    /// Video Transcript Implementation Plan §6). <paramref name="languageOverride"/>
    /// null defers to this provider's own configured default (e.g. Speechmatics'
    /// Automatic Language Identification); an ISO-639-1 code pins the language for
    /// this one job — a tutor-supplied override, since automatic detection has
    /// been observed to confidently pick the wrong language on real, heavily
    /// code-switched lesson audio.
    /// </summary>
    Task<TranscriptionResult> TranscribeAsync(string filePath, string fileName, string? languageOverride = null, CancellationToken ct = default);
}
