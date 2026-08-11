using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;

namespace Platform.Api;

/// <summary>
/// Rate limits for the endpoints a stranger can reach.
///
/// Submitting a Join Request creates no Identity and requires no credential —
/// SubmitJoinRequest carries only a name, email and optional message, and
/// JoinRequestService.SubmitAsync never touches db.Identities. (Join Request
/// Business Analysis BA-003 originally described a submission-time Identity
/// creation design; it was not built that way. See BA-003's 2026-08-08
/// correction note and TD-018.) So there is no self-serve account creation on
/// this path to guard against here.
///
/// What this limit actually bounds is volume, not escalation: an unauthenticated
/// caller can otherwise mint unlimited JoinRequest rows against any Workspace
/// accepting them, which is junk data and a reviewer's queue full of noise
/// (Join Request Business Analysis §5: "Ensuring one person cannot flood one
/// Workspace with parallel requests"). Rate limiting is the proportionate
/// answer to that volume problem.
///
/// Email verification is deliberately NOT part of this. It buys little here —
/// join requests are off by default per Workspace and require approval, so an
/// unverified address reaches nothing — and becomes necessary when public signup
/// arrives, where an Identity is useful on its own.
/// </summary>
public static class RateLimitPolicies
{
    public const string JoinRequests   = "join-requests";
    public const string PublicRead     = "public-read";
    public const string PasswordReset  = "password-reset";

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
        var resetLimit   = config.GetValue("RateLimits:PasswordReset:Permits", 5);
        var resetWindow  = config.GetValue("RateLimits:PasswordReset:WindowMinutes", 15);

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

            // Forgot/reset password: creates no Identity, but is the one place
            // a stranger can trigger an email to any address, repeatedly — the
            // proportionate limit here bounds spam and brute-force guessing of
            // a live reset token, not account creation.
            options.AddPolicy(PasswordReset, context =>
                RateLimitPartition.GetFixedWindowLimiter(
                    partitionKey: ClientKey(context),
                    factory: _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = resetLimit,
                        Window = TimeSpan.FromMinutes(resetWindow),
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
    /// Partition key for an anonymous caller — the connecting peer's address.
    ///
    /// **This is the immediate peer, not the end user.** Behind any proxy every
    /// request appears to come from that proxy, so all callers collapse into one
    /// partition. That is already true of browser traffic here, which arrives
    /// via the Vite dev-server proxy and Aspire's own DCP proxy; it is harmless
    /// with a single developer, but it means this partitioning is not exercised
    /// by the normal path.
    ///
    /// The failure mode when deployed is not a weaker limit but an inverted one:
    /// real users share a single bucket and trip it collectively, while an
    /// attacker is constrained no more than anyone else.
    ///
    /// Fixing it is NOT just enabling forwarded headers — `X-Forwarded-For` is
    /// attacker-controlled, so an unrestricted configuration trades a shared
    /// bucket for no bucket at all. It needs KnownProxies/KnownNetworks, which
    /// are deployment-specific. See Technical Debt Backlog TD-012.
    /// </summary>
    private static string ClientKey(HttpContext context) =>
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
}
