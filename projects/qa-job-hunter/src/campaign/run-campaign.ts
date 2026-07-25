/**
 * Orquestador de campaña QA (#131):
 *   fetch → pipeline → abrir Excel (revisión) → easy-apply → reconcile
 *
 * Modo dry-run (`--dry-run` / CAMPAIGN_DRY_RUN=1):
 *   fetch → pipeline → export Excel (SIN abrir ni pausa) → easy-apply:dry-run → reconcile → abrir Excel
 *
 * No abre Gmail UI ni mailto. Easy Apply canónico = este repo.
 * Applied-list = Gmail / pipeline / reconcile.
 *
 * Flags:
 *   --from=fetch|pipeline|excel|apply|reconcile
 *   --apply-max=N
 *   --skip-apply
 *   --dry-run          (sin Excel mid; apply dry-run; Excel solo al final)
 *   --yes   (sin pausa interactiva tras Excel; útil CI/no-TTY)
 *
 * Env:
 *   APPLIED_LIST_ROOT  path a qa-job-applied-list
 *   APPLY_MAX          mismo efecto que --apply-max
 *   CAMPAIGN_DRY_RUN=1 mismo que --dry-run
 *   DISCOVERY          gmail (default) | linkedin_search (opt-in; no es el camino diario)
 *   NOTIFICATIONS_DISCOVERY  1 (default con gmail) | 0 para omitir post-fetch
 *   NOTIFICATIONS_LOOKBACK_HOURS  default 24 (max 336)
 *   NOTIFICATIONS_MAX_ITEMS       default 5 en campaña
 */

import { spawnSync } from "child_process";
import { createInterface } from "readline/promises";
import { stdin as input, stdout as output } from "process";
import { exportQueueToExcel, importQueueFromExcel, openTrackerExcel } from "../apply/post-run.js";
import { HUNTER_ROOT, resolveAppliedListRoot, runAppliedListScript } from "./applied-list.js";

type Step = "fetch" | "pipeline" | "excel" | "apply" | "reconcile";
type Discovery = "gmail" | "linkedin_search";

const STEPS: Step[] = ["fetch", "pipeline", "excel", "apply", "reconcile"];

function resolveDiscovery(): Discovery {
  const raw = (process.env.DISCOVERY ?? "gmail").trim().toLowerCase();
  if (raw === "linkedin_search" || raw === "linkedin" || raw === "search") {
    return "linkedin_search";
  }
  return "gmail";
}

function envTruthy(name: string): boolean {
  const v = (process.env[name] ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function parseArgs(argv: string[]): {
  from: Step;
  applyMax: number | null;
  skipApply: boolean;
  yes: boolean;
  dryRun: boolean;
  discovery: Discovery;
} {
  let from: Step = "fetch";
  let applyMax: number | null = null;
  let skipApply = false;
  let yes = false;
  let dryRun = envTruthy("CAMPAIGN_DRY_RUN");
  const discovery = resolveDiscovery();

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
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--yes" || arg === "-y") {
      yes = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`Uso: npm run campaign -- [--from=STEP] [--apply-max=N] [--skip-apply] [--dry-run] [--yes]

Orden canónico: gmail:fetch → pipeline → excel (revisión) → apply → reconcile
Dry-run: fetch → pipeline → export (sin abrir Excel) → easy-apply:dry-run → reconcile → abrir Excel

DISCOVERY=gmail (default) | linkedin_search (opt-in; NO usar como fallback diario)
NOTIFICATIONS_DISCOVERY=1 (default) | 0 para omitir discovery LinkedIn Notifications
CAMPAIGN_DRY_RUN=1 | --dry-run
APPLIED_LIST_ROOT=${resolveAppliedListRoot()}
`);
      process.exit(0);
    }
  }

  return { from, applyMax, skipApply, yes, dryRun, discovery };
}

function stepsFrom(from: Step): Step[] {
  const i = STEPS.indexOf(from);
  return STEPS.slice(i);
}

async function pauseForManualExcel(yes: boolean): Promise<void> {
  if (yes || !input.isTTY) {
    console.log("\n⏭  Pausa Excel omitida (--yes o sin TTY). Seguí con Easy Apply.");
    return;
  }
  const rl = createInterface({ input, output });
  try {
    await rl.question(
      "\n⏸  Revisá Excel del Escritorio (pendientes / Notas). " +
        "Cerrá Empleos_Tracker.xlsx y Enter → sigue la campaña… "
    );
  } finally {
    rl.close();
  }
}

function notificationsDiscoveryEnabled(discovery: Discovery): boolean {
  if (discovery !== "gmail") return false;
  const raw = (process.env.NOTIFICATIONS_DISCOVERY ?? "1").trim().toLowerCase();
  return raw !== "0" && raw !== "false" && raw !== "no";
}

function runNotificationsDiscoveryStep(): void {
  const args = ["--merge-applied-list"];
  const lookback = process.env.NOTIFICATIONS_LOOKBACK_HOURS?.trim();
  const maxItems = process.env.NOTIFICATIONS_MAX_ITEMS?.trim();
  if (lookback) args.push(`--lookback-hours=${lookback}`);
  if (maxItems) args.push(`--max-items=${maxItems}`);

  console.log("\n▶ hunter: npm run discover:notifications (post-gmail)");
  const result = spawnSync("npm", ["run", "discover:notifications", "--", ...args], {
    cwd: HUNTER_ROOT,
    stdio: "inherit",
    shell: true,
    env: {
      ...process.env,
      APPLIED_LIST_ROOT: resolveAppliedListRoot(),
    },
  });
  if (result.status !== 0) {
    console.warn(
      "⚠️  discover:notifications falló — la campaña sigue con jobs de Gmail solamente."
    );
  }
}

