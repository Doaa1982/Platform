namespace Platform.Domain.Tests;

/// <summary>
/// Submission.RecordResponse's per-activity submission-mode enforcement — a
/// tutor-configured LearningActivitySubmissionMode (TextOnly/FileOnly/
/// TextOrFile) constrains what a learner's Assignment-target response must
/// contain. TextOrFile is the default and reproduces the exact "at least one
/// of text or file" behavior (INV-007) that existed before this parameter
/// was added.
/// </summary>
public class SubmissionResponseModeTests
{
    private static Submission NewInProgressSubmission() =>
        Submission.StartForAssignment(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), attemptNumber: 1);

    [Fact]
    public void TextOrFile_WithOnlyText_Succeeds()
    {
        var submission = NewInProgressSubmission();
        submission.RecordResponse("My answer.", null, LearningActivitySubmissionMode.TextOrFile);

        Assert.Equal("My answer.", submission.ResponseText);
        Assert.Null(submission.ResponseLearningAssetId);
        Assert.Equal(SubmissionStatus.Submitted, submission.Status);
    }

    [Fact]
    public void TextOrFile_WithOnlyFile_Succeeds()
    {
        var submission = NewInProgressSubmission();
        var assetId = Guid.NewGuid();
        submission.RecordResponse(null, assetId, LearningActivitySubmissionMode.TextOrFile);

        Assert.Null(submission.ResponseText);
        Assert.Equal(assetId, submission.ResponseLearningAssetId);
    }

    [Fact]
    public void TextOrFile_WithNeitherTextNorFile_Throws()
    {
        var submission = NewInProgressSubmission();

        Assert.Throws<ArgumentException>(() => submission.RecordResponse(null, null, LearningActivitySubmissionMode.TextOrFile));
    }

    [Fact]
    public void TextOnly_WithText_SucceedsAndDropsAnyAttachedFile()
    {
        var submission = NewInProgressSubmission();
        submission.RecordResponse("Written answer.", Guid.NewGuid(), LearningActivitySubmissionMode.TextOnly);

        Assert.Equal("Written answer.", submission.ResponseText);
        Assert.Null(submission.ResponseLearningAssetId);
    }

    [Fact]
    public void TextOnly_WithOnlyAFile_Throws()
    {
        var submission = NewInProgressSubmission();

        Assert.Throws<ArgumentException>(() => submission.RecordResponse(null, Guid.NewGuid(), LearningActivitySubmissionMode.TextOnly));
    }

    [Fact]
    public void FileOnly_WithAFile_SucceedsAndDropsAnyText()
    {
        var submission = NewInProgressSubmission();
        var assetId = Guid.NewGuid();
        submission.RecordResponse("Ignored text.", assetId, LearningActivitySubmissionMode.FileOnly);

        Assert.Equal(assetId, submission.ResponseLearningAssetId);
        Assert.Null(submission.ResponseText);
    }

    [Fact]
    public void FileOnly_WithOnlyText_Throws()
    {
        var submission = NewInProgressSubmission();

        Assert.Throws<ArgumentException>(() => submission.RecordResponse("Just text.", null, LearningActivitySubmissionMode.FileOnly));
    }

    [Fact]
    public void DefaultMode_WhenOmitted_BehavesAsTextOrFile()
    {
        var submission = NewInProgressSubmission();
        submission.RecordResponse("Answer, no explicit mode.", null);

        Assert.Equal(SubmissionStatus.Submitted, submission.Status);
    }
}
