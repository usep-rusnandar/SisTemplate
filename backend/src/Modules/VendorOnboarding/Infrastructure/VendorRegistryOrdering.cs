using System.Linq.Expressions;
using IntegratedProcurement.Modules.VendorOnboarding.Application.Review;
using IntegratedProcurement.Modules.VendorOnboarding.Domain;
using IntegratedProcurement.Platform.Persistence;

namespace IntegratedProcurement.Modules.VendorOnboarding.Infrastructure;

/// <summary>
/// Server-side ORDER BY for the Vendor Database page. Collection columns sort by the first
/// alphabetical child value so paging stays consistent with the aggregated grid cells.
/// </summary>
internal static class VendorRegistryOrdering
{
    private const string VendorStatusSet = "vendor-status";
    private const string CommoditySet = "commodity-subclassification";
    private const string KbliSet = "kbli";

    public static IQueryable<Vendor> Apply(
        IQueryable<Vendor> query,
        ProcurementDbContext db,
        string? sortBy,
        string? sortDir)
    {
        if (!VendorRegistrySort.TryNormalize(sortBy, sortDir, out var key, out var descending))
        {
            return query
                .OrderByDescending(vendor => vendor.UpdatedAt ?? vendor.CreatedAt)
                .ThenBy(vendor => vendor.Name)
                .ThenBy(vendor => vendor.Id);
        }

        var ordered = key switch
        {
            VendorRegistrySort.Id => Order(query, vendor => vendor.Id, descending),
            VendorRegistrySort.Name => Order(query, vendor => vendor.Name, descending),
            VendorRegistrySort.Status => Order(query, vendor => vendor.Status, descending),
            VendorRegistrySort.StatusDescription => Order(
                query,
                vendor => db.MasterDataRecords
                    .Where(record => record.SetKey == VendorStatusSet && record.Code == vendor.Status)
                    .Select(record => record.Description != "" ? record.Description : record.Name)
                    .FirstOrDefault(),
                descending),
            VendorRegistrySort.PicName => Order(
                query,
                vendor => (from link in db.VendorUsers
                           join identity in db.Users on link.IdentityUserId equals identity.Id
                           where link.VendorId == vendor.Id && link.IsWorkspacePic
                           select identity.CompleteName).FirstOrDefault(),
                descending),
            VendorRegistrySort.Position => Order(query, vendor => vendor.Position, descending),
            VendorRegistrySort.Email => Order(
                query,
                vendor => (from link in db.VendorUsers
                           join identity in db.Users on link.IdentityUserId equals identity.Id
                           where link.VendorId == vendor.Id && link.IsWorkspacePic
                           select identity.Email).FirstOrDefault(),
                descending),
            VendorRegistrySort.OfficePhone => Order(
                query,
                vendor => (vendor.OfficePhoneCountry ?? "") + " " + (vendor.OfficePhoneArea ?? "") + " " + (vendor.OfficePhoneNumber ?? ""),
                descending),
            VendorRegistrySort.MobilePhone => Order(
                query,
                vendor => (vendor.HandphoneCountry ?? "") + " " + (vendor.HandphoneNumber ?? ""),
                descending),
            VendorRegistrySort.WebAddress => Order(query, vendor => vendor.WebAddress, descending),
            VendorRegistrySort.OfficeAddress => Order(query, vendor => vendor.OfficeAddress, descending),
            VendorRegistrySort.WarehouseAddress => Order(query, vendor => vendor.WarehouseAddress, descending),
            VendorRegistrySort.WorkshopAddress => Order(query, vendor => vendor.WorkshopAddress, descending),
            VendorRegistrySort.NpwpNo => Order(query, vendor => vendor.NpwpNo, descending),
            VendorRegistrySort.NibNo => Order(query, vendor => vendor.NibNo, descending),
            VendorRegistrySort.AktaPendirianNo => Order(query, vendor => vendor.AktaPendirianNo, descending),
            VendorRegistrySort.AktaPerubahanNo => Order(query, vendor => vendor.AktaPerubahanNo, descending),
            VendorRegistrySort.AktaPenyesuaianNo => Order(query, vendor => vendor.AktaPenyesuaianNo, descending),
            VendorRegistrySort.SppkpNo => Order(query, vendor => vendor.SppkpNo, descending),
            VendorRegistrySort.CommodityCodes => Order(
                query,
                vendor => db.VendorSubClassifications
                    .Where(item => item.VendorId == vendor.Id)
                    .Join(
                        db.MasterDataRecords.Where(record => record.SetKey == CommoditySet),
                        item => item.SubClassificationCode,
                        record => record.Code,
                        (_, record) => record.Name)
                    .Min(),
                descending),
            VendorRegistrySort.KbliCodes => Order(
                query,
                vendor => db.VendorKblis.Where(item => item.VendorId == vendor.Id).Select(item => item.KbliCode).Min(),
                descending),
            VendorRegistrySort.KbliDescriptions => Order(
                query,
                vendor => db.VendorKblis
                    .Where(item => item.VendorId == vendor.Id)
                    .Join(
                        db.MasterDataRecords.Where(record => record.SetKey == KbliSet),
                        item => item.KbliCode,
                        record => record.Code,
                        (_, record) => record.Name)
                    .Min(),
                descending),
            VendorRegistrySort.PortfolioClients => Order(
                query,
                vendor => db.VendorPortfolios.Where(item => item.VendorId == vendor.Id).Select(item => item.Client).Min(),
                descending),
            VendorRegistrySort.PortfolioScopes => Order(
                query,
                vendor => db.VendorPortfolios.Where(item => item.VendorId == vendor.Id).Select(item => item.ScopeOfWork).Min(),
                descending),
            VendorRegistrySort.CertificateNumbers => Order(
                query,
                vendor => db.VendorCertificates.Where(item => item.VendorId == vendor.Id).Select(item => item.CertificateNumber).Min(),
                descending),
            VendorRegistrySort.CertificateDescriptions => Order(
                query,
                vendor => db.VendorCertificates.Where(item => item.VendorId == vendor.Id).Select(item => item.Description).Min(),
                descending),
            _ => query.OrderByDescending(vendor => vendor.UpdatedAt ?? vendor.CreatedAt).ThenBy(vendor => vendor.Name),
        };

        return ordered.ThenBy(vendor => vendor.Id);
    }

    private static IOrderedQueryable<Vendor> Order<T>(
        IQueryable<Vendor> query,
        Expression<Func<Vendor, T>> key,
        bool descending) =>
        descending ? query.OrderByDescending(key) : query.OrderBy(key);
}
