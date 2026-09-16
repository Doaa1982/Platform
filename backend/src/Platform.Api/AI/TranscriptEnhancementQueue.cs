using System.Threading.Channels;

namespace Platform.Api.AI;

/// <summary>
/// One enhancement request — mirrors <see cref="TranscriptionJob"/>'s shape
/// and reasoning exactly, for the text-editing pipeline instead of the
/// speech-to-text one. <see cref="JobId"/> is the id
/// LessonRevision.BeginEnhancement handed back when this job was created,
/// carried through to CompleteEnhancement/FailEnhancement so a job superseded
/// while still in flight (raw transcript regenerated/replaced, or enhancement
/// re-run) can be told apart from the current attempt.
/// </summary>
public record TranscriptEnhancementJob(
    Guid WorkspaceId, Guid LessonId, Guid LessonRevisionId, Guid JobId, string RawTranscript, string LessonContext);

/// <summary>
/// In-process work queue for transcript-enhancement jobs — same "simplest
/// thing that works at this scale" reasoning as <see cref="TranscriptionQueue"/>,
/// a single unbounded <see cref="Channel{T}"/> drained by one background
/// worker (see <see cref="TranscriptEnhancementBackgroundService"/>). A job in
/// flight is lost if the process restarts — same accepted limitation, same
/// startup recovery sweep resolving any row left in Processing.
/// </summary>
public class TranscriptEnhancementQueue
{
    private readonly Channel<TranscriptEnhancementJob> _channel = Channel.CreateUnbounded<TranscriptEnhancementJob>();

    public void Enqueue(TranscriptEnhancementJob job) => _channel.Writer.TryWrite(job);

    public ChannelReader<TranscriptEnhancementJob> Reader => _channel.Reader;
}
