using Platform.Api.Services;
using Xunit;

namespace Platform.Api.IntegrationTests.Tests;

/// <summary>Pure unit tests for the RFC 7233 single-range evaluation that video seeking depends on.</summary>
public class HttpByteRangeTests
{
    private const long Total = 1000;

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("items=0-10")]      // unknown unit
    [InlineData("bytes=abc-def")]   // not numbers
    [InlineData("bytes=0-10,20-30")] // multi-range: ignored, full body is a valid answer
    [InlineData("bytes=50-10")]     // end before start: invalid, ignored per RFC 7233 §2.1
    public void NoUsableRange_ServesTheWholeObject(string? header)
    {
        var outcome = HttpByteRange.Evaluate(header, Total);

        Assert.Equal(ByteRangeKind.Full, outcome.Kind);
    }

    [Fact]
    public void ExplicitRange_ReturnsThatInclusiveSlice()
    {
        var outcome = HttpByteRange.Evaluate("bytes=100-199", Total);

        Assert.Equal(ByteRangeKind.Partial, outcome.Kind);
        Assert.Equal(100, outcome.Start);
        Assert.Equal(199, outcome.End);
        Assert.Equal(100, outcome.Length);
    }

    [Fact]
    public void OpenEndedRange_RunsToTheLastByte_TheShapeABrowserSendsWhenSeeking()
    {
        var outcome = HttpByteRange.Evaluate("bytes=600-", Total);

        Assert.Equal(ByteRangeKind.Partial, outcome.Kind);
        Assert.Equal(600, outcome.Start);
        Assert.Equal(999, outcome.End);
    }

    [Fact]
    public void FirstBytesProbe_IsHonoured()
    {
        var outcome = HttpByteRange.Evaluate("bytes=0-0", Total);

        Assert.Equal(ByteRangeKind.Partial, outcome.Kind);
        Assert.Equal(1, outcome.Length);
    }

    [Fact]
    public void RangeEndPastTheObject_IsClampedToTheLastByte()
    {
        var outcome = HttpByteRange.Evaluate("bytes=900-5000", Total);

        Assert.Equal(ByteRangeKind.Partial, outcome.Kind);
        Assert.Equal(900, outcome.Start);
        Assert.Equal(999, outcome.End);
    }

    [Fact]
    public void SuffixRange_ReturnsTheFinalNBytes()
    {
        var outcome = HttpByteRange.Evaluate("bytes=-100", Total);

        Assert.Equal(ByteRangeKind.Partial, outcome.Kind);
        Assert.Equal(900, outcome.Start);
        Assert.Equal(999, outcome.End);
    }

    [Fact]
    public void SuffixLongerThanTheObject_ReturnsTheWholeObjectAsAPartial()
    {
        var outcome = HttpByteRange.Evaluate("bytes=-5000", Total);

        Assert.Equal(ByteRangeKind.Partial, outcome.Kind);
        Assert.Equal(0, outcome.Start);
        Assert.Equal(999, outcome.End);
    }

    [Theory]
    [InlineData("bytes=1000-")]     // first byte is one past the end
    [InlineData("bytes=5000-6000")]
    [InlineData("bytes=-0")]        // an empty suffix can never be satisfied
    public void RangeOutsideTheObject_IsUnsatisfiable(string header)
    {
        var outcome = HttpByteRange.Evaluate(header, Total);

        Assert.Equal(ByteRangeKind.Unsatisfiable, outcome.Kind);
    }

    [Fact]
    public void UnitNameIsCaseInsensitive_AndWhitespaceIsTolerated()
    {
        var outcome = HttpByteRange.Evaluate("  BYTES= 10 - 19 ", Total);

        Assert.Equal(ByteRangeKind.Partial, outcome.Kind);
        Assert.Equal(10, outcome.Start);
        Assert.Equal(19, outcome.End);
    }
}
