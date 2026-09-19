using Microsoft.AspNetCore.Mvc;
using Microsoft.Net.Http.Headers;

namespace Platform.Api.Services;

/// <summary>
/// Serves a stored object with HTTP Range support by asking the storage
/// backend for just the requested bytes — so a browser &lt;video&gt; can start
/// playing and seek without the API first pulling the whole file. Replaces
/// PhysicalFile(..., enableRangeProcessing: true), which needs a local path.
/// </summary>
public sealed class StoredObjectResult(
    ILearningAssetStorage storage, string objectKey, string contentType, string fileName,
    long totalLength, string etag) : IActionResult
{
    private const int CopyBufferSize = 81920;

    public async Task ExecuteResultAsync(ActionContext context)
    {
        var http = context.HttpContext;
        var response = http.Response;
        var ct = http.RequestAborted;

        var rangeHeader = http.Request.Headers.Range.ToString();
        // If-Range: honour the range only if the client's validator still matches.
        var ifRange = http.Request.Headers.IfRange.ToString();
        if (!string.IsNullOrEmpty(ifRange) && !string.Equals(ifRange, etag, StringComparison.Ordinal))
            rangeHeader = string.Empty;

        var outcome = HttpByteRange.Evaluate(rangeHeader, totalLength);

        if (outcome.Kind == ByteRangeKind.Unsatisfiable)
        {
            response.StatusCode = StatusCodes.Status416RangeNotSatisfiable;
            response.Headers.ContentRange = $"bytes */{totalLength}";
            response.Headers.AcceptRanges = "bytes";
            return;
        }

        var partial = outcome.Kind == ByteRangeKind.Partial;
        var start = partial ? outcome.Start : 0;
        var count = partial ? outcome.Length : totalLength;

        Stream stream;
        try
        {
            stream = await storage.OpenReadAsync(objectKey, start, count, ct);
        }
        catch (StoredObjectNotFoundException)
        {
            // Nothing has been written to the response yet, so this can still be a clean 404.
            response.StatusCode = StatusCodes.Status404NotFound;
            await response.WriteAsJsonAsync(new { message = "No such learning asset." }, ct);
            return;
        }

        await using (stream)
        {
            response.StatusCode = partial ? StatusCodes.Status206PartialContent : StatusCodes.Status200OK;
            response.ContentType = contentType;
            response.ContentLength = count;
            response.Headers.AcceptRanges = "bytes";
            response.Headers.ETag = etag;

            var disposition = new ContentDispositionHeaderValue("attachment");
            disposition.SetHttpFileName(fileName);
            response.Headers.ContentDisposition = disposition.ToString();

            if (partial)
                response.Headers.ContentRange = $"bytes {outcome.Start}-{outcome.End}/{totalLength}";

            try
            {
                await CopyExactlyAsync(stream, response.Body, count, ct);
            }
            catch (OperationCanceledException)
            {
                // The browser closed the connection (e.g. the user seeked away) — nothing to report.
            }
        }
    }

    private static async Task CopyExactlyAsync(Stream source, Stream destination, long count, CancellationToken ct)
    {
        var buffer = new byte[CopyBufferSize];
        var remaining = count;
        while (remaining > 0)
        {
            var read = await source.ReadAsync(buffer.AsMemory(0, (int)Math.Min(buffer.Length, remaining)), ct);
            if (read == 0) break;
            await destination.WriteAsync(buffer.AsMemory(0, read), ct);
            remaining -= read;
        }
    }
}
