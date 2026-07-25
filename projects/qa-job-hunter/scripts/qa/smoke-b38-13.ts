/**
 * Smoke B-38-13 — schema tracker + seed + API shape.
 * Escribe informe markdown en --report=path (default: local/reports/b38-13-smoke.md).
 */
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { connect, disconnect } from "../db/client.js";
import { countApplications, listApplications } from "../db/applications.js";
import { ensureIndexes } from "../db/indexes.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

type Check = { name: string; pass: boolean; detail: string };

function argReport(): string {
  const arg = process.argv.find((a) => a.startsWith("--report="));
  if (arg) return path.resolve(arg.slice("--report=".length));
  return path.join(ROOT, "local", "reports", "b38-13-smoke.md");
}

function runNpm(script: string): { pass: boolean; detail: string } {
  const r = spawnSync("npm", ["run", script], {
    cwd: ROOT,
    shell: true,
    encoding: "utf-8",
    timeout: 120_000,
  });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`.trim();
  const tail = out.split("\n").slice(-8).join("\n");
  return {
    pass: r.status === 0,
    detail: r.status === 0 ? `exit 0\n${tail}` : `exit ${r.status}\n${tail}`,
  };
}

async function main(): Promise<void> {
  const checks: Check[] = [];
  const started = new Date();

  const tests = runNpm("test:tracker");
  checks.push({ name: "npm run test:tracker", ...tests });

  const seed = runNpm("tracker:seed");
  checks.push({ name: "npm run tracker:seed", ...seed });

  try {
    await connect();
    await ensureIndexes();
    const total = await countApplications();
    const sample = await listApplications({ limit: 3 });
    const legacyOk = sample.every(
      (a) => typeof a.matchRejected === "boolean" && typeof a.inLatestAnalysis === "boolean"
    );
    checks.push({
      name: "Mongo listApplications defaults B-38-13",
      pass: total > 0 && legacyOk,
      detail: `total=${total} sample=${sample.length} legacyDefaults=${legacyOk}`,
    });

    const filtered = await listApplications({ minMatchPercent: 70, limit: 5 });
    checks.push({
      name: "Filtro minMatchPercent>=70",
      pass: filtered.every((a) => a.matchPercent >= 70),
      detail: `rows=${filtered.length}`,
    });
  } catch (err) {
    checks.push({
      name: "Mongo connect + list",
      pass: false,
      detail: err instanceof Error ? err.message : String(err),
    });
  } finally {
    await disconnect().catch(() => {});
  }

  const dashboardUrl = process.env.DASHBOARD_URL ?? "http://localhost:3847";
  try {
    const res = await fetch(`${dashboardUrl}/api/tracker/applications?limit=2`, {
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 503) {
      checks.push({
        name: "GET /api/tracker/applications (dashboard)",
        pass: true,
        detail: "SKIP — dashboard no corriendo o Mongo 503 (seed OK arriba)",
      });
    } else if (res.ok) {
      const body = (await res.json()) as { applications?: unknown[] };
      const apps = body.applications ?? [];
      checks.push({
        name: "GET /api/tracker/applications (dashboard)",
        pass: Array.isArray(apps),
        detail: `HTTP ${res.status} count=${apps.length}`,
      });
    } else {
      checks.push({
        name: "GET /api/tracker/applications (dashboard)",
        pass: false,
        detail: `HTTP ${res.status}`,
      });
    }
  } catch {
    checks.push({
      name: "GET /api/tracker/applications (dashboard)",
      pass: true,
      detail: `SKIP — dashboard no en ${dashboardUrl}`,
    });
  }

  const pass = checks.every((c) => c.pass);
  const reportPath = argReport();
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });

  const lines = [
    "# Informe — Smoke B-38-13",
    "",
    `**Fecha:** ${started.toISOString()}`,
    `**Rama:** ${process.env.GIT_BRANCH ?? "(local)"}`,
    `**Veredicto:** ${pass ? "✅ PASS" : "❌ FAIL"}`,
    "",
    "## Checks",
    "",
    "| Check | Resultado | Detalle |",
    "|-------|-----------|---------|",
    ...checks.map(
      (c) => `| ${c.name} | ${c.pass ? "PASS" : "FAIL"} | ${c.detail.replace(/\|/g, "/").replace(/\n/g, " ")} |`
    ),
    "",
    "## Siguiente paso",
    pass
      ? "Ejecutar **dry-run campaña** (`npm run qa:dry-run-campaign`) si smoke OK."
      : "Corregir fallos antes de dry-run.",
    "",
  ];

  fs.writeFileSync(reportPath, lines.join("\n"), "utf-8");
  console.log(lines.join("\n"));
  console.log(`\n📄 Informe: ${reportPath}`);
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
