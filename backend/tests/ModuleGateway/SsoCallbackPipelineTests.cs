using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;

namespace IntegratedProcurement.ModuleGateway.Tests;

/// <summary>
/// The token rewrite must re-run endpoint routing. Otherwise <c>/?token=</c> stays
/// bound to the SPA fallback, which 404s once the path is rewritten to <c>/api/...</c>.
/// </summary>
public sealed class SsoCallbackPipelineTests : IAsyncLifetime
{
    private WebApplication? _backend;
    private WebApplicationFactory<Program>? _factory;
    private string _contentRoot = string.Empty;

    public async Task InitializeAsync()
    {
        _contentRoot = Path.Combine(Path.GetTempPath(), "mgw-sso-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(Path.Combine(_contentRoot, "wwwroot"));
        await File.WriteAllTextAsync(Path.Combine(_contentRoot, "wwwroot", "index.html"), "<html>spa</html>");

        var backendBuilder = WebApplication.CreateBuilder();
        backendBuilder.WebHost.UseUrls("http://127.0.0.1:0");
        _backend = backendBuilder.Build();
        _backend.MapGet("/api/v1/internal/sso/callback", (HttpRequest req) =>
            Results.Json(new { path = req.Path.Value, token = req.Query["token"].ToString() }));
        await _backend.StartAsync();

        var backendUrl = _backend.Urls.First();
        _factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseContentRoot(_contentRoot);
            builder.UseSetting("Backend:BaseUrl", backendUrl);
            builder.UseSetting("Module:Key", "proposal-tracker");
        });
    }

    public async Task DisposeAsync()
    {
        if (_factory is not null)
        {
            await _factory.DisposeAsync();
        }

        if (_backend is not null)
        {
            await _backend.DisposeAsync();
        }

        if (_contentRoot.Length > 0 && Directory.Exists(_contentRoot))
        {
            Directory.Delete(_contentRoot, recursive: true);
        }
    }

    [Fact]
    public async Task RootTokenQueryIsProxiedToSsoCallback()
    {
        using var client = _factory!.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        using var response = await client.GetAsync("/?token=aaa.bbb.ccc");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<CallbackDto>();
        Assert.NotNull(payload);
        Assert.Equal("/api/v1/internal/sso/callback", payload.path);
        Assert.Equal("aaa.bbb.ccc", payload.token);
    }

    [Fact]
    public async Task RootWithoutTokenStillServesSpa()
    {
        using var client = _factory!.CreateClient();
        using var response = await client.GetAsync("/");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("spa", await response.Content.ReadAsStringAsync(), StringComparison.Ordinal);
    }

    private sealed record CallbackDto(string path, string token);
}
