import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const sourceRoot = path.resolve(projectRoot, "..", "Mockup", "project");

const files = {
  shared: [
    ["app/Tokens.jsx", "src/shared/legacy/Tokens.jsx"],
    ["app/tweaks-panel.jsx", "src/shared/legacy/tweaks-panel.jsx"],
    ["app/Tweaks.jsx", "src/shared/legacy/Tweaks.jsx"],
    ["app/i18n.jsx", "src/shared/legacy/i18n.jsx"],
    ["app/Primitives.jsx", "src/shared/legacy/Primitives.jsx"],
    ["app/PrimitivesX.jsx", "src/shared/legacy/PrimitivesX.jsx"],
    ["styles/colors_and_type.css", "src/shared/styles/colors-and-type.css"],
  ],
  platform: [
    ["app/Data.jsx", "src/platform/data/legacy/Data.jsx"],
    ["app/MenuData.jsx", "src/platform/navigation/legacy/MenuData.jsx"],
    ["app/Session.jsx", "src/platform/session/legacy/Session.jsx"],
    ["app/Notifications.jsx", "src/platform/notifications/legacy/Notifications.jsx"],
    ["app/Search.jsx", "src/platform/search/legacy/Search.jsx"],
    ["app/Shell.jsx", "src/app/shell/legacy/Shell.jsx"],
    ["app/AccountModals.jsx", "src/platform/account/legacy/AccountModals.jsx"],
    ["app/ScreensAuth.jsx", "src/platform/auth/legacy/ScreensAuth.jsx"],
    ["app/Dashboard.jsx", "src/platform/dashboard/legacy/Dashboard.jsx"],
    ["app/ScreensUsers.jsx", "src/platform/administration/legacy/ScreensUsers.jsx"],
    ["app/ScreensRoles.jsx", "src/platform/administration/legacy/ScreensRoles.jsx"],
    ["app/ScreensPermissions.jsx", "src/platform/administration/legacy/ScreensPermissions.jsx"],
    ["app/ScreensModules.jsx", "src/platform/administration/legacy/ScreensModules.jsx"],
    ["app/ScreensMore.jsx", "src/platform/administration/legacy/ScreensMore.jsx"],
    ["app/ScreensHoliday.jsx", "src/platform/administration/legacy/ScreensHoliday.jsx"],
    ["app/ScreensLang.jsx", "src/platform/administration/legacy/ScreensLang.jsx"],
    ["app/ScreensEmail.jsx", "src/platform/administration/legacy/ScreensEmail.jsx"],
    ["app/ScreensSettings.jsx", "src/platform/settings/legacy/ScreensSettings.jsx"],
    ["app/ScreensMenus.jsx", "src/platform/navigation/legacy/ScreensMenus.jsx"],
    ["app/SettingsStore.jsx", "src/platform/settings/legacy/SettingsStore.jsx"],
    ["app/Lock.jsx", "src/platform/session/legacy/Lock.jsx"],
  ],
  vendorOnboarding: [
    ["app/VendorData.jsx", "src/modules/vendor-onboarding/legacy/VendorData.jsx"],
    ["app/BrandMasterData.jsx", "src/modules/vendor-onboarding/legacy/BrandMasterData.jsx"],
    ["app/KbliMasterData.jsx", "src/modules/vendor-onboarding/legacy/KbliMasterData.jsx"],
    ["app/CountryMasterData.jsx", "src/modules/vendor-onboarding/legacy/CountryMasterData.jsx"],
    ["app/ProvinceMasterData.jsx", "src/modules/vendor-onboarding/legacy/ProvinceMasterData.jsx"],
    ["app/CityMasterData.jsx", "src/modules/vendor-onboarding/legacy/CityMasterData.jsx"],
    ["app/DistrictMasterData.jsx", "src/modules/vendor-onboarding/legacy/DistrictMasterData.jsx"],
    ["app/VillageMasterData.jsx", "src/modules/vendor-onboarding/legacy/VillageMasterData.jsx"],
    ["app/SpecialReqMasterData.jsx", "src/modules/vendor-onboarding/legacy/SpecialReqMasterData.jsx"],
    ["app/CommodityMasterData.jsx", "src/modules/vendor-onboarding/legacy/CommodityMasterData.jsx"],
    ["app/VendorMasterData.jsx", "src/modules/vendor-onboarding/legacy/VendorMasterData.jsx"],
    ["app/VendorScreen.jsx", "src/modules/vendor-onboarding/legacy/VendorScreen.jsx"],
    ["app/ScreensVendorMore.jsx", "src/modules/vendor-onboarding/legacy/ScreensVendorMore.jsx"],
    ["app/ScreensVendorMaster.jsx", "src/modules/vendor-onboarding/legacy/ScreensVendorMaster.jsx"],
    ["app/ScreensBrandMaster.jsx", "src/modules/vendor-onboarding/legacy/ScreensBrandMaster.jsx"],
    ["app/ScreensKbliMaster.jsx", "src/modules/vendor-onboarding/legacy/ScreensKbliMaster.jsx"],
    ["app/ScreensCountryMaster.jsx", "src/modules/vendor-onboarding/legacy/ScreensCountryMaster.jsx"],
    ["app/ScreensProvinceMaster.jsx", "src/modules/vendor-onboarding/legacy/ScreensProvinceMaster.jsx"],
    ["app/ScreensCityMaster.jsx", "src/modules/vendor-onboarding/legacy/ScreensCityMaster.jsx"],
    ["app/ScreensDistrictMaster.jsx", "src/modules/vendor-onboarding/legacy/ScreensDistrictMaster.jsx"],
    ["app/ScreensVillageMaster.jsx", "src/modules/vendor-onboarding/legacy/ScreensVillageMaster.jsx"],
    ["app/ScreensSpecialReqMaster.jsx", "src/modules/vendor-onboarding/legacy/ScreensSpecialReqMaster.jsx"],
    ["app/ScreensCommodityMaster.jsx", "src/modules/vendor-onboarding/legacy/ScreensCommodityMaster.jsx"],
    ["app/ScreensAdminRegions.jsx", "src/modules/vendor-onboarding/legacy/ScreensAdminRegions.jsx"],
    ["app/VendorConnectMasterData.jsx", "src/modules/vendor-onboarding/legacy/VendorConnectMasterData.jsx"],
    ["app/ScreensReadOnlyMaster.jsx", "src/modules/vendor-onboarding/legacy/ScreensReadOnlyMaster.jsx"],
  ],
  vendorWorkspace: [
    ["app/VendorOnboardingData.jsx", "src/modules/vendor-workspace/legacy/VendorOnboardingData.jsx"],
    ["app/VendorRegister.jsx", "src/modules/vendor-workspace/legacy/VendorRegister.jsx"],
    ["app/VendorWorkspaceScreens.jsx", "src/modules/vendor-workspace/legacy/VendorWorkspaceScreens.jsx"],
    ["app/VendorApp.jsx", "src/modules/vendor-workspace/legacy/VendorApp.jsx"],
  ],
  proposalTracker: [
    ["app/TrackerMasterData.jsx", "src/modules/proposal-tracker/legacy/TrackerMasterData.jsx"],
    ["app/TrackerCalendar.jsx", "src/modules/proposal-tracker/legacy/TrackerCalendar.jsx"],
    ["app/TrackerData.jsx", "src/modules/proposal-tracker/legacy/TrackerData.jsx"],
    ["app/TrackerDashboard.jsx", "src/modules/proposal-tracker/legacy/TrackerDashboard.jsx"],
    ["app/TrackerProposals.jsx", "src/modules/proposal-tracker/legacy/TrackerProposals.jsx"],
    ["app/TrackerMore.jsx", "src/modules/proposal-tracker/legacy/TrackerMore.jsx"],
    ["app/ScreensTrackerMaster.jsx", "src/modules/proposal-tracker/legacy/ScreensTrackerMaster.jsx"],
  ],
  contractManagement: [
    ["app/ContractMonData.jsx", "src/modules/contract-monitoring/legacy/ContractMonData.jsx"],
    ["app/ContractMonScreens.jsx", "src/modules/contract-monitoring/legacy/ContractMonScreens.jsx"],
    ["app/ContractImport.jsx", "src/modules/contract-monitoring/legacy/ContractImport.jsx"],
  ],
  contractInitiationPlatform: [
    ["app/ContractCIPData.jsx", "src/modules/contract-initiation-platform/legacy/ContractCIPData.jsx"],
    ["app/ContractCIPScreens.jsx", "src/modules/contract-initiation-platform/legacy/ContractCIPScreens.jsx"],
    ["app/ContractCIPWorkflow.jsx", "src/modules/contract-initiation-platform/legacy/ContractCIPWorkflow.jsx"],
  ],
  app: [
    ["app/App.jsx", "src/app/legacy/App.jsx"],
  ],
};

