import type { QueueRow, QueueStatus } from "../apply/apply-queue.js";
import type { TrackerEstado } from "../types/tracker-application.js";
import { canonicalJobUrl } from "../apply/apply-queue.js";
import { extractJobId, normalizeLinkedInUrl } from "./linkedin-url.js";
import type { AutomationApplicationFields } from "./automation-merge.js";

/** Espeja `STATUS_TO_EXCEL` en sync-empleos-tracker.py */
export function queueStatusToEstado(status: QueueStatus): TrackerEstado {
  switch (status) {
    case "enviada":
      return "Enviada";
    case "cerrada":
      return "Cerrado";
    case "descartada":
      return "Stand-by";
    default:
      return "Pendiente";
  }
}

const FIELD_NOTE_REASON_RE =
  /preguntas nuevas|assessment|honeypot|definir respuesta|a[nñ]os de experiencia|deequ|great expectations|campos (que )?fallaron|campos sin completar|typeahead|dropdown|skill no mapeada|pendiente/i;

export const DESCARTADA_STANDBY_HINT =
  "Stand-by: cola tenía descartada (solo vos marcás Descartado en Excel)";

/** Notas de cola EA → Mongo (columna Notas). Reason como fallback si aplica. */
export function notasFromQueueRow(row: QueueRow): string | undefined {
  let notes = (row.notes ?? "").trim();
  if (!notes) {
    const reason = (row.reason ?? "").trim();
    if (reason && FIELD_NOTE_REASON_RE.test(reason)) notes = reason;
  }
  if (row.status === "descartada" && !notes.includes(DESCARTADA_STANDBY_HINT)) {
    notes = notes ? `${notes}\n${DESCARTADA_STANDBY_HINT}` : DESCARTADA_STANDBY_HINT;
  }
  return notes || undefined;
}

export function mergeNotas(existing: string | undefined, incoming: string | undefined): string | undefined {
  const line = (incoming ?? "").trim();
  if (!line) return existing?.trim() || undefined;
  const base = (existing ?? "").trim();
  if (!base) return line;
  if (base.includes(line)) return base;
  return `${base}\n${line}`;
}

export function queueRowToApplicationFields(row: QueueRow): AutomationApplicationFields {
  const linkedinUrl = canonicalJobUrl(row.url, row.jobId);
  const estado = queueStatusToEstado(row.status);
  const notas = notasFromQueueRow(row);
  return {
    matchPercent: row.matchPercent,
    puesto: row.title,
    empresa: row.company,
    linkedinUrl,
    linkedinUrlNorm: normalizeLinkedInUrl(linkedinUrl),
    jobId: row.jobId || extractJobId(linkedinUrl),
    canal: "Easy Apply",
    applyType: row.easyApply === "yes" ? "easy_apply" : row.easyApply === "no" ? "external" : undefined,
    estado,
    ...(notas ? { notas } : {}),
  };
}
