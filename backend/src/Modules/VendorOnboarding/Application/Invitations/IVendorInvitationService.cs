namespace IntegratedProcurement.Modules.VendorOnboarding.Application.Invitations;

public interface IVendorInvitationService
{
    Task<IReadOnlyCollection<InvitationDto>> ListAsync(CancellationToken cancellationToken = default);

    Task<InvitationDto?> GetAsync(Guid id, CancellationToken cancellationToken = default);

    Task<CreateInvitationResult> CreateAsync(
        CreateInvitationCommand command,
        CancellationToken cancellationToken = default);

    Task<ReissueInvitationResult> ReissueAsync(Guid id, CancellationToken cancellationToken = default);

    Task<InvitationDto?> RevokeAsync(Guid id, CancellationToken cancellationToken = default);

    Task<ValidateInvitationResult> ValidateAsync(
        ValidateInvitationCommand command,
        CancellationToken cancellationToken = default);

    Task<RegisterVendorResult> RegisterAsync(
        RegisterVendorCommand command,
        CancellationToken cancellationToken = default);
}
