/**
 * B-38-12 (#311) — Compositor GET /api/dashboard/match-jobs
 * Join applications + analysis snapshot (+ fallback jobs Mongo).
 */

import type { MatchRejection } from "../feedback.js";
import type { ApplicationStatus, ApplicationStatusEntry } from "../application-status.js";
import { listDashboardMatchApplications } from "../db/applications.js";
import { findJobsByIds, findJobsByLinkedInIds, findJobsByUrls } from "../db/jobs.js";
import { getLatestAnalysisRun } from "../db/runs.js";
import { DASHBOARD_MIN_MATCH } from "../tracker/pipeline-match.js";
import { extractJobId, normalizeLinkedInUrl } from "../tracker/linkedin-url.js";
import type { JobMatch } from "../types.js";
import { jdSectionsFromDescription, normalizeFeedbackFields } from "../types/dashboard-match.js";
import type { AnalysisSnapshot } from "../types/dashboard-match.js";
import type { JdSections } from "../jd/parse-sections.js";
import { hasGmailAssessmentPendingSignal } from "../tracker/gmail-assessment-label.js";
import type { TrackerApplication, TrackerEstado } from "../types/tracker-application.js";

export type DashboardMatchFilter =
  | "unmarked"
  | "applied"
  | "not_applied"
  | "not_selected"
  | "assessment"
  | "assessment_done"
  | "rejected"
  | "closed"
  | "duplicated";

/**
 * Paridad filtros lista ↔ detalle (dashboard/app.js):
 * | Lista              | Detalle              | Fuente                          |
 * | Sin clasificar     | —                    | Pendiente / null                |
 * | Aplicados          | Aplicado             | Enviada, A-realizado, Borrador  |
 * | No aplicados       | No aplicado          | Stand-by                        |
 * | No seleccionada/o  | No seleccionada/o    | estado Cerrado (usuaria)        |
 * | Assessment         | Assessment pendiente   | tracker `A-pendiente` (#420)  |
 * | A-realizado        | Assessment realizado   | tracker `A-realizado` (#424)  |
 * | Match incorrecto   | disclosure reject    | matchRejected (lista-only)      |
 * | Cerrado            | badge Cerrado        | jobClosed LinkedIn (read-only)  |
 * | Duplicado          | badge estado tracker | estado Duplicado (opt-in)       |
 */

const HIDDEN_ESTADOS: TrackerEstado[] = ["Duplicado", "Descartado"];

const APPLIED_ESTADOS: TrackerEstado[] = ["Enviada", "A-realizado", "Borrador abierto"];
const NOT_SELECTED_ESTADOS: TrackerEstado[] = ["Cerrado"];
const NOT_APPLIED_ESTADOS: TrackerEstado[] = ["Stand-by"];
const ASSESSMENT_PENDING_ESTADOS: TrackerEstado[] = ["A-pendiente"];

export type AssessmentBannerState = "pending" | "ok" | "hidden";

export interface AssessmentBannerMeta {
  assessmentPendingCount: number;
  assessmentDoneCount: number;
  assessmentBanner: AssessmentBannerState;
}

export interface MatchJobsResponse {
  scrapedAt: string;
  totalAnalyzed: number;
  jobs: JobMatch[];
  /** Alias para compatibilidad con dashboard/app.js (#313) y GET /api/results legacy (#316). */
  matchedJobs: JobMatch[];
  feedback: {
    rejectionCount: number;
    rejectedJobIds: string[];
    rejections: MatchRejection[];
  };
  applicationStatus: {
    updatedAt: string;
    entries: ApplicationStatusEntry[];
  };
  meta?: {
    count: number;
    filter?: DashboardMatchFilter;
    source: "mongo";
  } & AssessmentBannerMeta;
}

export interface ComposeMatchJobsOptions {
  filter?: DashboardMatchFilter;
}

