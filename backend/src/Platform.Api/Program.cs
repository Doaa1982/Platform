using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Platform.Api;
using Platform.Api.AI;
using Platform.Api.AI.Skills;
using Platform.Api.Authorization;
using Platform.Api.Models;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Http.Resilience;
using Microsoft.IdentityModel.Tokens;
using Platform.Api.Services;
using Platform.Domain;
using Platform.Infrastructure;
using Scalar.AspNetCore;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// ── Aspire service defaults (OpenTelemetry, health checks, service discovery) ──
builder.AddServiceDefaults();

// ── Controllers + OpenAPI ──────────────────────────────────────────────────────
builder.Services.AddControllers();
builder.Services.AddOpenApi();
builder.Services.AddProblemDetails();

// ── CORS ────────────────────────────────────────────────────────────────────────
// Wide open in Development only (matches the Vite dev server's arbitrary
// local port). Everywhere else, an explicit allow-list is required —
// Cors:AllowedOrigins (an array in config, e.g. ["https://app.example.com"]).
// A bearer token isn't automatically attached cross-origin the way a cookie
// would be, so this isn't the only thing standing between an attacker page
// and the API, but AllowAnyOrigin + AllowAnyHeader + AllowAnyMethod in every
// environment (including production) was needlessly broad — any origin that
// obtained a token another way (XSS, a leaked value) could still call the API
// from the browser with no restriction at all.
var corsAllowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        if (builder.Environment.IsDevelopment() && corsAllowedOrigins.Length == 0)
            policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod();
        else
            policy.WithOrigins(corsAllowedOrigins).AllowAnyHeader().AllowAnyMethod();
    });
});

// ── Database — connection string injected by Aspire ("PlatformDB" resource) ───
builder.Services.AddDbContext<PlatformDbContext>(options =>
    options.UseNpgsql(
        builder.Configuration.GetConnectionString("PlatformDB"),
        npgsql => npgsql.EnableRetryOnFailure(
            maxRetryCount: 5,
            maxRetryDelay: TimeSpan.FromSeconds(5),
            errorCodesToAdd: null)));

// ── JWT Authentication ─────────────────────────────────────────────────────────
var jwtKey = builder.Configuration["Jwt:Key"]
    ?? throw new InvalidOperationException("Jwt:Key must be configured in appsettings.");

// The key committed in appsettings.Development.json is real, non-random, and
// public (it's in source control) — fine for a local dev database nobody can
// reach, a genuine problem the moment it signs a token anyone can forge
// against a real deployment. Fail fast rather than silently accept it: an
// operator who forgot to set Jwt:Key in a real environment's config/secrets
// deserves a crash at startup, not a signing key an attacker can read on GitHub.
const string DevOnlyJwtKey = "platform-dev-secret-key-minimum-32-chars!!";
if (!builder.Environment.IsDevelopment() && jwtKey == DevOnlyJwtKey)
    throw new InvalidOperationException(
        "Jwt:Key is still set to the Development placeholder value. Configure a real, unique signing key for this environment.");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer           = true,
            ValidateAudience         = true,
            ValidateLifetime         = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer              = builder.Configuration["Jwt:Issuer"]   ?? "platform-api",
            ValidAudience            = builder.Configuration["Jwt:Audience"] ?? "platform-client",
            IssuerSigningKey         = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
        };

        // A <video> element cannot set an Authorization header, so the one
        // streaming endpoint that a browser addresses directly (not via
        // fetch) also accepts the bearer token as a query parameter.
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                if (context.Request.Path.StartsWithSegments("/api/workspaces", out var remainder)
                    && remainder.Value?.Contains("/learning-assets/", StringComparison.Ordinal) == true
                    && context.Request.Query.TryGetValue("access_token", out var token))
                {
                    context.Token = token;
                }
                return Task.CompletedTask;
            },

            // Signature/expiry alone can't catch a suspended account or an
            // explicit logout — both happen after the token was already
            // issued, and this is stateless JWT (no server-side session to
            // check by default). One extra DB read per authenticated request
            // is the same cost every request already pays to re-resolve
            // Workspace membership/roles live rather than trust the token —
            // this just extends that same "never trust a stale claim"
            // discipline to the Identity itself.
            OnTokenValidated = async context =>
            {
                // ASP.NET Core's default inbound claim map rewrites "sub" to
                // the legacy ClaimTypes.NameIdentifier URI before this handler
                // ever sees the principal — every controller's own identity
                // lookup already defends against this (see e.g.
                // AdminController.TryGetIdentityId's identical fallback); this
                // handler needs the same fallback or every token fails here
                // with "missing required claims" before a single controller
                // ever runs (V1 Launch Readiness Report — caught only by
                // actually driving a live authenticated request end to end,
                // never by the pure-domain TokenVersion test alone).
                var subClaim = context.Principal?.FindFirstValue(ClaimTypes.NameIdentifier)
                    ?? context.Principal?.FindFirstValue(JwtRegisteredClaimNames.Sub);
                var tvClaim = context.Principal?.FindFirstValue(TokenService.TokenVersionClaimType);
                if (!Guid.TryParse(subClaim, out var identityId) || !int.TryParse(tvClaim, out var tokenVersion))
                {
                    context.Fail("Token is missing required claims.");
                    return;
                }

                var db = context.HttpContext.RequestServices.GetRequiredService<PlatformDbContext>();
                var identity = await db.Identities.AsNoTracking()
                    .Where(i => i.Id == identityId)
                    .Select(i => new { i.Status, i.TokenVersion })
                    .FirstOrDefaultAsync();

                if (identity is null || identity.Status != IdentityStatus.Active || identity.TokenVersion != tokenVersion)
                    context.Fail("This session is no longer valid.");
            }
        };
    });

