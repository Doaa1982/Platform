using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;
using System.Net;

namespace Platform.Api.Services;

/// <summary>
/// Where a password reset link is sent, and what happened.
///
/// Its own interface rather than another method on IInvitationDelivery, for
/// the same reason SendJoinRequestReceiptAsync is separate from
/// SendInvitationAsync: an Invitation and a Password Reset say different
/// things to different audiences. An invitation goes to someone who does not
/// yet belong; a reset link goes to someone who already holds an Identity and
/// has simply forgotten how to prove it. Reusing the invitation copy here
/// would tell a Tutor or Student they'd been "invited" to an account they
/// already own.
/// </summary>
public record PasswordResetDeliveryOutcome(bool Delivered, string Channel, string? Detail = null)
{
    public static PasswordResetDeliveryOutcome Sent(string channel) => new(true, channel);
    public static PasswordResetDeliveryOutcome Failed(string channel, string detail) => new(false, channel, detail);
}

public interface IPasswordResetDelivery
{
    Task<PasswordResetDeliveryOutcome> SendPasswordResetAsync(
        string toEmail, string fullName, string link, DateTime expiresAt, CancellationToken ct = default);
}

/// <summary>
/// Sends the password reset link by SMTP. Shares EmailOptions with
/// SmtpInvitationDelivery — same mail server, same "Enabled" switch — but is
/// its own class so this message's copy can change independently of an
/// invitation's.
/// </summary>
public class SmtpPasswordResetDelivery(EmailOptions options, ILogger<SmtpPasswordResetDelivery> logger)
    : IPasswordResetDelivery
{
    public async Task<PasswordResetDeliveryOutcome> SendPasswordResetAsync(
        string toEmail, string fullName, string link, DateTime expiresAt, CancellationToken ct = default)
    {
        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(options.FromName, options.FromAddress));
        message.To.Add(MailboxAddress.Parse(toEmail));
        message.Subject = "Reset your password";

        var expires = expiresAt.ToString("d MMMM yyyy 'at' HH:mm 'UTC'");
        message.Body = new BodyBuilder
        {
            TextBody =
                $"""
                Hi {fullName},

                We received a request to reset the password on your account. If
                this was you, choose a new password here:

                {link}

                This link is valid until {expires}. It can only be used once.

                If you didn't ask for this, you can safely ignore this email —
                your password hasn't been changed.
                """,
            HtmlBody =
                $"""
                <div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;color:#1B2430">
                  <h2 style="margin:0 0 12px;font-size:20px">Reset your password</h2>
                  <p style="margin:0 0 20px;color:#6A7383;line-height:1.6">
                    Hi {WebUtility.HtmlEncode(fullName)}, we received a request to reset the
                    password on your account. If this was you, choose a new one below.
                  </p>
                  <p style="margin:0 0 24px">
                    <a href="{WebUtility.HtmlEncode(link)}"
                       style="display:inline-block;background:#2D5BD1;color:#fff;text-decoration:none;
                              padding:11px 20px;border-radius:8px;font-weight:600">Choose a new password</a>
                  </p>
                  <p style="margin:0;color:#6A7383;font-size:13px;line-height:1.6">
                    Valid until {expires}. This link can only be used once.<br>
                    If you didn't ask for this, you can safely ignore this email — your password hasn't been changed.
                  </p>
                </div>
                """
        }.ToMessageBody();

        try
        {
            using var client = new SmtpClient();

            await client.ConnectAsync(
                options.Host,
                options.Port,
                options.UseStartTls ? SecureSocketOptions.StartTls : SecureSocketOptions.None,
                ct);

            // Local dev relays accept mail unauthenticated; a real provider will not
            if (!string.IsNullOrWhiteSpace(options.Username))
                await client.AuthenticateAsync(options.Username, options.Password ?? string.Empty, ct);

            await client.SendAsync(message, ct);
            await client.DisconnectAsync(true, ct);

            logger.LogInformation("Password reset email sent to {Email}.", toEmail);
            return PasswordResetDeliveryOutcome.Sent("email");
        }
        catch (Exception ex)
        {
            // Never rethrow: the reset already exists and is valid regardless of
            // whether the mail actually left the building.
            logger.LogError(ex, "Could not email the password reset link to {Email}.", toEmail);
            return PasswordResetDeliveryOutcome.Failed("email", ex.Message);
        }
    }
}

/// <summary>
/// Used when email is switched off. Logs the link so a developer can still
/// complete the flow, and reports honestly that nothing was delivered.
/// </summary>
public class LoggingPasswordResetDelivery(ILogger<LoggingPasswordResetDelivery> logger) : IPasswordResetDelivery
{
    public Task<PasswordResetDeliveryOutcome> SendPasswordResetAsync(
        string toEmail, string fullName, string link, DateTime expiresAt, CancellationToken ct = default)
    {
        logger.LogInformation(
            "Email delivery is disabled. Password reset link for {Email}: {Link}", toEmail, link);

        return Task.FromResult(PasswordResetDeliveryOutcome.Failed("none", "Email delivery is not configured."));
    }
}
