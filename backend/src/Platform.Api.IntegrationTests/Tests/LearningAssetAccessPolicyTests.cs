using System.Net;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Platform.Api.IntegrationTests.Fixtures;
using Platform.Api.Services;
using Platform.Domain;
using Platform.Infrastructure;
using Xunit;

namespace Platform.Api.IntegrationTests.Tests;

/// <summary>
/// Who may read which Learning Asset, across every role and state the policy
/// distinguishes — asked of <see cref="LearningAssetAccessPolicy"/> directly
/// (no bytes, no tokens) and, for the cases that matter end to end, over HTTP
/// with real sessions. Read-only: every mutation lives in
/// <see cref="LearningAssetAccessRevocationTests"/>, so test order can't matter.
/// </summary>
public sealed class LearningAssetAccessPolicyTests(AssetAccessFixture fixture) : IClassFixture<AssetAccessFixture>
{
    private WebApplicationFactory<Program> _host => fixture.Host;
    private HttpClient _client => fixture.Client;
    private AssetAccessWorld _w => fixture.World;

    private async Task<AssetAccessDecision> AskAsync(string slug, Guid identityId, Guid assetId)
    {
        using var scope = _host.Services.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<LearningAssetAccessPolicy>()
            .AuthorizeReadAsync(slug, identityId, assetId);
    }

    private async Task AssertAllowedAsync(Guid identityId, Guid assetId, string because)
    {
        var d = await AskAsync(_w.Slug, identityId, assetId);
        Assert.True(d.Allowed, $"expected ALLOWED — {because} (got {d.Denied?.Error}: {d.Denied?.Message})");
    }

    private async Task AssertDeniedAsync(Guid identityId, Guid assetId, ProvisioningError expected, string because)
    {
        var d = await AskAsync(_w.Slug, identityId, assetId);
        Assert.False(d.Allowed, $"expected DENIED — {because}");
        Assert.Equal(expected, d.Denied!.Value.Error);
    }

    // ── Authors ──────────────────────────────────────────────────────────

    [Fact]
    public async Task Owner_And_Teacher_MayReadEveryAssetInTheirWorkspace_IncludingArchivedDraftAndTutorOnly()
    {
        foreach (var author in new[] { _w.TutorIdentityId, _w.TeacherIdentityId })
        {
            foreach (var (asset, name) in new[]
            {
                (_w.Video1, "video1"), (_w.Video1b, "video1b"), (_w.Video2, "locked lesson video"), (_w.Video3, "draft lesson video"),
                (_w.TutorOnlyResource, "tutor-only resource"), (_w.ArchivedResource, "archived resource"),
                (_w.EnrolledSubmissionFile, "a learner's submission file"), (_w.UnreferencedByTutor, "unreferenced"),
                (_w.CoverOfDraft, "draft cover"), (_w.DraftLessonActivityFile, "activity file of an unpublished lesson"),
            })
                await AssertAllowedAsync(author, asset, $"author reads {name}");
        }
    }

    // ── The enrolled learner, pinned to revision 1 ───────────────────────

    [Fact]
    public async Task EnrolledLearner_ReadsWhatTheirPinnedRevisionServes()
    {
        var e = _w.EnrolledIdentityId;
        await AssertAllowedAsync(e, _w.Video1, "video on the revision they are pinned to");
        await AssertAllowedAsync(e, _w.VisibleResource, "visible resource");
        await AssertAllowedAsync(e, _w.ActivityFile, "activity file of a published assignment they are enrolled for");
    }

    [Fact]
    public async Task EnrolledLearner_IsNotServedARevisionTheyAreNotPinnedTo()
    {
        await AssertDeniedAsync(_w.EnrolledIdentityId, _w.Video1b, ProvisioningError.Forbidden,
            "video only on the newer revision 2; this learner stays on revision 1");
    }

    [Fact]
    public async Task UnpinnedLearner_IsServedTheCurrentRevision()
    {
        var o = _w.OtherEnrolledIdentityId;
        await AssertAllowedAsync(o, _w.Video1b, "no progress yet, so the current revision 2 is served");
        await AssertDeniedAsync(o, _w.Video1, ProvisioningError.Forbidden, "revision 1's video is no longer the served one");
    }

    [Fact]
    public async Task Learner_IsDeniedTutorOnlyArchivedLockedAndDraftLessonAssets()
    {
        var e = _w.EnrolledIdentityId;
        await AssertDeniedAsync(e, _w.TutorOnlyResource, ProvisioningError.Forbidden, "resource not visible to learners");
        await AssertDeniedAsync(e, _w.ArchivedResource, ProvisioningError.Forbidden, "archived, though it is still attached to a lesson");
        await AssertDeniedAsync(e, _w.Video2, ProvisioningError.Forbidden, "lesson 2 is locked until lesson 1 is completed");
        await AssertDeniedAsync(e, _w.Video3, ProvisioningError.Forbidden, "lesson 3 is an unpublished draft");
    }

