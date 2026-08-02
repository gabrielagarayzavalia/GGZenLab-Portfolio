import fs from "fs";
import path from "path";
import { resolveAppliedListRoot } from "../campaign/applied-list.js";
import { connect, disconnect } from "../db/client.js";
import { upsertPipelineMatches, type PipelineUpsertResult } from "../db/applications.js";
import { ensureIndexes } from "../db/indexes.js";
import {
  type PipelineMatchResult,
  type PipelineScrapedJob,
  pipelineMatchToApplicationInput,
  shouldSyncPipelineMatch,
} from "./pipeline-match.js";

const MATCHED_FILE = path.join("data", "matched.json");
const ALL_MATCHES_FILE = path.join("data", "all-matches.json");
const SCRAPED_ALL_FILE = path.join("data", "scraped", "_all.json");

/**
 * Dual-write pipeline → Mongo tracker (B-38-5).
 * `TRACKER_DUAL_WRITE=1` (default) | `0` para omitir.
 * Alias legacy: `TRACKER_DUAL_WRITE_PIPELINE`.
 */
export function isTrackerDualWriteEnabled(): boolean {
  const raw = (
    process.env.TRACKER_DUAL_WRITE ??
    process.env.TRACKER_DUAL_WRITE_PIPELINE ??
    "1"
  )
    .trim()
    .toLowerCase();
  return raw !== "0" && raw !== "false" && raw !== "no";
}

/** @deprecated Usar isTrackerDualWriteEnabled */
export const isPipelineDualWriteEnabled = isTrackerDualWriteEnabled;

export function resolveMatchedJsonPath(appliedListRoot = resolveAppliedListRoot()): string {
  const matched = path.join(appliedListRoot, MATCHED_FILE);
  if (fs.existsSync(matched)) return matched;
  const all = path.join(appliedListRoot, ALL_MATCHES_FILE);
  if (fs.existsSync(all)) return all;
  throw new Error(
    `No se encontró matched.json ni all-matches.json en:\n  ${path.join(appliedListRoot, "data")}\n` +
      "Corré run-pipeline primero."
  );
}

/** Lee MatchResult[] desde applied-list (mismo input que sync-excel.ts). */
export function loadPipelineMatches(appliedListRoot = resolveAppliedListRoot()): PipelineMatchResult[] {
  const src = resolveMatchedJsonPath(appliedListRoot);
  const all = JSON.parse(fs.readFileSync(src, "utf-8")) as PipelineMatchResult[];
  return all.filter(shouldSyncPipelineMatch);
}

/** Mapa jobId → scrape con JD para snapshot analysis. */
export function loadPipelineScrapedJobs(
  appliedListRoot = resolveAppliedListRoot()
): Map<string, PipelineScrapedJob> {
  const scrapedPath = path.join(appliedListRoot, SCRAPED_ALL_FILE);
  if (!fs.existsSync(scrapedPath)) return new Map();

  const rows = JSON.parse(fs.readFileSync(scrapedPath, "utf-8")) as PipelineScrapedJob[];
  return new Map(rows.map((row) => [row.jobId, row]));
}

export async function syncPipelineToTracker(
  appliedListRoot = resolveAppliedListRoot()
): Promise<PipelineUpsertResult | null> {
  if (!isTrackerDualWriteEnabled()) {
    console.log("⏭  Tracker dual-write omitido (TRACKER_DUAL_WRITE=0).");
    return null;
  }

  const matches = loadPipelineMatches(appliedListRoot);
  const scrapedByJobId = loadPipelineScrapedJobs(appliedListRoot);
  if (!matches.length) {
    console.log("📋 Tracker dual-write: 0 matches para sync (filtro MIN_MATCH / skip).");
<<<<<<< HEAD
    return { inserted: 0, updated: 0, skipped: 0, skipped_closed_never_visible: 0 };
=======
    return { inserted: 0, updated: 0, skipped: 0 };
>>>>>>> 485a67351a1c543d74c58d9ab3095bdfaa209e4a
  }

  await connect();
  await ensureIndexes();
  try {
    const result = await upsertPipelineMatches(matches, scrapedByJobId);
<<<<<<< HEAD
    const closedSkip =
      result.skipped_closed_never_visible > 0
        ? ` | ${result.skipped_closed_never_visible} cerrados sin historial (skip insert)`
        : "";
    console.log(
      `📋 Tracker Mongo: +${result.inserted} nuevas | ${result.updated} actualizadas | ${result.skipped} omitidas (estado protegido)${closedSkip}`
=======
    console.log(
      `📋 Tracker Mongo: +${result.inserted} nuevas | ${result.updated} actualizadas | ${result.skipped} omitidas (estado protegido)`
>>>>>>> 485a67351a1c543d74c58d9ab3095bdfaa209e4a
    );
    return result;
  } finally {
    await disconnect();
  }
}

/** @deprecated Usar syncPipelineToTracker */
export const syncPipelineMatchesToTracker = syncPipelineToTracker;

import { fileURLToPath } from "url";

const isMain =
  process.argv[1] != null &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  syncPipelineToTracker().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
