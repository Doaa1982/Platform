using System.Text.RegularExpressions;
using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;
using Xunit;

namespace Platform.Api.IntegrationTests.Tests;

/// <summary>Skipped unless the browser-test runner (frontend/e2e/run.mjs) asks for a cleanup, so a normal test run never deletes anything.</summary>
public sealed class R2CleanupFactAttribute : FactAttribute
{
    public R2CleanupFactAttribute()
    {
        if (R2LearningAssetStorageLiveTests.Options() is null
            || string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("R2_E2E_CLEANUP_PREFIXES")))
            Skip = "Runs only when R2 credentials and R2_E2E_CLEANUP_PREFIXES are supplied by the browser-test runner.";
    }
}

/// <summary>
/// Removes every object under the given workspace prefixes from the DEV bucket — the objects a throwaway browser-test
/// run uploaded — and verifies none remain. It refuses any other bucket and any prefix that is not exactly a
/// workspace id followed by "/", so it cannot be pointed at anything but a test workspace's files.
/// </summary>
public sealed class R2E2ECleanup
{
    private const string DevBucket = "learning-workspace-dev";

    [R2CleanupFact]
    public async Task DeletesEveryObjectUnderTheThrowawayRunsWorkspacePrefixes()
    {
        var options = R2LearningAssetStorageLiveTests.Options()!;
        Assert.Equal(DevBucket, options.Bucket); // never the production bucket

        var prefixes = Environment.GetEnvironmentVariable("R2_E2E_CLEANUP_PREFIXES")!
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        Assert.NotEmpty(prefixes);
        Assert.All(prefixes, p => Assert.Matches(new Regex("^[0-9a-f]{32}/$"), p));

        using var s3 = new AmazonS3Client(
            new BasicAWSCredentials(options.AccessKeyId, options.SecretAccessKey),
            new AmazonS3Config
            {
                ServiceURL = options.ResolvedServiceUrl, AuthenticationRegion = "auto", ForcePathStyle = true,
                RequestChecksumCalculation = RequestChecksumCalculation.WHEN_REQUIRED,
                ResponseChecksumValidation = ResponseChecksumValidation.WHEN_REQUIRED,
            });

        foreach (var prefix in prefixes)
        {
            string? token = null;
            do
            {
                var page = await s3.ListObjectsV2Async(new ListObjectsV2Request { BucketName = DevBucket, Prefix = prefix, ContinuationToken = token });
                foreach (var obj in page.S3Objects ?? [])
                    await s3.DeleteObjectAsync(DevBucket, obj.Key);
                token = page.IsTruncated == true ? page.NextContinuationToken : null;
            } while (token is not null);

            var remaining = await s3.ListObjectsV2Async(new ListObjectsV2Request { BucketName = DevBucket, Prefix = prefix, MaxKeys = 1 });
            Assert.Equal(0, remaining.KeyCount);
        }
    }
}
