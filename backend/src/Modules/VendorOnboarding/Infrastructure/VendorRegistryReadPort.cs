using IntegratedProcurement.BuildingBlocks.Application;
using IntegratedProcurement.BuildingBlocks.Application.Abstractions;
using IntegratedProcurement.Modules.VendorOnboarding.Application.Review;
using IntegratedProcurement.Modules.VendorOnboarding.Domain;
using IntegratedProcurement.Platform.Persistence;
using Microsoft.EntityFrameworkCore;

namespace IntegratedProcurement.Modules.VendorOnboarding.Infrastructure;

internal sealed class VendorRegistryReadPort : IVendorRegistryReadPort
{
    private readonly ProcurementDbContext _dbContext;
    private readonly IWorkingDayCalendarProvider _calendars;
    private readonly VendorApprovalChainProvider _chains;
    private readonly IVendorActorNameReadPort _actorNames;

    public VendorRegistryReadPort(
        ProcurementDbContext dbContext,
        IWorkingDayCalendarProvider calendars,
        VendorApprovalChainProvider chains,
        IVendorActorNameReadPort actorNames)
    {
        _dbContext = dbContext;
        _calendars = calendars;
        _chains = chains;
        _actorNames = actorNames;
    }

    public async Task<int> CountAwaitingApprovalAsync(
        IReadOnlyCollection<string> approverRoleCodes,
        CancellationToken cancellationToken)
    {
        var roles = approverRoleCodes
            .Where(code => !string.IsNullOrWhiteSpace(code))
            .Select(code => code.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
        if (roles.Length == 0)
        {
            return 0;
        }

        var chain = await _chains.GetAsync(cancellationToken);
        var awaited = chain.StatusesAwaiting(roles);
        return awaited.Count == 0
            ? 0
            : await _dbContext.Vendors.AsNoTracking()
                .CountAsync(vendor => awaited.Contains(vendor.Status), cancellationToken);
    }

    public async Task<VendorRegistryPageDto> ReadAsync(VendorRegistryQuery request, CancellationToken cancellationToken)
    {
        var page = Math.Max(1, request.Page);
        var pageSize = Math.Clamp(request.PageSize, 10, 200);
        var query = _dbContext.Vendors.AsNoTracking().AsQueryable();

        var statuses = (request.Statuses ?? [])
            .Where(code => !string.IsNullOrWhiteSpace(code))
            .Select(code => code.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
        if (statuses.Length > 0)
        {
            query = query.Where(vendor => statuses.Contains(vendor.Status));
        }

        var chain = await _chains.GetAsync(cancellationToken);
        var eligibleRoleCodes = (request.EligibleRoleCodes ?? [])
            .Where(code => !string.IsNullOrWhiteSpace(code))
            .Select(code => code.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
        if (request.EligibleRoleCodes is not null)
        {
            // The approval queue is simply "vendors sitting on a status my roles approve" — the chain
            // maps roles to status codes, so this stays one indexable predicate.
            var awaited = chain.StatusesAwaiting(eligibleRoleCodes);
            query = awaited.Count == 0
                ? query.Where(_ => false)
                : query.Where(vendor => awaited.Contains(vendor.Status));
        }

        // "Overdue only" is working-day math, so it cannot be a SQL predicate. Resolve the ids of the
        // vendors whose current status has already passed its due date, then constrain the page query.
        if (request.OverdueOnly)
        {
            var overdueIds = await ReadOverdueVendorIdsAsync(chain, eligibleRoleCodes, cancellationToken);
            query = overdueIds.Count == 0
                ? query.Where(_ => false)
                : query.Where(vendor => overdueIds.Contains(vendor.Id));
        }

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var term = request.Search.Trim();
            var contactVendorIds =
                from link in _dbContext.VendorUsers.AsNoTracking()
                join identity in _dbContext.Users.AsNoTracking() on link.IdentityUserId equals identity.Id
                where identity.CompleteName.Contains(term) || (identity.Email != null && identity.Email.Contains(term))
                select link.VendorId;

            query = query.Where(vendor =>
                vendor.Id.Contains(term)
                || vendor.Name.Contains(term)
                || (vendor.NpwpNo != null && vendor.NpwpNo.Contains(term))
                || (vendor.NibNo != null && vendor.NibNo.Contains(term))
                || (vendor.WebAddress != null && vendor.WebAddress.Contains(term))
                || (vendor.OfficeAddress != null && vendor.OfficeAddress.Contains(term))
                || (vendor.WarehouseAddress != null && vendor.WarehouseAddress.Contains(term))
                || (vendor.WorkshopAddress != null && vendor.WorkshopAddress.Contains(term))
                || contactVendorIds.Contains(vendor.Id)
                || _dbContext.VendorSubClassifications.Any(item => item.VendorId == vendor.Id && item.SubClassificationCode.Contains(term))
                || _dbContext.VendorKblis.Any(item => item.VendorId == vendor.Id && item.KbliCode.Contains(term))
                || _dbContext.VendorPortfolios.Any(item => item.VendorId == vendor.Id && (item.Client.Contains(term) || item.ScopeOfWork.Contains(term)))
                || _dbContext.VendorCertificates.Any(item => item.VendorId == vendor.Id && (item.CertificateNumber.Contains(term) || item.Description.Contains(term))));
        }

        var total = await query.CountAsync(cancellationToken);
        var vendors = await VendorRegistryOrdering.Apply(query, _dbContext, request.SortBy, request.SortDir)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        if (vendors.Count == 0)
        {
            return new VendorRegistryPageDto([], total, page, pageSize);
        }

        var ids = vendors.Select(vendor => vendor.Id).ToArray();
        var contacts = await (
            from link in _dbContext.VendorUsers.AsNoTracking()
            join identity in _dbContext.Users.AsNoTracking() on link.IdentityUserId equals identity.Id
            where ids.Contains(link.VendorId)
            select new { link.VendorId, link.IsWorkspacePic, identity.CompleteName, identity.Email })
            .ToListAsync(cancellationToken);

        var commodities = await _dbContext.VendorSubClassifications.AsNoTracking()
            .Where(item => ids.Contains(item.VendorId))
            .Select(item => new { item.VendorId, item.SubClassificationCode })
            .ToListAsync(cancellationToken);
        var kblis = await _dbContext.VendorKblis.AsNoTracking()
            .Where(item => ids.Contains(item.VendorId))
            .Select(item => new { item.VendorId, item.KbliCode })
            .ToListAsync(cancellationToken);
        var portfolios = await _dbContext.VendorPortfolios.AsNoTracking()
            .Where(item => ids.Contains(item.VendorId))
            .Select(item => new { item.VendorId, item.Client, item.ScopeOfWork })
            .ToListAsync(cancellationToken);
        var certificates = await _dbContext.VendorCertificates.AsNoTracking()
            .Where(item => ids.Contains(item.VendorId))
            .Select(item => new { item.VendorId, item.CertificateNumber, item.Description })
            .ToListAsync(cancellationToken);
        var histories = await _dbContext.VendorStatusHistory.AsNoTracking()
            .Where(item => ids.Contains(item.VendorId))
            .OrderByDescending(item => item.CreatedAt)
            .Select(item => new { item.VendorId, item.StatusCode, item.CreatedBy, item.Reason, item.CreatedAt })
            .ToListAsync(cancellationToken);
        var calendar = await _calendars.GetCalendarAsync(cancellationToken);
        var stations = chain.ApprovalStations();
        var statusByVendor = vendors.ToDictionary(
            vendor => vendor.Id, vendor => vendor.Status, StringComparer.OrdinalIgnoreCase);
        // When each vendor entered its CURRENT status — the clock behind the SLA badge.
        var enteredAt = histories
            .Where(item => statusByVendor.TryGetValue(item.VendorId, out var status)
                && string.Equals(item.StatusCode, status, StringComparison.OrdinalIgnoreCase))
            .GroupBy(item => item.VendorId, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.Max(item => item.CreatedAt), StringComparer.OrdinalIgnoreCase);

        var contactByVendor = contacts
            .GroupBy(item => item.VendorId, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(
                group => group.Key,
                group => group.OrderByDescending(item => item.IsWorkspacePic).First(),
                StringComparer.OrdinalIgnoreCase);
        var historyByVendor = histories
            .GroupBy(item => item.VendorId, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.First(), StringComparer.OrdinalIgnoreCase);
        var actorNames = await _actorNames.ResolveAsync(
            historyByVendor.Values.Select(item => item.CreatedBy).ToArray(),
            cancellationToken);

        static IReadOnlyList<string> Values<T>(
            IEnumerable<T> source,
            Func<T, string> selector) =>
            source.Select(selector)
                .Where(value => !string.IsNullOrWhiteSpace(value))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy(value => value, StringComparer.OrdinalIgnoreCase)
                .ToArray();

        var rows = vendors.Select(vendor =>
        {
            contactByVendor.TryGetValue(vendor.Id, out var contact);
            historyByVendor.TryGetValue(vendor.Id, out var lastHistory);
            var station = chain.Find(vendor.Status);
            var awaiting = station?.ApproverRoleCode is not null;
            enteredAt.TryGetValue(vendor.Id, out var since);
            var sla = awaiting
                ? VendorStatusSla.Evaluate(calendar, station, since == default ? null : since)
                : ApprovalSlaSnapshot.None;
            return new VendorRegistryRowDto(
                vendor.Id,
                vendor.Name,
                vendor.Status,
                contact?.CompleteName,
                vendor.Position,
                contact?.Email,
                JoinPhone(vendor.OfficePhoneCountry, vendor.OfficePhoneArea, vendor.OfficePhoneNumber),
                JoinPhone(vendor.HandphoneCountry, null, vendor.HandphoneNumber),
                vendor.WebAddress,
                vendor.OfficeAddress,
                vendor.WarehouseAddress,
                vendor.WorkshopAddress,
                vendor.NpwpNo,
                vendor.NibNo,
                vendor.AktaPendirianNo,
                vendor.AktaPerubahanNo,
                vendor.AktaPenyesuaianNo,
                vendor.SppkpNo,
                Values(commodities.Where(item => item.VendorId == vendor.Id), item => item.SubClassificationCode),
                Values(kblis.Where(item => item.VendorId == vendor.Id), item => item.KbliCode),
                Values(portfolios.Where(item => item.VendorId == vendor.Id), item => item.Client),
                Values(portfolios.Where(item => item.VendorId == vendor.Id), item => item.ScopeOfWork),
                Values(certificates.Where(item => item.VendorId == vendor.Id), item => item.CertificateNumber),
                Values(certificates.Where(item => item.VendorId == vendor.Id), item => item.Description),
                lastHistory?.CreatedBy,
                lastHistory?.CreatedBy is not null
                    && actorNames.TryGetValue(lastHistory.CreatedBy, out var actorName)
                    ? actorName
                    : null,
                lastHistory?.Reason,
                lastHistory?.CreatedAt,
                vendor.UpdatedAt,
                awaiting ? stations.ToList().FindIndex(item => item.Code == station!.Code) + 1 : null,
                stations.Count,
                station?.Name,
                awaiting ? station!.ApproverRoleCode : null,
                awaiting ? station!.SlaDays : null,
                sla.StepEnteredAt,
                sla.DueDate,
                sla.DaysRemaining,
                sla.DaysOverdue,
                sla.Status);
        }).ToArray();

        return new VendorRegistryPageDto(rows, total, page, pageSize);
    }

    /// <summary>
    /// Vendors whose current status has already passed its working-day due date. Only statuses that are
    /// approval stations WITH an SLA can be overdue, so the candidate set is small.
    /// </summary>
    private async Task<HashSet<string>> ReadOverdueVendorIdsAsync(
        VendorApprovalChain chain,
        string[] eligibleRoleCodes,
        CancellationToken cancellationToken)
    {
        var tracked = chain.ApprovalStations()
            .Where(station => station.SlaDays is > 0)
            .Where(station => eligibleRoleCodes.Length == 0
                || eligibleRoleCodes.Contains(station.ApproverRoleCode!, StringComparer.OrdinalIgnoreCase))
            .ToDictionary(station => station.Code, StringComparer.OrdinalIgnoreCase);
        if (tracked.Count == 0)
        {
            return [];
        }

        var codes = tracked.Keys.ToArray();
        var waiting = await _dbContext.Vendors.AsNoTracking()
            .Where(vendor => codes.Contains(vendor.Status))
            .Select(vendor => new { vendor.Id, vendor.Status })
            .ToListAsync(cancellationToken);
        if (waiting.Count == 0)
        {
            return [];
        }

        var vendorIds = waiting.Select(item => item.Id).ToArray();
        var entered = await _dbContext.VendorStatusHistory.AsNoTracking()
            .Where(entry => vendorIds.Contains(entry.VendorId))
            .Select(entry => new { entry.VendorId, entry.StatusCode, entry.CreatedAt })
            .ToListAsync(cancellationToken);

        var calendar = await _calendars.GetCalendarAsync(cancellationToken);
        var overdue = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var vendor in waiting)
        {
            var since = entered
                .Where(entry => string.Equals(entry.VendorId, vendor.Id, StringComparison.OrdinalIgnoreCase)
                    && string.Equals(entry.StatusCode, vendor.Status, StringComparison.OrdinalIgnoreCase))
                .Select(entry => (DateTimeOffset?)entry.CreatedAt)
                .Max();
            var sla = VendorStatusSla.Evaluate(calendar, tracked[vendor.Status], since);
            if (sla.Status == ApprovalSlaStatuses.Overdue)
            {
                overdue.Add(vendor.Id);
            }
        }

        return overdue;
    }


    private static string? JoinPhone(string? country, string? area, string? number)
    {
        var values = new[] { country, area, number }.Where(value => !string.IsNullOrWhiteSpace(value)).ToArray();
        return values.Length == 0 ? null : string.Join(" ", values);
    }
}
