/**
 * Dry-run campaña post B-38-13 — informe en local/reports/b38-13-dry-run.md
 */
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function argReport(): string {
  const arg = process.argv.find((a) => a.startsWith("--report="));
  if (arg) return path.resolve(arg.slice("--report=".length));
  return path.join(ROOT, "local", "reports", "b38-13-dry-run.md");
}

function main(): void {
  const started = new Date();
  const env = {
    ...process.env,
    TRACKER_DUAL_WRITE: "1",
    CAMPAIGN_DRY_RUN: "1",
  };

  const r = spawnSync(
    "npm",
    ["run", "campaign", "--", "--dry-run", "--yes"],
    {
      cwd: ROOT,
      shell: true,
      encoding: "utf-8",
      env,
      timeout: 600_000,
    }
  );

  const output = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  const dualWriteOk = /Tracker Mongo:/.test(output);
  const pipelineOk = /Pipeline listo|Sin scrape pendiente/.test(output);
  const reconcileOk = /Campaña dry-run lista|Reconcile OK|gmail:reconcile/.test(output);
  const pass = r.status === 0 && dualWriteOk;

  const reportPath = argReport();
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });

  const tail = output.split("\n").slice(-25).join("\n");
  const lines = [
    "# Informe — Dry-run campaña (B-38-13 gate)",
    "",
    `**Fecha:** ${started.toISOString()}`,
    `**Comando:** TRACKER_DUAL_WRITE=1 npm run campaign -- --dry-run --yes`,
    `**Exit code:** ${r.status ?? "null"}`,
    `**Veredicto:** ${pass ? "✅ PASS" : "❌ FAIL"}`,
    "",
    "## Señales",
    "",
    `| Señal | OK |`,
    `|-------|-----|`,
    `| Pipeline / run-pipeline | ${pipelineOk ? "✅" : "❌"} |`,
    `| Dual-write Mongo (Tracker Mongo:) | ${dualWriteOk ? "✅" : "❌"} |`,
    `| Reconcile / cierre | ${reconcileOk ? "✅" : "⚠️"} |`,
    "",
    "## Últimas líneas stdout",
    "",
    "```",
    tail,
    "```",
    "",
    "## Siguiente paso",
    pass
      ? "Ejecutar **regression** (`npm run qa:regression-b38-13`)."
      : "Revisar log; no avanzar a regression.",
    "",
  ];

  fs.writeFileSync(reportPath, lines.join("\n"), "utf-8");
  console.log(lines.join("\n"));
  console.log(`\n📄 Informe: ${reportPath}`);
  process.exit(pass ? 0 : 1);
}

main();
