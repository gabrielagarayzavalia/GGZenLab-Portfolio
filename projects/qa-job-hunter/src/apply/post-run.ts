// Cierre de corrida productiva: export Excel, abrir tracker, mail de pendientes.

import { execFileSync, spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { APPLY_QUEUE_PATH, loadQueue } from "./apply-queue.js";

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

/** Abre el Excel del tracker para revisión manual. */
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

function pendingManualLines(): string[] {
  const rows = loadQueue().filter((r) => r.status === "pendiente");
  return rows.map(
    (r) =>
      `- [${r.matchPercent}%] ${r.company} — ${r.title}\n  ${r.url}\n  razón: ${r.reason || "pendiente"}`
  );
}

/**
 * Abre el cliente de mail con resumen de pendientes (mailto).
 * Destino: APPLY_REPORT_EMAIL o LI_EMAIL o vacío (el usuario completa).
 */
export function openPendingMailDraft(): void {
  const lines = pendingManualLines();
  const to =
    process.env.APPLY_REPORT_EMAIL ??
    process.env.LI_EMAIL ??
    "";
  const subject = encodeURIComponent(
    `[QA Job Hunter] Pendientes Easy Apply (${lines.length}) — revisión manual`
  );
  const body = encodeURIComponent(
    [
      "Hola,",
      "",
      "Corrida Easy Apply finalizada. Quedan pendientes para postulación manual:",
      "",
      ...(lines.length ? lines : ["(ninguno pendiente en la cola)"]),
      "",
      `Cola: ${APPLY_QUEUE_PATH}`,
      `Excel: ${resolveTrackerXlsx()}`,
      "",
      "— qa-job-hunter",
    ].join("\n")
  );
  const mailto = `mailto:${encodeURIComponent(to)}?subject=${subject}&body=${body}`;
  console.log(`\n✉️  Abriendo borrador de mail (${lines.length} pendiente(s))…`);
  if (process.platform === "win32") {
    spawn("cmd", ["/c", "start", "", mailto], { detached: true, stdio: "ignore" }).unref();
  } else {
    spawn("xdg-open", [mailto], { detached: true, stdio: "ignore" }).unref();
  }
}

/** Fin de corrida productiva: export + mail + abrir Excel. */
export function finishProductiveRun(): void {
  exportQueueToExcel();
  openPendingMailDraft();
  openTrackerExcel();
  console.log("\n✅ Cierre: Excel actualizado, mail de pendientes y Excel abierto.");
}
