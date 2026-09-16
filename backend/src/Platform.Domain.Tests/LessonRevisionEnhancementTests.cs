namespace Platform.Domain.Tests;

/// <summary>
/// Covers LessonRevision's transcript-enhancement lifecycle: it must never
/// touch the raw Transcript field, must refuse to start without a Ready raw
/// transcript, must refuse a second concurrent attempt, and must use the same
/// job-id race-guard shape as transcription (a stale/superseded result must
/// not silently overwrite — or be silently swallowed by — the current one).
/// </summary>
public class LessonRevisionEnhancementTests
{
    private static LessonRevision NewDraftWithReadyTranscript(string transcript = "Raw transcript text.")
    {
        var lesson = Lesson.Create(Guid.NewGuid(), Guid.NewGuid(), "Fractions", Guid.NewGuid());
        var draft = lesson.DraftRevision!;
        draft.AttachVideo(Guid.NewGuid());
        var jobId = draft.BeginTranscription();
        draft.CompleteTranscription(jobId, transcript);
        return draft;
    }

    [Fact]
    public void BeginEnhancement_WithoutAReadyRawTranscript_Throws()
    {
        var lesson = Lesson.Create(Guid.NewGuid(), Guid.NewGuid(), "Fractions", Guid.NewGuid());
        var draft = lesson.DraftRevision!;

        Assert.Throws<InvalidOperationException>(() => draft.BeginEnhancement());
    }

    [Fact]
    public void BeginEnhancement_WhileAlreadyProcessing_Throws()
    {
        var draft = NewDraftWithReadyTranscript();
        draft.BeginEnhancement();

        Assert.Throws<InvalidOperationException>(() => draft.BeginEnhancement());
    }

    [Fact]
    public void CompleteEnhancement_WithTheCurrentJobId_SetsReadyAndNeverTouchesRawTranscript()
    {
        var draft = NewDraftWithReadyTranscript("Raw transcript text.");
        var jobId = draft.BeginEnhancement();

        var applied = draft.CompleteEnhancement(
            jobId, "Enhanced transcript text.", requiresReview: false,
            provider: "Claude", model: "claude-sonnet-5", promptVersion: "TranscriptEnhancement.System.v1");

        Assert.True(applied);
        Assert.Equal(EnhancementStatus.Ready, draft.EnhancementStatus);
        Assert.Equal("Enhanced transcript text.", draft.EnhancedTranscript);
        Assert.Equal("Raw transcript text.", draft.Transcript); // untouched
        Assert.Equal(TranscriptStatus.Ready, draft.TranscriptStatus); // untouched
        Assert.Equal(1, draft.EnhancementVersion);
        Assert.Null(draft.EnhancementJobId);
    }

    [Fact]
    public void CompleteEnhancement_WhenRequiresReviewIsTrue_SetsReviewRequiredNotReady()
    {
        var draft = NewDraftWithReadyTranscript();
        var jobId = draft.BeginEnhancement();

        var applied = draft.CompleteEnhancement(
            jobId, "Enhanced text with a flagged change.", requiresReview: true,
            provider: "Claude", model: "claude-sonnet-5", promptVersion: "TranscriptEnhancement.System.v1");

        Assert.True(applied);
        Assert.Equal(EnhancementStatus.ReviewRequired, draft.EnhancementStatus);
        // The text is still saved even though it needs review — a tutor must be able to read it.
        Assert.Equal("Enhanced text with a flagged change.", draft.EnhancedTranscript);
    }

    [Fact]
    public void FailEnhancement_WithTheCurrentJobId_Succeeds()
    {
        var draft = NewDraftWithReadyTranscript();
        var jobId = draft.BeginEnhancement();

        var applied = draft.FailEnhancement(jobId, "Model returned malformed JSON twice.");

        Assert.True(applied);
        Assert.Equal(EnhancementStatus.Failed, draft.EnhancementStatus);
        Assert.Equal("Model returned malformed JSON twice.", draft.EnhancementError);
        Assert.Null(draft.EnhancedTranscript);
        Assert.Null(draft.EnhancementJobId);
    }

    [Fact]
    public void FailEnhancement_NeverErasesAPreviousSuccessfulEnhancedTranscript()
    {
        var draft = NewDraftWithReadyTranscript();
        var firstJobId = draft.BeginEnhancement();
        draft.CompleteEnhancement(firstJobId, "First good enhancement.", requiresReview: false,
            provider: "Claude", model: "claude-sonnet-5", promptVersion: "v1");

        var retryJobId = draft.BeginEnhancement();
        draft.FailEnhancement(retryJobId, "Retry failed.");

        Assert.Equal(EnhancementStatus.Failed, draft.EnhancementStatus);
        Assert.Equal("First good enhancement.", draft.EnhancedTranscript);
    }

    [Fact]
    public void CompleteEnhancement_WithAStaleJobId_IsIgnoredAndDoesNotTouchTheCurrentAttempt()
    {
        var draft = NewDraftWithReadyTranscript();
        var staleJobId = draft.BeginEnhancement();
        draft.FailEnhancement(staleJobId, "First attempt failed.");
        var currentJobId = draft.BeginEnhancement();

        var applied = draft.CompleteEnhancement(staleJobId, "Late result from the dead attempt.", requiresReview: false,
            provider: "Claude", model: "claude-sonnet-5", promptVersion: "v1");

        Assert.False(applied);
        Assert.Equal(EnhancementStatus.Processing, draft.EnhancementStatus);
        Assert.Null(draft.EnhancedTranscript);
        Assert.Equal(currentJobId, draft.EnhancementJobId);
    }

