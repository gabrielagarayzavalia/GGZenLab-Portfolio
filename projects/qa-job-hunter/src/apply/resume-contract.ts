/**
 * Contrato selección CV Easy Apply (#208).
 * Solo dominio hunter/EA — applied-list no importa este módulo.
 *
 * Reglas:
 * - Siempre un CV válido seleccionado (nunca cover como resume).
 * - No deseleccionar CV válido; cambiar = click en el deseado.
 * - Preferir CV del rol; Show more si hace falta.
 * - Tras click: Si OK → Next; No → insistir 30s.
 * - Timeout 30s: dry-run error; prod → Notas + pendiente + siguiente.
 */

import {
  RESUME_FALLBACK_MATCH,
  detectApplyRoleKind,
  scoreResumeForRole,
  type ApplyRoleKind,
} from "./canonical-text.js";

export const RESUME_INSIST_MS = 30_000;

const COVER_RE = /intro-GGZ|intro\s*letter|cover\s*letter|introduction\s*letter/i;

export type ResumeEnsureOutcome =
  | "not_step"
  | "ok"
  | "timeout_dry"
  | "timeout_prod";

export type ResumeEnsureResult = {
  outcome: ResumeEnsureOutcome;
  /** true si el CV seleccionado matchea rol o fallback Eng01 intencional */
  preferred: boolean;
  selectedLabel: string;
  notes: string;
  /** Avanzar Next con selección actual (solo si outcome === ok) */
  canAdvance: boolean;
};

export type ResumeRunMode = "dry_run" | "productive";

export function isCoverAsResumeLabel(blob: string): boolean {
  return COVER_RE.test(blob || "");
}

/** Selección usable para no romper el wizard (no cover / no vacío). */
export function isValidResumeSelection(blob: string): boolean {
  const t = (blob || "").trim();
  if (!t) return false;
  if (isCoverAsResumeLabel(t)) return false;
  return /\.pdf|resume|curr[ií]culum/i.test(t) || t.length >= 8;
}

export function formatResumeTimeoutNotes(selectedLabel: string, kind: ApplyRoleKind): string {
  const sel = selectedLabel.trim() || "(ninguno)";
  return [
    "Falla selección CV Easy Apply (timeout 30s):",
    `- Rol buscado: ${kind}`,
    `- Selección al cortar: ${sel}`,
    "- Acción: pendiente; reintentar manual o ampliar CVs en LinkedIn.",
  ].join("\n");
}

/**
 * Decide el outcome tras insistir 30s sin lograr CV del rol.
 * Pure — testeable sin Playwright.
 */
export function resolveResumeTimeoutOutcome(
  mode: ResumeRunMode,
  selectedLabel: string,
  kind: ApplyRoleKind
): ResumeEnsureResult {
  const notes = formatResumeTimeoutNotes(selectedLabel, kind);
  if (mode === "dry_run") {
    return {
      outcome: "timeout_dry",
      preferred: false,
      selectedLabel,
      notes,
      canAdvance: false,
    };
  }
  return {
    outcome: "timeout_prod",
    preferred: false,
    selectedLabel,
    notes,
    canAdvance: false,
  };
}

export function resumeRoleScore(label: string, kind: ApplyRoleKind): number {
  if (isCoverAsResumeLabel(label)) return 0;
  return scoreResumeForRole(label, kind);
}

export function isPreferredResumeLabel(label: string, kind: ApplyRoleKind): boolean {
  if (resumeRoleScore(label, kind) >= 70) return true;
  return RESUME_FALLBACK_MATCH.test(label);
}

export function detectKindForResume(jobTitle: string, company = ""): ApplyRoleKind {
  return detectApplyRoleKind(jobTitle, company);
}
