namespace IntegratedProcurement.Modules.VendorOnboarding.Application.Profile;

/// <summary>
/// Brand rows on a vendor profile require Brand Name and Distributor Type.
/// Expire date and the brand document stay optional. Draft saves may still
/// persist historical rows that are missing a type; submission must not.
/// </summary>
public static class VendorBrandRules
{
    public static IReadOnlyList<string> Validate(IEnumerable<VendorBrandInput>? brands)
    {
        var errors = new List<string>();
        foreach (var brand in brands ?? [])
        {
            var name = (brand.BrandName ?? string.Empty).Trim();
            if (name.Length == 0)
            {
                errors.Add("Brand Name is required.");
                continue;
            }

            if (string.IsNullOrWhiteSpace(brand.DistributorTypeCode))
            {
                errors.Add($"Brand {name}: Distributor Type is required.");
            }
        }

        return errors;
    }
}