const internalOrder = [
  ...files.shared,
  ["app/Data.jsx", "src/platform/data/legacy/Data.jsx"],
  ["app/VendorOnboardingData.jsx", "src/modules/vendor-workspace/legacy/VendorOnboardingData.jsx"],
  ["app/MenuData.jsx", "src/platform/navigation/legacy/MenuData.jsx"],
  ["app/TrackerMasterData.jsx", "src/modules/proposal-tracker/legacy/TrackerMasterData.jsx"],
  ["app/Session.jsx", "src/platform/session/legacy/Session.jsx"],
  ["app/Notifications.jsx", "src/platform/notifications/legacy/Notifications.jsx"],
  ["app/Search.jsx", "src/platform/search/legacy/Search.jsx"],
  ["app/Shell.jsx", "src/app/shell/legacy/Shell.jsx"],
  ["app/AccountModals.jsx", "src/platform/account/legacy/AccountModals.jsx"],
  ["app/ScreensAuth.jsx", "src/platform/auth/legacy/ScreensAuth.jsx"],
  ["app/VendorRegister.jsx", "src/modules/vendor-workspace/legacy/VendorRegister.jsx"],
  ["app/Dashboard.jsx", "src/platform/dashboard/legacy/Dashboard.jsx"],
  ["app/ScreensUsers.jsx", "src/platform/administration/legacy/ScreensUsers.jsx"],
  ["app/ScreensRoles.jsx", "src/platform/administration/legacy/ScreensRoles.jsx"],
  ["app/ScreensPermissions.jsx", "src/platform/administration/legacy/ScreensPermissions.jsx"],
  ["app/ScreensModules.jsx", "src/platform/administration/legacy/ScreensModules.jsx"],
  ["app/ScreensMore.jsx", "src/platform/administration/legacy/ScreensMore.jsx"],
  ["app/ScreensHoliday.jsx", "src/platform/administration/legacy/ScreensHoliday.jsx"],
  ["app/ScreensTrackerMaster.jsx", "src/modules/proposal-tracker/legacy/ScreensTrackerMaster.jsx"],
  ["app/ScreensLang.jsx", "src/platform/administration/legacy/ScreensLang.jsx"],
  ["app/ScreensEmail.jsx", "src/platform/administration/legacy/ScreensEmail.jsx"],
  ["app/ScreensSettings.jsx", "src/platform/settings/legacy/ScreensSettings.jsx"],
  ["app/ScreensMenus.jsx", "src/platform/navigation/legacy/ScreensMenus.jsx"],
  ["app/TrackerCalendar.jsx", "src/modules/proposal-tracker/legacy/TrackerCalendar.jsx"],
  ["app/TrackerData.jsx", "src/modules/proposal-tracker/legacy/TrackerData.jsx"],
  ["app/TrackerDashboard.jsx", "src/modules/proposal-tracker/legacy/TrackerDashboard.jsx"],
  ["app/TrackerProposals.jsx", "src/modules/proposal-tracker/legacy/TrackerProposals.jsx"],
  ["app/TrackerMore.jsx", "src/modules/proposal-tracker/legacy/TrackerMore.jsx"],
  ["app/VendorData.jsx", "src/modules/vendor-onboarding/legacy/VendorData.jsx"],
  ["app/BrandMasterData.jsx", "src/modules/vendor-onboarding/legacy/BrandMasterData.jsx"],
  ["app/KbliMasterData.jsx", "src/modules/vendor-onboarding/legacy/KbliMasterData.jsx"],
  ["app/CountryMasterData.jsx", "src/modules/vendor-onboarding/legacy/CountryMasterData.jsx"],
  ["app/ProvinceMasterData.jsx", "src/modules/vendor-onboarding/legacy/ProvinceMasterData.jsx"],
  ["app/CityMasterData.jsx", "src/modules/vendor-onboarding/legacy/CityMasterData.jsx"],
  ["app/DistrictMasterData.jsx", "src/modules/vendor-onboarding/legacy/DistrictMasterData.jsx"],
  ["app/VillageMasterData.jsx", "src/modules/vendor-onboarding/legacy/VillageMasterData.jsx"],
  ["app/SpecialReqMasterData.jsx", "src/modules/vendor-onboarding/legacy/SpecialReqMasterData.jsx"],
  ["app/CommodityMasterData.jsx", "src/modules/vendor-onboarding/legacy/CommodityMasterData.jsx"],
  ["app/VendorMasterData.jsx", "src/modules/vendor-onboarding/legacy/VendorMasterData.jsx"],
  ["app/VendorScreen.jsx", "src/modules/vendor-onboarding/legacy/VendorScreen.jsx"],
  ["app/ScreensVendorMore.jsx", "src/modules/vendor-onboarding/legacy/ScreensVendorMore.jsx"],
  ["app/ScreensVendorMaster.jsx", "src/modules/vendor-onboarding/legacy/ScreensVendorMaster.jsx"],
  ["app/ScreensBrandMaster.jsx", "src/modules/vendor-onboarding/legacy/ScreensBrandMaster.jsx"],
  ["app/ScreensKbliMaster.jsx", "src/modules/vendor-onboarding/legacy/ScreensKbliMaster.jsx"],
  ["app/ScreensCountryMaster.jsx", "src/modules/vendor-onboarding/legacy/ScreensCountryMaster.jsx"],
  ["app/ScreensProvinceMaster.jsx", "src/modules/vendor-onboarding/legacy/ScreensProvinceMaster.jsx"],
  ["app/ScreensCityMaster.jsx", "src/modules/vendor-onboarding/legacy/ScreensCityMaster.jsx"],
  ["app/ScreensDistrictMaster.jsx", "src/modules/vendor-onboarding/legacy/ScreensDistrictMaster.jsx"],
  ["app/ScreensVillageMaster.jsx", "src/modules/vendor-onboarding/legacy/ScreensVillageMaster.jsx"],
  ["app/ScreensSpecialReqMaster.jsx", "src/modules/vendor-onboarding/legacy/ScreensSpecialReqMaster.jsx"],
  ["app/ScreensCommodityMaster.jsx", "src/modules/vendor-onboarding/legacy/ScreensCommodityMaster.jsx"],
  ["app/ScreensAdminRegions.jsx", "src/modules/vendor-onboarding/legacy/ScreensAdminRegions.jsx"],
  ["app/VendorConnectMasterData.jsx", "src/modules/vendor-onboarding/legacy/VendorConnectMasterData.jsx"],
  ["app/ScreensReadOnlyMaster.jsx", "src/modules/vendor-onboarding/legacy/ScreensReadOnlyMaster.jsx"],
  ["app/VendorWorkspaceScreens.jsx", "src/modules/vendor-workspace/legacy/VendorWorkspaceScreens.jsx"],
  ["app/ContractMonData.jsx", "src/modules/contract-monitoring/legacy/ContractMonData.jsx"],
  ["app/ContractMonScreens.jsx", "src/modules/contract-monitoring/legacy/ContractMonScreens.jsx"],
  ["app/ContractImport.jsx", "src/modules/contract-monitoring/legacy/ContractImport.jsx"],
  ["app/ContractCIPData.jsx", "src/modules/contract-initiation-platform/legacy/ContractCIPData.jsx"],
  ["app/ContractCIPScreens.jsx", "src/modules/contract-initiation-platform/legacy/ContractCIPScreens.jsx"],
  ["app/ContractCIPWorkflow.jsx", "src/modules/contract-initiation-platform/legacy/ContractCIPWorkflow.jsx"],
  ["app/SettingsStore.jsx", "src/platform/settings/legacy/SettingsStore.jsx"],
  ["app/Lock.jsx", "src/platform/session/legacy/Lock.jsx"],
  ["app/App.jsx", "src/app/legacy/App.jsx"],
];

