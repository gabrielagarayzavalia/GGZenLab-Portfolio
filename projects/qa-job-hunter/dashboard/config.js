/**
 * Config shell + Fuentes/Sitios (B18-01 / B18-05 / B18-07).
 */

const tabs = [...document.querySelectorAll(".config-tab")];
const panels = [...document.querySelectorAll(".config-panel")];

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
}

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
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
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
  const meta = [
    q.kind,
    q.required ? "req" : "opc",
    badge,
    q.origin === "auto_apply" ? "auto" : "manual",
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
    const current = row.querySelector(".config-row__meta + .config-row__meta")?.textContent?.replace(/^→\s*/, "") || "";
    const answer = prompt("Respuesta para reintentar apply", current);
    if (answer == null) return;
    try {
      await apiJson(`/api/config/questions/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ answer: answer.trim() }),
      });
      setStatus(status, "Respuesta guardada.");
      await loadPreguntas();
    } catch (err) {
      setStatus(status, err.message || "No se pudo guardar", true);
    }
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

activate(panelFromHash());
