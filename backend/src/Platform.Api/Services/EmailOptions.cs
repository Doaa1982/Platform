namespace Platform.Api.Services;

/// <summary>What happened when an email was handed off — reported to the caller, never thrown.</summary>
public record DeliveryOutcome(bool Delivered, string Channel, string? Detail = null)
{
    public static DeliveryOutcome Sent(string channel) => new(true, channel);
    public static DeliveryOutcome Failed(string channel, string detail) => new(false, channel, detail);
}

/// <summary>
/// SMTP transport settings — section "Email". The sender display names ("Teach Tandem",
/// "{Academy} via Teach Tandem") are product identity, set by the email layer, not configuration;
/// only the address is configured here.
/// </summary>
public class EmailOptions
{
    public const string Section = "Email";

    /// <summary>When false, nothing is sent and callers are told so (see DisabledEmailDelivery).</summary>
    public bool Enabled { get; set; }
    public string Host { get; set; } = "localhost";
    public int Port { get; set; } = 1025;
    public string FromAddress { get; set; } = "no-reply@teachtandem.com";
    public bool UseStartTls { get; set; }
    public string? Username { get; set; }
    public string? Password { get; set; }

    /// <summary>Base URL links in emails are resolved against, e.g. https://app.example.com.</summary>
    public string PublicBaseUrl { get; set; } = "http://localhost:3000";
}