    [Fact]
    public async Task ActivityFile_OfAnUnpublishedLesson_IsDenied_EvenThoughItsAssignmentIsPublishedAndTheLearnerIsEnrolled()
    {
        await AssertDeniedAsync(_w.EnrolledIdentityId, _w.DraftLessonActivityFile, ProvisioningError.Forbidden,
            "the lesson is a draft — stricter than the assignment view, which does not look at lesson status");
        await AssertDeniedAsync(_w.OtherEnrolledIdentityId, _w.DraftLessonActivityFile, ProvisioningError.Forbidden, "same, any enrolled learner");
    }

    // ── Submission files, uploads, covers and logos ──────────────────────

    [Fact]
    public async Task SubmissionFile_IsReadableByItsOwnerOnly_NotByAnotherLearner()
    {
        await AssertAllowedAsync(_w.EnrolledIdentityId, _w.EnrolledSubmissionFile, "the learner who submitted it");
        await AssertDeniedAsync(_w.OtherEnrolledIdentityId, _w.EnrolledSubmissionFile, ProvisioningError.Forbidden,
            "another learner's submission file");
        await AssertDeniedAsync(_w.UnenrolledIdentityId, _w.EnrolledSubmissionFile, ProvisioningError.Forbidden,
            "an unenrolled learner");
    }

    [Fact]
    public async Task UnreferencedAsset_IsReadableByItsUploaderOnly()
    {
        await AssertAllowedAsync(_w.EnrolledIdentityId, _w.UnreferencedByEnrolled, "the learner who uploaded it and has not attached it yet");
        await AssertDeniedAsync(_w.OtherEnrolledIdentityId, _w.UnreferencedByEnrolled, ProvisioningError.Forbidden, "someone else's pending upload");
        await AssertDeniedAsync(_w.EnrolledIdentityId, _w.UnreferencedByTutor, ProvisioningError.Forbidden, "a file the tutor uploaded and never attached");
    }

    [Fact]
    public async Task Cover_IsReadableByAnyMemberOnlyWhileItsProductIsPublished_AndLogoByAnyMember()
    {
        foreach (var member in new[] { _w.EnrolledIdentityId, _w.UnenrolledIdentityId, _w.ParentIdentityId })
        {
            await AssertAllowedAsync(member, _w.CoverOfPublished, "cover of a published product");
            await AssertAllowedAsync(member, _w.Logo, "workspace logo");
            await AssertDeniedAsync(member, _w.CoverOfDraft, ProvisioningError.Forbidden, "cover of a product that is still a draft");
        }
    }

    // ── Enrollment and role ──────────────────────────────────────────────

    [Fact]
    public async Task UnenrolledLearner_ReadsNoCourseContent_AndAskingDoesNotEnrollThem()
    {
        var u = _w.UnenrolledIdentityId;
        foreach (var asset in new[] { _w.Video1, _w.Video1b, _w.VisibleResource, _w.ActivityFile })
            await AssertDeniedAsync(u, asset, ProvisioningError.Forbidden, "not enrolled in the (Open) course");

        using var scope = _host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PlatformDbContext>();
        var membershipId = await db.Memberships.Where(m => m.IdentityId == u).Select(m => m.Id).SingleAsync();
        Assert.False(await db.Enrollments.AnyAsync(e => e.MembershipId == membershipId),
            "an asset check must never auto-enroll, unlike opening the lesson");
    }

    [Fact]
    public async Task NonLearnerNonAuthorMember_ReadsNoCourseContent()
    {
        await AssertDeniedAsync(_w.ParentIdentityId, _w.Video1, ProvisioningError.Forbidden, "a Parent is neither a Learner nor an author");
        await AssertDeniedAsync(_w.ParentIdentityId, _w.VisibleResource, ProvisioningError.Forbidden, "same");
    }

    // ── Probing: non-members, other workspaces, unknown ids all look the same ──

