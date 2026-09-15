# SisTemplate Backend

ASP.NET Core 10 modular monolith foundation for SisTemplate.

This is the platform/foundation layer only — cross-cutting concerns (RBAC, admin console,
documents, notifications, audit, internal identity). Add your own domain modules under
`src/Modules/<YourModule>`.

## Local Run

```powershell
dotnet restore
dotnet build
dotnet run --project src/AppHost/SisTemplate.AppHost.Api.csproj
```

Default development assumptions:

- `SSO:Enabled=false`
- SQL Server LocalDB
- local filesystem document storage
- frontend runs separately during development

## Deployment Readiness Notes

- `/api/health/live` is a process liveness probe.
- `/api/health/ready` now performs a database connectivity check and returns `503` when the app cannot reach SQL Server.
- CORS origins are resolved from `Cors:AllowedOrigins` when present, otherwise from `Frontend:*`.
- Keep non-development deployments configured via environment-specific settings for frontend origins instead of relying on localhost defaults.
