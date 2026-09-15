-- Rename Vendor Special Requirement code IUJPL → IUJPTL (legacy VendorConnect → current seed).
--
-- IUJPL  = old code for "Izin Usaha Jasa Penunjang Tenaga Listrik"
-- IUJPTL = current seed code for the same license
-- IUJP   = "Izin Usaha Jasa Pertambangan" — different code, DO NOT touch
--
-- Default is PREVIEW ONLY (@Apply = 0). Set @Apply = 1 to write, then execute the
-- whole script as one batch (no GO between the DECLARE and the DML).
-- Run Staging first. Wrap is already a transaction; errors roll back.
--
-- This script does not delete Azure Blob bytes. Dual-slot documents keep IUJPTL;
-- the IUJPL document row is removed and its BlobContainer/BlobKey are listed so
-- leftovers can be cleaned in Storage later.
--
-- vdr.VENDOR_IMPORT_ROW_T history is left as-is (replay of an old Ariba workbook
-- could recreate IUJPL). Preview prints a count if JSON still mentions IUJPL.
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;

DECLARE @From nvarchar(16) = N'IUJPL';
DECLARE @To   nvarchar(16) = N'IUJPTL';
DECLARE @Apply bit = 0; -- 0 = preview; 1 = write
DECLARE @Now datetimeoffset = SYSUTCDATETIME();
DECLARE @Actor nvarchar(100) = N'sql:rename-iujpl-to-iujptl';

IF @From <> N'IUJPL' OR @To <> N'IUJPTL'
BEGIN
    RAISERROR(N'ABORT: this script is hard-scoped to IUJPL → IUJPTL.', 16, 1);
    RETURN;
END;

SELECT
    DB_NAME() AS [Database],
    @@SERVERNAME AS [Server],
    SYSUTCDATETIME() AS [UtcNow],
    CASE WHEN @Apply = 1 THEN N'APPLY' ELSE N'PREVIEW' END AS [Mode];

IF (
        OBJECT_ID(N'core.MASTER_DATA_RECORD_T', N'U') IS NULL
        OR OBJECT_ID(N'vdr.VENDOR_SPECIAL_REQUIREMENT_T', N'U') IS NULL
        OR OBJECT_ID(N'vdr.VENDOR_DOCUMENT_T', N'U') IS NULL
    )
BEGIN
    RAISERROR(N'ABORT: expected core/vdr tables are missing.', 16, 1);
    RETURN;
END;

-- ---------------------------------------------------------------------------
-- Preview
-- ---------------------------------------------------------------------------
SELECT N'special-requirement' AS [SetKey], Code, Name, Status, PayloadJson
FROM core.MASTER_DATA_RECORD_T
WHERE SetKey = N'special-requirement'
  AND Code IN (@From, @To, N'IUJP')
ORDER BY Code;

SELECT
    Code,
    Name,
    PayloadJson,
    CASE
        WHEN CHARINDEX(N'|', Code) > 0
            THEN RIGHT(Code, CHARINDEX(N'|', REVERSE(Code)) - 1)
        ELSE Code
    END AS SpecialReqId
FROM core.MASTER_DATA_RECORD_T
WHERE SetKey = N'commodity-subclassification-special-requirement'
  AND (
        Code LIKE N'%|' + @From
     OR Code LIKE N'%|' + @To
     OR PayloadJson LIKE N'%"SpecialReqId":"' + @From + N'"%'
     OR PayloadJson LIKE N'%"specialReqId":"' + @From + N'"%'
     OR PayloadJson LIKE N'%"SpecialReqId":"' + @To + N'"%'
     OR PayloadJson LIKE N'%"specialReqId":"' + @To + N'"%'
  )
ORDER BY Code;

SELECT sr.VendorId, v.VendorName, sr.SpecialReqCode, sr.Number, sr.Description, sr.ExpireDate
FROM vdr.VENDOR_SPECIAL_REQUIREMENT_T AS sr
LEFT JOIN vdr.VENDOR_T AS v ON v.VendorId = sr.VendorId
WHERE sr.SpecialReqCode IN (@From, @To)
ORDER BY sr.VendorId, sr.SpecialReqCode;

SELECT
    old.VendorId,
    v.VendorName,
    old.Number AS IujplNumber,
    neu.Number AS IujptlNumber,
    old.Description AS IujplDescription,
    neu.Description AS IujptlDescription,
    old.ExpireDate AS IujplExpire,
    neu.ExpireDate AS IujptlExpire
FROM vdr.VENDOR_SPECIAL_REQUIREMENT_T AS old
INNER JOIN vdr.VENDOR_SPECIAL_REQUIREMENT_T AS neu
    ON neu.VendorId = old.VendorId
   AND neu.SpecialReqCode = @To
