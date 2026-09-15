import React from "react";
import { AppShell } from "./AppShell.jsx";
import { renderVendorOnboardingScreen, VendorOnboardingMasterDataProviders } from "./screens/vendorOnboarding.jsx";

export function App() {
  return <AppShell renderModuleScreen={renderVendorOnboardingScreen} MasterDataProviders={VendorOnboardingMasterDataProviders} />;
}
