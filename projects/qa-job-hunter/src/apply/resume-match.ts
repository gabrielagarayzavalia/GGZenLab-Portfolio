/**
 * Scoring de CV en LinkedIn por nombre de archivo + título del aviso (#211).
 * Comparación parcial (tokens del puesto). Si Config y LinkedIn tienen el mismo
 * archivo → usar el de LinkedIn (no re-subir; #247).
 */

import {
  detectApplyRoleKind,
  RESUME_FALLBACK_MATCH,
  scoreResumeForRole,
  type ApplyRoleKind,
} from "./canonical-text.js";
import { getDefaultCv, listCvs, type ConfigCv } from "../config/cvs-store.js";

export const RESUME_ACCEPT_SCORE = 50;
export const RESUME_PREFERRED_SCORE = 70;
/** Dos CVs distintos en LinkedIn con score parecido → preferir el default de Config. */
export const RESUME_AMBIGUITY_DELTA = 15;

export function normalizeResumeBlob(blob: string): string {
  return (blob || "")
    .toLowerCase()
    .replace(/\.pdf$/i, "")
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Mismo PDF en Config y en LinkedIn (comparación parcial del nombre). */
export function resumeFilenamesMatch(a: string, b: string): boolean {
  const na = normalizeResumeBlob(a);
  const nb = normalizeResumeBlob(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

/** CV de Config que ya está en LinkedIn (mismo filename) — no hace falta upload. */
export function findConfigCvOnLinkedIn(linkedinFilename: string): ConfigCv | null {
  for (const cv of listCvs()) {
    if (resumeFilenamesMatch(linkedinFilename, cv.originalName)) return cv;
  }
  return null;
}

export function isResumeAlreadyOnLinkedIn(linkedinFilename: string): boolean {
  return findConfigCvOnLinkedIn(linkedinFilename) !== null;
}

/** Mejor CV de Config para el aviso (por originalName + título). */
export function pickBestConfigCvForJob(jobTitle: string, company = ""): ConfigCv | null {
  const forced = (process.env.DRY_RUN_CONFIG_CV ?? "").trim();
  if (forced) {
    const hit = listCvs().find((c) => resumeFilenamesMatch(c.originalName, forced));
    if (hit) return hit;
  }
  const cvs = listCvs().filter((c) => !c.archived);
  if (cvs.length === 0) return null;
  let best: ConfigCv | null = null;
  let bestScore = 0;
  for (const cv of cvs) {
    const score = scoreResumeForJob(cv.originalName, jobTitle, company);
    if (score > bestScore) {
      bestScore = score;
      best = cv;
    }
  }
  if (best && bestScore >= RESUME_ACCEPT_SCORE) return best;
  return getDefaultCv() ?? null;
}

/** ¿Algún filename de LinkedIn matchea el CV de Config? (#247 — no re-subir). */
export function isConfigCvOnLinkedInList(
  configCv: ConfigCv,
  linkedinFilenames: string[]
): boolean {
  return linkedinFilenames.some((n) => resumeFilenamesMatch(n, configCv.originalName));
}

/** Tokens del título del aviso que deben aparecer en el filename (parcial). */
export function extractResumeMatchTokens(jobTitle: string): string[] {
  const norm = normalizeResumeBlob(jobTitle);
  const tokens: string[] = [];
  if (/\bqa\b|quality/i.test(norm)) tokens.push("qa");
  if (/\banalyst\b/i.test(norm)) tokens.push("analyst");
  if (/\bautomation\b|automatiz|\bsdet\b|playwright|selenium|cypress/i.test(norm)) {
    tokens.push("automation");
  }
  return [...new Set(tokens)];
}

/** Score 0–100 por coincidencia parcial título ↔ nombre de archivo en LinkedIn. */
export function scoreResumeByJobTitle(blob: string, jobTitle: string): number {
  const file = normalizeResumeBlob(blob);
  if (!file || /cover|intro-ggz|intro letter|cover letter/i.test(file)) return 0;

  const tokens = extractResumeMatchTokens(jobTitle);
  if (tokens.length === 0) return 0;

  let matched = 0;
  for (const t of tokens) {
    if (file.includes(t)) matched++;
  }
  if (matched === 0) return 0;

  // Analyst vs Automation: no confundir si solo uno aplica
  if (tokens.includes("analyst") && !tokens.includes("automation")) {
    if (/automation/i.test(file) && !/analyst/i.test(file)) return 0;
  }
  if (tokens.includes("automation") && !tokens.includes("analyst")) {
    if (/analyst/i.test(file) && !/automation/i.test(file)) return 0;
  }

  if (matched === tokens.length) return 70 + matched * 10;
  return 25 + matched * 20;
}

/** Boost si el filename coincide con un CV registrado en Config (por originalName). */
export function scoreResumeFromConfig(blob: string, jobTitle: string): number {
  const file = normalizeResumeBlob(blob);
  if (!file) return 0;
  let best = 0;
  for (const cv of listCvs()) {
    const on = normalizeResumeBlob(cv.originalName);
    if (!on) continue;
    const sameFile =
      resumeFilenamesMatch(blob, cv.originalName);
    if (!sameFile) continue;
    const titleScore = scoreResumeByJobTitle(cv.originalName, jobTitle);
    const boost = cv.isDefault && titleScore < RESUME_ACCEPT_SCORE ? RESUME_ACCEPT_SCORE : titleScore + 5;
    best = Math.max(best, boost);
  }
  return best;
}

/** Score combinado: kind legacy + tokens del título + Config (originalName). */
export function scoreResumeForJob(
  blob: string,
  jobTitle: string,
  company = ""
): number {
  if (/intro-ggz|intro\s*letter|cover\s*letter/i.test(blob || "")) return 0;
  const kind: ApplyRoleKind = detectApplyRoleKind(jobTitle, company);
  return Math.max(
    scoreResumeForRole(blob, kind),
    scoreResumeByJobTitle(blob, jobTitle),
    scoreResumeFromConfig(blob, jobTitle)
  );
}

export function isPreferredResumeFilename(
  blob: string,
  jobTitle: string,
  company = ""
): boolean {
  if (scoreResumeForJob(blob, jobTitle, company) >= RESUME_PREFERRED_SCORE) return true;
  return RESUME_FALLBACK_MATCH.test(blob || "");
}

/** Nombre del CV default en Config (desempate entre CVs distintos en LinkedIn). */
export function defaultResumeFilenameHint(): string | null {
  const d = getDefaultCv();
  return d?.originalName?.trim() || null;
}
