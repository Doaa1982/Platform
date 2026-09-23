using System.Text;

namespace Microsoft.Extensions.Hosting;

/// <summary>
/// Keeps query-string values out of traces. A URL's query can carry a credential — an asset token (<c>t</c>),
/// a presigned-URL signature (<c>X-Amz-Signature</c>, <c>X-Amz-Credential</c>, …) or an upload id — and a trace
/// is exported off the machine and kept. Every value is replaced, whatever its name, so a newly added secret
/// parameter is covered without anyone remembering to list it; the names stay so a trace is still readable.
/// </summary>
public static class TelemetryRedaction
{
    public const string Placeholder = "REDACTED";

    /// <summary>"?t=abc&amp;d=x" (or without the "?") becomes "t=REDACTED&amp;d=REDACTED". Null/empty stay as they are.</summary>
    public static string? RedactQuery(string? query)
    {
        if (string.IsNullOrEmpty(query)) return query;

        var raw = query.StartsWith('?') ? query[1..] : query;
        if (raw.Length == 0) return string.Empty;

        var result = new StringBuilder(raw.Length);
        foreach (var pair in raw.Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            if (result.Length > 0) result.Append('&');
            var equals = pair.IndexOf('=');
            result.Append(equals < 0 ? pair : pair[..equals]).Append('=').Append(Placeholder);
        }
        return result.ToString();
    }

    /// <summary>The URL with its query redacted (fragment dropped, since a fragment can carry a token too).</summary>
    public static string RedactUrl(Uri uri)
    {
        var query = RedactQuery(uri.Query);
        var withoutQuery = uri.GetLeftPart(UriPartial.Path);
        return string.IsNullOrEmpty(query) ? withoutQuery : $"{withoutQuery}?{query}";
    }
}
