// Abre Playwright Codegen para grabar un flujo y guardar el script generado.
// Uso:
//   npm run playwright:ide -- --url=https://www.linkedin.com/jobs/view/123 --label=simple
//   npm run playwright:ide -- --url=<job> --label=multistep --flow=easy_apply
// La grabación se guarda en recordings/easy-apply/<label|timestamp>.spec.ts

import path from "path";
import { ensureDirs, RECORDINGS_DIR } from "./apply/paths.js";
import { openPlaywrightIde, type FailureFlow } from "./apply/failure-handler.js";

const args = process.argv.slice(2);
function getArg(name: string): string | undefined {
  const eq = args.find((a) => a.startsWith(`${name}=`));
  if (eq) return eq.slice(name.length + 1);
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const url = getArg("--url") ?? "https://www.linkedin.com/jobs/";
const flow = (getArg("--flow") ?? "easy_apply") as FailureFlow;
const jobId = getArg("--jobId");
const reason = getArg("--reason") ?? "Grabación manual del flujo Easy Apply (B17-01)";

const rawLabel = getArg("--label");
const label = rawLabel ? slugify(rawLabel) : `rec-${new Date().toISOString().replace(/[:.]/g, "-")}`;

ensureDirs();
const outFile = path.join(RECORDINGS_DIR, `${label}.spec.ts`);

openPlaywrightIde({ url, flow, jobId, reason, outFile, wait: true });

console.log("Playwright IDE lanzado. Interactuá con el flujo y cerrá la ventana al terminar.");
console.log(`El script grabado quedará en: ${outFile}`);
