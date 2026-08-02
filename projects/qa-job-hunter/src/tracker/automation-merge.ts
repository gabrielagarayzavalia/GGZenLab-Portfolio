import type { AnalysisSnapshot } from "../types/dashboard-match.js";
import type { TrackerEstado } from "../types/tracker-application.js";
import { applyTrackerPatch } from "./estado-policy.js";
import { isProtectedEstado } from "./protected-estado.js";

/** Campos que el pipeline puede escribir en Mongo. */
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
  fechaAplicacion?: string;
  estado?: TrackerEstado;
  analysis?: AnalysisSnapshot;
  inLatestAnalysis?: boolean;
  jobClosed?: boolean;
  acceptingApplications?: boolean;
}

export interface AutomationExistingDoc {
  estado?: string;
  proximoPaso?: string;
  notas?: string;
  gmailId?: string;
  cvType?: string;
  applyType?: string;
  fechaAplicacion?: string;
  analysis?: AnalysisSnapshot;
  jobClosed?: boolean;
  acceptingApplications?: boolean;
}

/** Estados que Easy Apply no debe tocar (usuaria / finales no-EA). Enviada y Pendiente sí. */
const EA_LOCKED_ESTADOS = new Set([
  "cerrado",
  "descartado",
  "duplicado",
  "stand-by",
  "standby",
  "borrador abierto",
  "a-pendiente",
  "a-realizado",
]);

export function isEasyApplyLockedEstado(estado: string | undefined): boolean {
  return EA_LOCKED_ESTADOS.has((estado ?? "").trim().toLowerCase());
}

export type AutomationMergePlan =
  | { action: "insert"; fields: AutomationApplicationFields }
  | { action: "update"; update: Partial<AutomationApplicationFields> & { updatedBy: string } }
  | { action: "skip" };

/** Fusiona snapshot pipeline sin pisar skills/gaps existentes con arrays vacíos (#335). */
export function mergePipelineAnalysisSnapshot(
  existing: AnalysisSnapshot | undefined,
  incoming: AnalysisSnapshot
): { merged: AnalysisSnapshot; changed: boolean } {
  const merged: AnalysisSnapshot = {
    ...existing,
    ...incoming,
    matchedSkills: incoming.matchedSkills?.length
      ? incoming.matchedSkills
      : existing?.matchedSkills,
    gaps: incoming.gaps?.length ? incoming.gaps : existing?.gaps,
    cvSuggestions: incoming.cvSuggestions?.length
      ? incoming.cvSuggestions
      : existing?.cvSuggestions,
    description: incoming.description?.trim() ? incoming.description : existing?.description,
    summary: incoming.summary?.trim() ? incoming.summary : existing?.summary,
    jdSections: incoming.jdSections ?? existing?.jdSections,
    location: incoming.location ?? existing?.location,
    modality: incoming.modality ?? existing?.modality,
    datePosted: incoming.datePosted ?? existing?.datePosted,
    searchTerm: incoming.searchTerm ?? existing?.searchTerm,
    jobClosed: incoming.jobClosed ?? existing?.jobClosed,
    acceptingApplications: incoming.acceptingApplications ?? existing?.acceptingApplications,
    source: existing?.source ?? incoming.source ?? "pipeline",
    analyzedAt: incoming.analyzedAt ?? existing?.analyzedAt,
  };

  const snapshotKey = (a: AnalysisSnapshot | undefined) =>
    JSON.stringify({
      matchedSkills: a?.matchedSkills,
      gaps: a?.gaps,
      summary: a?.summary,
      description: a?.description?.slice(0, 120),
      jobClosed: a?.jobClosed,
    });

  return { merged, changed: snapshotKey(existing) !== snapshotKey(merged) };
}

/** Solo metadata de scrape (#373): no toca estado/notas de filas protegidas. */
function planScrapeMetadataOnlyUpdate(
  existing: AutomationExistingDoc,
  merged: AutomationApplicationFields,
  updatedBy: string
): AutomationMergePlan | null {
  const update: Partial<AutomationApplicationFields> & { updatedBy: string } = { updatedBy };
  let changed = false;

  if (merged.jobClosed !== undefined && merged.jobClosed !== existing.jobClosed) {
    update.jobClosed = merged.jobClosed;
    changed = true;
  }
  if (
    merged.acceptingApplications !== undefined &&
    merged.acceptingApplications !== existing.acceptingApplications
  ) {
    update.acceptingApplications = merged.acceptingApplications;
    changed = true;
  }

  const incoming = merged.analysis;
  if (incoming) {
    const { merged: analysisMerged, changed: analysisChanged } = mergePipelineAnalysisSnapshot(
      existing.analysis,
      incoming
    );
    if (analysisChanged) {
      update.analysis = analysisMerged;
      changed = true;
    }
  }

  if (!changed) return null;
  return { action: "update", update };
}

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
    return planScrapeMetadataOnlyUpdate(existing, merged, updatedBy) ?? { action: "skip" };
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

  if (merged.analysis) {
    update.analysis = merged.analysis;
  }
  if (merged.inLatestAnalysis !== undefined) {
    update.inLatestAnalysis = merged.inLatestAnalysis;
  }
  if (merged.jobClosed !== undefined) {
    update.jobClosed = merged.jobClosed;
  }
  if (merged.acceptingApplications !== undefined) {
    update.acceptingApplications = merged.acceptingApplications;
  }

  return { action: "update", update };
}

/**
 * Plan upsert Easy Apply → Mongo (B-38-6).
 * A diferencia del pipeline: puede subir Pendiente→Enviada, mergear notas EA y reflejar la cola.
 */
