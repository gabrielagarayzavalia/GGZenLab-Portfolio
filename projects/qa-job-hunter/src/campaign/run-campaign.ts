/**
 * Orquestador de campaña QA:
 *   fetch → pipeline → easy-apply → abrir Excel (pausa) → reconcile
 *
 * No abre Gmail UI ni mailto. Reconcile solo reorganiza labels tras editar Excel.
 *
 * Flags:
 *   --from=fetch|pipeline|apply|excel|reconcile
 *   --apply-max=N
 *   --skip-apply
 *   --yes   (sin pausa interactiva tras Excel; útil CI/no-TTY)
 *
 * Env:
 *   APPLIED_LIST_ROOT  path a qa-job-applied-list
 *   APPLY_MAX          mismo efecto que --apply-max
 */

import { spawnSync } from "child_process";
import { createInterface } from "readline/promises";
import { stdin as input, stdout as output } from "process";
import { exportQueueToExcel, openTrackerExcel } from "../apply/post-run.js";
import { HUNTER_ROOT, resolveAppliedListRoot, runAppliedListScript } from "./applied-list.js";

type Step = "fetch" | "pipeline" | "apply" | "excel" | "reconcile";

const STEPS: Step[] = ["fetch", "pipeline", "apply", "excel", "reconcile"];

function parseArgs(argv: string[]): {
  from: Step;
  applyMax: number | null;
  skipApply: boolean;
  yes: boolean;
} {
  let from: Step = "fetch";
  let applyMax: number | null = null;
  let skipApply = false;
  let yes = false;

  for (const arg of argv) {
    if (arg.startsWith("--from=")) {
      const v = arg.slice("--from=".length) as Step;
      if (!STEPS.includes(v)) {
        throw new Error(`--from inválido: ${v}. Usá: ${STEPS.join("|")}`);
      }
      from = v;
    } else if (arg.startsWith("--apply-max=")) {
      applyMax = Number(arg.slice("--apply-max=".length));
      if (!Number.isFinite(applyMax) || applyMax < 0) {
        throw new Error(`--apply-max inválido: ${arg}`);
      }
    } else if (arg === "--skip-apply") {
      skipApply = true;
    } else if (arg === "--yes" || arg === "-y") {
      yes = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`Uso: npm run campaign -- [--from=STEP] [--apply-max=N] [--skip-apply] [--yes]

Orden: fetch → pipeline → apply → excel (pausa) → reconcile

APPLIED_LIST_ROOT=${resolveAppliedListRoot()}
`);
      process.exit(0);
    }
  }

  return { from, applyMax, skipApply, yes };
}

function stepsFrom(from: Step): Step[] {
  const i = STEPS.indexOf(from);
  return STEPS.slice(i);
}

async function pauseForManualExcel(yes: boolean): Promise<void> {
  if (yes || !input.isTTY) {
    console.log("\n⏭  Pausa Excel omitida (--yes o sin TTY). Seguí con reconcile.");
    return;
  }
  const rl = createInterface({ input, output });
  try {
    await rl.question(
      "\n⏸  Postulá lo manual en Excel y actualizá estados. Enter cuando termines → reconcile… "
    );
  } finally {
    rl.close();
  }
}

function runHunterEasyApply(applyMax: number | null): void {
  const env = { ...process.env };
  if (applyMax != null && applyMax > 0) {
    env.APPLY_MAX = String(applyMax);
  } else if (process.env.APPLY_MAX) {
    // ya viene del entorno
  }
  console.log(`\n▶ hunter: npm run easy-apply${env.APPLY_MAX ? ` (APPLY_MAX=${env.APPLY_MAX})` : ""}`);
  const result = spawnSync("npm", ["run", "easy-apply"], {
    cwd: HUNTER_ROOT,
    stdio: "inherit",
    shell: true,
    env,
  });
  if (result.status !== 0) {
    throw new Error(`easy-apply falló con código ${result.status ?? "null"}`);
  }
}

async function main(): Promise<void> {
  const { from, applyMax, skipApply, yes } = parseArgs(process.argv.slice(2));
  const root = resolveAppliedListRoot();

  console.log("🎯 Campaña QA — orquestador (sub-agentes bajo qa-job-hunter)");
  console.log(`   applied-list: ${root}`);
  console.log(`   desde: ${from}${skipApply ? " (skip-apply)" : ""}`);
  console.log("   orden: fetch → pipeline → apply → Excel → reconcile\n");

  for (const step of stepsFrom(from)) {
    if (step === "fetch") {
      runAppliedListScript("gmail:fetch");
      continue;
    }
    if (step === "pipeline") {
      runAppliedListScript("run-pipeline");
      continue;
    }
    if (step === "apply") {
      if (skipApply) {
        console.log("\n⏭  Easy Apply omitido (--skip-apply)");
        continue;
      }
      runHunterEasyApply(applyMax);
      continue;
    }
    if (step === "excel") {
      // Si venimos de apply, finishProductiveRun ya exportó/abrió; reforzamos por si --from=excel
      exportQueueToExcel();
      openTrackerExcel();
      await pauseForManualExcel(yes);
      continue;
    }
    if (step === "reconcile") {
      runAppliedListScript("gmail:reconcile");
      // Refrescar Excel desde applied-list si existe el script
      try {
        runAppliedListScript("excel:refresh");
      } catch {
        console.log("   (excel:refresh omitido o falló — reconcile ya corrió)");
      }
      exportQueueToExcel();
      console.log("\n✅ Campaña lista: labels Gmail reorganizados + Excel sincronizado.");
    }
  }
}

main().catch((err) => {
  console.error("\n❌ Campaña abortada:", err instanceof Error ? err.message : err);
  process.exit(1);
});
