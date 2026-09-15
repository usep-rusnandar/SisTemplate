# Database Conventions

The backend uses database schemas based on domain ownership.

| Schema | Ownership |
| --- | --- |
| `core` | Shared/cross-module technical tables |
| `iam` | Internal SSO identity, personnel mapping, internal authorization |
| `vdr` | Vendor identity, vendor profile, vendor invitation, vendor users |
| `trk` | Proposal Tracker module-owned data |
| `cip` | Contract Initiation Platform module-owned data |
| `cm` | Contract Monitoring module-owned data |

Current table names remain uppercase with underscores and `_T` suffix, for example:

- `iam.USER_T`
- `iam.SSO_NRP_MAPPING_T`
- `iam.ROLE_T`
- `iam.USER_ROLE_T`
- `iam.PERMISSION_T`
- `iam.ROLE_PERMISSION_T`
- `vdr.USERS_T`
- `vdr.ROLES_T`
- `vdr.VENDOR_T`
- `vdr.VENDOR_USER_T`
- `vdr.INVITATION_T`
- `core.FRONTEND_STATE_T`
- `trk.STATE_T`
- `trk.PROPOSAL_T`
- `trk.PROPOSAL_ACTIVITY_T`
- `trk.LOA_DOCUMENT_T`
- `cip.STATE_T`
- `cip.CASE_T`
- `cip.CASE_DOCUMENT_T`
- `cip.CASE_ACTIVITY_T`
- `cm.STATE_T`
- `cm.CONTRACT_T`
- `cm.CONTRACT_VERSION_T`
- `cm.REMINDER_T`

Column names use Pascal Case, for example `Id`, `PersonnelNo`, `DeletedAt`,
`IdentityUserId`, `NormalizedUserName`, `CreatedAt`, and `UpdatedAt`.

`core.FRONTEND_STATE_T` is retained for shared/platform bridge data. Module
state for completed MVP modules is now routed to module-owned schemas through
domain endpoints:

- Tracker keys with `ag_tracker_` use `/api/v1/tracker/storage` and `trk.STATE_T`.
- CIP keys with `ag_cip_` use `/api/v1/cip/storage` and `cip.STATE_T`.
- Contract Monitoring keys with `ag_cm_` use `/api/v1/contracts/storage` and `cm.STATE_T`.

Tracker workflow state from `ag_tracker_rebuild_v14` is also projected into
normalized module-owned tables:

- `trk.PROPOSAL_T`
- `trk.PROPOSAL_ACTIVITY_T`
- `trk.LOA_DOCUMENT_T`

Tracker read endpoints use these normalized tables when projection data exists.

CIP workflow state from `ag_cip_store_v7` is projected into normalized
module-owned tables:

- `cip.CASE_T`
- `cip.CASE_DOCUMENT_T`
- `cip.CASE_ACTIVITY_T`

CIP read endpoints use these normalized tables when projection data exists.

Contract Monitoring state is projected into normalized module-owned tables:

- `cm.CONTRACT_T`
- `cm.CONTRACT_VERSION_T`
- `cm.REMINDER_T`

`ag_cm_contracts_v1` stores raw contract document rows. The backend projects
these rows using the frontend distinct rule: duplicate `contractId` rows become
one contract in `cm.CONTRACT_T`, while all original and amendment rows remain in
`cm.CONTRACT_VERSION_T`. `ag_cm_reminders_v1` projects reminder history into
`cm.REMINDER_T`.

Contract Monitoring read endpoints use these normalized tables when projection
data exists.

The SISWarrior access-check function is `dbo.CEK_USER_ACCESS_FN(@NRP)`. The
portal calls it with the user's **NRP** (security-team contract) and expects
`'true'`/`'false'`. **NRP and PersonnelNo are the same value** ("NRP" is the
former name of PersonnelNo — an 8-digit numeric id that may carry leading zeros,
e.g. `00109610`), so the function checks `iam.USER_T` **directly** by
`PersonnelNo` (`Status = 'Active'`, `DeletedAt IS NULL`) with no mapping table —
matching `InternalUserAccessService.MapNrpAsync`. Deployed by EF migration
`20260709014500_SimplifyCekUserAccessFnToDirectLookup` (supersedes the join-based
`20260708075412_AddCekUserAccessFn`); ops reference copy at
`tools/database/cek-user-access-fn.sql`. `iam.SSO_NRP_MAPPING_T` has been
**dropped** (migration `20260709023727_DropSsoNrpMappingTable`). Matching is
exact-string, so `PersonnelNo` must be stored as text with leading zeros intact.