// Platform Administrator authority (Platform Administrator Business Analysis,
// BA-002): an Active PlatformOperator grant, checked live per request so a
// revoked grant takes effect immediately rather than at token expiry.
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy(PlatformOperatorRequirement.PolicyName, policy =>
    {
        policy.RequireAuthenticatedUser();
        policy.Requirements.Add(new PlatformOperatorRequirement());
    });
});
builder.Services.AddScoped<IAuthorizationHandler, PlatformOperatorHandler>();

// Resolves Workspace-scoped roles per request, since the token carries none
builder.Services.AddScoped<WorkspaceAccessService>();
builder.Services.AddScoped<ProvisioningService>();
builder.Services.AddScoped<WorkspaceMemberService>();
builder.Services.AddScoped<WorkspaceSetupService>();
builder.Services.AddScoped<JoinRequestService>();
builder.Services.AddScoped<SignupRequestService>();
 builder.Services.AddScoped<LearningProductService>();
builder.Services.AddScoped<ContentStudioService>();
builder.Services.AddSingleton<ILearningAssetStorage, LocalLearningAssetStorage>();
builder.Services.AddScoped<LearningAssetService>();
builder.Services.AddScoped<AssessmentService>();
builder.Services.AddScoped<AssignmentService>();
builder.Services.AddScoped<LearningDeliveryService>();
builder.Services.AddScoped<CourseJoinRequestService>();
builder.Services.AddScoped<NotificationService>();

// ── AI (AIModelProviderArchitecture / AIOrchestrationArchitecture / AISkillArchitecture) ──
// Provider sits behind IAiModelProvider — swapping vendors later means adding
// a new implementation here, with no change to AiOrchestrator or any Skill.
var aiOptions = builder.Configuration.GetSection(AiOptions.Section).Get<AiOptions>() ?? new AiOptions();
builder.Services.AddSingleton(aiOptions);
if (aiOptions.Provider.Equals("OpenAI", StringComparison.OrdinalIgnoreCase))
{
    builder.Services.AddHttpClient<IAiModelProvider, OpenAiModelProvider>();
}
else if (aiOptions.Provider.Equals("Gemini", StringComparison.OrdinalIgnoreCase))
{
    // Free-tier-eligible alternative (Gemini 2.5 Flash: 250 requests/day, no
    // card required, as of when this was wired up — check current limits at
    // ai.google.dev/gemini-api/docs/rate-limits, they change). Own options
    // class, not AiOptions, since it needs its own API key — a Gemini key
    // can't reuse a Claude/OpenAI one.
    var geminiOptions = builder.Configuration.GetSection(GeminiOptions.Section).Get<GeminiOptions>() ?? new GeminiOptions();
    builder.Services.AddSingleton(geminiOptions);
    builder.Services.AddHttpClient<IAiModelProvider, GeminiModelProvider>(client =>
    {
        client.BaseAddress = new Uri("https://generativelanguage.googleapis.com/v1beta/");
    });
}
else if (aiOptions.Provider.Equals("Ollama", StringComparison.OrdinalIgnoreCase))
{
    // Local model, no API key, no billing — runs entirely on the machine
    // running the API. Needs `ollama serve` running and the configured
    // model already pulled (`ollama pull <model>`) before use. Slower and
    // lower-quality than a hosted frontier model, but free and private —
    // a reasonable default while billing/keys for the others are unsettled.
    var ollamaOptions = builder.Configuration.GetSection(OllamaOptions.Section).Get<OllamaOptions>() ?? new OllamaOptions();
    builder.Services.AddSingleton(ollamaOptions);
    var ollamaClientBuilder = builder.Services.AddHttpClient<IAiModelProvider, OllamaModelProvider>(client =>
    {
        client.BaseAddress = new Uri(ollamaOptions.BaseUrl);
        // Local inference on CPU can be genuinely slow for a first response
        // (model load + generation) — the default HttpClient 100s timeout
        // has been observed to cut this off on modest hardware.
        client.Timeout = TimeSpan.FromMinutes(5);
    });
    // Aspire's AddServiceDefaults() wraps every HttpClient (via
    // ConfigureHttpClientDefaults) in Microsoft.Extensions.Http.Resilience's
    // standard pipeline, whose defaults — a 10s per-attempt timeout, 3
    // retries, 30s total-request timeout — fire long before client.Timeout
    // above ever gets a chance to. That pipeline is sized for fast internal
    // service calls, not CPU-bound local inference, so it needs overriding
    // here rather than left to silently cap every slow response at ~30s.
    ExtendResilienceTimeouts(ollamaClientBuilder, TimeSpan.FromMinutes(5));
}
else
{
    builder.Services.AddHttpClient<IAiModelProvider, ClaudeModelProvider>();
}
builder.Services.AddScoped<AiOrchestrator>();
builder.Services.AddScoped<GenerateQuestionsSkill>();
builder.Services.AddScoped<GradeAssessmentSkill>();
builder.Services.AddScoped<GenerateProductDescriptionSkill>();
builder.Services.AddScoped<GenerateWorkspaceProfileSkill>();
builder.Services.AddScoped<GenerateLessonBodySkill>();
builder.Services.AddScoped<GenerateWhatYoullLearnSkill>();
builder.Services.AddScoped<GenerateLessonTitleSkill>();
builder.Services.AddScoped<GenerateLearningObjectivesSkill>();
builder.Services.AddScoped<GenerateGlossarySkill>();
builder.Services.AddScoped<GenerateHomeworkSkill>();
builder.Services.AddScoped<LessonAssistantSkill>();
builder.Services.AddScoped<GenerateLessonQuizSkill>();
builder.Services.AddScoped<GenerateStandaloneQuestionsSkill>();
builder.Services.AddScoped<ExtractLessonContentFromResourceSkill>();

