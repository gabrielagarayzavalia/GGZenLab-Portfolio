import type { AutomationApplicationFields } from "./automation-merge.js";
import { extractJobId, normalizeLinkedInUrl } from "./linkedin-url.js";
import type { ImportXlsxRow } from "./import-xlsx.js";

/** Mapea fila Excel post-reconcile → campos Mongo (B-23-02). */
export function excelRowToReconcileFields(row: ImportXlsxRow): AutomationApplicationFields {
  const linkedinUrl = row.linkedinUrl && row.linkedinUrl !== "—" ? row.linkedinUrl : "";
  const linkedinUrlNorm = normalizeLinkedInUrl(linkedinUrl);
  return {
    matchPercent: row.matchPercent,
    puesto: row.puesto,
    empresa: row.empresa,
    linkedinUrl,
    linkedinUrlNorm,
    jobId: row.jobId ?? extractJobId(linkedinUrl),
    canal: row.canal,
    estado: row.estado,
    fechaAplicacion: row.fechaAplicacion,
    proximoPaso: row.proximoPaso,
    notas: row.notas,
  };
}

/** Filas con clave de match (jobId o URL LinkedIn). */
export function isReconcileSyncableRow(row: ImportXlsxRow): boolean {
  const linkedinUrl = row.linkedinUrl && row.linkedinUrl !== "—" ? row.linkedinUrl : "";
  return Boolean(row.jobId?.trim() || normalizeLinkedInUrl(linkedinUrl));
}
