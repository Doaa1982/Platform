using System.Net;
using System.Text;
using Platform.Domain;

namespace Platform.Api.Email;

/// <summary>
/// The one shared, branded layout every email is rendered through — an HTML version and a
/// plain-text version of the same content.
///
/// HTML is built for email clients, not browsers: nested tables and inline styles (Outlook
/// desktop ignores most CSS layout), a fixed 600px max width that shrinks to the screen on mobile,
/// a hidden preheader for the inbox preview line, and a bulletproof table-cell button. Dark mode is
/// a progressive enhancement via prefers-color-scheme / Outlook.com's data-ogsc hook; the inline
/// light colors are chosen to stay readable where a client inverts them itself (Gmail apps).
///
/// Every value from <see cref="EmailContent"/> is HTML-escaped here, and only here — so a name or
/// workspace name typed by a user can never inject markup, regardless of which template it came
/// through. Links must be absolute http(s) URLs (mailto: also allowed for the help link).
/// </summary>
public static class EmailLayout
{
    private const string Accent = "#7A2E2E";
    private const string Ink = "#241A10";
    private const string Muted = "#6E5C43";
    private const string Page = "#F3ECD8";
    private const string Card = "#FFFFFF";
    private const string CardBorder = "#E5D9BC";

    /// <summary>Responsive padding and dark-mode overrides — enhancement only; every color is also set inline.</summary>
    private const string Style = """
<style>
  body { margin:0; padding:0; -webkit-text-size-adjust:100%; }
  @media (max-width:620px) {
    .tt-outer { padding:12px 8px !important; }
    .tt-card { padding:24px 20px !important; }
  }
  @media (prefers-color-scheme:dark) {
    .tt-bg { background:#14100C !important; }
    .tt-card { background:#221A12 !important; border-color:#3A2E22 !important; }
    .tt-text, .tt-wordmark { color:#F3ECD8 !important; }
    .tt-muted { color:#CDBD9C !important; }
    .tt-link { color:#F0B4B4 !important; }
  }
  [data-ogsc] .tt-text, [data-ogsc] .tt-wordmark { color:#F3ECD8 !important; }
  [data-ogsc] .tt-muted { color:#CDBD9C !important; }
  [data-ogsc] .tt-link { color:#F0B4B4 !important; }
</style>
""";

    public static RenderedEmail Render(EmailContent content, EmailBrandingOptions branding, int year)
    {
        if (content.ButtonUrl is not null) RequireSafeUrl(content.ButtonUrl, allowMailto: false);
        if (content.UnsubscribeUrl is not null) RequireSafeUrl(content.UnsubscribeUrl, allowMailto: false);
        var websiteUrl = RequireSafeUrl(branding.WebsiteUrl, allowMailto: false);
        var helpUrl = RequireSafeUrl(string.IsNullOrWhiteSpace(branding.HelpUrl) ? branding.WebsiteUrl : branding.HelpUrl, allowMailto: true);
        var logoUrl = string.IsNullOrWhiteSpace(branding.LogoUrl) ? null : RequireSafeUrl(branding.LogoUrl, allowMailto: false);

        var lang = content.Language;
        string T(string key, params (string, string)[] args) => EmailText.Get(lang, key, args);

        var signature = content.Sender switch
        {
            EmailSender.Workspace w => w.Name,
            _ => T("signature.team"),
        };
        var sentVia = content.Sender is EmailSender.Workspace ? T("footer.sentVia") : null;
        var copyright = T("footer.copyright", ("year", year.ToString()));
        var websiteLabel = new Uri(websiteUrl).Host;

        return new RenderedEmail(
            content.Subject,
            Html(content, signature, sentVia, copyright, websiteUrl, websiteLabel, helpUrl, logoUrl, T),
            Text(content, signature, sentVia, copyright, websiteUrl, helpUrl, T));
    }

