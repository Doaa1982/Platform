using Microsoft.EntityFrameworkCore;
using Platform.Api.Models;
using Platform.Domain;
using Platform.Infrastructure;

namespace Platform.Api.Services;

/// <summary>
/// Self-service account recovery for a Tutor or Student who has forgotten
/// their password — the counterpart to sign-in that needs no Platform
/// Operator's involvement.
///
/// Follows the same shape as SignupRequestService and ProvisioningService:
/// lazy expiry (nothing sweeps in the background; an elapsed link is written
/// Expired the first time anyone looks), and the single-use SecureToken
/// shared with Invitation and the Signup Status Link.
///
/// The one rule this service enforces that those two don't need to: never
/// reveal whether an email address belongs to an account. RequestAsync's
/// response is identical either way — AuthController.Login already follows
/// this for a wrong password (INV-006), and a forgot-password form is the far
/// easier place to abuse if it answers honestly.
/// </summary>
public class PasswordResetService(
    PlatformDbContext db,
    IConfiguration config,
    IPasswordResetDelivery delivery,
    EmailOptions email)
{
    /// <summary>
    /// Short by design — unlike an Invitation, a forgotten-password link sits
    /// in an inbox for minutes, not days, and a long-lived one is a bigger
    /// prize if that inbox is ever compromised.
    /// </summary>
    private TimeSpan ValidFor =>
        TimeSpan.FromMinutes(config.GetValue("PasswordReset:ValidForMinutes", 60));

    /// <summary>Relative for the client, which resolves it against its own origin.</summary>
    private static string LinkFor(string rawToken) => $"/reset-password/{rawToken}";

    /// <summary>Absolute for email, which has no origin to resolve against.</summary>
    private string AbsoluteLinkFor(string rawToken) =>
        $"{email.PublicBaseUrl.TrimEnd('/')}{LinkFor(rawToken)}";

    private const string GenericMessage =
        "If an account exists for that email, we've sent a link to reset the password.";

    // ── Requesting ───────────────────────────────────────────────────────────

    /// <summary>
    /// Issues a reset link for the given email — or does nothing at all, if
    /// no Active Identity owns it. Either way the caller sees the same
    /// response, so this endpoint cannot be used to test which emails have
    /// accounts.
    /// </summary>
    public async Task<ForgotPasswordResponse> RequestAsync(
        ForgotPasswordRequest request, CancellationToken ct = default)
    {
        var normalizedEmail = request.Email?.ToLowerInvariant().Trim();

        if (string.IsNullOrWhiteSpace(normalizedEmail))
            return new ForgotPasswordResponse(GenericMessage);

        var identity = await db.Identities
            .FirstOrDefaultAsync(i => i.Email == normalizedEmail, ct);

        // Silently do nothing for an unknown email, a Suspended/Archived one,
        // or any other reason this shouldn't proceed — the response never
        // says which.
        if (identity is null || identity.Status != IdentityStatus.Active)
            return new ForgotPasswordResponse(GenericMessage);

        // At most one open reset per Identity (mirrors Invitation's "Single
        // Active Invitation" rule, §8): a fresher request supersedes whatever
        // was still open, so a stale link sitting in an old inbox stops
        // working the moment a new one is sent.
        var openResets = await db.PasswordResets
            .Where(r => r.IdentityId == identity.Id && r.Status == PasswordResetStatus.Issued)
            .ToListAsync(ct);

        foreach (var stale in openResets)
        {
            if (stale.IsOpen()) stale.Cancel();
            else stale.Expire();
        }

        var (reset, rawToken) = PasswordReset.Issue(identity.Id, ValidFor);
        db.PasswordResets.Add(reset);
        await db.SaveChangesAsync(ct);

        // Best-effort, like every other link delivery in this codebase: the
        // reset already exists and is valid regardless of whether the email
        // actually left the building. There is no admin console to fall back
        // to here, so failure is only ever visible in the server log.
        await delivery.SendPasswordResetAsync(
            identity.Email, identity.FullName, AbsoluteLinkFor(rawToken), reset.ExpiresAt, ct);

        return new ForgotPasswordResponse(GenericMessage);
    }

    // ── Opening the link ─────────────────────────────────────────────────────

    /// <summary>
    /// What the link resolves to before the visitor has typed anything —
    /// GET /api/auth/reset-password/{token}.
    /// </summary>
    public async Task<ProvisioningResult<PasswordResetPreview>> PreviewAsync(
        string rawToken, CancellationToken ct = default)
    {
        var (reset, identity) = await FindOpenAsync(rawToken, ct);
        if (reset is null || identity is null)
        {
            await db.SaveChangesAsync(ct);   // persist any lazy expiry just written
            return ProvisioningResult<PasswordResetPreview>.Fail(
                ProvisioningError.NotFound, "This link isn't valid. Request a new one.");
        }

        return ProvisioningResult<PasswordResetPreview>.Success(
            new PasswordResetPreview(identity.Email, reset.ExpiresAt));
    }

    // ── Spending it ──────────────────────────────────────────────────────────

    /// <summary>
    /// Redeems the link: sets the new password and signs the caller straight
    /// in, the same courtesy InvitationsController.Accept extends — they just
    /// proved who they are by holding a link only their inbox received.
    /// </summary>
    public async Task<ProvisioningResult<LoginResponse>> ResetAsync(
        string rawToken, ResetPasswordRequest request, TokenService tokens, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.NewPassword) || request.NewPassword.Length < 8)
            return ProvisioningResult<LoginResponse>.Fail(
                ProvisioningError.Invalid, "Choose a password of at least 8 characters.");

        var (reset, identity) = await FindOpenAsync(rawToken, ct);
        if (reset is null || identity is null)
        {
            await db.SaveChangesAsync(ct);
            return ProvisioningResult<LoginResponse>.Fail(
                ProvisioningError.NotFound, "This link isn't valid. Request a new one.");
        }

        try { reset.Use(); }
        catch (InvalidOperationException ex)
        {
            return ProvisioningResult<LoginResponse>.Fail(ProvisioningError.Conflict, ex.Message);
        }

        identity.SetPassword(BCrypt.Net.BCrypt.HashPassword(request.NewPassword));
        // Whoever redeemed this reset is about to get a fresh token below —
        // any other session (possibly the reason this reset happened at all)
        // should not keep working past this point.
        identity.InvalidateSessions();
        await db.SaveChangesAsync(ct);

        return ProvisioningResult<LoginResponse>.Success(tokens.Issue(identity));
    }

    // ── Shared ───────────────────────────────────────────────────────────────

    /// <summary>
    /// Resolves a reset link, treating an expired one as no match at all — a
    /// refusal that still confirmed the link once existed would leak more
    /// than the expiry is there to hide (same reasoning as
    /// SignupRequestService.FindByTokenAsync).
    /// </summary>
    private async Task<(PasswordReset? Reset, Identity? Identity)> FindOpenAsync(
        string rawToken, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(rawToken)) return (null, null);

        var hash = SecureToken.Hash(rawToken);
        var reset = await db.PasswordResets.FirstOrDefaultAsync(r => r.TokenHash == hash, ct);
        if (reset is null) return (null, null);

        if (!reset.IsOpen())
        {
            if (reset.Status == PasswordResetStatus.Issued) reset.Expire();
            return (null, null);
        }

        var identity = await db.Identities.FirstOrDefaultAsync(i => i.Id == reset.IdentityId, ct);

        // The Identity was suspended/archived after the link was issued —
        // treat the link as unusable rather than let it reactivate anything.
        if (identity is null || identity.Status != IdentityStatus.Active)
            return (null, null);

        return (reset, identity);
    }
}
