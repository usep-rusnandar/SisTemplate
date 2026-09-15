/* Post-build step for the external (vendor portal) artifact.
   The Vite entry is vendor.html, but a standalone host expects index.html at the
   site root — rename it and fail loudly if an internal chunk ever leaks into the artifact. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.resolve(frontendRoot, process.argv[2] || path.join("dist", "external"));

const from = path.join(outDir, "vendor.html");
const to = path.join(outDir, "index.html");
if (!fs.existsSync(from)) {
  console.error(`finalize-external: ${from} not found — did the external build run?`);
  process.exit(1);
}
fs.renameSync(from, to);

// Safety gate: the public artifact must not contain the internal entry chunk...
const assetsDir = path.join(outDir, "assets");
const leaked = fs.readdirSync(assetsDir).filter((f) => f.startsWith("internal-"));
if (leaked.length > 0) {
  console.error(`finalize-external: internal chunk leaked into the external artifact: ${leaked.join(", ")}`);
  process.exit(1);
}

// ...nor internal module source. Distinctive internal-only identifiers survive minification.
const INTERNAL_MARKERS = ["TrackerDashboard", "ContractCIPWorkflow", "ScreensPermissions", "dev-login"];
for (const file of fs.readdirSync(assetsDir).filter((f) => f.endsWith(".js"))) {
  const content = fs.readFileSync(path.join(assetsDir, file), "utf8");
  const hits = INTERNAL_MARKERS.filter((m) => content.includes(m));
  if (hits.length > 0) {
    console.error(`finalize-external: internal source leaked into ${file}: ${hits.join(", ")}`);
    process.exit(1);
  }
}

console.log(`finalize-external: ${path.relative(frontendRoot, outDir)} ready (vendor.html -> index.html, no internal code).`);
