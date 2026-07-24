/**
 * Config CVs (B18-03 / #98).
 * Metadata: output/config-cvs.json · archivos: output/cvs/
 * No commitear PDFs personales (output/ está en .gitignore).
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const CONFIG_CVS_PATH = path.join(ROOT, "output", "config-cvs.json");
export const CVS_DIR = path.join(ROOT, "output", "cvs");

export const MAX_CV_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(["application/pdf"]);
const ALLOWED_EXT = /\.pdf$/i;

export interface ConfigCv {
  id: string;
  /** Nombre en disco (sanitizado). */
  storedName: string;
  originalName: string;
  /** Etiqueta para matching en Easy Apply (ej. QA_Automation.pdf). */
  label: string;
  mimeType: string;
  sizeBytes: number;
  isDefault: boolean;
  empleoProfileId?: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ConfigCvsStore {
  updatedAt: string;
  cvs: ConfigCv[];
}

function nowIso(): string {
  return new Date().toISOString();
}

function slugId(name: string): string {
  const base = name
    .replace(/\.pdf$/i, "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `cv-${base || "item"}-${Date.now().toString(36)}`;
}

function sanitizeStoredName(originalName: string): string {
  const base = path.basename(originalName).replace(/[^a-zA-Z0-9._-]+/g, "_");
  return base.toLowerCase().endsWith(".pdf") ? base : `${base}.pdf`;
}

function emptyStore(): ConfigCvsStore {
  return { updatedAt: nowIso(), cvs: [] };
}

export function loadCvsConfig(): ConfigCvsStore {
  if (!fs.existsSync(CONFIG_CVS_PATH)) return emptyStore();
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_CVS_PATH, "utf-8")) as ConfigCvsStore;
    if (!raw || !Array.isArray(raw.cvs)) return emptyStore();
    return raw;
  } catch {
    return emptyStore();
  }
}

export function saveCvsConfig(store: ConfigCvsStore): void {
  const dir = path.dirname(CONFIG_CVS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  store.updatedAt = nowIso();
  fs.writeFileSync(CONFIG_CVS_PATH, JSON.stringify(store, null, 2), "utf-8");
}

export function listCvs(opts?: { includeArchived?: boolean }): ConfigCv[] {
  return loadCvsConfig().cvs.filter((c) => opts?.includeArchived || !c.archived);
}

export function getCvById(id: string): ConfigCv | undefined {
  return loadCvsConfig().cvs.find((c) => c.id === id);
}

export function getCvFilePath(cv: ConfigCv): string {
  return path.join(CVS_DIR, cv.storedName);
}

export function getDefaultCv(): ConfigCv | undefined {
  return listCvs().find((c) => c.isDefault);
}

/** Path del CV default para upload local (si existe en disco). */
export function getDefaultCvPath(): string | null {
  const d = listCvs().find((c) => c.isDefault && !c.archived);
  if (!d) return null;
  const p = getCvFilePath(d);
  return fs.existsSync(p) ? p : null;
}

export function validateCvUpload(
  originalName: string,
  mimeType: string,
  buffer: Buffer
): void {
  if (!ALLOWED_EXT.test(originalName)) {
    throw new Error("Solo se aceptan archivos .pdf");
  }
  if (mimeType && !ALLOWED_MIME.has(mimeType) && mimeType !== "application/octet-stream") {
    throw new Error(`Tipo no permitido: ${mimeType}. Usá PDF.`);
  }
  if (buffer.length === 0) throw new Error("Archivo vacío");
  if (buffer.length > MAX_CV_BYTES) {
    throw new Error(`Archivo demasiado grande (máx ${MAX_CV_BYTES / 1024 / 1024} MB)`);
  }
  const head = buffer.subarray(0, 5).toString("ascii");
  if (!head.startsWith("%PDF")) {
    throw new Error("El archivo no parece un PDF válido");
  }
}

export function addCvFromBuffer(input: {
  originalName: string;
  mimeType?: string;
  buffer: Buffer;
  label?: string;
  empleoProfileId?: string;
  setDefault?: boolean;
}): ConfigCv {
  validateCvUpload(input.originalName, input.mimeType || "application/pdf", input.buffer);

  if (!fs.existsSync(CVS_DIR)) fs.mkdirSync(CVS_DIR, { recursive: true });

  const store = loadCvsConfig();
  const t = nowIso();
  const storedName = `${Date.now().toString(36)}-${sanitizeStoredName(input.originalName)}`;
  const filePath = path.join(CVS_DIR, storedName);
  fs.writeFileSync(filePath, input.buffer);

  const makeDefault = input.setDefault === true || store.cvs.filter((c) => !c.archived).length === 0;
  if (makeDefault) {
    for (const c of store.cvs) c.isDefault = false;
  }

  const cv: ConfigCv = {
    id: slugId(input.originalName),
    storedName,
    originalName: input.originalName,
    label: (input.label || input.originalName).trim(),
    mimeType: "application/pdf",
    sizeBytes: input.buffer.length,
    isDefault: makeDefault,
    empleoProfileId: input.empleoProfileId?.trim() || undefined,
    archived: false,
    createdAt: t,
    updatedAt: t,
  };
  store.cvs.push(cv);
  saveCvsConfig(store);
  return cv;
}

export function patchCv(
  id: string,
  patch: Partial<Pick<ConfigCv, "label" | "empleoProfileId" | "isDefault" | "archived">>
): ConfigCvsStore {
  const store = loadCvsConfig();
  const idx = store.cvs.findIndex((c) => c.id === id);
  if (idx < 0) throw new Error(`CV no encontrado: ${id}`);
  const prev = store.cvs[idx];

  if (patch.isDefault === true) {
    for (const c of store.cvs) c.isDefault = false;
  }

  store.cvs[idx] = {
    ...prev,
    label: patch.label?.trim() || prev.label,
    empleoProfileId:
      patch.empleoProfileId !== undefined
        ? patch.empleoProfileId.trim() || undefined
        : prev.empleoProfileId,
    isDefault: patch.isDefault ?? prev.isDefault,
    archived: patch.archived ?? prev.archived,
    updatedAt: nowIso(),
  };

  if (store.cvs[idx].archived) store.cvs[idx].isDefault = false;

  const active = store.cvs.filter((c) => !c.archived);
  if (active.length > 0 && !active.some((c) => c.isDefault)) {
    active[0].isDefault = true;
  }

  saveCvsConfig(store);
  return store;
}

export function deleteCv(id: string): ConfigCvsStore {
  const store = loadCvsConfig();
  const idx = store.cvs.findIndex((c) => c.id === id);
  if (idx < 0) throw new Error(`CV no encontrado: ${id}`);
  const [removed] = store.cvs.splice(idx, 1);
  const fp = getCvFilePath(removed);
  if (fs.existsSync(fp)) fs.unlinkSync(fp);

  const active = store.cvs.filter((c) => !c.archived);
  if (active.length > 0 && !active.some((c) => c.isDefault)) {
    active[0].isDefault = true;
  }

  saveCvsConfig(store);
  return store;
}
