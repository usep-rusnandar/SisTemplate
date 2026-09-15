using IntegratedProcurement.Modules.ContractInitiationPlatform.Domain;

namespace IntegratedProcurement.Modules.ContractInitiationPlatform.Application;

public sealed record CipCreateFromAwardResult(bool AwardFound, int Existing, IReadOnlyList<CipCase> Created);

public sealed record CipBlobRef(string Container, string BlobKey);

public sealed record CipWithdrawResult(int CasesRemoved, IReadOnlyList<CipBlobRef> Blobs);

/// <summary>Generic CIP case command outcome.</summary>
public sealed record CipCommandResult(bool Found, CipCase? Case, string? ErrorCode = null);
