using System.Globalization;

namespace Platform.Api.Services;

public enum ByteRangeKind
{
    /// <summary>No usable Range header — serve the whole object with 200.</summary>
    Full,
    /// <summary>A satisfiable single range — serve it with 206.</summary>
    Partial,
    /// <summary>A syntactically valid range that lies outside the object — answer 416.</summary>
    Unsatisfiable,
}

public readonly record struct ByteRangeOutcome(ByteRangeKind Kind, long Start, long End)
{
    public long Length => End - Start + 1;
}

/// <summary>
/// RFC 7233 single-range evaluation for a resource of known length — the
/// semantics ASP.NET Core's own PhysicalFile range processing gave downloads
/// before object storage, kept here because a network stream can't use that
/// helper. Multiple ranges and malformed headers are ignored (the spec lets a
/// server answer 200 with the full body), which is what browsers' &lt;video&gt;
/// seeking never needs anything beyond.
/// </summary>
public static class HttpByteRange
{
    public static ByteRangeOutcome Evaluate(string? rangeHeader, long totalLength)
    {
        var full = new ByteRangeOutcome(ByteRangeKind.Full, 0, Math.Max(totalLength - 1, 0));

        if (string.IsNullOrWhiteSpace(rangeHeader)) return full;
        var header = rangeHeader.Trim();
        if (!header.StartsWith("bytes=", StringComparison.OrdinalIgnoreCase)) return full;

        var spec = header["bytes=".Length..].Trim();
        if (spec.Length == 0 || spec.Contains(',')) return full;

        var dash = spec.IndexOf('-');
        if (dash < 0) return full;

        var first = spec[..dash].Trim();
        var last = spec[(dash + 1)..].Trim();

        var unsatisfiable = new ByteRangeOutcome(ByteRangeKind.Unsatisfiable, 0, 0);

        if (first.Length == 0)
        {
            // Suffix range: the final N bytes.
            if (!TryParse(last, out var suffix)) return full;
            if (suffix == 0 || totalLength == 0) return unsatisfiable;
            var start = Math.Max(totalLength - suffix, 0);
            return new ByteRangeOutcome(ByteRangeKind.Partial, start, totalLength - 1);
        }

        if (!TryParse(first, out var from)) return full;

        long to;
        if (last.Length == 0)
        {
            to = totalLength - 1;
        }
        else
        {
            if (!TryParse(last, out to)) return full;
            if (to < from) return full; // invalid per RFC 7233 §2.1 — ignore the header
        }

        if (from >= totalLength) return unsatisfiable;
        return new ByteRangeOutcome(ByteRangeKind.Partial, from, Math.Min(to, totalLength - 1));
    }

    private static bool TryParse(string s, out long value) =>
        long.TryParse(s, NumberStyles.None, CultureInfo.InvariantCulture, out value);
}
