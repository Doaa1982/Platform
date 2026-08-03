using Aspire.Hosting;

var builder = DistributedApplication.CreateBuilder(args);

// Define PostgreSQL database server and database resource
var postgres = builder.AddPostgres("PlatformDbServer")
    .WithPgAdmin()
    .WithDataVolume("PlatformData");

var db = postgres.AddDatabase("PlatformDB");

// Register the API backend project
var api = builder.AddProject<Projects.Platform_Api>("api")
    .WithReference(db)
    .WaitFor(db);

builder.Build().Run();
