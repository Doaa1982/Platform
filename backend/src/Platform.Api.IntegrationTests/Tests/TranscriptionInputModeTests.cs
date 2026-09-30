using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Platform.Api.IntegrationTests.Fixtures;
using Platform.Api.Services;
using Platform.Domain;
using Platform.Infrastructure;
using Xunit;

namespace Platform.Api.IntegrationTests.Tests;

/// <summary>
/// End-to-end coverage for the tutor's per-transcription Audio/VideoLowRes choice: mode
/// normalization for a non-Gemini provider, what actually gets charged for each mode, and the
/// pre-check that refuses a request the workspace can't afford before ever queuing a job.
/// Uses FakeAudioTranscriptionProvider/FakeAudioExtractor (PlatformApiTestFixture) so these
/// exercise the real controller/service/background-job/credit-ledger plumbing without a live
/// vendor call or a real FFmpeg binary download.
/// </summary>
public class TranscriptionInputModeTests(PlatformApiTestFixture fixture) : IClassFixture<PlatformApiTestFixture>
{
    /// <summary>Onboards a tutor on the Professional plan (AI-entitled) with one lesson whose current revision has a real, storage-backed video attached — everything GenerateTranscriptAsync needs to accept a request.</summary>
    private static async Task<(string TutorToken, string Slug, Guid LessonId)> SeedLessonWithVideoAsync(
        HttpClient client, PlatformApiTestFixture fixture, string unique)
    {
        var adminToken = await TestOnboarding.LoginAsync(client, PlatformApiTestFixture.AdminEmail, PlatformApiTestFixture.AdminPassword);
        var tutor = await TestOnboarding.OnboardTutorAsync(client, adminToken, $"{unique}-tutor@integrationtest.local", unique);
        await TestOnboarding.UpgradePlanAsync(client, adminToken, tutor.Token, tutor.WorkspaceSlug, "solo-professional");

        using var scope = fixture.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PlatformDbContext>();
        var storage = scope.ServiceProvider.GetRequiredService<ILearningAssetStorage>();

        var workspace = await db.Workspaces.SingleAsync(w => w.Slug == unique);
        var tutorMembership = await db.Memberships.Include(m => m.Roles)
            .SingleAsync(m => m.WorkspaceId == workspace.Id && m.Roles.Any(r => r.Name == WorkspaceRoleName.Owner));

        var bytes = Enumerable.Range(0, 5_000).Select(i => (byte)((i * 7 + 3) % 251)).ToArray();
        string objectKey;
        await using (var input = new MemoryStream(bytes))
            objectKey = await storage.SaveAsync(workspace.Id, "lesson.mp4", input, default);
        var videoAsset = LearningAsset.Upload(workspace.Id, tutorMembership.Id, LearningAssetCategory.Video,
            "lesson.mp4", "lesson.mp4", "video/mp4", bytes.Length, storageProvider: storage.ProviderName, objectKey: objectKey);
        db.LearningAssets.Add(videoAsset);

        var product = LearningProduct.Create(workspace.Id, tutorMembership.Id, "Course", enrollmentMode: EnrollmentMode.Open);
        var lesson = Lesson.Create(workspace.Id, product.Id, "Lesson 1", tutorMembership.Id);
        lesson.DraftRevision!.Edit("Lesson 1", "Body", 5, LessonDeliveryMode.Recorded);
        lesson.DraftRevision!.AttachVideo(videoAsset.Id);
        lesson.PublishDraft();
        db.LearningProducts.Add(product);
        db.Lessons.Add(lesson);
        await db.SaveChangesAsync();

        return (tutor.Token, unique, lesson.Id);
    }

    private static async Task<JsonObject> GenerateTranscriptAsync(HttpClient client, string token, string slug, Guid lessonId, string inputMode)
    {
        using var req = new HttpRequestMessage(HttpMethod.Post, $"/api/workspaces/{slug}/lessons/{lessonId}/transcript/generate");
        req.Headers.Authorization = new("Bearer", token);
        req.Content = JsonContent.Create(new { inputMode });
        var res = await client.SendAsync(req);
        return new JsonObject { ["status"] = (int)res.StatusCode, ["body"] = await res.Content.ReadFromJsonAsync<JsonObject>() };
    }

    private static async Task<LessonRevision> AwaitResolvedRevisionAsync(IServiceProvider services, Guid lessonId)
    {
        for (var i = 0; i < 200; i++)
        {
            using var scope = services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<PlatformDbContext>();
            var lesson = await db.Lessons.Include(l => l.Revisions).AsNoTracking().SingleAsync(l => l.Id == lessonId);
            var revision = lesson.CurrentRevision!;
            if (revision.TranscriptStatus is TranscriptStatus.Ready or TranscriptStatus.Failed) return revision;
            await Task.Delay(50);
        }
        throw new TimeoutException("the transcription job never resolved");
    }

