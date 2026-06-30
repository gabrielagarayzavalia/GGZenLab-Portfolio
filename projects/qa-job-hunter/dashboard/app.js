let jobs = [];
let selectedId = null;
let sortOrder = "desc";

const els = {
  headerStats: document.getElementById("header-stats"),
  jobList: document.getElementById("job-list"),
  sortSelect: document.getElementById("sort-select"),
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

function sortedJobs() {
  return [...jobs].sort((a, b) =>
    sortOrder === "desc" ? b.matchPercent - a.matchPercent : a.matchPercent - b.matchPercent
  );
}

function renderHeader(result) {
  const date = new Date(result.scrapedAt).toLocaleString("es-AR");
  els.headerStats.innerHTML = `
    <span>Fecha: <strong>${date}</strong></span>
    <span>Analizados: <strong>${result.totalAnalyzed}</strong></span>
    <span>Match 70%+: <strong>${result.matchedJobs.length}</strong></span>
  `;
}

function renderList() {
  const list = sortedJobs();
  els.jobList.innerHTML = "";
  if (list.length === 0) {
    els.listEmpty.classList.remove("hidden");
    els.listEmpty.hidden = false;
    return;
  }
  els.listEmpty.classList.add("hidden");
  els.listEmpty.hidden = true;
  for (const job of list) {
    const li = document.createElement("li");
    li.className = "job-item" + (job.id === selectedId ? " active" : "");
    li.dataset.id = job.id;
    li.tabIndex = 0;
    const pctClass = matchClass(job.matchPercent);
    const colorVar = job.matchPercent >= 85 ? "match-high" : job.matchPercent >= 75 ? "match-mid" : "match-low";
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
      </div>`;
    li.addEventListener("click", () => selectJob(job.id));
    li.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectJob(job.id); }
    });
    els.jobList.appendChild(li);
  }
}

function selectJob(id) {
  selectedId = id;
  renderList();
  const job = jobs.find((j) => j.id === id);
  if (job) renderDetail(job);
}

function renderDetail(job) {
  els.detailEmpty.classList.add("hidden");
  els.detailEmpty.hidden = true;
  els.detailContent.classList.remove("hidden");
  els.detailContent.hidden = false;
  const pctClass = matchClass(job.matchPercent);
  const gapsBlock = job.gaps?.length && job.gaps[0] !== "Ninguno"
    ? `<section class="detail__section"><h3>Gaps</h3><ul class="detail__list">${listItems(job.gaps)}</ul></section>` : "";
  els.detailContent.innerHTML = `
    <header class="detail__header">
      <div class="detail__match"><span class="match-badge__pct ${pctClass}">${job.matchPercent}% match</span></div>
      <h1 class="detail__title">${escapeHtml(job.title)}</h1>
      <p class="detail__company">${escapeHtml(job.company)}</p>
      <div class="detail__meta">
        <span>${escapeHtml(job.location)}</span>
        <span>${escapeHtml(job.modality)}</span>
        <span>${escapeHtml(job.datePosted)}</span>
        <span>Busqueda: ${escapeHtml(job.searchTerm)}</span>
      </div>
      <a class="detail__link" href="${escapeAttr(job.url)}" target="_blank" rel="noopener noreferrer">Ver en LinkedIn</a>
    </header>
    <section class="detail__section"><h3>Descripcion del puesto</h3><div class="detail__description">${escapeHtml(job.description)}</div></section>
    <section class="detail__section"><h3>Skills que coinciden</h3><ul class="detail__list">${listItems(job.matchedSkills)}</ul></section>
    ${gapsBlock}
    <section class="detail__section"><h3>Sugerencias para el CV</h3><ul class="detail__list">${listItems(job.cvSuggestions)}</ul></section>
    <section class="detail__section"><h3>Resumen del analisis</h3><p class="detail__summary">${escapeHtml(job.summary)}</p></section>`;
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
  try {
    const res = await fetch("/api/results");
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? `HTTP ${res.status}`);
    }
    const result = await res.json();
    jobs = result.matchedJobs ?? [];
    renderHeader(result);
    if (jobs.length === 0) {
      els.listEmpty.classList.remove("hidden");
      els.listEmpty.hidden = false;
      return;
    }
    selectJob(sortedJobs()[0].id);
  } catch (e) {
    els.listError.textContent = String(e.message ?? e);
    els.listError.classList.remove("hidden");
    els.listError.hidden = false;
  }
}

init();