/**
 * Shim GET /api/results (#316): payload idéntico a match-jobs.
 * Legacy leía jobs-result.json + feedback/applicationStatus; el compositor ya los incluye.
 * Campos extra `jobs` (alias de matchedJobs) y `meta` son superset seguro para clientes viejos.
 */
export type LegacyResultsResponse = MatchJobsResponse;

/** Mapeo spike § B38-11-02 — lectura tracker → filtros legacy dashboard. */
export function deriveApplicationStatus(app: TrackerApplication): ApplicationStatus | null {
  if (APPLIED_ESTADOS.includes(app.estado)) return "applied";
  if (ASSESSMENT_PENDING_ESTADOS.includes(app.estado)) return "assessment_pending";
  if (NOT_SELECTED_ESTADOS.includes(app.estado)) return "not_selected";
  if (NOT_APPLIED_ESTADOS.includes(app.estado) && !app.matchRejected) return "not_applied";
  return null;
}

/** LinkedIn aviso cerrado — distinto de `estado: Cerrado` (marcado por usuaria). */
export function isLinkedInJobClosed(app: TrackerApplication): boolean {
  if (app.jobClosed === true) return true;
  if (app.analysis?.jobClosed === true) return true;
  if (app.acceptingApplications === false) return true;
  if (app.analysis?.acceptingApplications === false) return true;
  return false;
}

export interface VisibleMatchApplicationOptions {
  /** Incluir avisos cerrados en LinkedIn (filtro `closed`). */
  showLinkedInClosed?: boolean;
  /** Incluir filas Duplicado (filtro opt-in `duplicated`). */
  showDuplicated?: boolean;
}

export function dashboardJobId(app: TrackerApplication): string {
  return app.jobId?.trim() || app.id;
}

export function matchesDashboardFilter(
  app: TrackerApplication,
  filter: DashboardMatchFilter
): boolean {
  const feedback = normalizeFeedbackFields(app);
  const status = deriveApplicationStatus(app);

  switch (filter) {
    case "rejected":
      return feedback.matchRejected;
    case "applied":
      return status === "applied" && !feedback.matchRejected;
    case "not_applied":
      return status === "not_applied" && !feedback.matchRejected;
    case "not_selected":
      return status === "not_selected" && !feedback.matchRejected;
    case "assessment":
      return status === "assessment_pending" && !feedback.matchRejected;
    case "assessment_done":
      return app.estado === "A-realizado" && !feedback.matchRejected;
    case "unmarked":
      return status === null && !feedback.matchRejected;
    case "duplicated":
      return app.estado === "Duplicado";
    case "closed":
      return isLinkedInJobClosed(app);
    default:
      return true;
  }
}

/**
 * Banner assessments (#421): cuenta A-pendiente / A-realizado en scope dashboard
 * (misma visibilidad por defecto que la lista, sin Duplicado/Descartado ocultos).
 * Se calcula antes de filtrar por `?filter=`.
 */
export function computeAssessmentBannerMeta(apps: TrackerApplication[]): AssessmentBannerMeta {
  let assessmentPendingCount = 0;
  let assessmentDoneCount = 0;

  for (const app of apps) {
    if (!isVisibleMatchApplication(app)) continue;
    if (app.estado === "A-pendiente") assessmentPendingCount += 1;
    else if (app.estado === "A-realizado") assessmentDoneCount += 1;
  }

  let assessmentBanner: AssessmentBannerState;
  if (assessmentPendingCount >= 1) {
    assessmentBanner = "pending";
  } else if (assessmentDoneCount >= 1) {
    assessmentBanner = "ok";
  } else {
    assessmentBanner = "hidden";
  }

  return { assessmentPendingCount, assessmentDoneCount, assessmentBanner };
}

