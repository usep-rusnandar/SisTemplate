using System.Globalization;
using IntegratedProcurement.Modules.ContractMonitoring.Application;
using IntegratedProcurement.Modules.ContractMonitoring.Domain;
using IntegratedProcurement.Platform.Administration.Application;

namespace IntegratedProcurement.Modules.ContractMonitoring.Infrastructure;

public sealed class ContractReminderMailer : IContractReminderMailer
{
    private const string Category = "Contract Monitoring";

    private readonly IAdminConsoleCommunicationService _communication;
    private readonly IEmailSender _emailSender;

    public ContractReminderMailer(
        IAdminConsoleCommunicationService communication,
        IEmailSender emailSender)
    {
        _communication = communication;
        _emailSender = emailSender;
    }

    public Task<bool> SendExpiryReminderAsync(
        string? picEmail,
        string? picNames,
        string? contractNo,
        string? title,
        string? expiryDate,
        int daysToExpiry,
        CancellationToken cancellationToken)
    {
        var recipient = FirstEmail(picEmail) ?? FirstEmail(picNames);
        return EmailTemplateNotifier.TrySendAsync(
            TemplateIdForReminder(daysToExpiry),
            recipient,
            ReminderTokens(contractNo, title, expiryDate, daysToExpiry),
            _communication,
            _emailSender,
            Category,
            cancellationToken,
            Defaults);
    }

    private static string? FirstEmail(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        foreach (var token in value.Split(
                     [',', ';', '\n', '\r', ' '],
                     StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            if (token.Contains('@', StringComparison.Ordinal))
            {
                return token;
            }
        }

        return null;
    }

    private static string TemplateIdForReminder(int daysToExpiry) =>
        ReminderPolicy.TierForDays(daysToExpiry) switch
        {
            "d30" => "ET-16",
            "m2" => "ET-15",
            "m4" => "ET-14",
            "m6" => "ET-11",
            _ => daysToExpiry <= 0 ? "ET-16" : "ET-11",
        };

    private static Dictionary<string, string?> ReminderTokens(
        string? contractNo,
        string? title,
        string? expiryDate,
        int daysToExpiry) =>
        new(StringComparer.OrdinalIgnoreCase)
        {
            ["contractNo"] = contractNo,
            ["contractTitle"] = title,
            ["expiryDate"] = expiryDate,
            ["daysToExpiry"] = daysToExpiry.ToString(CultureInfo.InvariantCulture),
        };

    private static (string Subject, string Body)? Defaults(string templateId)
    {
        var window = templateId switch
        {
            "ET-16" => "≤ 1 bulan",
            "ET-15" => "≤ 2 bulan",
            "ET-14" => "≤ 4 bulan",
            _ => "≤ 6 bulan",
        };
        return (
            $"Pengingat Kontrak: {{contractNo}} berakhir dalam {window} ({{daysToExpiry}} hari)",
            "Dear Tim User,\n\nPerjanjian/Amendment {contractNo} - {contractTitle} akan berakhir pada {expiryDate} "
            + $"({window}, {{daysToExpiry}} hari lagi).\n\n"
            + "Apabila pengadaan Barang dan/atau Jasa terkait masih dibutuhkan, mohon menyampaikan proposal kepada Tim "
            + "Vendor Onboarding sesuai Service Level Agreement (SLA) Pengadaan yang berlaku. Apabila proposal sudah "
            + "diajukan sebelumnya atau sudah tidak diperlukan, email Contract Expiry Reminder ini dapat diabaikan.\n\n"
            + "Demikian disampaikan, atas perhatian dan kerja samanya kami ucapkan terima kasih.");
    }
}
