using Aspire.Hosting;

var builder = DistributedApplication.CreateBuilder(args);

// Define PostgreSQL database server and database resource
var postgres = builder.AddPostgres("PlatformDbServer")
    .WithPgAdmin()
    .WithPgWeb()
    .WithDataVolume("PlatformData");

var db = postgres.AddDatabase("PlatformDB");

// Register the API backend project
var api = builder.AddProject<Projects.Platform_Api>("api")
    .WithReference(db)
    .WaitFor(db);

// Register the React/Vite frontend as an npm app
var frontend = builder.AddNpmApp("frontend", "../../../frontend", "dev")
    .WithReference(api)
    .WaitFor(api)
    .WithHttpEndpoint(port: 3000, env: "VITE_PORT")
    .WithExternalHttpEndpoints();

builder.Build().Run();