export function isVisibleMatchApplication(
  app: TrackerApplication,
  options: VisibleMatchApplicationOptions = {}
): boolean {
  if (app.estado === "Duplicado" && !options.showDuplicated) return false;
  if (app.estado === "Descartado") return false;
  if (isLinkedInJobClosed(app) && !options.showLinkedInClosed) return false;

  const feedback = normalizeFeedbackFields(app);
  const status = deriveApplicationStatus(app);
  const inLatest = feedback.inLatestAnalysis;
  const meetsThreshold = app.matchPercent >= DASHBOARD_MIN_MATCH;

  if (meetsThreshold && (inLatest || status !== null || feedback.matchRejected)) return true;
  if (feedback.matchRejected) return true;
  if (status !== null) return true;
  return false;
}

function stubSummary(app: TrackerApplication, rejected: boolean): string {
  if (rejected) {
    return "Ya no está en el último análisis; visible por feedback guardado.";
  }
  if (!normalizeFeedbackFields(app).inLatestAnalysis) {
    return "Ya no está en el último análisis; visible por el estado de postulación guardado.";
  }
  return "Sin análisis detallado disponible.";
}

function resolveJobMatchJdSections(
  primary?: JdSections,
  primaryDescription?: string,
  fallback?: JdSections,
  fallbackDescription?: string
): JdSections | undefined {
  return (
    primary ??
    fallback ??
    jdSectionsFromDescription(primaryDescription) ??
    jdSectionsFromDescription(fallbackDescription)
  );
}

function stubDescription(app: TrackerApplication, rejected: boolean): string {
  const reason = app.matchRejectedReason?.trim();
  if (rejected) {
    return reason
      ? `Empleo de una corrida anterior. Motivo del rechazo: ${reason}`
      : "Empleo de una corrida anterior marcado como match incorrecto.";
  }
  return "Empleo de una corrida anterior con estado de postulación guardado.";
}

/** #335 — skills vacíos en snapshot pero % alto: fallback legible en detalle. */
function resolveMatchedSkillsForDisplay(
  analysis: AnalysisSnapshot,
  matchPercent: number,
  jobFallback?: JobMatch | null
): string[] {
  if (analysis.matchedSkills?.length) return analysis.matchedSkills;
  if (jobFallback?.matchedSkills?.length) return jobFallback.matchedSkills;
  if (matchPercent >= DASHBOARD_MIN_MATCH && !analysis.gaps?.length && analysis.summary?.trim()) {
    const cv = analysis.summary.match(/CV\s+(\w+)/i)?.[1];
    return cv
      ? [`Perfil ${cv} alineado al aviso`]
      : ["Requisitos del aviso cubiertos por tu perfil"];
  }
  return [];
}

