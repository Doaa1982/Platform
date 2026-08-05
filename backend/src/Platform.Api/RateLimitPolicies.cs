using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;

namespace Platform.Api;

/// <summary>
/// Rate limits for the endpoints a stranger can reach.
///
/// Join Request Business Analysis BA-003 accepts a real cost: submitting a join
/// request creates an Identity for someone with no prior relationship to the
/// platform, because requiring an Identity first would be circular — there is
/// no self-serve signup, so only already-invited people could ask to join.
///
/// That makes account creation self-serve, and therefore abusable. The realistic
/// harm is volume rather than escalation: an Identity holding no Membership can
/// only sign in and see an empty list, so what an attacker actually achieves is
/// junk rows and a reviewer's queue full of noise. Rate limiting is the
/// proportionate answer to a volume problem.
///
/// Email verification is deliberately NOT part of this. It buys little here —
/// join requests are off by default per Workspace and require approval, so an
/// unverified address reaches nothing — and becomes necessary when public signup
/// arrives, where an Identity is useful on its own.
/// </summary>
public static class RateLimitPolicies
{
    public const string JoinRequests = "join-requests";
    public const string PublicRead   = "public-read";

    public static IServiceCollection AddPlatformRateLimiting(
        this IServiceCollection services, IConfiguration config)
    {
        // Configurable rather than hard-coded, so the numbers can be tuned
        // against observed traffic without a redeploy — and so tests and local
        // development can loosen them without editing code.
        var submitLimit  = config.GetValue("RateLimits:JoinRequests:Permits", 5);
        var submitWindow = config.GetValue("RateLimits:JoinRequests:WindowMinutes", 10);
        var readLimit    = config.GetValue("RateLimits:PublicRead:Permits", 60);
        var readWindow   = config.GetValue("RateLimits:PublicRead:WindowMinutes", 1);

        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

            // Submissions: strict, because each one can mint an Identity.
            // Partitioned by client IP — the only stable signal available before
            // the caller has any account.
            options.AddPolicy(JoinRequests, context =>
                RateLimitPartition.GetFixedWindowLimiter(
                    partitionKey: ClientKey(context),
                    factory: _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = submitLimit,
                        Window = TimeSpan.FromMinutes(submitWindow),
                        QueueLimit = 0,   // reject immediately rather than delay
                    }));

            // Reads: looser. These create nothing; the limit exists only to stop
            // the slug namespace being enumerated cheaply.
            options.AddPolicy(PublicRead, context =>
                RateLimitPartition.GetFixedWindowLimiter(
                    partitionKey: ClientKey(context),
                    factory: _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = readLimit,
                        Window = TimeSpan.FromMinutes(readWindow),
                        QueueLimit = 0,
                    }));

            options.OnRejected = async (context, ct) =>
            {
                context.HttpContext.Response.ContentType = "application/json";
                await context.HttpContext.Response.WriteAsync(
                    """{"message":"Too many attempts. Please wait a few minutes and try again."}""", ct);
            };
        });

        return services;
    }

    /// <summary>
    /// Partition key for an anonymous caller.
    ///
    /// Behind a reverse proxy every request appears to come from the proxy, so
    /// this would need the forwarded-headers middleware configured before it
    /// partitions correctly in a deployed environment — see TD-012.
    /// </summary>
    private static string ClientKey(HttpContext context) =>
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
}
