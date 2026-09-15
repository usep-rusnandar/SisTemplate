using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace SisTemplate.Platform.Administration.Application;

public sealed record EmailTemplateContent(string Subject, string Body, string? Cta);

/// <summary>
/// Generic renderer for the admin-editable email templates on the Email Template page: resolves the
/// stored template by id (so copy edits take effect without a redeploy), falls back to caller
/// supplied defaults when the template is missing/blank, fills <c>{token}</c> placeholders, wraps
/// the body in the branded HTML envelope (header / subject / CTA / footer), and sends. Best-effort
/// — any failure returns false rather than throwing, so a notification never breaks the workflow
/// that triggered it.
/// </summary>
public static class EmailTemplateNotifier
{
    public static async Task<bool> TrySendAsync(
        string? templateId,
        string? toEmail,
        IReadOnlyDictionary<string, string?> tokens,
        IAdminConsoleCommunicationService communication,
        IEmailSender emailSender,
        string category,
        CancellationToken cancellationToken,
        Func<string, (string Subject, string Body)?>? defaults = null)
    {
        if (string.IsNullOrWhiteSpace(templateId) || string.IsNullOrWhiteSpace(toEmail))
        {
            return false;
        }

        try
        {
            var resolved = await ResolveTemplateAsync(templateId!, communication, cancellationToken)
                           ?? ToContent(defaults?.Invoke(templateId!));
            if (resolved is null)
            {
                return false;
            }

            var subject = Fill(resolved.Subject, tokens);
            var html = RenderHtml(resolved, tokens, category);
            return await emailSender.SendAsync(toEmail!, subject, html, category, cancellationToken);
        }
        catch
        {
            return false;
        }
    }

    public static async Task<EmailTemplateContent?> ResolveTemplateAsync(
        string templateId, IAdminConsoleCommunicationService communication, CancellationToken cancellationToken)
    {
        var snapshot = await communication.GetEmailTemplatesAsync(cancellationToken);
        if (snapshot.Items is not null)
        {
            foreach (var item in snapshot.Items)
            {
                if (item.ValueKind == JsonValueKind.Object
                    && item.TryGetProperty("id", out var id)
                    && string.Equals(id.GetString(), templateId, StringComparison.OrdinalIgnoreCase))
                {
                    var subject = item.TryGetProperty("subject", out var s) ? s.GetString() ?? string.Empty : string.Empty;
                    var body = item.TryGetProperty("body", out var b) ? b.GetString() ?? string.Empty : string.Empty;
                    string? cta = null;
                    if (item.TryGetProperty("cta", out var c) && c.ValueKind == JsonValueKind.String)
                    {
                        cta = c.GetString();
                    }

                    if (!string.IsNullOrWhiteSpace(subject) || !string.IsNullOrWhiteSpace(body))
                    {
                        return new EmailTemplateContent(subject, body, cta);
                    }
                }
            }
        }

        return null;
    }

    public static string Fill(string template, IReadOnlyDictionary<string, string?> tokens)
    {
        if (string.IsNullOrEmpty(template))
        {
            return template;
        }

        var result = template;
        foreach (var (key, value) in tokens)
        {
            result = result.Replace("{" + key + "}", value ?? string.Empty, StringComparison.OrdinalIgnoreCase);
        }

        return result;
    }

    public static string RenderHtml(
        EmailTemplateContent template,
        IReadOnlyDictionary<string, string?> tokens,
        string category)
    {
        var subject = Fill(template.Subject, tokens);
        var body = Fill(template.Body, tokens);
        var cta = string.IsNullOrWhiteSpace(template.Cta) ? null : Fill(template.Cta, tokens);
        var actionUrl = EmailHtmlEnvelope.PickActionUrl(tokens);

        if (string.IsNullOrWhiteSpace(cta)
            && actionUrl is not null
            && tokens.Keys.Any(key => string.Equals(key, "resetUrl", StringComparison.OrdinalIgnoreCase)))
        {
            cta = "Reset password";
        }

        if (EmailHtmlEnvelope.IsWrapped(body))
        {
            return body;
        }

        var inner = EmailHtmlEnvelope.LooksLikeHtml(body) && body.Contains('<')
            ? body
            : ToHtml(body);
        return EmailHtmlEnvelope.Wrap(subject, inner, category, cta, actionUrl);
    }

    public static string ToHtml(string body)
    {
        var encoded = System.Net.WebUtility.HtmlEncode(body ?? string.Empty);
        encoded = Regex.Replace(
            encoded,
            @"https?://[^\s<]+",
            match =>
            {
                var href = match.Value.TrimEnd(".,;:".ToCharArray());
                return $"<a href=\"{href}\" style=\"color:#0F828A;word-break:break-all;\">{href}</a>";
            },
            RegexOptions.IgnoreCase,
            TimeSpan.FromMilliseconds(100));
        var paragraphs = encoded.Replace("\r\n", "\n").Split("\n\n", StringSplitOptions.RemoveEmptyEntries);
        var sb = new StringBuilder();
        foreach (var p in paragraphs)
        {
            sb.Append("<p style=\"margin:0 0 14px;\">").Append(p.Replace("\n", "<br/>")).Append("</p>");
        }

        return sb.ToString();
    }

    private static EmailTemplateContent? ToContent((string Subject, string Body)? value) =>
        value is { } pair ? new EmailTemplateContent(pair.Subject, pair.Body, Cta: null) : null;
}
