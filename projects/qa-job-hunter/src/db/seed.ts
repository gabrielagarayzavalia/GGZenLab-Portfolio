// ============================================================
//  seed.ts — Seed Mongo from output/jobs-result.json
//  Comando: npm run db:seed
// ============================================================

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { AnalysisResult } from "../types.js";
import { connect, disconnect, getDb } from "./client.js";
import { ensureIndexes } from "./indexes.js";
import { upsertJobs } from "./jobs.js";
import { saveRun } from "./runs.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const RESULTS_PATH = path.join(ROOT, "output", "jobs-result.json");

async function seedSkippedJobs(
  runId: Awaited<ReturnType<typeof saveRun>>,
  skipped: AnalysisResult["skippedJobs"]
): Promise<void> {
  if (!skipped.length) return;
  const db = getDb();
  await db.collection("skipped_jobs").insertMany(
    skipped.map((job) => ({
      ...job,
      runId,
      createdAt: new Date(),
    }))
  );
}

async function main(): Promise<void> {
  if (!fs.existsSync(RESULTS_PATH)) {
    console.error(`\n  No se encontró ${RESULTS_PATH}`);
    console.error("  Ejecutá el análisis primero: npx tsx src/3-analyze-match.ts\n");
    process.exit(1);
  }

  const raw = fs.readFileSync(RESULTS_PATH, "utf-8");
  const result = JSON.parse(raw) as AnalysisResult;

  await connect();
  await ensureIndexes();

  const runId = await saveRun(result, process.env.LLM_PROVIDER);
  const jobCount = await upsertJobs(result.matchedJobs ?? [], runId, result.scrapedAt);
  await seedSkippedJobs(runId, result.skippedJobs ?? []);

  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║           QA JOB HUNTER — MongoDB seed                     ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log(`\n  Run ID     : ${runId.toHexString()}`);
  console.log(`  Jobs       : ${jobCount} upserted`);
  console.log(`  Skipped    : ${result.skippedJobs?.length ?? 0}`);
  console.log(`  Source     : ${RESULTS_PATH}\n`);

  await disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await disconnect().catch(() => {});
  process.exit(1);
});
