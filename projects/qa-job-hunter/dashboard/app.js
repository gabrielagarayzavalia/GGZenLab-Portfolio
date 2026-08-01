/** Headers writes tracker (US-JH-B38-15 #314). */
import {
  FILTER_BUCKET_LABELS,
  FILTER_BUCKET_ORDER,
  computeFilterCounts,
  filterVisibleJobs,
  formatFilterCountLabel,
  isJobVisibleForStateFilters,
  isLinkedInClosed,
} from "./filter-counts.js";

const TRACKER_USER_HEADERS = {
  "Content-Type": "application/json",
  "X-Tracker-User": "1",
};
let jobs = [];
let selectedId = null;
let sortOrder = "desc";
let showRejected = false;
let showApplied = false;
let showNotApplied = false;
let showNotSelected = false;
let showUnmarked = true;
let showAssessment = false;
let showAssessmentDone = false;
let showClosed = false;
let showDuplicated = false;
let filterCompany = "";
let filterTitle = "";
/** Futuro: 'bullets' | 'full' | 'ai' — por ahora siempre bullets */
const DESCRIPTION_VIEW = "bullets";
const MATCH_INCORRECT_HINT =
  "Match incorrecto: usá el filtro de lista o el botón aquí (no es un checkbox de postulación).";
/** @type {Set<string>} */
let rejectedIds = new Set();
/** @type {Map<string, { reason?: string; rejectedAt: string }>} */
let rejectionMeta = new Map();
/** @type {Map<string, 'applied' | 'not_applied' | 'not_selected' | 'assessment_pending' | 'assessment_done'>} */
let applicationStatus = new Map();

const els = {
  headerStats: document.getElementById("header-stats"),
  jobList: document.getElementById("job-list"),
  sortSelect: document.getElementById("sort-select"),
  filterCompany: document.getElementById("filter-company"),
  filterTitle: document.getElementById("filter-title"),
  showRejected: document.getElementById("show-rejected"),
  showApplied: document.getElementById("show-applied"),
  showNotApplied: document.getElementById("show-not-applied"),
  showNotSelected: document.getElementById("show-not-selected"),
  showUnmarked: document.getElementById("show-unmarked"),
  showAssessment: document.getElementById("show-assessment"),
  showAssessmentDone: document.getElementById("show-assessment-done"),
  showClosed: document.getElementById("show-closed"),
  showDuplicated: document.getElementById("show-duplicated"),
  detailEmpty: document.getElementById("detail-empty"),
  detailContent: document.getElementById("detail-content"),
  listEmpty: document.getElementById("list-empty"),
  listError: document.getElementById("list-error"),
};

let appFlashTimer = null;

/** @param {"error"|"warning"|"success"} kind */
function showAppFlash(message, kind = "error") {
  const el = document.getElementById("app-flash");
  if (!el || !message) return;
  clearTimeout(appFlashTimer);
  el.className = `app-flash app-flash--${kind}`;
  el.hidden = false;
  el.classList.remove("hidden");
  el.textContent = message;
  if (kind === "success") {
    el.setAttribute("data-testid", "dash-flash-success");
  } else {
    el.removeAttribute("data-testid");
  }
  appFlashTimer = setTimeout(() => clearAppFlash(), kind === "error" ? 12_000 : 6_000);
}

function clearAppFlash() {
  const el = document.getElementById("app-flash");
  if (!el) return;
  el.textContent = "";
  el.hidden = true;
  el.classList.add("hidden");
}

function showApiWarnings(warnings) {
  if (warnings?.length) showAppFlash(warnings.join(" · "), "warning");
}

function applicationStatusSavedMessage(status, estadoFromApi) {
  if (estadoFromApi) return `Estado guardado: ${estadoFromApi}`;
  const byStatus = {
    applied: "Enviada",
    not_applied: "Stand-by",
    not_selected: "Cerrado",
    assessment_pending: "A-pendiente",
    assessment_done: "A-realizado",
  };
  if (status === null) return "Estado guardado: Pendiente";
  const label = byStatus[status];
  return label ? `Estado guardado: ${label}` : "Estado guardado";
}

function matchClass(pct) {
  if (pct >= 85) return "match-badge__pct--high";
  if (pct >= 75) return "match-badge__pct--mid";
  return "match-badge__pct--low";
}

/** Valores scrape/API sin dato real — no mostrar en meta (confunden). */
const META_PLACEHOLDERS = new Set(["no especificado", "desconocida", "—", "-", "n/a", "na"]);

function isMeaningfulMeta(value) {
  if (value == null) return false;
  const t = String(value).trim();
  if (!t) return false;
  return !META_PLACEHOLDERS.has(t.toLowerCase());
}

function estadoTrackerClass(estado) {
  const l = (estado || "").toLowerCase();
  if (l === "pendiente") return "estado-tracker--pendiente";
  if (l.includes("stand")) return "estado-tracker--standby";
  if (l === "enviada") return "estado-tracker--enviada";
  if (l.includes("borrador")) return "estado-tracker--borrador";
  if (l.includes("a-pendiente")) return "estado-tracker--a-pendiente";
  if (l.includes("a-realizado")) return "estado-tracker--a-realizado";
  if (l === "cerrado") return "estado-tracker--cerrado";
  if (l === "duplicado") return "estado-tracker--duplicado";
  if (l === "descartado") return "estado-tracker--descartado";
  return "estado-tracker--pendiente";
}