    private static string Html(
        EmailContent c, string signature, string? sentVia, string copyright,
        string websiteUrl, string websiteLabel, string helpUrl, string? logoUrl,
        Func<string, (string, string)[], string> t)
    {
        var rtl = c.Language == SupportedLanguage.Arabic;
        var dir = rtl ? "rtl" : "ltr";
        var align = rtl ? "right" : "left";
        var font = rtl
            ? "'Segoe UI',Tahoma,Arial,sans-serif"
            : "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
        var brand = t("brand.name", []);

        var logo = logoUrl is not null
            ? $"""<img src="{A(logoUrl)}" alt="{A(brand)}" width="160" style="display:block;border:0;outline:none;height:auto;max-width:160px;font-family:{font};font-size:22px;font-weight:700;color:{Accent};">"""
            : $"""<span class="tt-wordmark" style="font-family:{font};font-size:22px;font-weight:700;color:{Accent};">{H(brand)}</span>""";

        var paragraphs = new StringBuilder();
        foreach (var p in c.Paragraphs)
            paragraphs.Append($"""<p class="tt-text" style="margin:0 0 16px;font-size:16px;line-height:24px;color:{Ink};">{H(p)}</p>""");

        var details = new StringBuilder();
        if (c.Details is { Count: > 0 })
        {
            details.Append($"""<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 16px;border-collapse:collapse;">""");
            foreach (var d in c.Details)
                details.Append($"""<tr><td class="tt-muted" valign="top" style="padding:6px 0;font-size:14px;line-height:21px;color:{Muted};width:42%;border-bottom:1px solid {CardBorder};">{H(d.Label)}</td><td class="tt-text" valign="top" dir="auto" style="padding:6px 0;font-size:15px;line-height:21px;font-weight:600;color:{Ink};border-bottom:1px solid {CardBorder};">{H(d.Value)}</td></tr>""");
            details.Append("</table>");
        }

        // The tutor's own words, shown as written (dir="auto" keeps an English comment readable in an Arabic email).
        var quote = c.Quote is null ? "" :
            (c.QuoteLabel is null ? "" : $"""<p class="tt-muted" style="margin:0 0 6px;font-size:14px;line-height:21px;color:{Muted};">{H(c.QuoteLabel)}</p>""")
            + $"""<p class="tt-text" dir="auto" style="margin:0 0 16px;padding:10px 14px;border-{(rtl ? "right" : "left")}:3px solid {CardBorder};font-size:15px;line-height:23px;color:{Ink};white-space:pre-line;">{H(c.Quote)}</p>""";

        var closing = new StringBuilder();
        foreach (var p in c.ClosingParagraphs ?? [])
            closing.Append($"""<p class="tt-text" style="margin:0 0 16px;font-size:16px;line-height:24px;color:{Ink};">{H(p)}</p>""");

        var button = c.ButtonUrl is null ? "" : $"""
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;">
<tr><td align="center" bgcolor="{Accent}" style="border-radius:8px;background:{Accent};">
<a href="{A(c.ButtonUrl)}" target="_blank" rel="noopener" style="display:inline-block;padding:14px 28px;font-family:{font};font-size:16px;font-weight:600;line-height:20px;color:#FFFFFF;text-decoration:none;border-radius:8px;">{H(c.ButtonLabel ?? "")}</a>
</td></tr>
</table>
<p class="tt-muted" style="margin:0 0 4px;font-size:14px;line-height:21px;color:{Muted};">{H(t("button.fallback", []))}</p>
<p style="margin:0 0 20px;font-size:14px;line-height:21px;word-break:break-all;"><a class="tt-link" href="{A(c.ButtonUrl)}" target="_blank" rel="noopener" dir="ltr" style="color:{Accent};text-decoration:underline;">{H(c.ButtonUrl)}</a></p>
""";

        var safety = c.SafetyNote is null ? "" :
            $"""<p class="tt-muted" style="margin:0;font-size:14px;line-height:21px;color:{Muted};">{H(c.SafetyNote)}</p>""";

        var unsubscribe = c.UnsubscribeUrl is null ? "" :
            $"""<p class="tt-muted" style="margin:0 0 4px;font-size:12px;line-height:18px;color:{Muted};">{H(t("footer.unsubscribe", []))} <a class="tt-link" href="{A(c.UnsubscribeUrl)}" target="_blank" rel="noopener" style="color:{Accent};text-decoration:underline;">{H(t("footer.unsubscribeLink", []))}</a></p>""";

        var expiry = c.ExpiryNote is null ? "" :
            $"""<p class="tt-muted" style="margin:0 0 8px;font-size:14px;line-height:21px;color:{Muted};">{H(c.ExpiryNote)}</p>""";

        var sentViaLine = sentVia is null ? "" :
            $"""<p class="tt-muted" style="margin:0 0 12px;font-size:12px;line-height:18px;color:{Muted};">{H(sentVia)}</p>""";

        // Invisible padding after the preheader keeps clients from pulling body text into the preview line.
        var preheaderPadding = string.Concat(Enumerable.Repeat("&#8199;&#847; ", 40));

        return $"""
<!DOCTYPE html>
<html lang="{c.Language}" dir="{dir}" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>{H(c.Subject)}</title>
{Style}
</head>
<body class="tt-bg" style="margin:0;padding:0;background:{Page};">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:{Page};">{H(c.Preheader)}{preheaderPadding}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="tt-bg" style="background:{Page};">
<tr><td align="center" class="tt-outer" style="padding:24px 12px;">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" dir="{dir}" style="max-width:600px;width:100%;">
<tr><td align="{align}" style="padding:4px 4px 16px;text-align:{align};">{logo}</td></tr>
<tr><td class="tt-card" align="{align}" dir="{dir}" style="background:{Card};border:1px solid {CardBorder};border-radius:12px;padding:32px;text-align:{align};font-family:{font};">
<p class="tt-text" style="margin:0 0 16px;font-size:16px;line-height:24px;color:{Ink};">{H(c.Greeting)}</p>
{paragraphs}
{details}
{quote}
{closing}
{button}
{expiry}
{safety}
</td></tr>
<tr><td align="{align}" dir="{dir}" style="padding:20px 8px 8px;text-align:{align};font-family:{font};">
<p class="tt-text" style="margin:0 0 4px;font-size:14px;line-height:21px;font-weight:600;color:{Ink};">{H(signature)}</p>
{sentViaLine}
{unsubscribe}
<p class="tt-muted" style="margin:0 0 4px;font-size:12px;line-height:18px;color:{Muted};">{H(t("footer.help", []))} <a class="tt-link" href="{A(helpUrl)}" target="_blank" rel="noopener" style="color:{Accent};text-decoration:underline;">{H(t("footer.helpLink", []))}</a></p>
<p class="tt-muted" style="margin:0;font-size:12px;line-height:18px;color:{Muted};">{H(copyright)} &middot; <a class="tt-link" href="{A(websiteUrl)}" target="_blank" rel="noopener" dir="ltr" style="color:{Accent};text-decoration:underline;">{H(websiteLabel)}</a></p>
</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>
""";
    }

