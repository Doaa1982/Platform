using Microsoft.EntityFrameworkCore;
using Platform.Api.Services;
using Platform.Domain;
using Platform.Infrastructure;

namespace Platform.Api.Email;

/// <summary>
/// The language of the current HTTP request's user, from Accept-Language — the frontend sets it to
/// the language chosen in the app on every call. Only meaningful for emails whose recipient is the
/// person making the request (applying, asking to join, forgetting a password); an invitation's
/// recipient is someone else, so it's never used there.
/// </summary>
public interface IRequestLanguage
{
    string? Current { get; }
}

public class HttpRequestLanguage(IHttpContextAccessor http) : IRequestLanguage
{
    public string? Current
    {
        get
        {
            var header = http.HttpContext?.Request.Headers.AcceptLanguage.ToString();
            if (string.IsNullOrWhiteSpace(header)) return null;
            var first = header.Split(',')[0].Split(';')[0].Split('-')[0];
            return SupportedLanguage.Normalize(first);
        }
    }
}

/// <summary>
/// Composes, renders and sends every email this platform sends. Each method resolves the
/// recipient's language — their own saved preference first, then (for emails they triggered
/// themselves) the language they're using right now, then the workspace's default — and falls
/// back to English.
/// </summary>
public class TransactionalEmails(
    PlatformDbContext db,
    IEmailDelivery delivery,
    EmailBrandingOptions branding,
    IRequestLanguage requestLanguage,
    TimeProvider clock)
{
    public async Task<DeliveryOutcome> SendWorkspaceInvitationAsync(
        string toEmail, Guid workspaceId, WorkspaceRoleName role, Guid inviterIdentityId,
        string link, DateTime expiresAt, CancellationToken ct = default)
    {
        var workspace = await db.Workspaces.AsNoTracking().SingleAsync(w => w.Id == workspaceId, ct);
        var inviter = await db.Identities.AsNoTracking().SingleAsync(i => i.Id == inviterIdentityId, ct);
        var recipient = await FindIdentityAsync(toEmail, ct);
        var language = Resolve(recipient?.PreferredLanguage, workspace.DefaultLanguage);

        var content = EmailTemplates.WorkspaceInvitation(
            language, recipient?.FullName, workspace.Name, role, inviter.FullName, inviter.Email, link, ValidFor(expiresAt));
        return await SendAsync(EmailTemplate.WorkspaceInvitation, toEmail, recipient?.FullName, content, ct);
    }

    public async Task<DeliveryOutcome> SendOwnerInvitationAsync(
        string toEmail, Guid workspaceId, WorkspaceRoleName role, string link, DateTime expiresAt, CancellationToken ct = default)
    {
        var workspace = await db.Workspaces.AsNoTracking().SingleAsync(w => w.Id == workspaceId, ct);
        var recipient = await FindIdentityAsync(toEmail, ct);
        var language = Resolve(recipient?.PreferredLanguage, workspace.DefaultLanguage);

        var content = EmailTemplates.OwnerInvitation(language, recipient?.FullName, workspace.Name, role, link, ValidFor(expiresAt));
        return await SendAsync(EmailTemplate.OwnerInvitation, toEmail, recipient?.FullName, content, ct);
    }

    public Task<DeliveryOutcome> SendPasswordResetAsync(
        Identity identity, string link, DateTime expiresAt, CancellationToken ct = default)
    {
        var language = Resolve(identity.PreferredLanguage, requestLanguage.Current);
        var content = EmailTemplates.PasswordReset(language, identity.FullName, link, ValidFor(expiresAt));
        return SendAsync(EmailTemplate.PasswordReset, identity.Email, identity.FullName, content, ct);
    }

    public async Task<DeliveryOutcome> SendJoinRequestReceiptAsync(
        string toEmail, string requesterName, Guid workspaceId, string link, DateTime expiresAt, CancellationToken ct = default)
    {
        var workspace = await db.Workspaces.AsNoTracking().SingleAsync(w => w.Id == workspaceId, ct);
        var recipient = await FindIdentityAsync(toEmail, ct);
        var language = Resolve(recipient?.PreferredLanguage, requestLanguage.Current, workspace.DefaultLanguage);

        var ownerEmail = workspace.OwnerMembershipId is { } ownerMembershipId
            ? await (from m in db.Memberships
                     join i in db.Identities on m.IdentityId equals i.Id
                     where m.Id == ownerMembershipId
                     select i.Email).SingleOrDefaultAsync(ct)
            : null;

        var content = EmailTemplates.JoinRequestReceipt(language, requesterName, workspace.Name, ownerEmail, link, ValidFor(expiresAt));
        return await SendAsync(EmailTemplate.JoinRequestReceipt, toEmail, requesterName, content, ct);
    }

    public async Task<DeliveryOutcome> SendSignupReceivedAsync(
        string toEmail, string applicantName, string link, DateTime expiresAt, CancellationToken ct = default)
    {
        var recipient = await FindIdentityAsync(toEmail, ct);
        var language = Resolve(recipient?.PreferredLanguage, requestLanguage.Current);
        var content = EmailTemplates.SignupReceived(language, applicantName, link, ValidFor(expiresAt));
        return await SendAsync(EmailTemplate.SignupReceived, toEmail, applicantName, content, ct);
    }

    /// <summary>The From display name, as the recipient's inbox shows it.</summary>
    public static string FromDisplayName(EmailContent content) => content.Sender switch
    {
        EmailSender.Workspace w => EmailText.Get(content.Language, "from.via", ("name", w.Name)),
        _ => EmailText.Get(content.Language, "brand.name"),
    };

    private async Task<DeliveryOutcome> SendAsync(
        EmailTemplate template, string toEmail, string? toName, EmailContent content, CancellationToken ct)
    {
        var rendered = EmailLayout.Render(content, branding, clock.GetUtcNow().Year);
        var replyTo = content.Sender is EmailSender.Workspace w ? w.ReplyToEmail : null;
        return await delivery.SendAsync(new OutgoingEmail(template, toEmail, toName, FromDisplayName(content), replyTo, rendered), ct);
    }

    private Task<Identity?> FindIdentityAsync(string email, CancellationToken ct)
    {
        var normalized = email.Trim().ToLowerInvariant();
        return db.Identities.AsNoTracking().FirstOrDefaultAsync(i => i.Email == normalized, ct);
    }

    private TimeSpan ValidFor(DateTime expiresAtUtc)
    {
        var left = expiresAtUtc - clock.GetUtcNow().UtcDateTime;
        return left > TimeSpan.Zero ? left : TimeSpan.Zero;
    }

    private static string Resolve(params string?[] candidates) =>
        candidates.Select(SupportedLanguage.Normalize).FirstOrDefault(l => l is not null) ?? SupportedLanguage.English;
}