function renderEstadoTrackerBadge(estado, extraClass = "") {
  if (!estado) return "";
  const cls = estadoTrackerClass(estado);
  const strike =
    estado === "Cerrado" || estado === "Descartado" ? " estado-tracker--struck" : "";
  return `<span class="estado-tracker ${cls}${strike}${extraClass ? ` ${extraClass}` : ""}">${escapeHtml(estado)}</span>`;
}

function formatListMeta(job) {
  if (!isMeaningfulMeta(job.canal)) return "";
  return escapeHtml(job.canal);
}

function renderDetailMeta(job) {
  const spans = [];
  if (isMeaningfulMeta(job.location)) spans.push(`<span>${escapeHtml(job.location)}</span>`);
  if (isMeaningfulMeta(job.modality)) spans.push(`<span>${escapeHtml(job.modality)}</span>`);
  if (isMeaningfulMeta(job.datePosted)) spans.push(`<span>${escapeHtml(job.datePosted)}</span>`);
  if (isMeaningfulMeta(job.searchTerm)) {
    spans.push(`<span>Búsqueda: ${escapeHtml(job.searchTerm)}</span>`);
  }
  if (!spans.length) return "";
  return `<div class="detail__meta">${spans.join("")}</div>`;
}

function applicationStatusFromTrackerEstado(estado) {
  if (["Enviada", "A-realizado", "Borrador abierto"].includes(estado)) return "applied";
  if (estado === "Stand-by") return "not_applied";
  if (estado === "Cerrado") return "not_selected";
  if (estado === "A-pendiente") return "assessment_pending";
  return null;
}

function isRejected(jobId) {
  return rejectedIds.has(jobId);
}

function getApplicationStatus(jobId) {
  return applicationStatus.get(jobId) ?? null;
}

function getFilterContext() {
  return {
    rejectedIds,
    getApplicationStatus,
  };
}

function getFilterFlags() {
  return {
    showUnmarked,
    showApplied,
    showNotApplied,
    showNotSelected,
    showAssessment,
    showAssessmentDone,
    showRejected,
    showClosed,
    showDuplicated,
  };
}

function getDropdownFilters() {
  return { filterCompany, filterTitle };
}

function isVisibleInList(jobId) {
  const job = jobs.find((j) => j.id === jobId);
  if (!job) return false;
  return isJobVisibleForStateFilters(job, getFilterFlags(), getFilterContext());
}

function distinctSorted(values) {
  return [...new Set(values.filter((v) => v != null && String(v).trim()))].sort((a, b) =>
    a.localeCompare(b, "es", { sensitivity: "base" })
  );
}

function buildFilterSelectOptions(values, placeholder, selected, counts = {}) {
  const options = values.map((v) => {
    const count = counts[v] ?? 0;
    const zeroClass = count === 0 ? ' class="filter-option--zero"' : "";
    return `<option value="${escapeAttr(v)}"${zeroClass}>${escapeHtml(formatFilterCountLabel(v, count))}</option>`;
  });
  if (selected && !values.includes(selected)) {
    const selectedCount = counts[selected] ?? 0;
    options.push(
      `<option value="${escapeAttr(selected)}">${escapeHtml(formatFilterCountLabel(selected, selectedCount))}</option>`
    );
  }
  return `<option value="">${placeholder}</option>${options.join("")}`;
}

function renderFilterCounts() {
  const counts = computeFilterCounts(jobs, getFilterFlags(), getFilterContext(), getDropdownFilters());
  for (const bucket of FILTER_BUCKET_ORDER) {
    const labelEl = document.querySelector(`[data-filter-label="${bucket}"]`);
    if (!labelEl) continue;
    const n = counts.buckets[bucket] ?? 0;
    labelEl.textContent = formatFilterCountLabel(FILTER_BUCKET_LABELS[bucket], n);
    labelEl.classList.toggle("filter-count--zero", n === 0);
  }
  return counts;
}

function populateDropdownFilters() {
  const counts = computeFilterCounts(jobs, getFilterFlags(), getFilterContext(), getDropdownFilters());
  const companies = distinctSorted(jobs.map((j) => j.company));
  const titles = distinctSorted(jobs.map((j) => j.title));

  els.filterCompany.innerHTML = buildFilterSelectOptions(
    companies,
    "Todas",
    filterCompany,
    counts.companies
  );
  els.filterTitle.innerHTML = buildFilterSelectOptions(titles, "Todos", filterTitle, counts.titles);
  els.filterCompany.value = filterCompany;
  els.filterTitle.value = filterTitle;
  renderFilterCounts();
}

function visibleJobs() {
  const list = filterVisibleJobs(jobs, getFilterFlags(), getFilterContext(), getDropdownFilters());
  return list.sort((a, b) =>
    sortOrder === "desc" ? b.matchPercent - a.matchPercent : a.matchPercent - b.matchPercent
  );
}

