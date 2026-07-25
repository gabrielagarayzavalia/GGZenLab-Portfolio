import type { QueueRow } from "../apply/apply-queue.js";
import { connect } from "../db/client.js";
import { upsertEasyApplyQueueRow } from "../db/applications.js";
import { ensureIndexes } from "../db/indexes.js";
import { isTrackerDualWriteEnabled } from "./pipeline-sync.js";

let syncChain: Promise<void> = Promise.resolve();
let indexesReady = false;

/**
 * Dual-write cola EA → Mongo (B-38-6).
 * Encadena writes para evitar carreras por jobId.
 */
export function scheduleApplyQueueSync(row: QueueRow): void {
  if (!isTrackerDualWriteEnabled()) return;
  if (!row.jobId?.trim()) return;

  syncChain = syncChain
    .then(async () => {
      await connect();
      if (!indexesReady) {
        await ensureIndexes();
        indexesReady = true;
      }
      await upsertEasyApplyQueueRow(row);
    })
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`⚠ Tracker EA dual-write (${row.jobId}): ${msg}`);
    });
}

/** Espera writes EA pendientes (fin de corrida / tests). */
export function flushApplyQueueSync(): Promise<void> {
  return syncChain;
}

export async function syncApplyQueueRowToTracker(row: QueueRow): Promise<void> {
  if (!isTrackerDualWriteEnabled()) return;
  scheduleApplyQueueSync(row);
  await flushApplyQueueSync();
}
