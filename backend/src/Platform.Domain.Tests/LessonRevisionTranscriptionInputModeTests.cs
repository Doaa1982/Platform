namespace Platform.Domain.Tests;

/// <summary>Coverage for LessonRevision.TranscriptionInputMode — the tutor's per-transcription Audio/VideoLowRes choice, recorded by BeginTranscription and cleared alongside the rest of the transcript.</summary>
public class LessonRevisionTranscriptionInputModeTests
{
    private static LessonRevision NewDraftWithVideo()
    {
        var lesson = Lesson.Create(Guid.NewGuid(), Guid.NewGuid(), "Fractions", Guid.NewGuid());
        var draft = lesson.DraftRevision!;
        draft.AttachVideo(Guid.NewGuid());
        return draft;
    }

    [Fact]
    public void BeginTranscription_RecordsTheModeImmediately_EvenBeforeTheAttemptResolves()
    {
        var draft = NewDraftWithVideo();

        draft.BeginTranscription(TranscriptionInputMode.VideoLowRes);

        Assert.Equal(TranscriptionInputMode.VideoLowRes, draft.TranscriptionInputMode);
    }

    [Fact]
    public void BeginTranscription_ModeSurvivesThroughToFailed_SoATutorCanSeeWhatWasTried()
    {
        var draft = NewDraftWithVideo();
        var jobId = draft.BeginTranscription(TranscriptionInputMode.VideoLowRes);

        draft.FailTranscription(jobId, "Provider timed out.");

        Assert.Equal(TranscriptStatus.Failed, draft.TranscriptStatus);
        Assert.Equal(TranscriptionInputMode.VideoLowRes, draft.TranscriptionInputMode);
    }

    [Fact]
    public void BeginTranscription_ModeSurvivesThroughToReady()
    {
        var draft = NewDraftWithVideo();
        var jobId = draft.BeginTranscription(TranscriptionInputMode.Audio);

        draft.CompleteTranscription(jobId, "Transcript text.");

        Assert.Equal(TranscriptStatus.Ready, draft.TranscriptStatus);
        Assert.Equal(TranscriptionInputMode.Audio, draft.TranscriptionInputMode);
    }

    [Fact]
    public void ANewTranscriptionAttempt_OverwritesThePreviousAttemptsMode()
    {
        var draft = NewDraftWithVideo();
        var firstJobId = draft.BeginTranscription(TranscriptionInputMode.VideoLowRes);
        draft.FailTranscription(firstJobId, "Failed once.");

        draft.BeginTranscription(TranscriptionInputMode.Audio);

        Assert.Equal(TranscriptionInputMode.Audio, draft.TranscriptionInputMode);
    }

    [Fact]
    public void ReplacingTheVideo_ClearsTheRecordedMode_AlongsideTheRestOfTheTranscript()
    {
        var draft = NewDraftWithVideo();
        var jobId = draft.BeginTranscription(TranscriptionInputMode.VideoLowRes);
        draft.CompleteTranscription(jobId, "Old transcript.");

        draft.AttachVideo(Guid.NewGuid()); // ClearTranscript()'s trigger, same as SetVideoUrl/RemoveVideo

        Assert.Null(draft.TranscriptionInputMode);
    }

    [Fact]
    public void CopyContentFrom_ANotProcessingSource_CopiesItsMode()
    {
        var lesson = Lesson.Create(Guid.NewGuid(), Guid.NewGuid(), "Fractions", Guid.NewGuid());
        var draft = lesson.DraftRevision!;
        draft.Edit("Fractions", "Body", 30, LessonDeliveryMode.Recorded);
        draft.AttachVideo(Guid.NewGuid());
        var jobId = draft.BeginTranscription(TranscriptionInputMode.VideoLowRes);
        draft.CompleteTranscription(jobId, "Ready transcript.");
        lesson.PublishDraft();
        var published = lesson.CurrentRevision!;

        var newDraft = lesson.StartRevision(Guid.NewGuid());
        newDraft.CopyContentFrom(published);

        Assert.Equal(TranscriptionInputMode.VideoLowRes, newDraft.TranscriptionInputMode);
    }

    [Fact]
    public void CopyContentFrom_AProcessingSource_StartsCleanWithNoMode()
    {
        var lesson = Lesson.Create(Guid.NewGuid(), Guid.NewGuid(), "Fractions", Guid.NewGuid());
        var draft = lesson.DraftRevision!;
        draft.Edit("Fractions", "Body", 30, LessonDeliveryMode.Recorded);
        draft.AttachVideo(Guid.NewGuid());
        draft.BeginTranscription(TranscriptionInputMode.VideoLowRes); // still Processing — never resolved
        lesson.PublishDraft();
        var published = lesson.CurrentRevision!;

        var newDraft = lesson.StartRevision(Guid.NewGuid());
        newDraft.CopyContentFrom(published);

        Assert.Null(newDraft.TranscriptionInputMode);
    }
}
