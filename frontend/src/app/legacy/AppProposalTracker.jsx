import React from "react";
import { AppShell } from "./AppShell.jsx";
import { renderProposalTrackerScreen, TrackerMasterDataProviders } from "./screens/proposalTracker.jsx";

export function App() {
  return <AppShell renderModuleScreen={renderProposalTrackerScreen} MasterDataProviders={TrackerMasterDataProviders} />;
}
