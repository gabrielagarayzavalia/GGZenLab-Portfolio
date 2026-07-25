import test from "node:test";
import assert from "node:assert/strict";

import type { QueueRow } from "../../src/apply/apply-queue.js";
import {
  DESCARTADA_STANDBY_HINT,
  mergeNotas,
  notasFromQueueRow,
  queueRowToApplicationFields,
  queueStatusToEstado,
} from "../../src/tracker/apply-queue-map.js";

const baseRow: QueueRow = {
  jobId: "1234567890",
  title: "QA Engineer",
  company: "Acme",
  url: "https://www.linkedin.com/jobs/view/1234567890/",
  matchPercent: 82,
  easyApply: "yes",
  status: "pendiente",
  reason: "",
  notes: "",
  updatedAt: "2026-07-25T12:00:00.000Z",
};

test("queueStatusToEstado alinea con STATUS_TO_EXCEL", () => {
  assert.equal(queueStatusToEstado("pendiente"), "Pendiente");
  assert.equal(queueStatusToEstado("enviada"), "Enviada");
  assert.equal(queueStatusToEstado("cerrada"), "Cerrado");
  assert.equal(queueStatusToEstado("descartada"), "Stand-by");
});

test("notasFromQueueRow usa Notes y fallback Reason", () => {
  const fromNotes = notasFromQueueRow({
    ...baseRow,
    notes: "Campos que fallaron:\n- Años de experiencia",
  });
  assert.ok(fromNotes?.includes("Años de experiencia"));

  const fromReason = notasFromQueueRow({
    ...baseRow,
    reason: "Typeahead obligatorio falló tras 3 intentos",
  });
  assert.ok(fromReason?.includes("Typeahead"));
});

test("notasFromQueueRow descartada agrega hint Stand-by", () => {
  const notas = notasFromQueueRow({ ...baseRow, status: "descartada" });
  assert.ok(notas?.includes(DESCARTADA_STANDBY_HINT));
});

test("mergeNotas no duplica líneas", () => {
  assert.equal(mergeNotas("Línea A", "Línea A"), "Línea A");
  assert.equal(mergeNotas("Línea A", "Línea B"), "Línea A\nLínea B");
});

test("queueRowToApplicationFields mapea campos EA", () => {
  const fields = queueRowToApplicationFields({
    ...baseRow,
    status: "enviada",
    notes: "Campos que fallaron:\n- Skill X",
  });
  assert.equal(fields.estado, "Enviada");
  assert.equal(fields.canal, "Easy Apply");
  assert.equal(fields.applyType, "easy_apply");
  assert.equal(fields.jobId, "1234567890");
  assert.ok(fields.notas?.includes("Skill X"));
});