// ── Video transcription (AI Video Transcript Implementation Plan) ──────────
// A separate provider boundary from the text-completion one above: Claude
// doesn't do speech-to-text. Provider sits behind IAudioTranscriptionProvider
// — same Transcription:Provider switch pattern as Ai:Provider above.
var transcriptionOptions = builder.Configuration.GetSection(TranscriptionOptions.Section).Get<TranscriptionOptions>() ?? new TranscriptionOptions();
if (transcriptionOptions.Provider.Equals("FasterWhisper", StringComparison.OrdinalIgnoreCase))
{
    // Local model, no API key, no billing — runs entirely on the machine
    // running the API (or another machine on the local network). Needs a
    // faster-whisper server (e.g. `speaches`) already running before use.
    // Intended default for local development; has no chapter-detection
    // equivalent to Speechmatics' Auto Chapters, so TranscriptChapters stays
    // empty for videos transcribed this way.
    var fasterWhisperOptions = builder.Configuration.GetSection(FasterWhisperOptions.Section).Get<FasterWhisperOptions>() ?? new FasterWhisperOptions();
    builder.Services.AddSingleton(fasterWhisperOptions);
    var fasterWhisperClientBuilder = builder.Services.AddHttpClient<IAudioTranscriptionProvider, FasterWhisperTranscriptionProvider>(client =>
    {
        client.BaseAddress = new Uri(fasterWhisperOptions.BaseUrl);
        // Local inference on CPU can be genuinely slow for a longer video —
        // same reasoning as OllamaModelProvider's extended timeout.
        client.Timeout = TimeSpan.FromMinutes(30);
    });
    ExtendResilienceTimeouts(fasterWhisperClientBuilder, TimeSpan.FromMinutes(30));
}
else if (transcriptionOptions.Provider.Equals("LocalWhisper", StringComparison.OrdinalIgnoreCase))
{
    // Locally-running services/transcription FastAPI (faster-whisper medium
    // model). No API key, no billing, no data leaves the machine. Runs on
    // port 9000 by default to avoid colliding with the speaches container on
    // 8000. Start it with:
    //   cd services/transcription && uvicorn app.main:app --reload --port 9000
    var localWhisperOptions = builder.Configuration.GetSection(LocalWhisperOptions.Section).Get<LocalWhisperOptions>() ?? new LocalWhisperOptions();
    builder.Services.AddSingleton(localWhisperOptions);
    // ConfigureHttpClientDefaults (ServiceDefaults) wraps every client in the
    // standard 10s/30s pipeline. For a CPU-bound local inference call that can
    // run for an hour that pipeline fires immediately and kills the request.
    // RemoveAllResilienceHandlers strips it so we can replace it with one
    // sized for the actual workload. The API is experimental (EXTEXP0001) —
    // suppressed deliberately; it's the right tool here and the call is
    // confined to this dev-only branch.
#pragma warning disable EXTEXP0001
    builder.Services.AddHttpClient<IAudioTranscriptionProvider, LocalWhisperTranscriptionProvider>(client =>
    {
        client.BaseAddress = new Uri(localWhisperOptions.BaseUrl);
        // Medium model on CPU transcribes in roughly real-time — a 60-minute
        // video can take 60+ minutes. Let the resilience pipeline below own
        // the actual deadline instead of this hard cap.
        client.Timeout = Timeout.InfiniteTimeSpan;
    })
    .RemoveAllResilienceHandlers();
    // No resilience handler added back: transcription is not idempotent
    // (a "timed out" request may already have started work), there is no
    // useful circuit-breaker for a single-machine dev tool, and the process
    // has no external timeout — it will wait as long as the model needs.
    // client.Timeout = Timeout.InfiniteTimeSpan above is the only ceiling.
#pragma warning restore EXTEXP0001
}
else
{
    // Hosted, production default. Speechmatics accepts the stored video file
    // directly (mp4 is a supported input format), so no audio-extraction step.
    var speechmaticsOptions = builder.Configuration.GetSection(SpeechmaticsOptions.Section).Get<SpeechmaticsOptions>() ?? new SpeechmaticsOptions();
    builder.Services.AddSingleton(speechmaticsOptions);
    var speechmaticsClientBuilder = builder.Services.AddHttpClient<IAudioTranscriptionProvider, SpeechmaticsTranscriptionProvider>(client =>
    {
        client.BaseAddress = new Uri("https://eu1.asr.api.speechmatics.com/v2/");
        client.Timeout = Timeout.InfiniteTimeSpan; // the polling loop manages its own MaxWaitMinutes deadline
    });
    // client.Timeout above only matters if something respects it — the
    // resilience pipeline's own attempt/total timeouts run first, so they
    // need extending too, mainly to give a large video's upload (the one
    // real risk for a single HTTP call here) enough room.
    ExtendResilienceTimeouts(speechmaticsClientBuilder, TimeSpan.FromHours(2));
}
// A lesson's video can also be a direct-file URL instead of an uploaded
// asset (TranscriptionBackgroundService downloads it to a temp file before
// handing it to the provider above) — same "can run long" reasoning as the
// transcription clients themselves, sized for a large video download rather
// than a typical API call.
var videoDownloadClientBuilder = builder.Services.AddHttpClient("VideoDownload", client =>
{
    client.Timeout = TimeSpan.FromMinutes(30);
});
ExtendResilienceTimeouts(videoDownloadClientBuilder, TimeSpan.FromMinutes(30));

