const ESTADO_OPTIONS = [
  "Pendiente",
  "Stand-by",
  "Enviada",
  "Borrador abierto",
  "A-pendiente",
  "A-realizado",
  "Cerrado",
  "Duplicado",
  "Descartado",
];

const ALL = "Todos";
let activeFilter = ALL;
let rows = [];

const filtersEl = document.getElementById("filters");
const cardsEl = document.getElementById("cards");
const summaryEl = document.getElementById("summary");

async function apiFetch(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    "X-Tracker-User": "1",
    ...(options.headers || {}),
  };
  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function matchClass(p) {
  if (p >= 85) return "match--high";
  if (p >= 75) return "match--mid";
  return "match--low";
}

function estadoClass(e) {
  const l = (e || "").toLowerCase();
  if (l === "enviada") return "estado--enviada";
  if (l === "pendiente") return "estado--pendiente";
  if (l.includes("stand")) return "estado--standby";
  return "";
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderFilters() {
  const opts = [ALL, ...ESTADO_OPTIONS.filter((e) => rows.some((r) => r.estado === e))];
  filtersEl.innerHTML = opts
    .map(
      (o) =>
        `<button type="button" class="chip ${o === activeFilter ? "chip--active" : ""}" data-filter="${escapeHtml(o)}">${escapeHtml(o)}</button>`
    )
    .join("");
  filtersEl.querySelectorAll(".chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeFilter = btn.dataset.filter;
      render();
    });
  });
}

function visibleRows() {
  if (activeFilter === ALL) return rows;
  return rows.filter((r) => r.estado === activeFilter);
}

function renderCard(row) {
  const note = row.proximoPaso || row.notas || "—";
  const link = row.linkedinUrl
    ? `<a href="${escapeHtml(row.linkedinUrl)}" target="_blank" rel="noopener">LinkedIn</a>`
    : `<span style="opacity:0.5">Sin link</span>`;
  return `
    <article class="card" data-id="${escapeHtml(row.id)}">
      <div class="card__top">
        <div>
          <h2 class="card__title">${escapeHtml(row.puesto)}</h2>
          <p class="card__company">${escapeHtml(row.empresa)} · ${escapeHtml(row.canal)}</p>
        </div>
        <span class="match ${matchClass(row.matchPercent)}">${row.matchPercent}%</span>
      </div>
      <span class="estado ${estadoClass(row.estado)}">${escapeHtml(row.estado)}</span>
      <p class="meta"><strong>Próximo:</strong> ${escapeHtml(note)}</p>
      ${row.fechaAplicacion ? `<p class="meta"><strong>Aplicado:</strong> ${escapeHtml(row.fechaAplicacion)}</p>` : ""}
      <div class="card__actions">
        ${link}
        <button type="button" data-action="estado">Cambiar estado</button>
      </div>
    </article>`;
}

async function cycleEstado(row) {
  const idx = ESTADO_OPTIONS.indexOf(row.estado);
  const next = ESTADO_OPTIONS[(idx + 1) % ESTADO_OPTIONS.length];
  summaryEl.textContent = "Guardando…";
  try {
    await apiFetch(`/api/tracker/applications/${row.id}`, {
      method: "PATCH",
      body: JSON.stringify({ estado: next }),
    });
    row.estado = next;
    renderFilters();
    render();
  } catch (err) {
    summaryEl.textContent = `Error: ${err.message}`;
  }
}

function render() {
  const list = visibleRows();
  summaryEl.textContent = `${list.length} de ${rows.length} postulaciones`;
  if (!list.length) {
    cardsEl.innerHTML = '<p class="empty">Ninguna fila con ese filtro.</p>';
    return;
  }
  cardsEl.innerHTML = list.map(renderCard).join("");
  cardsEl.querySelectorAll('[data-action="estado"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      const card = btn.closest(".card");
      const id = card.dataset.id;
      const row = rows.find((r) => r.id === id);
      if (row) cycleEstado(row);
    });
  });
}

async function loadRows() {
  summaryEl.textContent = "Cargando…";
  const data = await apiFetch("/api/tracker/applications?sort=matchPercent&order=desc");
  rows = data.applications ?? [];
  renderFilters();
  render();
}

loadRows().catch((err) => {
  summaryEl.textContent = `Error: ${err.message} — ¿docker compose up && npm run tracker:seed?`;
  cardsEl.innerHTML = "";
});
