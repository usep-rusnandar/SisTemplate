-- Wipe transactional / test data so production can be retested from a clean slate.
-- KEEP: iam.*, master data, settings, About, email templates, languages, menus, vendor Identity roles,
--       and core.SESSION_CACHE_T (SSO / local-login tickets). Wiping sessions logs everyone out
--       while the SPA still looks signed in, so Generate Sample Data / KV writes return 401.
-- REMOVE: vendors & invitations, Tracker/CIP/CM transactions, email-sent, notifications, audit, frontend state.
-- Does NOT touch VENDOR_CONNECT_DB (external source) or __EFMigrationsHistory.
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;

SELECT
    DB_NAME() AS [Database],
    @@SERVERNAME AS [Server],
    SYSUTCDATETIME() AS [UtcNow];

DECLARE @counts TABLE (Phase nvarchar(10) NOT NULL, SchemaName sysname NOT NULL, TableName sysname NOT NULL, RowCountInt int NOT NULL);

INSERT INTO @counts
SELECT 'before', s.name, t.name, SUM(p.rows)
FROM sys.tables t
JOIN sys.schemas s ON s.schema_id = t.schema_id
JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0, 1)
WHERE s.name IN ('vdr', 'trk', 'cip', 'cm', 'core')
GROUP BY s.name, t.name;

BEGIN TRAN;

DELETE FROM cip.CASE_DOCUMENT_T;
DELETE FROM cip.CASE_ACTIVITY_T;
DELETE FROM cip.CASE_T;
DELETE FROM cip.STATE_T;

DELETE FROM cm.CONTRACT_MATERIAL_T;
DELETE FROM cm.MATERIAL_SYNC_FILE_T;
DELETE FROM cm.CONTRACT_VERSION_T;
DELETE FROM cm.REMINDER_T;
DELETE FROM cm.IMPORT_JOB_ROW_T;
DELETE FROM cm.IMPORT_JOB_T;
DELETE FROM cm.SHAREPOINT_DOC_T;
DELETE FROM cm.CONTRACT_T;
DELETE FROM cm.STATE_T;

DELETE FROM trk.AWARD_RESULT_VENDOR_T;
DELETE FROM trk.AWARD_RESULT_T;
DELETE FROM trk.LOA_DOCUMENT_T;
DELETE FROM trk.PROPOSAL_ACTIVITY_T;
DELETE FROM trk.PROPOSAL_T;
DELETE FROM trk.STATE_T;

DELETE FROM vdr.INVITATION_ATTEMPT_T;
DELETE FROM vdr.INVITATION_T;
DELETE FROM vdr.VENDOR_USER_T;
DELETE FROM vdr.VENDOR_DOCUMENT_T;
DELETE FROM vdr.VENDOR_STATUS_T;
DELETE FROM vdr.VENDOR_CERTIFICATE_T;
DELETE FROM vdr.VENDOR_KBLI_T;
DELETE FROM vdr.VENDOR_BRAND_T;
DELETE FROM vdr.VENDOR_PORTFOLIO_T;
DELETE FROM vdr.VENDOR_SPECIAL_REQUIREMENT_T;
DELETE FROM vdr.VENDOR_SUBCLASSIFICATION_T;
DELETE FROM vdr.VENDOR_EXTERNAL_REFERENCE_T;
DELETE FROM vdr.VENDOR_IMPORT_ROW_T;
DELETE FROM vdr.VENDOR_IMPORT_BATCH_T;
DELETE FROM vdr.VENDOR_T;

DELETE FROM vdr.USER_TOKENS_T;
DELETE FROM vdr.USER_LOGINS_T;
DELETE FROM vdr.USER_CLAIMS_T;
DELETE FROM vdr.USER_ROLES_T;
DELETE FROM vdr.USERS_T;

DELETE FROM core.NOTIFICATION_RECIPIENT_STATE_T;
DELETE FROM core.NOTIFICATION_T;
DELETE FROM core.EMAIL_SENT_T;
DELETE FROM core.AUDIT_LOG_T;
DELETE FROM core.FRONTEND_STATE_T;

COMMIT;

INSERT INTO @counts
SELECT 'after', s.name, t.name, SUM(p.rows)
FROM sys.tables t
JOIN sys.schemas s ON s.schema_id = t.schema_id
JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0, 1)
WHERE s.name IN ('vdr', 'trk', 'cip', 'cm', 'core')
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
