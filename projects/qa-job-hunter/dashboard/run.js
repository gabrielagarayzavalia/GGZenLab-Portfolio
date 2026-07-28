/**
 * Botonera /run — Easy Apply + cancel (#125, #324).
 */

const statusEl = document.getElementById("run-status");
const stateText = document.getElementById("run-state-text");
const logEl = document.getElementById("run-log");
const applyBtn = document.getElementById("run-apply-btn");
const cancelBtn = document.getElementById("run-cancel-btn");
const applyMaxEl = document.getElementById("run-apply-max");
const jobIdEl = document.getElementById("run-job-id");

let pollTimer = null;

function setStatus(msg, isError = false) {
  if (!statusEl) return;
  statusEl.hidden = !msg;
  statusEl.textContent = msg || "";
  statusEl.classList.toggle("config-status--error", Boolean(isError && msg));
}

function selectedMode() {
  const checked = document.querySelector('input[name="run-mode"]:checked');
  return checked?.value === "productive" ? "productive" : "dry_run";
}

function renderState(data) {
  if (!stateText || !logEl) return;
  const parts = [
    data.status,
    data.mode ? `· ${data.mode}` : "",
    data.script ? `· ${data.script}` : "",
    data.exitCode != null ? `· exit ${data.exitCode}` : "",
  ].filter(Boolean);
  stateText.textContent = parts.join(" ");
  logEl.textContent = data.logTail || "Sin salida aún.";
  const running = data.status === "running";
  if (applyBtn) {
    applyBtn.disabled = running;
    applyBtn.textContent = running ? "⏳ Easy Apply…" : "▶ Easy Apply";
  }
  if (cancelBtn) {
    cancelBtn.classList.toggle("hidden", !running);
    cancelBtn.disabled = !running;
  }
}

async function fetchStatus() {
  const res = await fetch("/api/run/apply/status");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  renderState(data);
  if (data.status === "running") {
    if (!pollTimer) pollTimer = setInterval(() => void fetchStatus().catch(() => {}), 2500);
  } else if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  return data;
}

applyBtn?.addEventListener("click", async () => {
  if (selectedMode() === "productive") {
    const ok = confirm(
      "Modo PRODUCTIVO: va a enviar postulaciones reales en LinkedIn. ¿Continuar?"
    );
    if (!ok) return;
  }
  setStatus("Lanzando…");
  try {
    const body = { mode: selectedMode() };
    const maxRaw = applyMaxEl?.value?.trim();
    if (maxRaw) body.applyMax = Number(maxRaw);
    const jobId = jobIdEl?.value?.trim();
    if (jobId) body.jobId = jobId;
    const res = await fetch("/api/run/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    setStatus("Corrida iniciada. Mirá Chrome y el log abajo.");
    renderState(data);
    if (!pollTimer) pollTimer = setInterval(() => void fetchStatus().catch(() => {}), 2500);
  } catch (err) {
    setStatus(err.message || "No se pudo iniciar", true);
  }
});

cancelBtn?.addEventListener("click", async () => {
  const ok = confirm(
    "Detener la corrida y cerrar el árbol de procesos (npm + Chrome del bot). ¿Continuar?"
  );
  if (!ok) return;
  setStatus("Deteniendo…");
  try {
    const res = await fetch("/api/run/apply/cancel", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    setStatus("Corrida detenida. Revisá que no queden Chrome huérfanos en Administrador de tareas.");
    renderState(data);
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  } catch (err) {
    setStatus(err.message || "No se pudo detener", true);
  }
});

void fetchStatus().catch(() => {
  setStatus("No se pudo leer estado (¿dashboard actualizado?)", true);
});
