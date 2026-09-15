namespace IntegratedProcurement.Modules.VendorOnboarding.Application.Review;

/// <summary>
/// Server-side query for the internal Vendor Database and Approval Queue.
/// Statuses is null/empty for all statuses, or a permission-derived allow-list for an approval queue.
/// </summary>
public sealed record VendorRegistryQuery(
    string? Search,
    IReadOnlyCollection<string>? Statuses,
    int Page = 1,
    int PageSize = 50,
    IReadOnlyCollection<string>? EligibleRoleCodes = null,
    bool OverdueOnly = false,
    string? SortBy = null,
    string? SortDir = null);

/// <summary>One row per vendor; child collections stay aggregated so the grid never multiplies rows.</summary>
public sealed record VendorRegistryRowDto(
    string Id,
    string Name,
    string Status,
    string? PicName,
    string? Position,
    string? Email,
    string? OfficePhone,
    string? MobilePhone,
    string? WebAddress,
    string? OfficeAddress,
    string? WarehouseAddress,
    string? WorkshopAddress,
    string? NpwpNo,
    string? NibNo,
    string? AktaPendirianNo,
    string? AktaPerubahanNo,
    string? AktaPenyesuaianNo,
    string? SppkpNo,
    IReadOnlyList<string> CommodityCodes,
    IReadOnlyList<string> KbliCodes,
    IReadOnlyList<string> PortfolioClients,
    IReadOnlyList<string> PortfolioScopes,
    IReadOnlyList<string> CertificateNumbers,
    IReadOnlyList<string> CertificateDescriptions,
    string? LastChangedBy,
    string? LastChangedByName,
    string? LastReason,
    DateTimeOffset? LastChangedAt,
    DateTimeOffset? UpdatedAt,
    int? CurrentStationNumber,
    int TotalStations,
    string? CurrentStatusName,
    string? CurrentApproverRoleCode,
    int? CurrentStepSlaDays,
    DateTimeOffset? CurrentStepEnteredAt,
    DateOnly? CurrentStepDueDate,
    int CurrentStepDaysRemaining,
    int CurrentStepDaysOverdue,
    string CurrentStepSlaStatus);

public sealed record VendorRegistryPageDto(
    IReadOnlyList<VendorRegistryRowDto> Items,
    int Total,
    int Page,
    int PageSize);

/// <summary>Module-owned read port for the wide Vendor Database and permission-filtered approval queue.</summary>
public interface IVendorRegistryReadPort
{
    Task<VendorRegistryPageDto> ReadAsync(VendorRegistryQuery query, CancellationToken cancellationToken);

    /// <summary>
    /// How many vendors are waiting on one of <paramref name="approverRoleCodes"/> — for the menu badge.
    /// A plain COUNT: reading a page would also fetch contacts, commodities, KBLI and portfolios.
    /// </summary>
    Task<int> CountAwaitingApprovalAsync(
        IReadOnlyCollection<string> approverRoleCodes,
        CancellationToken cancellationToken);
}
