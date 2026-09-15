IF OBJECT_ID(N'[__EFMigrationsHistory]') IS NULL
BEGIN
    CREATE TABLE [__EFMigrationsHistory] (
        [MigrationId] nvarchar(150) NOT NULL,
        [ProductVersion] nvarchar(32) NOT NULL,
        CONSTRAINT [PK___EFMigrationsHistory] PRIMARY KEY ([MigrationId])
    );
END;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260622011116_InitialIdentityAndVendorFoundation'
)
BEGIN
    CREATE TABLE [INTERNAL_ROLE_T] (
        [ID] uniqueidentifier NOT NULL,
        [CODE] nvarchar(100) NOT NULL,
        [NAME] nvarchar(200) NOT NULL,
        [MODULE_KEY] nvarchar(100) NULL,
        [IS_SYSTEM] bit NOT NULL,
        [CREATED_AT] datetimeoffset NOT NULL DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [PK_INTERNAL_ROLE_T] PRIMARY KEY ([ID])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260622011116_InitialIdentityAndVendorFoundation'
)
BEGIN
    CREATE TABLE [PERMISSION_T] (
        [ID] uniqueidentifier NOT NULL,
        [KEY] nvarchar(200) NOT NULL,
        [MODULE_KEY] nvarchar(100) NOT NULL,
        [NAME] nvarchar(200) NOT NULL,
        [DESCRIPTION] nvarchar(500) NULL,
        CONSTRAINT [PK_PERMISSION_T] PRIMARY KEY ([ID])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260622011116_InitialIdentityAndVendorFoundation'
)
BEGIN
    CREATE TABLE [ROLES_T] (
        [ID] uniqueidentifier NOT NULL,
        [NAME] nvarchar(256) NULL,
        [NORMALIZED_NAME] nvarchar(256) NULL,
        [CONCURRENCY_STAMP] nvarchar(max) NULL,
        CONSTRAINT [PK_ROLES_T] PRIMARY KEY ([ID])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260622011116_InitialIdentityAndVendorFoundation'
)
BEGIN
    CREATE TABLE [SSO_NRP_MAPPING_T] (
        [ID] uniqueidentifier NOT NULL,
        [NRP] nvarchar(20) NOT NULL,
        [PERSONNEL_NO] nvarchar(20) NOT NULL,
        [DISPLAY_NAME] nvarchar(200) NULL,
        [STATUS] nvarchar(32) NOT NULL,
        [CREATED_AT] datetimeoffset NOT NULL DEFAULT (SYSUTCDATETIME()),
        [UPDATED_AT] datetimeoffset NULL,
        CONSTRAINT [PK_SSO_NRP_MAPPING_T] PRIMARY KEY ([ID]),
        CONSTRAINT [CK_SSO_NRP_MAPPING_T_STATUS] CHECK ([STATUS] IN ('Active','Inactive'))
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260622011116_InitialIdentityAndVendorFoundation'
)
BEGIN
    CREATE TABLE [USER_T] (
        [ID] uniqueidentifier NOT NULL,
        [PERSONNEL_NO] nvarchar(20) NOT NULL,
        [DISPLAY_NAME] nvarchar(200) NOT NULL,
        [EMAIL] nvarchar(256) NULL,
        [DEPARTMENT] nvarchar(100) NULL,
        [POSITION] nvarchar(100) NULL,
        [STATUS] nvarchar(32) NOT NULL,
        [CREATED_AT] datetimeoffset NOT NULL,
        [CREATED_BY] nvarchar(100) NULL,
        [UPDATED_AT] datetimeoffset NULL,
        [UPDATED_BY] nvarchar(100) NULL,
        [DELETED_AT] datetimeoffset NULL,
        [DELETED_BY] nvarchar(100) NULL,
        CONSTRAINT [PK_USER_T] PRIMARY KEY ([ID]),
        CONSTRAINT [CK_USER_T_STATUS] CHECK ([STATUS] IN ('Active','Inactive'))
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260622011116_InitialIdentityAndVendorFoundation'
)
BEGIN
    CREATE TABLE [USERS_T] (
        [ID] uniqueidentifier NOT NULL,
        [FULL_NAME] nvarchar(200) NOT NULL,
        [STATUS] nvarchar(32) NOT NULL,
        [USER_NAME] nvarchar(256) NULL,
        [NORMALIZED_USER_NAME] nvarchar(256) NULL,
        [EMAIL] nvarchar(256) NULL,
        [NORMALIZED_EMAIL] nvarchar(256) NULL,
        [EMAIL_CONFIRMED] bit NOT NULL,
        [PASSWORD_HASH] nvarchar(max) NULL,
        [SECURITY_STAMP] nvarchar(max) NULL,
        [CONCURRENCY_STAMP] nvarchar(max) NULL,
        [PHONE_NUMBER] nvarchar(max) NULL,
        [PHONE_NUMBER_CONFIRMED] bit NOT NULL,
        [TWO_FACTOR_ENABLED] bit NOT NULL,
        [LOCKOUT_END] datetimeoffset NULL,
        [LOCKOUT_ENABLED] bit NOT NULL,
        [ACCESS_FAILED_COUNT] int NOT NULL,
        CONSTRAINT [PK_USERS_T] PRIMARY KEY ([ID])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260622011116_InitialIdentityAndVendorFoundation'
)
BEGIN
    CREATE TABLE [VENDOR_T] (
        [ID] uniqueidentifier NOT NULL,
        [NAME] nvarchar(250) NOT NULL,
        [STATUS] nvarchar(32) NOT NULL,
        [CATEGORY] nvarchar(100) NULL,
        [NPWP] nvarchar(100) NULL,
        [NIB] nvarchar(100) NULL,
        [ADDRESS] nvarchar(1000) NULL,
        [CREATED_AT] datetimeoffset NOT NULL,
        [CREATED_BY] nvarchar(100) NULL,
        [UPDATED_AT] datetimeoffset NULL,
        [UPDATED_BY] nvarchar(100) NULL,
        [DELETED_AT] datetimeoffset NULL,
        [DELETED_BY] nvarchar(100) NULL,
        CONSTRAINT [PK_VENDOR_T] PRIMARY KEY ([ID]),
        CONSTRAINT [CK_VENDOR_T_STATUS] CHECK ([STATUS] IN ('Active','Inactive','Suspended'))
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260622011116_InitialIdentityAndVendorFoundation'
)
BEGIN
    CREATE TABLE [INTERNAL_ROLE_PERMISSION_T] (
        [ID] uniqueidentifier NOT NULL,
        [ROLE_ID] uniqueidentifier NOT NULL,
        [PERMISSION_ID] uniqueidentifier NOT NULL,
        CONSTRAINT [PK_INTERNAL_ROLE_PERMISSION_T] PRIMARY KEY ([ID]),
        CONSTRAINT [FK_INTERNAL_ROLE_PERMISSION_T_INTERNAL_ROLE_T_ROLE_ID] FOREIGN KEY ([ROLE_ID]) REFERENCES [INTERNAL_ROLE_T] ([ID]) ON DELETE NO ACTION,
        CONSTRAINT [FK_INTERNAL_ROLE_PERMISSION_T_PERMISSION_T_PERMISSION_ID] FOREIGN KEY ([PERMISSION_ID]) REFERENCES [PERMISSION_T] ([ID]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260622011116_InitialIdentityAndVendorFoundation'
)
BEGIN
    CREATE TABLE [ROLE_CLAIMS_T] (
        [ID] int NOT NULL IDENTITY,
        [ROLE_ID] uniqueidentifier NOT NULL,
        [CLAIM_TYPE] nvarchar(max) NULL,
        [CLAIM_VALUE] nvarchar(max) NULL,
        CONSTRAINT [PK_ROLE_CLAIMS_T] PRIMARY KEY ([ID]),
        CONSTRAINT [FK_ROLE_CLAIMS_T_ROLES_T_ROLE_ID] FOREIGN KEY ([ROLE_ID]) REFERENCES [ROLES_T] ([ID]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260622011116_InitialIdentityAndVendorFoundation'
)
BEGIN
    CREATE TABLE [INTERNAL_USER_ROLE_T] (
        [ID] uniqueidentifier NOT NULL,
        [USER_ID] uniqueidentifier NOT NULL,
        [ROLE_ID] uniqueidentifier NOT NULL,
        [CREATED_AT] datetimeoffset NOT NULL DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [PK_INTERNAL_USER_ROLE_T] PRIMARY KEY ([ID]),
        CONSTRAINT [FK_INTERNAL_USER_ROLE_T_INTERNAL_ROLE_T_ROLE_ID] FOREIGN KEY ([ROLE_ID]) REFERENCES [INTERNAL_ROLE_T] ([ID]) ON DELETE NO ACTION,
        CONSTRAINT [FK_INTERNAL_USER_ROLE_T_USER_T_USER_ID] FOREIGN KEY ([USER_ID]) REFERENCES [USER_T] ([ID]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260622011116_InitialIdentityAndVendorFoundation'
)
BEGIN
    CREATE TABLE [USER_CLAIMS_T] (
        [ID] int NOT NULL IDENTITY,
        [USER_ID] uniqueidentifier NOT NULL,
        [CLAIM_TYPE] nvarchar(max) NULL,
        [CLAIM_VALUE] nvarchar(max) NULL,
        CONSTRAINT [PK_USER_CLAIMS_T] PRIMARY KEY ([ID]),
        CONSTRAINT [FK_USER_CLAIMS_T_USERS_T_USER_ID] FOREIGN KEY ([USER_ID]) REFERENCES [USERS_T] ([ID]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260622011116_InitialIdentityAndVendorFoundation'
)
BEGIN
    CREATE TABLE [USER_LOGINS_T] (
        [LOGIN_PROVIDER] nvarchar(450) NOT NULL,
        [PROVIDER_KEY] nvarchar(450) NOT NULL,
        [PROVIDER_DISPLAY_NAME] nvarchar(max) NULL,
        [USER_ID] uniqueidentifier NOT NULL,
        CONSTRAINT [PK_USER_LOGINS_T] PRIMARY KEY ([LOGIN_PROVIDER], [PROVIDER_KEY]),
        CONSTRAINT [FK_USER_LOGINS_T_USERS_T_USER_ID] FOREIGN KEY ([USER_ID]) REFERENCES [USERS_T] ([ID]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260622011116_InitialIdentityAndVendorFoundation'
)
BEGIN
    CREATE TABLE [USER_ROLES_T] (
        [USER_ID] uniqueidentifier NOT NULL,
        [ROLE_ID] uniqueidentifier NOT NULL,
        CONSTRAINT [PK_USER_ROLES_T] PRIMARY KEY ([USER_ID], [ROLE_ID]),
        CONSTRAINT [FK_USER_ROLES_T_ROLES_T_ROLE_ID] FOREIGN KEY ([ROLE_ID]) REFERENCES [ROLES_T] ([ID]) ON DELETE CASCADE,
        CONSTRAINT [FK_USER_ROLES_T_USERS_T_USER_ID] FOREIGN KEY ([USER_ID]) REFERENCES [USERS_T] ([ID]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260622011116_InitialIdentityAndVendorFoundation'
)
BEGIN
    CREATE TABLE [USER_TOKENS_T] (
        [USER_ID] uniqueidentifier NOT NULL,
        [LOGIN_PROVIDER] nvarchar(450) NOT NULL,
        [NAME] nvarchar(450) NOT NULL,
        [VALUE] nvarchar(max) NULL,
        CONSTRAINT [PK_USER_TOKENS_T] PRIMARY KEY ([USER_ID], [LOGIN_PROVIDER], [NAME]),
        CONSTRAINT [FK_USER_TOKENS_T_USERS_T_USER_ID] FOREIGN KEY ([USER_ID]) REFERENCES [USERS_T] ([ID]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260622011116_InitialIdentityAndVendorFoundation'
)
BEGIN
    CREATE TABLE [VENDOR_USER_T] (
        [ID] uniqueidentifier NOT NULL,
        [IDENTITY_USER_ID] uniqueidentifier NOT NULL,
        [VENDOR_ID] uniqueidentifier NOT NULL,
        [NAME] nvarchar(200) NOT NULL,
        [EMAIL] nvarchar(256) NOT NULL,
        [PHONE] nvarchar(50) NULL,
        [POSITION] nvarchar(100) NULL,
        [STATUS] nvarchar(32) NOT NULL,
        [CREATED_AT] datetimeoffset NOT NULL,
        [CREATED_BY] nvarchar(100) NULL,
        [UPDATED_AT] datetimeoffset NULL,
        [UPDATED_BY] nvarchar(100) NULL,
        [DELETED_AT] datetimeoffset NULL,
        [DELETED_BY] nvarchar(100) NULL,
        CONSTRAINT [PK_VENDOR_USER_T] PRIMARY KEY ([ID]),
        CONSTRAINT [CK_VENDOR_USER_T_STATUS] CHECK ([STATUS] IN ('Active','Inactive','Suspended')),
        CONSTRAINT [FK_VENDOR_USER_T_USERS_T_IDENTITY_USER_ID] FOREIGN KEY ([IDENTITY_USER_ID]) REFERENCES [USERS_T] ([ID]) ON DELETE NO ACTION,
        CONSTRAINT [FK_VENDOR_USER_T_VENDOR_T_VENDOR_ID] FOREIGN KEY ([VENDOR_ID]) REFERENCES [VENDOR_T] ([ID]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260622011116_InitialIdentityAndVendorFoundation'
)
BEGIN
    CREATE TABLE [INVITATION_T] (
        [ID] uniqueidentifier NOT NULL,
        [CODE_HASH] nvarchar(512) NOT NULL,
        [CODE_MASKED] nvarchar(50) NOT NULL,
        [EMAIL] nvarchar(256) NOT NULL,
        [VENDOR_NAME] nvarchar(250) NOT NULL,
        [PIC_NAME] nvarchar(200) NOT NULL,
        [CATEGORY] nvarchar(100) NULL,
        [VENDOR_ID] uniqueidentifier NULL,
        [EXPIRED_AT] datetimeoffset NOT NULL,
        [USED_AT] datetimeoffset NULL,
        [USED_BY] uniqueidentifier NULL,
        [STATUS] nvarchar(32) NOT NULL,
        [NOTE] nvarchar(1000) NULL,
        [CREATED_AT] datetimeoffset NOT NULL,
        [CREATED_BY] nvarchar(100) NOT NULL,
        [UPDATED_AT] datetimeoffset NULL,
        [UPDATED_BY] nvarchar(100) NULL,
        CONSTRAINT [PK_INVITATION_T] PRIMARY KEY ([ID]),
        CONSTRAINT [CK_INVITATION_T_STATUS] CHECK ([STATUS] IN ('Draft','Sent','Opened','Registered','Expired','Revoked')),
        CONSTRAINT [FK_INVITATION_T_VENDOR_T_VENDOR_ID] FOREIGN KEY ([VENDOR_ID]) REFERENCES [VENDOR_T] ([ID]) ON DELETE NO ACTION,
        CONSTRAINT [FK_INVITATION_T_VENDOR_USER_T_USED_BY] FOREIGN KEY ([USED_BY]) REFERENCES [VENDOR_USER_T] ([ID]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260622011116_InitialIdentityAndVendorFoundation'
)
BEGIN
    CREATE TABLE [INVITATION_ATTEMPT_T] (
        [ID] uniqueidentifier NOT NULL,
        [INVITATION_ID] uniqueidentifier NULL,
        [EMAIL] nvarchar(256) NULL,
        [CODE_MASKED] nvarchar(50) NULL,
        [IP_ADDRESS] nvarchar(64) NULL,
        [USER_AGENT] nvarchar(1000) NULL,
        [RESULT] nvarchar(32) NOT NULL,
        [REASON] nvarchar(200) NULL,
        [ATTEMPTED_AT] datetimeoffset NOT NULL,
        CONSTRAINT [PK_INVITATION_ATTEMPT_T] PRIMARY KEY ([ID]),
        CONSTRAINT [CK_INVITATION_ATTEMPT_T_RESULT] CHECK ([RESULT] IN ('Success','Failure')),
        CONSTRAINT [FK_INVITATION_ATTEMPT_T_INVITATION_T_INVITATION_ID] FOREIGN KEY ([INVITATION_ID]) REFERENCES [INVITATION_T] ([ID]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260622011116_InitialIdentityAndVendorFoundation'
)
BEGIN
    IF EXISTS (SELECT * FROM [sys].[identity_columns] WHERE [name] IN (N'ID', N'CONCURRENCY_STAMP', N'NAME', N'NORMALIZED_NAME') AND [object_id] = OBJECT_ID(N'[ROLES_T]'))
        SET IDENTITY_INSERT [ROLES_T] ON;
    EXEC(N'INSERT INTO [ROLES_T] ([ID], [CONCURRENCY_STAMP], [NAME], [NORMALIZED_NAME])
    VALUES (''11e7258d-f4dc-474a-8b75-4a30af234b1f'', N''phase4-vendor-admin'', N''VENDOR_ADMIN'', N''VENDOR_ADMIN''),
    (''53cbe5b7-f1f8-4f64-9fb4-2e3f8a49b774'', N''phase4-vendor-user'', N''VENDOR_USER'', N''VENDOR_USER'')');
    IF EXISTS (SELECT * FROM [sys].[identity_columns] WHERE [name] IN (N'ID', N'CONCURRENCY_STAMP', N'NAME', N'NORMALIZED_NAME') AND [object_id] = OBJECT_ID(N'[ROLES_T]'))
        SET IDENTITY_INSERT [ROLES_T] OFF;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260622011116_InitialIdentityAndVendorFoundation'
)
BEGIN
    CREATE INDEX [IX_INTERNAL_ROLE_PERMISSION_T_PERMISSION_ID] ON [INTERNAL_ROLE_PERMISSION_T] ([PERMISSION_ID]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260622011116_InitialIdentityAndVendorFoundation'
)
BEGIN
    CREATE UNIQUE INDEX [IX_INTERNAL_ROLE_PERMISSION_T_ROLE_ID_PERMISSION_ID] ON [INTERNAL_ROLE_PERMISSION_T] ([ROLE_ID], [PERMISSION_ID]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260622011116_InitialIdentityAndVendorFoundation'
)
BEGIN
    CREATE UNIQUE INDEX [IX_INTERNAL_ROLE_T_CODE] ON [INTERNAL_ROLE_T] ([CODE]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260622011116_InitialIdentityAndVendorFoundation'
)
BEGIN
    CREATE INDEX [IX_INTERNAL_USER_ROLE_T_ROLE_ID] ON [INTERNAL_USER_ROLE_T] ([ROLE_ID]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260622011116_InitialIdentityAndVendorFoundation'
)
BEGIN
    CREATE UNIQUE INDEX [IX_INTERNAL_USER_ROLE_T_USER_ID_ROLE_ID] ON [INTERNAL_USER_ROLE_T] ([USER_ID], [ROLE_ID]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260622011116_InitialIdentityAndVendorFoundation'
)
BEGIN
    CREATE INDEX [IX_INVITATION_ATTEMPT_T_ATTEMPTED_AT] ON [INVITATION_ATTEMPT_T] ([ATTEMPTED_AT]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260622011116_InitialIdentityAndVendorFoundation'
)
BEGIN
    CREATE INDEX [IX_INVITATION_ATTEMPT_T_EMAIL] ON [INVITATION_ATTEMPT_T] ([EMAIL]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260622011116_InitialIdentityAndVendorFoundation'
)
BEGIN
    CREATE INDEX [IX_INVITATION_ATTEMPT_T_INVITATION_ID] ON [INVITATION_ATTEMPT_T] ([INVITATION_ID]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260622011116_InitialIdentityAndVendorFoundation'
)
BEGIN
    CREATE UNIQUE INDEX [IX_INVITATION_T_CODE_HASH] ON [INVITATION_T] ([CODE_HASH]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260622011116_InitialIdentityAndVendorFoundation'
)
BEGIN
    EXEC(N'CREATE UNIQUE INDEX [IX_INVITATION_T_EMAIL] ON [INVITATION_T] ([EMAIL]) WHERE [USED_AT] IS NULL AND [STATUS] IN (''Draft'',''Sent'',''Opened'')');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260622011116_InitialIdentityAndVendorFoundation'
)
BEGIN
    CREATE INDEX [IX_INVITATION_T_USED_BY] ON [INVITATION_T] ([USED_BY]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260622011116_InitialIdentityAndVendorFoundation'
)
BEGIN
    CREATE INDEX [IX_INVITATION_T_VENDOR_ID] ON [INVITATION_T] ([VENDOR_ID]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260622011116_InitialIdentityAndVendorFoundation'
)
BEGIN
    CREATE UNIQUE INDEX [IX_PERMISSION_T_KEY] ON [PERMISSION_T] ([KEY]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260622011116_InitialIdentityAndVendorFoundation'
)
BEGIN
    CREATE INDEX [IX_ROLE_CLAIMS_T_ROLE_ID] ON [ROLE_CLAIMS_T] ([ROLE_ID]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260622011116_InitialIdentityAndVendorFoundation'
)
BEGIN
    EXEC(N'CREATE UNIQUE INDEX [ROLE_NAME_INDEX] ON [ROLES_T] ([NORMALIZED_NAME]) WHERE [NORMALIZED_NAME] IS NOT NULL');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260622011116_InitialIdentityAndVendorFoundation'
)
BEGIN
    CREATE UNIQUE INDEX [IX_SSO_NRP_MAPPING_T_NRP] ON [SSO_NRP_MAPPING_T] ([NRP]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260622011116_InitialIdentityAndVendorFoundation'
)
BEGIN
    CREATE INDEX [IX_SSO_NRP_MAPPING_T_PERSONNEL_NO] ON [SSO_NRP_MAPPING_T] ([PERSONNEL_NO]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260622011116_InitialIdentityAndVendorFoundation'
)
BEGIN
    CREATE INDEX [IX_USER_CLAIMS_T_USER_ID] ON [USER_CLAIMS_T] ([USER_ID]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260622011116_InitialIdentityAndVendorFoundation'
)
BEGIN
    CREATE INDEX [IX_USER_LOGINS_T_USER_ID] ON [USER_LOGINS_T] ([USER_ID]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260622011116_InitialIdentityAndVendorFoundation'
)
BEGIN
    CREATE INDEX [IX_USER_ROLES_T_ROLE_ID] ON [USER_ROLES_T] ([ROLE_ID]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260622011116_InitialIdentityAndVendorFoundation'
)
BEGIN
    EXEC(N'CREATE UNIQUE INDEX [IX_USER_T_PERSONNEL_NO] ON [USER_T] ([PERSONNEL_NO]) WHERE [DELETED_AT] IS NULL');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260622011116_InitialIdentityAndVendorFoundation'
)
BEGIN
    CREATE INDEX [IX_USERS_T_NORMALIZED_EMAIL] ON [USERS_T] ([NORMALIZED_EMAIL]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260622011116_InitialIdentityAndVendorFoundation'
)
BEGIN
    EXEC(N'CREATE UNIQUE INDEX [USER_NAME_INDEX] ON [USERS_T] ([NORMALIZED_USER_NAME]) WHERE [NORMALIZED_USER_NAME] IS NOT NULL');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260622011116_InitialIdentityAndVendorFoundation'
)
BEGIN
    EXEC(N'CREATE UNIQUE INDEX [IX_VENDOR_USER_T_EMAIL] ON [VENDOR_USER_T] ([EMAIL]) WHERE [DELETED_AT] IS NULL');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260622011116_InitialIdentityAndVendorFoundation'
)
BEGIN
    CREATE UNIQUE INDEX [IX_VENDOR_USER_T_IDENTITY_USER_ID] ON [VENDOR_USER_T] ([IDENTITY_USER_ID]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260622011116_InitialIdentityAndVendorFoundation'
)
BEGIN
    CREATE INDEX [IX_VENDOR_USER_T_VENDOR_ID] ON [VENDOR_USER_T] ([VENDOR_ID]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260622011116_InitialIdentityAndVendorFoundation'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260622011116_InitialIdentityAndVendorFoundation', N'10.0.9');
END;

COMMIT;
GO

