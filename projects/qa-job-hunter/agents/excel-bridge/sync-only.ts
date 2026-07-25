/** Export cola Easy Apply → Empleos_Tracker.xlsx (sin abrir Excel). */
import { exportQueueToExcel } from "../../src/apply/post-run.js";

const ok = exportQueueToExcel();
if (!ok) process.exit(1);
console.log("\n✅ apply:sync — cola exportada a Empleos_Tracker (sin abrir).");
