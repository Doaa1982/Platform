using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;
using System.Net;
using System.Text.RegularExpressions;

namespace Platform.Api.Services;

/// <summary>
/// Where an invitation link is sent, and what happened.
///
/// Treated as a platform-level notification rather than a Communication Context
/// message (Platform Administrator Business Analysis, BA-005): an invitation is
/// sent before a Workspace has any community, so it does not fit that context's
/// Workspace-scoped scope.
/// </summary>
public record DeliveryOutcome(bool Delivered, string Channel, string? Detail = null)
{
    public static DeliveryOutcome Sent(string channel) => new(true, channel);
    public static DeliveryOutcome Failed(string channel, string detail) => new(false, channel, detail);
}

public interface IInvitationDelivery
{
    Task<DeliveryOutcome> SendInvitationAsync(
        string toEmail, string workspaceName, string role, string link, DateTime expiresAt, CancellationToken ct = default);

    /// <summary>
    /// Sends a Join Request's status link. Deliberately separate from
    /// SendInvitationAsync rather than reusing it: an Invitation and a Join
    /// Request are opposite things in this platform's own vocabulary (Join
    /// Request Business Analysis §1 — "Invitation says: we want you. Join
    /// Request says: I want in.") — an email telling someone "you've been
    /// invited" for a request *they* submitted would say the wrong thing.
    /// </summary>
    Task<DeliveryOutcome> SendJoinRequestReceiptAsync(
        string toEmail, string workspaceName, string link, DateTime expiresAt, CancellationToken ct = default);
}

public class EmailOptions
{
    public const string Section = "Email";

    /// <summary>When false, links are logged instead of emailed.</summary>
    public bool Enabled { get; set; }
    public string Host { get; set; } = "localhost";
    public int Port { get; set; } = 1025;
    public string FromAddress { get; set; } = "no-reply@platform.local";
    public string FromName { get; set; } = "Platform";
    public bool UseStartTls { get; set; }
    public string? Username { get; set; }
    public string? Password { get; set; }

    /// <summary>Base URL the invitation link is resolved against, e.g. https://app.example.com.</summary>
    public string PublicBaseUrl { get; set; } = "http://localhost:3000";
}

