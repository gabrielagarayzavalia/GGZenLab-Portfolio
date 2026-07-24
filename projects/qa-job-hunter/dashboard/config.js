/**
 * Config shell + Fuentes/Sitios (B18-01 / B18-05 / B18-07).
 */

import { resolveAnswerStrategy } from "./config-answer-strategies.js";

const tabs = [...document.querySelectorAll(".config-tab")];
const panels = [...document.querySelectorAll(".config-panel")];

const DASHBOARD_HINT =
  "Reiniciá el dashboard: cd projects/qa-job-hunter && npm run dashboard (http://localhost:3847/config)";

function showApiBanner(message) {
  let el = document.getElementById("config-api-banner");
  if (!el) {
    el = document.createElement("p");
    el.id = "config-api-banner";
    el.className = "config-status config-status--error";
    el.style.margin = "0 1.5rem 1rem";
    document.querySelector(".config-layout")?.prepend(el);
  }
  el.hidden = !message;
  el.textContent = message || "";
}

async function ensureDashboardApi() {
  if (location.protocol === "file:") {
    showApiBanner(
      `Abrí Config desde el servidor local (${DASHBOARD_HINT}). file:// no tiene API.`
    );
    return false;
  }
  try {
    const res = await fetch("/api/health");
    if (!res.ok) {
      showApiBanner(`API no disponible (HTTP ${res.status}). ${DASHBOARD_HINT}`);
      return false;
    }
    const data = await res.json().catch(() => ({}));
    if (!data?.features?.configQuestions) {
      showApiBanner(`Dashboard desactualizado (falta API Preguntas). ${DASHBOARD_HINT}`);
      return false;
    }
    showApiBanner("");
    return true;
  } catch {
    showApiBanner(`No se pudo conectar al API. ${DASHBOARD_HINT}`);
    return false;
  }
}

function activate(panelId) {
  for (const tab of tabs) {
    const selected = tab.dataset.panel === panelId;
    tab.setAttribute("aria-selected", selected ? "true" : "false");
  }
  for (const panel of panels) {
    const id = panel.id.replace(/^panel-/, "");
    const show = id === panelId;
    panel.hidden = !show;
  }
  const hash = `#${panelId}`;
  if (location.hash !== hash) {
    history.replaceState(null, "", hash);
  }
  if (panelId === "fuentes") void loadFuentes();
  if (panelId === "sitios") void loadSitios();
  if (panelId === "preguntas") void loadPreguntas();
  if (panelId === "puestos") void loadPuestos();
  if (panelId === "empleo") void loadEmpleo();
  if (panelId === "cvs")   void loadCvs();
}

/** Cache de preguntas cargadas (id → objeto completo para Strategy UI). */
const preguntasById = new Map();

const answerDialog = document.getElementById("pregunta-answer-dialog");
const answerForm = document.getElementById("pregunta-answer-form");
const answerTitle = document.getElementById("pregunta-answer-title");
const answerMeta = document.getElementById("pregunta-answer-meta");
const answerHint = document.getElementById("pregunta-answer-hint");
const answerField = document.getElementById("pregunta-answer-field");
let answerDialogQuestionId = null;
let answerDialogStrategy = null;

function openAnswerDialog(question) {
  if (!answerDialog || !answerField) return;
  answerDialogQuestionId = question.id;
  answerDialogStrategy = resolveAnswerStrategy(question);
  if (answerTitle) answerTitle.textContent = question.label;
  if (answerMeta) {
    answerMeta.textContent = [question.kind, question.required ? "req" : "opc", question.origin]
      .filter(Boolean)
      .join(" · ");
  }
  if (answerHint) answerHint.textContent = answerDialogStrategy.hint || "";
  answerDialogStrategy.mount(answerField, { currentAnswer: question.answer || "" });
  answerDialog.showModal();
  const focusable = answerField.querySelector("select, input");
  focusable?.focus();
}

document.getElementById("pregunta-answer-cancel")?.addEventListener("click", () => {
  answerDialog?.close();
  answerDialogQuestionId = null;
  answerDialogStrategy = null;
});

