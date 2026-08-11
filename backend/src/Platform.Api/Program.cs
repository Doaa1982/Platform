using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Platform.Api;
using Platform.Api.AI;
using Platform.Api.AI.Skills;
using Platform.Api.Authorization;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.IdentityModel.Tokens;
using Platform.Api.Services;
using Platform.Domain;
using Platform.Infrastructure;
using Scalar.AspNetCore;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// ── Aspire service defaults (OpenTelemetry, health checks, service discovery) ──
builder.AddServiceDefaults();

// ── Controllers + OpenAPI ──────────────────────────────────────────────────────
builder.Services.AddControllers();
builder.Services.AddOpenApi();

// ── CORS — open policy for local development (same as SMS reference) ──────────
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod());
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
builder.Services.AddScoped<LearningDeliveryService>();
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
else
{
    builder.Services.AddHttpClient<IAiModelProvider, ClaudeModelProvider>();
}
builder.Services.AddScoped<AiOrchestrator>();
builder.Services.AddScoped<GenerateQuestionsSkill>();
builder.Services.AddScoped<GradeAssessmentSkill>();
builder.Services.AddScoped<GenerateProductDescriptionSkill>();
builder.Services.AddScoped<GenerateLessonBodySkill>();
builder.Services.AddScoped<GenerateWhatYoullLearnSkill>();
builder.Services.AddScoped<GenerateLessonTitleSkill>();
builder.Services.AddScoped<GenerateLearningObjectivesSkill>();
builder.Services.AddScoped<GenerateGlossarySkill>();
builder.Services.AddScoped<GenerateHomeworkSkill>();

// ── Video transcription (AI Video Transcript Implementation Plan) ──────────
// A separate provider boundary from the text-completion one above: Claude
// doesn't do speech-to-text, and Speechmatics accepts the stored video file
// directly (mp4 is a supported input format), so no audio-extraction step.
var speechmaticsOptions = builder.Configuration.GetSection(SpeechmaticsOptions.Section).Get<SpeechmaticsOptions>() ?? new SpeechmaticsOptions();
builder.Services.AddSingleton(speechmaticsOptions);
builder.Services.AddHttpClient<IAudioTranscriptionProvider, SpeechmaticsTranscriptionProvider>(client =>
{
    client.BaseAddress = new Uri("https://eu1.asr.api.speechmatics.com/v2/");
    client.Timeout = Timeout.InfiniteTimeSpan; // polling loop manages its own MaxWaitMinutes deadline
});
builder.Services.AddSingleton<TranscriptionQueue>();
builder.Services.AddHostedService<TranscriptionBackgroundService>();

// Commercial Domain — core spine (V1a)
builder.Services.AddScoped<CatalogQueryService>();
builder.Services.AddScoped<ConfigurationService>();
builder.Services.AddScoped<EntitlementResolutionService>();
builder.Services.AddScoped<LicensingService>();
builder.Services.AddScoped<EntitlementOverrideService>();
builder.Services.AddScoped<CommercialSubscriptionService>();
builder.Services.AddScoped<CommercialOpsService>();
builder.Services.AddScoped<CatalogAdminService>();

// Guards the one endpoint a stranger can reach that creates an Identity
builder.Services.AddPlatformRateLimiting(builder.Configuration);
builder.Services.AddScoped<TokenService>();

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

var app = builder.Build();

// ── Map Aspire health & liveness endpoints ─────────────────────────────────────
app.MapDefaultEndpoints();

// ── Dev-only: auto-create schema + seed one test Tutor ────────────────────────
if (app.Environment.IsDevelopment())
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

    // ── Commercial Catalog seed ─────────────────────────────────────────────
    // Deliberately its own check, not nested inside "no Identities yet" above:
    // the Product/Pack catalog is real business data, not a throwaway dev
    // fixture, so it's kept structurally separate. It only lives inside this
    // IsDevelopment() block because db.Database.Migrate() above is itself
    // gated the same way — there is no other startup path that touches the
    // schema yet. Move this seed alongside a real migration step once one exists.
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
                plan.TutorCapacityBase, plan.TutorCapacityMax, plan.AiCreditsIncluded,
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
                packDef.ExtraTutorCapacity,
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
