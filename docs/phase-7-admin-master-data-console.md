# Phase 7 - Admin and Master Data Console

## Scope

Phase 7 implements API-driven frontend shells for the changed MockupVite operator areas:

- Super Admin
- Administration
- Master Data

`D:\Projects\IntegratedProcurement\MockupVite` remains the visual and workflow reference only. All generated code is contained under `D:\Projects\IntegratedProcurement\Code`.

## Frontend Routes

- `/super-admin`
  - Modules
  - Permissions
  - Menus
  - Languages
  - Language Text
  - Email Templates
  - Email Sent
  - Audit
  - Settings
- `/administration`
  - Users
  - Roles
  - Role Permissions
- `/master-data`
  - Holiday
  - Tracker Step
  - Tracker Method
  - CIP Authorization
  - Vendor Relationship
  - Vendor Document Requirement
  - Brand
  - KBLI
  - Country
  - ReadOnly Master

The frontend does not use `localStorage`, `sessionStorage`, or `indexedDB`. Page state is component state only; business data is loaded from backend API endpoints.

## Backend API

Super Admin:

- `GET /api/v1/super-admin/overview`
- `GET /api/v1/super-admin/modules`
- `GET /api/v1/super-admin/permissions`
- `GET /api/v1/super-admin/menus`
- `GET /api/v1/super-admin/languages`
- `GET /api/v1/super-admin/language-text`
- `GET /api/v1/super-admin/email-templates`
- `GET /api/v1/super-admin/email-sent`
- `GET /api/v1/super-admin/audit`
- `GET /api/v1/super-admin/settings`

Administration:

- `GET /api/v1/administration/overview`
- `GET /api/v1/administration/users`
- `GET /api/v1/administration/roles`
- `GET /api/v1/administration/role-permissions`

Master Data:

- `GET /api/v1/master-data/overview`
- `GET /api/v1/master-data/sets`
- `GET /api/v1/master-data/sets/{key}`

## Notes

- These endpoints are read-model contracts for Phase 7 foundation work.
- CRUD command endpoints should be added in later phases per bounded context.
- Internal users remain outside ASP.NET Core Identity and must resolve through `PersonnelNo`.
- Vendor Identity tables remain separate from internal `USER_T`.
