// Cierre de corrida productiva: export Excel y abrir tracker (sin mailto / sin abrir Gmail).

import { execFileSync, spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SYNC_SCRIPT = path.join(ROOT, "scripts", "sync-empleos-tracker.py");
const DEFAULT_XLSX = path.join(
  process.env.USERPROFILE ?? "C:\\Users\\gabri",
  "OneDrive",
  "Escritorio",
  "Empleos_Tracker.xlsx"
);

export function resolveTrackerXlsx(): string {
  return process.env.EMPLEOS_TRACKER_XLSX ?? DEFAULT_XLSX;
}

function sleepSync(ms: number): void {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    /* Excel a veces suelta el lock en 1–2s */
  }
}

/** Exporta cola → Empleos_Tracker.xlsx (reintenta si el archivo está bloqueado). */
export function exportQueueToExcel(maxAttempts = 3): boolean {
  const xlsx = resolveTrackerXlsx();
  if (!fs.existsSync(SYNC_SCRIPT)) {
    console.error(`   ✗ No está ${SYNC_SCRIPT}`);
    return false;
  }
  console.log(`\n📤 Exportando cola → Excel…`);
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      execFileSync("python", [SYNC_SCRIPT, "export", xlsx], {
        cwd: ROOT,
        stdio: "inherit",
        shell: false,
      });
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const locked = /Permission denied|EPERM|EBUSY|being used by another/i.test(msg);
      console.error(
        `   ✗ Export Excel falló (intento ${attempt}/${maxAttempts})${
          locked ? " — cerrá Empleos_Tracker.xlsx si está abierto" : ""
        }`
      );
      if (attempt < maxAttempts) sleepSync(2000);
      else {
        console.error(
          "   ✗ Export sin éxito. La cola CSV ya tiene enviada; re-exportá al cerrar Excel."
        );
      }
    }
  }
  return false;
}

/** Abre el Excel del tracker para revisión / postulación manual. */
export function openTrackerExcel(): void {
  const xlsx = resolveTrackerXlsx();
  if (!fs.existsSync(xlsx)) {
    console.error(`   ✗ No se encontró Excel: ${xlsx}`);
    return;
  }
  console.log(`📂 Abriendo Excel: ${xlsx}`);
  if (process.platform === "win32") {
    spawn("cmd", ["/c", "start", "", xlsx], { detached: true, stdio: "ignore" }).unref();
  } else {
    spawn("xdg-open", [xlsx], { detached: true, stdio: "ignore" }).unref();
  }
}

/**
 * Fin de corrida productiva: export Excel.
 * Abrir archivo solo con OPEN_EXCEL=1 (default: no abrir).
 */
export function finishProductiveRun(): void {
  exportQueueToExcel();
  const openExcel = process.env.OPEN_EXCEL === "1" || process.env.OPEN_EXCEL === "true";
  if (openExcel) {
    openTrackerExcel();
    console.log("\n✅ Cierre: Excel exportado y abierto. No se abre Gmail/mailto.");
  } else {
    console.log("\n✅ Cierre: cola exportada a Excel (sin abrir; OPEN_EXCEL=1 para abrir).");
  }
  console.log("   Siguiente (campaña): postulación manual en Excel → gmail:reconcile.");
}
