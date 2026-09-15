import { createElement } from "react";
import { createRoot } from "react-dom/client";
import "../../shared/styles/colors-and-type.css";
import "./legacy-shell.css";
import { installApiBackedStorage } from "./apiBackedStorage";
import { installHostGlobals } from "./legacyRuntime";
import { VendorApp } from "../../modules/vendor-workspace/legacy/VendorApp.jsx";

void (async () => {
  installHostGlobals("external");
  // The vendor portal principal has no internal module permissions, so it must not hydrate the
  // internal domain storage (proposal-tracker / cip / contract-monitoring) — those calls only ever
  // returned 401. Bridge frontend-state stays: vendors are authorized for it once signed in.
  await installApiBackedStorage("integrated-procurement", { domainRoutes: [] });
  const root = document.getElementById("root");
  if (!root) throw new Error("Vendor portal #root is missing");
  createRoot(root).render(createElement(VendorApp));
})();
