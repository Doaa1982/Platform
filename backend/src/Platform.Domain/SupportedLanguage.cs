namespace Platform.Domain;

/// <summary>The UI/email languages this platform ships translations for, as ISO 639-1 codes.</summary>
public static class SupportedLanguage
{
    public const string English = "en";
    public const string Arabic = "ar";

    /// <summary>"en"/"ar" (any case, surrounding whitespace ignored) for a supported language, else null.</summary>
    public static string? Normalize(string? language)
    {
        var code = language?.Trim().ToLowerInvariant();
        return code is English or Arabic ? code : null;
    }

    /// <summary>Normalizes a non-empty value, throwing for an unsupported one; null/blank clears the preference.</summary>
    public static string? Require(string? language)
    {
        if (string.IsNullOrWhiteSpace(language)) return null;
        return Normalize(language)
            ?? throw new ArgumentException($"\"{language}\" isn't a supported language. Use \"en\" or \"ar\".", nameof(language));
    }
}
