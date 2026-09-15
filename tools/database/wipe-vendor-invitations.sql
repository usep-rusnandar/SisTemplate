-- Wipe Vendor Invitation test data only (Production-safe).
-- KEEP: IAM, master data, settings, Vendor Connect / Ariba imported vendors
--       (rows in vdr.VENDOR_EXTERNAL_REFERENCE_T), Tracker, CIP, CM,
--       identity roles (vdr.ROLES_T), session cache, VENDOR_CONNECT_DB.
-- REMOVE: all vdr.INVITATION_T / INVITATION_ATTEMPT_T rows; vendors created or
--         registered from those invitations (no external reference); their
--         child rows, identity users, invitation-related emails / notifications
--         / audit. Invitation emails redirected to a test inbox are matched via
--         the original address stored in EMAIL_SENT_T.PayloadJson.
-- Does NOT delete Azure Blob bytes (Production uses Managed Identity). Document
-- blob keys are printed before SQL delete so leftovers can be cleaned later.
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;

SELECT
    DB_NAME() AS [Database],
    @@SERVERNAME AS [Server],
    SYSUTCDATETIME() AS [UtcNow];

IF OBJECT_ID(N'vdr.INVITATION_T', N'U') IS NULL
    OR OBJECT_ID(N'vdr.VENDOR_T', N'U') IS NULL
BEGIN
    RAISERROR(N'ABORT: vendor invitation tables are missing.', 16, 1);
    RETURN;
END;

DECLARE @counts TABLE (
    Phase nvarchar(10) NOT NULL,
    SchemaName sysname NOT NULL,
    TableName sysname NOT NULL,
    RowCountInt int NOT NULL
);

INSERT INTO @counts
SELECT 'before', s.name, t.name, SUM(p.rows)
FROM sys.tables t
JOIN sys.schemas s ON s.schema_id = t.schema_id
JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0, 1)
WHERE (s.name = N'vdr' AND t.name IN (
        N'INVITATION_T',
        N'INVITATION_ATTEMPT_T',
        N'VENDOR_T',
        N'VENDOR_USER_T',
        N'VENDOR_DOCUMENT_T',
        N'VENDOR_STATUS_T',
        N'VENDOR_CERTIFICATE_T',
        N'VENDOR_KBLI_T',
        N'VENDOR_BRAND_T',
        N'VENDOR_PORTFOLIO_T',
        N'VENDOR_SPECIAL_REQUIREMENT_T',
        N'VENDOR_SUBCLASSIFICATION_T',
        N'VENDOR_EXTERNAL_REFERENCE_T',
        N'VENDOR_IMPORT_ROW_T',
        N'USERS_T',
        N'USER_ROLES_T',
        N'USER_CLAIMS_T',
        N'USER_LOGINS_T',
        N'USER_TOKENS_T'))
   OR (s.name = N'core' AND t.name IN (
        N'EMAIL_SENT_T',
        N'NOTIFICATION_T',
        N'NOTIFICATION_RECIPIENT_STATE_T',
        N'AUDIT_LOG_T'))
GROUP BY s.name, t.name;

DECLARE @invitations TABLE (
    InvitationId uniqueidentifier NOT NULL PRIMARY KEY,
    Email nvarchar(256) NOT NULL,
    VendorName nvarchar(250) NOT NULL,
    Status nvarchar(32) NOT NULL,
    VendorId nvarchar(10) NULL,
    UsedBy uniqueidentifier NULL,
    CreatedAt datetimeoffset NOT NULL
);

INSERT INTO @invitations (InvitationId, Email, VendorName, Status, VendorId, UsedBy, CreatedAt)
SELECT
    i.InvitationId,
    i.Email,
    i.VendorName,
    i.Status,
    i.VendorId,
    i.UsedBy,
    i.CreatedAt
FROM vdr.INVITATION_T AS i;

