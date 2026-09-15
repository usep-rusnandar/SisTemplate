# Integrated Procurement MockupVite

React + Vite + TypeScript host for the accepted `Mockup/project` application.

The goal of this folder is feature and workflow parity with the legacy mockup while moving the source into the Phase 1 frontend structure:

```text
src/
  app/
  platform/
  shared/
  modules/
    vendor-onboarding/
    vendor-workspace/
    proposal-tracker/
    contract-initiation-platform/
    contract-monitoring/
```

## Commands

```bash
npm install
npm run dev
npm run build
npm run lint
```

`npm run sync:mockup` copies the legacy mockup source, assets, and fonts from `../Mockup/project` into the modular `src/` and `public/` folders. It also regenerates the internal and vendor legacy module manifests.

`predev` and `prebuild` run the sync automatically.

## Entry Points

`index.html` boots the internal enterprise admin portal.

`vendor.html` boots the external Vendor Workspace portal.

## Parity Strategy

The accepted mockup files are preserved as `legacy/*.jsx` under the new module boundaries. TypeScript bootstrap files in `src/app/bootstrap` load them in the same order as the original static HTML pages and expose React, ReactDOM, and lucide as browser globals.

This keeps UI, wording, localStorage behavior, and workflow transitions as close as possible to the original while establishing the target Vite/TypeScript structure for incremental production migration.
