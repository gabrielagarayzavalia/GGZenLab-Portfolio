import { hasParsedJdSections, parseJdSections } from "../jd/parse-sections.js";
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

/** Subconjunto de qa-job-applied-list ScrapedJob para snapshot analysis. */
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

/** Scrape indica aviso LinkedIn cerrado (mismas señales que `isLinkedInJobClosed`). */
export function isScrapedJobClosed(scraped?: PipelineScrapedJob | null): boolean {
  if (!scraped) return false;
  if (scraped.jobClosed === true) return true;
  if (scraped.acceptingApplications === false) return true;
  return false;
}

/**
 * Gate ingesta (#408): aviso nuevo cerrado al primer scrape → skip insert.
 * Updates a documentos existentes siempre permitidos.
 */
export function shouldIngestClosedApplication(
  _match: PipelineMatchResult,
  scraped?: PipelineScrapedJob | null,
  existing?: unknown | null
): boolean {
  if (existing) return true;
  return !isScrapedJobClosed(scraped);
}

/** Skills para UI cuando el motor no desglosó labels pero el % es alto (#335). */
export function matchedSkillsForSnapshot(match: PipelineMatchResult): string[] | undefined {
  if (match.matchedSkills?.length) return [...match.matchedSkills];
  if (match.matchPercent < DASHBOARD_MIN_MATCH) return undefined;
  if (match.gaps?.length) return undefined;
  const summary = match.summary?.trim();
  if (!summary) return undefined;
  const cv = summary.match(/CV\s+(\w+)/i)?.[1];
  return cv
    ? [`Perfil ${cv} alineado al aviso`]
    : ["Requisitos del aviso cubiertos por tu perfil"];
}

export function analysisSnapshotFromPipelineMatch(
  match: PipelineMatchResult,
  scraped?: PipelineScrapedJob | null,
  analyzedAt?: string
): AnalysisSnapshot | undefined {
  if (match.matchPercent < DASHBOARD_MIN_MATCH) return undefined;

  const hasSkills = Boolean(match.matchedSkills?.length);
  const hasGaps = Boolean(match.gaps?.length);
  const hasSummary = Boolean(match.summary?.trim());
  const description = scraped?.description?.trim();
  const hasDescription = Boolean(description);
  if (!hasSkills && !hasGaps && !hasSummary && !hasDescription) return undefined;

  const jdSections = description ? parseJdSections(description) : undefined;
  const parsedJd =
    jdSections && hasParsedJdSections(jdSections) ? jdSections : undefined;

  return {
    location: scraped?.location,
    modality: scraped?.modality,
    datePosted: scraped?.datePosted,
    description: scraped?.description,
    ...(parsedJd ? { jdSections: parsedJd } : {}),
    searchTerm: scraped?.scrapedTitle ?? match.title,
    source: "pipeline",
    matchedSkills: matchedSkillsForSnapshot(match),
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
    puesto: scraped?.scrapedTitle || m.title,
    empresa: scraped?.scrapedCompany || m.company,
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
