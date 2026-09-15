using System.Text;
using IntegratedProcurement.AppHost.Api.Auth;
using IntegratedProcurement.BuildingBlocks.Application;
using IntegratedProcurement.BuildingBlocks.Application.Abstractions;
using IntegratedProcurement.Platform.Documents.Application;
using IntegratedProcurement.Platform.Documents.Infrastructure;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace IntegratedProcurement.AppHost.Api.Endpoints;

/// <summary>
/// Generic document endpoints. Development stores files on local disk; Staging/Production use Azure
/// Blob. Callers keep only metadata (container + blob key). Downloads are short-lived URLs.
/// </summary>
public static class DocumentEndpoints
{
    public static IEndpointRouteBuilder MapDocumentEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/documents")
            .WithTags("Documents")
            .RequireAuthorization(AuthorizationPolicies.InternalUser);

        group.MapPost("/{module}/upload", UploadAsync)
            .DisableAntiforgery()
            .WithMetadata(new RequestSizeLimitAttribute(32 * 1024 * 1024));
        group.MapGet("/download", DownloadAsync);
        group.MapGet("/stream", StreamAsync);
        group.MapDelete("/{module}", DeleteAsync);
        group.MapGet("/local", ReadLocalAsync).AllowAnonymous();
        group.MapPut("/local", WriteLocalAsync)
            .AllowAnonymous()
            .DisableAntiforgery()
            .WithMetadata(new RequestSizeLimitAttribute(32 * 1024 * 1024));

