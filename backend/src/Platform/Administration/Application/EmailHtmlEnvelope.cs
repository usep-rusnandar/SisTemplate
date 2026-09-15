using System.Net;
using System.Text;

namespace SisTemplate.Platform.Administration.Application;

/// <summary>
/// Branded HTML wrapper that matches the Email Templates preview (header, subject, body,
/// optional CTA button, footer). Table layout + inline CSS so Gmail/Outlook render it.
/// No external assets — a remote logo would be blocked or 404 in most clients.
/// </summary>
public static class EmailHtmlEnvelope
{
    public const string Marker = "ag-email-envelope";

    private static readonly string[] ActionTokenKeys =
    [
        "resetUrl",
        "loginUrl",
        "registerUrl",
        "approvalUrl",
        "changeUrl",
        "portalUrl",
    ];

    public static bool IsWrapped(string? html) =>
        !string.IsNullOrEmpty(html)
        && html.Contains(Marker, StringComparison.Ordinal);

    public static bool LooksLikeHtml(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return false;
        }

        return value.Contains("<p", StringComparison.OrdinalIgnoreCase)
               || value.Contains("<table", StringComparison.OrdinalIgnoreCase)
               || value.Contains("<div", StringComparison.OrdinalIgnoreCase)
               || value.Contains("<br", StringComparison.OrdinalIgnoreCase)
               || value.Contains("<html", StringComparison.OrdinalIgnoreCase);
    }

    public static string? SafeHttpUrl(string? value)
    {
        var raw = (value ?? string.Empty).Trim();
        if (raw.Length == 0)
        {
            return null;
        }

        if (!Uri.TryCreate(raw, UriKind.Absolute, out var uri))
        {
            return null;
        }

        if (uri.Scheme != Uri.UriSchemeHttps && uri.Scheme != Uri.UriSchemeHttp)
        {
            return null;
        }

        return raw;
    }

    public static string? PickActionUrl(IReadOnlyDictionary<string, string?> tokens)
    {
        foreach (var key in ActionTokenKeys)
        {
            if (tokens.TryGetValue(key, out var value) && SafeHttpUrl(value) is { } url)
            {
                return url;
            }
        }

        foreach (var value in tokens.Values)
        {
            if (SafeHttpUrl(value) is { } url)
            {
                return url;
            }
        }

        return null;
    }

    public static string Wrap(
        string subject,
        string innerHtml,
        string category,
        string? ctaLabel,
        string? ctaHref)
    {
        if (IsWrapped(innerHtml))
        {
            return innerHtml;
        }

        var title = E(subject);
        var cat = E((category ?? string.Empty).Trim().ToUpperInvariant());
        var button = BuildCta(ctaLabel, ctaHref);

        return $"""
<!DOCTYPE html>
<html lang="en">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>{title}</title>
</head>
<body style="margin:0;padding:0;background-color:#eef2f4;">
<!-- {Marker} -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef2f4;margin:0;padding:24px 0;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background-color:#ffffff;border-radius:8px;overflow:hidden;">
      <tr><td style="background-color:#013B52;background:linear-gradient(135deg,#013B52 0%,#0F828A 100%);padding:22px 28px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-size:18px;font-weight:800;color:#ffffff;letter-spacing:-0.01em;">AlamTri <span style="color:#8FE3E8;">geo</span></td>
            <td align="right" style="font-size:10.5px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.7);">{cat}</td>
          </tr>
        </table>
      </td></tr>
      <tr><td style="padding:30px 32px 12px;">
        <div style="font-size:18px;font-weight:800;color:#013B52;letter-spacing:-0.01em;line-height:1.3;margin:0 0 20px;">{title}</div>
        <div style="font-size:13.5px;line-height:1.65;color:#3C4A52;">
{innerHtml}
        </div>
{button}
      </td></tr>
      <tr><td style="border-top:1px solid rgba(1,59,82,0.10);padding:16px 32px;background-color:#FBFCFC;font-size:11px;color:#8A969D;line-height:1.5;">
        Alamtri Geo · Internal operations platform<br/>
        You're receiving this email as a registered user of the platform. This is an automated message — please do not reply.
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>
""";
    }

    private static string BuildCta(string? label, string? href)
    {
        if (string.IsNullOrWhiteSpace(label))
        {
            return string.Empty;
        }

        var text = E(label);
        var url = SafeHttpUrl(href);
        var inner = url is null
            ? $"<span style=\"display:inline-block;padding:11px 22px;font-size:13.5px;font-weight:600;color:#ffffff;\">{text}</span>"
            : $"<a href=\"{E(url)}\" style=\"display:inline-block;padding:11px 22px;font-size:13.5px;font-weight:600;color:#ffffff;text-decoration:none;\">{text}</a>";

        var sb = new StringBuilder();
        sb.Append("        <table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:22px 0 8px;\">");
        sb.Append("<tr><td bgcolor=\"#013B52\" style=\"background-color:#013B52;border-radius:8px;\">");
        sb.Append(inner);
        sb.Append("</td></tr></table>");
        return sb.ToString();
    }

    private static string E(string? value) => WebUtility.HtmlEncode(value ?? string.Empty);
}