function listEmptyMessage() {
  if (jobs.length === 0) return "No hay empleos con 70%+ de match.";
  const pending = jobs.filter((j) => getApplicationStatus(j.id) === null && !isRejected(j.id)).length;
  if (pending > 0 && !showUnmarked) return "Marcá «Sin Clasificar» para ver empleos pendientes.";
  if (filterCompany || filterTitle) {
    return "No se encontraron empleos para el criterio seleccionado";
  }
  return "Ningún empleo coincide con los filtros. Marcá alguna categoría arriba.";
}

function showListEmpty(message, filteredByDropdown) {
  els.listEmpty.classList.remove("hidden");
  els.listEmpty.hidden = false;
  els.listEmpty.querySelector("p").textContent = message;
  const hint = els.listEmpty.querySelector(".hint");
  if (hint) hint.hidden = filteredByDropdown;
  if (filteredByDropdown) {
    els.listEmpty.setAttribute("data-testid", "list-empty-filtered");
  } else {
    els.listEmpty.removeAttribute("data-testid");
  }
}

function hideListEmpty() {
  els.listEmpty.classList.add("hidden");
  els.listEmpty.hidden = true;
  els.listEmpty.removeAttribute("data-testid");
  const hint = els.listEmpty.querySelector(".hint");
  if (hint) hint.hidden = false;
}

function focusNextVisibleJob(afterId) {
  const list = visibleJobs();
  const next = list.find((j) => j.id !== afterId) ?? list[0];
  if (next) {
    selectJob(next.id);
    return;
  }
  selectedId = null;
  els.detailContent.classList.add("hidden");
  els.detailContent.hidden = true;
  els.detailEmpty.classList.remove("hidden");
  els.detailEmpty.hidden = false;
  renderList();
  renderHeader({ scrapedAt: window.__scrapedAt, totalAnalyzed: window.__totalAnalyzed, matchedJobs: jobs });
}

function renderHeader(result) {
  const date = new Date(result.scrapedAt).toLocaleString("es-AR");
  const visible = visibleJobs().length;
  const fbCount = jobs.filter((j) => isRejected(j.id)).length;
  const appliedCount = countJobsByStatus("applied");
  const notAppliedCount = countJobsByStatus("not_applied");
  const notSelectedCount = countJobsByStatus("not_selected");
  const fbLine =
    fbCount > 0
      ? `<span class="header-feedback">Aprendizaje: <strong>${fbCount}</strong> incorrecto(s)</span>`
      : "";
  const appLine =
    appliedCount + notAppliedCount + notSelectedCount > 0
      ? `<span class="header-apps">Aplicados: <strong>${appliedCount}</strong> · No aplicado: <strong>${notAppliedCount}</strong> · No seleccionada/o: <strong>${notSelectedCount}</strong></span>`
      : "";
  els.headerStats.innerHTML = `
    <span>Fecha: <strong>${date}</strong></span>
    <span>Analizados: <strong>${result.totalAnalyzed}</strong></span>
    <span>Visibles: <strong data-testid="dash-visible-count">${visible}</strong> / ${jobs.length}</span>
    ${fbLine}
    ${appLine}
  `;
  renderFilterCounts();
}

function renderList() {
  const list = visibleJobs();
  els.jobList.innerHTML = "";

  if (!els.listError.hidden) return;

  if (jobs.length === 0) {
    showListEmpty("No hay empleos con 70%+ de match.", false);
    return;
  }

  if (list.length === 0) {
    const filteredByDropdown = Boolean(filterCompany || filterTitle);
    showListEmpty(listEmptyMessage(), filteredByDropdown);
    return;
  }

  hideListEmpty();

  for (const job of list) {
    const rejected = isRejected(job.id);
    const closed = isLinkedInClosed(job);
    const li = document.createElement("li");
    li.className =
      "job-item" +
      (job.id === selectedId ? " active" : "") +
      (rejected ? " rejected" : "") +
      (closed ? " closed" : "");
    li.dataset.id = job.id;
    li.tabIndex = 0;
    const pctClass = matchClass(job.matchPercent);
    const colorVar =
      job.matchPercent >= 85 ? "match-high" : job.matchPercent >= 75 ? "match-mid" : "match-low";
    const rejectedBadge = rejected ? `<span class="badge-rejected">Match incorrecto</span>` : "";
    const closedBadge = closed ? `<span class="badge-closed">Cerrado</span>` : "";
    const appStatus = getApplicationStatus(job.id);
    const appBadge =
      appStatus === "applied"
        ? `<span class="badge-applied">Aplicado</span>`
        : appStatus === "not_applied"
          ? `<span class="badge-not-applied">No aplicado</span>`
          : appStatus === "not_selected"
            ? `<span class="badge-not-selected">No seleccionada/o</span>`
            : "";

    const listMeta = formatListMeta(job);
    const estadoBadge = job.estado ? renderEstadoTrackerBadge(job.estado) : "";

    li.innerHTML = `
      <div class="match-badge">
        <span class="match-badge__pct ${pctClass}">${job.matchPercent}%</span>
        <div class="match-bar" style="color: var(--${colorVar})">
          <div class="match-bar__fill" style="width: ${job.matchPercent}%"></div>
        </div>
      </div>
      <div>
        <p class="job-item__title">${escapeHtml(job.title)}</p>
        <p class="job-item__company">${escapeHtml(job.company)}</p>
        ${listMeta ? `<p class="job-item__meta">${listMeta}</p>` : ""}
        ${estadoBadge}
        ${rejectedBadge}
        ${closedBadge}
        ${appBadge}
      </div>`;

    li.addEventListener("click", () => selectJob(job.id));
    li.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        selectJob(job.id);
      }
    });
    els.jobList.appendChild(li);
  }
}