builder.Services.AddSingleton<TranscriptionQueue>();
builder.Services.AddHostedService<TranscriptionBackgroundService>();

// Commercial Domain — core spine (V1a)
builder.Services.AddScoped<CatalogQueryService>();
builder.Services.AddScoped<ConfigurationService>();
builder.Services.AddScoped<ICreditLedgerService, CreditLedgerService>();
builder.Services.AddScoped<EntitlementResolutionService>();
builder.Services.AddScoped<LicensingService>();
builder.Services.AddScoped<EntitlementOverrideService>();
builder.Services.AddScoped<CommercialSubscriptionService>();
builder.Services.AddScoped<CommercialOpsService>();
builder.Services.AddScoped<CatalogAdminService>();
builder.Services.AddScoped<CreditPurchaseService>();
builder.Services.AddHostedService<CommercialLifecycleSweepBackgroundService>();

// Guards the one endpoint a stranger can reach that creates an Identity, and
// the forgot/reset-password endpoints (create nothing, but reachable by anyone)
builder.Services.AddPlatformRateLimiting(builder.Configuration);
builder.Services.AddScoped<TokenService>();
builder.Services.AddScoped<PasswordResetService>();

// ── Invitation delivery ────────────────────────────────────────────────────────
// A platform-level notification, not a Communication Context message: an
// invitation goes out before a Workspace has any community (BA-005).
var emailOptions = builder.Configuration.GetSection(EmailOptions.Section).Get<EmailOptions>()
                   ?? new EmailOptions();
builder.Services.AddSingleton(emailOptions);

if (emailOptions.Enabled)
    builder.Services.AddScoped<IInvitationDelivery, SmtpInvitationDelivery>();
else
    // Logs the link and reports honestly that nothing was sent, so the console
    // tells the admin to deliver it by hand rather than implying mail is coming.
    builder.Services.AddScoped<IInvitationDelivery, LoggingInvitationDelivery>();

// ── Password reset delivery ─────────────────────────────────────────────────
// Its own interface and its own copy (PasswordResetDelivery.cs), sharing only
// EmailOptions/the SMTP settings with invitation delivery above — see that
// file's remarks for why the message itself is never reused.
if (emailOptions.Enabled)
    builder.Services.AddScoped<IPasswordResetDelivery, SmtpPasswordResetDelivery>();
else
    builder.Services.AddScoped<IPasswordResetDelivery, LoggingPasswordResetDelivery>();

var app = builder.Build();

