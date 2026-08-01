import test from "node:test";
import assert from "node:assert/strict";
import {
  GMAIL_ASSESS_PENDIENTES_LABEL,
  gmailAssessmentPendingProximoPaso,
  hasGmailAssessmentPendingSignal,
} from "../../src/tracker/gmail-assessment-label.js";
import type { TrackerApplication } from "../../src/types/tracker-application.js";

function app(overrides: Partial<TrackerApplication> = {}): TrackerApplication {
  return {
    id: "507f1f77bcf86cd799439011",
    jobId: "12345",
    matchPercent: 85,
    puesto: "QA",
    empresa: "Co",
    linkedinUrl: "https://www.linkedin.com/jobs/view/12345/",
    canal: "Easy Apply",
    estado: "Enviada",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

test("gmailAssessmentPendingProximoPaso usa label canónico", () => {
  assert.equal(
    gmailAssessmentPendingProximoPaso(),
    `Gmail ${GMAIL_ASSESS_PENDIENTES_LABEL}`
  );
});

test("hasGmailAssessmentPendingSignal detecta proximoPaso reconcile canónico", () => {
  assert.equal(
    hasGmailAssessmentPendingSignal(
      app({ proximoPaso: gmailAssessmentPendingProximoPaso() })
    ),
    true
  );
});

test("hasGmailAssessmentPendingSignal tolera formato legacy sin Empleo/", () => {
  assert.equal(
    hasGmailAssessmentPendingSignal(app({ proximoPaso: "Gmail Entrevistas-Assessments/Pendientes" })),
    true
  );
});

test("hasGmailAssessmentPendingSignal busca en notas case-insensitive", () => {
  assert.equal(
    hasGmailAssessmentPendingSignal(
      app({ notas: "sync gmail empleo/entrevistas-assessments/pendientes" })
    ),
    true
  );
});

test("hasGmailAssessmentPendingSignal ignora Completar assessment manual", () => {
  assert.equal(hasGmailAssessmentPendingSignal(app({ proximoPaso: "Completar assessment" })), false);
});