const externalOrder = [
  ...files.shared,
  ["app/AccountModals.jsx", "src/platform/account/legacy/AccountModals.jsx"],
  ["app/VendorOnboardingData.jsx", "src/modules/vendor-workspace/legacy/VendorOnboardingData.jsx"],
  ["app/VendorWorkspaceScreens.jsx", "src/modules/vendor-workspace/legacy/VendorWorkspaceScreens.jsx"],
  ["app/VendorRegister.jsx", "src/modules/vendor-workspace/legacy/VendorRegister.jsx"],
  ["app/VendorApp.jsx", "src/modules/vendor-workspace/legacy/VendorApp.jsx"],
];

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function copyFile(source, target) {
  const sourcePath = path.join(sourceRoot, source);
  const targetPath = path.join(projectRoot, target);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing source file: ${sourcePath}`);
  }
  ensureDir(targetPath);
  let content = fs.readFileSync(sourcePath);
  if (target.endsWith("colors-and-type.css")) {
    content = Buffer.from(
      content
        .toString("utf8")
        .replace("@import url('../vendor/fonts/plus-jakarta-sans.css');", "@import url('/vendor/fonts/plus-jakarta-sans.css');"),
      "utf8",
    );
  }
  fs.writeFileSync(targetPath, content);
}

function copyDirectory(source, target) {
  const sourcePath = path.join(sourceRoot, source);
  const targetPath = path.join(projectRoot, target);
  if (!fs.existsSync(sourcePath)) return;
  fs.rmSync(targetPath, { recursive: true, force: true });
  fs.cpSync(sourcePath, targetPath, { recursive: true });
}

function normalizePublicFontCss() {
  const cssPath = path.join(projectRoot, "public", "vendor", "fonts", "plus-jakarta-sans.css");
  if (!fs.existsSync(cssPath)) return;
  const css = fs
    .readFileSync(cssPath, "utf8")
    .replaceAll("url(pjs-1.woff2)", "url('/vendor/fonts/pjs-1.woff2')")
    .replaceAll("url(pjs-2.woff2)", "url('/vendor/fonts/pjs-2.woff2')")
    .replaceAll("url(pjs-3.woff2)", "url('/vendor/fonts/pjs-3.woff2')")
    .replaceAll("url(pjs-4.woff2)", "url('/vendor/fonts/pjs-4.woff2')");
  fs.writeFileSync(cssPath, css);
}

function normalizeModulePath(target) {
  const from = path.join(projectRoot, "src", "app", "bootstrap");
  const to = path.join(projectRoot, target);
  return path.relative(from, to).replaceAll(path.sep, "/");
}

function moduleName(target) {
  return path.basename(target).replace(/[^a-zA-Z0-9]/g, "_");
}

function writeLegacyRegistry(name, entries) {
  entries = entries.filter((entry) => entry[1].endsWith(".jsx"));
  const out = path.join(projectRoot, "src", "app", "bootstrap", `${name}LegacyModules.ts`);
  ensureDir(out);
  const imports = entries.map((entry, index) => `import m${String(index).padStart(2, "0")}_${moduleName(entry[1])} from "${normalizeModulePath(entry[1])}?raw";`).join("\n");
  const rows = entries
    .map((entry, index) => `  { name: "${entry[0]}", source: m${String(index).padStart(2, "0")}_${moduleName(entry[1])} },`)
    .join("\n");
  fs.writeFileSync(
    out,
    `${imports}\n\nimport type { LegacyModule } from "./legacyRuntime";\n\nexport const ${name}LegacyModules: LegacyModule[] = [\n${rows}\n];\n`,
  );
}

const uniqueFiles = new Map(Object.values(files).flat().map((entry) => [entry[1], entry]));
for (const entry of uniqueFiles.values()) {
  copyFile(entry[0], entry[1]);
}

copyDirectory("assets", "public/assets");
copyDirectory("vendor/fonts", "public/vendor/fonts");
normalizePublicFontCss();

writeLegacyRegistry("internal", internalOrder);
writeLegacyRegistry("external", externalOrder);

console.log(`Synced ${uniqueFiles.size} legacy files into MockupVite.`);
