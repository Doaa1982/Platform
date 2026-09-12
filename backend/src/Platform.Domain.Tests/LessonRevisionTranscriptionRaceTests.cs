namespace Platform.Domain.Tests;

/// <summary>
/// LessonRevision's transcription lifecycle used to track only a coarse
/// TranscriptStatus.Processing flag — no notion of *which* attempt was
/// running. A background job whose result arrived after the revision had
/// already moved on (video replaced, or transcription re-run, while the
/// first job was still in flight) could either silently vanish (a real
/// completion/failure the guard happened to reject) or silently corrupt the
/// newer attempt (a stale result the guard happened to accept, because the
/// enum state coincidentally matched). BeginTranscription now hands back a
/// job id that CompleteTranscription/FailTranscription must match — these
/// tests cover that only the current attempt can ever resolve the revision.
/// </summary>
public class LessonRevisionTranscriptionRaceTests
{
    private static LessonRevision NewDraftWithVideo()
    {
        var lesson = Lesson.Create(Guid.NewGuid(), Guid.NewGuid(), "Fractions", Guid.NewGuid());
        var draft = lesson.DraftRevision!;
        draft.AttachVideo(Guid.NewGuid());
        return draft;
    }

    [Fact]
    public void CompleteTranscription_WithTheCurrentJobId_Succeeds()
    {
        var draft = NewDraftWithVideo();
        var jobId = draft.BeginTranscription();

        var applied = draft.CompleteTranscription(jobId, "Transcript text.");

        Assert.True(applied);
        Assert.Equal(TranscriptStatus.Ready, draft.TranscriptStatus);
        Assert.Equal("Transcript text.", draft.Transcript);
        Assert.Null(draft.TranscriptionJobId);
    }

    [Fact]
    public void FailTranscription_WithTheCurrentJobId_Succeeds()
    {
        var draft = NewDraftWithVideo();
        var jobId = draft.BeginTranscription();

        var applied = draft.FailTranscription(jobId, "Provider timed out.");

        Assert.True(applied);
        Assert.Equal(TranscriptStatus.Failed, draft.TranscriptStatus);
        Assert.Equal("Provider timed out.", draft.TranscriptError);
        Assert.Null(draft.TranscriptionJobId);
    }

    [Fact]
    public void CompleteTranscription_WithAStaleJobId_IsIgnoredAndDoesNotTouchTheCurrentAttempt()
    {
        var draft = NewDraftWithVideo();
        var staleJobId = draft.BeginTranscription();

        // The video is replaced while the first job is still in flight —
        // AttachVideo clears the transcript back to None (also abandoning
        // staleJobId), matching what a tutor swapping the video mid-generation
        // actually does.
        draft.AttachVideo(Guid.NewGuid());
        var currentJobId = draft.BeginTranscription();

        // The abandoned job's result arrives late.
        var applied = draft.CompleteTranscription(staleJobId, "Wrong video's transcript.");

        Assert.False(applied);
        Assert.Equal(TranscriptStatus.Processing, draft.TranscriptStatus);
        Assert.Null(draft.Transcript);
        Assert.Equal(currentJobId, draft.TranscriptionJobId);
    }

    [Fact]
    public void FailTranscription_WithAStaleJobId_DoesNotFailTheCurrentAttempt()
    {
        var draft = NewDraftWithVideo();
        var staleJobId = draft.BeginTranscription();

        draft.AttachVideo(Guid.NewGuid());
        var currentJobId = draft.BeginTranscription();

        var applied = draft.FailTranscription(staleJobId, "Wrong video's failure.");

        Assert.False(applied);
        Assert.Equal(TranscriptStatus.Processing, draft.TranscriptStatus);
        Assert.Null(draft.TranscriptError);
        Assert.Equal(currentJobId, draft.TranscriptionJobId);
    }

    [Fact]
    public void CompleteTranscription_AfterAlreadyResolved_IsIgnored()
    {
        var draft = NewDraftWithVideo();
        var jobId = draft.BeginTranscription();
        draft.CompleteTranscription(jobId, "First result.");

        // The same job somehow reports a second time (e.g. a duplicate
        // message) — the revision already moved on to Ready.
        var appliedAgain = draft.CompleteTranscription(jobId, "Second result.");

        Assert.False(appliedAgain);
        Assert.Equal("First result.", draft.Transcript);
    }

    [Fact]
    public void CopyContentFrom_WhenSourceIsStillProcessing_StartsCleanInsteadOfCopyingAnUnresolvableState()
    {
        var lesson = Lesson.Create(Guid.NewGuid(), Guid.NewGuid(), "Fractions", Guid.NewGuid());
        var draft = lesson.DraftRevision!;
        draft.Edit("Fractions", "Some body content.", 30, LessonDeliveryMode.Recorded);
        draft.AttachVideo(Guid.NewGuid());
        draft.BeginTranscription();
        lesson.PublishDraft();
        var published = lesson.CurrentRevision!;

        var newDraft = lesson.StartRevision(Guid.NewGuid());
        newDraft.CopyContentFrom(published);

        // The running job targets `published`'s id, not newDraft's — copying
        // "Processing" here would leave newDraft stuck forever.
        Assert.Equal(TranscriptStatus.None, newDraft.TranscriptStatus);
        Assert.Null(newDraft.TranscriptionJobId);
    }
}
