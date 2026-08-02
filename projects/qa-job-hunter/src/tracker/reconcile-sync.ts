import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { resolveTrackerXlsx } from "../apply/post-run.js";
import { connect, disconnect } from "../db/client.js";
import { upsertReconcileRows, type ReconcileUpsertResult } from "../db/applications.js";
import { ensureIndexes } from "../db/indexes.js";
import { readEmpleosFromXlsx } from "./import-xlsx.js";
import { isTrackerDualWriteEnabled } from "./pipeline-sync.js";
import { excelRowToReconcileFields, isReconcileSyncableRow } from "./reconcile-row-map.js";

/**
 * Dual-write reconcile → Mongo applications (B-23-02).
 * Lee Excel post-reconcile y propaga estado a applications matcheadas.
 */
export async function syncReconcileToTracker(
  xlsxPath = resolveTrackerXlsx()
): Promise<ReconcileUpsertResult | null> {
  if (!isTrackerDualWriteEnabled()) {
    console.log("⏭  Reconcile dual-write omitido (TRACKER_DUAL_WRITE=0).");
    return null;
  }

  if (!fs.existsSync(xlsxPath)) {
    console.warn(`⚠  Reconcile dual-write: no se encontró Excel en ${xlsxPath}`);
<<<<<<< HEAD
    return { inserted: 0, updated: 0, skipped: 0 };
=======
    return { updated: 0, skipped: 0 };
>>>>>>> 485a67351a1c543d74c58d9ab3095bdfaa209e4a
  }

  const rows = await readEmpleosFromXlsx(xlsxPath);
  const syncable = rows.filter(isReconcileSyncableRow).map(excelRowToReconcileFields);
  if (!syncable.length) {
    console.log("📋 Reconcile dual-write: 0 filas Excel con jobId/URL para sync.");
<<<<<<< HEAD
    return { inserted: 0, updated: 0, skipped: 0 };
=======
    return { updated: 0, skipped: 0 };
>>>>>>> 485a67351a1c543d74c58d9ab3095bdfaa209e4a
  }

  await connect();
  await ensureIndexes();
  try {
    const result = await upsertReconcileRows(syncable);
    console.log(
<<<<<<< HEAD
      `📋 Tracker reconcile Mongo: ${result.inserted} insertadas | ${result.updated} actualizadas | ${result.skipped} omitidas`
=======
      `📋 Tracker reconcile Mongo: ${result.updated} actualizadas | ${result.skipped} omitidas (protegido/sin cambio)`
>>>>>>> 485a67351a1c543d74c58d9ab3095bdfaa209e4a
    );
    return result;
  } finally {
    await disconnect();
  }
}

const isMain =
  process.argv[1] != null &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  syncReconcileToTracker().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
