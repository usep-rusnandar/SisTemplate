using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace IntegratedProcurement.AppHost.Api.Auth;

/// <summary>
/// No-op authentication scheme registered as the app's <c>DefaultScheme</c>. The internal
/// principal is attached directly to <see cref="Microsoft.AspNetCore.Http.HttpContext.User"/>
/// by <c>SsoMiddleware</c> (SISWarrior session/JWT) rather than through an
/// <see cref="AuthenticationHandler{TOptions}"/>, so this handler never authenticates anyone
/// itself. It exists solely so <c>UseAuthorization</c> has a default scheme to challenge/forbid
/// against for anonymous callers — without one, ASP.NET Core throws
/// <see cref="InvalidOperationException"/> instead of returning 401/403. The base class default
/// behaviour (401 on challenge, 403 on forbid) is exactly what internal API callers need.
/// </summary>
public sealed class InternalAuthenticationHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    public const string SchemeName = "Internal";

    public InternalAuthenticationHandler(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder)
        : base(options, logger, encoder)
    {
    }

    protected override Task<AuthenticateResult> HandleAuthenticateAsync() =>
        Task.FromResult(AuthenticateResult.NoResult());
}
