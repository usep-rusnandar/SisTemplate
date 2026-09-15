using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;

namespace IntegratedProcurement.AppHost.Api.IntegrationTests;

public sealed class InternalLocalAuthTests : IClassFixture<IsolatedApiFixture>
{
    private const string SuperAdminPersonnelNo = "00109610";
    private const string OfficerEmail = "wita.aprilia@saptaindra.co.id";
    private const string OfficerPersonnelNo = "00116251";
    private const string StrongPassword = "LocalPass12!";

    private readonly IsolatedApiFixture _factory;

    public InternalLocalAuthTests(IsolatedApiFixture factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task PasswordLoginThenMeReturnsInternalSession()
    {
        using var client = _factory.CreateClient();
        await SetLocalPasswordAsync(client, OfficerPersonnelNo, StrongPassword);

        using var login = await client.PostAsJsonAsync(
            "/api/v1/internal/auth/login",
            new { identifier = OfficerEmail, password = StrongPassword });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);

        using var me = await client.GetAsync("/api/v1/internal/auth/me");
        var payload = await me.Content.ReadFromJsonAsync<MeResponse>();
        Assert.NotNull(payload);
        Assert.True(payload.IsAuthenticated);
        Assert.Equal(OfficerPersonnelNo, payload.PersonnelNo);
        Assert.True(payload.HasLocalPassword);
        Assert.True(payload.MustChangePassword);
    }

    [Fact]
    public async Task WrongPasswordReturnsInvalidCredentials()
    {
        using var client = _factory.CreateClient();
        await SetLocalPasswordAsync(client, OfficerPersonnelNo, StrongPassword);

        using var login = await client.PostAsJsonAsync(
            "/api/v1/internal/auth/login",
            new { identifier = OfficerEmail, password = "WrongPass12!" });
        Assert.Equal(HttpStatusCode.Unauthorized, login.StatusCode);
        var body = await login.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("invalid_credentials", body.GetProperty("code").GetString());
    }

    [Fact]
    public async Task LoginWithoutPasswordSetReturnsInvalidCredentials()
    {
        using var client = _factory.CreateClient();

        using var login = await client.PostAsJsonAsync(
            "/api/v1/internal/auth/login",
            new { identifier = SuperAdminPersonnelNo, password = StrongPassword });
        Assert.Equal(HttpStatusCode.Unauthorized, login.StatusCode);
    }

    [Fact]
    public async Task LockoutFollowsSettingsThenUnlocksOnAdminPasswordReset()
    {
        using var client = _factory.CreateClient();
        await DevLoginAsync(client, SuperAdminPersonnelNo);

        using var settingsPut = await client.PutAsJsonAsync(
            "/api/v1/super-admin/settings",
            new
            {
                values = new Dictionary<string, object?>
                {
                    ["lockEnabled"] = true,
                    ["maxAttempts"] = "2",
                    ["lockDuration"] = "120",
                    ["pwdDefault"] = true,
                }
            });
        Assert.Equal(HttpStatusCode.OK, settingsPut.StatusCode);

        await SetLocalPasswordAsync(client, OfficerPersonnelNo, StrongPassword, alreadyAuthenticated: true);
        await client.PostAsync("/api/v1/internal/auth/logout", null);

        using var fail1 = await client.PostAsJsonAsync(
            "/api/v1/internal/auth/login",
            new { identifier = OfficerEmail, password = "WrongPass12!" });
        Assert.Equal(HttpStatusCode.Unauthorized, fail1.StatusCode);

        using var fail2 = await client.PostAsJsonAsync(
            "/api/v1/internal/auth/login",
            new { identifier = OfficerEmail, password = "WrongPass12!" });
        Assert.Equal(HttpStatusCode.Unauthorized, fail2.StatusCode);
        var locked = await fail2.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("account_locked", locked.GetProperty("code").GetString());

        using var stillLocked = await client.PostAsJsonAsync(
            "/api/v1/internal/auth/login",
            new { identifier = OfficerEmail, password = StrongPassword });
        Assert.Equal(HttpStatusCode.Unauthorized, stillLocked.StatusCode);

        await SetLocalPasswordAsync(client, OfficerPersonnelNo, StrongPassword);

        using var afterReset = await client.PostAsJsonAsync(
            "/api/v1/internal/auth/login",
            new { identifier = OfficerEmail, password = StrongPassword });
        Assert.Equal(HttpStatusCode.OK, afterReset.StatusCode);

        await DevLoginAsync(client, SuperAdminPersonnelNo);
        using var restore = await client.PutAsJsonAsync(
            "/api/v1/super-admin/settings",
            new
            {
                values = new Dictionary<string, object?>
                {
                    ["lockEnabled"] = true,
                    ["maxAttempts"] = "5",
                    ["lockDuration"] = "2000",
                }
            });
        Assert.Equal(HttpStatusCode.OK, restore.StatusCode);
    }

