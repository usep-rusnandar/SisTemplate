import React from "react";
import { AppShell } from "./AppShell.jsx";
import { renderContractMonitoringScreen } from "./screens/contractMonitoring.jsx";

export function App() {
  return <AppShell renderModuleScreen={renderContractMonitoringScreen} />;
}