export function planEasyApplyUpsert(
  existing: AutomationExistingDoc | null,
  input: AutomationApplicationFields,
  updatedBy = "easy-apply"
): AutomationMergePlan {
  const { patch } = applyTrackerPatch(input, "automation");
  const merged: AutomationApplicationFields = { ...input, ...patch };

  if (!existing) {
    const estado = merged.estado ?? "Pendiente";
    return {
      action: "insert",
      fields: {
        ...merged,
        estado,
        ...(estado === "Enviada"
          ? { fechaAplicacion: new Date().toISOString().slice(0, 10) }
          : {}),
      },
    };
  }

  if (isEasyApplyLockedEstado(existing.estado)) {
    return { action: "skip" };
  }

  const update: Partial<AutomationApplicationFields> & {
    updatedBy: string;
    fechaAplicacion?: string;
  } = {
    matchPercent: merged.matchPercent,
    puesto: merged.puesto,
    empresa: merged.empresa,
    linkedinUrl: merged.linkedinUrl,
    linkedinUrlNorm: merged.linkedinUrlNorm,
    jobId: merged.jobId,
    canal: merged.canal,
    applyType: merged.applyType ?? existing.applyType,
    updatedBy,
  };

  if (merged.estado) {
    update.estado = merged.estado;
  }

  if (merged.notas?.trim()) {
    const base = existing.notas?.trim() ?? "";
    const line = merged.notas.trim();
    update.notas = !base ? line : base.includes(line) ? base : `${base}\n${line}`;
  }

  if (merged.estado === "Enviada" && !existing.fechaAplicacion?.trim()) {
    update.fechaAplicacion = new Date().toISOString().slice(0, 10);
  }

  if (merged.notas?.includes("Preguntas nuevas")) {
    const hint = "Definir respuestas (ver Notas) y avisar en chat";
    const prev = existing.proximoPaso?.trim() ?? "";
    if (!prev.toLowerCase().includes(hint.toLowerCase())) {
      update.proximoPaso = prev ? `${prev} | ${hint}` : hint;
    }
  }

  return { action: "update", update };
}

const RECONCILE_TERMINAL_ESTADOS = new Set(["cerrado", "descartado", "duplicado"]);
const RECONCILE_ASSESSMENT_ESTADOS = new Set(["a-pendiente", "a-realizado"]);

function isReconcileTerminalEstado(estado: string | undefined): boolean {
  return RECONCILE_TERMINAL_ESTADOS.has((estado ?? "").trim().toLowerCase());
}

function isReconcileAssessmentEstado(estado: string | undefined): boolean {
  return RECONCILE_ASSESSMENT_ESTADOS.has((estado ?? "").trim().toLowerCase());
}

/**
 * Promociones permitidas desde Gmail reconcile (#414).
 * Enviada → A-pendiente/A-realizado; A-pendiente → A-realizado; Pendiente → Enviada/assessment.
 */
export function canReconcilePromoteEstado(
  existingEstado: string | undefined,
  incomingEstado: TrackerEstado
): boolean {
  const existing = (existingEstado ?? "").trim().toLowerCase();
  const incoming = incomingEstado.trim().toLowerCase();
  if (!existing || existing === incoming) return false;
  if (isReconcileTerminalEstado(existing)) return false;

  if (isReconcileAssessmentEstado(incoming)) {
    if (
      existing === "pendiente" ||
      existing === "enviada" ||
      existing === "stand-by" ||
      existing === "standby" ||
      existing === "borrador abierto"
    ) {
      return true;
    }
    return existing === "a-pendiente" && incoming === "a-realizado";
  }

  if (incoming === "enviada" && existing === "pendiente") return true;
  if (incoming === "stand-by" && existing === "pendiente") return true;

  return !isProtectedEstado(existing);
}

/**
 * Plan upsert reconcile → Mongo (B-23-02).
 * Actualiza applications existentes; insert solo A-pendiente/A-realizado con jobId (#414).
 */
export function planReconcileUpsert(
  existing: AutomationExistingDoc | null,
  input: AutomationApplicationFields,
  updatedBy = "reconcile"
): AutomationMergePlan {
  const { patch } = applyTrackerPatch(input, "automation");
  const merged: AutomationApplicationFields = { ...input, ...patch };

  if (!existing) {
    if (
      isReconcileAssessmentEstado(merged.estado) &&
      (merged.jobId?.trim() || merged.linkedinUrlNorm)
    ) {
      return {
        action: "insert",
        fields: { ...merged, estado: merged.estado! },
      };
    }
    return { action: "skip" };
  }

  if (isReconcileTerminalEstado(existing.estado)) {
    return { action: "skip" };
  }

  const update: Partial<AutomationApplicationFields> & { updatedBy: string } = {
    updatedBy,
  };

  if (merged.estado) {
    if (
      merged.estado !== existing.estado &&
      !canReconcilePromoteEstado(existing.estado, merged.estado)
    ) {
      return { action: "skip" };
    }
    update.estado = merged.estado;
  }
  if (merged.proximoPaso?.trim()) {
    update.proximoPaso = merged.proximoPaso;
  }
  if (merged.fechaAplicacion?.trim()) {
    update.fechaAplicacion = merged.fechaAplicacion;
  }
  if (merged.notas?.trim()) {
    const base = existing.notas?.trim() ?? "";
    const line = merged.notas.trim();
    update.notas = !base ? line : base.includes(line) ? base : `${base}\n${line}`;
  }

  const estadoSame = !update.estado || update.estado === existing.estado;
  const proxSame = !update.proximoPaso || update.proximoPaso === existing.proximoPaso;
  const fechaSame =
    !update.fechaAplicacion || update.fechaAplicacion === existing.fechaAplicacion;
  const notasSame = !update.notas || update.notas === existing.notas;
  if (estadoSame && proxSame && fechaSame && notasSame) {
    return { action: "skip" };
  }

  return { action: "update", update };
}
