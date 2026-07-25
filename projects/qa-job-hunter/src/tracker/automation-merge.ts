import type { TrackerEstado } from "../types/tracker-application.js";
import { applyTrackerPatch } from "./estado-policy.js";
import { isProtectedEstado } from "./protected-estado.js";

/** Campos que el pipeline puede escribir en Mongo (sin `analysis` — eso es #312). */
export interface AutomationApplicationFields {
  matchPercent: number;
  puesto: string;
  empresa: string;
  linkedinUrl: string;
  linkedinUrlNorm: string;
  jobId?: string;
  gmailId?: string;
  canal: string;
  cvType?: string;
  applyType?: string;
  proximoPaso?: string;
  notas?: string;
  estado?: TrackerEstado;
}

export interface AutomationExistingDoc {
  estado?: string;
  proximoPaso?: string;
  notas?: string;
  gmailId?: string;
  cvType?: string;
  applyType?: string;
}

export type AutomationMergePlan =
  | { action: "insert"; fields: AutomationApplicationFields }
  | { action: "update"; update: Partial<AutomationApplicationFields> & { updatedBy: string } }
  | { action: "skip" };

/**
 * Plan de upsert automation → Mongo (B-38-5).
 * Espeja excel/upsert: skip si protegido; update sin bajar estado; insert Pendiente.
 */
export function planAutomationUpsert(
  existing: AutomationExistingDoc | null,
  input: AutomationApplicationFields,
  updatedBy = "pipeline"
): AutomationMergePlan {
  const { patch } = applyTrackerPatch(input, "automation");
  const merged: AutomationApplicationFields = { ...input, ...patch };

  if (!existing) {
    return {
      action: "insert",
      fields: { ...merged, estado: merged.estado ?? "Pendiente" },
    };
  }

  if (isProtectedEstado(existing.estado)) {
    return { action: "skip" };
  }

  const update: Partial<AutomationApplicationFields> & { updatedBy: string } = {
    matchPercent: merged.matchPercent,
    puesto: merged.puesto,
    empresa: merged.empresa,
    linkedinUrl: merged.linkedinUrl,
    linkedinUrlNorm: merged.linkedinUrlNorm,
    jobId: merged.jobId,
    gmailId: merged.gmailId ?? existing.gmailId,
    canal: merged.canal,
    cvType: merged.cvType ?? existing.cvType,
    applyType: merged.applyType ?? existing.applyType,
    proximoPaso: existing.proximoPaso?.trim() ? existing.proximoPaso : merged.proximoPaso,
    updatedBy,
  };

  if (!existing.estado?.trim()) {
    update.estado = "Pendiente";
  }

  if (!existing.notas?.trim() && merged.notas?.trim()) {
    update.notas = merged.notas;
  }

  return { action: "update", update };
}
