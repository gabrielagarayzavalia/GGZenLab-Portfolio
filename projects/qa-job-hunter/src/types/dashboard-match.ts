/**
 * B-38-13 — Tipos dashboard híbrido (lista tracker + detalle análisis).
 * Ref: docs/spike-dashboard-tracker-sync.md · issue #312
 *
 * `AnalysisSnapshot` embebe en `applications.analysis` lo que hoy vive en
 * `JobMatch` / jobs-result.json, sin duplicar el store jobs en runtime dashboard.
 */

import { hasParsedJdSections, parseJdSections, type JdSections } from "../jd/parse-sections.js";
import type { JobMatch } from "../types.js";

export type { JdSections };

function jdSectionsFromDescription(description?: string): JdSections | undefined {
  const text = description?.trim();
  if (!text) return undefined;
  const sections = parseJdSections(text);
  return hasParsedJdSections(sections) ? sections : undefined;
}

/** Snapshot de análisis LLM/scrape embebido en `TrackerApplication.analysis`. */
export interface AnalysisSnapshot {
  location?: string;
  modality?: string;
  datePosted?: string;
  description?: string;
  /** Secciones JD parseadas (#370) — requirements / niceToHave / whatWeOffer. */
  jdSections?: JdSections;
  searchTerm?: string;
  source?: string;
  externalId?: string;
  matchedSkills?: string[];
  gaps?: string[];
  cvSuggestions?: string[];
  summary?: string;
  /** ISO-8601 del análisis. */
  analyzedAt?: string;
  /** ObjectId string de `analysis_runs` cuando existe. */
  runId?: string;
}

/** Campos de feedback dashboard (filtro “Match incorrecto”, última corrida analyze). */
export interface TrackerFeedbackFields {
  matchRejected?: boolean;
  matchRejectedReason?: string;
  /** ISO-8601 del reject/undo. */
  matchRejectedAt?: string;
  /** Job presente en la última corrida `analyze` / jobs-result. */
  inLatestAnalysis?: boolean;
}

/** Defaults seguros para documentos Mongo/API sin campos B-38-13. */
export function normalizeFeedbackFields(
  fields: TrackerFeedbackFields = {}
): Required<Pick<TrackerFeedbackFields, "matchRejected" | "inLatestAnalysis">> &
  Pick<TrackerFeedbackFields, "matchRejectedReason" | "matchRejectedAt"> {
  return {
    matchRejected: fields.matchRejected ?? false,
    inLatestAnalysis: fields.inLatestAnalysis ?? false,
    matchRejectedReason: fields.matchRejectedReason,
    matchRejectedAt: fields.matchRejectedAt,
  };
}

/** Mapeo JobMatch → snapshot para dual-write / #311 (bloque 2+). */
export function analysisSnapshotFromJobMatch(
  job: JobMatch,
  options: { analyzedAt?: string; runId?: string } = {}
): AnalysisSnapshot {
  return {
    location: job.location,
    modality: job.modality,
    datePosted: job.datePosted,
    description: job.description,
    jdSections: job.jdSections ?? jdSectionsFromDescription(job.description),
    searchTerm: job.searchTerm,
    source: job.source,
    externalId: job.externalId,
    matchedSkills: job.matchedSkills?.length ? [...job.matchedSkills] : undefined,
    gaps: job.gaps?.length ? [...job.gaps] : undefined,
    cvSuggestions: job.cvSuggestions?.length ? [...job.cvSuggestions] : undefined,
    summary: job.summary || undefined,
    analyzedAt: options.analyzedAt,
    runId: options.runId,
  };
}

/** Vista lista dashboard (B-38-12 #311) — tracker + flags feedback. */
export interface DashboardMatchJob {
  id: string;
  jobId?: string;
  title: string;
  company: string;
  url: string;
  matchPercent: number;
  estado: string;
  canal?: string;
  matchRejected: boolean;
  inLatestAnalysis: boolean;
  hasAnalysis: boolean;
}
