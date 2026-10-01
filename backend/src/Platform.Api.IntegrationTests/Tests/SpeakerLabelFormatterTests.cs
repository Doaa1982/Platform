using Platform.Api.AI;
using Xunit;

namespace Platform.Api.IntegrationTests.Tests;

/// <summary>
/// SpeakerLabelFormatter.Normalize rewrites every speaker-label shape seen from a real provider
/// response (Deepgram's own code-built label, Gemini's prompted-but-not-guaranteed output,
/// Speechmatics' format=txt diarization output) to the canonical "S1: " shape every downstream
/// reader of LessonRevision.Transcript relies on.
/// </summary>
public class SpeakerLabelFormatterTests
{
    [Theory]
    [InlineData("S1: Already canonical.", "S1: Already canonical.")]
    [InlineData("SPEAKER: S1: Hello there.", "S1: Hello there.")]
    [InlineData("SPEAKER S1: Hello there.", "S1: Hello there.")]
    [InlineData("SPEAKER_S1: Hello there.", "S1: Hello there.")]
    [InlineData("SPEAKER_1: Hello there.", "S1: Hello there.")]
    [InlineData("speaker: s2: lowercase variant", "S2: lowercase variant")]
    public void NormalizesEveryKnownLabelShape_ToTheCanonicalForm(string input, string expected)
    {
        Assert.Equal(expected, SpeakerLabelFormatter.Normalize(input));
    }

    [Fact]
    public void NormalizesOnePerLine_AcrossAMultiSpeakerTranscript()
    {
        var input = "SPEAKER: S1: First line.\nSPEAKER: S2: Second line.\nSPEAKER: S1: Third line.";

        var result = SpeakerLabelFormatter.Normalize(input);

        Assert.Equal("S1: First line.\nS2: Second line.\nS1: Third line.", result);
    }

    [Theory]
    [InlineData("")]
    [InlineData(null)]
    public void EmptyOrNullInput_PassesThroughUnchanged(string? input)
    {
        Assert.Equal(input, SpeakerLabelFormatter.Normalize(input!));
    }

    [Fact]
    public void TextWithNoSpeakerLabelAtAll_IsLeftUnchanged()
    {
        const string plain = "Just a plain transcript with no diarization markers.";

        Assert.Equal(plain, SpeakerLabelFormatter.Normalize(plain));
    }
}
