import type { UpsertApplicationInput } from "../db/applications.js";
import type { AnalysisSnapshot } from "../types/dashboard-match.js";

/** Subconjunto de qa-job-applied-list MatchResult (`scripts/types.ts`). */
export interface PipelineMatchResult {
  jobId: string;
  company: string;
  title: string;
  url: string;
  gmailId?: string;
  matchPercent: number;
  cvType?: string;
  summary?: string;
  matchedSkills?: string[];
  gaps?: string[];
  cvSuggestions?: string[];
  recommendation: "apply" | "apply_manual" | "skip";
  applyType?: "easy_apply" | "external" | "unknown";
  easyApply?: boolean;
}

/** Subconjunto de qa-job-applied-list ScrapedJob para snapshot JD. */
export interface PipelineScrapedJob {
  jobId: string;
  url: string;
  title: string;
  company: string;
  scrapedTitle?: string;
  scrapedCompany?: string;
  location?: string;
  modality?: string;
  datePosted?: string;
  description?: string;
  scrapedAt?: string;
  jobClosed?: boolean;
  acceptingApplications?: boolean;
}

/** Umbral pipeline/Excel (applied-list sync-excel). */
export const PIPELINE_MIN_MATCH = 65;
/** Umbral previsto dashboard match-jobs (#311); no filtra este sync. */
export const DASHBOARD_MIN_MATCH = 70;

const MAX_NOTA_SUMMARY = 200;

/** Línea corta de summary → notas. */
export function notasFromSummary(summary?: string): string | undefined {
  const line = summary?.trim().split("\n")[0]?.trim();
  if (!line) return undefined;
  return line.length > MAX_NOTA_SUMMARY ? `${line.slice(0, MAX_NOTA_SUMMARY - 3)}...` : line;
}

export function canalFromPipelineMatch(m: PipelineMatchResult): string {
  if (m.easyApply || m.applyType === "easy_apply") return "Easy Apply";
  if (m.applyType === "external") return "Externo";
  return "—";
}

export function proximoPasoFromPipelineMatch(m: PipelineMatchResult): string {
  return m.easyApply || m.applyType === "easy_apply"
    ? "Easy Apply automático o revisar"
    : "Apply → portal empresa";
}

/** Mismo filtro que sync-excel.ts en applied-list. */
export function shouldSyncPipelineMatch(m: PipelineMatchResult): boolean {
  if (m.recommendation === "skip" && m.matchPercent < PIPELINE_MIN_MATCH) return false;
  return true;
}

export function analysisSnapshotFromPipelineMatch(
  match: PipelineMatchResult,
  scraped?: PipelineScrapedJob | null,
  analyzedAt?: string
): AnalysisSnapshot | undefined {
  if (match.matchPercent < DASHBOARD_MIN_MATCH) return undefined;

  const hasSkills = Boolean(match.matchedSkills?.length);
  const hasDescription = Boolean(scraped?.description?.trim());
  if (!hasSkills && !hasDescription) return undefined;

  return {
    location: scraped?.location,
    modality: scraped?.modality,
    datePosted: scraped?.datePosted,
    description: scraped?.description,
    searchTerm: scraped?.scrapedTitle ?? match.title,
    source: "pipeline",
    matchedSkills: match.matchedSkills?.length ? [...match.matchedSkills] : undefined,
    gaps: match.gaps?.length ? [...match.gaps] : undefined,
    cvSuggestions: match.cvSuggestions?.length ? [...match.cvSuggestions] : undefined,
    summary: match.summary || undefined,
    analyzedAt: analyzedAt ?? scraped?.scrapedAt ?? new Date().toISOString(),
    jobClosed: scraped?.jobClosed,
    acceptingApplications: scraped?.acceptingApplications,
  };
}

export function pipelineMatchToApplicationInput(
  m: PipelineMatchResult,
  scraped?: PipelineScrapedJob | null,
  analyzedAt?: string
): UpsertApplicationInput {
  const notas = notasFromSummary(m.summary);
  const analysis = analysisSnapshotFromPipelineMatch(m, scraped, analyzedAt);
  return {
    jobId: m.jobId,
    gmailId: m.gmailId,
    matchPercent: m.matchPercent,
    puesto: m.title,
    empresa: m.company,
    linkedinUrl: m.url,
    canal: canalFromPipelineMatch(m),
    estado: "Pendiente",
    proximoPaso: proximoPasoFromPipelineMatch(m),
    cvType: m.cvType,
    applyType: m.applyType,
    ...(notas ? { notas } : {}),
    ...(analysis ? { analysis } : {}),
    ...(scraped?.jobClosed !== undefined ? { jobClosed: scraped.jobClosed } : {}),
    ...(scraped?.acceptingApplications !== undefined
      ? { acceptingApplications: scraped.acceptingApplications }
      : {}),
    inLatestAnalysis: Boolean(analysis),
    updatedBy: "pipeline",
  };
}
