import test from "node:test";
import assert from "node:assert/strict";

import {
  isEasyApplyLockedEstado,
  planEasyApplyUpsert,
} from "../../src/tracker/automation-merge.js";

const baseFields = {
  matchPercent: 80,
  puesto: "QA Engineer",
  empresa: "Acme",
  linkedinUrl: "https://www.linkedin.com/jobs/view/123/",
  linkedinUrlNorm: "https://www.linkedin.com/jobs/view/123",
  jobId: "123",
  canal: "Easy Apply",
  applyType: "easy_apply" as const,
  estado: "Pendiente" as const,
};

test("planEasyApplyUpsert insert sin existing", () => {
  const plan = planEasyApplyUpsert(null, baseFields);
  assert.equal(plan.action, "insert");
});

test("planEasyApplyUpsert sube Pendiente a Enviada", () => {
  const plan = planEasyApplyUpsert(
    { estado: "Pendiente" },
    { ...baseFields, estado: "Enviada" }
  );
  assert.equal(plan.action, "update");
  if (plan.action === "update") {
    assert.equal(plan.update.estado, "Enviada");
    assert.ok(plan.update.fechaAplicacion);
  }
});

test("planEasyApplyUpsert mergea notas EA sin pisar existentes", () => {
  const plan = planEasyApplyUpsert(
    { estado: "Pendiente", notas: "Nota pipeline" },
    { ...baseFields, notas: "Campos que fallaron:\n- Años" }
  );
  assert.equal(plan.action, "update");
  if (plan.action === "update") {
    assert.equal(plan.update.notas, "Nota pipeline\nCampos que fallaron:\n- Años");
  }
});

test("planEasyApplyUpsert skip estados bloqueados por usuaria", () => {
  for (const estado of ["Descartado", "Duplicado", "Stand-by", "Cerrado", "Borrador abierto"]) {
    const plan = planEasyApplyUpsert({ estado }, { ...baseFields, estado: "Enviada" });
    assert.equal(plan.action, "skip", `debe skip ${estado}`);
  }
});

test("planEasyApplyUpsert permite actualizar Enviada (notas)", () => {
  const plan = planEasyApplyUpsert(
    { estado: "Enviada", fechaAplicacion: "2026-07-20" },
    { ...baseFields, estado: "Enviada", notas: "Nueva nota EA" }
  );
  assert.equal(plan.action, "update");
  if (plan.action === "update") {
    assert.equal(plan.update.estado, "Enviada");
    assert.equal(plan.update.notas, "Nueva nota EA");
    assert.equal(plan.update.fechaAplicacion, undefined);
  }
});

test("isEasyApplyLockedEstado no bloquea Pendiente ni Enviada", () => {
  assert.equal(isEasyApplyLockedEstado("Pendiente"), false);
  assert.equal(isEasyApplyLockedEstado("Enviada"), false);
  assert.equal(isEasyApplyLockedEstado("Descartado"), true);
});
