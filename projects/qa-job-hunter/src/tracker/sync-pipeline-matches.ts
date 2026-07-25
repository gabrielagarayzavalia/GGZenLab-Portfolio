import fs from "fs";
import path from "path";
import { resolveAppliedListRoot } from "../campaign/applied-list.js";
import { connect, disconnect } from "../db/client.js";
import { upsertPipelineMatches, type PipelineUpsertResult } from "../db/applications.js";
import { ensureIndexes } from "../db/indexes.js";
import {
  type PipelineMatchResult,
  shouldSyncPipelineMatch,
} from "./pipeline-match.js";

const MATCHED_FILE = path.join("data", "matched.json");
const ALL_MATCHES_FILE = path.join("data", "all-matches.json");

/** `TRACKER_DUAL_WRITE_PIPELINE=0` desactiva sync post-pipeline (default: activo). */
export function isPipelineDualWriteEnabled(): boolean {
  const raw = (process.env.TRACKER_DUAL_WRITE_PIPELINE ?? "1").trim().toLowerCase();
  return raw !== "0" && raw !== "false" && raw !== "no";
}

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

export function loadPipelineMatches(appliedListRoot = resolveAppliedListRoot()): PipelineMatchResult[] {
  const src = resolveMatchedJsonPath(appliedListRoot);
  const all = JSON.parse(fs.readFileSync(src, "utf-8")) as PipelineMatchResult[];
  return all.filter(shouldSyncPipelineMatch);
}

export async function syncPipelineMatchesToTracker(
  appliedListRoot = resolveAppliedListRoot()
): Promise<PipelineUpsertResult | null> {
  if (!isPipelineDualWriteEnabled()) {
    console.log("⏭  Tracker dual-write pipeline omitido (TRACKER_DUAL_WRITE_PIPELINE=0).");
    return null;
  }

  const matches = loadPipelineMatches(appliedListRoot);
  if (!matches.length) {
    console.log("📋 Tracker dual-write: 0 matches para sync (filtro MIN_MATCH / skip).");
    return { inserted: 0, updated: 0, skipped: 0 };
  }

  await connect();
  await ensureIndexes();
  try {
    const result = await upsertPipelineMatches(matches);
    console.log(
      `📋 Tracker Mongo: +${result.inserted} nuevas | ${result.updated} actualizadas | ${result.skipped} omitidas (estado protegido)`
    );
    return result;
  } finally {
    await disconnect();
  }
}

const isMain = Boolean(process.argv[1]?.includes("sync-pipeline-matches"));
if (isMain) {
  syncPipelineMatchesToTracker().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
