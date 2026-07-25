// Seed Mongo applications desde Empleos_Tracker.xlsx (solo lectura — no escribe Excel).
// Comando: npm run tracker:seed

import { connect, disconnect } from "./client.js";
import { ensureIndexes } from "./indexes.js";
import { upsertApplicationsBulk, countApplications } from "./applications.js";
import { assertExcelReadable } from "../tracker/excel-path.js";
import {
  importRowToApplicationInput,
  readEmpleosFromXlsx,
} from "../tracker/import-xlsx.js";

async function main(): Promise<void> {
  const xlsxPath = assertExcelReadable();
  const rows = await readEmpleosFromXlsx(xlsxPath);
  if (!rows.length) {
    console.error("\n  No se encontraron filas en hoja Empleos.\n");
    process.exit(1);
  }

  await connect();
  await ensureIndexes();

  const inputs = rows.map(importRowToApplicationInput);
  const { upserted, modified } = await upsertApplicationsBulk(inputs, "import");
  const total = await countApplications();

  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║           QA JOB HUNTER — Tracker seed (applications)       ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log(`\n  Fuente     : ${xlsxPath}`);
  console.log(`  Filas Excel: ${rows.length}`);
  console.log(`  Upserted   : ${upserted}`);
  console.log(`  Modified   : ${modified}`);
  console.log(`  Total DB   : ${total}\n`);

  await disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await disconnect().catch(() => {});
  process.exit(1);
});