    [Fact]
    public async Task Audio_Mode_Resolves_Ready_Records_Audio_Mode_And_Charges_The_Base_Price()
    {
        var client = fixture.CreateClient();
        var (token, slug, lessonId) = await SeedLessonWithVideoAsync(client, fixture, "tim-audio");

        var response = await GenerateTranscriptAsync(client, token, slug, lessonId, "Audio");
        Assert.Equal((int)HttpStatusCode.OK, response["status"]!.GetValue<int>());

        var revision = await AwaitResolvedRevisionAsync(fixture.Services, lessonId);
        Assert.Equal(TranscriptStatus.Ready, revision.TranscriptStatus);
        Assert.Equal(TranscriptionInputMode.Audio, revision.TranscriptionInputMode);
        Assert.Contains("(Audio)", revision.Transcript);

        using var scope = fixture.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PlatformDbContext>();
        var workspaceId = await TestOnboarding.GetWorkspaceIdAsync(db, slug);
        var charged = await db.CreditLedgerEntries.AsNoTracking()
            .Where(e => e.WorkspaceId == workspaceId && e.EntryType == CreditLedgerEntryType.Consumption && e.SkillKey == AI.AiSkillKeys.GenerateTranscript)
            .SingleAsync();
        Assert.Equal(-40, charged.Amount); // base GenerateTranscriptSkill price seeded by Program.cs
    }

    [Fact]
    public async Task VideoLowRes_Mode_With_Gemini_Provider_Stays_VideoLowRes_And_Charges_The_Multiplier()
    {
        // The test fixture's environment is deliberately not "Development" (PlatformApiTestFixture's
        // own remarks), so Transcription:Provider falls back to TranscriptionOptions' class default,
        // "Deepgram" — Gemini is set explicitly here for the "not normalized" branch; the sibling
        // test below overrides it to a non-Gemini provider for the normalization branch specifically.
        using var host = fixture.WithWebHostBuilder(b => b.UseSetting("Transcription:Provider", "Gemini"));
        using var client = host.CreateClient();
        var (token, slug, lessonId) = await SeedLessonWithVideoAsync(client, fixture, "tim-lowres");

        var response = await GenerateTranscriptAsync(client, token, slug, lessonId, "VideoLowRes");
        Assert.Equal((int)HttpStatusCode.OK, response["status"]!.GetValue<int>());

        var revision = await AwaitResolvedRevisionAsync(host.Services, lessonId);
        Assert.Equal(TranscriptStatus.Ready, revision.TranscriptStatus);
        Assert.Equal(TranscriptionInputMode.VideoLowRes, revision.TranscriptionInputMode);
        Assert.Contains("(VideoLowRes)", revision.Transcript);

        using var scope = fixture.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PlatformDbContext>();
        var workspaceId = await TestOnboarding.GetWorkspaceIdAsync(db, slug);
        var charged = await db.CreditLedgerEntries.AsNoTracking()
            .Where(e => e.WorkspaceId == workspaceId && e.EntryType == CreditLedgerEntryType.Consumption && e.SkillKey == AI.AiSkillKeys.GenerateTranscript)
            .SingleAsync();
        Assert.Equal(-120, charged.Amount); // 40 base * 3 (default VideoLowResCostMultiplier)
    }

    [Fact]
    public async Task VideoLowRes_Mode_With_A_Non_Gemini_Provider_Normalizes_To_Audio_And_Charges_The_Base_Price()
    {
        using var host = fixture.WithWebHostBuilder(b => b.UseSetting("Transcription:Provider", "Deepgram"));
        using var client = host.CreateClient();
        var (token, slug, lessonId) = await SeedLessonWithVideoAsync(client, fixture, "tim-normalize");

        var response = await GenerateTranscriptAsync(client, token, slug, lessonId, "VideoLowRes");
        Assert.Equal((int)HttpStatusCode.OK, response["status"]!.GetValue<int>());

        var revision = await AwaitResolvedRevisionAsync(host.Services, lessonId);
        Assert.Equal(TranscriptStatus.Ready, revision.TranscriptStatus);
        // Requested VideoLowRes, but Deepgram has no video-input concept — normalized silently.
        Assert.Equal(TranscriptionInputMode.Audio, revision.TranscriptionInputMode);
        Assert.Contains("(Audio)", revision.Transcript);

        using var scope = host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PlatformDbContext>();
        var workspaceId = await TestOnboarding.GetWorkspaceIdAsync(db, slug);
        var charged = await db.CreditLedgerEntries.AsNoTracking()
            .Where(e => e.WorkspaceId == workspaceId && e.EntryType == CreditLedgerEntryType.Consumption && e.SkillKey == AI.AiSkillKeys.GenerateTranscript)
            .SingleAsync();
        Assert.Equal(-40, charged.Amount); // normalized to Audio, so the base price, not the multiplier
    }

