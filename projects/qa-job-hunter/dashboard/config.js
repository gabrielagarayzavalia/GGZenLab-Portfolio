/**
 * Config shell (B18-01 / #96) — tabs entre placeholders de subsecciones.
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
activate(panelFromHash());
