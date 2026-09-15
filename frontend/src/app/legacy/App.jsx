import React from "react";
import { AppShell } from "./AppShell.jsx";
import { renderSuiteScreen, SuiteMasterDataProviders } from "./screens/suite.jsx";

function App() {
  return <AppShell renderModuleScreen={renderSuiteScreen} MasterDataProviders={SuiteMasterDataProviders} />;
}

export { App };
Object.assign(window, { App });
