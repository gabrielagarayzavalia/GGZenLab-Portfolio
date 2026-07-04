let jobs = [];
let selectedId = null;
let sortOrder = "desc";
let showRejected = false;
let showApplied = false;
let showNotApplied = false;
let showNotSelected = false;
let showUnmarked = true;
/** Futuro: 'bullets' | 'full' | 'ai' — por ahora siempre bullets */
const DESCRIPTION_VIEW = "bullets";
/** @type {Set<string>} */
let rejectedIds = new Set();
/** @type {Map<string, { reason?: string; rejectedAt: string }>} */
let rejectionMeta = new Map();
/** @type {Map<string, 'applied' | 'not_applied' | 'not_selected'>} */
let applicationStatus = new Map();

const els = {
  headerStats: document.getElementById("header-stats"),
  jobList: document.getElementById("job-list"),
  sortSelect: document.getElementById("sort-select"),
  showRejected: document.getElementById("show-rejected"),
  showApplied: document.getElementById("show-applied"),
  showNotApplied: document.getElementById("show-not-applied"),
  showNotSelected: document.getElementById("show-not-selected"),
  showUnmarked: document.getElementById("show-unmarked"),
  detailEmpty: document.getElementById("detail-empty"),
  detailContent: document.getElementById("detail-content"),
  listEmpty: document.getElementById("list-empty"),
  listError: document.getElementById("list-error"),
};

function matchClass(pct) {
  if (pct >= 85) return "match-badge__pct--high";
  if (pct >= 75) return "match-badge__pct--mid";
  return "match-badge__pct--low";
}

function isRejected(jobId) {
  return rejectedIds.has(jobId);
}

function getApplicationStatus(jobId) {
  return applicationStatus.get(jobId) ?? null;
}

function isVisibleInList(jobId) {
  if (isRejected(jobId)) return showRejected;
  const status = getApplicationStatus(jobId);
  if (status === "applied") return showApplied;
  if (status === "not_applied") return showNotApplied;
  if (status === "not_selected") return showNotSelected;
  return showUnmarked;
}

function visibleJobs() {
  let list = jobs.filter((j) => isVisibleInList(j.id));
  return list.sort((a, b) =>
    sortOrder === "desc" ? b.matchPercent - a.matchPercent : a.matchPercent - b.matchPercent
  );
}