        return endpoints;
    }

    private static async Task<IResult> UploadAsync(
        string module,
        IFormFile? file,
        HttpRequest request,
        IDocumentStorage storage,
        ICurrentActor currentActor,
        CancellationToken cancellationToken)
    {
        if (!storage.IsConfigured)
        {
            return Results.Problem("Document storage is not configured.", statusCode: StatusCodes.Status503ServiceUnavailable);
        }

        var requiredPermission = ModuleManagePermission(module);
        if (requiredPermission is null)
        {
            return Results.BadRequest(new { code = "unknown_module", module });
        }

        if (!ActorHasModuleManage(currentActor, requiredPermission))
        {
            return Results.StatusCode(StatusCodes.Status403Forbidden);
        }

        if (file is null || file.Length == 0)
        {
            return Results.BadRequest(new { code = "file_required" });
        }

        var container = storage.ContainerForModule(ModuleKeys.KeyForSlug(module) ?? module);
        await storage.EnsureContainerAsync(container, cancellationToken);
        var entityId = Slug(request.Form["entityId"].ToString());
        var docType = Slug(request.Form["docType"].ToString());
        var blobKey = $"{(entityId.Length == 0 ? "_" : entityId)}/{(docType.Length == 0 ? "doc" : docType)}/{Guid.NewGuid():N}-{SafeFileName(file.FileName)}";

        await using var stream = file.OpenReadStream();
        var result = await storage.UploadAsync(
            container,
            blobKey,
            stream,
            string.IsNullOrWhiteSpace(file.ContentType) ? "application/octet-stream" : file.ContentType,
            cancellationToken);

        return Results.Ok(new
        {
            module,
            container = result.Container,
            blobKey = result.BlobKey,
            fileName = file.FileName,
            contentType = result.ContentType,
            size = result.Size,
        });
    }

    private static async Task<IResult> DownloadAsync(
        string container,
        string key,
        IDocumentStorage storage,
        CancellationToken cancellationToken)
    {
        if (!storage.IsConfigured || string.IsNullOrWhiteSpace(container) || string.IsNullOrWhiteSpace(key))
        {
            return Results.NotFound(new { code = "document_not_found" });
        }

        return await DocumentReadLinks.JsonUrlAsync(
            storage, container, key, DocumentReadLinks.StreamUrl(container, key), cancellationToken);
    }

    private static Task<IResult> StreamAsync(
        string container,
        string key,
        IDocumentStorage storage,
        CancellationToken cancellationToken) =>
        DocumentReadLinks.StreamAsync(storage, container, key, cancellationToken);

    private static async Task<IResult> DeleteAsync(
        string module,
        string container,
        string key,
        IDocumentStorage storage,
        ICurrentActor currentActor,
        CancellationToken cancellationToken)
    {
        var requiredPermission = ModuleManagePermission(module);
        if (requiredPermission is null)
        {
            return Results.BadRequest(new { code = "unknown_module", module });
        }

        if (!ActorHasModuleManage(currentActor, requiredPermission))
        {
            return Results.StatusCode(StatusCodes.Status403Forbidden);
        }

        if (string.IsNullOrWhiteSpace(container) || string.IsNullOrWhiteSpace(key))
        {
            return Results.BadRequest(new { code = "container_and_key_required" });
        }

        if (storage.IsConfigured)
        {
            await storage.DeleteAsync(container, key, cancellationToken);
        }

        return Results.NoContent();
    }

    private static async Task<IResult> ReadLocalAsync(
        string container,
        string key,
        long exp,
        string perm,
        string sig,
        IDocumentStorage storage,
        IOptions<AzureBlobOptions> blobOptions,
        LocalDocumentAccess access,
        CancellationToken cancellationToken)
    {
        if (!IsValidLocalTicket(blobOptions.Value, access, "r", container, key, exp, perm, sig))
        {
            return Results.NotFound(new { code = "document_not_found" });
        }

        var bytes = await storage.TryDownloadAsync(container, key, cancellationToken);
        if (bytes is null)
        {
            return Results.NotFound(new { code = "document_not_found" });
        }

        var contentType = storage is LocalFileDocumentStorage local
            ? local.ContentTypeFor(container, key)
            : "application/octet-stream";
        var fileName = Path.GetFileName(key);
        return Results.File(bytes, contentType, string.IsNullOrWhiteSpace(fileName) ? "document" : fileName);
    }

    private static async Task<IResult> WriteLocalAsync(
        string container,
        string key,
        long exp,
        string perm,
        string sig,
        HttpRequest request,
        IDocumentStorage storage,
        IOptions<AzureBlobOptions> blobOptions,
        LocalDocumentAccess access,
        CancellationToken cancellationToken)
    {
        if (!IsValidLocalTicket(blobOptions.Value, access, "w", container, key, exp, perm, sig))
        {
            return Results.NotFound(new { code = "document_not_found" });
        }

        var contentType = string.IsNullOrWhiteSpace(request.ContentType)
            ? "application/octet-stream"
            : request.ContentType;
        await storage.EnsureContainerAsync(container, cancellationToken);
        await storage.UploadAsync(container, key, request.Body, contentType, cancellationToken);
        return Results.Ok();
    }

    private static bool IsValidLocalTicket(
        AzureBlobOptions options,
        LocalDocumentAccess access,
        string requiredPermission,
        string container,
        string key,
        long exp,
        string perm,
        string sig)
    {
        if (options.UseLocalStorage != true
            || string.IsNullOrWhiteSpace(container)
            || string.IsNullOrWhiteSpace(key)
            || !string.Equals(perm, requiredPermission, StringComparison.Ordinal))
        {
            return false;
        }

        return LocalDocumentTicket.IsValid(access.Secret, perm, container, key, exp, sig);
    }

    private static string? ModuleManagePermission(string module) =>
        string.IsNullOrWhiteSpace(module) ? null : PermissionKeys.SettingsUpdate;

    private static bool ActorHasModuleManage(ICurrentActor currentActor, string requiredPermission) =>
        currentActor.Actor.Permissions.Contains(requiredPermission, StringComparer.OrdinalIgnoreCase);

    private static string SafeFileName(string fileName)
    {
        var name = Path.GetFileName(fileName ?? string.Empty);
        if (string.IsNullOrWhiteSpace(name))
        {
            return "document";
        }

        var builder = new StringBuilder(name.Length);
        foreach (var ch in name)
        {
            builder.Append(char.IsLetterOrDigit(ch) || ch is '.' or '-' or '_' ? ch : '-');
        }

        return builder.ToString();
    }

    private static string Slug(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        var builder = new StringBuilder(value.Length);
        foreach (var ch in value.Trim())
        {
            builder.Append(char.IsLetterOrDigit(ch) || ch is '-' or '_' ? ch : '-');
        }

        return builder.ToString();
    }
}
