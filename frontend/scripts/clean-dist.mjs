/* Remove the whole dist folder so a split build never sits next to stale artifacts
   from an older combined build. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist");
fs.rmSync(dist, { recursive: true, force: true });