function listEmptyMessage() {
  if (jobs.length === 0) return "No hay empleos con 70%+ de match.";
  const pending = jobs.filter((j) => getApplicationStatus(j.id) === null && !isRejected(j.id)).length;
  if (pending > 0 && !showUnmarked) return "Marcá «Sin Clasificar» para ver empleos pendientes.";
  return "Ningún empleo coincide con los filtros. Marcá alguna categoría arriba.";
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
    <span>Visibles: <strong>${visible}</strong> / ${jobs.length}</span>
    ${fbLine}
    ${appLine}
  `;
}

function renderList() {
  const list = visibleJobs();
  els.jobList.innerHTML = "";

  if (jobs.length === 0) {
    els.listEmpty.classList.remove("hidden");
    els.listEmpty.hidden = false;
    return;
  }

  if (list.length === 0) {
    els.listEmpty.classList.remove("hidden");
    els.listEmpty.hidden = false;
    els.listEmpty.querySelector("p").textContent = listEmptyMessage();
    return;
  }

  els.listEmpty.classList.add("hidden");
  els.listEmpty.hidden = true;

  for (const job of list) {
    const rejected = isRejected(job.id);
    const li = document.createElement("li");
    li.className =
      "job-item" + (job.id === selectedId ? " active" : "") + (rejected ? " rejected" : "");
    li.dataset.id = job.id;
    li.tabIndex = 0;
    const pctClass = matchClass(job.matchPercent);
    const colorVar =
      job.matchPercent >= 85 ? "match-high" : job.matchPercent >= 75 ? "match-mid" : "match-low";
    const rejectedBadge = rejected ? `<span class="badge-rejected">Match incorrecto</span>` : "";
    const appStatus = getApplicationStatus(job.id);
    const appBadge =
      appStatus === "applied"
        ? `<span class="badge-applied">Aplicado</span>`
        : appStatus === "not_applied"
          ? `<span class="badge-not-applied">No aplicado</span>`
          : appStatus === "not_selected"
            ? `<span class="badge-not-selected">No seleccionada/o</span>`
            : "";

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
        <p class="job-item__meta">${escapeHtml(job.modality)} · ${escapeHtml(job.datePosted)}</p>
        ${rejectedBadge}
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
  const meta = rejectionMeta.get(job.id);

  const gapsBlock =
    job.gaps?.length && job.gaps[0] !== "Ninguno"
      ? `<section class="detail__section"><h3>Gaps</h3><ul class="detail__list">${listItems(job.gaps)}</ul></section>`
      : "";

  const feedbackToggle = rejected
    ? `<button type="button" class="feedback-disclosure__toggle" id="feedback-toggle" aria-expanded="false" aria-controls="feedback-panel">
          <span class="feedback-disclosure__chevron" aria-hidden="true">▶</span>
          Match incorrecto
        </button>`
    : `<button type="button" class="feedback-disclosure__toggle" id="feedback-toggle" aria-expanded="false" aria-controls="feedback-panel">
          <span class="feedback-disclosure__chevron" aria-hidden="true">▶</span>
          ¿Match incorrecto?
        </button>`;

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

  const descriptionBlock = renderDescriptionBlock(job.description);
  const appStatus = getApplicationStatus(job.id);
  const linkedInLink = job.url
    ? `<a class="detail__link" href="${escapeAttr(job.url)}" target="_blank" rel="noopener noreferrer">Ver en LinkedIn →</a>`
    : `<p class="detail__meta detail__meta--muted">Sin enlace — empleo de una corrida anterior.</p>`;

  els.detailContent.innerHTML = `
    <header class="detail__header">
      <div class="detail__header-row">
        <div class="detail__header-main">
          <h1 class="detail__title">${escapeHtml(job.title)}</h1>
          <p class="detail__company">${escapeHtml(job.company)}</p>
          <div class="detail__meta">
            <span>${escapeHtml(job.location)}</span>
            <span>${escapeHtml(job.modality)}</span>
            <span>${escapeHtml(job.datePosted)}</span>
            <span>Búsqueda: ${escapeHtml(job.searchTerm)}</span>
          </div>
          ${linkedInLink}
        </div>
        <aside class="detail__header-aside" aria-label="Acciones">
          <div class="application-section application-section--compact">
            <h3 class="application-section__title">Postulación</h3>
            <div class="application-checks">
              <label class="application-check application-check--applied">
                <input type="checkbox" id="chk-applied" ${appStatus === "applied" ? "checked" : ""} />
                <span>Aplicado</span>
              </label>
              <label class="application-check application-check--skipped">
                <input type="checkbox" id="chk-not-applied" ${appStatus === "not_applied" ? "checked" : ""} />
                <span>No aplicado</span>
              </label>
              <label class="application-check application-check--not-selected">
                <input type="checkbox" id="chk-not-selected" ${appStatus === "not_selected" ? "checked" : ""} />
                <span>No seleccionada/o</span>
              </label>
            </div>
          </div>
          <div class="feedback-section feedback-section--compact${rejected ? " feedback-section--rejected" : ""}">
            ${feedbackToggle}
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
  const chkApplied = document.getElementById("chk-applied");
  const chkNotApplied = document.getElementById("chk-not-applied");
  const chkNotSelected = document.getElementById("chk-not-selected");
  if (!chkApplied || !chkNotApplied || !chkNotSelected) return;

  const boxes = [
    { el: chkApplied, status: "applied" },
    { el: chkNotApplied, status: "not_applied" },
    { el: chkNotSelected, status: "not_selected" },
  ];

  for (const { el, status } of boxes) {
    el.addEventListener("change", () => {
      if (el.checked) {
        for (const other of boxes) {
          if (other.el !== el) other.el.checked = false;
        }
        saveApplicationStatus(job, status);
      } else {
        saveApplicationStatus(job, null);
      }
    });
  }
}

async function saveApplicationStatus(job, status) {
  try {
    const res = await fetch("/api/application-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobId: job.id,
        title: job.title,
        company: job.company,
        status,
      }),
    });
    if (!res.ok) throw new Error("No se pudo guardar el estado");
    applyApplicationStatus(await res.json());
    if (status && !isVisibleInList(job.id)) {
      focusNextVisibleJob(job.id);
    } else {
      renderList();
      renderHeader({ scrapedAt: window.__scrapedAt, totalAnalyzed: window.__totalAnalyzed, matchedJobs: jobs });
      renderDetail(job);
    }
  } catch (e) {
    alert(String(e.message ?? e));
    renderDetail(job);
  }
}

function applyApplicationStatus(store) {
  applicationStatus = new Map(store.entries.map((e) => [e.jobId, e.status]));
}

function stubJobFromRejection(rejection) {
  const reason = rejection.reason?.trim();
  return {
    id: rejection.jobId,
    title: rejection.title,
    company: rejection.company,
    location: "—",
    modality: "—",
    datePosted: "—",
    url: "",
    description: reason
      ? `Empleo de una corrida anterior. Motivo del rechazo: ${reason}`
      : "Empleo de una corrida anterior marcado como match incorrecto.",
    searchTerm: rejection.searchTerm ?? "—",
    matchPercent: rejection.matchPercent ?? 0,
    matchedSkills: [],
    gaps: [],
    cvSuggestions: [],
    summary: "Ya no está en el último análisis; visible por feedback guardado.",
  };
}

