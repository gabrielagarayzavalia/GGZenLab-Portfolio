/**
 * Mata un proceso y sus hijos (#324 — huérfanos Playwright tras botonera web).
 */
import { spawnSync } from "child_process";

export function killProcessTree(pid: number): { ok: boolean; detail: string } {
  if (!Number.isFinite(pid) || pid <= 0) {
    return { ok: false, detail: "PID inválido" };
  }

  if (process.platform === "win32") {
    const r = spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], {
      encoding: "utf-8",
    });
    const detail = [r.stdout, r.stderr].filter(Boolean).join("\n").trim();
    if (r.status === 0) return { ok: true, detail: detail || "taskkill OK" };
    const notFound = /not found|no se encuentra|no existe/i.test(detail);
    return { ok: notFound, detail: detail || `exit ${r.status}` };
  }

  spawnSync("pkill", ["-TERM", "-P", String(pid)]);
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    /* ya terminó */
  }
  spawnSync("pkill", ["-KILL", "-P", String(pid)]);
  try {
    process.kill(pid, "SIGKILL");
  } catch {
    /* ya terminó */
  }
  return { ok: true, detail: "pkill/kill" };
}
