/**
 * Scoring de CV en LinkedIn por nombre de archivo + título del aviso (#211).
 * Comparación parcial (tokens del puesto) y fallback al CV default de Config.
 */

import {
  detectApplyRoleKind,
  RESUME_FALLBACK_MATCH,
  scoreResumeForRole,
  type ApplyRoleKind,
} from "./canonical-text.js";
import { getDefaultCv, listCvs } from "../config/cvs-store.js";

export const RESUME_ACCEPT_SCORE = 50;
export const RESUME_PREFERRED_SCORE = 70;
/** Si top1 y top2 están a menos de esto → usar CV default de Config. */
export const RESUME_AMBIGUITY_DELTA = 15;

export function normalizeResumeBlob(blob: string): string {
  return (blob || "")
    .toLowerCase()
    .replace(/\.pdf$/i, "")
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
      file === on ||
      file.includes(on) ||
      on.includes(file) ||
      normalizeResumeBlob(blob).includes(on);
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

/** Si hay empate/confusión, nombre de archivo del CV default en Config. */
export function defaultResumeFilenameHint(): string | null {
  const d = getDefaultCv();
  return d?.originalName?.trim() || null;
}
