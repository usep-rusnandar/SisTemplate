/* Shared metric card used by Tracker and Contract Monitoring dashboards. */
import React from "react";
import { Card, Icon } from "./Primitives.jsx";
import { RADIUS, useC } from "./Tokens.jsx";

function TrkStatCard({ icon, tone, label, value, sub, onClick, valueStyle, valueTitle }) {
  const C = useC();
  const toneMap = {
    brand: { fg: C.ocean, bg: C.brandBg },
    blue: { fg: C.blue, bg: C.infoBg },
    orange: { fg: C.orange, bg: C.scheme === "dark" ? "rgba(240,116,61,0.16)" : "rgba(235,102,46,0.12)" },
    forest: { fg: C.success, bg: C.successBg },
    danger: { fg: C.danger, bg: C.dangerBg },
    neutral: { fg: C.textMuted, bg: C.surfaceAlt },
  };
  const t = toneMap[tone] || toneMap.brand;
  return (
    <Card hover={!!onClick} onClick={onClick} style={{ padding: 16, minHeight: 126 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, color: C.textMuted, fontWeight: 700, lineHeight: 1.35 }}>{label}</div>
          <div title={valueTitle} style={{ marginTop: 11, fontSize: 28, fontWeight: 800, color: C.text, lineHeight: 1, letterSpacing: 0, ...valueStyle }}>{value}</div>
        </div>
        <span style={{ width: 38, height: 38, borderRadius: RADIUS.md, backgroundColor: t.bg, color: t.fg, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon name={icon} size={19} />
        </span>
      </div>
      {sub && <div style={{ marginTop: 10, fontSize: 11.5, color: C.textSubtle, lineHeight: 1.45 }}>{sub}</div>}
    </Card>
  );
}

export { TrkStatCard };
Object.assign(window, { TrkStatCard });
