import React from "react";
import { TrackerMasterProvider } from "../../../modules/proposal-tracker/legacy/TrackerMasterData.jsx";
import { TrackerDashboard } from "../../../modules/proposal-tracker/legacy/TrackerDashboard.jsx";
import { TrackerProposals } from "../../../modules/proposal-tracker/legacy/TrackerProposals.jsx";
import { TrackerOverdue } from "../../../modules/proposal-tracker/legacy/TrackerMore.jsx";
import { TrackerStepMaster, TrackerMethodMaster } from "../../../modules/proposal-tracker/legacy/ScreensTrackerMaster.jsx";
import { CIPProposalEmbeddedActivities, CIPWorkflow } from "../../../modules/contract-initiation-platform/legacy/ContractCIPWorkflow.jsx";
import { renderCipScreen } from "./cip.jsx";

export function TrackerMasterDataProviders({ children }) {
  return <TrackerMasterProvider>{children}</TrackerMasterProvider>;
}

function renderProposalWorkspace(ctx, preferTermSheetView) {
  return (
    <TrackerProposals
      onNavigate={ctx.navigate}
      initialArg={ctx.navArg}
      initialProposal={ctx.navArg}
      onConsumeInitial={ctx.onConsumeInitial}
      preferTermSheetView={!!preferTermSheetView}
      renderTermSheetView={(props) => <CIPWorkflow {...props} />}
      renderCipActivityEmbed={(props) => <CIPProposalEmbeddedActivities {...props} />}
    />
  );
}

export function renderProposalTrackerScreen(route, ctx) {
  if (route === "trackerDashboard") return <TrackerDashboard onNavigate={ctx.navigate} />;
  if (route === "trackerProposals") return renderProposalWorkspace(ctx, false);
  if (route === "cipWorkflow") return renderProposalWorkspace(ctx, true);
  if (route === "trackerOverdue") return <TrackerOverdue />;
  if (route === "trackerStep") return <TrackerStepMaster />;
  if (route === "trackerMethod") return <TrackerMethodMaster />;
  return renderCipScreen(route, ctx);
}
