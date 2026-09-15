import React from "react";
import { CIPDashboard, CIPTemplates, CIPAuthorizationMaster, CIPRepository } from "../../../modules/contract-initiation-platform/legacy/ContractCIPScreens.jsx";
import { Button, Card } from "../../../shared/legacy/Primitives.jsx";
import { EmptyState } from "../../../shared/legacy/PrimitivesX.jsx";

export function renderCipScreen(route, ctx) {
  if (route === "cipDashboard") return <CIPDashboard onNavigate={ctx.navigate} />;
  if (route === "cipTemplates") return <CIPTemplates />;
  if (route === "cipAuthorization") {
    return ctx.canAccessCipAuthorization
      ? <CIPAuthorizationMaster />
      : (
        <Card style={{ padding: 46 }}>
          <EmptyState
            icon="shield-alert"
            title="Access restricted"
            description="Authorization Master is available only for Administrator Proposal Tracker."
            action={<Button iconLeft="arrow-left" onClick={() => ctx.navigate("trackerDashboard")}>Back to Proposal Tracker</Button>}
          />
        </Card>
      );
  }
  if (route === "cipRepository") return <CIPRepository onNavigate={ctx.navigate} />;
  return null;
}
