using IntegratedProcurement.Modules.VendorOnboarding.Domain;

namespace IntegratedProcurement.Modules.VendorOnboarding.Application.Migration;

public enum VendorAribaImportDisposition
{
    Create,
    Overwrite,
    Skip,
}

public sealed record VendorAribaExistingVendor(string VendorId, string Status);

public sealed record VendorAribaImportIdentityDecision(
    VendorAribaImportDisposition Disposition,
    string? TargetVendorId,
    IReadOnlyList<ImportIssue> Issues);

/// <summary>
/// Identity collisions for Ariba import. A taken PIC email overwrites the existing
/// vendor when its status is INITL; any other status is skipped. Already-imported
/// Ariba ids stay create-only (skip) unless the same INITL vendor is reached via email.
/// Collisions never block the rest of the batch.
/// </summary>
public static class VendorAribaImportIdentityRules
{
    public const string TakenEmailSkipMessage =
        "Email is already used by another vendor account; this row will be skipped and will not block the rest of the batch.";

    public static bool IsInitial(string? status) =>
        string.Equals(status, VendorStatuses.Initial, StringComparison.OrdinalIgnoreCase);

    public static VendorAribaImportIdentityDecision Decide(
        VendorAribaExistingVendor? vendorByEmail,
        VendorAribaExistingVendor? vendorByAribaId,
        bool emailTaken)
    {
        var issues = new List<ImportIssue>();

        if (vendorByEmail is not null)
        {
            if (vendorByAribaId is not null && !SameVendor(vendorByEmail, vendorByAribaId))
            {
                issues.Add(new ImportIssue(
                    "warning",
                    "PICEmail",
                    $"PIC email belongs to vendor {vendorByEmail.VendorId} ({vendorByEmail.Status}) but AribaVendorId belongs to vendor {vendorByAribaId.VendorId}; this row will be skipped."));
                return new(VendorAribaImportDisposition.Skip, vendorByEmail.VendorId, issues);
            }

            if (IsInitial(vendorByEmail.Status))
            {
                issues.Add(new ImportIssue(
                    "warning",
                    "PICEmail",
                    $"Email is already used by INITL vendor {vendorByEmail.VendorId}; existing data will be overwritten."));
                return new(VendorAribaImportDisposition.Overwrite, vendorByEmail.VendorId, issues);
            }

            issues.Add(new ImportIssue(
                "warning",
                "PICEmail",
                $"Email is already used by vendor {vendorByEmail.VendorId} with status {vendorByEmail.Status}; this row will be skipped."));
            return new(VendorAribaImportDisposition.Skip, vendorByEmail.VendorId, issues);
        }

        if (emailTaken)
        {
            issues.Add(new ImportIssue("warning", "PICEmail", TakenEmailSkipMessage));
            return new(VendorAribaImportDisposition.Skip, null, issues);
        }

        if (vendorByAribaId is not null)
        {
            issues.Add(new ImportIssue(
                "warning",
                "AribaVendorId",
                "Already imported; this row will be skipped and will not block the rest of the batch."));
            return new(VendorAribaImportDisposition.Skip, vendorByAribaId.VendorId, issues);
        }

        return new(VendorAribaImportDisposition.Create, null, issues);
    }

    private static bool SameVendor(VendorAribaExistingVendor left, VendorAribaExistingVendor right) =>
        string.Equals(left.VendorId, right.VendorId, StringComparison.OrdinalIgnoreCase);
}
