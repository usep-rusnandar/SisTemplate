-- Wipe Proposal Tracker (+ Term Sheet / CIP) and Contract Monitoring transactional data.
-- KEEP: iam.*, master data, settings, About, email templates, languages, menus,
--       vendor onboarding / workspace (vdr.*), vendor Identity, session cache,
--       VENDOR_CONNECT_DB, __EFMigrationsHistory.
-- REMOVE: trk.*, cip.*, cm.*, plus Tracker/CIP/CM frontend KV, emails, notifications, audit.
-- Does NOT delete Azure Blob bytes (Managed Identity). Orphan blob keys are leftover only.
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;

SELECT
    DB_NAME() AS [Database],
    @@SERVERNAME AS [Server],
    SYSUTCDATETIME() AS [UtcNow];

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
WHERE s.name IN (N'trk', N'cip', N'cm')
   OR (s.name = N'core' AND t.name IN (
        N'FRONTEND_STATE_T',
        N'EMAIL_SENT_T',
        N'NOTIFICATION_T',
        N'NOTIFICATION_RECIPIENT_STATE_T',
        N'AUDIT_LOG_T'))
GROUP BY s.name, t.name;

BEGIN TRAN;

IF OBJECT_ID(N'cip.CASE_DOCUMENT_T', N'U') IS NOT NULL DELETE FROM cip.CASE_DOCUMENT_T;
IF OBJECT_ID(N'cip.CASE_ACTIVITY_T', N'U') IS NOT NULL DELETE FROM cip.CASE_ACTIVITY_T;
IF OBJECT_ID(N'cip.CASE_T', N'U') IS NOT NULL DELETE FROM cip.CASE_T;
IF OBJECT_ID(N'cip.STATE_T', N'U') IS NOT NULL DELETE FROM cip.STATE_T;

IF OBJECT_ID(N'cm.CONTRACT_MATERIAL_T', N'U') IS NOT NULL DELETE FROM cm.CONTRACT_MATERIAL_T;
IF OBJECT_ID(N'cm.MATERIAL_SYNC_FILE_T', N'U') IS NOT NULL DELETE FROM cm.MATERIAL_SYNC_FILE_T;
IF OBJECT_ID(N'cm.CONTRACT_VERSION_T', N'U') IS NOT NULL DELETE FROM cm.CONTRACT_VERSION_T;
IF OBJECT_ID(N'cm.REMINDER_T', N'U') IS NOT NULL DELETE FROM cm.REMINDER_T;
IF OBJECT_ID(N'cm.IMPORT_JOB_ROW_T', N'U') IS NOT NULL DELETE FROM cm.IMPORT_JOB_ROW_T;
IF OBJECT_ID(N'cm.IMPORT_JOB_T', N'U') IS NOT NULL DELETE FROM cm.IMPORT_JOB_T;
IF OBJECT_ID(N'cm.SHAREPOINT_DOC_T', N'U') IS NOT NULL DELETE FROM cm.SHAREPOINT_DOC_T;
IF OBJECT_ID(N'cm.CONTRACT_T', N'U') IS NOT NULL DELETE FROM cm.CONTRACT_T;
IF OBJECT_ID(N'cm.STATE_T', N'U') IS NOT NULL DELETE FROM cm.STATE_T;

IF OBJECT_ID(N'trk.AWARD_RESULT_VENDOR_T', N'U') IS NOT NULL DELETE FROM trk.AWARD_RESULT_VENDOR_T;
IF OBJECT_ID(N'trk.AWARD_RESULT_T', N'U') IS NOT NULL DELETE FROM trk.AWARD_RESULT_T;
IF OBJECT_ID(N'trk.LOA_DOCUMENT_T', N'U') IS NOT NULL DELETE FROM trk.LOA_DOCUMENT_T;
IF OBJECT_ID(N'trk.PROPOSAL_ACTIVITY_T', N'U') IS NOT NULL DELETE FROM trk.PROPOSAL_ACTIVITY_T;
IF OBJECT_ID(N'trk.PROPOSAL_T', N'U') IS NOT NULL DELETE FROM trk.PROPOSAL_T;
IF OBJECT_ID(N'trk.STATE_T', N'U') IS NOT NULL DELETE FROM trk.STATE_T;

