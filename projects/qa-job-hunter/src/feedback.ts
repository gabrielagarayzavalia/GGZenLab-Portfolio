// ============================================================
//  feedback.ts — Feedback de matches incorrectos para aprendizaje
//
//  Transición B-38-16 (#315): dual-write JSON + Mongo matchRejected.
//  Plan de eliminación del JSON: docs/match-feedback-migration.md · #300
// ============================================================

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { JobListing, JobMatch } from "./types.js";
import type { TrackerApplication } from "./types/tracker-application.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_FEEDBACK_PATH = path.join(ROOT, "output", "match-feedback.json");

/** Path del JSON legacy; override en tests vía MATCH_FEEDBACK_PATH. */
export function resolveFeedbackPath(): string {
  return process.env.MATCH_FEEDBACK_PATH ?? DEFAULT_FEEDBACK_PATH;
}

export interface MatchRejection {
  jobId: string;
  title: string;
  company: string;
  searchTerm: string;
  matchPercent: number;
  reason?: string;
  rejectedAt: string;
}

export interface MatchFeedbackStore {
  updatedAt: string;
  rejections: MatchRejection[];
}

export function applicationToMatchRejection(app: TrackerApplication): MatchRejection | null {
  if (!app.matchRejected) return null;
  const jobId = app.jobId?.trim() || app.id;
  if (!jobId) return null;
  return {
    jobId,
    title: app.puesto,
    company: app.empresa,
    searchTerm: app.analysis?.searchTerm ?? "—",
    matchPercent: app.matchPercent,
    reason: app.matchRejectedReason,
    rejectedAt: app.matchRejectedAt ?? app.updatedAt,
  };
}

function emptyStore(): MatchFeedbackStore {
  return { updatedAt: new Date().toISOString(), rejections: [] };
}

export function loadFeedbackFromJson(): MatchFeedbackStore {
  const feedbackPath = resolveFeedbackPath();
  if (!fs.existsSync(feedbackPath)) return emptyStore();
  try {
    return JSON.parse(fs.readFileSync(feedbackPath, "utf-8")) as MatchFeedbackStore;
  } catch {
    return emptyStore();
  }
}

/** Lectura sync del JSON legacy (dual-write / fallback sin Mongo). */
export function loadFeedback(): MatchFeedbackStore {
  return loadFeedbackFromJson();
}

/** Fusiona rejections JSON + Mongo; Mongo gana en conflicto por jobId. */
export function mergeFeedbackStores(
  jsonStore: MatchFeedbackStore,
  mongoRejections: MatchRejection[]
): MatchFeedbackStore {
  const byId = new Map<string, MatchRejection>();
  for (const r of jsonStore.rejections) byId.set(r.jobId, r);
  for (const r of mongoRejections) byId.set(r.jobId, r);
  const rejections = [...byId.values()].sort(
    (a, b) => new Date(a.rejectedAt).getTime() - new Date(b.rejectedAt).getTime()
  );
  return { updatedAt: new Date().toISOString(), rejections };
}

/**
 * Carga feedback para analyze: Mongo matchRejected + JSON sincronizado.
 * Si Mongo no está disponible, devuelve solo el JSON.
 */
export async function loadMergedFeedback(): Promise<MatchFeedbackStore> {
  const jsonStore = loadFeedbackFromJson();
  try {
    const { connect } = await import("./db/client.js");
    const { listApplications } = await import("./db/applications.js");
    await connect();
    const apps = await listApplications({ matchRejected: true });
    const mongoRejections = apps
      .map(applicationToMatchRejection)
      .filter((r): r is MatchRejection => r !== null);
    return mergeFeedbackStores(jsonStore, mongoRejections);
  } catch {
    return jsonStore;
  }
}

export function saveFeedback(store: MatchFeedbackStore): void {
  const feedbackPath = resolveFeedbackPath();
  const dir = path.dirname(feedbackPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  store.updatedAt = new Date().toISOString();
  fs.writeFileSync(feedbackPath, JSON.stringify(store, null, 2), "utf-8");
}

export function isRejectedJobId(jobId: string, store = loadFeedback()): boolean {
  return store.rejections.some((r) => r.jobId === jobId);
}

export function addRejection(
  job: Pick<JobMatch, "id" | "title" | "company" | "searchTerm" | "matchPercent">,
  reason?: string
): MatchFeedbackStore {
  const store = loadFeedback();
  const existing = store.rejections.findIndex((r) => r.jobId === job.id);

  const entry: MatchRejection = {
    jobId: job.id,
    title: job.title,
    company: job.company,
    searchTerm: job.searchTerm,
    matchPercent: job.matchPercent,
    reason: reason?.trim() || undefined,
    rejectedAt: new Date().toISOString(),
  };

  if (existing >= 0) store.rejections[existing] = entry;
  else store.rejections.push(entry);

  saveFeedback(store);
  return store;
}

export function removeRejection(jobId: string): MatchFeedbackStore {
  const store = loadFeedback();
  store.rejections = store.rejections.filter((r) => r.jobId !== jobId);
  saveFeedback(store);
  return store;
}

/** Bloque de contexto para el prompt del LLM — aprende de falsos positivos */
export function buildFeedbackLearningBlock(store = loadFeedback()): string {
  if (store.rejections.length === 0) return "";

  const recent = store.rejections.slice(-20);
  const lines = recent.map((r) => {
    const why = r.reason ? ` Motivo: ${r.reason}` : "";
    return `- "${r.title}" @ ${r.company} (búsqueda: ${r.searchTerm}) — el ${r.matchPercent}% fue INCORRECTO.${why}`;
  });

  const searchTerms = [...new Set(recent.map((r) => r.searchTerm))];
  const termHint =
    searchTerms.length > 0
      ? `\nTérminos de búsqueda que produjeron falsos positivos: ${searchTerms.join(", ")}.`
      : "";

  return `
=== FEEDBACK DEL USUARIO (matches marcados como incorrectos) ===
El candidato rechazó manualmente estos empleos que el sistema calificó con 70%+. Sé MÁS ESTRICTO con ofertas similares (mismo rol, stack o tipo de empresa).

${lines.join("\n")}
${termHint}

Si la oferta actual se parece a alguno de estos casos, asigna matchPercent por debajo de 70.
`;
}

/** Coincidencia heurística título+empresa para evitar re-analizar duplicados rechazados */
export function matchesPriorRejection(job: JobListing, store = loadFeedback()): MatchRejection | undefined {
  const norm = (s: string) => s.toLowerCase().trim();
  return store.rejections.find(
    (r) => norm(r.title) === norm(job.title) && norm(r.company) === norm(job.company)
  );
}