LEFT JOIN vdr.VENDOR_T AS v ON v.VendorId = old.VendorId
WHERE old.SpecialReqCode = @From;

SELECT
    d.VendorId,
    v.VendorName,
    d.VendorDocumentId,
    d.DocumentType,
    d.OwnerKey,
    d.FileName,
    d.IsPlaceholder,
    d.IsActive,
    d.BlobContainer,
    d.BlobKey
FROM vdr.VENDOR_DOCUMENT_T AS d
LEFT JOIN vdr.VENDOR_T AS v ON v.VendorId = d.VendorId
WHERE LOWER(d.DocumentType) = N'special-requirement'
  AND d.OwnerKey IN (@From, @To)
ORDER BY d.VendorId, d.OwnerKey;

SELECT
    old.VendorId,
    old.VendorDocumentId AS IujplDocumentId,
    old.FileName AS IujplFileName,
    old.IsPlaceholder AS IujplPlaceholder,
    old.BlobContainer AS IujplContainer,
    old.BlobKey AS IujplBlobKey,
    neu.VendorDocumentId AS IujptlDocumentId,
    neu.FileName AS IujptlFileName,
    neu.IsPlaceholder AS IujptlPlaceholder,
    neu.BlobContainer AS IujptlContainer,
    neu.BlobKey AS IujptlBlobKey
FROM vdr.VENDOR_DOCUMENT_T AS old
INNER JOIN vdr.VENDOR_DOCUMENT_T AS neu
    ON neu.VendorId = old.VendorId
   AND LOWER(neu.DocumentType) = N'special-requirement'
   AND neu.OwnerKey = @To
WHERE LOWER(old.DocumentType) = N'special-requirement'
  AND old.OwnerKey = @From;

IF OBJECT_ID(N'vdr.VENDOR_IMPORT_ROW_T', N'U') IS NOT NULL
BEGIN
    SELECT COUNT(*) AS ImportRowsMentioningIujpl
    FROM vdr.VENDOR_IMPORT_ROW_T
    WHERE PayloadJson LIKE N'%' + @From + N'%';
END;

SELECT
    (SELECT COUNT(*) FROM core.MASTER_DATA_RECORD_T
      WHERE SetKey = N'special-requirement' AND Code = @From) AS MasterIujpl,
    (SELECT COUNT(*) FROM core.MASTER_DATA_RECORD_T
      WHERE SetKey = N'special-requirement' AND Code = @To) AS MasterIujptl,
    (SELECT COUNT(*) FROM core.MASTER_DATA_RECORD_T
      WHERE SetKey = N'commodity-subclassification-special-requirement'
        AND Code LIKE N'%|' + @From) AS MappingIujpl,
    (SELECT COUNT(*) FROM core.MASTER_DATA_RECORD_T
      WHERE SetKey = N'commodity-subclassification-special-requirement'
        AND Code LIKE N'%|' + @To) AS MappingIujptl,
    (SELECT COUNT(*) FROM vdr.VENDOR_SPECIAL_REQUIREMENT_T
      WHERE SpecialReqCode = @From) AS VendorIujpl,
    (SELECT COUNT(*) FROM vdr.VENDOR_SPECIAL_REQUIREMENT_T
      WHERE SpecialReqCode = @To) AS VendorIujptl,
    (SELECT COUNT(*) FROM vdr.VENDOR_DOCUMENT_T
      WHERE LOWER(DocumentType) = N'special-requirement' AND OwnerKey = @From) AS DocIujpl,
    (SELECT COUNT(*) FROM vdr.VENDOR_DOCUMENT_T
      WHERE LOWER(DocumentType) = N'special-requirement' AND OwnerKey = @To) AS DocIujptl;

IF @Apply = 0
BEGIN
    PRINT N'PREVIEW only. Set @Apply = 1 at the top and re-run to write.';
    RETURN;
END;

-- ---------------------------------------------------------------------------
-- Apply
-- ---------------------------------------------------------------------------
DECLARE @LeftoverBlobs TABLE (
    VendorId nvarchar(10) NOT NULL,
    VendorDocumentId uniqueidentifier NOT NULL,
    FileName nvarchar(255) NOT NULL,
    BlobContainer nvarchar(150) NOT NULL,
    BlobKey nvarchar(400) NOT NULL,
    Reason nvarchar(80) NOT NULL
);

DECLARE @rcMasterDeleted int = 0;
DECLARE @rcMasterRenamed int = 0;
DECLARE @rcMapDeleted int = 0;
DECLARE @rcMapRenamed int = 0;
DECLARE @rcVendorMerged int = 0;
DECLARE @rcVendorDeleted int = 0;
DECLARE @rcVendorRenamed int = 0;
DECLARE @rcDocDeleted int = 0;
DECLARE @rcDocRenamed int = 0;

