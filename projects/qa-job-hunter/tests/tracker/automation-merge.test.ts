import test from "node:test";
import assert from "node:assert/strict";
import { planAutomationUpsert } from "../../src/tracker/automation-merge.js";

const baseFields = {
  matchPercent: 80,
  puesto: "QA Engineer",
  empresa: "Acme",
  linkedinUrl: "https://www.linkedin.com/jobs/view/123/",
  linkedinUrlNorm: "https://www.linkedin.com/jobs/view/123",
  jobId: "123",
  canal: "Easy Apply",
  proximoPaso: "Easy Apply automático o revisar",
  estado: "Pendiente" as const,
};

test("planAutomationUpsert insert sin existing", () => {
  const plan = planAutomationUpsert(null, baseFields);
  assert.equal(plan.action, "insert");
  if (plan.action === "insert") {
    assert.equal(plan.fields.estado, "Pendiente");
    assert.equal(plan.fields.puesto, "QA Engineer");
  }
});

test("planAutomationUpsert skip estado protegido", () => {
  const plan = planAutomationUpsert({ estado: "Enviada" }, baseFields);
  assert.equal(plan.action, "skip");
});

test("planAutomationUpsert skip todos los estados protegidos Excel", () => {
  for (const estado of [
    "Enviada",
    "Cerrado",
    "Descartado",
    "Duplicado",
    "Stand-by",
    "Borrador abierto",
    "A-pendiente",
    "A-realizado",
  ]) {
    const plan = planAutomationUpsert({ estado }, baseFields);
    assert.equal(plan.action, "skip", `debe skip ${estado}`);
  }
});

test("planAutomationUpsert update sin bajar estado", () => {
  const plan = planAutomationUpsert(
    { estado: "Pendiente", proximoPaso: "Revisar CV", notas: "Nota usuaria" },
    { ...baseFields, matchPercent: 90, notas: "Resumen pipeline" }
  );
  assert.equal(plan.action, "update");
  if (plan.action === "update") {
    assert.equal(plan.update.matchPercent, 90);
    assert.equal(plan.update.proximoPaso, "Revisar CV");
    assert.equal(plan.update.notas, undefined);
    assert.equal(plan.update.estado, undefined);
  }
});

test("planAutomationUpsert no setea Descartado desde automation", () => {
  const plan = planAutomationUpsert(null, { ...baseFields, estado: "Descartado" });
  assert.equal(plan.action, "insert");
  if (plan.action === "insert") {
    assert.equal(plan.fields.estado, "Stand-by");
  }
});