answerForm?.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const status = document.getElementById("preguntas-status");
  const id = answerDialogQuestionId;
  const strategy = answerDialogStrategy;
  if (!id || !strategy || !answerField) return;
  const answer = strategy.readValue(answerField);
  if (!answer) {
    setStatus(status, "Elegí o escribí una respuesta.", true);
    return;
  }
  try {
    await apiJson(`/api/config/questions/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ answer }),
    });
    answerDialog?.close();
    answerDialogQuestionId = null;
    answerDialogStrategy = null;
    setStatus(status, "Respuesta guardada.");
    await loadPreguntas();
  } catch (err) {
    setStatus(status, err.message || "No se pudo guardar", true);
  }
});

function panelFromHash() {
  const raw = (location.hash || "").replace(/^#/, "").trim();
  if (raw && tabs.some((t) => t.dataset.panel === raw)) return raw;
  return "preguntas";
}

for (const tab of tabs) {
  tab.addEventListener("click", () => activate(tab.dataset.panel ?? "preguntas"));
}

window.addEventListener("hashchange", () => activate(panelFromHash()));

function setStatus(el, msg, isError = false) {
  if (!el) return;
  el.hidden = !msg;
  el.textContent = msg || "";
  el.classList.toggle("config-status--error", Boolean(isError && msg));
}

async function apiJson(url, options) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 404 && String(url).includes("/api/config/")) {
      throw new Error(`API Config no encontrada (404). ${DASHBOARD_HINT}`);
    }
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function rowAdapter(s) {
  const meta = [s.adapterId ? `id: ${s.adapterId}` : null, s.url || null]
    .filter(Boolean)
    .join(" · ");
  return `<li class="config-row" data-id="${esc(s.id)}">
    <label class="config-toggle">
      <input type="checkbox" data-action="toggle" ${s.enabled ? "checked" : ""} />
      <span class="config-row__name">${esc(s.name)}</span>
    </label>
    <p class="config-row__meta">${esc(meta)}</p>
  </li>`;
}

function rowSite(s) {
  const archived = s.archived ? " config-row--archived" : "";
  return `<li class="config-row${archived}" data-id="${esc(s.id)}">
    <label class="config-toggle">
      <input type="checkbox" data-action="toggle" ${s.enabled ? "checked" : ""} ${s.archived ? "disabled" : ""} />
      <span class="config-row__name">${esc(s.name)}</span>
    </label>
    <p class="config-row__meta">${esc(s.url || "—")}</p>
    <div class="config-row__actions">
      <button type="button" class="config-btn config-btn--ghost" data-action="edit">Editar</button>
      <button type="button" class="config-btn config-btn--ghost" data-action="archive">
        ${s.archived ? "Restaurar" : "Archivar"}
      </button>
    </div>
  </li>`;
}

async function loadFuentes() {
  const list = document.getElementById("fuentes-list");
  const status = document.getElementById("fuentes-status");
  if (!list) return;
  setStatus(status, "Cargando…");
  try {
    const data = await apiJson("/api/config/sources?kind=adapter");
    list.innerHTML = data.sources.map(rowAdapter).join("") || "<li class=\"config-row\">Sin fuentes.</li>";
    setStatus(status, "");
  } catch (err) {
    setStatus(status, err.message || "Error al cargar", true);
  }
}

async function loadSitios() {
  const list = document.getElementById("sitios-list");
  const status = document.getElementById("sitios-status");
  const showArchived = document.getElementById("sitios-show-archived")?.checked;
  if (!list) return;
  setStatus(status, "Cargando…");
  try {
    const q = showArchived ? "?kind=site&archived=1" : "?kind=site";
    const data = await apiJson(`/api/config/sources${q}`);
    const sites = showArchived
      ? data.sources
      : data.sources.filter((s) => !s.archived);
    list.innerHTML =
      sites.map(rowSite).join("") ||
      "<li class=\"config-row\">Todavía no hay sitios. Agregá el primero abajo.</li>";
    setStatus(status, "");
  } catch (err) {
    setStatus(status, err.message || "Error al cargar", true);
  }
}

document.getElementById("fuentes-list")?.addEventListener("change", async (ev) => {
  const input = ev.target;
  if (!(input instanceof HTMLInputElement) || input.dataset.action !== "toggle") return;
  const row = input.closest("[data-id]");
  const id = row?.dataset.id;
  const status = document.getElementById("fuentes-status");
  if (!id) return;
  try {
    await apiJson(`/api/config/sources/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ enabled: input.checked }),
    });
    setStatus(status, "Guardado.");
  } catch (err) {
    input.checked = !input.checked;
    setStatus(status, err.message || "No se pudo guardar", true);
  }
});

