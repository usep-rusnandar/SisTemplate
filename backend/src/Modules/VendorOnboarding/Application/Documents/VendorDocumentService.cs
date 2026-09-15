using IntegratedProcurement.Modules.VendorOnboarding.Domain;
using IntegratedProcurement.Platform.Documents.Application;

namespace IntegratedProcurement.Modules.VendorOnboarding.Application.Documents;

/// <summary>
/// Vendor document use-cases: record an uploaded Blob against a vendor (one document per
/// (vendor, type, owner) slot — re-recording replaces the previous blob), list, and delete.
/// The bytes live on Azure Blob (via <see cref="IDocumentStorage"/>); only metadata is in the DB.
/// </summary>
public sealed class VendorDocumentService
{
    private readonly IVendorDocumentRepository _repository;
    private readonly IDocumentStorage _storage;

    public VendorDocumentService(IVendorDocumentRepository repository, IDocumentStorage storage)
    {
        _repository = repository;
        _storage = storage;
    }

    public async Task<VendorDocumentDto> RecordAsync(RecordVendorDocumentCommand command, CancellationToken cancellationToken)
    {
        var ownerKey = string.IsNullOrWhiteSpace(command.OwnerKey) ? string.Empty : command.OwnerKey.Trim();

        // Replace any existing document in the same slot (delete its blob + row).
        var existing = await _repository.FindSlotAsync(command.VendorId, command.DocumentType, ownerKey, cancellationToken);
        if (existing is not null)
        {
            await TryDeleteBlobAsync(existing, cancellationToken);
            _repository.Remove(existing);
        }

        var document = VendorDocument.Create(
            command.VendorId, command.DocumentType, ownerKey,
            command.FileName, command.ContentType, command.FileSize, command.Container, command.BlobKey, command.UploadedBy,
            command.IsPlaceholder, command.SourceSystem);
        _repository.Add(document);
        await _repository.SaveChangesAsync(cancellationToken);
        return ToDto(document);
    }

    public async Task<IReadOnlyList<VendorDocumentDto>> ListAsync(string vendorId, CancellationToken cancellationToken)
    {
        var documents = await _repository.ListByVendorAsync(vendorId, cancellationToken);
        return documents.Select(ToDto).ToArray();
    }

    /// <summary>Fetch one document scoped to its owning vendor (null when not found or not owned).</summary>
    public async Task<VendorDocumentDto?> GetAsync(string vendorId, Guid documentId, CancellationToken cancellationToken)
    {
        var document = await _repository.GetAsync(documentId, cancellationToken);
        return document is null || document.VendorId != vendorId ? null : ToDto(document);
    }

    /// <summary>Delete a document (its blob + metadata). Returns false when it doesn't belong to the vendor.</summary>
    public async Task<bool> DeleteAsync(string vendorId, Guid documentId, CancellationToken cancellationToken)
    {
        var document = await _repository.GetAsync(documentId, cancellationToken);
        if (document is null || document.VendorId != vendorId)
        {
            return false;
        }

        await TryDeleteBlobAsync(document, cancellationToken);
        _repository.Remove(document);
        await _repository.SaveChangesAsync(cancellationToken);
        return true;
    }

    private async Task TryDeleteBlobAsync(VendorDocument document, CancellationToken cancellationToken)
    {
        if (!_storage.IsConfigured || string.IsNullOrWhiteSpace(document.BlobContainer) || string.IsNullOrWhiteSpace(document.BlobKey))
        {
            return;
        }

        try
        {
            await _storage.DeleteAsync(document.BlobContainer, document.BlobKey, cancellationToken);
        }
        catch
        {
            // Best effort — a missing/locked blob must not block metadata cleanup.
        }
    }

    private static VendorDocumentDto ToDto(VendorDocument d) =>
        new(d.Id, d.VendorId, d.DocumentType, d.OwnerKey, d.FileName, d.ContentType, d.FileSize, d.BlobContainer, d.BlobKey, d.UploadedBy, d.CreatedAt,
            d.IsPlaceholder, d.SourceSystem);
}
