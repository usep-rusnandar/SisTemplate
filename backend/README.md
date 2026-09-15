# Integrated Procurement Backend

ASP.NET Core 10 modular monolith foundation for Integrated Procurement.

This skeleton intentionally contains platform/module boundaries and route placeholders only. Business workflow implementation starts after the identity and security vertical slice is wired.

## Local Run

```powershell
dotnet restore
dotnet build
dotnet run --project src/AppHost/IntegratedProcurement.AppHost.Api.csproj
```

Default development assumptions:

- `SSO:Enabled=false`
- SQL Server LocalDB
- local filesystem document storage
- frontend runs separately during development

## Deployment Readiness Notes

- `/api/health/live` is a process liveness probe.
- `/api/health/ready` now performs a database connectivity check and returns `503` when the app cannot reach SQL Server.
- CORS origins are resolved from `Cors:AllowedOrigins` when present, otherwise from `Frontend:*` and `VendorRegistration:RegistrationUrl`.
- Keep non-development deployments configured via environment-specific settings for frontend origins instead of relying on localhost defaults.
