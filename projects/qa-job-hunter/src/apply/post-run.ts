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

/** Exporta cola → Empleos_Tracker.xlsx */
export function exportQueueToExcel(): boolean {
  const xlsx = resolveTrackerXlsx();
  if (!fs.existsSync(SYNC_SCRIPT)) {
    console.error(`   ✗ No está ${SYNC_SCRIPT}`);
    return false;
  }
  try {
    console.log(`\n📤 Exportando cola → Excel…`);
    execFileSync("python", [SYNC_SCRIPT, "export", xlsx], {
      cwd: ROOT,
      stdio: "inherit",
      shell: false,
    });
    return true;
  } catch (err) {
    console.error("   ✗ Export Excel falló:", err);
    return false;
  }
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

/** Fin de corrida productiva: export + abrir Excel (reconcile Gmail es otro paso). */
export function finishProductiveRun(): void {
  exportQueueToExcel();
  openTrackerExcel();
  console.log("\n✅ Cierre: Excel actualizado y abierto. No se abre Gmail/mailto.");
  console.log("   Siguiente (campaña): postulación manual en Excel → gmail:reconcile.");
}