if (!app.Environment.IsDevelopment() && corsAllowedOrigins.Length == 0)
    app.Logger.LogWarning(
        "Cors:AllowedOrigins is not configured in a non-Development environment — " +
        "the default CORS policy currently allows no cross-origin browser requests at all. " +
        "Set Cors:AllowedOrigins to the frontend's real origin(s) if it is served from a different origin than this API.");

if (!app.Environment.IsDevelopment() && !emailOptions.Enabled)
    app.Logger.LogWarning(
        "Email:Enabled is false in a non-Development environment — invitation and password-reset " +
        "emails will only be logged, never actually sent. Every raw link still appears in the API " +
        "response for someone to paste and send manually, but nothing reaches a real inbox until " +
        "Email:Enabled and the SMTP settings are configured for this environment.");

// ── Map Aspire health & liveness endpoints ─────────────────────────────────────
app.MapDefaultEndpoints();

// ── Schema + Commercial Catalog / AI Skill Pricing bootstrap — every environment ──
// Deliberately NOT gated to Development: without this, a fresh production
// database has no schema at all, and even with a schema, an empty Commercial
// Catalog means CheckoutAsync has nothing to sell — every new Workspace would
// get no Subscription/WorkspaceLicense/Entitlement rows at all, and every
// AI-gated feature would 403 for every real signup (V1 Production Readiness
// Report, P0-2). Safe to run on every startup: Migrate() no-ops once applied,
// and each seed below only writes when its own table is still empty — a
// Platform Operator publishing updated pricing through CatalogAdminController
// afterwards takes over from here exactly as it would in a database seeded
// by hand.
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<PlatformDbContext>();

    // Wait for Postgres to actually accept connections before touching it.
    //
    // Aspire's .WaitFor(db) reports the *container* as started, which is not the
    // same as the server being ready — and if the container is recreated while
    // the orchestrator keeps its proxy port open, connections are accepted with
    // nothing behind them and hang until they time out.
    //
    // EnableRetryOnFailure alone does not cover this: Npgsql classifies a
    // refused connection as non-transient, so the retrying execution strategy
    // rethrows it immediately. Hence an explicit readiness poll.
    await WaitForDatabaseAsync(db, app.Logger);

    // Migrate, not EnsureCreated. EnsureCreated only builds the schema when the
    // database has NO tables — on a database created by an earlier version of
    // the model it silently does nothing, so newly added tables never appear and
    // the first query against them fails with "relation does not exist".
    db.Database.Migrate();

    // ── Commercial Catalog seed ─────────────────────────────────────────────
    // Real business data, not a throwaway dev fixture — kept structurally
    // separate from the Identity/Workspace demo data below, and no longer
    // confined to Development the way it originally was (it used to only
    // live here because db.Database.Migrate() above was itself Development-
    // gated; now that both run everywhere, there is no reason to keep it
    // dev-only too).
    if (!db.CommercialProducts.Any())
    {
        var family = ProductFamily.Create("solo", "Solo");
        db.ProductFamilies.Add(family);

        foreach (var plan in CommercialCatalog.Plans)
        {
            var product = CommercialProduct.Create(family.Id, plan.Code, plan.Name);
            var version = CommercialProductVersion.Create(
                product.Id, versionNumber: 1,
                plan.MonthlyPrice, plan.AnnualPrice, plan.Currency,
                plan.TutorCapacityBase, plan.TutorCapacityMax,
                plan.LearnerCapacityBase, plan.LearnerCapacityMax,
                plan.VideoStorageGbBase, plan.VideoStorageGbMax,
                plan.ResourceStorageGbBase, plan.ResourceStorageGbMax,
                plan.AiCreditsIncluded,
                plan.LearningProfile, plan.AssessmentProfile, plan.AnalyticsProfile, plan.BrandingProfile);
            version.Publish();
            product.Publish();
            db.CommercialProducts.Add(product);
            db.CommercialProductVersions.Add(version);
        }

        foreach (var packDef in CommercialCatalog.Packs)
        {
            var pack = CommercialPack.Create(packDef.Code, packDef.Name);
            var version = CommercialPackVersion.Create(
                pack.Id, versionNumber: 1, packDef.MonthlyPrice, packDef.Currency,
                GrantFor(packDef, CapabilityDomain.Learning), GrantFor(packDef, CapabilityDomain.Assessment),
                GrantFor(packDef, CapabilityDomain.Analytics), GrantFor(packDef, CapabilityDomain.Branding),
                packDef.ExtraTutorCapacity, packDef.ExtraLearnerCapacity, packDef.ExtraVideoStorageGb, packDef.ExtraResourceStorageGb,
                packDef.RequiresMinProfile?.Domain, packDef.RequiresMinProfile?.MinLevel);
            version.Publish();
            pack.Publish();
            db.CommercialPacks.Add(pack);
            db.CommercialPackVersions.Add(version);
        }

        db.SaveChanges();

        static CapabilityProfileLevel? GrantFor(CapabilityPackDefinition pack, CapabilityDomain domain) =>
            pack.DomainGrants.TryGetValue(domain, out var level) ? level : null;
    }

    // ── AI Skill Credit Cost seed ────────────────────────────────────────────
    // Prices from Documents/AICreditsCommercialContractAndImplementationPlan.md
    // §A2. Same "real business data, runs everywhere" reasoning as the
    // Commercial Catalog seed just above. Banded skills' top tier uses
    // CreditLedgerService.UnboundedBand instead of null, so "null Band" means
    // exactly one thing everywhere in this service: a flat-priced skill.
    if (!db.SkillCreditCosts.Any())
    {
        db.SkillCreditCosts.AddRange(
            SkillCreditCost.Create(AiSkillKeys.LessonAssistant, null, 20),
            SkillCreditCost.Create(AiSkillKeys.GradeAssessment, 10, 8),
            SkillCreditCost.Create(AiSkillKeys.GradeAssessment, 30, 20),
            SkillCreditCost.Create(AiSkillKeys.GradeAssessment, CreditLedgerService.UnboundedBand, 35),
            SkillCreditCost.Create(AiSkillKeys.GenerateQuestions, null, 15),
            SkillCreditCost.Create(AiSkillKeys.GenerateStandaloneQuestions, 15, 15),
            SkillCreditCost.Create(AiSkillKeys.GenerateStandaloneQuestions, CreditLedgerService.UnboundedBand, 30),
            SkillCreditCost.Create(AiSkillKeys.GenerateLessonQuiz, 10, 15),
            SkillCreditCost.Create(AiSkillKeys.GenerateLessonQuiz, CreditLedgerService.UnboundedBand, 30),
            SkillCreditCost.Create(AiSkillKeys.GenerateLessonTitle, null, 5),
            SkillCreditCost.Create(AiSkillKeys.GenerateWorkspaceProfile, null, 10),
            SkillCreditCost.Create(AiSkillKeys.GenerateLearningObjectives, null, 10),
            SkillCreditCost.Create(AiSkillKeys.GenerateWhatYoullLearn, null, 8),
            SkillCreditCost.Create(AiSkillKeys.GenerateLessonBody, null, 30),
            SkillCreditCost.Create(AiSkillKeys.GenerateHomework, null, 15),
            SkillCreditCost.Create(AiSkillKeys.GenerateGlossary, null, 10),
            SkillCreditCost.Create(AiSkillKeys.GenerateProductDescription, null, 8),
            SkillCreditCost.Create(AiSkillKeys.ExtractLessonContentFromResource, 2, 25),
            SkillCreditCost.Create(AiSkillKeys.ExtractLessonContentFromResource, CreditLedgerService.UnboundedBand, 60));

        db.SaveChanges();
    }

    // ── Initial Platform Operator bootstrap ─────────────────────────────────
    // Without this, a fresh production deployment has no PlatformOperator row
    // at all and — since that grant is the sole authority AdminController's
    // signup-request approval endpoints check — nobody could ever approve the
    // very first tutor's signup request (V1 Launch Readiness Report). Runs
    // everywhere, guarded the same idempotent way as the seeds above.
    if (!db.PlatformOperators.Any())
    {
        var initialOperator = builder.Configuration.GetSection(InitialPlatformOperatorOptions.Section)
            .Get<InitialPlatformOperatorOptions>() ?? new InitialPlatformOperatorOptions();

        if (string.IsNullOrWhiteSpace(initialOperator.Email))
        {
            if (!app.Environment.IsDevelopment())
                app.Logger.LogWarning(
                    "InitialPlatformOperator:Email is not configured — no Platform Operator exists yet, " +
                    "so nobody can approve a tutor signup request or reach any admin endpoint. Set " +
                    "InitialPlatformOperator:Email (and :Password, unless that email already has an " +
                    "Identity) and restart to bootstrap the first Platform Operator.");
        }
        else
        {
            var existing = db.Identities.FirstOrDefault(i => i.Email == initialOperator.Email);
            if (existing is not null)
            {
                db.PlatformOperators.Add(PlatformOperator.Grant(existing.Id));
                db.SaveChanges();
                app.Logger.LogInformation(
                    "Granted PlatformOperator to the existing Identity for {Email}.", initialOperator.Email);
            }
            else if (string.IsNullOrWhiteSpace(initialOperator.Password))
            {
                app.Logger.LogWarning(
                    "InitialPlatformOperator:Email ({Email}) has no matching Identity yet, and " +
                    "InitialPlatformOperator:Password is not configured to create one — no Platform " +
                    "Operator was bootstrapped. Set :Password and restart.", initialOperator.Email);
            }
            else
            {
                var admin = Identity.Create(
                    email: initialOperator.Email,
                    passwordHash: BCrypt.Net.BCrypt.HashPassword(initialOperator.Password),
                    fullName: "Platform Admin");
                db.Identities.Add(admin);
                db.PlatformOperators.Add(PlatformOperator.Grant(admin.Id));
                db.SaveChanges();
                app.Logger.LogInformation(
                    "Bootstrapped the first Platform Operator ({Email}).", initialOperator.Email);
            }
        }
    }
}

