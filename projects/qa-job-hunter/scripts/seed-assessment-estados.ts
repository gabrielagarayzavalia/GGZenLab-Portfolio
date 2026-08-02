/**
 * Seed QA: 2 applications con A-pendiente / A-realizado para dashboard #410.
 * No toca Gmail ni Excel. Idempotente por jobId fijo.
 *
 * Uso: npm run qa:seed-assessment-estados
 */
import { connect, disconnect } from "../src/db/client.js";
import { ensureIndexes } from "../src/db/indexes.js";
import { upsertReconcileRows } from "../src/db/applications.js";

const FIXTURES = [
  {
    jobId: "qa-seed-assess-pending",
    matchPercent: 82,
    puesto: "QA Automation Engineer (seed A-pendiente)",
    empresa: "SeedCo Assess",
    linkedinUrl: "https://www.linkedin.com/jobs/view/qa-seed-assess-pending/",
    linkedinUrlNorm: "https://www.linkedin.com/jobs/view/qa-seed-assess-pending",
    canal: "Easy Apply",
    estado: "A-pendiente" as const,
    proximoPaso: "Gmail Entrevistas-Assessments/Pendientes",
    notas: "Seed spike #414 — QA dashboard assessment_pending",
  },
  {
    jobId: "qa-seed-assess-done",
    matchPercent: 78,
    puesto: "SDET (seed A-realizado)",
    empresa: "SeedCo Assess",
    linkedinUrl: "https://www.linkedin.com/jobs/view/qa-seed-assess-done/",
    linkedinUrlNorm: "https://www.linkedin.com/jobs/view/qa-seed-assess-done",
    canal: "Externo",
    estado: "A-realizado" as const,
    proximoPaso: "Gmail Entrevistas-Assessments/Realizados",
    notas: "Seed spike #414 — QA dashboard applied bucket",
  },
];

async function main(): Promise<void> {
  await connect();
  await ensureIndexes();

  const result = await upsertReconcileRows(FIXTURES);

  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║     QA seed — assessment estados Mongo (#414 / #410)        ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log(`\n  Insertadas : ${result.inserted}`);
  console.log(`  Actualizadas: ${result.updated}`);
  console.log(`  Omitidas   : ${result.skipped}`);
  console.log(`  jobIds     : ${FIXTURES.map((f) => f.jobId).join(", ")}\n`);

  await disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await disconnect().catch(() => {});
  process.exit(1);
});