SELECT
    InvitationId,
    Email,
    VendorName,
    Status,
    VendorId,
    UsedBy,
    CreatedAt
FROM @invitations
ORDER BY CreatedAt, Email;

DECLARE @candidateVendors TABLE (
    VendorId nvarchar(10) NOT NULL PRIMARY KEY,
    Source nvarchar(40) NOT NULL
);

INSERT INTO @candidateVendors (VendorId, Source)
SELECT VendorId, MIN(Source)
FROM (
    SELECT i.VendorId, N'invitation.VendorId' AS Source
    FROM @invitations AS i
    WHERE i.VendorId IS NOT NULL AND LTRIM(RTRIM(i.VendorId)) <> N''
    UNION ALL
    SELECT vu.VendorId, N'invitation.UsedBy'
    FROM @invitations AS inv
    INNER JOIN vdr.VENDOR_USER_T AS vu ON vu.VendorUserId = inv.UsedBy
    WHERE inv.UsedBy IS NOT NULL
    UNION ALL
    SELECT v.VendorId, N'status.INVTD/RSPND'
    FROM vdr.VENDOR_T AS v
    WHERE v.Status IN (N'INVTD', N'RSPND')
      AND NOT EXISTS (
            SELECT 1
            FROM vdr.VENDOR_EXTERNAL_REFERENCE_T AS xr
            WHERE xr.VendorId = v.VendorId)
) AS src
GROUP BY VendorId;

DECLARE @vendorDecision TABLE (
    VendorId nvarchar(10) NOT NULL PRIMARY KEY,
    VendorName nvarchar(250) NULL,
    Status nvarchar(10) NULL,
    Decision nvarchar(10) NOT NULL,
    Reason nvarchar(80) NOT NULL,
    HasExternalRef bit NOT NULL
);

INSERT INTO @vendorDecision (VendorId, VendorName, Status, Decision, Reason, HasExternalRef)
SELECT
    c.VendorId,
    v.VendorName,
    v.Status,
    CASE
        WHEN EXISTS (
            SELECT 1
            FROM vdr.VENDOR_EXTERNAL_REFERENCE_T AS xr
            WHERE xr.VendorId = c.VendorId)
            THEN N'KEEP'
        ELSE N'DELETE'
    END,
    CASE
        WHEN EXISTS (
            SELECT 1
            FROM vdr.VENDOR_EXTERNAL_REFERENCE_T AS xr
            WHERE xr.VendorId = c.VendorId)
            THEN N'external-reference'
        ELSE c.Source
    END,
    CASE
        WHEN EXISTS (
            SELECT 1
            FROM vdr.VENDOR_EXTERNAL_REFERENCE_T AS xr
            WHERE xr.VendorId = c.VendorId)
            THEN 1
        ELSE 0
    END
FROM @candidateVendors AS c
LEFT JOIN vdr.VENDOR_T AS v ON v.VendorId = c.VendorId;

SELECT
    VendorId,
    VendorName,
    Status,
    Decision,
    Reason,
    HasExternalRef
FROM @vendorDecision
ORDER BY Decision, VendorId;

DECLARE @deleteVendors TABLE (VendorId nvarchar(10) NOT NULL PRIMARY KEY);
INSERT INTO @deleteVendors (VendorId)
SELECT VendorId FROM @vendorDecision WHERE Decision = N'DELETE';

DECLARE @keepVendors TABLE (VendorId nvarchar(10) NOT NULL PRIMARY KEY);
INSERT INTO @keepVendors (VendorId)
SELECT VendorId FROM @vendorDecision WHERE Decision = N'KEEP';

IF OBJECT_ID(N'vdr.VENDOR_DOCUMENT_T', N'U') IS NOT NULL
BEGIN
    SELECT
        d.VendorId,
        d.DocumentType,
        d.OwnerKey,
        d.FileName,
        d.BlobContainer,
        d.BlobKey
    FROM vdr.VENDOR_DOCUMENT_T AS d
    INNER JOIN @deleteVendors AS dv ON dv.VendorId = d.VendorId
    ORDER BY d.VendorId, d.DocumentType, d.OwnerKey;
