namespace SisTemplate.BuildingBlocks.Application.Common;

public sealed record Result(bool Success, string? Code = null, string? Message = null)
{
    public static Result Ok() => new(true);

    public static Result Fail(string code, string message) => new(false, code, message);

    public static Result<T> Ok<T>(T value) => new(true, value);

    public static Result<T> Fail<T>(string code, string message) => new(false, default, code, message);
}

public sealed record Result<T>(bool Success, T? Value = default, string? Code = null, string? Message = null);