function stubJobFromApplicationEntry(entry, rejectionById) {
  const rejection = rejectionById.get(entry.jobId);
  return {
    id: entry.jobId,
    title: entry.title,
    company: entry.company,
    location: "—",
    modality: "—",
    datePosted: "—",
    url: "",
    description: "Empleo de una corrida anterior con estado de postulación guardado.",
    searchTerm: rejection?.searchTerm ?? "—",
    matchPercent: rejection?.matchPercent ?? 0,
    matchedSkills: [],
    gaps: [],
    cvSuggestions: [],
    summary: "Ya no está en el último análisis; visible por el estado de postulación guardado.",
  };
}

/** Incluye empleos históricos con feedback o postulación aunque no estén en el último análisis. */
function mergeJobsWithStoredState(matchedJobs, feedback, applicationStatusStore) {
  const byId = new Map(matchedJobs.map((j) => [j.id, j]));
  const rejections = feedback?.rejections ?? [];
  const rejectionById = new Map(rejections.map((r) => [r.jobId, r]));

  for (const rejection of rejections) {
    if (!byId.has(rejection.jobId)) {
      byId.set(rejection.jobId, stubJobFromRejection(rejection));
    }
  }

  for (const entry of applicationStatusStore?.entries ?? []) {
    if (!byId.has(entry.jobId)) {
      byId.set(entry.jobId, stubJobFromApplicationEntry(entry, rejectionById));
    }
  }

  return [...byId.values()];
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

function renderDescriptionBlock(description) {
  if (DESCRIPTION_VIEW === "full") {
    return `<section class="detail__section"><h3>Descripción del puesto</h3><div class="detail__description">${escapeHtml(description)}</div></section>`;
  }

  const bullets = descriptionToBullets(description);
  return `<section class="detail__section">
    <h3>Descripción del puesto</h3>
    <p class="detail__section-note">Resumen en bullets — opción de texto completo abajo (futuro: resumen con IA).</p>
    <ul class="detail__list detail__bullets">${listItems(bullets)}</ul>
    <details class="description-full">
      <summary>Ver descripción completa</summary>
      <div class="detail__description">${escapeHtml(description)}</div>
    </details>
  </section>`;
}

async function rejectMatch(job) {
  const reason = document.getElementById("feedback-reason")?.value?.trim() || undefined;
  try {
    const res = await fetch("/api/feedback/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobId: job.id,
        title: job.title,
        company: job.company,
        searchTerm: job.searchTerm,
        matchPercent: job.matchPercent,
        reason,
      }),
    });
    if (!res.ok) throw new Error("No se pudo guardar el feedback");
    applyFeedback(await res.json());
    focusNextVisibleJob(job.id);
  } catch (e) {
    alert(String(e.message ?? e));
  }
}

async function undoReject(job) {
  try {
    const res = await fetch(`/api/feedback/reject/${encodeURIComponent(job.id)}`, { method: "DELETE" });
    if (!res.ok) throw new Error("No se pudo deshacer");
    applyFeedback(await res.json());
    renderList();
    renderHeader({ scrapedAt: window.__scrapedAt, totalAnalyzed: window.__totalAnalyzed, matchedJobs: jobs });
    renderDetail(job);
  } catch (e) {
    alert(String(e.message ?? e));
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

  els.showRejected.addEventListener("change", () => onFilterChange(els.showRejected));
  els.showApplied.addEventListener("change", () => onFilterChange(els.showApplied));
  els.showNotApplied.addEventListener("change", () => onFilterChange(els.showNotApplied));
  els.showNotSelected.addEventListener("change", () => onFilterChange(els.showNotSelected));
  els.showUnmarked.addEventListener("change", () => onFilterChange(els.showUnmarked));

  function onFilterChange(changed) {
    if (changed === els.showUnmarked && els.showUnmarked.checked) {
      els.showApplied.checked = false;
      els.showNotApplied.checked = false;
      els.showNotSelected.checked = false;
      els.showRejected.checked = false;
    } else if (changed !== els.showUnmarked && changed.checked) {
      els.showUnmarked.checked = false;
    }

    showRejected = els.showRejected.checked;
    showApplied = els.showApplied.checked;
    showNotApplied = els.showNotApplied.checked;
    showNotSelected = els.showNotSelected.checked;
    showUnmarked = els.showUnmarked.checked;
    const list = visibleJobs();
    if (selectedId && !list.some((j) => j.id === selectedId)) {
      focusNextVisibleJob(selectedId);
    } else {
      renderList();
      renderHeader({ scrapedAt: window.__scrapedAt, totalAnalyzed: window.__totalAnalyzed, matchedJobs: jobs });
    }
  }

  try {
    const res = await fetch("/api/results");
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? `HTTP ${res.status}`);
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

    jobs = mergeJobsWithStoredState(
      result.matchedJobs ?? [],
      result.feedback,
      result.applicationStatus
    );

    renderHeader(result);

    if (jobs.length === 0) {
      els.listEmpty.classList.remove("hidden");
      els.listEmpty.hidden = false;
      return;
    }

    const first = visibleJobs()[0] ?? jobs[0];
    selectJob(first.id);
  } catch (e) {
    els.listError.textContent = String(e.message ?? e);
    els.listError.classList.remove("hidden");
    els.listError.hidden = false;
  }
}

init();