    [Fact]
    public async Task Exhausted_Balance_Refuses_Cleanly_Before_Any_Job_Is_Queued()
    {
        var client = fixture.CreateClient();
        var (token, slug, lessonId) = await SeedLessonWithVideoAsync(client, fixture, "tim-exhausted");

        using (var scope = fixture.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<PlatformDbContext>();
            var workspaceId = await TestOnboarding.GetWorkspaceIdAsync(db, slug);
            var existingEntries = await db.CreditLedgerEntries.Where(e => e.WorkspaceId == workspaceId).ToListAsync();
            foreach (var entry in existingEntries)
                db.Entry(entry).Property("ExpiresAtUtc").CurrentValue = DateTime.UtcNow.AddSeconds(-1);
            await db.SaveChangesAsync();
        }

        var response = await GenerateTranscriptAsync(client, token, slug, lessonId, "Audio");
        Assert.Equal((int)HttpStatusCode.PaymentRequired, response["status"]!.GetValue<int>());

        // Nothing was ever queued — TranscriptStatus never left None, and no Consumption entry exists.
        using var scope2 = fixture.Services.CreateScope();
        var db2 = scope2.ServiceProvider.GetRequiredService<PlatformDbContext>();
        var lesson = await db2.Lessons.Include(l => l.Revisions).AsNoTracking().SingleAsync(l => l.Id == lessonId);
        Assert.Equal(TranscriptStatus.None, lesson.CurrentRevision!.TranscriptStatus);
        var workspaceId2 = await TestOnboarding.GetWorkspaceIdAsync(db2, slug);
        Assert.False(await db2.CreditLedgerEntries.AnyAsync(e =>
            e.WorkspaceId == workspaceId2 && e.EntryType == CreditLedgerEntryType.Consumption && e.SkillKey == AI.AiSkillKeys.GenerateTranscript));
    }

    // ── ffmpeg-unavailable fallback (AudioExtractor.IsAvailable == false) ───────────────

    [Fact]
    public async Task WhenFfmpegIsUnavailable_AnAudioRequestAgainstGemini_FallsBackToVideoLowRes()
    {
        using var host = fixture.WithWebHostBuilder(b => b
            .UseSetting("Transcription:Provider", "Gemini")
            .ConfigureTestServices(s =>
            {
                s.RemoveAll<AI.IAudioExtractor>();
                s.AddSingleton<AI.IAudioExtractor, UnavailableAudioExtractor>();
            }));
        using var client = host.CreateClient();
        var (token, slug, lessonId) = await SeedLessonWithVideoAsync(client, fixture, "tim-noffmpeg-gemini");

        var response = await GenerateTranscriptAsync(client, token, slug, lessonId, "Audio");
        Assert.Equal((int)HttpStatusCode.OK, response["status"]!.GetValue<int>());

        var revision = await AwaitResolvedRevisionAsync(host.Services, lessonId);
        Assert.Equal(TranscriptStatus.Ready, revision.TranscriptStatus);
        // Requested Audio, but ffmpeg can't extract it — Gemini doesn't need local extraction
        // for VideoLowRes, so it falls back there instead of failing outright.
        Assert.Equal(TranscriptionInputMode.VideoLowRes, revision.TranscriptionInputMode);

        using var scope = host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PlatformDbContext>();
        var workspaceId = await TestOnboarding.GetWorkspaceIdAsync(db, slug);
        var charged = await db.CreditLedgerEntries.AsNoTracking()
            .Where(e => e.WorkspaceId == workspaceId && e.EntryType == CreditLedgerEntryType.Consumption && e.SkillKey == AI.AiSkillKeys.GenerateTranscript)
            .SingleAsync();
        Assert.Equal(-120, charged.Amount); // fell back to VideoLowRes, so the multiplier price, not the base one
    }

    [Fact]
    public async Task WhenFfmpegIsUnavailable_AnAudioRequestAgainstANonGeminiProvider_IsRefusedCleanly()
    {
        using var host = fixture.WithWebHostBuilder(b => b
            .UseSetting("Transcription:Provider", "Deepgram")
            .ConfigureTestServices(s =>
            {
                s.RemoveAll<AI.IAudioExtractor>();
                s.AddSingleton<AI.IAudioExtractor, UnavailableAudioExtractor>();
            }));
        using var client = host.CreateClient();
        var (token, slug, lessonId) = await SeedLessonWithVideoAsync(client, fixture, "tim-noffmpeg-deepgram");

        var response = await GenerateTranscriptAsync(client, token, slug, lessonId, "Audio");

        // Deepgram has no video-input fallback — refused up front (Conflict), not queued to fail later.
        Assert.Equal((int)HttpStatusCode.Conflict, response["status"]!.GetValue<int>());

        using var scope = host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PlatformDbContext>();
        var lesson = await db.Lessons.Include(l => l.Revisions).AsNoTracking().SingleAsync(l => l.Id == lessonId);
        Assert.Equal(TranscriptStatus.None, lesson.CurrentRevision!.TranscriptStatus);
    }
}
