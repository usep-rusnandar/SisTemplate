import React from "react";
import { TrackerMasterProvider } from "../../../modules/proposal-tracker/legacy/TrackerMasterData.jsx";
import { VendorWorkspaceProfile } from "../../../modules/vendor-workspace/legacy/VendorWorkspaceScreens.jsx";
import { renderVendorOnboardingScreen, VendorOnboardingMasterDataProviders } from "./vendorOnboarding.jsx";
import { renderProposalTrackerScreen } from "./proposalTracker.jsx";
import { renderCipScreen } from "./cip.jsx";
import { renderContractMonitoringScreen } from "./contractMonitoring.jsx";

export function SuiteMasterDataProviders({ children }) {
  return (
    <TrackerMasterProvider>
      <VendorOnboardingMasterDataProviders>
        {children}
      </VendorOnboardingMasterDataProviders>
    </TrackerMasterProvider>
  );
}

export function renderSuiteScreen(route, ctx) {
  return renderVendorOnboardingScreen(route, ctx)
    || renderProposalTrackerScreen(route, ctx)
    || renderCipScreen(route, ctx)
    || renderContractMonitoringScreen(route, ctx)
    || (route === "vwDashboard" ? <VendorWorkspaceProfile onNavigate={ctx.navigate} /> : null);
}
