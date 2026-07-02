import { getDb } from "./client.js";

export async function ensureIndexes(): Promise<void> {
  const db = getDb();

  await db.collection("jobs").createIndexes([
    { key: { url: 1 }, unique: true, name: "jobs_url_unique" },
    { key: { matchPercent: -1 }, name: "jobs_matchPercent" },
    { key: { scrapedAt: -1 }, name: "jobs_scrapedAt" },
  ]);

  await db.collection("analysis_runs").createIndexes([
    { key: { scrapedAt: -1 }, name: "runs_scrapedAt" },
  ]);

  await db.collection("skipped_jobs").createIndexes([
    { key: { runId: 1 }, name: "skipped_runId" },
  ]);
}
