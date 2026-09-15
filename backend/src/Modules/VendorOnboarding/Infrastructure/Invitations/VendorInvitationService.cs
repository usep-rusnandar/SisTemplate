using IntegratedProcurement.BuildingBlocks.Application.Abstractions;
using IntegratedProcurement.Modules.VendorOnboarding.Application.Invitations;
using IntegratedProcurement.Modules.VendorOnboarding.Domain;
using IntegratedProcurement.Platform.Persistence;
using IntegratedProcurement.Platform.Persistence.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Options;

namespace IntegratedProcurement.Modules.VendorOnboarding.Infrastructure.Invitations;

public sealed class VendorInvitationService : IVendorInvitationService
{
    private readonly ProcurementDbContext _dbContext;
    private readonly UserManager<VendorIdentityUser> _userManager;
    private readonly IClock _clock;
    private readonly ICurrentActor _currentActor;
    private readonly VendorRegistrationOptions _options;

    public VendorInvitationService(
        ProcurementDbContext dbContext,
        UserManager<VendorIdentityUser> userManager,
        IClock clock,
        ICurrentActor currentActor,
        IOptions<VendorRegistrationOptions> options)
    {
        _dbContext = dbContext;
        _userManager = userManager;
        _clock = clock;
        _currentActor = currentActor;
        _options = options.Value;
    }

    public async Task<IReadOnlyCollection<InvitationDto>> ListAsync(
        CancellationToken cancellationToken = default)
    {
        return await _dbContext.Invitations
            .AsNoTracking()
            .OrderByDescending(invitation => invitation.CreatedAt)
            .Select(invitation => ToDto(invitation, _clock.UtcNow))
            .ToArrayAsync(cancellationToken);
    }

