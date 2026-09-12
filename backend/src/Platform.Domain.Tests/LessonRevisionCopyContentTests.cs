namespace Platform.Domain.Tests;

/// <summary>
/// LessonRevision.CopyContentFrom — Rule 13 (revised): a new Draft starts as
/// a full copy of the revision it was started from, including the video,
/// its transcript, and the completion-gating toggle, not just the "safe
/// metadata" subset Edit() already covered.
/// </summary>
public class LessonRevisionCopyContentTests
{
    private static (Lesson Lesson, LessonRevision Published) NewLessonWithPublishedVideo()
    {
        var lesson = Lesson.Create(Guid.NewGuid(), Guid.NewGuid(), "Fractions", Guid.NewGuid());
        var draft = lesson.DraftRevision!;
        draft.Edit("Fractions", "Some body content.", 30, LessonDeliveryMode.Recorded);
        draft.AttachVideo(Guid.NewGuid());
        var jobId = draft.BeginTranscription();
        draft.CompleteTranscription(jobId, "Full transcript text.", chaptersJson: "[{\"title\":\"Intro\"}]", segmentsJson: "[{\"text\":\"hi\"}]");
        draft.SetRequireQuizToComplete(true);
        lesson.PublishDraft();
        return (lesson, lesson.CurrentRevision!);
    }

    [Fact]
    public void CopyContentFrom_CarriesOverVideoTranscriptAndCompletionToggle()
    {
        var (lesson, published) = NewLessonWithPublishedVideo();
        var newDraft = lesson.StartRevision(Guid.NewGuid());

        newDraft.CopyContentFrom(published);

        Assert.Equal(published.VideoAssetId, newDraft.VideoAssetId);
        Assert.Equal(published.Transcript, newDraft.Transcript);
        Assert.Equal(published.TranscriptStatus, newDraft.TranscriptStatus);
        Assert.Equal(published.TranscriptChaptersJson, newDraft.TranscriptChaptersJson);
        Assert.Equal(published.TranscriptSegmentsJson, newDraft.TranscriptSegmentsJson);
        Assert.Equal(published.TranscriptSource, newDraft.TranscriptSource);
        Assert.True(newDraft.RequireQuizToComplete);
    }

    [Fact]
    public void CopyContentFrom_OnANonDraftRevision_Throws()
    {
        var (_, published) = NewLessonWithPublishedVideo();
        var other = Lesson.Create(Guid.NewGuid(), Guid.NewGuid(), "Other", Guid.NewGuid()).DraftRevision!;

        // published is the target (`this`) here — RequireDraft() rejects it regardless of the source's own status.
        Assert.Throws<InvalidOperationException>(() => published.CopyContentFrom(other));
    }

    [Fact]
    public void ReplacingTheVideoAfterCopy_StillClearsTheCarriedOverTranscript()
    {
        var (lesson, published) = NewLessonWithPublishedVideo();
        var newDraft = lesson.StartRevision(Guid.NewGuid());
        newDraft.CopyContentFrom(published);

        newDraft.AttachVideo(Guid.NewGuid());

        Assert.Null(newDraft.Transcript);
        Assert.Equal(TranscriptStatus.None, newDraft.TranscriptStatus);
    }
}
