using IntegratedProcurement.Platform.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedProcurement.AppHost.Api.IntegrationTests;

/// <summary>
/// Guards the SISWarrior access-check contract <c>dbo.CEK_USER_ACCESS_FN(@NRP)</c>. NRP and
/// PersonnelNo are the same value, so the function must resolve directly against iam.USER_T with
/// NO dependency on the (retired) iam.SSO_NRP_MAPPING_T bridge. Seeded internal users have no
/// mapping rows, so a seeded active user returning 'true' proves the direct-lookup behaviour that
/// migration 20260709014500_SimplifyCekUserAccessFnToDirectLookup installs on every fresh database.
/// </summary>
public sealed class CekUserAccessFunctionTests : IClassFixture<IsolatedApiFixture>
{
    private readonly IsolatedApiFixture _factory;

    public CekUserAccessFunctionTests(IsolatedApiFixture factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task ActiveSeededUserIsGrantedWithoutMappingRow()
    {
        // P-00001 is a seeded active user; no SSO_NRP_MAPPING_T row exists for it.
        Assert.Equal("true", await InvokeAsync("00109610"));
    }

    [Fact]
    public async Task UnknownPersonnelNumberIsDenied()
    {
        Assert.Equal("false", await InvokeAsync("99999999"));
    }

    private async Task<string?> InvokeAsync(string nrp)
    {
        using var scope = _factory.Factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ProcurementDbContext>();
        var connection = dbContext.Database.GetDbConnection();
        await connection.OpenAsync();
        try
        {
            using var command = connection.CreateCommand();
            command.CommandText = "SELECT dbo.CEK_USER_ACCESS_FN(@nrp)";
            var parameter = command.CreateParameter();
            parameter.ParameterName = "@nrp";
            parameter.Value = nrp;
            command.Parameters.Add(parameter);

            var result = await command.ExecuteScalarAsync();
            return result as string;
        }
        finally
        {
            await connection.CloseAsync();
        }
    }
}
