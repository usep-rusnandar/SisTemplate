namespace IntegratedProcurement.Modules.ContractMonitoring.Application;

public interface IContractReminderMailer
{
    Task<bool> SendExpiryReminderAsync(
        string? picEmail,
        string? picNames,
        string? contractNo,
        string? title,
        string? expiryDate,
        int daysToExpiry,
        CancellationToken cancellationToken);
}
