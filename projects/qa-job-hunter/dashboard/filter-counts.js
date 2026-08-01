/**
 * US-JH-B38-33 (#425) — Contadores de filtros dashboard (cliente).
 * Paridad con isVisibleInList / buckets en app.js y match-jobs.ts.
 */

/** @typedef {"unmarked"|"applied"|"not_applied"|"not_selected"|"assessment"|"assessment_done"|"rejected"|"closed"|"duplicated"} ListBucket */

/** @typedef {{ showUnmarked: boolean; showApplied: boolean; showNotApplied: boolean; showNotSelected: boolean; showAssessment: boolean; showAssessmentDone: boolean; showRejected: boolean; showClosed: boolean; showDuplicated: boolean }} FilterFlags */

/** @typedef {{ rejectedIds: Set<string>; getApplicationStatus: (jobId: string) => string | null }} FilterContext */

export const FILTER_BUCKET_ORDER = /** @type {const} */ ([
  "unmarked",
  "applied",
  "not_applied",
  "not_selected",
  "assessment",
  "assessment_done",
  "rejected",
  "closed",
  "duplicated",
]);

export const FILTER_BUCKET_LABELS = {
  unmarked: "Sin Clasificar",
  applied: "Aplicados",
  not_applied: "No aplicados",
  not_selected: "No seleccionada/o",
  assessment: "Assessment pendiente",
  assessment_done: "A-realizado",
  rejected: "Match incorrecto",
  closed: "Cerrado",
  duplicated: "Duplicado",
};

export function isLinkedInClosed(job) {
  return job?.jobClosed === true;
}

/**
 * Bucket único por fila — mismo orden de precedencia que isVisibleInList().
 * @param {import('./filter-counts.js').FilterContext} ctx
 * @returns {ListBucket}
 */
export function getJobListBucket(job, ctx) {
  if (job?.estado === "Duplicado") return "duplicated";
  if (job && isLinkedInClosed(job)) return "closed";
  if (ctx.rejectedIds.has(job.id)) return "rejected";
  if (job?.estado === "A-realizado") return "assessment_done";
  const status = ctx.getApplicationStatus(job.id);
  if (status === "applied") return "applied";
  if (status === "not_applied") return "not_applied";
  if (status === "not_selected") return "not_selected";
  if (status === "assessment_pending") return "assessment";
  return "unmarked";
}

/**
 * Visibilidad por checkboxes estado (OR entre buckets activos).
 * Paridad con isVisibleInList() incluyendo fallback A-realizado → applied.
 * @param {FilterFlags} flags
 */
export function isJobVisibleForStateFilters(job, flags, ctx) {
  if (job?.estado === "Duplicado") return flags.showDuplicated;
  if (job && isLinkedInClosed(job)) return flags.showClosed;
  if (ctx.rejectedIds.has(job.id)) return flags.showRejected;
  if (job?.estado === "A-realizado" && flags.showAssessmentDone) return true;
  const status = ctx.getApplicationStatus(job.id);
  if (status === "applied") return flags.showApplied;
  if (status === "not_applied") return flags.showNotApplied;
  if (status === "not_selected") return flags.showNotSelected;
  if (status === "assessment_pending") return flags.showAssessment;
  return flags.showUnmarked;
}

/** @param {{ filterCompany?: string; filterTitle?: string }} dropdowns */
export function jobPassesDropdownFilters(job, dropdowns) {
  if (dropdowns.filterCompany && job.company !== dropdowns.filterCompany) return false;
  if (dropdowns.filterTitle && job.title !== dropdowns.filterTitle) return false;
  return true;
}

/**
 * Lista visible: buckets activos (OR) AND empresa AND puesto.
 * @param {FilterFlags} flags
 */
export function filterVisibleJobs(jobs, flags, ctx, dropdowns = {}) {
  return jobs.filter(
    (job) =>
      isJobVisibleForStateFilters(job, flags, ctx) && jobPassesDropdownFilters(job, dropdowns)
  );
}

/**
 * Contadores para UI de filtros.
 * - buckets: cuenta por checkbox con empresa/puesto activos (sin filtrar por otros buckets).
 * - companies: cuenta por empresa con buckets activos + puesto si hay (sin filtrar empresa).
 * - titles: cuenta por puesto con buckets activos + empresa si hay (sin filtrar puesto).
 * @param {FilterFlags} flags
 */
export function computeFilterCounts(jobs, flags, ctx, dropdowns = {}) {
  const { filterCompany = "", filterTitle = "" } = dropdowns;

  /** @type {Record<ListBucket, number>} */
  const buckets = Object.fromEntries(FILTER_BUCKET_ORDER.map((b) => [b, 0]));

  for (const job of jobs) {
    if (!jobPassesDropdownFilters(job, { filterCompany, filterTitle })) continue;
    const bucket = getJobListBucket(job, ctx);
    buckets[bucket] += 1;
  }

  /** @type {Record<string, number>} */
  const companies = {};
  /** @type {Record<string, number>} */
  const titles = {};

  for (const job of jobs) {
    if (!isJobVisibleForStateFilters(job, flags, ctx)) continue;

    if (job.company) {
      if (!filterTitle || job.title === filterTitle) {
        companies[job.company] = (companies[job.company] ?? 0) + 1;
      }
    }
    if (job.title) {
      if (!filterCompany || job.company === filterCompany) {
        titles[job.title] = (titles[job.title] ?? 0) + 1;
      }
    }
  }

  const visibleCount = filterVisibleJobs(jobs, flags, ctx, { filterCompany, filterTitle }).length;

  return { buckets, companies, titles, visibleCount };
}

export function formatFilterCountLabel(baseLabel, count) {
  return `${baseLabel} (${count})`;
}
