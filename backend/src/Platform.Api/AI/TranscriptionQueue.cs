using System.Threading.Channels;

namespace Platform.Api.AI;

/// <summary>
/// One transcription request, enough for the background worker to find the
/// revision again and load the video file without re-deriving anything the
/// controller already resolved.
/// </summary>
public record TranscriptionJob(Guid WorkspaceId, Guid LessonId, Guid LessonRevisionId, string FilePath, string FileName);

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