END;

DECLARE @blocked TABLE (
    SchemaName sysname NOT NULL,
    TableName sysname NOT NULL,
    VendorId nvarchar(100) NOT NULL
);

IF OBJECT_ID(N'trk.LOA_DOCUMENT_T', N'U') IS NOT NULL
    INSERT INTO @blocked (SchemaName, TableName, VendorId)
    SELECT DISTINCT N'trk', N'LOA_DOCUMENT_T', loa.VendorId
    FROM trk.LOA_DOCUMENT_T AS loa
    INNER JOIN @deleteVendors AS dv ON dv.VendorId = loa.VendorId;

IF OBJECT_ID(N'trk.AWARD_RESULT_VENDOR_T', N'U') IS NOT NULL
    INSERT INTO @blocked (SchemaName, TableName, VendorId)
    SELECT DISTINCT N'trk', N'AWARD_RESULT_VENDOR_T', arv.VendorId
    FROM trk.AWARD_RESULT_VENDOR_T AS arv
    INNER JOIN @deleteVendors AS dv ON dv.VendorId = arv.VendorId;

IF OBJECT_ID(N'cip.CASE_T', N'U') IS NOT NULL
    INSERT INTO @blocked (SchemaName, TableName, VendorId)
    SELECT DISTINCT N'cip', N'CASE_T', c.VendorId
    FROM cip.CASE_T AS c
    INNER JOIN @deleteVendors AS dv ON dv.VendorId = c.VendorId;

IF EXISTS (SELECT 1 FROM @blocked)
BEGIN
    SELECT SchemaName, TableName, VendorId
    FROM @blocked
    ORDER BY SchemaName, TableName, VendorId;
    RAISERROR(N'ABORT: invitation vendors are referenced by Tracker/CIP. Refusing to delete.', 16, 1);
END;

DECLARE @identityUsers TABLE (UserId nvarchar(10) NOT NULL PRIMARY KEY);

INSERT INTO @identityUsers (UserId)
SELECT DISTINCT IdentityUserId
FROM vdr.VENDOR_USER_T AS vu
INNER JOIN @deleteVendors AS dv ON dv.VendorId = vu.VendorId
WHERE vu.IdentityUserId IS NOT NULL AND LTRIM(RTRIM(vu.IdentityUserId)) <> N''
UNION
SELECT dv.VendorId
FROM @deleteVendors AS dv
INNER JOIN vdr.USERS_T AS u ON u.Id = dv.VendorId;

DECLARE @emails TABLE (Email nvarchar(256) NOT NULL PRIMARY KEY);

INSERT INTO @emails (Email)
SELECT DISTINCT LOWER(LTRIM(RTRIM(inv.Email)))
FROM @invitations AS inv
WHERE inv.Email IS NOT NULL AND LTRIM(RTRIM(inv.Email)) <> N''
UNION
SELECT DISTINCT LOWER(LTRIM(RTRIM(u.Email)))
FROM vdr.USERS_T AS u
INNER JOIN @identityUsers AS iu ON iu.UserId = u.Id
WHERE u.Email IS NOT NULL AND LTRIM(RTRIM(u.Email)) <> N'';

BEGIN TRAN;

IF OBJECT_ID(N'vdr.INVITATION_ATTEMPT_T', N'U') IS NOT NULL
    DELETE FROM vdr.INVITATION_ATTEMPT_T;

DELETE FROM vdr.INVITATION_T;

IF OBJECT_ID(N'vdr.VENDOR_IMPORT_ROW_T', N'U') IS NOT NULL
    UPDATE r
    SET r.VendorId = NULL
    FROM vdr.VENDOR_IMPORT_ROW_T AS r
    INNER JOIN @deleteVendors AS dv ON dv.VendorId = r.VendorId;

