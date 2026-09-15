SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

-- SISWarrior access-check contract (security-team spec): the portal calls this function
-- with the user's NRP and expects N'true' / N'false'.
--
-- NRP and PersonnelNo are the SAME value ("NRP" is the former name of PersonnelNo — an
-- 8-digit numeric identifier that may carry leading zeros, e.g. '00109610'). So the check
-- is a direct lookup on iam.USER_T by PersonnelNo, matching the runtime gate in
-- InternalUserAccessService.MapNrpAsync. No NRP↔PersonnelNo mapping table is involved.
--
-- Deployment: ships via EF migration 20260709014500_SimplifyCekUserAccessFnToDirectLookup
-- (supersedes 20260708075412_AddCekUserAccessFn). This script is the ops reference copy;
-- keep the two in sync.
CREATE OR ALTER FUNCTION [dbo].[CEK_USER_ACCESS_FN]
(
    @NRP nvarchar(20)
)
RETURNS nvarchar(20)
AS
BEGIN
    DECLARE @retValue nvarchar(20) = N'false';

    SELECT @retValue =
        CASE
            WHEN COUNT(*) > 0 THEN N'true'
            ELSE N'false'
        END
    FROM [iam].[USER_T]
    WHERE [DeletedAt] IS NULL
        AND [Status] = N'Active'
        AND [PersonnelNo] = @NRP;

    RETURN @retValue;
END
GO