export function applicationToJobMatch(
  app: TrackerApplication,
  jobFallback?: JobMatch | null
): JobMatch {
  const id = dashboardJobId(app);
  const feedback = normalizeFeedbackFields(app);
  const analysis = app.analysis;
  const rejected = feedback.matchRejected;
  const jobClosed = isLinkedInJobClosed(app);

  const trackerFields = {
    estado: app.estado,
    canal: app.canal,
    assessmentGmailPending: hasGmailAssessmentPendingSignal(app) || undefined,
  };

  if (analysis) {
    return {
      id,
      applicationId: app.id,
      ...trackerFields,
      title: app.puesto,
      company: app.empresa,
      location: analysis.location ?? jobFallback?.location ?? "—",
      modality: analysis.modality ?? jobFallback?.modality ?? "—",
      datePosted: analysis.datePosted ?? jobFallback?.datePosted ?? "—",
      url: app.linkedinUrl || jobFallback?.url || "",
      description:
        analysis.description ??
        jobFallback?.description ??
        stubDescription(app, rejected),
      jdSections: resolveJobMatchJdSections(
        analysis.jdSections,
        analysis.description ?? jobFallback?.description,
        jobFallback?.jdSections,
        jobFallback?.description
      ),
      searchTerm: analysis.searchTerm ?? jobFallback?.searchTerm ?? "—",
      source: analysis.source ?? jobFallback?.source,
      externalId: analysis.externalId ?? jobFallback?.externalId,
      matchPercent: app.matchPercent,
      matchedSkills: resolveMatchedSkillsForDisplay(analysis, app.matchPercent, jobFallback),
      gaps: analysis.gaps ?? jobFallback?.gaps ?? [],
      cvSuggestions: analysis.cvSuggestions ?? jobFallback?.cvSuggestions ?? [],
      summary: analysis.summary ?? jobFallback?.summary ?? stubSummary(app, rejected),
      jobClosed: jobClosed || undefined,
    };
  }

  if (jobFallback) {
    return {
      ...jobFallback,
      id,
      applicationId: app.id,
      ...trackerFields,
      title: app.puesto || jobFallback.title,
      company: app.empresa || jobFallback.company,
      matchPercent: app.matchPercent,
      url: app.linkedinUrl || jobFallback.url,
      description: jobFallback.description || stubDescription(app, rejected),
      jdSections:
        jobFallback.jdSections ?? jdSectionsFromDescription(jobFallback.description),
      summary: jobFallback.summary || stubSummary(app, rejected),
      jobClosed: jobClosed || jobFallback.jobClosed || undefined,
    };
  }

  return {
    id,
    applicationId: app.id,
    ...trackerFields,
    title: app.puesto,
    company: app.empresa,
    location: "—",
    modality: "—",
    datePosted: "—",
    url: app.linkedinUrl,
    description: stubDescription(app, rejected),
    searchTerm: "—",
    matchPercent: app.matchPercent,
    matchedSkills: [],
    gaps: [],
    cvSuggestions: [],
    summary: stubSummary(app, rejected),
    jobClosed: jobClosed || undefined,
  };
}

export function buildFeedbackEnvelope(apps: TrackerApplication[]): MatchJobsResponse["feedback"] {
  const rejections: MatchRejection[] = [];

  for (const app of apps) {
    const feedback = normalizeFeedbackFields(app);
    if (!feedback.matchRejected) continue;
    rejections.push({
      jobId: dashboardJobId(app),
      title: app.puesto,
      company: app.empresa,
      searchTerm: app.analysis?.searchTerm ?? "—",
      matchPercent: app.matchPercent,
      reason: feedback.matchRejectedReason,
      rejectedAt: feedback.matchRejectedAt ?? app.updatedAt,
    });
  }

  const rejectedJobIds = rejections.map((r) => r.jobId);
  return {
    rejectionCount: rejections.length,
    rejectedJobIds,
    rejections,
  };
}

export function buildApplicationStatusEnvelope(
  apps: TrackerApplication[]
): MatchJobsResponse["applicationStatus"] {
  let latestUpdated = "";
  const entries: ApplicationStatusEntry[] = [];

  for (const app of apps) {
    const status = deriveApplicationStatus(app);
    if (!status) continue;
    const updatedAt = app.updatedAt;
    if (!latestUpdated || updatedAt > latestUpdated) latestUpdated = updatedAt;
    entries.push({
      jobId: dashboardJobId(app),
      title: app.puesto,
      company: app.empresa,
      status,
      updatedAt,
    });
  }

  return {
    updatedAt: latestUpdated || new Date().toISOString(),
    entries,
  };
}

export function resolveJobFallback(
  app: TrackerApplication,
  jobsByUrl: Map<string, JobMatch>,
  jobsById: Map<string, JobMatch>,
  jobsByLinkedInId: Map<string, JobMatch>
): JobMatch | undefined {
  const id = dashboardJobId(app);
  const normUrl = app.linkedinUrl ? normalizeLinkedInUrl(app.linkedinUrl) : "";
  const urlLinkedInId = extractJobId(app.linkedinUrl ?? "");

  return (
    jobsById.get(id) ??
    jobsByLinkedInId.get(id) ??
    (app.jobId ? jobsByLinkedInId.get(app.jobId) ?? jobsById.get(app.jobId) : undefined) ??
    (normUrl ? jobsByUrl.get(normUrl) : undefined) ??
    (urlLinkedInId ? jobsByLinkedInId.get(urlLinkedInId) : undefined)
  );
}