// ── Dev-only: seed demo Identities/Workspace/Membership + a demo subscription ──
// Fake accounts and a throwaway workspace for local development only — unlike
// the catalog/pricing seed above, this has no business being in production.
if (app.Environment.IsDevelopment())
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<PlatformDbContext>();

    if (!db.Identities.Any())
    {
        var tutor = Identity.Create(
            email:        "tutor@platform.com",
            passwordHash: BCrypt.Net.BCrypt.HashPassword("Test1234!"),
            fullName:     "Demo Tutor"
        );
        db.Identities.Add(tutor);

        // A Workspace, and the Membership that makes the tutor a Teacher *inside it* —
        // roles are Workspace-scoped, never global to the Identity.
        var workspace = Workspace.Create(
            name:        "Demo Academy",
            slug:        "demo-academy",
            description: "Seeded Workspace for local development."
        );
        db.Workspaces.Add(workspace);

        var membership = Membership.Create(
            identityId:  tutor.Id,
            workspaceId: workspace.Id,
            WorkspaceRoleName.Owner, WorkspaceRoleName.Teacher
        );
        membership.Activate();
        db.Memberships.Add(membership);

        // Ownership is held via a Membership, not a direct Identity link
        // (Workspace Aggregate Design, Section 10).
        workspace.TransferOwnership(membership.Id);

        workspace.BeginConfiguration();
        workspace.MakePrivate();
        workspace.Publish();
        workspace.Activate();

        // A learner in the same Workspace, so the learning side has something to
        // show. Same Identity shape, same credentials mechanism — the only
        // difference is the role held on the Membership.
        var learner = Identity.Create(
            email:        "learner@platform.com",
            passwordHash: BCrypt.Net.BCrypt.HashPassword("Test1234!"),
            fullName:     "Demo Learner"
        );
        db.Identities.Add(learner);

        var learnerMembership = Membership.Create(
            identityId:  learner.Id,
            workspaceId: workspace.Id,
            WorkspaceRoleName.Learner
        );
        learnerMembership.Activate();
        db.Memberships.Add(learnerMembership);

        // Someone who both teaches and learns — the case a single global role
        // could never represent, and the reason switching sides exists.
        var both = Identity.Create(
            email:        "both@platform.com",
            passwordHash: BCrypt.Net.BCrypt.HashPassword("Test1234!"),
            fullName:     "Demo Tutor-Learner"
        );
        db.Identities.Add(both);

        var bothMembership = Membership.Create(
            identityId:  both.Id,
            workspaceId: workspace.Id,
            WorkspaceRoleName.Teacher, WorkspaceRoleName.Learner
        );
        bothMembership.Activate();
        db.Memberships.Add(bothMembership);

        // The Platform Administrator. Holds no Membership anywhere — its
        // authority is the PlatformOperator grant, not a Workspace role
        // (Platform Administrator Business Analysis, BA-001).
        //
        // The first grant has to come from a seed: GrantedBy is null because
        // there is nobody to grant it.
        var admin = Identity.Create(
            email:        "admin@platform.com",
            passwordHash: BCrypt.Net.BCrypt.HashPassword("Test1234!"),
            fullName:     "Platform Admin"
        );
        db.Identities.Add(admin);
        db.PlatformOperators.Add(PlatformOperator.Grant(admin.Id));

        db.SaveChanges();
    }

    // ── Demo subscription seed ──────────────────────────────────────────────
    // Without this, demo-academy exists with no Subscription/WorkspaceLicense/
    // Entitlement rows at all — CheckoutAsync is the only code path that ever
    // creates one, and nothing above calls it. Every AI-gated feature (Extract,
    // transcript generation, every ai-suggest-* button, the paste-content
    // fallback) would fail Forbidden for every seeded account on a fresh
    // environment. Goes through the real checkout flow rather than writing
    // Entitlement rows directly, so a fresh dev database ends up in exactly
    // the state a tutor reaches by checking out the Professional plan by hand.
    if (!db.Subscriptions.Any())
    {
        var demoWorkspace = await db.Workspaces.FirstOrDefaultAsync(w => w.Slug == "demo-academy");
        var demoTutor = await db.Identities.FirstOrDefaultAsync(i => i.Email == "tutor@platform.com");
        if (demoWorkspace is not null && demoTutor is not null)
        {
            var subscriptions = scope.ServiceProvider.GetRequiredService<CommercialSubscriptionService>();
            var checkout = await subscriptions.CheckoutAsync(
                "demo-academy", demoTutor.Id,
                new CheckoutRequest("solo-professional", PackCodes: [], BillingCycle: "Monthly"));
            if (checkout.Error != ProvisioningError.None)
                app.Logger.LogWarning("Demo subscription seed failed: {Message}", checkout.Message);
        }
    }
}

