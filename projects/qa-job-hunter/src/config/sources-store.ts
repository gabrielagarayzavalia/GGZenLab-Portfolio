/**
 * Config Fuentes + Sitios (B18-05 / B18-07).
 * Persistencia JSON local (MVP; #101 puede migrar a Mongo).
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { JobSourceId } from "../adapters/types.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const CONFIG_SOURCES_PATH = path.join(ROOT, "output", "config-sources.json");

export type ConfigSourceKind = "adapter" | "site";

export interface ConfigSource {
  id: string;
  name: string;
  kind: ConfigSourceKind;
  /** Id de adapter conocido o custom (linkedin, indeed, getonboard, …). */
  adapterId?: JobSourceId;
  url?: string;
  enabled: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ConfigSourcesStore {
  updatedAt: string;
  sources: ConfigSource[];
}

function nowIso(): string {
  return new Date().toISOString();
}

function slugId(prefix: string, name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `${prefix}-${base || "item"}-${Date.now().toString(36)}`;
}

function builtinDefaults(): ConfigSource[] {
  const t = nowIso();
  return [
    {
      id: "adapter-linkedin",
      name: "LinkedIn",
      kind: "adapter",
      adapterId: "linkedin",
      url: "https://www.linkedin.com/jobs/",
      enabled: true,
      archived: false,
      createdAt: t,
      updatedAt: t,
    },
    {
      id: "adapter-indeed",
      name: "Indeed AR",
      kind: "adapter",
      adapterId: "indeed",
      url: "https://ar.indeed.com/",
      enabled: true,
      archived: false,
      createdAt: t,
      updatedAt: t,
    },
    {
      id: "adapter-getonboard",
      name: "GetOnBoard",
      kind: "adapter",
      adapterId: "getonboard",
      url: "https://www.getonbrd.com/",
      enabled: false,
      archived: false,
      createdAt: t,
      updatedAt: t,
    },
  ];
}

function emptyStore(): ConfigSourcesStore {
  return { updatedAt: nowIso(), sources: builtinDefaults() };
}

function ensureBuiltins(store: ConfigSourcesStore): ConfigSourcesStore {
  const byAdapter = new Map(
    store.sources
      .filter((s) => s.kind === "adapter" && s.adapterId)
      .map((s) => [String(s.adapterId).toLowerCase(), s])
  );
  let changed = false;
  for (const def of builtinDefaults()) {
    const key = String(def.adapterId).toLowerCase();
    if (!byAdapter.has(key)) {
      store.sources.push(def);
      changed = true;
    }
  }
  if (changed) store.updatedAt = nowIso();
  return store;
}

export function loadSourcesConfig(): ConfigSourcesStore {
  if (!fs.existsSync(CONFIG_SOURCES_PATH)) {
    const store = emptyStore();
    saveSourcesConfig(store);
    return store;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_SOURCES_PATH, "utf-8")) as ConfigSourcesStore;
    if (!raw || !Array.isArray(raw.sources)) return emptyStore();
    return ensureBuiltins(raw);
  } catch {
    return emptyStore();
  }
}

export function saveSourcesConfig(store: ConfigSourcesStore): void {
  const dir = path.dirname(CONFIG_SOURCES_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  store.updatedAt = nowIso();
  fs.writeFileSync(CONFIG_SOURCES_PATH, JSON.stringify(store, null, 2), "utf-8");
}

export function listSources(opts?: {
  kind?: ConfigSourceKind;
  includeArchived?: boolean;
}): ConfigSource[] {
  const store = loadSourcesConfig();
  return store.sources.filter((s) => {
    if (opts?.kind && s.kind !== opts.kind) return false;
    if (!opts?.includeArchived && s.archived) return false;
    return true;
  });
}

export function isSourceEnabled(adapterId: JobSourceId): boolean {
  const id = String(adapterId).toLowerCase();
  const hit = loadSourcesConfig().sources.find(
    (s) =>
      s.kind === "adapter" &&
      !s.archived &&
      String(s.adapterId ?? "").toLowerCase() === id
  );
  return hit?.enabled ?? false;
}

export function upsertSource(input: {
  id?: string;
  name: string;
  kind: ConfigSourceKind;
  adapterId?: string;
  url?: string;
  enabled?: boolean;
  archived?: boolean;
}): ConfigSourcesStore {
  const name = input.name.trim();
  if (!name) throw new Error("name es obligatorio");
  if (input.kind !== "adapter" && input.kind !== "site") {
    throw new Error("kind debe ser adapter o site");
  }

  const store = loadSourcesConfig();
  const t = nowIso();

  if (input.id) {
    const idx = store.sources.findIndex((s) => s.id === input.id);
    if (idx < 0) throw new Error(`Fuente no encontrada: ${input.id}`);
    const prev = store.sources[idx];
    store.sources[idx] = {
      ...prev,
      name,
      kind: input.kind,
      adapterId: input.adapterId?.trim() || prev.adapterId,
      url: input.url?.trim() || undefined,
      enabled: input.enabled ?? prev.enabled,
      archived: input.archived ?? prev.archived,
      updatedAt: t,
    };
  } else {
    const entry: ConfigSource = {
      id: slugId(input.kind, name),
      name,
      kind: input.kind,
      adapterId: input.adapterId?.trim() || undefined,
      url: input.url?.trim() || undefined,
      enabled: input.enabled ?? true,
      archived: false,
      createdAt: t,
      updatedAt: t,
    };
    store.sources.push(entry);
  }

  saveSourcesConfig(store);
  return store;
}

export function patchSource(
  id: string,
  patch: Partial<Pick<ConfigSource, "name" | "url" | "adapterId" | "enabled" | "archived">>
): ConfigSourcesStore {
  const store = loadSourcesConfig();
  const idx = store.sources.findIndex((s) => s.id === id);
  if (idx < 0) throw new Error(`Fuente no encontrada: ${id}`);
  const prev = store.sources[idx];
  store.sources[idx] = {
    ...prev,
    name: patch.name?.trim() || prev.name,
    url: patch.url !== undefined ? patch.url.trim() || undefined : prev.url,
    adapterId:
      patch.adapterId !== undefined
        ? patch.adapterId.trim() || undefined
        : prev.adapterId,
    enabled: patch.enabled ?? prev.enabled,
    archived: patch.archived ?? prev.archived,
    updatedAt: nowIso(),
  };
  saveSourcesConfig(store);
  return store;
}