export function composeMatchJobsFromApplications(
  apps: TrackerApplication[],
  jobsByUrl: Map<string, JobMatch>,
  jobsById: Map<string, JobMatch>,
  meta: { scrapedAt: string; totalAnalyzed: number },
  options: ComposeMatchJobsOptions = {},
  jobsByLinkedInId: Map<string, JobMatch> = new Map()
): MatchJobsResponse {
  const showLinkedInClosed = options.filter === "closed";
  const showDuplicated = options.filter === "duplicated";
  const assessmentMeta = computeAssessmentBannerMeta(apps);
  const visible = apps.filter((app) =>
    isVisibleMatchApplication(app, { showLinkedInClosed, showDuplicated })
  );
  const filtered = options.filter
    ? visible.filter((app) => matchesDashboardFilter(app, options.filter!))
    : visible;

  const matchedJobs = filtered.map((app) => {
    const fallback = resolveJobFallback(app, jobsByUrl, jobsById, jobsByLinkedInId);
    return applicationToJobMatch(app, fallback);
  });

  matchedJobs.sort((a, b) => b.matchPercent - a.matchPercent);

  const feedback = buildFeedbackEnvelope(visible);
  const applicationStatus = buildApplicationStatusEnvelope(visible);

  return {
    scrapedAt: meta.scrapedAt,
    totalAnalyzed: meta.totalAnalyzed,
    jobs: matchedJobs,
    matchedJobs,
    feedback,
    applicationStatus,
    meta: {
      count: matchedJobs.length,
      filter: options.filter,
      source: "mongo",
      ...assessmentMeta,
    },
  };
}

async function resolveRunMeta(apps: TrackerApplication[]): Promise<{
  scrapedAt: string;
  totalAnalyzed: number;
}> {
  const latestRun = await getLatestAnalysisRun();
  if (latestRun) {
    return {
      scrapedAt: latestRun.scrapedAt,
      totalAnalyzed: latestRun.totalAnalyzed,
    };
  }

  const latestApps = apps.filter((a) => normalizeFeedbackFields(a).inLatestAnalysis);
  const analyzedAts = latestApps
    .map((a) => a.analysis?.analyzedAt)
    .filter((v): v is string => Boolean(v?.trim()));
  const scrapedAt =
    analyzedAts.sort().at(-1) ??
    latestApps.map((a) => a.updatedAt).sort().at(-1) ??
    new Date().toISOString();

  return {
    scrapedAt,
    totalAnalyzed: latestApps.length || apps.filter((a) => a.matchPercent >= DASHBOARD_MIN_MATCH).length,
  };
}

export async function composeMatchJobs(
  options: ComposeMatchJobsOptions = {}
): Promise<MatchJobsResponse> {
  const apps = await listDashboardMatchApplications();
  const urls = [...new Set(apps.map((a) => a.linkedinUrl).filter(Boolean))];
  const ids = [...new Set(apps.map(dashboardJobId))];
  const linkedInIds = [
    ...new Set(
      apps.flatMap((a) => [dashboardJobId(a), a.jobId, extractJobId(a.linkedinUrl)].filter(Boolean))
    ),
  ] as string[];

  const [jobsByUrl, jobsById, jobsByLinkedInId, runMeta] = await Promise.all([
    findJobsByUrls(urls),
    findJobsByIds(ids),
    findJobsByLinkedInIds(linkedInIds),
    resolveRunMeta(apps),
  ]);

  return composeMatchJobsFromApplications(apps, jobsByUrl, jobsById, runMeta, options, jobsByLinkedInId);
}