/// <summary>
/// Sends the invitation by SMTP.
///
/// Delivery failure is reported, never thrown: the Invitation is already issued
/// and valid at this point, and losing it because a mail server was briefly
/// unreachable would be worse than telling the admin to send the link by hand.
/// The admin console still shows the link for exactly that case.
/// </summary>
public class SmtpInvitationDelivery(EmailOptions options, ILogger<SmtpInvitationDelivery> logger)
    : IInvitationDelivery
{
    public async Task<DeliveryOutcome> SendInvitationAsync(
        string toEmail, string workspaceName, string role, string link, DateTime expiresAt, CancellationToken ct = default)
    {
        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(options.FromName, options.FromAddress));
        message.To.Add(MailboxAddress.Parse(toEmail));
        message.Subject = $"You've been invited to {workspaceName}";

        var expires = expiresAt.ToString("d MMMM yyyy");
        message.Body = new BodyBuilder
        {
            TextBody =
                $"""
                You've been invited to join {workspaceName} as {Humanise(role)}.

                Accept your invitation:
                {link}

                This link is valid until {expires}. It can only be used once.

                If you weren't expecting this, you can ignore this email.
                """,
            HtmlBody =
                $"""
                <div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;color:#1B2430">
                  <h2 style="margin:0 0 12px;font-size:20px">You've been invited to {WebUtility.HtmlEncode(workspaceName)}</h2>
                  <p style="margin:0 0 20px;color:#6A7383;line-height:1.6">
                    You've been invited to join as <strong>{WebUtility.HtmlEncode(Humanise(role))}</strong>.
                  </p>
                  <p style="margin:0 0 24px">
                    <a href="{WebUtility.HtmlEncode(link)}"
                       style="display:inline-block;background:#2D5BD1;color:#fff;text-decoration:none;
                              padding:11px 20px;border-radius:8px;font-weight:600">Accept invitation</a>
                  </p>
                  <p style="margin:0;color:#6A7383;font-size:13px;line-height:1.6">
                    Valid until {expires}. This link can only be used once.<br>
                    If you weren't expecting this, you can ignore this email.
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

            logger.LogInformation("Invitation email sent to {Email} for {Workspace}.", toEmail, workspaceName);
            return DeliveryOutcome.Sent("email");
        }
        catch (Exception ex)
        {
            // Never rethrow: the Invitation exists and is valid regardless
            logger.LogError(ex, "Could not email the invitation for {Workspace} to {Email}.", workspaceName, toEmail);
            return DeliveryOutcome.Failed("email", ex.Message);
        }
    }

    /// <summary>AssistantTeacher → "Assistant Teacher"</summary>
    private static string Humanise(string role) => Regex.Replace(role, "([a-z])([A-Z])", "$1 $2");

    public async Task<DeliveryOutcome> SendJoinRequestReceiptAsync(
        string toEmail, string workspaceName, string link, DateTime expiresAt, CancellationToken ct = default)
    {
        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(options.FromName, options.FromAddress));
        message.To.Add(MailboxAddress.Parse(toEmail));
        message.Subject = $"Your request to join {workspaceName}";

        var expires = expiresAt.ToString("d MMMM yyyy");
        message.Body = new BodyBuilder
        {
            TextBody =
                $"""
                Your request to join {workspaceName} has been received and is waiting for
                a decision.

                Check its status any time:
                {link}

                This link is valid until {expires}.

                If you didn't ask to join {workspaceName}, you can ignore this email.
                """,
            HtmlBody =
                $"""
                <div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;color:#1B2430">
                  <h2 style="margin:0 0 12px;font-size:20px">Your request to join {WebUtility.HtmlEncode(workspaceName)}</h2>
                  <p style="margin:0 0 20px;color:#6A7383;line-height:1.6">
                    It's been received and is waiting for a decision.
                  </p>
                  <p style="margin:0 0 24px">
                    <a href="{WebUtility.HtmlEncode(link)}"
                       style="display:inline-block;background:#2D5BD1;color:#fff;text-decoration:none;
                              padding:11px 20px;border-radius:8px;font-weight:600">Check status</a>
                  </p>
                  <p style="margin:0;color:#6A7383;font-size:13px;line-height:1.6">
                    Valid until {expires}.<br>
                    If you didn't ask to join {WebUtility.HtmlEncode(workspaceName)}, you can ignore this email.
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

            if (!string.IsNullOrWhiteSpace(options.Username))
                await client.AuthenticateAsync(options.Username, options.Password ?? string.Empty, ct);

            await client.SendAsync(message, ct);
            await client.DisconnectAsync(true, ct);

            logger.LogInformation("Join Request status link emailed to {Email} for {Workspace}.", toEmail, workspaceName);
            return DeliveryOutcome.Sent("email");
        }
        catch (Exception ex)
        {
            // Never rethrow: the Join Request exists and is valid regardless —
            // the caller also returns the link directly, so this is not the
            // only way the requester can reach it.
            logger.LogError(ex, "Could not email the Join Request status link for {Workspace} to {Email}.", workspaceName, toEmail);
            return DeliveryOutcome.Failed("email", ex.Message);
        }
    }
}

/// <summary>
/// Used when email is switched off. Logs the link so a developer can still
/// complete the flow, and reports honestly that nothing was delivered — the
/// console then tells the admin to send it by hand rather than implying an
/// email is on its way.
/// </summary>
public class LoggingInvitationDelivery(ILogger<LoggingInvitationDelivery> logger) : IInvitationDelivery
{
    public Task<DeliveryOutcome> SendInvitationAsync(
        string toEmail, string workspaceName, string role, string link, DateTime expiresAt, CancellationToken ct = default)
    {
        logger.LogInformation(
            "Email delivery is disabled. Invitation for {Email} to {Workspace}: {Link}",
            toEmail, workspaceName, link);

        return Task.FromResult(DeliveryOutcome.Failed("none", "Email delivery is not configured."));
    }

    public Task<DeliveryOutcome> SendJoinRequestReceiptAsync(
        string toEmail, string workspaceName, string link, DateTime expiresAt, CancellationToken ct = default)
    {
        logger.LogInformation(
            "Email delivery is disabled. Join Request status link for {Email} to {Workspace}: {Link}",
            toEmail, workspaceName, link);

        return Task.FromResult(DeliveryOutcome.Failed("none", "Email delivery is not configured."));
    }
}