IF OBJECT_ID(N'vdr.VENDOR_DOCUMENT_T', N'U') IS NOT NULL
    DELETE d FROM vdr.VENDOR_DOCUMENT_T AS d INNER JOIN @deleteVendors AS dv ON dv.VendorId = d.VendorId;
IF OBJECT_ID(N'vdr.VENDOR_STATUS_T', N'U') IS NOT NULL
    DELETE s FROM vdr.VENDOR_STATUS_T AS s INNER JOIN @deleteVendors AS dv ON dv.VendorId = s.VendorId;
IF OBJECT_ID(N'vdr.VENDOR_CERTIFICATE_T', N'U') IS NOT NULL
    DELETE c FROM vdr.VENDOR_CERTIFICATE_T AS c INNER JOIN @deleteVendors AS dv ON dv.VendorId = c.VendorId;
IF OBJECT_ID(N'vdr.VENDOR_KBLI_T', N'U') IS NOT NULL
    DELETE k FROM vdr.VENDOR_KBLI_T AS k INNER JOIN @deleteVendors AS dv ON dv.VendorId = k.VendorId;
IF OBJECT_ID(N'vdr.VENDOR_BRAND_T', N'U') IS NOT NULL
    DELETE b FROM vdr.VENDOR_BRAND_T AS b INNER JOIN @deleteVendors AS dv ON dv.VendorId = b.VendorId;
IF OBJECT_ID(N'vdr.VENDOR_PORTFOLIO_T', N'U') IS NOT NULL
    DELETE p FROM vdr.VENDOR_PORTFOLIO_T AS p INNER JOIN @deleteVendors AS dv ON dv.VendorId = p.VendorId;
IF OBJECT_ID(N'vdr.VENDOR_SPECIAL_REQUIREMENT_T', N'U') IS NOT NULL
    DELETE sr FROM vdr.VENDOR_SPECIAL_REQUIREMENT_T AS sr INNER JOIN @deleteVendors AS dv ON dv.VendorId = sr.VendorId;
IF OBJECT_ID(N'vdr.VENDOR_SUBCLASSIFICATION_T', N'U') IS NOT NULL
    DELETE sc FROM vdr.VENDOR_SUBCLASSIFICATION_T AS sc INNER JOIN @deleteVendors AS dv ON dv.VendorId = sc.VendorId;
IF OBJECT_ID(N'vdr.VENDOR_EXTERNAL_REFERENCE_T', N'U') IS NOT NULL
    DELETE xr FROM vdr.VENDOR_EXTERNAL_REFERENCE_T AS xr INNER JOIN @deleteVendors AS dv ON dv.VendorId = xr.VendorId;

DELETE vu
FROM vdr.VENDOR_USER_T AS vu
INNER JOIN @deleteVendors AS dv ON dv.VendorId = vu.VendorId;

IF OBJECT_ID(N'vdr.USER_TOKENS_T', N'U') IS NOT NULL
    DELETE t FROM vdr.USER_TOKENS_T AS t INNER JOIN @identityUsers AS iu ON iu.UserId = t.UserId;
IF OBJECT_ID(N'vdr.USER_LOGINS_T', N'U') IS NOT NULL
    DELETE l FROM vdr.USER_LOGINS_T AS l INNER JOIN @identityUsers AS iu ON iu.UserId = l.UserId;
IF OBJECT_ID(N'vdr.USER_CLAIMS_T', N'U') IS NOT NULL
    DELETE c FROM vdr.USER_CLAIMS_T AS c INNER JOIN @identityUsers AS iu ON iu.UserId = c.UserId;
IF OBJECT_ID(N'vdr.USER_ROLES_T', N'U') IS NOT NULL
    DELETE r FROM vdr.USER_ROLES_T AS r INNER JOIN @identityUsers AS iu ON iu.UserId = r.UserId;

