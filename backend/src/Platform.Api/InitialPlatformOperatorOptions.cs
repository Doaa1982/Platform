namespace Platform.Api;

/// <summary>
/// Bootstraps the very first <see cref="Platform.Domain.PlatformOperator"/>
/// grant in a production deployment (V1 Launch Readiness Report — before this
/// existed, the seed only ran inside <c>IsDevelopment()</c>, so a real
/// deployment had no way for anyone to ever hold Platform Administrator
/// authority: nobody could reach <c>AdminController</c>'s
/// signup-request-approval endpoints, which made the entire self-service
/// tutor signup path — Platform Administrator Business Analysis §7.1 —
/// unreachable). Same "config-driven, idempotent, environment-unconditional"
/// shape as every other option class here.
/// </summary>
public class InitialPlatformOperatorOptions
{
    public const string Section = "InitialPlatformOperator";

    /// <summary>
    /// If an Identity with this email already exists, it is granted
    /// PlatformOperator directly (no password touched). Otherwise a new
    /// Identity is created using <see cref="Password"/>, which is then
    /// required.
    /// </summary>
    public string? Email { get; set; }

    /// <summary>Required only when <see cref="Email"/> doesn't match an existing Identity.</summary>
    public string? Password { get; set; }
}
