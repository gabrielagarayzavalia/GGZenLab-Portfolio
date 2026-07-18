// Rutas y helpers del flujo Easy Apply (B17).
// Auto-contenido: NO importa config.ts para evitar el process.exit por credenciales.

import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// src/apply/paths.ts -> raíz del proyecto qa-job-hunter = ../../
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

// Fuente de datos del pipeline (ver src/config.ts OUTPUT_PATH / MIN_MATCH).
export const OUTPUT_PATH = path.join(ROOT, "output", "jobs-result.json");
export const MIN_MATCH = 70;

// Artefactos de runtime: viven bajo output/ (ya ignorado por .gitignore).
export const APPLY_DIR = path.join(ROOT, "output", "apply");
export const SCREENSHOTS_DIR = path.join(APPLY_DIR, "screenshots");
export const APPLICATIONS_PATH = path.join(APPLY_DIR, "applications.json");
export const APPLICATIONS_LOG = path.join(APPLY_DIR, "applications.log");
export const FAILURES_PATH = path.join(APPLY_DIR, "failures.json");
export const SELECTOR_TASKS_PATH = path.join(APPLY_DIR, "selector-tasks.md");
export const SELECTORS_PATH = path.join(APPLY_DIR, "selectors.json");
export const COVER_DIR = path.join(APPLY_DIR, "cover-letters");
export const COVER_BY_JOB_DIR = path.join(COVER_DIR, "by-job");

// Grabaciones de codegen: versionadas como entregable del spike B17-01.
export const RECORDINGS_DIR = path.join(ROOT, "recordings", "easy-apply");

const SESSION_CANDIDATES = [
  path.join(ROOT, "session", "linkedin-session.json"),
  "C:/Users/gabri/projects/GGZenLab-Portfolio/projects/qa-job-hunter/session/linkedin-session.json",
  "C:/Users/gabri/projects/QA-portfolio/projects/qa-job-hunter/session/linkedin-session.json",
];

export function resolveSessionPath(): string {
  for (const candidate of SESSION_CANDIDATES) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(
    "No se encontró sesión LinkedIn. Ejecutá `npm run login` para generar session/linkedin-session.json"
  );
}

export function ensureDirs(): void {
  for (const dir of [APPLY_DIR, SCREENSHOTS_DIR, COVER_DIR, COVER_BY_JOB_DIR, RECORDINGS_DIR]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function appendLog(line: string): void {
  fs.mkdirSync(APPLY_DIR, { recursive: true });
  fs.appendFileSync(APPLICATIONS_LOG, `${new Date().toISOString()} | ${line}\n`, "utf-8");
}