DELETE u
FROM vdr.USERS_T AS u
INNER JOIN @identityUsers AS iu ON iu.UserId = u.Id;

DELETE v
FROM vdr.VENDOR_T AS v
INNER JOIN @deleteVendors AS dv ON dv.VendorId = v.VendorId;

IF OBJECT_ID(N'core.EMAIL_SENT_T', N'U') IS NOT NULL
    DELETE e
    FROM core.EMAIL_SENT_T AS e
    WHERE e.Category = N'Vendor Onboarding'
      AND (
            LOWER(ISNULL(JSON_VALUE(e.PayloadJson, '$.recipient'), N'')) IN (SELECT Email FROM @emails)
         OR LOWER(ISNULL(JSON_VALUE(e.PayloadJson, '$.email'), N'')) IN (SELECT Email FROM @emails)
         OR LOWER(ISNULL(JSON_VALUE(e.PayloadJson, '$.to'), N'')) IN (SELECT Email FROM @emails)
         OR LOWER(ISNULL(JSON_VALUE(e.PayloadJson, '$.subject'), N'')) LIKE N'%invit%'
         OR EXISTS (
                SELECT 1
                FROM @emails AS em
                WHERE e.PayloadJson LIKE N'%' + em.Email + N'%')
      );

IF OBJECT_ID(N'core.NOTIFICATION_T', N'U') IS NOT NULL
BEGIN
    IF OBJECT_ID(N'core.NOTIFICATION_RECIPIENT_STATE_T', N'U') IS NOT NULL
        DELETE rs
        FROM core.NOTIFICATION_RECIPIENT_STATE_T AS rs
        INNER JOIN core.NOTIFICATION_T AS n ON n.Id = rs.NotificationId
        WHERE n.Module IN (N'vendorOnboarding', N'Vendor Onboarding', N'vendorInvitations', N'Vendor Invitations')
          AND (
                EXISTS (
                    SELECT 1 FROM @emails AS em
                    WHERE LOWER(ISNULL(n.Title, N'') + N' ' + ISNULL(n.Detail, N'') + N' ' + ISNULL(n.LinkPath, N'') + N' ' + ISNULL(n.AudienceUser, N''))
                          LIKE N'%' + em.Email + N'%')
             OR EXISTS (
                    SELECT 1 FROM @deleteVendors AS dv
                    WHERE ISNULL(n.Title, N'') + N' ' + ISNULL(n.Detail, N'') + N' ' + ISNULL(n.LinkPath, N'')
                          LIKE N'%' + dv.VendorId + N'%')
             OR EXISTS (
                    SELECT 1 FROM @invitations AS inv
                    WHERE inv.VendorName IS NOT NULL
                      AND LTRIM(RTRIM(inv.VendorName)) <> N''
                      AND ISNULL(n.Title, N'') + N' ' + ISNULL(n.Detail, N'') LIKE N'%' + inv.VendorName + N'%')
             OR ISNULL(n.LinkPath, N'') LIKE N'%invitation%'
          );

    DELETE n
    FROM core.NOTIFICATION_T AS n
    WHERE n.Module IN (N'vendorOnboarding', N'Vendor Onboarding', N'vendorInvitations', N'Vendor Invitations')
      AND (
            EXISTS (
                SELECT 1 FROM @emails AS em
                WHERE LOWER(ISNULL(n.Title, N'') + N' ' + ISNULL(n.Detail, N'') + N' ' + ISNULL(n.LinkPath, N'') + N' ' + ISNULL(n.AudienceUser, N''))
                      LIKE N'%' + em.Email + N'%')
         OR EXISTS (
                SELECT 1 FROM @deleteVendors AS dv
                WHERE ISNULL(n.Title, N'') + N' ' + ISNULL(n.Detail, N'') + N' ' + ISNULL(n.LinkPath, N'')
                      LIKE N'%' + dv.VendorId + N'%')
         OR EXISTS (
                SELECT 1 FROM @invitations AS inv
                WHERE inv.VendorName IS NOT NULL
                  AND LTRIM(RTRIM(inv.VendorName)) <> N''
                  AND ISNULL(n.Title, N'') + N' ' + ISNULL(n.Detail, N'') LIKE N'%' + inv.VendorName + N'%')
         OR ISNULL(n.LinkPath, N'') LIKE N'%invitation%'
      );
