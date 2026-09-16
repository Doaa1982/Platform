using Platform.Api.AI;
using Platform.Api.Models;
using Xunit;

namespace Platform.Api.IntegrationTests.Tests;

/// <summary>
/// Pure unit tests for TranscriptEnhancementValidator — no WebApplicationFactory,
/// no Postgres, no AI call. This is the codebase's independent, code-based
/// safety net run in addition to (never instead of) the model's own
/// self-reported preservation checks; these tests exist to prove that net
/// actually catches the exact failure modes it claims to.
/// </summary>
public class TranscriptEnhancementValidatorTests
{
    private static TranscriptEnhancementPreservationChecks AllTrue() =>
        new(NumbersPreserved: true, VariablesPreserved: true, FormulasPreserved: true,
            MethodologyPreserved: true, SequencePreserved: true, UncertaintiesMarked: true);

    [Fact]
    public void ASafeCorrectionWithNoContentChange_PassesCleanly()
    {
        const string raw = "SPEAKER: S1\nكان عندي رون بتقول ايه B1 plus B2 equals 26.";
        const string enhanced = "SPEAKER: S1\nكان عندي رون بتقول Area of Trapezium B1 plus B2 equals 26.";
        var result = new TranscriptEnhancementLlmResult(enhanced, Segments: [], ReviewItems: [], AllTrue());

        var outcome = TranscriptEnhancementValidator.Validate(raw, result);

        Assert.False(outcome.RequiresReview);
        Assert.Empty(outcome.Reasons);
    }

    [Fact]
    public void AChangedNumber_IsDetectedAndRequiresReview()
    {
        const string raw = "SPEAKER: S1\nThe answer equals 26.";
        const string enhanced = "SPEAKER: S1\nThe answer equals 62."; // transposed digits — a real, dangerous ASR "fix"
        var result = new TranscriptEnhancementLlmResult(enhanced, Segments: [], ReviewItems: [], AllTrue());

        var outcome = TranscriptEnhancementValidator.Validate(raw, result);

        Assert.True(outcome.RequiresReview);
        Assert.Contains(outcome.Reasons, r => r.Contains("26") || r.Contains("62"));
    }

    [Fact]
    public void ARemovedNumberOccurrence_IsDetectedEvenWhenTheTokenStillAppearsElsewhere()
    {
        // "26" appears twice in raw, once in enhanced — a naive "does the
        // token still appear somewhere" check would miss this.
        const string raw = "SPEAKER: S1\n26. Two D. I. 26.";
        const string enhanced = "SPEAKER: S1\n26. Two D. I.";
        var result = new TranscriptEnhancementLlmResult(enhanced, Segments: [], ReviewItems: [], AllTrue());

        var outcome = TranscriptEnhancementValidator.Validate(raw, result);

        Assert.True(outcome.RequiresReview);
    }

    [Fact]
    public void AChangedVariableLabel_IsDetectedAndRequiresReview()
    {
        const string raw = "SPEAKER: S1\nWe need B1 and B2 to find the height.";
        const string enhanced = "SPEAKER: S1\nWe need B1 and B3 to find the height."; // B2 silently became B3
        var result = new TranscriptEnhancementLlmResult(enhanced, Segments: [], ReviewItems: [], AllTrue());

        var outcome = TranscriptEnhancementValidator.Validate(raw, result);

        Assert.True(outcome.RequiresReview);
        Assert.Contains(outcome.Reasons, r => r.Contains("B2") || r.Contains("B3"));
    }

    [Fact]
    public void ModelSelfReportedPreservationFailure_RequiresReviewEvenWithNoTokenMismatch()
    {
        const string raw = "SPEAKER: S1\nSome careful methodology explanation here in full.";
        const string enhanced = "SPEAKER: S1\nSome careful methodology explanation here in full.";
        var checks = AllTrue() with { MethodologyPreserved = false };
        var result = new TranscriptEnhancementLlmResult(enhanced, Segments: [], ReviewItems: [], checks);

        var outcome = TranscriptEnhancementValidator.Validate(raw, result);

        Assert.True(outcome.RequiresReview);
        Assert.Contains(outcome.Reasons, r => r.Contains("methodologyPreserved"));
    }

    [Fact]
    public void AModelFlaggedReviewItem_RequiresReviewEvenWhenPreservationChecksAllPass()
    {
        const string raw = "SPEAKER: S1\nAn uncertain word right here in this sentence.";
        const string enhanced = "SPEAKER: S1\nAn uncertain word right here in this sentence.";
        var reviewItems = new List<TranscriptEnhancementReviewItem>
        {
            new("1", "Possibly mis-heard technical term", "right here", "Low confidence — kept original wording."),
        };
        var result = new TranscriptEnhancementLlmResult(enhanced, Segments: [], reviewItems, AllTrue());

        var outcome = TranscriptEnhancementValidator.Validate(raw, result);

        Assert.True(outcome.RequiresReview);
        Assert.Contains(outcome.Reasons, r => r.Contains("flagged 1 review item"));
    }

    [Fact]
    public void ASegmentMarkedRequiresReview_PropagatesToTheOverallResult()
    {
        const string raw = "SPEAKER: S1\nFirst sentence. Second sentence.";
        const string enhanced = "SPEAKER: S1\nFirst sentence. Second sentence.";
        var segments = new List<TranscriptEnhancementSegment>
        {
            new("1", null, null, "S1", "First sentence.", "First sentence.", "unchanged", "high", null, RequiresReview: false),
            new("2", null, null, "S1", "Second sentence.", "Second sentence.", "uncertain", "low", "Garbled audio", RequiresReview: true),
        };
        var result = new TranscriptEnhancementLlmResult(enhanced, segments, ReviewItems: [], AllTrue());

        var outcome = TranscriptEnhancementValidator.Validate(raw, result);

        Assert.True(outcome.RequiresReview);
        Assert.Contains(outcome.Reasons, r => r.Contains("1 of 2 segment"));
    }

    [Fact]
    public void SummarizedOutput_IsDetectedByLengthRatioAndRequiresReview()
    {
        const string raw = "SPEAKER: S1\nThis is a fairly long raw transcript with a great deal of spoken instructional content that goes on for quite a while covering many small steps in detail.";
        const string enhanced = "SPEAKER: S1\nShort summary.";
        var result = new TranscriptEnhancementLlmResult(enhanced, Segments: [], ReviewItems: [], AllTrue());

        var outcome = TranscriptEnhancementValidator.Validate(raw, result);

        Assert.True(outcome.RequiresReview);
        Assert.Contains(outcome.Reasons, r => r.Contains("summarization"));
    }

    [Fact]
    public void MissingPreservationChecksObject_RequiresReview()
    {
        const string raw = "SPEAKER: S1\nSome text.";
        const string enhanced = "SPEAKER: S1\nSome text.";
        var result = new TranscriptEnhancementLlmResult(enhanced, Segments: [], ReviewItems: [], PreservationChecks: null);

        var outcome = TranscriptEnhancementValidator.Validate(raw, result);

        Assert.True(outcome.RequiresReview);
        Assert.Contains(outcome.Reasons, r => r.Contains("did not return a preservationChecks"));
    }
}