    [Fact]
    public async Task ChangePasswordClearsMustChangePassword()
    {
        using var client = _factory.CreateClient();
        await SetLocalPasswordAsync(client, OfficerPersonnelNo, StrongPassword);

        using var login = await client.PostAsJsonAsync(
            "/api/v1/internal/auth/login",
            new { identifier = OfficerEmail, password = StrongPassword });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);

        using var change = await client.PostAsJsonAsync(
            "/api/v1/internal/auth/change-password",
            new { currentPassword = StrongPassword, newPassword = "ChangedPass12!" });
        Assert.Equal(HttpStatusCode.NoContent, change.StatusCode);

        using var me = await client.GetAsync("/api/v1/internal/auth/me");
        var payload = await me.Content.ReadFromJsonAsync<MeResponse>();
        Assert.NotNull(payload);
        Assert.False(payload.MustChangePassword);
        Assert.True(payload.HasLocalPassword);
    }

    [Fact]
    public async Task DevLoginIsNotFoundWhenPasswordlessIsDisabled()
    {
        using var factory = _factory.Factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureAppConfiguration((_, configuration) =>
            {
                configuration.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["Auth:AllowPasswordlessDevLogin"] = "false"
                });
            });
        });
        using var client = factory.CreateClient();

        using var login = await client.PostAsJsonAsync(
            "/api/v1/internal/auth/dev-login",
            new { identifier = SuperAdminPersonnelNo });
        Assert.Equal(HttpStatusCode.NotFound, login.StatusCode);
    }

    [Fact]
    public async Task PasswordResetRequestReturnsAcceptedForUnknownIdentifier()
    {
        using var client = _factory.CreateClient();

        using var response = await client.PostAsJsonAsync(
            "/api/v1/internal/auth/password-reset/request",
            new { identifier = "unknown.staff@example.test" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("accepted", payload.GetProperty("status").GetString());
        Assert.True(payload.GetProperty("resetToken").ValueKind is JsonValueKind.Null or JsonValueKind.Undefined);
    }

    [Fact]
    public async Task PasswordResetConfirmSetsNewPasswordWithoutMustChange()
    {
        using var client = _factory.CreateClient();
        await SetLocalPasswordAsync(client, OfficerPersonnelNo, StrongPassword);

        using var request = await client.PostAsJsonAsync(
            "/api/v1/internal/auth/password-reset/request",
            new { identifier = OfficerEmail });
        Assert.Equal(HttpStatusCode.OK, request.StatusCode);
        var payload = await request.Content.ReadFromJsonAsync<JsonElement>();
        var token = payload.GetProperty("resetToken").GetString();
        Assert.False(string.IsNullOrWhiteSpace(token));

        const string nextPassword = "ResetPass12!";
        using var confirm = await client.PostAsJsonAsync(
            "/api/v1/internal/auth/password-reset/confirm",
            new { identifier = OfficerEmail, resetToken = token, newPassword = nextPassword });
        Assert.Equal(HttpStatusCode.NoContent, confirm.StatusCode);

        using var login = await client.PostAsJsonAsync(
            "/api/v1/internal/auth/login",
            new { identifier = OfficerEmail, password = nextPassword });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);

        using var me = await client.GetAsync("/api/v1/internal/auth/me");
        var mePayload = await me.Content.ReadFromJsonAsync<MeResponse>();
        Assert.NotNull(mePayload);
        Assert.True(mePayload.HasLocalPassword);
        Assert.False(mePayload.MustChangePassword);
    }

    [Fact]
    public async Task PasswordResetConfirmRejectsInvalidToken()
    {
        using var client = _factory.CreateClient();
        await SetLocalPasswordAsync(client, OfficerPersonnelNo, StrongPassword);

        using var confirm = await client.PostAsJsonAsync(
            "/api/v1/internal/auth/password-reset/confirm",
            new { identifier = OfficerEmail, resetToken = "not-a-token", newPassword = "ResetPass12!" });
        Assert.Equal(HttpStatusCode.BadRequest, confirm.StatusCode);
        var body = await confirm.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("reset_token_invalid", body.GetProperty("code").GetString());
    }

    private static async Task SetLocalPasswordAsync(
        HttpClient client,
        string personnelNo,
        string password,
        bool alreadyAuthenticated = false)
    {
        if (!alreadyAuthenticated)
        {
            await DevLoginAsync(client, SuperAdminPersonnelNo);
        }

        using var response = await client.PutAsJsonAsync(
            $"/api/v1/administration/users/{personnelNo}/password",
            new { password });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        await client.PostAsync("/api/v1/internal/auth/logout", null);
    }

    private static async Task DevLoginAsync(HttpClient client, string personnelNo)
    {
        using var response = await client.PostAsJsonAsync(
            "/api/v1/internal/auth/dev-login",
            new { identifier = personnelNo });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private sealed record MeResponse(
        bool IsAuthenticated,
        string PersonnelNo,
        bool HasLocalPassword,
        bool MustChangePassword);
}
