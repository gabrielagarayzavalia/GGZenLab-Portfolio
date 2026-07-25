/**
 * Regression gate B-38-13 — suite de tests npm + informe.
 */
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const SUITES = [
  "test:tracker",
  "test:api",
  "test:run-apply",
  "test:config-bank",
  "test:apply-notes",
] as const;

function argReport(): string {
  const arg = process.argv.find((a) => a.startsWith("--report="));
  if (arg) return path.resolve(arg.slice("--report=".length));
  return path.join(ROOT, "local", "reports", "b38-13-regression.md");
}

function runSuite(script: string): { pass: boolean; detail: string; skipped: boolean } {
  const r = spawnSync("npm", ["run", script], {
    cwd: ROOT,
    shell: true,
    encoding: "utf-8",
    timeout: 180_000,
  });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  const skipped = /# skipped|t\.skip/.test(out) && r.status === 0;
  const tail = out.split("\n").slice(-6).join("\n");
  return {
    pass: r.status === 0,
    skipped,
    detail: `exit ${r.status ?? "null"}\n${tail}`,
  };
}

function main(): void {
  const started = new Date();
  const rows: { suite: string; pass: boolean; skipped: boolean; detail: string }[] = [];

  for (const suite of SUITES) {
    const r = runSuite(suite);
    rows.push({ suite, ...r });
  }

  const hardFail = rows.some((r) => !r.pass);
  const pass = !hardFail;

  const reportPath = argReport();
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });

  const lines = [
    "# Informe — Regression B-38-13",
    "",
    `**Fecha:** ${started.toISOString()}`,
    `**Veredicto:** ${pass ? "✅ PASS" : "❌ FAIL"}`,
    "",
    "## Suites",
    "",
    "| Suite | Resultado | Notas |",
    "|-------|-----------|-------|",
    ...rows.map((r) => {
      const status = r.pass ? (r.skipped ? "PASS (skips)" : "PASS") : "FAIL";
      return `| npm run ${r.suite} | ${status} | ${r.detail.replace(/\|/g, "/").replace(/\n/g, " ").slice(0, 120)} |`;
    }),
    "",
    "## Siguiente paso",
    pass
      ? "Gate QA local OK → **probar en prod** (campaña real con revisión Excel)."
      : "Corregir suites fallidas antes de prod.",
    "",
  ];

  fs.writeFileSync(reportPath, lines.join("\n"), "utf-8");
  console.log(lines.join("\n"));
  console.log(`\n📄 Informe: ${reportPath}`);
  process.exit(pass ? 0 : 1);
}

main();
