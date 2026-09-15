namespace IntegratedProcurement.BuildingBlocks.Application.Abstractions;

public interface ICurrentActor
{
    CurrentActor Actor { get; }
}

public sealed record CurrentActor(
    ActorType ActorType,
    string ActorId,
    string DisplayName,
    IReadOnlyCollection<string> Roles,
    IReadOnlyCollection<string> Permissions,
    string? VendorId = null,
    string? VendorUserId = null);

public enum ActorType
{
    Anonymous = 0,
    Internal = 1,
    Vendor = 2,
    System = 3
}