function runHunterEasyApply(applyMax: number | null, dryRun: boolean): void {
  const env = { ...process.env };
  const script = dryRun ? "easy-apply:dry-run" : "easy-apply";
  if (dryRun) {
    // Hasta N intentos por corrida (sin cortar tras el primer dry_ok).
    env.DRY_RUN_ALL = "1";
    if (applyMax != null && applyMax > 0) {
      env.DRY_RUN_MAX = String(applyMax);
    } else if (!env.DRY_RUN_MAX) {
      env.DRY_RUN_MAX = "10";
    }
  } else if (applyMax != null && applyMax > 0) {
    env.APPLY_MAX = String(applyMax);
  }
  console.log(
    `\n▶ hunter: npm run ${script}` +
      (dryRun
        ? ` (DRY_RUN_MAX=${env.DRY_RUN_MAX})`
        : env.APPLY_MAX
          ? ` (APPLY_MAX=${env.APPLY_MAX})`
          : "")
  );
  const result = spawnSync("npm", ["run", script], {
    cwd: HUNTER_ROOT,
    stdio: "inherit",
    shell: true,
    env,
  });
  if (result.status !== 0) {
    throw new Error(`${script} falló con código ${result.status ?? "null"}`);
  }
}

async function main(): Promise<void> {
  const { from, applyMax, skipApply, yes, dryRun, discovery } = parseArgs(process.argv.slice(2));
  const root = resolveAppliedListRoot();

  console.log("🎯 Campaña QA — orquestador (sub-agentes bajo qa-job-hunter)");
  console.log(`   applied-list: ${root}`);
  console.log(`   discovery: ${discovery}`);
  console.log(`   modo: ${dryRun ? "dry-run (Excel solo al final)" : "productivo"}`);
  console.log(`   desde: ${from}${skipApply ? " (skip-apply)" : ""}`);
  console.log(
    dryRun
      ? "   orden: fetch → pipeline → export → dry-run apply → reconcile → Excel\n"
      : "   orden: fetch → pipeline → Excel (revisión) → apply → reconcile\n"
  );

  if (discovery === "linkedin_search") {
    console.warn(
      "⚠️  DISCOVERY=linkedin_search es opt-in y de baja calidad (cards basura).\n" +
        "   El orquestador NO corre npm run scrape acá: hacelo a mano solo si sabés por qué.\n" +
        "   Camino diario: DISCOVERY=gmail (default) → gmail:fetch → run-pipeline.\n" +
        "   Ver docs/backlog-linkedin-search-scrape.md\n"
    );
  }

  for (const step of stepsFrom(from)) {
    if (step === "fetch") {
      if (discovery !== "gmail") {
        console.log(
          "⏭  fetch Gmail omitido (DISCOVERY≠gmail). Pipeline/apply siguen; discovery LinkedIn search es manual."
        );
        continue;
      }
      runAppliedListScript("gmail:fetch");
      if (!dryRun && notificationsDiscoveryEnabled(discovery)) {
        runNotificationsDiscoveryStep();
      } else if (dryRun) {
        console.log("⏭  Notifications discovery omitido (campaña dry-run).");
      } else if (!notificationsDiscoveryEnabled(discovery)) {
        console.log("⏭  Notifications discovery omitido (NOTIFICATIONS_DISCOVERY=0).");
      }
      continue;
    }
    if (step === "pipeline") {
      runAppliedListScript("run-pipeline");
      continue;
    }
    if (step === "excel") {
      exportQueueToExcel();
      if (dryRun) {
        console.log(
          "\n⏭  Dry-run: no abro Excel ni pausa manual mid-flow → sigo a apply dry-run."
        );
        continue;
      }
      if (yes) {
        console.log(
          "\n⏭  --yes: sin abrir Excel aquí (evita lock). Se abre al final si export OK."
        );
        continue;
      }
      openTrackerExcel();
      await pauseForManualExcel(yes);
      continue;
    }
    if (step === "apply") {
      if (skipApply) {
        console.log("\n⏭  Easy Apply omitido (--skip-apply)");
        continue;
      }
      importQueueFromExcel();
      runHunterEasyApply(applyMax, dryRun);
      continue;
    }
    if (step === "reconcile") {
      runAppliedListScript("gmail:reconcile");
      try {
        runAppliedListScript("excel:refresh", ["--no-open"]);
      } catch {
        console.log("   (excel:refresh omitido o falló — reconcile ya corrió)");
      }
      const exported = exportQueueToExcel();
      if (exported) {
        openTrackerExcel();
        console.log(
          dryRun
            ? "\n✅ Campaña dry-run lista: reconcile OK + Excel abierto al final."
            : "\n✅ Campaña lista: labels Gmail reorganizados + Excel sincronizado."
        );
      } else {
        console.warn(
          "\n⚠️  Reconcile OK pero export Excel falló. Cerrá Empleos_Tracker.xlsx y re-exportá."
        );
      }
    }
  }
}

main().catch((err) => {
  console.error("\n❌ Campaña abortada:", err instanceof Error ? err.message : err);
  process.exit(1);
});
