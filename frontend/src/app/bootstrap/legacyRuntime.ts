import * as Babel from "@babel/standalone";
import * as React from "react";
import * as ReactDOM from "react-dom";
import * as ReactDOMClient from "react-dom/client";
import * as lucide from "lucide";
import * as XLSX from "xlsx";

export type LegacyEdition = "internal" | "external";

export type AppPortal =
  | "suite"
  | "external"
  | "vendor-onboarding"
  | "proposal-tracker"
  | "contract-monitoring";

export type LegacyModule = {
  name: string;
  source: string;
};

type LegacyWindow = Window & {
  React: typeof React;
  ReactDOM: typeof ReactDOM & typeof ReactDOMClient;
  lucide: typeof lucide;
  XLSX: typeof XLSX;
  __APP_EDITION: LegacyEdition;
  APP_EDITION: LegacyEdition;
  __APP_PORTAL: AppPortal;
  __APP_IS_DEV: boolean;
};

function createLucideCompat() {
  return {
    ...lucide,
    createIcons(options?: Parameters<typeof lucide.createIcons>[0]) {
      return lucide.createIcons(options ?? { icons: lucide.icons });
    },
  } as typeof lucide;
}

function createReactDomCompat() {
  return {
    ...ReactDOM,
    ...ReactDOMClient,
  } as typeof ReactDOM & typeof ReactDOMClient;
}

export function installHostGlobals(edition: LegacyEdition, portal?: AppPortal) {
  const w = window as unknown as LegacyWindow;
  w.React = React;
  w.ReactDOM = createReactDomCompat();
  w.lucide = createLucideCompat();
  w.XLSX = XLSX;
  w.__APP_EDITION = edition;
  w.APP_EDITION = edition;
  w.__APP_PORTAL = portal || (edition === "external" ? "external" : "suite");
  // True only on the Vite dev server; false in production builds. Used to expose testing-only UI
  // (e.g. the manual "completed date" input in Tracker) that must stay hidden in production.
  w.__APP_IS_DEV = !!import.meta.env.DEV;
}

function runClassicScript(module: LegacyModule) {
  const transformed = Babel.transform(module.source, {
    filename: module.name,
    presets: [["react", { runtime: "classic" }]],
    sourceType: "script",
  }).code;

  if (!transformed) {
    throw new Error(`Babel produced empty output for ${module.name}`);
  }

  const script = document.createElement("script");
  script.type = "text/javascript";
  script.text = `${transformed}\n//# sourceURL=${module.name}`;
  document.body.appendChild(script);
}

export function bootLegacyApp(edition: LegacyEdition, modules: LegacyModule[]) {
  installHostGlobals(edition);

  for (const module of modules) {
    runClassicScript(module);
  }
}