END;

IF OBJECT_ID(N'core.AUDIT_LOG_T', N'U') IS NOT NULL
    DELETE a
    FROM core.AUDIT_LOG_T AS a
    WHERE a.Module IN (N'vendorOnboarding', N'Vendor Onboarding', N'vendorInvitations', N'Vendor Invitations')
      AND (
            LOWER(ISNULL(a.Action, N'')) LIKE N'%invit%'
         OR LOWER(ISNULL(a.Description, N'')) LIKE N'%invit%'
         OR EXISTS (
                SELECT 1 FROM @emails AS em
                WHERE LOWER(ISNULL(a.Description, N'') + N' ' + ISNULL(a.MetadataJson, N'')) LIKE N'%' + em.Email + N'%')
         OR EXISTS (
                SELECT 1 FROM @deleteVendors AS dv
                WHERE ISNULL(a.Description, N'') + N' ' + ISNULL(a.MetadataJson, N'') LIKE N'%' + dv.VendorId + N'%')
      );

COMMIT;

INSERT INTO @counts
SELECT 'after', s.name, t.name, SUM(p.rows)
FROM sys.tables t
JOIN sys.schemas s ON s.schema_id = t.schema_id
JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0, 1)
WHERE (s.name = N'vdr' AND t.name IN (
        N'INVITATION_T',
        N'INVITATION_ATTEMPT_T',
        N'VENDOR_T',
        N'VENDOR_USER_T',
        N'VENDOR_DOCUMENT_T',
        N'VENDOR_STATUS_T',
        N'VENDOR_CERTIFICATE_T',
        N'VENDOR_KBLI_T',
        N'VENDOR_BRAND_T',
        N'VENDOR_PORTFOLIO_T',
        N'VENDOR_SPECIAL_REQUIREMENT_T',
        N'VENDOR_SUBCLASSIFICATION_T',
        N'VENDOR_EXTERNAL_REFERENCE_T',
        N'VENDOR_IMPORT_ROW_T',
        N'USERS_T',
        N'USER_ROLES_T',
        N'USER_CLAIMS_T',
        N'USER_LOGINS_T',
        N'USER_TOKENS_T'))
   OR (s.name = N'core' AND t.name IN (
        N'EMAIL_SENT_T',
        N'NOTIFICATION_T',
        N'NOTIFICATION_RECIPIENT_STATE_T',
        N'AUDIT_LOG_T'))
GROUP BY s.name, t.name;

SELECT
    b.SchemaName,
    b.TableName,
    b.RowCountInt AS BeforeCount,
    a.RowCountInt AS AfterCount
FROM @counts b
JOIN @counts a
  ON a.SchemaName = b.SchemaName AND a.TableName = b.TableName AND a.Phase = 'after'
WHERE b.Phase = 'before'
ORDER BY b.SchemaName, b.TableName;

SELECT
    (SELECT COUNT(*) FROM vdr.INVITATION_T) AS RemainingInvitations,
    (SELECT COUNT(*) FROM vdr.INVITATION_ATTEMPT_T) AS RemainingAttempts,
    (SELECT COUNT(*) FROM vdr.VENDOR_T v INNER JOIN @deleteVendors d ON d.VendorId = v.VendorId) AS RemainingDeletedVendors,
    (SELECT COUNT(*) FROM vdr.VENDOR_T) AS RemainingVendors,
    (SELECT COUNT(*) FROM @keepVendors) AS KeptInvitationLinkedVendors;
