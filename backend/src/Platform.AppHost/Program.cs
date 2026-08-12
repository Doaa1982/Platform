using Aspire.Hosting;

var builder = DistributedApplication.CreateBuilder(args);

// Fixed password + fixed host port so an external client (DataGrip, psql,
// etc.) can save one connection profile that keeps working across AppHost
// restarts. Without this, Aspire generates a new random password and a new
// random host port every run (CreateDefaultPasswordParameter) — harmless for
// the API itself (it reads the connection string fresh each launch), but
// means re-entering credentials in any external tool every time.
//
// The actual secret value is read from AppHost user-secrets, never
// committed:
//   cd backend/src/Platform.AppHost
//   dotnet user-secrets set "Parameters:postgres-password" "<your password>"
var postgresPassword = builder.AddParameter("postgres-password", secret: true);

// Define PostgreSQL database server and database resource
var postgres = builder.AddPostgres("PlatformDbServer", password: postgresPassword, port: 55432)
    .WithPgAdmin()
    .WithPgWeb()
    .WithDataVolume("PlatformData");

var db = postgres.AddDatabase("PlatformDB");

// Local mail server. Mailpit accepts SMTP on 1025 and serves everything it
// receives at its own web UI on 8025 — so invitation emails are really sent and
// really readable, without anything leaving the machine. Nothing here is
// production mail configuration; a deployed environment points Email:Host at a
// real provider instead.
var mail = builder.AddContainer("mailpit", "axllent/mailpit")
    .WithEndpoint(port: 1025, targetPort: 1025, name: "smtp")
    .WithHttpEndpoint(port: 8025, targetPort: 8025, name: "ui")
    .WithExternalHttpEndpoints();

// Local faster-whisper transcription server (speaches) — the dev-only
// alternative to Speechmatics selected via Transcription:Provider =
// "FasterWhisper" in appsettings.Development.json (see Program.cs in
// Platform.Api). CPU image; swap the tag for a GPU build if the host has
// one. Fixed host port matches FasterWhisperOptions.BaseUrl's hardcoded
// "http://localhost:8000/" — this isn't wired through Aspire service
// discovery, so keep the two in sync if either changes. Named volume keeps
// models downloaded via POST /v1/models (see FasterWhisperOptions.Model)
// across AppHost restarts, same reasoning as Postgres's WithDataVolume —
// without it, the ~150MB base model would re-download every restart.
var speaches = builder.AddContainer("speaches", "ghcr.io/speaches-ai/speaches", "latest-cpu")
    .WithHttpEndpoint(port: 8000, targetPort: 8000, name: "http")
    .WithVolume("speaches-cache", "/home/ubuntu/.cache/huggingface")
    .WithExternalHttpEndpoints();

// Register the API backend project
var api = builder.AddProject<Projects.Platform_Api>("api")
    .WithReference(db)
    .WaitFor(db)
    .WaitFor(mail)
    .WaitFor(speaches)
    .WithEnvironment("Email__Enabled", "true")
    .WithEnvironment("Email__Host", "localhost")
    .WithEnvironment("Email__Port", "1025")
    // The link inside an email has no origin to resolve against, so it must be
    // absolute — and must point at the frontend, not the API.
    .WithEnvironment("Email__PublicBaseUrl", "http://localhost:3000");

// Register the React/Vite frontend as an npm app
var frontend = builder.AddNpmApp("frontend", "../../../frontend", "dev")
    .WithReference(api)
    .WaitFor(api)
    .WithHttpEndpoint(port: 3000, env: "VITE_PORT")
    .WithExternalHttpEndpoints();

builder.Build().Run();