    [Fact]
    public void FailEnhancement_WithAStaleJobId_DoesNotFailTheCurrentAttempt()
    {
        var draft = NewDraftWithReadyTranscript();
        var staleJobId = draft.BeginEnhancement();
        draft.FailEnhancement(staleJobId, "First attempt failed.");
        var currentJobId = draft.BeginEnhancement();

        var applied = draft.FailEnhancement(staleJobId, "Late failure from the dead attempt.");

        Assert.False(applied);
        Assert.Equal(EnhancementStatus.Processing, draft.EnhancementStatus);
        Assert.Equal(currentJobId, draft.EnhancementJobId);
    }

    [Fact]
    public void ANewRawTranscriptFromReTranscription_ClearsAnyExistingEnhancement()
    {
        var draft = NewDraftWithReadyTranscript("Original raw text.");
        var enhJobId = draft.BeginEnhancement();
        draft.CompleteEnhancement(enhJobId, "Enhanced version of the original text.", requiresReview: false,
            provider: "Claude", model: "claude-sonnet-5", promptVersion: "v1");
        Assert.Equal(EnhancementStatus.Ready, draft.EnhancementStatus);

        // Tutor re-runs transcription (e.g. a corrected upload) — a fresh raw
        // transcript arrives, making the old enhancement stale.
        var transcriptionJobId = draft.BeginTranscription();
        draft.CompleteTranscription(transcriptionJobId, "A completely different raw transcript.");

        Assert.Equal(EnhancementStatus.None, draft.EnhancementStatus);
        Assert.Null(draft.EnhancedTranscript);
        Assert.Equal(0, draft.EnhancementVersion);
    }

    [Fact]
    public void SetManualTranscript_ClearsAnyExistingEnhancement()
    {
        var draft = NewDraftWithReadyTranscript("Original raw text.");
        var enhJobId = draft.BeginEnhancement();
        draft.CompleteEnhancement(enhJobId, "Enhanced version.", requiresReview: false,
            provider: "Claude", model: "claude-sonnet-5", promptVersion: "v1");

        draft.SetManualTranscript("A tutor-typed replacement transcript.");

        Assert.Equal(EnhancementStatus.None, draft.EnhancementStatus);
        Assert.Null(draft.EnhancedTranscript);
    }

    [Fact]
    public void RemovingTheVideo_ClearsAnyExistingEnhancementAlongsideTheTranscript()
    {
        var draft = NewDraftWithReadyTranscript();
        var enhJobId = draft.BeginEnhancement();
        draft.CompleteEnhancement(enhJobId, "Enhanced version.", requiresReview: false,
            provider: "Claude", model: "claude-sonnet-5", promptVersion: "v1");

        draft.RemoveVideo();

        Assert.Equal(TranscriptStatus.None, draft.TranscriptStatus);
        Assert.Equal(EnhancementStatus.None, draft.EnhancementStatus);
        Assert.Null(draft.EnhancedTranscript);
    }

    [Fact]
    public void CopyContentFrom_CopiesACompletedEnhancementNormally()
    {
        var lesson = Lesson.Create(Guid.NewGuid(), Guid.NewGuid(), "Fractions", Guid.NewGuid());
        var draft = lesson.DraftRevision!;
        draft.Edit("Fractions", "Some body content.", 30, LessonDeliveryMode.Recorded);
        draft.AttachVideo(Guid.NewGuid());
        var jobId = draft.BeginTranscription();
        draft.CompleteTranscription(jobId, "Raw text.");
        var enhJobId = draft.BeginEnhancement();
        draft.CompleteEnhancement(enhJobId, "Enhanced text.", requiresReview: false,
            provider: "Claude", model: "claude-sonnet-5", promptVersion: "v1");
        lesson.PublishDraft();
        var published = lesson.CurrentRevision!;

        var newDraft = lesson.StartRevision(Guid.NewGuid());
        newDraft.CopyContentFrom(published);

        Assert.Equal(EnhancementStatus.Ready, newDraft.EnhancementStatus);
        Assert.Equal("Enhanced text.", newDraft.EnhancedTranscript);
        Assert.Equal(1, newDraft.EnhancementVersion);
        Assert.Null(newDraft.EnhancementJobId);
    }

    [Fact]
    public void CopyContentFrom_WhenSourceEnhancementIsStillProcessing_StartsCleanInsteadOfCopyingAnUnresolvableState()
    {
        var lesson = Lesson.Create(Guid.NewGuid(), Guid.NewGuid(), "Fractions", Guid.NewGuid());
        var draft = lesson.DraftRevision!;
        draft.Edit("Fractions", "Some body content.", 30, LessonDeliveryMode.Recorded);
        draft.AttachVideo(Guid.NewGuid());
        var jobId = draft.BeginTranscription();
        draft.CompleteTranscription(jobId, "Raw text.");
        draft.BeginEnhancement(); // left Processing, never completed
        lesson.PublishDraft();
        var published = lesson.CurrentRevision!;

        var newDraft = lesson.StartRevision(Guid.NewGuid());
        newDraft.CopyContentFrom(published);

        // The running job targets `published`'s id, not newDraft's — copying
        // "Processing" here would leave newDraft stuck forever.
        Assert.Equal(EnhancementStatus.None, newDraft.EnhancementStatus);
        Assert.Null(newDraft.EnhancementJobId);
    }
}
