namespace IntegratedProcurement.AppHost.Api.Middleware;

public sealed class CorrelationIdMiddleware
{
    public const string HeaderName = "X-Correlation-ID";

    private readonly RequestDelegate _next;

    public CorrelationIdMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var correlationId = context.Request.Headers.TryGetValue(HeaderName, out var header)
            ? header.ToString()
            : context.TraceIdentifier;

        context.Response.Headers[HeaderName] = correlationId;
        await _next(context);
    }
}