document.getElementById("fuentes-form")?.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const form = ev.target;
  const status = document.getElementById("fuentes-status");
  const fd = new FormData(form);
  try {
    await apiJson("/api/config/sources", {
      method: "POST",
      body: JSON.stringify({
        kind: "adapter",
        name: String(fd.get("name") || ""),
        adapterId: String(fd.get("adapterId") || ""),
        url: String(fd.get("url") || "") || undefined,
        enabled: true,
      }),
    });
    form.reset();
    setStatus(status, "Fuente agregada.");
    await loadFuentes();
  } catch (err) {
    setStatus(status, err.message || "No se pudo agregar", true);
  }
});

document.getElementById("sitios-list")?.addEventListener("change", async (ev) => {
  const input = ev.target;
  if (!(input instanceof HTMLInputElement) || input.dataset.action !== "toggle") return;
  const row = input.closest("[data-id]");
  const id = row?.dataset.id;
  const status = document.getElementById("sitios-status");
  if (!id) return;
  try {
    await apiJson(`/api/config/sources/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ enabled: input.checked }),
    });
    setStatus(status, "Guardado.");
  } catch (err) {
    input.checked = !input.checked;
    setStatus(status, err.message || "No se pudo guardar", true);
  }
});

document.getElementById("sitios-list")?.addEventListener("click", async (ev) => {
  const btn = ev.target.closest("[data-action]");
  if (!(btn instanceof HTMLButtonElement)) return;
  const row = btn.closest("[data-id]");
  const id = row?.dataset.id;
  const status = document.getElementById("sitios-status");
  if (!id) return;

  if (btn.dataset.action === "edit") {
    const name = prompt("Nombre del sitio", row.querySelector(".config-row__name")?.textContent || "");
    if (name == null) return;
    const url = prompt("URL", row.querySelector(".config-row__meta")?.textContent || "");
    if (url == null) return;
    try {
      await apiJson(`/api/config/sources/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ name: name.trim(), url: url.trim() }),
      });
      setStatus(status, "Sitio actualizado.");
      await loadSitios();
    } catch (err) {
      setStatus(status, err.message || "No se pudo editar", true);
    }
    return;
  }

  if (btn.dataset.action === "archive") {
    const archived = !row.classList.contains("config-row--archived");
    try {
      await apiJson(`/api/config/sources/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ archived, enabled: archived ? false : undefined }),
      });
      setStatus(status, archived ? "Archivado." : "Restaurado.");
      await loadSitios();
    } catch (err) {
      setStatus(status, err.message || "No se pudo archivar", true);
    }
  }
});

document.getElementById("sitios-form")?.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const form = ev.target;
  const status = document.getElementById("sitios-status");
  const fd = new FormData(form);
  try {
    await apiJson("/api/config/sources", {
      method: "POST",
      body: JSON.stringify({
        kind: "site",
        name: String(fd.get("name") || ""),
        url: String(fd.get("url") || ""),
        enabled: true,
      }),
    });
    form.reset();
    setStatus(status, "Sitio agregado.");
    await loadSitios();
  } catch (err) {
    setStatus(status, err.message || "No se pudo agregar", true);
  }
});

document.getElementById("sitios-show-archived")?.addEventListener("change", () => {
  void loadSitios();
});

function rowPregunta(q) {
  const badge = q.status === "unanswered" ? "sin respuesta" : q.status;
  const optCount = Array.isArray(q.options) ? q.options.filter(Boolean).length : 0;
  const meta = [
    q.kind,
    q.required ? "req" : "opc",
    badge,
    q.origin === "auto_apply" ? "auto" : "manual",
    optCount > 0 ? `${optCount} opts` : null,
    q.lastCompany ? `@ ${q.lastCompany}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const answerPreview = q.answer
    ? `<p class="config-row__meta">→ ${esc(q.answer)}</p>`
    : "";
  return `<li class="config-row" data-id="${esc(q.id)}">
    <span class="config-row__name">${esc(q.label)}</span>
    <p class="config-row__meta">${esc(meta)}</p>
    ${answerPreview}
    <div class="config-row__actions">
      <button type="button" class="config-btn config-btn--ghost" data-action="answer">Responder</button>
      <button type="button" class="config-btn config-btn--ghost" data-action="archive">Archivar</button>
    </div>
  </li>`;
}

async function loadPreguntas() {
  const list = document.getElementById("preguntas-list");
  const status = document.getElementById("preguntas-status");
  const onlyUnanswered = document.getElementById("preguntas-only-unanswered")?.checked;
  if (!list) return;
  setStatus(status, "Cargando…");
  try {
    const q = onlyUnanswered ? "?status=unanswered" : "?archived=1";
    const data = await apiJson(`/api/config/questions${q}`);
    const items = onlyUnanswered
      ? data.questions
      : data.questions.filter((x) => x.status !== "archived");
    preguntasById.clear();
    for (const q of items) preguntasById.set(q.id, q);
    list.innerHTML =
      items.map(rowPregunta).join("") ||
      "<li class=\"config-row\">Sin preguntas aún. Aparecen solas en apply (#154) o agregá abajo.</li>";
    setStatus(status, "");
  } catch (err) {
    setStatus(status, err.message || "Error al cargar", true);
  }
}

document.getElementById("preguntas-only-unanswered")?.addEventListener("change", () => {
  void loadPreguntas();
});

document.getElementById("preguntas-form")?.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const form = ev.target;
  const status = document.getElementById("preguntas-status");
  const fd = new FormData(form);
  try {
    await apiJson("/api/config/questions", {
      method: "POST",
      body: JSON.stringify({
        label: String(fd.get("label") || ""),
        answer: String(fd.get("answer") || "") || undefined,
      }),
    });
    form.reset();
    setStatus(status, "Pregunta agregada.");
    await loadPreguntas();
  } catch (err) {
    setStatus(status, err.message || "No se pudo agregar", true);
  }
});

