using IntegratedProcurement.Modules.VendorOnboarding.Domain;

namespace IntegratedProcurement.AppHost.Api.IntegrationTests;

/// <summary>
/// Server-side upload guard. The portal pre-checks the same rules, but a caller can skip the browser
/// entirely, so these are the checks that actually protect the document store.
/// </summary>
public sealed class VendorDocumentRulesTests
{
    private const long Mb = 1024 * 1024;

    [Fact]
    public void AnUnknownDocumentTypeIsRefused()
    {
        var rejection = VendorDocumentRules.Validate("not-a-slot", "x.pdf", 1024);

        Assert.NotNull(rejection);
        Assert.Equal("doc_type_unknown", rejection!.Value.Code);
    }

    [Fact]
    public void AnExtensionOutsideTheRuleIsRefused()
    {
        var rejection = VendorDocumentRules.Validate("special-requirement", "payload.exe", 1024);

        Assert.NotNull(rejection);
        Assert.Equal("file_extension_not_allowed", rejection!.Value.Code);
    }

    [Fact]
    public void PaktaIntegritasTakesPdfOnly()
    {
        Assert.Null(VendorDocumentRules.Validate("pakta-integritas", "signed.pdf", Mb));
        Assert.Equal(
            "file_extension_not_allowed",
            VendorDocumentRules.Validate("pakta-integritas", "signed.png", Mb)!.Value.Code);
    }

    [Fact]
    public void OversizeIsRefusedAtTheRuleBoundary()
    {
        // special-requirement allows 5MB — exactly 5MB passes, a byte more does not.
        Assert.Null(VendorDocumentRules.Validate("special-requirement", "cert.pdf", 5 * Mb));
        Assert.Equal(
            "file_too_large",
            VendorDocumentRules.Validate("special-requirement", "cert.pdf", (5 * Mb) + 1)!.Value.Code);
    }

    [Fact]
    public void TheDeliberateOutliersKeepTheirOwnLimits()
    {
        // A logo is rendered inline (500KB cap); a deed runs to many pages.
        Assert.Null(VendorDocumentRules.Validate("logo", "logo.png", 500 * 1024));
        Assert.Equal("file_too_large", VendorDocumentRules.Validate("logo", "logo.png", (500 * 1024) + 1)!.Value.Code);
        Assert.Null(VendorDocumentRules.Validate("akta-pendirian", "deed.pdf", 9 * Mb));
    }

    [Fact]
    public void EverySlotTheVendorWizardUploadsHasARule()
    {
        // Mirrors VW_FILE_RULES in VendorProfileWizard.jsx — the portal must not be able to send a
        // docType the server then rejects as unknown.
        string[] wizardDocTypes =
        [
            "pakta-integritas", "company-profile", "logo", "org-structure", "npwp", "nib",
            "akta-pendirian", "akta-perubahan", "akta-penyesuaian", "sppkp", "brand", "kbli",
            "sertifikat", "portfolio", "special-requirement",
        ];

        Assert.All(wizardDocTypes, docType => Assert.NotNull(VendorDocumentRules.For(docType)));
        Assert.Equal(wizardDocTypes.Length, VendorDocumentRules.All.Count);
    }

    [Fact]
    public void SizesAreDescribedTheWayTheHintReadsThem()
    {
        Assert.Equal("5MB", VendorDocumentRules.Describe(5 * Mb));
        Assert.Equal("500KB", VendorDocumentRules.Describe(500 * 1024));
    }
}