function selectJob(id) {
  selectedId = id;
  renderList();
  renderHeader({ scrapedAt: window.__scrapedAt, totalAnalyzed: window.__totalAnalyzed, matchedJobs: jobs });
  const job = jobs.find((j) => j.id === id);
  if (job) renderDetail(job);
}

function renderDetail(job) {
  els.detailEmpty.classList.add("hidden");
  els.detailEmpty.hidden = true;
  els.detailContent.classList.remove("hidden");
  els.detailContent.hidden = false;

  const rejected = isRejected(job.id);
  const closed = isLinkedInClosed(job);
  const meta = rejectionMeta.get(job.id);

  const gapsBlock =
    job.gaps?.length && job.gaps[0] !== "Ninguno"
      ? `<section class="detail__section"><h3>Gaps</h3><ul class="detail__list">${listItems(job.gaps)}</ul></section>`
      : "";

  const feedbackToggleLabel = rejected ? "Match incorrecto" : "¿Match incorrecto?";
  const feedbackToggle = `<button type="button" class="feedback-disclosure__toggle" id="feedback-toggle" aria-expanded="false" aria-controls="feedback-panel">
          <span class="feedback-disclosure__chevron" aria-hidden="true">▶</span>
          ${feedbackToggleLabel}
        </button>`;
  const feedbackHintTrigger = `<button type="button" class="feedback-hint-trigger" title="${escapeAttr(MATCH_INCORRECT_HINT)}" aria-label="${escapeAttr(MATCH_INCORRECT_HINT)}" data-testid="match-incorrect-hint">?</button>`;

  const feedbackPanel = rejected
    ? `<div class="feedback-disclosure__panel feedback-disclosure__panel--wide hidden" id="feedback-panel">
          <p class="feedback-done">Marcado como <strong>match incorrecto</strong>${meta?.reason ? `: ${escapeHtml(meta.reason)}` : ""}</p>
          <p class="feedback-learn">El próximo análisis usará este feedback para ser más estricto con ofertas similares.</p>
          <div class="feedback-actions">
            <button type="button" class="btn btn--ghost" id="btn-undo-reject">Deshacer</button>
          </div>
        </div>`
    : `<div class="feedback-disclosure__panel feedback-disclosure__panel--wide hidden" id="feedback-panel">
          <p class="feedback-hint">El próximo análisis será más estricto con ofertas parecidas.</p>
          <textarea class="feedback-reason" id="feedback-reason" placeholder="Opcional: ¿por qué no aplica?"></textarea>
          <div class="feedback-actions">
            <button type="button" class="btn btn--danger" id="btn-reject-match">Match incorrecto</button>
          </div>
        </div>`;

  const descriptionBlock = renderDescriptionBlock(job);
  const appStatus = getApplicationStatus(job.id);
  const closedBadge = closed
    ? `<p class="detail__closed-badge"><span class="badge-closed">Cerrado</span> LinkedIn ya no acepta postulaciones — no llegaste a aplicar.</p>`
    : "";
  const estadoChip = job.estado
    ? `<p class="detail__estado-chip">${renderEstadoTrackerBadge(job.estado, "estado-tracker--detail")}</p>`
    : "";
  const applicationClosedNote = closed
    ? `<p class="application-section__note">Postulación deshabilitada: aviso cerrado en LinkedIn.</p>`
    : "";
  const checkboxDisabled = closed ? "disabled" : "";
  const assessmentPendingCheck =
    job.assessmentGmailPending && job.estado !== "A-realizado"
      ? `<label class="application-check application-check--assessment">
                <input type="checkbox" id="chk-assessment-pending" ${appStatus === "assessment_pending" ? "checked" : ""} ${checkboxDisabled} />
                <span>Assessment pendiente</span>
              </label>`
      : "";
  const assessmentDoneCheck =
    job.estado === "A-pendiente"
      ? `<label class="application-check application-check--assessment-done">
                <input type="checkbox" id="chk-assessment-done" ${checkboxDisabled} />
                <span>Assessment realizado</span>
              </label>`
      : "";
  const linkedInLink = job.url
    ? `<a class="detail__link" href="${escapeAttr(job.url)}" target="_blank" rel="noopener noreferrer">Ver en LinkedIn →</a>`
    : `<p class="detail__meta detail__meta--muted">Sin enlace — empleo de una corrida anterior.</p>`;

  els.detailContent.innerHTML = `
    <header class="detail__header">
      <div class="detail__header-row">
        <div class="detail__header-main">
          <h1 class="detail__title">${escapeHtml(job.title)}</h1>
          <p class="detail__company">${escapeHtml(job.company)}</p>
          ${estadoChip}
          ${renderDetailMeta(job)}
          ${closedBadge}
          ${linkedInLink}
        </div>
        <aside class="detail__header-aside" aria-label="Acciones">
          <div class="application-section application-section--compact${closed ? " application-section--linkedin-closed" : ""}">
            <h3 class="application-section__title">Postulación</h3>
            ${applicationClosedNote}
            <div class="application-checks">
              <label class="application-check application-check--applied">
                <input type="checkbox" id="chk-applied" ${appStatus === "applied" ? "checked" : ""} ${checkboxDisabled} />
                <span>Aplicado</span>
              </label>
              <label class="application-check application-check--skipped">
                <input type="checkbox" id="chk-not-applied" ${appStatus === "not_applied" ? "checked" : ""} ${checkboxDisabled} />
                <span>No aplicado</span>
              </label>
              <label class="application-check application-check--not-selected">
                <input type="checkbox" id="chk-not-selected" ${appStatus === "not_selected" ? "checked" : ""} ${checkboxDisabled} />
                <span>No seleccionada/o</span>
              </label>
              ${assessmentPendingCheck}
              ${assessmentDoneCheck}
            </div>
          </div>
          <div class="feedback-section feedback-section--compact${rejected ? " feedback-section--rejected" : ""}">
            <div class="feedback-disclosure__header">
              ${feedbackToggle}
              ${feedbackHintTrigger}
            </div>
          </div>
        </aside>
      </div>
      ${feedbackPanel}
    </header>
    ${descriptionBlock}
    <section class="detail__section"><h3>Skills que coinciden</h3><ul class="detail__list">${listItems(job.matchedSkills)}</ul></section>
    ${gapsBlock}
    <section class="detail__section"><h3>Sugerencias para el CV</h3><ul class="detail__list">${listItems(job.cvSuggestions)}</ul></section>
    <section class="detail__section"><h3>Resumen del análisis</h3><p class="detail__summary">${escapeHtml(job.summary)}</p></section>`;

  if (rejected) {
    document.getElementById("btn-undo-reject")?.addEventListener("click", () => undoReject(job));
  } else {
    document.getElementById("btn-reject-match")?.addEventListener("click", () => rejectMatch(job));
  }
  wireFeedbackDisclosure();
  wireApplicationChecks(job);
}

