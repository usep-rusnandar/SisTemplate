# Integrated Procurement MockupVite

React + Vite + TypeScript host for the internal frontend foundation.

This workspace now keeps only the reusable internal shell and platform/admin surfaces:

```text
src/
  app/
  platform/
  shared/
```

Procurement-specific module portals and their legacy HTML entry points were removed so `index.html` is the single Vite entry. Branding strings remain unchanged for the separate rebrand pass.

## Commands

```bash
npm ci
npm run dev
npm run build
npm run lint
```

`npm run sync:mockup` still mirrors the accepted mockup assets into this folder when needed.

## Entry Point

`index.html` boots the internal SPA shell.

## Notes

The remaining app keeps the legacy React runtime-Babel patterns where required, but the build now emits only the internal bundle.
