import test from "node:test";
import assert from "node:assert/strict";
import {
  patchForApplicationStatus,
  patchForRejectMatch,
  patchForUndoReject,
  canMarkAssessmentPending,
} from "../../src/dashboard/application-writes.js";
import {
  gmailAssessmentPendingProximoPaso,
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
    estado: "Pendiente",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

test("patchForApplicationStatus applied → Enviada + fecha", () => {
  const { patch } = patchForApplicationStatus("applied", app());
  assert.equal(patch.estado, "Enviada");
  assert.match(patch.fechaAplicacion ?? "", /^\d{4}-\d{2}-\d{2}$/);
});

test("patchForApplicationStatus not_applied → Stand-by + nota", () => {
  const { patch } = patchForApplicationStatus("not_applied", app());
  assert.equal(patch.estado, "Stand-by");
  assert.match(patch.notas ?? "", /No aplicado \(dashboard\)/);
});

test("patchForApplicationStatus not_selected → Cerrado", () => {
  const { patch } = patchForApplicationStatus("not_selected", app());
  assert.equal(patch.estado, "Cerrado");
  assert.match(patch.proximoPaso ?? "", /No seleccionada\/o/);
});

test("patchForApplicationStatus desmarcar desde Enviada → Pendiente", () => {
  const { patch, error } = patchForApplicationStatus(null, app({ estado: "Enviada" }));
  assert.equal(error, undefined);
  assert.equal(patch.estado, "Pendiente");
});

test("patchForApplicationStatus desmarcar desde Stand-by → Pendiente", () => {
  const { patch, error } = patchForApplicationStatus(null, app({ estado: "Stand-by" }));
  assert.equal(error, undefined);
  assert.equal(patch.estado, "Pendiente");
});

test("patchForApplicationStatus assessment_pending desde Enviada → A-pendiente", () => {
  const { patch, error } = patchForApplicationStatus(
    "assessment_pending",
    app({
      estado: "Enviada",
      fechaAplicacion: "2026-01-15",
      proximoPaso: gmailAssessmentPendingProximoPaso(),
    })
  );
  assert.equal(error, undefined);
  assert.equal(patch.estado, "A-pendiente");
  assert.match(patch.notas ?? "", /Assessment pendiente \(dashboard\)/);
  assert.equal(patch.proximoPaso, gmailAssessmentPendingProximoPaso());
});

test("patchForApplicationStatus assessment_pending desde Borrador abierto", () => {
  const { patch, error } = patchForApplicationStatus(
    "assessment_pending",
    app({
      estado: "Borrador abierto",
      proximoPaso: "Gmail Entrevistas-Assessments/Pendientes",
    })
  );
  assert.equal(error, undefined);
  assert.equal(patch.estado, "A-pendiente");
});

test("patchForApplicationStatus assessment_pending rechaza sin señal Gmail", () => {
  const { error } = patchForApplicationStatus(
    "assessment_pending",
    app({ estado: "Enviada", fechaAplicacion: "2026-01-15" })
  );
  assert.match(error ?? "", /Gmail Entrevistas-Assessments\/Pendientes/);
});

test("patchForApplicationStatus assessment_pending rechaza Pendiente puro", () => {
  const { error } = patchForApplicationStatus("assessment_pending", app({ estado: "Pendiente" }));
  assert.match(error ?? "", /solo después de aplicar/);
});

test("canMarkAssessmentPending permite legacy A-pendiente", () => {
  assert.equal(canMarkAssessmentPending(app({ estado: "A-pendiente" })), true);
});

test("canMarkAssessmentPending bloquea Pendiente puro", () => {
  assert.equal(canMarkAssessmentPending(app({ estado: "Pendiente" })), false);
});

test("patchForApplicationStatus desmarcar A-pendiente con fecha → Enviada", () => {
  const { patch, error } = patchForApplicationStatus(
    null,
    app({ estado: "A-pendiente", fechaAplicacion: "2026-01-15" })
  );
  assert.equal(error, undefined);
  assert.equal(patch.estado, "Enviada");
});

test("patchForApplicationStatus desmarcar A-pendiente sin fecha → Pendiente", () => {
  const { patch, error } = patchForApplicationStatus(null, app({ estado: "A-pendiente" }));
  assert.equal(error, undefined);
  assert.equal(patch.estado, "Pendiente");
});

test("patchForRejectMatch setea matchRejected y Stand-by", () => {
  const patch = patchForRejectMatch("No es QA", app());
  assert.equal(patch.matchRejected, true);
  assert.equal(patch.matchRejectedReason, "No es QA");
  assert.equal(patch.estado, "Stand-by");
  assert.match(patch.notas ?? "", /Match incorrecto/);
});

test("patchForUndoReject limpia reject y vuelve a Pendiente desde Stand-by", () => {
  const patch = patchForUndoReject(
    app({ estado: "Stand-by", matchRejected: true, matchRejectedReason: "x" })
  );
  assert.equal(patch.matchRejected, false);
  assert.equal(patch.estado, "Pendiente");
});