    private static string Text(
        EmailContent c, string signature, string? sentVia, string copyright,
        string websiteUrl, string helpUrl, Func<string, (string, string)[], string> t)
    {
        var sb = new StringBuilder();
        sb.AppendLine(c.Greeting).AppendLine();
        foreach (var p in c.Paragraphs) sb.AppendLine(p).AppendLine();
        if (c.Details is { Count: > 0 })
        {
            foreach (var d in c.Details) sb.AppendLine($"{d.Label}: {d.Value}");
            sb.AppendLine();
        }
        if (c.Quote is not null)
        {
            if (c.QuoteLabel is not null) sb.AppendLine(c.QuoteLabel);
            sb.AppendLine($"\"{c.Quote}\"").AppendLine();
        }
        foreach (var p in c.ClosingParagraphs ?? []) sb.AppendLine(p).AppendLine();
        if (c.ButtonUrl is not null) sb.AppendLine(c.ButtonLabel + ":").AppendLine(c.ButtonUrl).AppendLine();
        if (c.ExpiryNote is not null) sb.AppendLine(c.ExpiryNote).AppendLine();
        if (c.SafetyNote is not null) sb.AppendLine(c.SafetyNote).AppendLine();
        sb.AppendLine("--").AppendLine(signature);
        if (sentVia is not null) sb.AppendLine(sentVia);
        if (c.UnsubscribeUrl is not null) sb.AppendLine($"{t("footer.unsubscribe", [])} {t("footer.unsubscribeLink", [])}: {c.UnsubscribeUrl}");
        sb.AppendLine($"{t("footer.help", [])} {helpUrl}");
        sb.AppendLine($"{copyright} · {websiteUrl}");
        return sb.ToString();
    }

    /// <summary>Text content.</summary>
    private static string H(string value) => WebUtility.HtmlEncode(value);

    /// <summary>Attribute value — HtmlEncode also escapes quotes, so it can't break out of href="…".</summary>
    private static string A(string value) => WebUtility.HtmlEncode(value);

    private static string RequireSafeUrl(string url, bool allowMailto)
    {
        if (Uri.TryCreate(url, UriKind.Absolute, out var uri)
            && (uri.Scheme == Uri.UriSchemeHttps || uri.Scheme == Uri.UriSchemeHttp || (allowMailto && uri.Scheme == Uri.UriSchemeMailto)))
            return url;
        throw new ArgumentException("Email links must be absolute http(s) URLs.", nameof(url));
    }
}
