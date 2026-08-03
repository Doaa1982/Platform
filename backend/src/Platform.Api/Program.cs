using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

// Add common Aspire service defaults (OpenTelemetry, service discovery, health checks)
builder.AddServiceDefaults();

// Add services to the container
builder.Services.AddControllers();
builder.Services.AddOpenApi();

var app = builder.Build();

// Map default health endpoints
app.MapDefaultEndpoints();

// Configure HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference(options => 
    {
        options.WithTitle("Platform API Documentations")
               .WithTheme(ScalarTheme.Moon);
    });
}

app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();

app.Run();
