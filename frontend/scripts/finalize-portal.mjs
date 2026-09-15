/* Post-build step for a module-portal artifact.
   Vite emits <portal>.html; the gateway expects index.html. Fail if another
   business module's distinctive screen identifier leaked into this bundle. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORTALS = {
  "vendor-onboarding": {
    html: "vendor-onboarding.html",
    forbidden: ["TrackerDashboard", "CIPWorkflow", "ContractMonDashboard"],
  },
  "proposal-tracker": {
    html: "proposal-tracker.html",
    forbidden: ["VendorRegistry", "ContractMonDashboard"],
  },
  "contract-monitoring": {
    html: "contract-monitoring.html",
    forbidden: ["VendorRegistry", "TrackerDashboard", "CIPWorkflow"],
  },
};

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const portal = process.argv[2];
const spec = PORTALS[portal];
if (!spec) {
  console.error(`finalize-portal: unknown portal "${portal}"`);
  process.exit(1);
}

const outDir = path.resolve(frontendRoot, process.argv[3] || path.join("dist", portal));
const from = path.join(outDir, spec.html);
const to = path.join(outDir, "index.html");
if (!fs.existsSync(from)) {
  console.error(`finalize-portal: ${from} not found — did the ${portal} build run?`);
  process.exit(1);
}
fs.renameSync(from, to);

const assetsDir = path.join(outDir, "assets");
for (const file of fs.readdirSync(assetsDir).filter((f) => f.endsWith(".js"))) {
  const content = fs.readFileSync(path.join(assetsDir, file), "utf8");
  const hits = spec.forbidden.filter((m) => content.includes(m));
  if (hits.length > 0) {
    console.error(`finalize-portal: ${portal} leaked ${hits.join(", ")} into ${file}`);
    process.exit(1);
  }
}

console.log(`finalize-portal: ${path.relative(frontendRoot, outDir)} ready (${spec.html} -> index.html).`);