function wireApplicationChecks(job) {
  if (isLinkedInClosed(job)) return;

  const chkApplied = document.getElementById("chk-applied");
  const chkNotApplied = document.getElementById("chk-not-applied");
  const chkNotSelected = document.getElementById("chk-not-selected");
  const chkAssessment = document.getElementById("chk-assessment-pending");
  const chkAssessmentDone = document.getElementById("chk-assessment-done");
  if (!chkApplied || !chkNotApplied || !chkNotSelected) return;

  const postulationBoxes = [
    { el: chkApplied, status: "applied" },
    { el: chkNotApplied, status: "not_applied" },
    { el: chkNotSelected, status: "not_selected" },
  ];

  for (const { el, status } of postulationBoxes) {
    el.addEventListener("change", () => {
      if (el.checked) {
        for (const other of postulationBoxes) {
          if (other.el !== el) other.el.checked = false;
        }
        if (chkAssessment) chkAssessment.checked = false;
        if (chkAssessmentDone) chkAssessmentDone.checked = false;
        saveApplicationStatus(job, status);
      } else {
        saveApplicationStatus(job, null);
      }
    });
  }

  if (chkAssessment) {
    chkAssessment.addEventListener("change", () => {
      if (chkAssessment.checked) {
        for (const { el } of postulationBoxes) {
          el.checked = false;
        }
        if (chkAssessmentDone) chkAssessmentDone.checked = false;
        saveApplicationStatus(job, "assessment_pending");
      } else {
        saveApplicationStatus(job, null);
      }
    });
  }

  if (chkAssessmentDone) {
    chkAssessmentDone.addEventListener("change", () => {
      if (chkAssessmentDone.checked) {
        for (const { el } of postulationBoxes) {
          el.checked = false;
        }
        if (chkAssessment) chkAssessment.checked = false;
        saveApplicationStatus(job, "assessment_done");
      }
    });
  }
}

