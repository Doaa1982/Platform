using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Platform.Api.Services;
using Xunit;

namespace Platform.Api.IntegrationTests.Tests;

/// <summary>
/// The download response itself — status codes, headers and exact bytes for
/// full, ranged and unsatisfiable requests — against an in-memory storage that
/// records what it was asked for, so "playback doesn't need the whole file"
/// is asserted rather than assumed.
/// </summary>
public class StoredObjectResultTests
{
    private const string Key = "ws/asset.mp4";
    private const string ETag = "\"asset-1000\"";
    private static readonly byte[] Data = Enumerable.Range(0, 1000).Select(i => (byte)(i % 251)).ToArray();

    private static async Task<(DefaultHttpContext Http, byte[] Body, InMemoryStorage Storage)> RunAsync(
        Action<HttpRequest>? configureRequest = null, InMemoryStorage? storage = null,
        string contentType = "video/mp4", string fileName = "Lesson 1.mp4")
    {
        storage ??= new InMemoryStorage { [Key] = Data };
        var http = new DefaultHttpContext { RequestServices = new ServiceCollection().AddLogging().BuildServiceProvider() };
        http.Response.Body = new MemoryStream();
        configureRequest?.Invoke(http.Request);

        var result = new StoredObjectResult(storage, Key, contentType, fileName, Data.Length, ETag);
        await result.ExecuteResultAsync(new ActionContext(http, new RouteData(), new Microsoft.AspNetCore.Mvc.Abstractions.ActionDescriptor()));

        return (http, ((MemoryStream)http.Response.Body).ToArray(), storage);
    }

    [Fact]
    public async Task NoRangeHeader_Returns200WithTheWholeFile_AndAdvertisesRangeSupport()
    {
        var (http, body, _) = await RunAsync();

        Assert.Equal(200, http.Response.StatusCode);
        Assert.Equal(Data, body);
        Assert.Equal("video/mp4", http.Response.ContentType);
        Assert.Equal(1000, http.Response.ContentLength);
        Assert.Equal("bytes", http.Response.Headers.AcceptRanges.ToString());
        Assert.Equal(ETag, http.Response.Headers.ETag.ToString());
    }

    [Fact]
    public async Task Download_KeepsTheOriginalFileNameInContentDisposition()
    {
        var (http, _, _) = await RunAsync(fileName: "Lesson 1.mp4");

        var disposition = http.Response.Headers.ContentDisposition.ToString();
        Assert.StartsWith("attachment", disposition);
        Assert.Contains("Lesson 1.mp4", disposition);
    }

    [Fact]
    public async Task RangeRequest_Returns206WithExactlyThoseBytesAndAContentRange()
    {
        var (http, body, _) = await RunAsync(r => r.Headers.Range = "bytes=100-199");

        Assert.Equal(206, http.Response.StatusCode);
        Assert.Equal(Data[100..200], body);
        Assert.Equal("bytes 100-199/1000", http.Response.Headers.ContentRange.ToString());
        Assert.Equal(100, http.Response.ContentLength);
    }

    [Fact]
    public async Task SeekingRequest_AsksStorageForOnlyTheTailFromTheOffset_NotTheWholeFile()
    {
        var (http, body, storage) = await RunAsync(r => r.Headers.Range = "bytes=900-");

        Assert.Equal(206, http.Response.StatusCode);
        Assert.Equal(Data[900..], body);
        var open = Assert.Single(storage.Opens);
        Assert.Equal((900L, (long?)100L), open); // offset 900, 100 bytes — never a full-file read
    }

    [Fact]
    public async Task RangePastTheEnd_Returns416WithTheTotalLength_AndNeverTouchesStorage()
    {
        var (http, body, storage) = await RunAsync(r => r.Headers.Range = "bytes=5000-");

        Assert.Equal(416, http.Response.StatusCode);
        Assert.Equal("bytes */1000", http.Response.Headers.ContentRange.ToString());
        Assert.Empty(body);
        Assert.Empty(storage.Opens);
    }

    [Fact]
    public async Task IfRangeThatNoLongerMatches_IgnoresTheRange_AndSendsTheFullFile()
    {
        var (http, body, _) = await RunAsync(r =>
        {
            r.Headers.Range = "bytes=0-9";
            r.Headers.IfRange = "\"a-stale-validator\"";
        });

        Assert.Equal(200, http.Response.StatusCode);
        Assert.Equal(Data, body);
    }

    [Fact]
    public async Task IfRangeThatMatches_StillHonoursTheRange()
    {
        var (http, body, _) = await RunAsync(r =>
        {
            r.Headers.Range = "bytes=0-9";
            r.Headers.IfRange = ETag;
        });

        Assert.Equal(206, http.Response.StatusCode);
        Assert.Equal(Data[..10], body);
    }

    [Fact]
    public async Task AnObjectMissingFromStorage_Returns404_BeforeAnyBodyOrFileHeadersAreSent()
    {
        var (http, body, _) = await RunAsync(storage: new InMemoryStorage()); // row exists, bytes don't

        Assert.Equal(404, http.Response.StatusCode);
        Assert.Contains("No such learning asset", System.Text.Encoding.UTF8.GetString(body));
        Assert.False(http.Response.Headers.ContainsKey("Content-Disposition"));
    }

    private sealed class InMemoryStorage : ILearningAssetStorage
    {
        private readonly Dictionary<string, byte[]> _objects = new();
        public List<(long Offset, long? Length)> Opens { get; } = [];

        public byte[] this[string key] { set => _objects[key] = value; }

        public string ProviderName => "Memory";

        public Task<string> SaveAsync(Guid workspaceId, string fileName, Stream content, CancellationToken ct) =>
            throw new NotSupportedException();

        public Task<Stream> OpenReadAsync(string objectKey, long offset, long? length, CancellationToken ct)
        {
            if (!_objects.TryGetValue(objectKey, out var data)) throw new StoredObjectNotFoundException(objectKey);
            Opens.Add((offset, length));
            // Deliberately hand back the tail from the offset, ignoring length:
            // the contract lets a provider over-deliver, so the result must
            // bound its own copy to exactly the requested count.
            return Task.FromResult<Stream>(new MemoryStream(data[(int)offset..]));
        }

        public Task DeleteAsync(string objectKey, CancellationToken ct)
        {
            _objects.Remove(objectKey);
            return Task.CompletedTask;
        }
    }
}
