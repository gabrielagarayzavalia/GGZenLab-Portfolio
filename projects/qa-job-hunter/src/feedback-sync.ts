/**
 * B-38-16 (#315) — Dual-write match-feedback.json ↔ applications.matchRejected.
 * Deprecación del JSON: ver docs/match-feedback-migration.md · issue #300.
 */

import type { TrackerApplication } from "./types/tracker-application.js";
import { addRejection, removeRejection } from "./feedback.js";

/** Tras PATCH Mongo en reject-match dashboard — mantiene JSON alineado (transición #300). */
export function syncRejectionFromApplication(
  app: TrackerApplication,
  reason?: string
): void {
  const jobId = app.jobId?.trim() || app.id;
  if (!jobId) return;
  addRejection(
    {
      id: jobId,
      title: app.puesto,
      company: app.empresa,
      searchTerm: app.analysis?.searchTerm ?? "—",
      matchPercent: app.matchPercent,
    },
    reason?.trim() || app.matchRejectedReason
  );
}

/** Tras DELETE reject-match dashboard — quita entrada del JSON legacy. */
export function syncUndoRejectionFromJobId(jobId: string): void {
  if (!jobId?.trim()) return;
  removeRejection(jobId.trim());
}