DECLARE @q nvarchar(max);
DECLARE @schema sysname;
DECLARE @table sysname;
DECLARE leftover CURSOR LOCAL FAST_FORWARD FOR
    SELECT s.name, t.name
    FROM sys.tables t
    JOIN sys.schemas s ON s.schema_id = t.schema_id
    WHERE s.name IN (N'trk', N'cip', N'cm');
OPEN leftover;
FETCH NEXT FROM leftover INTO @schema, @table;
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @q = N'DELETE FROM ' + QUOTENAME(@schema) + N'.' + QUOTENAME(@table) + N';';
    BEGIN TRY
        EXEC sp_executesql @q;
    END TRY
    BEGIN CATCH
        -- Likely FK order; explicit deletes above already cleared known tables.
    END CATCH
    FETCH NEXT FROM leftover INTO @schema, @table;
END
CLOSE leftover;
DEALLOCATE leftover;

IF OBJECT_ID(N'core.FRONTEND_STATE_T', N'U') IS NOT NULL
    DELETE FROM core.FRONTEND_STATE_T
    WHERE [Key] LIKE N'ag_tracker_%'
       OR [Key] LIKE N'ag_trk_%'
       OR [Key] LIKE N'ag_cip_%'
       OR [Key] LIKE N'ag_cm_%';

IF OBJECT_ID(N'core.NOTIFICATION_RECIPIENT_STATE_T', N'U') IS NOT NULL
   AND OBJECT_ID(N'core.NOTIFICATION_T', N'U') IS NOT NULL
    DELETE rs
    FROM core.NOTIFICATION_RECIPIENT_STATE_T rs
    INNER JOIN core.NOTIFICATION_T n ON n.Id = rs.NotificationId
    WHERE n.Module IN (
        N'proposalTracker',
        N'contractInitiationPlatform',
        N'contractMonitoring',
        N'Proposal Tracker',
        N'Contract Initiation Platform',
        N'Contract Monitoring');

IF OBJECT_ID(N'core.NOTIFICATION_T', N'U') IS NOT NULL
    DELETE FROM core.NOTIFICATION_T
    WHERE Module IN (
        N'proposalTracker',
        N'contractInitiationPlatform',
        N'contractMonitoring',
        N'Proposal Tracker',
        N'Contract Initiation Platform',
        N'Contract Monitoring');

IF OBJECT_ID(N'core.EMAIL_SENT_T', N'U') IS NOT NULL
    DELETE FROM core.EMAIL_SENT_T
    WHERE Category IN (N'Proposal Tracker', N'Tracker', N'Contract Monitoring', N'CIP', N'Term Sheet')
       OR Category LIKE N'%Proposal Tracker%'
       OR Category LIKE N'%Contract Monitoring%'
       OR Category LIKE N'%Term Sheet%';

IF OBJECT_ID(N'core.AUDIT_LOG_T', N'U') IS NOT NULL
    DELETE FROM core.AUDIT_LOG_T
    WHERE Module IN (
        N'proposalTracker',
        N'contractInitiationPlatform',
        N'contractMonitoring',
        N'Proposal Tracker',
        N'Contract Initiation Platform',
        N'Contract Monitoring',
        N'Tracker',
        N'CIP');

COMMIT;

INSERT INTO @counts
SELECT 'after', s.name, t.name, SUM(p.rows)
FROM sys.tables t
JOIN sys.schemas s ON s.schema_id = t.schema_id
JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0, 1)
WHERE s.name IN (N'trk', N'cip', N'cm')
   OR (s.name = N'core' AND t.name IN (
        N'FRONTEND_STATE_T',
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
  ON a.SchemaName = b.SchemaName AND a.TableName = b.TableName AND a.Phase = N'after'
WHERE b.Phase = N'before'
ORDER BY b.SchemaName, b.TableName;
