/**
 * Config Empleo buscado (B18-04 / #99).
 * Perfiles de búsqueda (título, keywords, seniority, remote/location, notas).
 * Distinto de Puestos (#197): acá = cómo/qué buscás; puestos = roles a aplicar.
 * Persistencia MVP: output/config-empleo.json.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const CONFIG_EMPLEO_PATH = path.join(ROOT, "output", "config-empleo.json");

export type EmpleoSeniority = "junior" | "semi" | "senior" | "lead" | "any";
export type EmpleoRemote = "remote" | "hybrid" | "onsite" | "any";

export interface ConfigEmpleoProfile {
  id: string;
  title: string;
  keywords: string;
  seniority: EmpleoSeniority;
  remote: EmpleoRemote;
  location: string;
  notes: string;
  enabled: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ConfigEmpleoStore {
  updatedAt: string;
  profiles: ConfigEmpleoProfile[];
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
  return `empleo-${base || "item"}-${Date.now().toString(36)}`;
}

function normalizeSeniority(v?: string): EmpleoSeniority {
  const t = (v || "any").toLowerCase();
  if (t === "junior" || t === "semi" || t === "senior" || t === "lead" || t === "any") {
    return t;
  }
  return "any";
}

function normalizeRemote(v?: string): EmpleoRemote {
  const t = (v || "any").toLowerCase();
  if (t === "remote" || t === "hybrid" || t === "onsite" || t === "any") return t;
  return "any";
}

function builtinDefaults(): ConfigEmpleoProfile[] {
  const t = nowIso();
  return [
    {
      id: "empleo-qa-default",
      title: "QA / Automation",
      keywords: "QA, automation, playwright, selenium, testing",
      seniority: "semi",
      remote: "remote",
      location: "Argentina / LATAM",
      notes: "Perfil default seed B18-04",
      enabled: true,
      archived: false,
      createdAt: t,
      updatedAt: t,
    },
  ];
}

function emptyStore(): ConfigEmpleoStore {
  return { updatedAt: nowIso(), profiles: builtinDefaults() };
}

export function loadEmpleoConfig(): ConfigEmpleoStore {
  if (!fs.existsSync(CONFIG_EMPLEO_PATH)) {
    const store = emptyStore();
    saveEmpleoConfig(store);
    return store;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_EMPLEO_PATH, "utf-8")) as ConfigEmpleoStore;
    if (!raw || !Array.isArray(raw.profiles)) return emptyStore();
    return raw;
  } catch {
    return emptyStore();
  }
}

export function saveEmpleoConfig(store: ConfigEmpleoStore): void {
  const dir = path.dirname(CONFIG_EMPLEO_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  store.updatedAt = nowIso();
  fs.writeFileSync(CONFIG_EMPLEO_PATH, JSON.stringify(store, null, 2), "utf-8");
}

export function listEmpleoProfiles(opts?: {
  includeArchived?: boolean;
}): ConfigEmpleoProfile[] {
  return loadEmpleoConfig().profiles.filter(
    (p) => opts?.includeArchived || !p.archived
  );
}

/** Perfiles activos para matching/discover. */
export function listActiveEmpleoProfiles(): ConfigEmpleoProfile[] {
  return listEmpleoProfiles().filter((p) => p.enabled);
}

export function upsertEmpleoProfile(input: {
  id?: string;
  title: string;
  keywords?: string;
  seniority?: string;
  remote?: string;
  location?: string;
  notes?: string;
  enabled?: boolean;
  archived?: boolean;
}): ConfigEmpleoStore {
  const title = input.title.trim();
  if (!title) throw new Error("title es obligatorio");
  const store = loadEmpleoConfig();
  const t = nowIso();

  if (input.id) {
    const idx = store.profiles.findIndex((p) => p.id === input.id);
    if (idx < 0) throw new Error(`Perfil no encontrado: ${input.id}`);
    const prev = store.profiles[idx];
    store.profiles[idx] = {
      ...prev,
      title,
      keywords: (input.keywords ?? prev.keywords).trim(),
      seniority: input.seniority
        ? normalizeSeniority(input.seniority)
        : prev.seniority,
      remote: input.remote ? normalizeRemote(input.remote) : prev.remote,
      location: (input.location ?? prev.location).trim(),
      notes: (input.notes ?? prev.notes).trim(),
      enabled: input.enabled ?? prev.enabled,
      archived: input.archived ?? prev.archived,
      updatedAt: t,
    };
  } else {
    store.profiles.push({
      id: slugId(title),
      title,
      keywords: (input.keywords ?? "").trim(),
      seniority: normalizeSeniority(input.seniority),
      remote: normalizeRemote(input.remote),
      location: (input.location ?? "").trim(),
      notes: (input.notes ?? "").trim(),
      enabled: input.enabled ?? true,
      archived: false,
      createdAt: t,
      updatedAt: t,
    });
  }
  saveEmpleoConfig(store);
  return store;
}

export function patchEmpleoProfile(
  id: string,
  patch: Partial<
    Pick<
      ConfigEmpleoProfile,
      | "title"
      | "keywords"
      | "seniority"
      | "remote"
      | "location"
      | "notes"
      | "enabled"
      | "archived"
    >
  >
): ConfigEmpleoStore {
  const store = loadEmpleoConfig();
  const idx = store.profiles.findIndex((p) => p.id === id);
  if (idx < 0) throw new Error(`Perfil no encontrado: ${id}`);
  const prev = store.profiles[idx];
  store.profiles[idx] = {
    ...prev,
    title: patch.title?.trim() || prev.title,
    keywords:
      patch.keywords !== undefined ? patch.keywords.trim() : prev.keywords,
    seniority: patch.seniority
      ? normalizeSeniority(patch.seniority)
      : prev.seniority,
    remote: patch.remote ? normalizeRemote(patch.remote) : prev.remote,
    location:
      patch.location !== undefined ? patch.location.trim() : prev.location,
    notes: patch.notes !== undefined ? patch.notes.trim() : prev.notes,
    enabled: patch.enabled ?? prev.enabled,
    archived: patch.archived ?? prev.archived,
    updatedAt: nowIso(),
  };
  saveEmpleoConfig(store);
  return store;
}
