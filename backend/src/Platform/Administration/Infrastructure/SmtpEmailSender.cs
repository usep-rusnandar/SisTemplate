using System.Globalization;
using System.Net;
using System.Net.Http;
using System.Net.Mail;
using System.Text;
using System.Text.Json;
using SisTemplate.Platform.Administration.Application;
using SisTemplate.Platform.Administration.Domain;
using SisTemplate.Platform.Persistence;
using Microsoft.Extensions.Logging;

namespace SisTemplate.Platform.Administration.Infrastructure;

public sealed class SmtpEmailSender : IEmailSender
{
    private static readonly Action<ILogger, string, Exception?> LogEmailFailed =
        LoggerMessage.Define<string>(
            LogLevel.Warning,
            new EventId(1, "EmailSendFailed"),
            "Email send to {Recipient} failed.");

    private readonly IAdminConsoleConfigurationService _configurationService;
    private readonly ProcurementDbContext _dbContext;
    private readonly ILogger<SmtpEmailSender> _logger;
    private readonly IHttpClientFactory _httpClientFactory;

    public SmtpEmailSender(
        IAdminConsoleConfigurationService configurationService,
        ProcurementDbContext dbContext,
        ILogger<SmtpEmailSender> logger,
        IHttpClientFactory httpClientFactory)
    {
        _configurationService = configurationService;
        _dbContext = dbContext;
        _logger = logger;
        _httpClientFactory = httpClientFactory;
    }

    public async Task<bool> SendAsync(string? toEmail, string subject, string body, string category, CancellationToken cancellationToken)
    {
        var settings = (await _configurationService.GetSettingsAsync(cancellationToken)).Values;

        // Per-module sender: each module has its own From + mailbox name (from_<slug> / mailbox_<slug>).
        // Falls back to a global from/mailbox default, so nothing breaks when a module's keys are unset.
        var slug = EmailTestRedirect.ModuleSlugForCategory(category);
        var from = FirstNonEmpty(
            slug is null ? null : Text(settings, $"from_{slug}"),
            Text(settings, "fromDefault"),
            Text(settings, "from"));
        var mailboxName = FirstNonEmpty(
            slug is null ? null : Text(settings, $"mailbox_{slug}"),
            Text(settings, "mailboxDefault"),
            Text(settings, "mailbox"));

        // Per-module "To (test)" only. An empty field must send to the real recipient — never inherit
        // the hidden legacy global toTest key (that is what kept password-reset mail on the old address).
        var effectiveTo = EmailTestRedirect.EffectiveTo(toEmail, settings, category);
        var detailSuffix = EmailTestRedirect.IsRedirected(settings, category)
            ? $"Redirected to test address (original: {toEmail})"
            : null;

        if (string.IsNullOrWhiteSpace(from) || string.IsNullOrWhiteSpace(effectiveTo))
        {
            await RecordAsync(category, effectiveTo, subject, "Skipped", "Sender or recipient missing", cancellationToken);
            return false;
        }

        // Delivery mode from Settings: "api" posts to the gateway at Base URL (works everywhere);
        // "smtp" talks to the relay directly (only reachable from the server network).
        var mode = Text(settings, "emailMode") ?? "api";
        var delivered = string.Equals(mode, "smtp", StringComparison.OrdinalIgnoreCase)
            ? await SendViaSmtpAsync(settings, from, mailboxName, effectiveTo, subject, body, cancellationToken)
            : await SendViaApiAsync(settings, from, effectiveTo, subject, body, cancellationToken);

        await RecordAsync(category, effectiveTo, subject, delivered ? "Delivered" : "Failed", detailSuffix, cancellationToken);
        return delivered;
    }

    private async Task<bool> SendViaApiAsync(
        IReadOnlyDictionary<string, JsonElement>? settings,
        string from, string toEmail, string subject, string body, CancellationToken cancellationToken)
    {
        var baseUrl = Text(settings, "baseUrl");
        if (string.IsNullOrWhiteSpace(baseUrl))
        {
            LogEmailFailed(_logger, toEmail, new InvalidOperationException("Base URL is not configured."));
            return false;
        }

        try
        {
            // Payload shape matches the legacy VendorConnect email gateway contract.
            var payload = JsonSerializer.Serialize(new
            {
                from,
                to = toEmail,
                cc = Text(settings, "cc") ?? string.Empty,
                bcc = Text(settings, "bcc") ?? string.Empty,
                subject,
                bodyMessage = body,
                emailPort = (Int(settings, "port") ?? 25).ToString(CultureInfo.InvariantCulture),
                emailHost = Text(settings, "smtp") ?? string.Empty,
                judul = subject,
                attachmentFileName = string.Empty,
                attachmentBase64 = string.Empty,
            });

            var client = _httpClientFactory.CreateClient("email-gateway");
            client.Timeout = TimeSpan.FromSeconds(30);
            using var content = new StringContent(payload, Encoding.UTF8, "application/json");
            using var response = await client.PostAsync(new Uri($"{baseUrl.TrimEnd('/')}/api/Email"), content, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                LogEmailFailed(_logger, toEmail, new InvalidOperationException($"Email gateway returned {(int)response.StatusCode}."));
            }

            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            LogEmailFailed(_logger, toEmail, ex);
            return false;
        }
    }

