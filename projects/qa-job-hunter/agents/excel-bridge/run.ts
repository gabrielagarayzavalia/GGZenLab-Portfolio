/** Agente: excel-bridge — export cola hunter + abrir Empleos_Tracker.xlsx. */
import { exportQueueToExcel, openTrackerExcel } from "../../src/apply/post-run.js";

exportQueueToExcel();
openTrackerExcel();
console.log("\n✅ Excel bridge: tracker exportado y abierto (sin mailto/Gmail).");
