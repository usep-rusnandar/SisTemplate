namespace SisTemplate.AppHost.Api.Middleware;

public sealed class ExceptionHandlingMiddleware
{
    private static readonly Action<ILogger, Exception?> LogUnhandledException =
        LoggerMessage.Define(
            LogLevel.Error,
            new EventId(1000, nameof(ExceptionHandlingMiddleware)),
            "Unhandled API exception.");

    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;

    public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            LogUnhandledException(_logger, ex);
            context.Response.StatusCode = StatusCodes.Status500InternalServerError;
            await context.Response.WriteAsJsonAsync(new
            {
                type = "https://integrated-procurement/errors/unhandled",
                title = "Unhandled server error",
                status = StatusCodes.Status500InternalServerError,
                traceId = context.TraceIdentifier,
                code = "UNHANDLED_SERVER_ERROR"
            });
        }
    }
}
