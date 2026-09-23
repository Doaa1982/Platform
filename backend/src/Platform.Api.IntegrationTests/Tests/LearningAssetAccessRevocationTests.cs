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
/// Access that must end the moment the reason for it ends. These tests change
/// state (cancel an enrollment, archive an asset, suspend a membership), so
/// they run in their own class and their own world; each uses a learner or
/// asset no other test in the class touches.
/// </summary>
public sealed class LearningAssetAccessRevocationTests(AssetAccessFixture fixture) : IClassFixture<AssetAccessFixture>
{
    private WebApplicationFactory<Program> _host => fixture.Host;
    private HttpClient _client => fixture.Client;
    private AssetAccessWorld _w => fixture.World;

    private async Task<bool> AllowedAsync(Guid identityId, Guid assetId)
    {
        using var scope = _host.Services.CreateScope();
        var d = await scope.ServiceProvider.GetRequiredService<LearningAssetAccessPolicy>()
            .AuthorizeReadAsync(_w.Slug, identityId, assetId);
        return d.Allowed;
    }

    private async Task MutateAsync(Func<PlatformDbContext, Task> change)
    {
        using var scope = _host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PlatformDbContext>();
        await change(db);
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task EndedEnrollment_StopsGrantingAccessImmediately_AndReactivationRestoresIt()
    {
        var learner = _w.RevokableIdentityId;
        Assert.True(await AllowedAsync(learner, _w.Video1b), "enrolled learner reads the current revision's video");

        await MutateAsync(async db => (await db.Enrollments.SingleAsync(e => e.Id == _w.RevokableEnrollmentId)).Cancel());

        Assert.False(await AllowedAsync(learner, _w.Video1b), "enrollment cancelled — no cached grant survives");
        Assert.False(await AllowedAsync(learner, _w.VisibleResource));

        await MutateAsync(async db => (await db.Enrollments.SingleAsync(e => e.Id == _w.RevokableEnrollmentId)).Reactivate());

        Assert.True(await AllowedAsync(learner, _w.Video1b), "re-enrolled — access follows the enrollment, nothing else");
    }

    [Fact]
    public async Task ArchivingAnAsset_TakesItAwayFromLearnersAtOnce_ButNotFromTheTutor()
    {
        // The Enrolled learner is pinned to revision 1, whose video is Video1 — nothing else in this class touches Video1.
        var learner = _w.EnrolledIdentityId;
        Assert.True(await AllowedAsync(learner, _w.Video1));

        await MutateAsync(async db => (await db.LearningAssets.SingleAsync(a => a.Id == _w.Video1)).Archive());

        Assert.False(await AllowedAsync(learner, _w.Video1), "archived assets are never available to learners");
        Assert.True(await AllowedAsync(_w.TutorIdentityId, _w.Video1), "authors keep read access for studio history");

        using var scope = _host.Services.CreateScope();
        var lesson = await scope.ServiceProvider.GetRequiredService<LearningDeliveryService>()
            .GetLessonAsync(_w.Slug, learner, _w.Lesson1Id);
        Assert.Equal(ProvisioningError.None, lesson.Error);
        Assert.Null(lesson.Value.Video); // the lesson response stops offering it too
    }

    [Fact]
    public async Task SuspendedMembership_LosesAccessAtOnce_AndLooksLikeANonMember()
    {
        var learner = _w.SuspendableIdentityId;
        Assert.True(await AllowedAsync(learner, _w.Video1b), "enrolled, unpinned learner reads the current revision's video");
        var issuedBefore = UrlFor(learner, _w.Video1b); // a token already in their hands
        Assert.Equal(System.Net.HttpStatusCode.OK, await RedeemAsync(issuedBefore));

        await MutateAsync(async db =>
            (await db.Memberships.SingleAsync(m => m.IdentityId == learner && m.WorkspaceId == _w.WorkspaceId)).Archive());

        using var scope = _host.Services.CreateScope();
        var d = await scope.ServiceProvider.GetRequiredService<LearningAssetAccessPolicy>()
            .AuthorizeReadAsync(_w.Slug, learner, _w.Video1b);
        Assert.False(d.Allowed);
        Assert.Equal(ProvisioningError.NotFound, d.Denied!.Value.Error);
        Assert.Equal(System.Net.HttpStatusCode.NotFound, await RedeemAsync(issuedBefore)); // and the unexpired token is dead too
    }

    [Fact]
    public async Task LockedLessonVideo_OpensOnceThePreviousLessonIsCompleted()
    {
        var learner = _w.UnlockableIdentityId;
        Assert.False(await AllowedAsync(learner, _w.Video2), "lesson 2 is locked until lesson 1 is completed");

        await MutateAsync(async db =>
        {
            var membershipId = await db.Memberships
                .Where(m => m.IdentityId == learner && m.WorkspaceId == _w.WorkspaceId).Select(m => m.Id).SingleAsync();
            var enrollmentId = await db.Enrollments
                .Where(e => e.MembershipId == membershipId && e.LearningProductId == _w.ProductId).Select(e => e.Id).SingleAsync();
            var lesson1 = await db.Lessons.SingleAsync(l => l.Id == _w.Lesson1Id);

            var progress = LessonProgress.Start(enrollmentId, _w.Lesson1Id, lesson1.CurrentRevisionId!.Value);
            progress.MarkVideoWatched();
            progress.RecomputeCompletion(hasVideo: true, hasGradableAssessment: false, hasPassingSubmission: false);
            Assert.Equal(LessonProgressStatus.Completed, progress.Status);
            db.LessonProgresses.Add(progress);
        });

        Assert.True(await AllowedAsync(learner, _w.Video2), "lesson 1 is now completed, so lesson 2's video opens");
    }

    [Fact]
    public async Task ArchivedActivityFile_IsDeniedAndNoLongerOfferedOnTheAssignmentPage()
    {
        var learner = _w.OtherEnrolledIdentityId;
        Assert.True(await AllowedAsync(learner, _w.ActivityFile));

        using (var scope = _host.Services.CreateScope())
        {
            var before = await scope.ServiceProvider.GetRequiredService<AssignmentService>()
                .GetMyAssignmentAsync(_w.Slug, learner, _w.Lesson1Id, _w.ActivityId);
            Assert.Equal(_w.ActivityFile, before.Value.Activity.ActivityFileAssetId);
        }

        await MutateAsync(async db => (await db.LearningAssets.SingleAsync(a => a.Id == _w.ActivityFile)).Archive());

        Assert.False(await AllowedAsync(learner, _w.ActivityFile), "archived assets are never available to learners");
        Assert.True(await AllowedAsync(_w.TutorIdentityId, _w.ActivityFile), "authors keep read access");

        using var after = _host.Services.CreateScope();
        var page = await after.ServiceProvider.GetRequiredService<AssignmentService>()
            .GetMyAssignmentAsync(_w.Slug, learner, _w.Lesson1Id, _w.ActivityId);
        Assert.Equal(ProvisioningError.None, page.Error);
        Assert.Null(page.Value.Activity.ActivityFileAssetId);
    }

    // ── Tokens already in someone's hands: access is re-checked at redemption, so revocation is immediate ──

    private string UrlFor(Guid identityId, Guid assetId)
    {
        var token = _host.Services.GetRequiredService<AssetAccessTokenService>()
            .Issue(assetId, _w.WorkspaceId, identityId, TimeSpan.FromMinutes(10));
        return $"/api/workspaces/{_w.Slug}/learning-assets/{assetId}/content?t={token}";
    }

    private async Task<System.Net.HttpStatusCode> RedeemAsync(string url) => (await _client.GetAsync(url)).StatusCode;

    [Fact]
    public async Task AnUnexpiredToken_StopsWorkingTheMomentEnrollmentEnds_AndWorksAgainIfItIsRestored()
    {
        var url = UrlFor(_w.RevokableIdentityId, _w.Video1b);
        Assert.Equal(System.Net.HttpStatusCode.OK, await RedeemAsync(url));

        await MutateAsync(async db => (await db.Enrollments.SingleAsync(e => e.Id == _w.RevokableEnrollmentId)).Cancel());
        Assert.Equal(System.Net.HttpStatusCode.NotFound, await RedeemAsync(url));

        await MutateAsync(async db => (await db.Enrollments.SingleAsync(e => e.Id == _w.RevokableEnrollmentId)).Reactivate());
        Assert.Equal(System.Net.HttpStatusCode.OK, await RedeemAsync(url));
    }

    [Fact]
    public async Task AnUnexpiredToken_StopsWorkingWhenTheAssetIsArchived_ButTheAuthorsTokenStillDoes()
    {
        var learnerUrl = UrlFor(_w.EnrolledIdentityId, _w.VisibleResource);
        var tutorUrl = UrlFor(_w.TutorIdentityId, _w.VisibleResource);
        Assert.Equal(System.Net.HttpStatusCode.OK, await RedeemAsync(learnerUrl));

        await MutateAsync(async db => (await db.LearningAssets.SingleAsync(a => a.Id == _w.VisibleResource)).Archive());

        Assert.Equal(System.Net.HttpStatusCode.NotFound, await RedeemAsync(learnerUrl));
        Assert.Equal(System.Net.HttpStatusCode.OK, await RedeemAsync(tutorUrl));
    }
}
