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

  await db.collection("applications").createIndexes([
    { key: { jobId: 1 }, name: "applications_jobId", sparse: true },
    {
      key: { linkedinUrlNorm: 1 },
      name: "applications_linkedinUrlNorm",
      unique: true,
      partialFilterExpression: { linkedinUrlNorm: { $gt: "" } },
    },
    { key: { estado: 1, updatedAt: -1 }, name: "applications_estado_updatedAt" },
    { key: { empresa: 1, puesto: 1 }, name: "applications_empresa_puesto" },
    {
      key: { matchRejected: 1, estado: 1, matchPercent: -1 },
      name: "applications_matchRejected_estado_match",
    },
    {
      key: { inLatestAnalysis: 1, matchPercent: -1 },
      name: "applications_inLatestAnalysis_match",
    },
  ]);
}