    private async Task<bool> SendViaSmtpAsync(
        IReadOnlyDictionary<string, JsonElement>? settings,
        string from, string? mailboxName, string toEmail, string subject, string body, CancellationToken cancellationToken)
    {
        var host = Text(settings, "smtp");
        if (string.IsNullOrWhiteSpace(host))
        {
            LogEmailFailed(_logger, toEmail, new InvalidOperationException("SMTP server is not configured."));
            return false;
        }

        var port = Int(settings, "port") ?? 25;
        var useSsl = !string.Equals(Text(settings, "encryption"), "none", StringComparison.OrdinalIgnoreCase)
            && !string.IsNullOrWhiteSpace(Text(settings, "encryption"));
        var smtpAuth = Bool(settings, "smtpAuth");
        var login = Text(settings, "login");
        var password = Text(settings, "pwd");
        var cc = Text(settings, "cc");
        var bcc = Text(settings, "bcc");

        try
        {
            using var message = new MailMessage();
            message.From = string.IsNullOrWhiteSpace(mailboxName) ? new MailAddress(from) : new MailAddress(from, mailboxName);
            message.To.Add(toEmail);
            if (!string.IsNullOrWhiteSpace(cc)) message.CC.Add(cc);
            if (!string.IsNullOrWhiteSpace(bcc)) message.Bcc.Add(bcc);
            message.Subject = subject;
            message.Body = body;
            message.IsBodyHtml = true;

#pragma warning disable SYSLIB0014 // SmtpClient is adequate for the internal relay (port 25)
            using var client = new SmtpClient(host, port)
            {
                EnableSsl = useSsl,
                Timeout = 10000,
                DeliveryMethod = SmtpDeliveryMethod.Network,
                Credentials = smtpAuth && !string.IsNullOrWhiteSpace(login)
                    ? new NetworkCredential(login, password)
                    : CredentialCache.DefaultNetworkCredentials,
            };
            await client.SendMailAsync(message, cancellationToken);
#pragma warning restore SYSLIB0014

            return true;
        }
        catch (Exception ex)
        {
            LogEmailFailed(_logger, toEmail, ex);
            return false;
        }
    }

    private async Task RecordAsync(string category, string? toEmail, string subject, string status, string? detail, CancellationToken cancellationToken)
    {
        var sentAt = DateTimeOffset.UtcNow;
        var messageId = $"MSG-{sentAt:yyyyMMddHHmmss}-{Guid.NewGuid():N}"[..28];
        // Rich enough for the Email Sent log to render straight from the backend (id, category,
        // recipient, subject, status) — the client no longer keeps a browser-side outbox.
        var payloadJson = JsonSerializer.Serialize(new
        {
            id = messageId,
            category,
            recipient = toEmail,
            email = toEmail,
            to = toEmail,
            subject,
            status,
            detail,
            sentAt = sentAt.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture),
        });

        _dbContext.EmailSentEntries.Add(new EmailSentEntry(Guid.NewGuid(), messageId, category, status, sentAt, payloadJson));
        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    private static string? FirstNonEmpty(params string?[] values) =>
        values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value));

    private static string? Text(IReadOnlyDictionary<string, JsonElement>? values, string key) =>
        values is not null && values.TryGetValue(key, out var element) && element.ValueKind == JsonValueKind.String
            ? element.GetString()
            : null;

    private static bool Bool(IReadOnlyDictionary<string, JsonElement>? values, string key)
    {
        if (values is null || !values.TryGetValue(key, out var element))
        {
            return false;
        }

        return element.ValueKind switch
        {
            JsonValueKind.True => true,
            JsonValueKind.String => bool.TryParse(element.GetString(), out var parsed) && parsed,
            _ => false,
        };
    }

    private static int? Int(IReadOnlyDictionary<string, JsonElement>? values, string key)
    {
        if (values is null || !values.TryGetValue(key, out var element))
        {
            return null;
        }

        return element.ValueKind switch
        {
            JsonValueKind.Number when element.TryGetInt32(out var number) => number,
            JsonValueKind.String when int.TryParse(element.GetString(), out var parsed) => parsed,
            _ => null,
        };
    }
}
