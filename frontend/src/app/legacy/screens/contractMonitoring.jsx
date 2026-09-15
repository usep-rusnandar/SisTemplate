import React from "react";
import { ContractMonDashboard, ContractDatabase, ContractExpiry } from "../../../modules/contract-monitoring/legacy/ContractMonScreens.jsx";
import { ContractImport } from "../../../modules/contract-monitoring/legacy/ContractImport.jsx";
import { ContractMaterialSync } from "../../../modules/contract-monitoring/legacy/ContractMaterial.jsx";

export function renderContractMonitoringScreen(route, ctx) {
  if (route === "cmDashboard") return <ContractMonDashboard onNavigate={ctx.navigate} />;
  if (route === "cmDatabase") return <ContractDatabase onNavigate={ctx.navigate} />;
  if (route === "cmExpiry") return <ContractExpiry />;
  if (route === "cmImport") return <ContractImport onNavigate={ctx.navigate} />;
  if (route === "cmMaterialSync") return <ContractMaterialSync onNavigate={ctx.navigate} />;
  return null;
}