    public async Task<InvitationDto?> GetAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var invitation = await _dbContext.Invitations
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);

        return invitation is null ? null : ToDto(invitation, _clock.UtcNow);
    }

    public async Task<CreateInvitationResult> CreateAsync(
        CreateInvitationCommand command,
        CancellationToken cancellationToken = default)
    {
        var email = NormalizeEmail(command.Email);
        ArgumentException.ThrowIfNullOrWhiteSpace(command.VendorName);
        ArgumentException.ThrowIfNullOrWhiteSpace(command.PicName);
        var vendorName = command.VendorName.Trim();
        var picName = command.PicName.Trim();

        // EnableRetryOnFailure forbids user-initiated transactions unless the whole unit runs
        // inside an execution strategy that can replay it on a transient fault.
        var strategy = _dbContext.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await BeginTransactionIfRelationalAsync(cancellationToken);
            var reusableVendor = await ResolveReusableVendorAsync(
                email, command.VendorId, cancellationToken);
            if (IsInternalCompanyEmail(email))
            {
                throw new VendorInvitationRuleException(
                    "internal_email_not_allowed",
                    "Internal company email addresses cannot be invited as vendors.");
            }

            if (reusableVendor is null)
            {
                await EnsureEmailNotRegisteredAsync(email, cancellationToken);
            }

            var activeInvitation = await FindActiveInvitationAsync(email, cancellationToken);
            if (activeInvitation is not null)
            {
                if (!CanResendExistingInvitation(activeInvitation, reusableVendor))
                {
                    throw new VendorInvitationRuleException(
                        "active_invitation_exists",
                        "An invitation was already sent to this email. Open Vendor Invitation and use Resend.");
                }

                var resent = await RotateInvitationCodeAsync(
                    activeInvitation,
                    command.ExpiredAt,
                    cancellationToken);
                if (transaction is not null)
                {
                    await transaction.CommitAsync(cancellationToken);
                }

                return resent;
            }

            var vendor = reusableVendor;
            if (vendor is null)
            {
                vendor = Vendor.Invite(vendorName, _currentActor.Actor.ActorId);
                _dbContext.Vendors.Add(vendor);
                await _dbContext.SaveChangesAsync(cancellationToken);
            }
            else if (string.Equals(vendor.Status, VendorStatuses.Initial, StringComparison.OrdinalIgnoreCase))
            {
                vendor.SetStatus(
                    VendorStatuses.Invited,
                    _currentActor.Actor.ActorId,
                    "Officer invited imported vendor to register.");
            }
            else if (string.Equals(vendor.Status, VendorStatuses.Invited, StringComparison.OrdinalIgnoreCase)
                && !await HasExternalReferenceAsync(vendor.Id, cancellationToken))
            {
                vendor.Rename(vendorName);
            }

            await EnsurePasswordlessIdentityAsync(vendor, email, picName, cancellationToken);

            var invitationCode = await GenerateUniqueCodeAsync(cancellationToken);
            var expiredAt = command.ExpiredAt ?? _clock.UtcNow.AddDays(_options.DefaultExpiryDays);
            var invitation = Invitation.Create(
                InvitationCodeHasher.Hash(invitationCode),
                InvitationCodeGenerator.Mask(invitationCode),
                email,
                vendorName,
                picName,
                expiredAt,
                command.Category,
                vendor.Id,
                command.Note);
            invitation.MarkSent();

            _dbContext.Invitations.Add(invitation);
            await _dbContext.SaveChangesAsync(cancellationToken);
            if (transaction is not null)
            {
                await transaction.CommitAsync(cancellationToken);
            }

            return new CreateInvitationResult(
                ToDto(invitation, _clock.UtcNow),
                invitationCode,
                BuildRegistrationUrl(invitationCode));
        });
    }

    public async Task<ReissueInvitationResult> ReissueAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var invitation = await FindInvitationAsync(id, cancellationToken);
        if (invitation.UsedAt.HasValue || invitation.Status == InvitationStatuses.Registered)
        {
            throw new VendorInvitationRuleException(
                InvitationFailureReasons.Used,
                "Invitation has already been used.");
        }

        if (invitation.Status == InvitationStatuses.Revoked)
        {
            throw new VendorInvitationRuleException(
                InvitationFailureReasons.Revoked,
                "Invitation has been revoked.");
        }

        Vendor? boundVendor = null;
        if (!string.IsNullOrWhiteSpace(invitation.VendorId))
        {
            boundVendor = await _dbContext.Vendors
                .FirstOrDefaultAsync(item => item.Id == invitation.VendorId, cancellationToken);
        }

        await EnsureEmailCanBeInvitedAsync(invitation.Email, cancellationToken, invitation.Id, boundVendor);

        var invitationCode = await GenerateUniqueCodeAsync(cancellationToken);
        invitation.Reissue(
            InvitationCodeHasher.Hash(invitationCode),
            InvitationCodeGenerator.Mask(invitationCode),
            _clock.UtcNow.AddDays(_options.DefaultExpiryDays));

        await _dbContext.SaveChangesAsync(cancellationToken);

        return new ReissueInvitationResult(
            ToDto(invitation, _clock.UtcNow),
            invitationCode,
            BuildRegistrationUrl(invitationCode));
    }

    public async Task<InvitationDto?> RevokeAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var invitation = await _dbContext.Invitations
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);

        if (invitation is null)
        {
            return null;
        }

        if (invitation.UsedAt.HasValue || invitation.Status == InvitationStatuses.Registered)
        {
            throw new VendorInvitationRuleException(
                InvitationFailureReasons.Used,
                "Invitation has already been used.");
        }

        invitation.Revoke();
        await _dbContext.SaveChangesAsync(cancellationToken);
        return ToDto(invitation, _clock.UtcNow);
    }

    public async Task<ValidateInvitationResult> ValidateAsync(
        ValidateInvitationCommand command,
        CancellationToken cancellationToken = default)
    {
        var code = InvitationCodeGenerator.Normalize(command.InvitationCode);
        var codeHash = InvitationCodeHasher.Hash(code);
        var email = string.IsNullOrWhiteSpace(command.Email) ? null : NormalizeEmail(command.Email);

        if (await IsRateLimitedAsync(email, InvitationCodeGenerator.Mask(code), cancellationToken))
        {
            await LogAttemptAsync(
                null,
                email,
                InvitationCodeGenerator.Mask(code),
                command.IpAddress,
                command.UserAgent,
                InvitationFailureReasons.TooManyAttempts,
                cancellationToken);

            return new ValidateInvitationResult(false, InvitationFailureReasons.TooManyAttempts, null);
        }

        var invitation = await _dbContext.Invitations
            .FirstOrDefaultAsync(item => item.CodeHash == codeHash, cancellationToken);

        var failure = ValidateInvitationState(invitation, email, _clock.UtcNow);
        if (failure is not null)
        {
            await LogAttemptAsync(
                invitation?.Id,
                email,
                InvitationCodeGenerator.Mask(code),
                command.IpAddress,
                command.UserAgent,
                failure,
                cancellationToken);

            return new ValidateInvitationResult(false, failure, invitation is null ? null : ToDto(invitation, _clock.UtcNow));
        }

        invitation!.MarkOpened();
        _dbContext.InvitationAttempts.Add(InvitationAttempt.Success(
            invitation.Id,
            invitation.Email,
            invitation.CodeMasked,
            command.IpAddress,
            command.UserAgent,
            _clock.UtcNow));
        await _dbContext.SaveChangesAsync(cancellationToken);

        return new ValidateInvitationResult(true, null, ToDto(invitation, _clock.UtcNow));
    }

    public async Task<RegisterVendorResult> RegisterAsync(
        RegisterVendorCommand command,
        CancellationToken cancellationToken = default)
    {
        var email = string.IsNullOrWhiteSpace(command.Email) ? null : NormalizeEmail(command.Email);
        var code = InvitationCodeGenerator.Normalize(command.InvitationCode);
        var codeHash = InvitationCodeHasher.Hash(code);

        // EnableRetryOnFailure forbids user-initiated transactions unless the whole unit runs inside an
        // execution strategy that can replay it on a transient fault. Wrap the register+commit here.
        var strategy = _dbContext.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
        await using var transaction = await BeginTransactionIfRelationalAsync(cancellationToken);
        var invitation = await _dbContext.Invitations
            .FirstOrDefaultAsync(item => item.CodeHash == codeHash, cancellationToken);

        var failure = ValidateInvitationState(invitation, email, _clock.UtcNow);
        if (failure is not null)
        {
            await LogAttemptAsync(
                invitation?.Id,
                email,
                InvitationCodeGenerator.Mask(code),
                command.IpAddress,
                command.UserAgent,
                failure,
                cancellationToken);

            throw new VendorInvitationRuleException(failure, "Invitation cannot be used for registration.");
        }

        // The invitation is the source of truth: the vendor only sets a password at this step.
        if (string.IsNullOrWhiteSpace(email))
        {
            email = NormalizeEmail(invitation!.Email);
        }

        var picName = string.IsNullOrWhiteSpace(command.PicName) ? invitation!.PicName : command.PicName.Trim();

        var existingIdentity = invitation!.VendorId is null
            ? null
            : await FindWorkspacePicAsync(invitation.VendorId, cancellationToken)
                ?? await _userManager.FindByIdAsync(invitation.VendorId);
        if (existingIdentity is null)
        {
            await EnsureEmailNotRegisteredAsync(email, cancellationToken);
        }
        else if (!string.Equals(existingIdentity.Email, email, StringComparison.OrdinalIgnoreCase))
        {
            await EnsureEmailNotRegisteredAsync(email, cancellationToken);
        }

        Vendor vendor;
        if (invitation.VendorId is not null)
        {
            vendor = await _dbContext.Vendors.FirstAsync(item => item.Id == invitation.VendorId, cancellationToken);
            if (vendor.Status is VendorStatuses.Initial or VendorStatuses.Invited)
            {
                vendor.SetStatus(VendorStatuses.Responded, vendor.Id, "Vendor responded to the invitation and set a password.");
            }
        }
        else
        {
            // Legacy invitations created before vendor-at-invite. New invites always set VendorId.
            // VENDOR_STATUS_T is the historical trail, so responding writes BOTH steps:
            // an Invited row (backdated to the last successful code validation recorded in
            // INVITATION_ATTEMPT_T, attributed to the inviting officer) followed by Responded.
            var lastSuccessfulAttempt = await _dbContext.InvitationAttempts
                .AsNoTracking()
                .Where(attempt => attempt.InvitationId == invitation.Id && attempt.Result == InvitationAttemptResults.Success)
                .OrderByDescending(attempt => attempt.AttemptedAt)
                .FirstOrDefaultAsync(cancellationToken);

            vendor = Vendor.Register(
                string.IsNullOrWhiteSpace(command.VendorName) ? invitation.VendorName : command.VendorName,
                initialStatus: VendorStatuses.Invited,
                actor: invitation.CreatedBy,
                statusReason: "Vendor invited to register.",
                statusOccurredAt: lastSuccessfulAttempt?.AttemptedAt ?? invitation.CreatedAt);

            // Seed the profile fields captured at registration; the full wizard (addresses, akta,
            // classification, documents) is applied in a later step. The vendor still has to complete
            // and submit the profile, so respond into an editable state (NOT Submitted).
            vendor.UpdateContact(command.Position, null, null, command.Phone, null, null, null);
            vendor.UpdateLegal(command.Npwp, command.Nib, null, null, null, null, null, null, null);
            vendor.SetStatus(VendorStatuses.Responded, vendor.Id, "Vendor responded to the invitation and set a password.");
            _dbContext.Vendors.Add(vendor);
        }

        var identityUser = existingIdentity ?? new VendorIdentityUser
        {
            Id = vendor.Id,
            UserName = email,
            Email = email,
            EmailConfirmed = true,
            CompleteName = picName,
            Position = string.IsNullOrWhiteSpace(command.Position) ? null : command.Position.Trim(),
            PhoneNumber = string.IsNullOrWhiteSpace(command.Phone) ? null : command.Phone.Trim(),
            Status = VendorUserStatuses.Active,
            IsActive = true,
            HasLogin = true
        };

        if (existingIdentity is null)
        {
            var createResult = await _userManager.CreateAsync(identityUser, command.Password);
            if (!createResult.Succeeded)
            {
                var reason = string.Join("; ", createResult.Errors.Select(error => error.Description));
                await LogAttemptAsync(
                    invitation.Id,
                    email,
                    invitation.CodeMasked,
                    command.IpAddress,
                    command.UserAgent,
                    reason,
                    cancellationToken);

                throw new VendorInvitationRuleException("identity_create_failed", reason);
            }

            var roleResult = await _userManager.AddToRoleAsync(identityUser, VendorIdentityRoleNames.Vendor);
            if (!roleResult.Succeeded)
            {
                var reason = string.Join("; ", roleResult.Errors.Select(error => error.Description));
                throw new VendorInvitationRuleException("role_assign_failed", reason);
            }
        }
        else
        {
            await ActivateImportedIdentityAsync(existingIdentity, command.Password, picName, command.Position, command.Phone);
        }

        var vendorUser = await _dbContext.VendorUsers
            .FirstOrDefaultAsync(link => link.VendorId == vendor.Id && link.IdentityUserId == identityUser.Id, cancellationToken);
        if (vendorUser is null)
        {
            vendorUser = VendorUser.Create(identityUser.Id, vendor.Id, isWorkspacePic: true);
            _dbContext.VendorUsers.Add(vendorUser);
        }

        // Persist first so the identity PK is assigned before it is referenced by the invitation.
        await _dbContext.SaveChangesAsync(cancellationToken);

        invitation.MarkUsed(vendorUser.Id, _clock.UtcNow);
        _dbContext.InvitationAttempts.Add(InvitationAttempt.Success(
            invitation.Id,
            email,
            invitation.CodeMasked,
            command.IpAddress,
            command.UserAgent,
            _clock.UtcNow));

        await _dbContext.SaveChangesAsync(cancellationToken);
        if (transaction is not null)
        {
            await transaction.CommitAsync(cancellationToken);
        }

        return new RegisterVendorResult(
            vendor.Id,
            vendorUser.Id,
            identityUser.Id,
            invitation.Id,
            email,
            vendor.Name,
            VendorIdentityRoleNames.Vendor);
        });
    }

    private async Task<Invitation> FindInvitationAsync(Guid id, CancellationToken cancellationToken)
    {
        return await _dbContext.Invitations.FirstOrDefaultAsync(item => item.Id == id, cancellationToken)
            ?? throw new VendorInvitationRuleException(InvitationFailureReasons.Invalid, "Invitation was not found.");
    }

    private async Task<string> GenerateUniqueCodeAsync(CancellationToken cancellationToken)
    {
        for (var attempt = 0; attempt < 10; attempt++)
        {
            var code = InvitationCodeGenerator.Generate();
            var hash = InvitationCodeHasher.Hash(code);
            var exists = await _dbContext.Invitations
                .AnyAsync(invitation => invitation.CodeHash == hash, cancellationToken);

            if (!exists)
            {
                return code;
            }
        }

        throw new VendorInvitationRuleException("code_generation_failed", "Unable to generate a unique invitation code.");
    }

    private static readonly string[] BlockedInvitationEmailDomains =
    [
        "saptaindra.co.id",
        "alamtri.com",
    ];

    private async Task EnsureEmailCanBeInvitedAsync(
        string email,
        CancellationToken cancellationToken,
        Guid? currentInvitationId = null,
        Vendor? importedVendor = null)
    {
        if (IsInternalCompanyEmail(email))
        {
            throw new VendorInvitationRuleException(
                "internal_email_not_allowed",
                "Internal company email addresses cannot be invited as vendors.");
        }

        if (importedVendor is null)
        {
            await EnsureEmailNotRegisteredAsync(email, cancellationToken);
        }

        var hasActiveInvitation = await _dbContext.Invitations.AnyAsync(invitation =>
            invitation.Email == email
            && invitation.Id != currentInvitationId
            && invitation.UsedAt == null
            && (invitation.Status == InvitationStatuses.Draft
                || invitation.Status == InvitationStatuses.Sent
                || invitation.Status == InvitationStatuses.Opened)
            && invitation.ExpiredAt > _clock.UtcNow,
            cancellationToken);

        if (hasActiveInvitation)
        {
            throw new VendorInvitationRuleException(
                "active_invitation_exists",
                "An invitation was already sent to this email. Open Vendor Invitation and use Resend.");
        }
    }

    private async Task<Invitation?> FindActiveInvitationAsync(string email, CancellationToken cancellationToken)
    {
        return await _dbContext.Invitations
            .Where(invitation =>
                invitation.Email == email
                && invitation.UsedAt == null
                && (invitation.Status == InvitationStatuses.Draft
                    || invitation.Status == InvitationStatuses.Sent
                    || invitation.Status == InvitationStatuses.Opened)
                && invitation.ExpiredAt > _clock.UtcNow)
            .OrderByDescending(invitation => invitation.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);
    }

    private static bool CanResendExistingInvitation(Invitation invitation, Vendor? reusableVendor)
    {
        if (reusableVendor is null)
        {
            return false;
        }

        return string.IsNullOrWhiteSpace(invitation.VendorId)
            || string.Equals(invitation.VendorId, reusableVendor.Id, StringComparison.OrdinalIgnoreCase);
    }

    private async Task<CreateInvitationResult> RotateInvitationCodeAsync(
        Invitation invitation,
        DateTimeOffset? expiredAt,
        CancellationToken cancellationToken)
    {
        var invitationCode = await GenerateUniqueCodeAsync(cancellationToken);
        invitation.Reissue(
            InvitationCodeHasher.Hash(invitationCode),
            InvitationCodeGenerator.Mask(invitationCode),
            expiredAt ?? _clock.UtcNow.AddDays(_options.DefaultExpiryDays));
        await _dbContext.SaveChangesAsync(cancellationToken);
        return new CreateInvitationResult(
            ToDto(invitation, _clock.UtcNow),
            invitationCode,
            BuildRegistrationUrl(invitationCode));
    }

    private async Task<VendorIdentityUser?> FindIdentityByEmailAsync(string email, CancellationToken cancellationToken)
    {
        var identity = await _userManager.FindByEmailAsync(email);
        if (identity is not null)
        {
            return identity;
        }

        var normalized = email.ToUpperInvariant();
        return await _dbContext.Users.FirstOrDefaultAsync(
            user => user.NormalizedEmail == normalized,
            cancellationToken);
    }

    private async Task<Vendor?> ResolveReusableVendorAsync(
        string email,
        string? requestedVendorId,
        CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(requestedVendorId))
        {
            var requested = await _dbContext.Vendors
                .FirstOrDefaultAsync(item => item.Id == requestedVendorId, cancellationToken);
            if (requested is null)
            {
                throw new VendorInvitationRuleException(
                    InvitationFailureReasons.Invalid,
                    "Vendor was not found.");
            }

            if (!VendorStatuses.AllowsOfficerInviteReuse(requested.Status))
            {
                throw new VendorInvitationRuleException(
                    InvitationFailureReasons.EmailRegistered,
                    "This vendor is no longer waiting for an officer invitation.");
            }

            var requestedPic = await FindWorkspacePicAsync(requested.Id, cancellationToken);
            if (requestedPic is not null
                && !string.IsNullOrWhiteSpace(requestedPic.Email)
                && !string.Equals(requestedPic.Email, email, StringComparison.OrdinalIgnoreCase))
            {
                throw new VendorInvitationRuleException(
                    InvitationFailureReasons.EmailMismatch,
                    "Invitation email must match the vendor PIC.");
            }

            return requested;
        }

        var identity = await FindIdentityByEmailAsync(email, cancellationToken);
        if (identity is null)
        {
            return null;
        }

        var vendorId = await FindBoundVendorIdAsync(identity.Id, cancellationToken);

        if (string.IsNullOrWhiteSpace(vendorId))
        {
            return null;
        }

        var vendor = await _dbContext.Vendors.FirstOrDefaultAsync(item => item.Id == vendorId, cancellationToken);
        return VendorInvitationReuseRules.Decide(
            identityExists: true,
            hasLogin: identity.HasLogin,
            vendorStatus: vendor?.Status) == VendorInvitationBindAction.ReuseVendor
            ? vendor
            : null;
    }

    private async Task<bool> HasExternalReferenceAsync(string vendorId, CancellationToken cancellationToken)
    {
        return await _dbContext.VendorExternalReferences.AsNoTracking()
            .AnyAsync(item => item.VendorId == vendorId, cancellationToken);
    }

    private async Task EnsurePasswordlessIdentityAsync(
        Vendor vendor,
        string email,
        string picName,
        CancellationToken cancellationToken)
    {
        var identity = await _userManager.FindByIdAsync(vendor.Id)
            ?? await FindWorkspacePicAsync(vendor.Id, cancellationToken);
        if (identity is null)
        {
            var byEmail = await FindIdentityByEmailAsync(email, cancellationToken);
            if (byEmail is not null)
            {
                var ownerVendorId = await FindBoundVendorIdAsync(byEmail.Id, cancellationToken);
                if (!string.IsNullOrWhiteSpace(ownerVendorId)
                    && !string.Equals(ownerVendorId, vendor.Id, StringComparison.OrdinalIgnoreCase))
                {
                    throw new VendorInvitationRuleException(
                        InvitationFailureReasons.EmailRegistered,
                        "Email is already registered.");
                }

                identity = byEmail;
            }
        }

        if (identity is not null)
        {
            if (identity.HasLogin && !VendorStatuses.AllowsOfficerInviteReuse(vendor.Status))
            {
                throw new VendorInvitationRuleException(
                    InvitationFailureReasons.EmailRegistered,
                    "Email is already registered.");
            }

            if (identity.HasLogin && VendorStatuses.AllowsOfficerInviteReuse(vendor.Status))
            {
                identity.HasLogin = false;
            }

            if (!string.Equals(identity.Email, email, StringComparison.OrdinalIgnoreCase))
            {
                throw new VendorInvitationRuleException(
                    InvitationFailureReasons.EmailMismatch,
                    "Invitation email must match the vendor PIC.");
            }

            identity.CompleteName = picName;
            identity.EmailConfirmed = true;
            identity.IsActive = true;
            identity.Status = VendorUserStatuses.Active;
            var update = await _userManager.UpdateAsync(identity);
            if (!update.Succeeded)
            {
                throw new VendorInvitationRuleException(
                    "identity_create_failed",
                    string.Join("; ", update.Errors.Select(error => error.Description)));
            }

            await EnsureVendorUserLinkAsync(vendor.Id, identity.Id, cancellationToken);
            return;
        }

        identity = new VendorIdentityUser
        {
            Id = vendor.Id,
            UserName = email,
            Email = email,
            EmailConfirmed = true,
            CompleteName = picName,
            Status = VendorUserStatuses.Active,
            IsActive = true,
            HasLogin = false
        };

        var create = await _userManager.CreateAsync(identity);
        if (!create.Succeeded)
        {
            throw new VendorInvitationRuleException(
                "identity_create_failed",
                string.Join("; ", create.Errors.Select(error => error.Description)));
        }

        var role = await _userManager.AddToRoleAsync(identity, VendorIdentityRoleNames.Vendor);
        if (!role.Succeeded)
        {
            throw new VendorInvitationRuleException(
                "role_assign_failed",
                string.Join("; ", role.Errors.Select(error => error.Description)));
        }

        await EnsureVendorUserLinkAsync(vendor.Id, identity.Id, cancellationToken);
    }

    private async Task<string?> FindBoundVendorIdAsync(
        string identityUserId,
        CancellationToken cancellationToken)
    {
        var vendorId = await _dbContext.VendorUsers.AsNoTracking()
            .Where(link => link.IdentityUserId == identityUserId)
            .Select(link => link.VendorId)
            .FirstOrDefaultAsync(cancellationToken);
        if (!string.IsNullOrWhiteSpace(vendorId))
        {
            return vendorId;
        }

        return await _dbContext.Vendors.AnyAsync(item => item.Id == identityUserId, cancellationToken)
            ? identityUserId
            : null;
    }

    private async Task EnsureVendorUserLinkAsync(
        string vendorId,
        string identityUserId,
        CancellationToken cancellationToken)
    {
        var exists = await _dbContext.VendorUsers
            .AnyAsync(link => link.VendorId == vendorId && link.IdentityUserId == identityUserId, cancellationToken);
        if (!exists)
        {
            _dbContext.VendorUsers.Add(VendorUser.Create(identityUserId, vendorId, isWorkspacePic: true));
        }
    }

    private async Task<VendorIdentityUser?> FindWorkspacePicAsync(string vendorId, CancellationToken cancellationToken)
    {
        var identityId = await _dbContext.VendorUsers.AsNoTracking()
            .Where(link => link.VendorId == vendorId)
            .OrderByDescending(link => link.IsWorkspacePic)
            .Select(link => link.IdentityUserId)
            .FirstOrDefaultAsync(cancellationToken);
        return identityId is null ? null : await _userManager.FindByIdAsync(identityId);
    }

    private async Task ActivateImportedIdentityAsync(
        VendorIdentityUser identity,
        string password,
        string picName,
        string? position,
        string? phone)
    {
        if (string.IsNullOrEmpty(identity.PasswordHash))
        {
            var addPassword = await _userManager.AddPasswordAsync(identity, password);
            if (!addPassword.Succeeded)
            {
                throw new VendorInvitationRuleException(
                    "identity_create_failed",
                    string.Join("; ", addPassword.Errors.Select(error => error.Description)));
            }
        }
        else
        {
            var token = await _userManager.GeneratePasswordResetTokenAsync(identity);
            var reset = await _userManager.ResetPasswordAsync(identity, token, password);
            if (!reset.Succeeded)
            {
                throw new VendorInvitationRuleException(
                    "identity_create_failed",
                    string.Join("; ", reset.Errors.Select(error => error.Description)));
            }
        }

        identity.EmailConfirmed = true;
        identity.CompleteName = picName;
        identity.Position = string.IsNullOrWhiteSpace(position) ? identity.Position : position.Trim();
        identity.PhoneNumber = string.IsNullOrWhiteSpace(phone) ? identity.PhoneNumber : phone.Trim();
        identity.Status = VendorUserStatuses.Active;
        identity.IsActive = true;
        identity.HasLogin = true;
        var update = await _userManager.UpdateAsync(identity);
        if (!update.Succeeded)
        {
            throw new VendorInvitationRuleException(
                "identity_create_failed",
                string.Join("; ", update.Errors.Select(error => error.Description)));
        }
    }

    private static bool IsInternalCompanyEmail(string email)
    {
        var at = email.LastIndexOf('@');
        if (at < 0 || at == email.Length - 1)
        {
            return false;
        }

        var domain = email[(at + 1)..].Trim().ToLowerInvariant();
        return BlockedInvitationEmailDomains.Any(blocked =>
            domain == blocked || domain.EndsWith("." + blocked, StringComparison.Ordinal));
    }

    private async Task EnsureEmailNotRegisteredAsync(string email, CancellationToken cancellationToken)
    {
        var normalizedEmail = email.ToUpperInvariant();
        var identityUserExists = await _dbContext.Users
            .AnyAsync(user => user.NormalizedEmail == normalizedEmail, cancellationToken);

        if (identityUserExists)
        {
            throw new VendorInvitationRuleException(
                InvitationFailureReasons.EmailRegistered,
                "Email is already registered.");
        }
    }

    private async Task<bool> IsRateLimitedAsync(
        string? email,
        string codeMasked,
        CancellationToken cancellationToken)
    {
        var since = _clock.UtcNow.AddMinutes(-Math.Max(1, _options.FailedAttemptWindowMinutes));
        var failureCount = await _dbContext.InvitationAttempts.CountAsync(attempt =>
            attempt.Result == InvitationAttemptResults.Failure
            && attempt.AttemptedAt >= since
            && ((email != null && attempt.Email == email) || attempt.CodeMasked == codeMasked),
            cancellationToken);

        return failureCount >= Math.Max(1, _options.FailedAttemptLimit);
    }

    private async Task LogAttemptAsync(
        Guid? invitationId,
        string? email,
        string? codeMasked,
        string? ipAddress,
        string? userAgent,
        string reason,
        CancellationToken cancellationToken)
    {
        _dbContext.InvitationAttempts.Add(InvitationAttempt.Failure(
            invitationId,
            email,
            codeMasked,
            ipAddress,
            userAgent,
            reason,
            _clock.UtcNow));

        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    private static string? ValidateInvitationState(
        Invitation? invitation,
        string? email,
        DateTimeOffset now)
    {
        if (invitation is null)
        {
            return InvitationFailureReasons.Invalid;
        }

        if (email is not null && invitation.Email != email)
        {
            return InvitationFailureReasons.EmailMismatch;
        }

        if (invitation.UsedAt.HasValue || invitation.Status == InvitationStatuses.Registered)
        {
            return InvitationFailureReasons.Used;
        }

        if (invitation.Status == InvitationStatuses.Revoked)
        {
            return InvitationFailureReasons.Revoked;
        }

        if (invitation.ExpiredAt <= now || invitation.Status == InvitationStatuses.Expired)
        {
            return InvitationFailureReasons.Expired;
        }

        return null;
    }

    private string BuildRegistrationUrl(string invitationCode)
    {
        var separator = _options.RegistrationUrl.Contains('?', StringComparison.Ordinal) ? '&' : '?';
        return $"{_options.RegistrationUrl}{separator}invite={Uri.EscapeDataString(invitationCode)}";
    }

    private async Task<IDbContextTransaction?> BeginTransactionIfRelationalAsync(
        CancellationToken cancellationToken)
    {
        return _dbContext.Database.IsRelational()
            ? await _dbContext.Database.BeginTransactionAsync(cancellationToken)
            : null;
    }

    private static InvitationDto ToDto(Invitation invitation, DateTimeOffset now)
    {
        return new InvitationDto(
            invitation.Id,
            invitation.CodeMasked,
            invitation.Email,
            invitation.VendorName,
            invitation.PicName,
            invitation.Category,
            invitation.VendorId,
            invitation.ExpiredAt,
            invitation.UsedAt,
            invitation.UsedBy,
            EffectiveStatus(invitation, now),
            invitation.Note,
            invitation.CreatedAt,
            invitation.CreatedBy);
    }

    private static string EffectiveStatus(Invitation invitation, DateTimeOffset now)
    {
        if (invitation.Status is InvitationStatuses.Registered or InvitationStatuses.Revoked)
        {
            return invitation.Status;
        }

        return invitation.ExpiredAt <= now ? InvitationStatuses.Expired : invitation.Status;
    }

    private static string NormalizeEmail(string email)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(email);
        return email.Trim().ToLowerInvariant();
    }
}