document.getElementById("preguntas-list")?.addEventListener("click", async (ev) => {
  const btn = ev.target.closest("[data-action]");
  if (!(btn instanceof HTMLButtonElement)) return;
  const row = btn.closest("[data-id]");
  const id = row?.dataset.id;
  const status = document.getElementById("preguntas-status");
  if (!id) return;

  if (btn.dataset.action === "answer") {
    const question = preguntasById.get(id);
    if (!question) {
      setStatus(status, "Recargá la lista (F5).", true);
      return;
    }
    openAnswerDialog(question);
    return;
  }

  if (btn.dataset.action === "archive") {
    try {
      await apiJson(`/api/config/questions/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "archived" }),
      });
      setStatus(status, "Archivada.");
      await loadPreguntas();
    } catch (err) {
      setStatus(status, err.message || "No se pudo archivar", true);
    }
  }
});

function rowPuesto(p) {
  const archived = p.archived ? " config-row--archived" : "";
  const meta = [p.keywords || "—", p.enabled ? "activo" : "off"].join(" · ");
  return `<li class="config-row${archived}" data-id="${esc(p.id)}">
    <label class="config-toggle">
      <input type="checkbox" data-action="toggle" ${p.enabled ? "checked" : ""} ${p.archived ? "disabled" : ""} />
      <span class="config-row__name">${esc(p.title)}</span>
    </label>
    <p class="config-row__meta">${esc(meta)}</p>
    <div class="config-row__actions">
      <button type="button" class="config-btn config-btn--ghost" data-action="edit">Editar</button>
      <button type="button" class="config-btn config-btn--ghost" data-action="archive">
        ${p.archived ? "Restaurar" : "Archivar"}
      </button>
    </div>
  </li>`;
}

async function loadPuestos() {
  const list = document.getElementById("puestos-list");
  const status = document.getElementById("puestos-status");
  const showArchived = document.getElementById("puestos-show-archived")?.checked;
  if (!list) return;
  setStatus(status, "Cargando…");
  try {
    const q = showArchived ? "?archived=1" : "";
    const data = await apiJson(`/api/config/puestos${q}`);
    const items = showArchived ? data.puestos : data.puestos.filter((p) => !p.archived);
    list.innerHTML =
      items.map(rowPuesto).join("") ||
      "<li class=\"config-row\">Sin puestos. Agregá el primero abajo.</li>";
    setStatus(status, "");
  } catch (err) {
    setStatus(status, err.message || "Error al cargar", true);
  }
}

document.getElementById("puestos-list")?.addEventListener("change", async (ev) => {
  const input = ev.target;
  if (!(input instanceof HTMLInputElement) || input.dataset.action !== "toggle") return;
  const row = input.closest("[data-id]");
  const id = row?.dataset.id;
  const status = document.getElementById("puestos-status");
  if (!id) return;
  try {
    await apiJson(`/api/config/puestos/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ enabled: input.checked }),
    });
    setStatus(status, "Guardado.");
  } catch (err) {
    input.checked = !input.checked;
    setStatus(status, err.message || "No se pudo guardar", true);
  }
});