async function saveApplicationStatus(job, status) {
  const applicationId = job.applicationId;
  if (!applicationId) {
    showAppFlash("Sin applicationId en tracker — no se puede guardar el estado.");
    return;
  }
  try {
    const res = await fetch("/api/dashboard/application-status", {
      method: "POST",
      headers: TRACKER_USER_HEADERS,
      body: JSON.stringify({
        applicationId,
        jobId: job.id,
        status,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "No se pudo guardar el estado");
    if (data.warnings?.length) {
      showApiWarnings(data.warnings);
    } else {
      showAppFlash(
        applicationStatusSavedMessage(status, data.application?.estado),
        "success"
      );
    }
    enableFilterForApplicationStatus(
      status ?? applicationStatusFromTrackerEstado(data.application?.estado)
    );
    await loadMatchJobs();
    const refreshed = jobs.find((j) => j.id === job.id) ?? job;
    if (isVisibleInList(job.id)) {
      renderList();
      renderHeader({ scrapedAt: window.__scrapedAt, totalAnalyzed: window.__totalAnalyzed, matchedJobs: jobs });
      renderDetail(refreshed);
    } else {
      focusNextVisibleJob(job.id);
    }
  } catch (e) {
    showAppFlash(String(e.message ?? e));
    const refreshed = jobs.find((j) => j.id === job.id) ?? job;
    renderDetail(refreshed);
  }
}

function applyApplicationStatus(store) {
  applicationStatus = new Map(store.entries.map((e) => [e.jobId, e.status]));
}

/**
 * Filtros: un solo checkbox activo → ?filter= en el server; varios → lista completa
 * y visibilidad con isVisibleInList() en cliente.
 */
function serverFilterFromUI() {
  const active = [];
  if (showRejected) active.push("rejected");
  if (showApplied) active.push("applied");
  if (showNotApplied) active.push("not_applied");
  if (showNotSelected) active.push("not_selected");
  if (showAssessment) active.push("assessment");
  if (showAssessmentDone) active.push("assessment_done");
  if (showClosed) active.push("closed");
  if (showDuplicated) active.push("duplicated");
  if (showUnmarked) active.push("unmarked");
  return active.length === 1 ? active[0] : null;
}

function showListError(message) {
  els.listError.textContent = message;
  els.listError.classList.remove("hidden");
  els.listError.hidden = false;
  els.listEmpty.classList.add("hidden");
  els.listEmpty.hidden = true;
}

function clearListError() {
  els.listError.classList.add("hidden");
  els.listError.hidden = true;
}

function syncFilterFlagsFromUI(changed) {
  if (changed === els.showUnmarked && els.showUnmarked.checked) {
    els.showApplied.checked = false;
    els.showNotApplied.checked = false;
    els.showNotSelected.checked = false;
    els.showRejected.checked = false;
    els.showClosed.checked = false;
    els.showDuplicated.checked = false;
    els.showAssessment.checked = false;
    els.showAssessmentDone.checked = false;
  } else if (changed !== els.showUnmarked && changed.checked) {
    els.showUnmarked.checked = false;
  }

  showRejected = els.showRejected.checked;
  showApplied = els.showApplied.checked;
  showNotApplied = els.showNotApplied.checked;
  showNotSelected = els.showNotSelected.checked;
  showUnmarked = els.showUnmarked.checked;
  showAssessment = els.showAssessment.checked;
  showAssessmentDone = els.showAssessmentDone.checked;
  showClosed = els.showClosed.checked;
  showDuplicated = els.showDuplicated.checked;

  if (
    !showRejected &&
    !showApplied &&
    !showNotApplied &&
    !showNotSelected &&
    !showUnmarked &&
    !showAssessment &&
    !showAssessmentDone &&
    !showClosed &&
    !showDuplicated
  ) {
    showUnmarked = true;
    els.showUnmarked.checked = true;
  }
}

/** Solo «Sin clasificar» activo — modo exclusivo que oculta buckets clasificados. */
function isExclusiveUnmarkedOnly() {
  return (
    els.showUnmarked.checked &&
    !els.showRejected.checked &&
    !els.showApplied.checked &&
    !els.showNotApplied.checked &&
    !els.showNotSelected.checked &&
    !els.showAssessment.checked &&
    !els.showAssessmentDone.checked &&
    !els.showClosed.checked &&
    !els.showDuplicated.checked
  );
}

/** Solo un bucket de postulación activo (sin rejected/closed/unmarked). */
function isExclusiveApplicationBucketOnly(bucketEl) {
  const buckets = [els.showApplied, els.showNotApplied, els.showNotSelected];
  return (
    bucketEl.checked &&
    buckets.filter((el) => el.checked).length === 1 &&
    !els.showRejected.checked &&
    !els.showClosed.checked &&
    !els.showDuplicated.checked &&
    !els.showUnmarked.checked &&
    !els.showAssessment.checked &&
    !els.showAssessmentDone.checked
  );
}

/**
 * Tras marcar en detalle (#373): activar el filtro de lista que corresponde al nuevo estado
 * para que el empleo siga visible (p. ej. solo «Sin clasificar» → marcar Aplicado).
 */
function enableFilterForApplicationStatus(status) {
  if (status === null) {
    els.showUnmarked.checked = true;
    for (const bucket of [els.showApplied, els.showNotApplied, els.showNotSelected]) {
      if (isExclusiveApplicationBucketOnly(bucket)) bucket.checked = false;
    }
    if (
      els.showRejected.checked &&
      !els.showApplied.checked &&
      !els.showNotApplied.checked &&
      !els.showNotSelected.checked &&
      !els.showClosed.checked
    ) {
      els.showRejected.checked = false;
    }
    syncFilterFlagsFromUI(els.showUnmarked);
    return;
  }

  const bucketByStatus = {
    applied: els.showApplied,
    not_applied: els.showNotApplied,
    not_selected: els.showNotSelected,
    assessment_pending: els.showAssessment,
    assessment_done: els.showAssessmentDone,
  };
  const bucket = bucketByStatus[status];
  if (!bucket) return;

  bucket.checked = true;
  if (isExclusiveUnmarkedOnly()) {
    els.showUnmarked.checked = false;
  }
  syncFilterFlagsFromUI(bucket);
}

/** Tras reject match (#373): activar filtro «Match incorrecto» para mantener el empleo visible. */
function enableFilterForRejected() {
  els.showRejected.checked = true;
  if (isExclusiveUnmarkedOnly()) {
    els.showUnmarked.checked = false;
  }
  syncFilterFlagsFromUI(els.showRejected);
}

async function loadMatchJobs(filter = null) {
  const serverFilter = filter;
  const url = serverFilter
    ? `/api/dashboard/match-jobs?filter=${encodeURIComponent(serverFilter)}`
    : "/api/dashboard/match-jobs";
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (res.status === 404) {
      throw new Error(
        "API /api/dashboard/match-jobs no encontrada (404). Reiniciá el dashboard: npm run dashboard"
      );
    }
    const hint = err.hint ? ` — ${err.hint}` : "";
    throw new Error((err.error ?? `HTTP ${res.status}`) + hint);
  }
  const result = await res.json();
  window.__scrapedAt = result.scrapedAt;
  window.__totalAnalyzed = result.totalAnalyzed;
  if (result.feedback) {
    applyFeedback({ rejections: result.feedback.rejections, updatedAt: "" });
  }
  if (result.applicationStatus) {
    applyApplicationStatus(result.applicationStatus);
  }
  jobs = result.matchedJobs ?? result.jobs ?? [];
  populateDropdownFilters();
  return result;
}

function countJobsByStatus(status) {
  return jobs.filter((j) => getApplicationStatus(j.id) === status).length;
}

function wireFeedbackDisclosure() {
  const toggle = document.getElementById("feedback-toggle");
  const panel = document.getElementById("feedback-panel");
  if (!toggle || !panel) return;
  toggle.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", open ? "false" : "true");
    panel.classList.toggle("hidden", open);
  });
}

