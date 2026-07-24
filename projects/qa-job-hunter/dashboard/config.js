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

activate(panelFromHash());
