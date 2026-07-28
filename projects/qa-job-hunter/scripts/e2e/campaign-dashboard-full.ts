/**
 * E2E: Gmail → notifications 24h → pipeline → EA dry-run headless → reconcile
 * → jobs-result + db:seed → verifica match-jobs con analysis.
 */
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { connect, disconnect } from "../../src/db/client.js";
import { composeMatchJobs } from "../../src/dashboard/match-jobs.js";
import { resolveAppliedListRoot } from "../../src/campaign/applied-list.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const REPORT_DIR = path.join(ROOT, "local", "reports");

function argFlag(name: string): boolean {
  return process.argv.includes(name);
}

function run(cmd: string, args: string[], env: NodeJS.ProcessEnv): { ok: boolean; output: string } {
  const r = spawnSync(cmd, args, {
    cwd: ROOT,
    shell: true,
    encoding: "utf-8",
    env,
    timeout: 1_800_000,
    maxBuffer: 20 * 1024 * 1024,
  });
  const output = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  return { ok: r.status === 0, output };
}

async function verifyDashboardAnalysis(): Promise<{
  total: number;
  withAnalysis: number;
  withSkills: number;
  samples: Array<{ title: string; skills: number; hasDesc: boolean }>;
}> {
  await connect();
  try {
    const payload = await composeMatchJobs();
    const withAnalysis = payload.matchedJobs.filter(
      (j) =>
        Boolean(j.description?.trim()) &&
        !j.description.includes("corrida anterior") &&
        (j.matchedSkills?.length ?? 0) > 0
    );
    return {
      total: payload.matchedJobs.length,
      withAnalysis: withAnalysis.length,
      withSkills: withAnalysis.length,
      samples: withAnalysis.slice(0, 5).map((j) => ({
        title: j.title.slice(0, 50),
        skills: j.matchedSkills?.length ?? 0,
        hasDesc: Boolean(j.description && j.description.length > 80),
      })),
    };
  } finally {
    await disconnect();
  }
}

async function main(): Promise<void> {
  const started = new Date();
  const skipApply = argFlag("--skip-apply");
  const appliedRoot = resolveAppliedListRoot();

  if (!fs.existsSync(path.join(appliedRoot, "package.json"))) {
    throw new Error(`applied-list no encontrado: ${appliedRoot}`);
  }

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    TRACKER_DUAL_WRITE: "1",
    NOTIFICATIONS_LOOKBACK_HOURS: process.env.NOTIFICATIONS_LOOKBACK_HOURS ?? "24",
    NOTIFICATIONS_MAX_ITEMS: process.env.NOTIFICATIONS_MAX_ITEMS ?? "30",
    PLAYWRIGHT_HEADLESS: "1",
    EA_HEADLESS: "1",
    DRY_RUN_MAX: process.env.DRY_RUN_MAX ?? "5",
    APPLIED_LIST_ROOT: appliedRoot,
  };

  const logs: string[] = [];

  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║     E2E dashboard — Gmail + notifications + pipeline        ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  const steps: Array<{ label: string; ok: boolean }> = [];

  const fetch = run("npm", ["run", "campaign", "--", "--from=fetch", "--yes", "--skip-apply"], env);
  logs.push(fetch.output);
  steps.push({ label: "gmail:fetch + notifications 24h", ok: fetch.ok });
  if (!fetch.ok) throw new Error(`Fetch/notifications falló.\n${fetch.output.slice(-3000)}`);

  const pipeline = run("npm", ["run", "agent:pipeline"], env);
  logs.push(pipeline.output);
  steps.push({ label: "run-pipeline + dual-write + jobs-result", ok: pipeline.ok });
  if (!pipeline.ok) throw new Error(`Pipeline falló.\n${pipeline.output.slice(-3000)}`);

  if (!skipApply) {
    const dryRun = run("npm", ["run", "easy-apply:dry-run"], env);
    logs.push(dryRun.output);
    steps.push({ label: "easy-apply:dry-run headless", ok: dryRun.ok });
    if (!dryRun.ok) {
      console.warn("⚠️  EA dry-run falló — sigo con reconcile (no bloqueante para dashboard).");
    }
  }

  const reconcile = run(
    "npm",
    ["run", "campaign", "--", "--from=reconcile", "--yes", "--skip-apply"],
    env
  );
  logs.push(reconcile.output);
  steps.push({ label: "gmail:reconcile + excel export", ok: reconcile.ok });
  if (!reconcile.ok) console.warn("⚠️  Reconcile falló — verifico dashboard igual.");

  const seed = run("npm", ["run", "db:seed"], env);
  logs.push(seed.output);
  steps.push({ label: "db:seed", ok: seed.ok });
  if (!seed.ok) throw new Error(`db:seed falló.\n${seed.output.slice(-2000)}`);

  let verify: Awaited<ReturnType<typeof verifyDashboardAnalysis>>;
  try {
    verify = await verifyDashboardAnalysis();
  } catch (err) {
    throw new Error(
      `Verificación Mongo: ${err instanceof Error ? err.message : err} — ¿docker compose up -d?`
    );
  }

  const pass = verify.withSkills >= 1;
  const reportPath = path.join(REPORT_DIR, "e2e-dashboard-full.md");
  fs.mkdirSync(REPORT_DIR, { recursive: true });

  const lines = [
    "# E2E dashboard full",
    "",
    `**Fecha:** ${started.toISOString()}`,
    `**Veredicto:** ${pass ? "✅ PASS" : "❌ FAIL"}`,
    "",
    "## Pasos",
    "",
    ...steps.map((s) => `- ${s.ok ? "✅" : "❌"} ${s.label}`),
    "",
    "## Dashboard",
    "",
    `| Total | Con JD+skills |`,
    `|-------|---------------|`,
    `| ${verify.total} | ${verify.withSkills} |`,
    "",
    "```json",
    JSON.stringify(verify.samples, null, 2),
    "```",
    "",
    "## Log tail",
    "",
    "```",
    logs.join("\n").split("\n").slice(-40).join("\n"),
    "```",
  ];

  fs.writeFileSync(reportPath, lines.join("\n"), "utf-8");
  console.log(`\n📄 Informe: ${reportPath}`);
  console.log(
    pass
      ? `\n✅ E2E OK — ${verify.withSkills} job(s) con analysis. http://localhost:3847/`
      : `\n❌ Sin jobs con analysis (withSkills=0). Ver informe.`
  );

  if (!pass) process.exit(1);
}

main().catch((err) => {
  console.error("\n❌ E2E abortado:", err instanceof Error ? err.message : err);
  process.exit(1);
});
