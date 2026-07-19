// Resolución del root de qa-job-applied-list y helpers para invocar sus agentes.

import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const HUNTER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Default: sibling under QA-portfolio (mismo usuario). Override con APPLIED_LIST_ROOT. */
export function resolveAppliedListRoot(): string {
  if (process.env.APPLIED_LIST_ROOT) {
    return path.resolve(process.env.APPLIED_LIST_ROOT);
  }
  const sibling = path.resolve(
    HUNTER_ROOT,
    "..",
    "..",
    "..",
    "QA-portfolio",
    "projects",
    "qa-job-applied-list"
  );
  const alt = path.resolve(
    process.env.USERPROFILE ?? "",
    "projects",
    "QA-portfolio",
    "projects",
    "qa-job-applied-list"
  );
  if (fs.existsSync(path.join(sibling, "package.json"))) return sibling;
  if (fs.existsSync(path.join(alt, "package.json"))) return alt;
  return sibling;
}

export function assertAppliedListRoot(root: string): void {
  if (!fs.existsSync(path.join(root, "package.json"))) {
    throw new Error(
      `No se encontró qa-job-applied-list en:\n  ${root}\n` +
        `Definí APPLIED_LIST_ROOT apuntando al proyecto con gmail:fetch / run-pipeline / gmail:reconcile.`
    );
  }
}

/** Corre un script npm del applied-list (stdio inherit). */
export function runAppliedListScript(script: string, extraArgs: string[] = []): void {
  const root = resolveAppliedListRoot();
  assertAppliedListRoot(root);
  console.log(`\n▶ applied-list: npm run ${script}${extraArgs.length ? " -- " + extraArgs.join(" ") : ""}`);
  console.log(`  cwd: ${root}`);
  const result = spawnSync(
    "npm",
    ["run", script, ...(extraArgs.length ? ["--", ...extraArgs] : [])],
    {
      cwd: root,
      stdio: "inherit",
      shell: true,
      env: process.env,
    }
  );
  if (result.status !== 0) {
    throw new Error(`applied-list "${script}" falló con código ${result.status ?? "null"}`);
  }
}

export { HUNTER_ROOT };