BEGIN TRY
    BEGIN TRAN;

    /* Master: keep IUJPTL if both exist; otherwise rename IUJPL. */
    DELETE FROM core.MASTER_DATA_RECORD_T
    WHERE SetKey = N'special-requirement'
      AND Code = @From
      AND EXISTS (
            SELECT 1
            FROM core.MASTER_DATA_RECORD_T AS keep
            WHERE keep.SetKey = N'special-requirement'
              AND keep.Code = @To
      );
    SET @rcMasterDeleted = @@ROWCOUNT;

    UPDATE core.MASTER_DATA_RECORD_T
    SET Code = @To,
        UpdatedAt = @Now
    WHERE SetKey = N'special-requirement'
      AND Code = @From;
    SET @rcMasterRenamed = @@ROWCOUNT;

    /* Mapping: Code = SubClassificationId|SpecialReqId. Drop IUJPL when IUJPTL pair exists. */
    DELETE iujpl
    FROM core.MASTER_DATA_RECORD_T AS iujpl
    WHERE iujpl.SetKey = N'commodity-subclassification-special-requirement'
      AND iujpl.Code LIKE N'%|' + @From
      AND EXISTS (
            SELECT 1
            FROM core.MASTER_DATA_RECORD_T AS keep
            WHERE keep.SetKey = iujpl.SetKey
              AND keep.Code = LEFT(iujpl.Code, LEN(iujpl.Code) - LEN(@From)) + @To
      );
    SET @rcMapDeleted = @@ROWCOUNT;

    UPDATE core.MASTER_DATA_RECORD_T
    SET
        Code = LEFT(Code, LEN(Code) - LEN(@From)) + @To,
        Name = @To,
        PayloadJson = CASE
            WHEN PayloadJson IS NULL OR ISJSON(PayloadJson) = 0 THEN PayloadJson
            ELSE
                CASE
                    WHEN JSON_VALUE(PayloadJson, N'$.specialReqId') = @From THEN
                        JSON_MODIFY(
                            CASE
                                WHEN JSON_VALUE(PayloadJson, N'$.SpecialReqId') = @From
                                    THEN JSON_MODIFY(PayloadJson, N'$.SpecialReqId', @To)
                                ELSE PayloadJson
                            END,
                            N'$.specialReqId',
                            @To)
                    WHEN JSON_VALUE(PayloadJson, N'$.SpecialReqId') = @From THEN
                        JSON_MODIFY(PayloadJson, N'$.SpecialReqId', @To)
                    ELSE PayloadJson
                END
        END,
        UpdatedAt = @Now
    WHERE SetKey = N'commodity-subclassification-special-requirement'
      AND Code LIKE N'%|' + @From;
    SET @rcMapRenamed = @@ROWCOUNT;

    /* Vendor child rows: fill empty IUJPTL fields from IUJPL, then drop/rename. */
    UPDATE neu
    SET
        Number = CASE
            WHEN neu.Number IS NULL OR LTRIM(RTRIM(neu.Number)) = N'' THEN old.Number
            ELSE neu.Number
        END,
        Description = CASE
            WHEN neu.Description IS NULL OR LTRIM(RTRIM(neu.Description)) = N'' THEN old.Description
            ELSE neu.Description
        END,
        ExpireDate = CASE
            WHEN neu.ExpireDate IS NULL THEN old.ExpireDate
            ELSE neu.ExpireDate
        END,
        UpdatedAt = @Now,
        UpdatedBy = @Actor
    FROM vdr.VENDOR_SPECIAL_REQUIREMENT_T AS neu
    INNER JOIN vdr.VENDOR_SPECIAL_REQUIREMENT_T AS old
        ON old.VendorId = neu.VendorId
       AND old.SpecialReqCode = @From
    WHERE neu.SpecialReqCode = @To;
    SET @rcVendorMerged = @@ROWCOUNT;

    DELETE old
    FROM vdr.VENDOR_SPECIAL_REQUIREMENT_T AS old
    WHERE old.SpecialReqCode = @From
      AND EXISTS (
            SELECT 1
            FROM vdr.VENDOR_SPECIAL_REQUIREMENT_T AS neu
            WHERE neu.VendorId = old.VendorId
              AND neu.SpecialReqCode = @To
      );
    SET @rcVendorDeleted = @@ROWCOUNT;

    UPDATE vdr.VENDOR_SPECIAL_REQUIREMENT_T
    SET SpecialReqCode = @To,
        UpdatedAt = @Now,
        UpdatedBy = @Actor
    WHERE SpecialReqCode = @From;
    SET @rcVendorRenamed = @@ROWCOUNT;

    /* Documents: keep the IUJPTL slot when both exist; rename the rest. */
    INSERT INTO @LeftoverBlobs (VendorId, VendorDocumentId, FileName, BlobContainer, BlobKey, Reason)
    SELECT
        old.VendorId,
        old.VendorDocumentId,
        old.FileName,
        old.BlobContainer,
        old.BlobKey,
        N'dual-slot: kept IUJPTL, dropped IUJPL row'
    FROM vdr.VENDOR_DOCUMENT_T AS old
    INNER JOIN vdr.VENDOR_DOCUMENT_T AS neu
        ON neu.VendorId = old.VendorId
       AND LOWER(neu.DocumentType) = N'special-requirement'
       AND neu.OwnerKey = @To
    WHERE LOWER(old.DocumentType) = N'special-requirement'
      AND old.OwnerKey = @From;

    DELETE old
    FROM vdr.VENDOR_DOCUMENT_T AS old
    WHERE LOWER(old.DocumentType) = N'special-requirement'
      AND old.OwnerKey = @From
      AND EXISTS (
            SELECT 1
            FROM vdr.VENDOR_DOCUMENT_T AS neu
            WHERE neu.VendorId = old.VendorId
              AND LOWER(neu.DocumentType) = N'special-requirement'
              AND neu.OwnerKey = @To
      );
    SET @rcDocDeleted = @@ROWCOUNT;

    UPDATE vdr.VENDOR_DOCUMENT_T
    SET OwnerKey = @To,
        UpdatedAt = @Now,
        UpdatedBy = @Actor
    WHERE LOWER(DocumentType) = N'special-requirement'
      AND OwnerKey = @From;
    SET @rcDocRenamed = @@ROWCOUNT;

    IF (
            EXISTS (
                SELECT 1 FROM core.MASTER_DATA_RECORD_T
                WHERE SetKey = N'special-requirement' AND Code = @From
            )
            OR EXISTS (
                SELECT 1 FROM core.MASTER_DATA_RECORD_T
                WHERE SetKey = N'commodity-subclassification-special-requirement'
                  AND Code LIKE N'%|' + @From
            )
            OR EXISTS (
                SELECT 1 FROM vdr.VENDOR_SPECIAL_REQUIREMENT_T
                WHERE SpecialReqCode = @From
            )
            OR EXISTS (
                SELECT 1 FROM vdr.VENDOR_DOCUMENT_T
                WHERE LOWER(DocumentType) = N'special-requirement' AND OwnerKey = @From
            )
        )
    BEGIN
        RAISERROR(N'ABORT: IUJPL rows still present after apply; rolling back.', 16, 1);
    END;

    COMMIT TRAN;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    THROW;
