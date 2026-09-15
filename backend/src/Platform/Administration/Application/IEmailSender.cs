namespace SisTemplate.Platform.Administration.Application;

public interface IEmailSender
{
    /// <summary>
    /// Sends an email using the SMTP configuration from Super Admin → Settings and records the attempt
    /// (Delivered/Failed) in the Email Sent log. Never throws — returns false when delivery failed.
    /// </summary>
    Task<bool> SendAsync(string? toEmail, string subject, string body, string category, CancellationToken cancellationToken);
}
