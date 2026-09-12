using System.Threading.Channels;

namespace Platform.Api.AI;

/// <summary>
/// One transcription request, enough for the background worker to find the
/// revision again and load the video file without re-deriving anything the
/// controller already resolved. Exactly one of <see cref="FilePath"/> (an
/// uploaded asset, already on local disk) or <see cref="SourceUrl"/> (a
/// direct-file video URL — the worker downloads it to a temp file first) is
/// set; the worker deletes the file afterward only when it downloaded it.
/// <see cref="JobId"/> is the id LessonRevision.BeginTranscription handed
/// back when this job was created — carried through to
/// CompleteTranscription/FailTranscription so a job superseded while still in
/// flight (video replaced, or transcription re-run) can be told apart from
/// the current attempt instead of matching it by coincidence.
/// <see cref="Language"/> null defers to the provider's own configured default
/// (Automatic Language Identification for Speechmatics); a tutor-supplied
/// "en"/"ar" pins it instead — added after ALI confidently mistranscribed a
/// real, heavily code-switched lesson video entirely in the wrong language.
/// </summary>
public record TranscriptionJob(
    Guid WorkspaceId, Guid LessonId, Guid LessonRevisionId, string FileName, Guid JobId,
    string? FilePath = null, string? SourceUrl = null, string? Language = null);

/// <summary>
/// In-process work queue for transcription jobs (AI Video Transcript
/// Implementation Plan §6). Deliberately the simplest thing that works at
/// this scale — a single unbounded <see cref="Channel{T}"/>, one background
/// worker draining it (see <see cref="TranscriptionBackgroundService"/>), no
/// external broker. A job in flight is lost if the process restarts — an
/// accepted limitation for a prototype, called out in the implementation
/// plan as worth revisiting before this is a production feature.
/// </summary>
public class TranscriptionQueue
{
    private readonly Channel<TranscriptionJob> _channel = Channel.CreateUnbounded<TranscriptionJob>();

    public void Enqueue(TranscriptionJob job) => _channel.Writer.TryWrite(job);

    public ChannelReader<TranscriptionJob> Reader => _channel.Reader;
}
