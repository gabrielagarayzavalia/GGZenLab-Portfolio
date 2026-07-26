import test from "node:test";
import assert from "node:assert/strict";
import {
  patchForApplicationStatus,
  patchForRejectMatch,
  patchForUndoReject,
} from "../../src/dashboard/application-writes.js";
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

test("patchForApplicationStatus desmarcar bloquea estado protegido", () => {
  const { error } = patchForApplicationStatus(null, app({ estado: "Enviada" }));
  assert.ok(error?.includes("protegido"));
});

test("patchForApplicationStatus desmarcar → Pendiente", () => {
  const { patch, error } = patchForApplicationStatus(null, app({ estado: "Pendiente" }));
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
