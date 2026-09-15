using SisTemplate.Platform.Documents.Application;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace SisTemplate.Platform.Documents.Infrastructure;

/// <summary>
/// Composition for the Documents platform service: binds <see cref="AzureBlobOptions"/> from
/// configuration and registers <see cref="IDocumentStorage"/>.
/// <para>
/// <b>Do not change auth by environment.</b> Production and Staging always use Azure Blob with
/// Managed Identity (<c>AzureBlob:ServiceUri</c>). Development defaults to local disk — not Azure
/// SAS. Never register an Account Key / connection string on Azure slots. Never
/// <c>DefaultAzureCredential</c>. See WORK.md §5.
/// </para>
/// </summary>
public static class DocumentsModule
{
    public static IServiceCollection AddDocumentsModule(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddOptions<AzureBlobOptions>()
            .Bind(configuration.GetSection(AzureBlobOptions.SectionName))
            .PostConfigure<IHostEnvironment>((options, environment) =>
            {
                options.KeyPrefix = AzureBlobKeyPrefix.Resolve(options.KeyPrefix, environment.EnvironmentName);
                var useLocal = AzureBlobStorageMode.ShouldUseLocal(options.UseLocalStorage, environment.EnvironmentName);
                options.UseLocalStorage = useLocal;
                if (!useLocal)
                {
                    return;
                }

                if (string.IsNullOrWhiteSpace(options.LocalRoot))
                {
                    options.LocalRoot = Path.Combine(environment.ContentRootPath, "App_Data", "local-blob");
                }

                foreach (var pair in AzureBlobStorageMode.DefaultContainers)
                {
                    if (!options.Containers.TryGetValue(pair.Key, out var existing) || string.IsNullOrWhiteSpace(existing))
                    {
                        options.Containers[pair.Key] = pair.Value;
                    }
                }
            });
        services.AddSingleton<LocalDocumentAccess>();
        services.AddSingleton<IDocumentStorage>(sp =>
        {
            var options = sp.GetRequiredService<IOptions<AzureBlobOptions>>().Value;
            return options.UseLocalStorage == true
                ? ActivatorUtilities.CreateInstance<LocalFileDocumentStorage>(sp)
                : ActivatorUtilities.CreateInstance<BlobDocumentStorage>(sp);
        });

        services.Configure<SharePointOptions>(configuration.GetSection(SharePointOptions.SectionName));
        services.AddSingleton<ISharePointDocumentFetcher, GraphSharePointDocumentFetcher>();

        services.Configure<ContractTemplateOptions>(configuration.GetSection(ContractTemplateOptions.SectionName));
        services.AddSingleton<IContractTemplateMerger, DocxTemplateMerger>();

        services.Configure<DocumentConversionOptions>(configuration.GetSection(DocumentConversionOptions.SectionName));
        services.AddSingleton<IDocumentPdfConverter, OfficeDocumentPdfConverter>();

        // QuestPDF Community licence (free for our usage tier); must be set once before rendering.
        QuestPDF.Settings.License = QuestPDF.Infrastructure.LicenseType.Community;
        services.AddSingleton<ICertificateGenerator, CertificatePdfGenerator>();
        services.AddSingleton<IPlaceholderDocumentGenerator, PlaceholderDocumentGenerator>();
        return services;
    }
}
