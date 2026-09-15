namespace SisTemplate.BuildingBlocks.Application.Validation;

public sealed record ValidationError(string Field, string Message);