// ── HTTP pipeline ──────────────────────────────────────────────────────────────
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference(options =>
    {
        options.WithTitle("Platform API Documentation")
               .WithTheme(ScalarTheme.Moon);
    });
}

// No global exception handler existed before this — an unhandled exception
// fell through to Kestrel's own default behavior: no stack trace leak, but
// no structured/consistent error body either, unlike every deliberate error
// path in this API (ProvisioningResult → a typed { message } response).
// UseDeveloperExceptionPage in Development keeps full detail for local
// debugging; UseExceptionHandler (paired with AddProblemDetails above) gives
// every other environment a generic ProblemDetails body instead of a bare
// 500 with nothing in it.
if (app.Environment.IsDevelopment())
    app.UseDeveloperExceptionPage();
else
    app.UseExceptionHandler();

app.UseCors();
app.UseHttpsRedirection();
// Before authentication: an abusive caller should be turned away without
// costing a token validation or a database round trip
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();

/// <summary>
/// Aspire's AddServiceDefaults() wraps every HttpClient in a standard
/// resilience pipeline (10s per-attempt timeout, 3 retries, 30s total-request
/// timeout by default) via ConfigureHttpClientDefaults — sized for fast
/// internal service calls. For a client whose whole reason for a long
/// client.Timeout is CPU-bound local inference or a slow upload, that
/// pipeline runs first and silently kills the call long before client.Timeout
/// ever applies.
///
/// This used to re-target that pipeline's options via
/// <c>Configure&lt;HttpStandardResilienceOptions&gt;(clientBuilder.Name, ...)</c>,
/// which looked right but silently did nothing: the handler
/// ConfigureHttpClientDefaults attaches is keyed by target *authority*
/// (Microsoft.Extensions.Http.Resilience's ByAuthorityPipelineKeyProvider),
/// not by the HttpClient's own name, so the override configured a pipeline
/// key nothing ever reads. Confirmed live — Ollama calls kept timing out at
/// exactly 10s (Polly's default) despite this override supposedly setting 5
/// minutes. <see cref="LocalWhisperTranscriptionProvider"/>'s registration
/// already worked around the same issue with RemoveAllResilienceHandlers;
/// this does the same, then adds back a correctly-scoped handler (called
/// directly on the builder, so it binds by client name, not authority) with
/// retries off — none of these calls are idempotent, a "timed out" request
/// may already have been received and started work server-side.
/// </summary>
static void ExtendResilienceTimeouts(IHttpClientBuilder clientBuilder, TimeSpan timeout)
{
#pragma warning disable EXTEXP0001
    clientBuilder.RemoveAllResilienceHandlers();
#pragma warning restore EXTEXP0001
    clientBuilder.AddStandardResilienceHandler(options =>
    {
        options.AttemptTimeout.Timeout = timeout;
        options.TotalRequestTimeout.Timeout = timeout;
        options.CircuitBreaker.SamplingDuration = timeout * 2; // must be >= 2x AttemptTimeout
        // HttpRetryStrategyOptions validates MaxRetryAttempts >= 1, so 0 isn't
        // a legal way to disable retries here (this now actually gets
        // validated at startup — the previous, silently-ignored override
        // never tripped this). ShouldHandle returning false unconditionally
        // achieves the same "never retry" outcome the comment above already
        // explains the need for.
        options.Retry.ShouldHandle = _ => ValueTask.FromResult(false);
    });
}

/// <summary>
/// Polls until the database accepts connections, or gives up and rethrows.
///
/// Gives up rather than waiting forever: a database that is still unreachable
/// after the window is a real misconfiguration, and a host that never finishes
/// starting is harder to diagnose than one that fails with the actual error.
/// </summary>
static async Task WaitForDatabaseAsync(DbContext db, ILogger logger)
{
    const int maxAttempts = 12;
    var delay = TimeSpan.FromSeconds(2);

    for (var attempt = 1; ; attempt++)
    {
        try
        {
            if (await db.Database.CanConnectAsync()) return;
            throw new InvalidOperationException("The database is not accepting connections yet.");
        }
        catch (Exception ex) when (attempt < maxAttempts)
        {
            logger.LogWarning(
                "Database not ready (attempt {Attempt}/{Max}): {Reason}. Retrying in {Delay}s…",
                attempt, maxAttempts, ex.GetBaseException().Message, delay.TotalSeconds);

            await Task.Delay(delay);
        }
    }
}

/// <summary>Exposes the top-level-statement entry point to WebApplicationFactory&lt;Program&gt; for integration tests.</summary>
public partial class Program;
