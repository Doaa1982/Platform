using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;
using Platform.Api.Services;

namespace Platform.Api.Email;

/// <summary>A fully rendered email, ready to hand to a transport.</summary>
public record OutgoingEmail(
    EmailTemplate Template,
    string ToAddress,
    string? ToName,
    string FromDisplayName,
    string? ReplyTo,
    RenderedEmail Content);

public interface IEmailDelivery
{
    /// <summary>Never throws for a delivery failure — reports it, since the link it carries is already valid regardless.</summary>
    Task<DeliveryOutcome> SendAsync(OutgoingEmail email, CancellationToken ct = default);
}

/// <summary>
/// Sends over SMTP (Mailpit locally, Resend in production). The From address is always
/// EmailOptions.FromAddress; only the display name varies by sender.
///
/// Logs which template went to whom — never the link, the token in it, or the body.
/// </summary>
public class SmtpEmailDelivery(EmailOptions options, ILogger<SmtpEmailDelivery> logger) : IEmailDelivery
{
    public async Task<DeliveryOutcome> SendAsync(OutgoingEmail email, CancellationToken ct = default)
    {
        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(StripControlChars(email.FromDisplayName), options.FromAddress));
        message.To.Add(new MailboxAddress(StripControlChars(email.ToName ?? string.Empty), email.ToAddress));
        if (email.ReplyTo is not null && MailboxAddress.TryParse(email.ReplyTo, out var replyTo))
            message.ReplyTo.Add(replyTo);
        message.Subject = StripControlChars(email.Content.Subject);
        message.Body = new BodyBuilder { TextBody = email.Content.Text, HtmlBody = email.Content.Html }.ToMessageBody();

        try
        {
            using var client = new SmtpClient();
            await client.ConnectAsync(options.Host, options.Port,
                options.UseStartTls ? SecureSocketOptions.StartTls : SecureSocketOptions.None, ct);

            // Local dev relays accept mail unauthenticated; a real provider will not
            if (!string.IsNullOrWhiteSpace(options.Username))
                await client.AuthenticateAsync(options.Username, options.Password ?? string.Empty, ct);

            await client.SendAsync(message, ct);
            await client.DisconnectAsync(true, ct);

            logger.LogInformation("{Template} email sent to {Email}.", email.Template, email.ToAddress);
            return DeliveryOutcome.Sent("email");
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex, "Could not send the {Template} email to {Email}.", email.Template, email.ToAddress);
            return DeliveryOutcome.Failed("email", ex.Message);
        }
    }

    /// <summary>Header values come partly from user input (workspace names) — no CR/LF or other control characters.</summary>
    private static string StripControlChars(string value) => new(value.Where(c => !char.IsControl(c)).ToArray());
}

/// <summary>
/// Used when Email:Enabled is false. Reports honestly that nothing was delivered, so callers that
/// can (the admin console, the invite screen) tell a person to share the link by hand.
///
/// Deliberately does not log the link: with email off in production this ran on every invitation
/// and password reset, writing live single-use tokens into the app's log stream.
/// </summary>
public class DisabledEmailDelivery(ILogger<DisabledEmailDelivery> logger) : IEmailDelivery
{
    public Task<DeliveryOutcome> SendAsync(OutgoingEmail email, CancellationToken ct = default)
    {
        logger.LogInformation("Email delivery is disabled; the {Template} email to {Email} was not sent.", email.Template, email.ToAddress);
        return Task.FromResult(DeliveryOutcome.Failed("none", "Email delivery is not configured."));
    }
}