    [Fact]
    public async Task NonMembers_CrossWorkspaceAndUnknownIds_AreAllNotFound()
    {
        var everyAsset = new[] { _w.Video1, _w.VisibleResource, _w.Logo, _w.CoverOfPublished, _w.TutorOnlyResource };

        foreach (var asset in everyAsset)
        {
            // another workspace's tutor, asking through workspace A's slug
            Assert.Equal(ProvisioningError.NotFound, (await AskAsync(_w.Slug, _w.OtherTutorIdentityId, asset)).Denied!.Value.Error);
            // ...or through their own slug for workspace A's asset id
            Assert.Equal(ProvisioningError.NotFound, (await AskAsync(_w.OtherSlug, _w.OtherTutorIdentityId, asset)).Denied!.Value.Error);
            // a stranger with no membership anywhere
            Assert.Equal(ProvisioningError.NotFound, (await AskAsync(_w.Slug, Guid.NewGuid(), asset)).Denied!.Value.Error);
        }

        Assert.Equal(ProvisioningError.NotFound, (await AskAsync(_w.Slug, _w.TutorIdentityId, Guid.NewGuid())).Denied!.Value.Error);
        Assert.Equal(ProvisioningError.NotFound, (await AskAsync("no-such-workspace", _w.TutorIdentityId, _w.Video1)).Denied!.Value.Error);
    }

    [Fact]
    public async Task NotFoundResponses_AreIdenticalWhetherTheAssetExistsElsewhereOrNot()
    {
        var real = await AskAsync(_w.Slug, _w.OtherTutorIdentityId, _w.Video1);
        var fake = await AskAsync(_w.Slug, _w.OtherTutorIdentityId, Guid.NewGuid());

        Assert.Equal(fake.Denied, real.Denied); // same status and same message — nothing to distinguish an existing id
    }

    // ── The lesson response no longer offers archived files ──────────────

    [Fact]
    public async Task LearnerLessonResponse_OmitsArchivedResources_AndKeepsTheVisibleOnes()
    {
        using var scope = _host.Services.CreateScope();
        var delivery = scope.ServiceProvider.GetRequiredService<LearningDeliveryService>();

        var result = await delivery.GetLessonAsync(_w.Slug, _w.EnrolledIdentityId, _w.Lesson1Id);

        Assert.Equal(ProvisioningError.None, result.Error);
        var ids = result.Value.Resources.Select(r => r.Id).ToList();
        Assert.Contains(_w.VisibleResource, ids);
        Assert.DoesNotContain(_w.ArchivedResource, ids);
        Assert.DoesNotContain(_w.TutorOnlyResource, ids);
        Assert.Equal(_w.Video1, result.Value.Video!.Id);
    }

    // ── Over HTTP with real sessions ─────────────────────────────────────

    private Task<HttpResponseMessage> DownloadAsync(string? token, string slug, Guid assetId)
    {
        var req = new HttpRequestMessage(HttpMethod.Get, $"/api/workspaces/{slug}/learning-assets/{assetId}/download");
        if (token is not null) req.Headers.Authorization = new("Bearer", token);
        return _client.SendAsync(req);
    }

    [Fact]
    public async Task Http_AuthorizedReadersGetTheBytes_EveryoneElseGetsNoneAndNoRangeBypass()
    {
        var enrolled = await TestOnboarding.LoginAsync(_client, _w.EnrolledEmail, AssetAccessWorld.LearnerPassword);
        var unenrolled = await TestOnboarding.LoginAsync(_client, _w.UnenrolledEmail, AssetAccessWorld.LearnerPassword);

        var ok = await DownloadAsync(enrolled, _w.Slug, _w.Video1);
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        Assert.Equal(_w.Video1Bytes, await ok.Content.ReadAsByteArrayAsync());

        var tutor = await DownloadAsync(_w.TutorToken, _w.Slug, _w.Video1);
        Assert.Equal(HttpStatusCode.OK, tutor.StatusCode);

        var denied = await DownloadAsync(unenrolled, _w.Slug, _w.Video1);
        Assert.Equal(HttpStatusCode.Forbidden, denied.StatusCode);
        Assert.NotEqual(_w.Video1Bytes.Length, (await denied.Content.ReadAsByteArrayAsync()).Length);

        var ranged = new HttpRequestMessage(HttpMethod.Get, $"/api/workspaces/{_w.Slug}/learning-assets/{_w.Video1}/download");
        ranged.Headers.Authorization = new("Bearer", unenrolled);
        ranged.Headers.TryAddWithoutValidation("Range", "bytes=0-99");
        Assert.Equal(HttpStatusCode.Forbidden, (await _client.SendAsync(ranged)).StatusCode);

        Assert.Equal(HttpStatusCode.Unauthorized, (await DownloadAsync(null, _w.Slug, _w.Video1)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await DownloadAsync(_w.OtherTutorToken, _w.Slug, _w.Video1)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await DownloadAsync(_w.OtherTutorToken, _w.OtherSlug, _w.Video1)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await DownloadAsync(enrolled, _w.Slug, _w.ArchivedResource)).StatusCode);
    }
}
