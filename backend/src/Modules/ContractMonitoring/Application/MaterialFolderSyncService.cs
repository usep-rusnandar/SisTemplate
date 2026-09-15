using IntegratedProcurement.Modules.ContractMonitoring.Domain;
using IntegratedProcurement.Platform.Documents.Application;

namespace IntegratedProcurement.Modules.ContractMonitoring.Application;

public sealed class MaterialFolderSyncService
{
    private readonly ISharePointDocumentFetcher _sharePoint;
    private readonly IContractRepository _contracts;
    private readonly IContractMaterialRepository _materials;
    private readonly ContractMaterialService _materialService;

    public MaterialFolderSyncService(
        ISharePointDocumentFetcher sharePoint,
        IContractRepository contracts,
        IContractMaterialRepository materials,
        ContractMaterialService materialService)
    {
        _sharePoint = sharePoint;
        _contracts = contracts;
        _materials = materials;
        _materialService = materialService;
    }

    public async Task<MaterialFolderSyncResult> SyncFolderAsync(string folderSharingLink, CancellationToken cancellationToken)
    {
        if (!_sharePoint.IsConfigured)
        {
            throw new InvalidOperationException("SharePoint is not configured (set SharePoint:TenantId).");
        }

        if (string.IsNullOrWhiteSpace(folderSharingLink))
        {
            throw new ArgumentException("Folder sharing link is required.", nameof(folderSharingLink));
        }

        var children = await _sharePoint.ListFolderChildrenAsync(folderSharingLink.Trim(), cancellationToken);
        var xlsxFiles = children
            .Where(item => !item.IsFolder
                && item.Name.EndsWith(".xlsx", StringComparison.OrdinalIgnoreCase)
                && !item.Name.StartsWith("~$", StringComparison.Ordinal))
            .ToArray();

        var contracts = await _contracts.ListAsync(null, cancellationToken);
        var byExpectedFile = contracts.ToDictionary(
            item => ContractMaterialService.ExpectedFileName(item.ContractKey),
            item => item,
            StringComparer.OrdinalIgnoreCase);

        var results = new List<MaterialFolderSyncFileResult>();
        var imported = 0;
        var skipped = 0;
        var notFound = 0;
        var failed = 0;

        foreach (var file in xlsxFiles)
        {
            if (!byExpectedFile.TryGetValue(file.Name, out var contract))
            {
                notFound++;
                results.Add(new MaterialFolderSyncFileResult(file.Name, "ContractNotFound", null, null,
                    "No contract matches this file name (expected Contract No. with '/' replaced by '-')."));
                continue;
            }

            var existingSync = await _materials.GetSyncFileByContractKeyAsync(contract.ContractKey, cancellationToken);
            if (ContractMaterialService.ShouldSkipSharePointFile(existingSync, file.Name, file.LastModified))
            {
                skipped++;
                results.Add(new MaterialFolderSyncFileResult(file.Name, "Skipped", contract.ContractKey, existingSync?.RowCount,
                    "Same file name and Last Modified — skipped."));
                continue;
            }

            try
            {
                await using var content = await _sharePoint.DownloadDriveItemAsync(file.DriveId, file.ItemId, cancellationToken);
                var upload = await _materialService.ReplaceFromXlsxAsync(
                    contract.ContractKey,
                    file.Name,
                    content,
                    MaterialSyncFile.Sources.SharePoint,
                    file.LastModified,
                    cancellationToken);
                imported++;
                results.Add(new MaterialFolderSyncFileResult(file.Name, "Imported", contract.ContractKey, upload.RowCount, null));
            }
            catch (Exception ex)
            {
                failed++;
                results.Add(new MaterialFolderSyncFileResult(file.Name, "Failed", contract.ContractKey, null, ex.Message));
            }
        }

        return new MaterialFolderSyncResult(xlsxFiles.Length, imported, skipped, notFound, failed, results);
    }
}