/** Convierte descripción larga en bullets cortos (TDAH-friendly). */
function descriptionToBullets(text) {
  if (!text?.trim()) return ["Sin descripción disponible."];
  const raw = text.replace(/\r\n/g, "\n").trim();
  const MAX_LEN = 140;
  const MAX_BULLETS = 8;
  const skipPattern = /^(about the job|job description|responsibilities|requirements|qualifications|we offer|benefits)/i;

  const sentences = raw.match(/[^.!?\n]+[.!?]?/g) ?? [raw];
  /** @type {string[]} */
  const candidates = [];
  for (const s of sentences) {
    const t = s.replace(/\s+/g, " ").trim();
    if (t.length >= 18 && !skipPattern.test(t)) candidates.push(t);
  }

  const seen = new Set();
  const out = [];
  for (const line of candidates) {
    const trimmed = line.length > MAX_LEN ? line.slice(0, MAX_LEN - 1).trim() + "…" : line;
    const key = trimmed.slice(0, 40).toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(trimmed);
    }
    if (out.length >= MAX_BULLETS) break;
  }

  if (out.length === 0) {
    const fallback = raw.replace(/\s+/g, " ").slice(0, MAX_LEN);
    return [fallback + (raw.length > MAX_LEN ? "…" : "")];
  }
  return out;
}

function renderDescriptionBlock(job) {
  const sections = job.jdSections;
  if (sections?.requirements?.length) {
    const niceBlock = sections.niceToHave?.length
      ? `<details class="jd-section jd-section--collapsible">
          <summary>Nice to Have</summary>
          <ul class="detail__list detail__bullets">${listItems(sections.niceToHave)}</ul>
        </details>`
      : "";
    const offerBlock = sections.whatWeOffer?.length
      ? `<details class="jd-section jd-section--collapsible">
          <summary>What We Offer</summary>
          <ul class="detail__list detail__bullets">${listItems(sections.whatWeOffer)}</ul>
        </details>`
      : "";

    return `<section class="detail__section">
      <h3>Requisitos</h3>
      <p class="detail__section-note">What We're Looking For — bullets del aviso.</p>
      <ul class="detail__list detail__bullets">${listItems(sections.requirements)}</ul>
      ${niceBlock}
      ${offerBlock}
      <details class="description-full">
        <summary>Ver descripción completa</summary>
        <div class="detail__description">${escapeHtml(job.description)}</div>
      </details>
    </section>`;
  }

  if (DESCRIPTION_VIEW === "full") {
    return `<section class="detail__section"><h3>Descripción del puesto</h3><div class="detail__description">${escapeHtml(job.description)}</div></section>`;
  }

  const bullets = descriptionToBullets(job.description);
  return `<section class="detail__section">
    <h3>Descripción del puesto</h3>
    <p class="detail__section-note">Resumen en bullets — opción de texto completo abajo (futuro: resumen con IA).</p>
    <ul class="detail__list detail__bullets">${listItems(bullets)}</ul>
    <details class="description-full">
      <summary>Ver descripción completa</summary>
      <div class="detail__description">${escapeHtml(job.description)}</div>
    </details>
  </section>`;
}

