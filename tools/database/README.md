# Database Scripts

Scripts in this folder support the SQL Server database for Integrated
Procurement.

Important identity rule:

- SISWarrior returns NRP.
- The SSO mapping layer translates NRP to `PERSONNEL_NO`.
- Backend domain, authorization, audit logging, and database access use
  `PERSONNEL_NO`.

Run `phase4-initial-identity-vendor-schema.sql` first, then run
`cek-user-access-fn.sql` after `USER_T` exists.

Phase 4 generated:

- `phase4-initial-identity-vendor-schema.sql`: idempotent EF Core SQL script for
  internal identity, vendor Identity, Vendor Onboarding, invitations, and
  invitation attempts.
- `cek-user-access-fn.sql`: SQL Server function that checks active internal
  access by `PERSONNEL_NO`.
- `copy-iam-users-prod-to-staging.py`: upsert Production `iam.USER_T` + roles +
  `ManagerUserId` onto Staging. Read-only on Production. Used by the one-shot
  GitHub Action, not by local `PROCUREMENT_DB`.
