namespace Platform.Domain.Tests;

/// <summary>
/// Identity.TokenVersion/InvalidateSessions — a stateless JWT can't be
/// revoked individually without a per-token blacklist this codebase has no
/// infrastructure for; bumping TokenVersion (checked against a claim on
/// every request by Program.cs's OnTokenValidated) is the "sign out
/// everywhere" granularity that's actually achievable, used by the new
/// logout endpoint and by a password reset (V1 Production Readiness
/// Report, P1 — session revocation).
/// </summary>
public class IdentitySessionTests
{
    private static Identity NewIdentity() =>
        Identity.Create("tutor@example.com", "hashed-password", "Alex Tutor");

    [Fact]
    public void NewIdentity_StartsAtTokenVersionZero()
    {
        var identity = NewIdentity();

        Assert.Equal(0, identity.TokenVersion);
    }

    [Fact]
    public void InvalidateSessions_IncrementsTokenVersion()
    {
        var identity = NewIdentity();

        identity.InvalidateSessions();

        Assert.Equal(1, identity.TokenVersion);
    }

    [Fact]
    public void InvalidateSessions_CalledTwice_IncrementsTwice()
    {
        var identity = NewIdentity();

        identity.InvalidateSessions();
        identity.InvalidateSessions();

        // Every token issued before either call — including one issued
        // between the two calls — must fail Program.cs's exact-match check
        // against the live value.
        Assert.Equal(2, identity.TokenVersion);
    }
}
