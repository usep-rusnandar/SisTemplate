namespace SisTemplate.Platform.Documents.Application;

public interface IPlaceholderDocumentGenerator
{
    byte[] Generate(string vendorName, string documentLabel, string sourceSystem, string externalVendorId);
}