async function rejectMatch(job) {
  const reason = document.getElementById("feedback-reason")?.value?.trim() || undefined;
  try {
    const res = await fetch("/api/dashboard/reject-match", {
      method: "POST",
      headers: TRACKER_USER_HEADERS,
      body: JSON.stringify({
        jobId: job.id,
        reason,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "No se pudo guardar el feedback");
    showApiWarnings(data.warnings);
    enableFilterForRejected();
    await loadMatchJobs();
    const refreshed = jobs.find((j) => j.id === job.id) ?? job;
    if (isVisibleInList(job.id)) {
      renderList();
      renderHeader({ scrapedAt: window.__scrapedAt, totalAnalyzed: window.__totalAnalyzed, matchedJobs: jobs });
      renderDetail(refreshed);
    } else {
      focusNextVisibleJob(job.id);
    }
  } catch (e) {
    showAppFlash(String(e.message ?? e));
  }
}

async function undoReject(job) {
  try {
    const res = await fetch(`/api/dashboard/reject-match/${encodeURIComponent(job.id)}`, {
      method: "DELETE",
      headers: TRACKER_USER_HEADERS,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "No se pudo deshacer");
    showApiWarnings(data.warnings);
    enableFilterForApplicationStatus(null);
    await loadMatchJobs();
    const refreshed = jobs.find((j) => j.id === job.id) ?? job;
    if (isVisibleInList(job.id)) {
      renderList();
      renderHeader({ scrapedAt: window.__scrapedAt, totalAnalyzed: window.__totalAnalyzed, matchedJobs: jobs });
      renderDetail(refreshed);
    } else {
      focusNextVisibleJob(job.id);
    }
  } catch (e) {
    showAppFlash(String(e.message ?? e));
    const refreshed = jobs.find((j) => j.id === job.id) ?? job;
    renderDetail(refreshed);
  }
}

function applyFeedback(store) {
  rejectedIds = new Set(store.rejections.map((r) => r.jobId));
  rejectionMeta = new Map(
    store.rejections.map((r) => [r.jobId, { reason: r.reason, rejectedAt: r.rejectedAt }])
  );
}

function listItems(arr) {
  if (!arr?.length) return "<li>—</li>";
  return arr.map((s) => `<li>${escapeHtml(s)}</li>`).join("");
}

function escapeHtml(text) {
  const d = document.createElement("div");
  d.textContent = text ?? "";
  return d.innerHTML;
}

function escapeAttr(text) {
  return (text ?? "").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

async function init() {
  els.sortSelect.addEventListener("change", () => {
    sortOrder = els.sortSelect.value;
    renderList();
  });

  function onDropdownFilterChange() {
    filterCompany = els.filterCompany.value;
    filterTitle = els.filterTitle.value;
    populateDropdownFilters();
    const list = visibleJobs();
    if (selectedId && !list.some((j) => j.id === selectedId)) {
      focusNextVisibleJob(selectedId);
    } else {
      renderList();
      renderHeader({
        scrapedAt: window.__scrapedAt,
        totalAnalyzed: window.__totalAnalyzed,
        matchedJobs: jobs,
      });
    }
  }

  els.filterCompany.addEventListener("change", onDropdownFilterChange);
  els.filterTitle.addEventListener("change", onDropdownFilterChange);

  els.showRejected.addEventListener("change", () => onFilterChange(els.showRejected));
  els.showApplied.addEventListener("change", () => onFilterChange(els.showApplied));
  els.showNotApplied.addEventListener("change", () => onFilterChange(els.showNotApplied));
  els.showNotSelected.addEventListener("change", () => onFilterChange(els.showNotSelected));
  els.showAssessment.addEventListener("change", () => onFilterChange(els.showAssessment));
  els.showAssessmentDone.addEventListener("change", () => onFilterChange(els.showAssessmentDone));
  els.showUnmarked.addEventListener("change", () => onFilterChange(els.showUnmarked));
  els.showClosed.addEventListener("change", () => onFilterChange(els.showClosed));
  els.showDuplicated.addEventListener("change", () => onFilterChange(els.showDuplicated));

  async function onFilterChange(changed) {
    syncFilterFlagsFromUI(changed);

    try {
      clearListError();
      const result = await loadMatchJobs();
      const list = visibleJobs();
      if (selectedId && !list.some((j) => j.id === selectedId)) {
        focusNextVisibleJob(selectedId);
      } else {
        renderList();
        renderHeader(result);
      }
    } catch (e) {
      showListError(String(e.message ?? e));
    }
  }

  try {
    const result = await loadMatchJobs(null);
    clearListError();

    renderHeader(result);

    if (jobs.length === 0) {
      els.listEmpty.classList.remove("hidden");
      els.listEmpty.hidden = false;
      return;
    }

    const first = visibleJobs()[0] ?? jobs[0];
    selectJob(first.id);
  } catch (e) {
    showListError(String(e.message ?? e));
  }
}

init();
