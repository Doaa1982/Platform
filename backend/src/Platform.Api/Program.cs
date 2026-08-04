using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
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
    options.UseNpgsql(builder.Configuration.GetConnectionString("PlatformDB")));

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
    });

builder.Services.AddAuthorization();

var app = builder.Build();

// ── Map Aspire health & liveness endpoints ─────────────────────────────────────
app.MapDefaultEndpoints();

// ── Dev-only: auto-create schema + seed one test Tutor ────────────────────────
if (app.Environment.IsDevelopment())
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<PlatformDbContext>();
    db.Database.EnsureCreated();

    if (!db.Identities.Any())
    {
        var tutor = Identity.Create(
            email:        "tutor@platform.com",
            passwordHash: BCrypt.Net.BCrypt.HashPassword("Test1234!"),
            fullName:     "Demo Tutor",
            role:         IdentityRole.Tutor
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

        db.SaveChanges();
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
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
