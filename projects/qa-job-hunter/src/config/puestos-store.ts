/**
 * Config Puestos objetivo (B18-08 / #197).
 * Roles a los que se aplica (título + keywords + activo).
 * Distinto de “Empleo buscado” (#99): acá = targets de apply; #99 = perfiles de búsqueda.
 * Persistencia MVP: output/config-puestos.json.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const CONFIG_PUESTOS_PATH = path.join(ROOT, "output", "config-puestos.json");

export interface ConfigPuesto {
  id: string;
  title: string;
  /** Keywords libres (coma o espacio); usadas por matching cuando se cablee. */
  keywords: string;
  enabled: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ConfigPuestosStore {
  updatedAt: string;
  puestos: ConfigPuesto[];
}

function nowIso(): string {
  return new Date().toISOString();
}

function slugId(title: string): string {
  const base = title
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `puesto-${base || "item"}-${Date.now().toString(36)}`;
}

/** Defaults alineados a SEARCH_TERMS del config.example (seed si el archivo no existe). */
function builtinDefaults(): ConfigPuesto[] {
  const t = nowIso();
  const titles = [
    "QA Analyst",
    "QA Engineer",
    "QA Automation Engineer",
    "Quality Assurance",
    "Software Tester",
  ];
  return titles.map((title) => ({
    id: `puesto-${title.toLowerCase().replace(/\s+/g, "-")}`,
    title,
    keywords: title,
    enabled: true,
    archived: false,
    createdAt: t,
    updatedAt: t,
  }));
}

function emptyStore(): ConfigPuestosStore {
  return { updatedAt: nowIso(), puestos: builtinDefaults() };
}

export function loadPuestosConfig(): ConfigPuestosStore {
  if (!fs.existsSync(CONFIG_PUESTOS_PATH)) {
    const store = emptyStore();
    savePuestosConfig(store);
    return store;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_PUESTOS_PATH, "utf-8")) as ConfigPuestosStore;
    if (!raw || !Array.isArray(raw.puestos)) return emptyStore();
    return raw;
  } catch {
    return emptyStore();
  }
}

export function savePuestosConfig(store: ConfigPuestosStore): void {
  const dir = path.dirname(CONFIG_PUESTOS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  store.updatedAt = nowIso();
  fs.writeFileSync(CONFIG_PUESTOS_PATH, JSON.stringify(store, null, 2), "utf-8");
}

export function listPuestos(opts?: { includeArchived?: boolean }): ConfigPuesto[] {
  const store = loadPuestosConfig();
  return store.puestos.filter((p) => opts?.includeArchived || !p.archived);
}

/** Títulos activos (enabled, no archivados) — hook para matching/pipeline. */
export function listActivePuestoTitles(): string[] {
  return listPuestos()
    .filter((p) => p.enabled)
    .map((p) => p.title.trim())
    .filter(Boolean);
}

export function upsertPuesto(input: {
  id?: string;
  title: string;
  keywords?: string;
  enabled?: boolean;
  archived?: boolean;
}): ConfigPuestosStore {
  const title = input.title.trim();
  if (!title) throw new Error("title es obligatorio");
  const store = loadPuestosConfig();
  const t = nowIso();

  if (input.id) {
    const idx = store.puestos.findIndex((p) => p.id === input.id);
    if (idx < 0) throw new Error(`Puesto no encontrado: ${input.id}`);
    const prev = store.puestos[idx];
    store.puestos[idx] = {
      ...prev,
      title,
      keywords: (input.keywords ?? prev.keywords).trim(),
      enabled: input.enabled ?? prev.enabled,
      archived: input.archived ?? prev.archived,
      updatedAt: t,
    };
  } else {
    store.puestos.push({
      id: slugId(title),
      title,
      keywords: (input.keywords ?? title).trim(),
      enabled: input.enabled ?? true,
      archived: false,
      createdAt: t,
      updatedAt: t,
    });
  }
  savePuestosConfig(store);
  return store;
}

export function patchPuesto(
  id: string,
  patch: Partial<Pick<ConfigPuesto, "title" | "keywords" | "enabled" | "archived">>
): ConfigPuestosStore {
  const store = loadPuestosConfig();
  const idx = store.puestos.findIndex((p) => p.id === id);
  if (idx < 0) throw new Error(`Puesto no encontrado: ${id}`);
  const prev = store.puestos[idx];
  store.puestos[idx] = {
    ...prev,
    title: patch.title?.trim() || prev.title,
    keywords:
      patch.keywords !== undefined ? patch.keywords.trim() : prev.keywords,
    enabled: patch.enabled ?? prev.enabled,
    archived: patch.archived ?? prev.archived,
    updatedAt: nowIso(),
  };
  savePuestosConfig(store);
  return store;
}
