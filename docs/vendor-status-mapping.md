# Vendor status code mapping (for migrating existing data)

Recorded 2026-08-02. The `vendor-status` master-data set (legacy `MSTR_STATUS_T`) owns the vocabulary;
this file is the old → new mapping any data migration must apply.

## Target chain

The approval route **is** the status chain — as of 2026-08-03 there is no workflow engine behind it.
`ApproverRoleCode` says who must act while a vendor sits on the status, `NextId` says where approving
sends it, and `SlaDays` is the working-day target for that wait. All three live in the record's
`PayloadJson`, so re-routing an approval means editing master data.

| Code | Description | NextId | ApproverRoleCode |
|---|---|---|---|
| `SBMIT` | Waiting for Officer Review | `APPR1` | `OFFCR-VDR` |
| `APPR1` | Waiting for Department Head Approval | `APPR2` | `DEPHD-VDR` |
| `APPR2` | Waiting for Division Head Approval | `APPRV` | `DIV-HD` |
| `APPRV` | Vendor has been Approved | `RGSTD` | — (no role = not an approval station) |

The status code and the role code are **separate vocabularies** (2026-08-03, at the user's call): the
status keeps the legacy `APPR1`/`APPR2` tiers and a dedicated `ApproverRoleCode` field names who approves
it. Renaming a role therefore no longer renames a status — only that one field has to follow.

## Old → new

Only two codes actually change, so a historical VendorConnect import needed very little rewriting:

| Old code | New code | Notes |
|---|---|---|
| `DRFT` | `DRAFT` | the app's old spelling; master data always said `DRAFT` |
| `BLCK` | `BLACK` | same |
| `APPR3` | *(retired)* | never existed in master; the route is three approvals |
| `APPR1`, `APPR2` | *unchanged* | kept deliberately — the approver moved into its own field instead |
| `SBMIT` | *unchanged* | description → "Waiting for Officer Review", NextId → `APPR1` |
| `INITL` | *unchanged* | written by Ariba Vendor Import; officer must invite before registration starts |
| `UNBLK` | *(unused)* | present in master, never written by the application |

## Where the codes are stored

A migration has to rewrite every one of these:

| Location | Column | Note |
|---|---|---|
| `vdr.VENDOR_T` | `Status` | `nvarchar(10)` — widened while the codes were role-shaped; kept as headroom |
| `vdr.VENDOR_STATUS_T` | `StatusCode` | the status trail — also the SLA clock and the audit trail |
| `core.MASTER_DATA_T` (set `vendor-status`) | `Code`, `Name`, `PayloadJson.description`, `PayloadJson.nextId` | the master rows themselves; `Code` is 100 chars, no limit problem |
| Seed file | `backend/src/Platform/Persistence/Seeding/SeedData/vendor-status.json` | so a fresh install matches |
| Code constants | `VendorStatuses` (`backend/src/Modules/VendorOnboarding/Domain/VendorStatuses.cs`) | |
| Frontend | `VM_STATUS` (`VendorData.jsx`), `VwVendorStatus` + `VW_EDITABLE_STATUSES` (`VendorWorkspaceScreens.jsx`) | |
| Master editor | `VENDOR_STATUS_CFG` in `MasterLookupEditor.jsx` | code/nextId fields raised from `max: 6` to 10 |

As of 2026-08-02 the vendor tables are empty (all vendor data was deleted at the user's request), so the
rename costs nothing today. The VendorConnect production import (WORK.md V3) later applied this mapping;
that cutover tool is now retired. Existing `VENDOR_CONNECT` source-system rows keep their imported codes.
