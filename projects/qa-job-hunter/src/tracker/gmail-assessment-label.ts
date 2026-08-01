import type { TrackerApplication } from "../types/tracker-application.js";

/** Label Gmail canónico (applied-list `gmail-taxonomy` → reconcile). */
export const GMAIL_ASSESS_PENDIENTES_LABEL = "Empleo/Entrevistas-Assessments/Pendientes";

/** Sufijo tolerado en datos legacy sin prefijo `Empleo/`. */
const GMAIL_ASSESS_PENDIENTES_TAIL = "Entrevistas-Assessments/Pendientes";

export function gmailAssessmentPendingProximoPaso(): string {
  return `Gmail ${GMAIL_ASSESS_PENDIENTES_LABEL}`;
}

function fieldHasGmailAssessmentPendingSignal(value: string | undefined): boolean {
  if (!value?.trim()) return false;
  const lower = value.toLowerCase();
  return (
    lower.includes(GMAIL_ASSESS_PENDIENTES_LABEL.toLowerCase()) ||
    lower.includes(GMAIL_ASSESS_PENDIENTES_TAIL.toLowerCase())
  );
}

/** Mail en label Gmail Pendientes — reconcile escribe `proximoPaso` / `notas`. */
export function hasGmailAssessmentPendingSignal(app: TrackerApplication): boolean {
  return (
    fieldHasGmailAssessmentPendingSignal(app.proximoPaso) ||
    fieldHasGmailAssessmentPendingSignal(app.notas)
  );
}