END CATCH;

SELECT
    @rcMasterDeleted AS MasterIujplDeletedBecauseIujptlExists,
    @rcMasterRenamed AS MasterIujplRenamed,
    @rcMapDeleted AS MappingIujplDeletedBecauseIujptlExists,
    @rcMapRenamed AS MappingIujplRenamed,
    @rcVendorMerged AS VendorIujptlFilledFromIujpl,
    @rcVendorDeleted AS VendorIujplDeletedAfterMerge,
    @rcVendorRenamed AS VendorIujplRenamed,
    @rcDocDeleted AS DocIujplDeletedDualSlot,
    @rcDocRenamed AS DocIujplRenamed;

SELECT *
FROM @LeftoverBlobs
ORDER BY VendorId;

SELECT
    (SELECT COUNT(*) FROM core.MASTER_DATA_RECORD_T
      WHERE SetKey = N'special-requirement' AND Code = @From) AS MasterIujplLeft,
    (SELECT COUNT(*) FROM core.MASTER_DATA_RECORD_T
      WHERE SetKey = N'special-requirement' AND Code = @To) AS MasterIujptl,
    (SELECT COUNT(*) FROM core.MASTER_DATA_RECORD_T
      WHERE SetKey = N'commodity-subclassification-special-requirement'
        AND Code LIKE N'%|' + @From) AS MappingIujplLeft,
    (SELECT COUNT(*) FROM core.MASTER_DATA_RECORD_T
      WHERE SetKey = N'commodity-subclassification-special-requirement'
        AND Code LIKE N'%|' + @To) AS MappingIujptl,
    (SELECT COUNT(*) FROM vdr.VENDOR_SPECIAL_REQUIREMENT_T
      WHERE SpecialReqCode = @From) AS VendorIujplLeft,
    (SELECT COUNT(*) FROM vdr.VENDOR_SPECIAL_REQUIREMENT_T
      WHERE SpecialReqCode = @To) AS VendorIujptl,
    (SELECT COUNT(*) FROM vdr.VENDOR_DOCUMENT_T
      WHERE LOWER(DocumentType) = N'special-requirement' AND OwnerKey = @From) AS DocIujplLeft,
    (SELECT COUNT(*) FROM vdr.VENDOR_DOCUMENT_T
      WHERE LOWER(DocumentType) = N'special-requirement' AND OwnerKey = @To) AS DocIujptl;