document.getElementById("puestos-list")?.addEventListener("click", async (ev) => {
  const btn = ev.target.closest("[data-action]");
  if (!(btn instanceof HTMLButtonElement)) return;
  const row = btn.closest("[data-id]");
  const id = row?.dataset.id;
  const status = document.getElementById("puestos-status");
  if (!id) return;

  if (btn.dataset.action === "edit") {
    const title = prompt("Título / rol", row.querySelector(".config-row__name")?.textContent || "");
    if (title == null) return;
    const keywords = prompt(
      "Keywords",
      (row.querySelector(".config-row__meta")?.textContent || "").split(" · ")[0] || ""
    );
    if (keywords == null) return;
    try {
      await apiJson(`/api/config/puestos/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ title: title.trim(), keywords: keywords.trim() }),
      });
      setStatus(status, "Puesto actualizado.");
      await loadPuestos();
    } catch (err) {
      setStatus(status, err.message || "No se pudo editar", true);
    }
    return;
  }

  if (btn.dataset.action === "archive") {
    const archived = !row.classList.contains("config-row--archived");
    try {
      await apiJson(`/api/config/puestos/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ archived, enabled: archived ? false : undefined }),
      });
      setStatus(status, archived ? "Archivado." : "Restaurado.");
      await loadPuestos();
    } catch (err) {
      setStatus(status, err.message || "No se pudo archivar", true);
    }
  }
});

document.getElementById("puestos-form")?.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const form = ev.target;
  const status = document.getElementById("puestos-status");
  const fd = new FormData(form);
  try {
    await apiJson("/api/config/puestos", {
      method: "POST",
      body: JSON.stringify({
        title: String(fd.get("title") || ""),
        keywords: String(fd.get("keywords") || "") || undefined,
        enabled: true,
      }),
    });
    form.reset();
    setStatus(status, "Puesto agregado.");
    await loadPuestos();
  } catch (err) {
    setStatus(status, err.message || "No se pudo agregar", true);
  }
});

document.getElementById("puestos-show-archived")?.addEventListener("change", () => {
  void loadPuestos();
});

function rowEmpleo(p) {
  const archived = p.archived ? " config-row--archived" : "";
  const meta = [
    p.keywords || "—",
    p.seniority,
    p.remote,
    p.location || null,
    p.enabled ? "activo" : "off",
  ]
    .filter(Boolean)
    .join(" · ");
  const notes = p.notes
    ? `<p class="config-row__meta">${esc(p.notes)}</p>`
    : "";
  return `<li class="config-row${archived}" data-id="${esc(p.id)}">
    <label class="config-toggle">
      <input type="checkbox" data-action="toggle" ${p.enabled ? "checked" : ""} ${p.archived ? "disabled" : ""} />
      <span class="config-row__name">${esc(p.title)}</span>
    </label>
    <p class="config-row__meta">${esc(meta)}</p>
    ${notes}
    <div class="config-row__actions">
      <button type="button" class="config-btn config-btn--ghost" data-action="edit">Editar</button>
      <button type="button" class="config-btn config-btn--ghost" data-action="archive">
        ${p.archived ? "Restaurar" : "Archivar"}
      </button>
    </div>
  </li>`;
}

async function loadEmpleo() {
  const list = document.getElementById("empleo-list");
  const status = document.getElementById("empleo-status");
  const showArchived = document.getElementById("empleo-show-archived")?.checked;
  if (!list) return;
  setStatus(status, "Cargando…");
  try {
    const q = showArchived ? "?archived=1" : "";
    const data = await apiJson(`/api/config/empleo${q}`);
    const items = showArchived
      ? data.profiles
      : data.profiles.filter((p) => !p.archived);
    list.innerHTML =
      items.map(rowEmpleo).join("") ||
      "<li class=\"config-row\">Sin perfiles. Agregá el primero abajo.</li>";
    setStatus(status, "");
  } catch (err) {
    setStatus(status, err.message || "Error al cargar", true);
  }
}

