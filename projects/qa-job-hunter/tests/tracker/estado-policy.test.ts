import test from "node:test";
import assert from "node:assert/strict";
import {
  applyTrackerPatch,
  coerceAutomationEstado,
  normalizeTrackerEstado,
} from "../../src/tracker/estado-policy.js";

test("coerceAutomationEstado redirige Descartado a Stand-by", () => {
  const r = coerceAutomationEstado("Descartado");
  assert.equal(r.estado, "Stand-by");
  assert.equal(r.redirectedFromDescartado, true);
});

test("coerceAutomationEstado preserva Enviada", () => {
  const r = coerceAutomationEstado("enviada");
  assert.equal(r.estado, "Enviada");
});

test("applyTrackerPatch automation bloquea misComentarios", () => {
  const { patch, warnings } = applyTrackerPatch(
    { misComentarios: "hola", estado: "Enviada" },
    "automation"
  );
  assert.equal(patch.misComentarios, undefined);
  assert.ok(warnings.some((w) => w.includes("misComentarios")));
});

test("applyTrackerPatch automation bloquea matchRejected", () => {
  const { patch, warnings } = applyTrackerPatch(
    { matchRejected: true, matchRejectedReason: "x", estado: "Stand-by" },
    "automation"
  );
  assert.equal(patch.matchRejected, undefined);
  assert.ok(warnings.some((w) => w.includes("matchRejected")));
});

test("applyTrackerPatch user permite Descartado", () => {
  const { patch } = applyTrackerPatch({ estado: "Descartado" }, "user");
  assert.equal(patch.estado, "Descartado");
});

test("normalizeTrackerEstado acepta variantes", () => {
  assert.equal(normalizeTrackerEstado("stand-by"), "Stand-by");
  assert.equal(normalizeTrackerEstado("A-pendiente"), "A-pendiente");
});
