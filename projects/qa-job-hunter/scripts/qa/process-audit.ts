/**
 * Auditoría rápida de procesos tras Easy Apply (#324).
 *   npm run qa:process-audit
 */
import { spawnSync } from "child_process";

function countWindowsImage(imageName: string): number {
  const r = spawnSync("tasklist", ["/FI", `IMAGENAME eq ${imageName}`, "/FO", "CSV", "/NH"], {
    encoding: "utf-8",
    shell: true,
  });
  const out = (r.stdout || "").trim();
  if (!out || /no tasks/i.test(out) || /no hay tareas/i.test(out)) return 0;
  return out.split(/\r?\n/).filter((line) => line.trim().length > 0).length;
}

function main(): void {
  console.log("\n=== QA process audit ===\n");
  if (process.platform === "win32") {
    const chrome = countWindowsImage("chrome.exe");
    const msedge = countWindowsImage("msedge.exe");
    const node = countWindowsImage("node.exe");
    console.log(`chrome.exe   : ${chrome}`);
    console.log(`msedge.exe   : ${msedge}`);
    console.log(`node.exe     : ${node}`);
    if (chrome > 8 || node > 12) {
      console.log("\n⚠️  Muchos procesos — revisá Administrador de tareas o usá Detener en /run.");
    } else {
      console.log("\n✓ Conteos normales (heurística).");
    }
  } else {
    const r = spawnSync("ps", ["-eo", "comm"], { encoding: "utf-8" });
    const lines = (r.stdout || "").split(/\r?\n/);
    const chrome = lines.filter((l) => /chrome|chromium/i.test(l)).length;
    const node = lines.filter((l) => /^node/.test(l.trim())).length;
    console.log(`chrome/chromium lines: ${chrome}`);
    console.log(`node lines          : ${node}`);
  }
  console.log("");
}

main();