document.getElementById("empleo-list")?.addEventListener("change", async (ev) => {
  const input = ev.target;
  if (!(input instanceof HTMLInputElement) || input.dataset.action !== "toggle") return;
  const row = input.closest("[data-id]");
  const id = row?.dataset.id;
  const status = document.getElementById("empleo-status");
  if (!id) return;
  try {
    await apiJson(`/api/config/empleo/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ enabled: input.checked }),
    });
    setStatus(status, "Guardado.");
  } catch (err) {
    input.checked = !input.checked;
    setStatus(status, err.message || "No se pudo guardar", true);
  }
});

document.getElementById("empleo-list")?.addEventListener("click", async (ev) => {
  const btn = ev.target.closest("[data-action]");
  if (!(btn instanceof HTMLButtonElement)) return;
  const row = btn.closest("[data-id]");
  const id = row?.dataset.id;
  const status = document.getElementById("empleo-status");
  if (!id) return;

  if (btn.dataset.action === "edit") {
    const title = prompt("Título", row.querySelector(".config-row__name")?.textContent || "");
    if (title == null) return;
    const keywords = prompt("Keywords", "");
    if (keywords == null) return;
    const seniority = prompt("Seniority (junior|semi|senior|lead|any)", "semi");
    if (seniority == null) return;
    const remote = prompt("Modalidad (remote|hybrid|onsite|any)", "remote");
    if (remote == null) return;
    const location = prompt("Location", "Argentina / LATAM");
    if (location == null) return;
    const notes = prompt("Notas", "");
    if (notes == null) return;
    try {
      await apiJson(`/api/config/empleo/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: title.trim(),
          keywords: keywords.trim(),
          seniority: seniority.trim(),
          remote: remote.trim(),
          location: location.trim(),
          notes: notes.trim(),
        }),
      });
      setStatus(status, "Perfil actualizado.");
      await loadEmpleo();
    } catch (err) {
      setStatus(status, err.message || "No se pudo editar", true);
    }
    return;
  }

  if (btn.dataset.action === "archive") {
    const archived = !row.classList.contains("config-row--archived");
    try {
      await apiJson(`/api/config/empleo/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ archived, enabled: archived ? false : undefined }),
      });
      setStatus(status, archived ? "Archivado." : "Restaurado.");
      await loadEmpleo();
    } catch (err) {
      setStatus(status, err.message || "No se pudo archivar", true);
    }
  }
});

document.getElementById("empleo-form")?.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const form = ev.target;
  const status = document.getElementById("empleo-status");
  const fd = new FormData(form);
  try {
    await apiJson("/api/config/empleo", {
      method: "POST",
      body: JSON.stringify({
        title: String(fd.get("title") || ""),
        keywords: String(fd.get("keywords") || ""),
        seniority: String(fd.get("seniority") || "any"),
        remote: String(fd.get("remote") || "any"),
        location: String(fd.get("location") || ""),
        notes: String(fd.get("notes") || ""),
        enabled: true,
      }),
    });
    form.reset();
    setStatus(status, "Perfil agregado.");
    await loadEmpleo();
  } catch (err) {
    setStatus(status, err.message || "No se pudo agregar", true);
  }
});

document.getElementById("empleo-show-archived")?.addEventListener("change", () => {
  void loadEmpleo();
});

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function rowCv(c) {
  const archived = c.archived ? " config-row--archived" : "";
  const def = c.isDefault ? " · default" : "";
  const meta = `${c.label} · ${formatBytes(c.sizeBytes)}${def}`;
  return `<li class="config-row${archived}" data-id="${esc(c.id)}">
    <span class="config-row__name">${esc(c.originalName)}</span>
    <p class="config-row__meta">${esc(meta)}</p>
    <div class="config-row__actions">
      <a class="config-btn config-btn--ghost" href="/api/config/cvs/${encodeURIComponent(c.id)}/file" target="_blank" rel="noopener">Ver</a>
      <button type="button" class="config-btn config-btn--ghost" data-action="default" ${c.isDefault || c.archived ? "disabled" : ""}>Default</button>
      <button type="button" class="config-btn config-btn--ghost" data-action="edit">Editar</button>
      <button type="button" class="config-btn config-btn--ghost" data-action="archive">${c.archived ? "Restaurar" : "Archivar"}</button>
      <button type="button" class="config-btn config-btn--ghost" data-action="delete">Eliminar</button>
    </div>
  </li>`;
}

async function fillCvsEmpleoSelect() {
  const sel = document.getElementById("cvs-empleo-select");
  if (!sel) return;
  try {
    const data = await apiJson("/api/config/empleo");
    const current = sel.value;
    sel.innerHTML =
      '<option value="">— Ninguno —</option>' +
      data.profiles
        .filter((p) => !p.archived)
        .map((p) => `<option value="${esc(p.id)}">${esc(p.title)}</option>`)
        .join("");
    if (current) sel.value = current;
  } catch {
    /* ignore */
  }
}

async function loadCvs() {
  const list = document.getElementById("cvs-list");
  const status = document.getElementById("cvs-status");
  const showArchived = document.getElementById("cvs-show-archived")?.checked;
  if (!list) return;
  setStatus(status, "Cargando…");
  await fillCvsEmpleoSelect();
  try {
    const q = showArchived ? "?archived=1" : "";
    const data = await apiJson(`/api/config/cvs${q}`);
    const items = showArchived ? data.cvs : data.cvs.filter((c) => !c.archived);
    list.innerHTML =
      items.map(rowCv).join("") ||
      "<li class=\"config-row\">Sin CVs. Subí un PDF abajo.</li>";
    setStatus(status, "");
  } catch (err) {
    setStatus(status, err.message || "Error al cargar", true);
  }
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const b64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(b64);
    };
    reader.onerror = () => reject(reader.error || new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });
}

document.getElementById("cvs-form")?.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const form = ev.target;
  const status = document.getElementById("cvs-status");
  const fd = new FormData(form);
  const file = fd.get("file");
  if (!(file instanceof File)) {
    setStatus(status, "Elegí un PDF", true);
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    setStatus(status, "Máximo 5 MB", true);
    return;
  }
  setStatus(status, "Subiendo…");
  try {
    const contentBase64 = await readFileAsBase64(file);
    await apiJson("/api/config/cvs", {
      method: "POST",
      body: JSON.stringify({
        originalName: file.name,
        contentBase64,
        label: String(fd.get("label") || "") || undefined,
        empleoProfileId: String(fd.get("empleoProfileId") || "") || undefined,
        setDefault: fd.get("setDefault") === "on",
      }),
    });
    form.reset();
    setStatus(status, "CV subido.");
    await loadCvs();
  } catch (err) {
    setStatus(status, err.message || "No se pudo subir", true);
  }
});

document.getElementById("cvs-list")?.addEventListener("click", async (ev) => {
  const btn = ev.target.closest("[data-action]");
  if (!(btn instanceof HTMLButtonElement)) return;
  const row = btn.closest("[data-id]");
  const id = row?.dataset.id;
  const status = document.getElementById("cvs-status");
  if (!id) return;

  if (btn.dataset.action === "default") {
    try {
      await apiJson(`/api/config/cvs/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ isDefault: true }),
      });
      setStatus(status, "Default actualizado.");
      await loadCvs();
    } catch (err) {
      setStatus(status, err.message || "Error", true);
    }
    return;
  }

  if (btn.dataset.action === "edit") {
    const label = prompt("Etiqueta para matching", row.querySelector(".config-row__meta")?.textContent || "");
    if (label == null) return;
    const empleoProfileId = prompt("ID perfil empleo (vacío = ninguno)", "") ?? "";
    try {
      await apiJson(`/api/config/cvs/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          label: label.trim(),
          empleoProfileId: empleoProfileId.trim() || "",
        }),
      });
      setStatus(status, "CV actualizado.");
      await loadCvs();
    } catch (err) {
      setStatus(status, err.message || "Error", true);
    }
    return;
  }

  if (btn.dataset.action === "archive") {
    const archived = !row.classList.contains("config-row--archived");
    try {
      await apiJson(`/api/config/cvs/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ archived }),
      });
      setStatus(status, archived ? "Archivado." : "Restaurado.");
      await loadCvs();
    } catch (err) {
      setStatus(status, err.message || "Error", true);
    }
    return;
  }

  if (btn.dataset.action === "delete") {
    if (!confirm("¿Eliminar este CV del disco?")) return;
    try {
      await apiJson(`/api/config/cvs/${encodeURIComponent(id)}`, { method: "DELETE" });
      setStatus(status, "Eliminado.");
      await loadCvs();
    } catch (err) {
      setStatus(status, err.message || "Error", true);
    }
  }
});

document.getElementById("cvs-show-archived")?.addEventListener("change", () => {
  void loadCvs();
});

activate(panelFromHash());
void ensureDashboardApi().then((ok) => {
  if (ok && panelFromHash() === "preguntas") void loadPreguntas();
});
