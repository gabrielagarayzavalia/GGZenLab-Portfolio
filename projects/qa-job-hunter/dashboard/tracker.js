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

const statusEl = document.getElementById("status");
const searchEl = document.getElementById("search");
const filterEstadoEl = document.getElementById("filter-estado");
let gridApi = null;
let saveTimer = null;

for (const e of ESTADO_OPTIONS) {
  const opt = document.createElement("option");
  opt.value = e;
  opt.textContent = e;
  filterEstadoEl.appendChild(opt);
}

function matchClass(p) {
  if (p >= 85) return "match-high";
  if (p >= 75) return "match-mid";
  return "match-low";
}

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

async function loadRows() {
  const params = new URLSearchParams({ sort: "matchPercent", order: "desc" });
  const q = searchEl.value.trim();
  const estado = filterEstadoEl.value;
  if (q) params.set("q", q);
  if (estado) params.set("estado", estado);
  const data = await apiFetch(`/api/tracker/applications?${params}`);
  gridApi.setGridOption("rowData", data.applications);
  statusEl.textContent = `${data.count} filas`;
}

async function savePatch(id, field, value) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      statusEl.textContent = "Guardando…";
      const body = { [field]: value };
      const result = await apiFetch(`/api/tracker/applications/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      if (result.warnings?.length) {
        statusEl.textContent = result.warnings.join(" · ");
      } else {
        statusEl.textContent = "Guardado";
      }
    } catch (err) {
      statusEl.textContent = `Error: ${err.message}`;
    }
  }, 400);
}

const columnDefs = [
  {
    field: "matchPercent",
    headerName: "Match %",
    width: 95,
    editable: true,
    cellClass: (p) => matchClass(p.value),
    valueFormatter: (p) => (p.value != null ? `${p.value}%` : ""),
    valueParser: (p) => parseInt(String(p.newValue).replace("%", ""), 10) || 0,
  },
  { field: "puesto", headerName: "Puesto", flex: 1.2, editable: false, filter: true },
  { field: "empresa", headerName: "Empresa", flex: 1, editable: false, filter: true },
  {
    field: "linkedinUrl",
    headerName: "LinkedIn",
    flex: 1,
    cellRenderer: (p) => {
      if (!p.value) return "";
      const a = document.createElement("a");
      a.href = p.value;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = p.value.replace(/^https?:\/\/(www\.)?linkedin\.com\/jobs\/view\//, "").slice(0, 20) + "…";
      return a;
    },
  },
  { field: "canal", headerName: "Canal", width: 100 },
  {
    field: "estado",
    headerName: "Estado",
    width: 140,
    editable: true,
    cellEditor: "agSelectCellEditor",
    cellEditorParams: { values: ESTADO_OPTIONS },
    filter: true,
  },
  { field: "fechaAplicacion", headerName: "Fecha aplicación", width: 120 },
  { field: "proximoPaso", headerName: "Próximo paso", flex: 1, editable: true },
  { field: "notas", headerName: "Notas", flex: 1.2, editable: true },
  { field: "misComentarios", headerName: "Mis comentarios", flex: 1, editable: true },
];

gridApi = agGrid.createGrid(document.getElementById("tracker-grid"), {
  columnDefs,
  rowData: [],
  defaultColDef: { sortable: true, resizable: true },
  getRowId: (p) => p.data.id,
  onCellValueChanged: (e) => {
    if (!e.data?.id) return;
    savePatch(e.data.id, e.colDef.field, e.newValue);
  },
});

document.getElementById("btn-reload").addEventListener("click", () => {
  loadRows().catch((err) => {
    statusEl.textContent = `Error: ${err.message}`;
  });
});

document.getElementById("btn-import-desktop").addEventListener("click", async () => {
  try {
    statusEl.textContent = "Importando desde Desktop…";
    const result = await apiFetch("/api/tracker/import/xlsx", { method: "POST", body: "{}" });
    statusEl.textContent = `Import: ${result.rowsRead} filas (${result.upserted} nuevas, ${result.modified} actualizadas)`;
    await loadRows();
  } catch (err) {
    statusEl.textContent = `Import error: ${err.message}`;
  }
});

let searchDebounce;
searchEl.addEventListener("input", () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => loadRows().catch(() => {}), 300);
});
filterEstadoEl.addEventListener("change", () => loadRows().catch(() => {}));

loadRows().catch((err) => {
  statusEl.textContent = `Error: ${err.message} — ¿docker compose up && npm run tracker:seed?`;
});
