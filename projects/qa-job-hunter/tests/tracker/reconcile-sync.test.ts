import test from "node:test";
import assert from "node:assert/strict";
import { ObjectId } from "mongodb";

import { planReconcileUpsert, canReconcilePromoteEstado } from "../../src/tracker/automation-merge.js";
import { excelRowToReconcileFields, isReconcileSyncableRow } from "../../src/tracker/reconcile-row-map.js";
import { syncReconcileToTracker } from "../../src/tracker/reconcile-sync.js";
import { connect, disconnect } from "../../src/db/client.js";
import {
  createApplication,
  getApplicationById,
  upsertReconcileRows,
} from "../../src/db/applications.js";
import { ensureIndexes } from "../../src/db/indexes.js";

const baseFields = {
  matchPercent: 80,
  puesto: "QA Engineer",
  empresa: "Acme",
  linkedinUrl: "https://www.linkedin.com/jobs/view/123/",
  linkedinUrlNorm: "https://www.linkedin.com/jobs/view/123",
  jobId: "123",
  canal: "Easy Apply",
  estado: "Pendiente" as const,
};

test("planReconcileUpsert skip sin existing para Enviada", () => {
  const plan = planReconcileUpsert(null, { ...baseFields, estado: "Enviada" });
  assert.equal(plan.action, "skip");
});

test("planReconcileUpsert insert A-pendiente sin existing con jobId", () => {
  const plan = planReconcileUpsert(null, {
    ...baseFields,
    estado: "A-pendiente",
    proximoPaso: "Gmail Entrevistas-Assessments/Pendientes",
  });
  assert.equal(plan.action, "insert");
  if (plan.action === "insert") {
    assert.equal(plan.fields.estado, "A-pendiente");
    assert.equal(plan.fields.jobId, "123");
  }
});

test("planReconcileUpsert sube Enviada a A-pendiente", () => {
  const plan = planReconcileUpsert(
    { estado: "Enviada" },
    {
      ...baseFields,
      estado: "A-pendiente",
      proximoPaso: "Gmail Entrevistas-Assessments/Pendientes",
    }
  );
  assert.equal(plan.action, "update");
  if (plan.action === "update") {
    assert.equal(plan.update.estado, "A-pendiente");
    assert.equal(plan.update.proximoPaso, "Gmail Entrevistas-Assessments/Pendientes");
  }
});

test("planReconcileUpsert sube A-pendiente a A-realizado", () => {
  const plan = planReconcileUpsert(
    { estado: "A-pendiente" },
    { ...baseFields, estado: "A-realizado", proximoPaso: "Gmail Entrevistas-Assessments/Realizados" }
  );
  assert.equal(plan.action, "update");
  if (plan.action === "update") {
    assert.equal(plan.update.estado, "A-realizado");
  }
});

test("canReconcilePromoteEstado bloquea downgrade A-realizado a A-pendiente", () => {
  assert.equal(canReconcilePromoteEstado("A-realizado", "A-pendiente"), false);
});

test("planReconcileUpsert skip estados terminales en Mongo", () => {
  for (const estado of ["Descartado", "Duplicado", "Cerrado"]) {
    const plan = planReconcileUpsert({ estado }, { ...baseFields, estado: "A-pendiente" });
    assert.equal(plan.action, "skip", `debe skip mongo ${estado}`);
  }
});

test("planReconcileUpsert skip Enviada a Pendiente", () => {
  const plan = planReconcileUpsert(
    { estado: "Enviada" },
    { ...baseFields, estado: "Pendiente" }
  );
  assert.equal(plan.action, "skip");
});

test("planReconcileUpsert sube Pendiente a Enviada", () => {
  const plan = planReconcileUpsert(
    { estado: "Pendiente" },
    {
      ...baseFields,
      estado: "Enviada",
      proximoPaso: "Gmail Empleo/En proceso",
      fechaAplicacion: "2026-07-27",
    }
  );
  assert.equal(plan.action, "update");
  if (plan.action === "update") {
    assert.equal(plan.update.estado, "Enviada");
    assert.equal(plan.update.proximoPaso, "Gmail Empleo/En proceso");
    assert.equal(plan.update.fechaAplicacion, "2026-07-27");
    assert.equal(plan.update.updatedBy, "reconcile");
  }
});

test("planReconcileUpsert skip estados protegidos en Mongo", () => {
  for (const estado of ["Enviada", "Descartado", "Duplicado", "Stand-by", "Cerrado"]) {
    const plan = planReconcileUpsert({ estado }, { ...baseFields, estado: "A-pendiente" });
    assert.equal(plan.action, "skip", `debe skip mongo ${estado}`);
  }
});
test("planReconcileUpsert skip sin cambios", () => {
  const plan = planReconcileUpsert(
    { estado: "Pendiente", proximoPaso: "Gmail" },
    { ...baseFields, estado: "Pendiente", proximoPaso: "Gmail" }
  );
  assert.equal(plan.action, "skip");
});

test("planReconcileUpsert redirige Descartado Excel a Stand-by", () => {
  const plan = planReconcileUpsert(
    { estado: "Pendiente" },
    { ...baseFields, estado: "Descartado" as "Pendiente" }
  );
  assert.equal(plan.action, "update");
  if (plan.action === "update") {
    assert.equal(plan.update.estado, "Stand-by");
  }
});

test("excelRowToReconcileFields mapea jobId desde URL", () => {
  const fields = excelRowToReconcileFields({
    matchPercent: 75,
    puesto: "QA",
    empresa: "Co",
    linkedinUrl: "https://www.linkedin.com/jobs/view/999/",
    canal: "Easy Apply",
    estado: "A-pendiente",
    proximoPaso: "Gmail assess",
  });
  assert.equal(fields.jobId, "999");
  assert.equal(fields.estado, "A-pendiente");
});

test("isReconcileSyncableRow requiere jobId o URL", () => {
  assert.equal(
    isReconcileSyncableRow({
      matchPercent: 0,
      puesto: "X",
      empresa: "Y",
      linkedinUrl: "https://www.linkedin.com/jobs/view/1/",
      canal: "—",
      estado: "Pendiente",
    }),
    true
  );
  assert.equal(
    isReconcileSyncableRow({
      matchPercent: 0,
      puesto: "X",
      empresa: "Y",
      linkedinUrl: "",
      canal: "—",
      estado: "Pendiente",
    }),
    false
  );
});

test("syncReconcileToTracker respeta TRACKER_DUAL_WRITE=0", async () => {
  const prev = process.env.TRACKER_DUAL_WRITE;
  process.env.TRACKER_DUAL_WRITE = "0";
  const result = await syncReconcileToTracker("/no/existe.xlsx");
  assert.equal(result, null);
  if (prev === undefined) delete process.env.TRACKER_DUAL_WRITE;
  else process.env.TRACKER_DUAL_WRITE = prev;
});

test("upsertReconcileRows integración Mongo", async (t) => {
  const jobId = `reconcile-test-${Date.now()}`;
  try {
    await connect();
    await ensureIndexes();
  } catch {
    t.skip("MongoDB no disponible — docker compose up -d");
    return;
  }

  const created = await createApplication(
    {
      jobId,
      matchPercent: 72,
      puesto: "QA Reconcile Test",
      empresa: "TestCo",
      linkedinUrl: `https://www.linkedin.com/jobs/view/${jobId}/`,
      canal: "Easy Apply",
      estado: "Pendiente",
      updatedBy: "pipeline",
    },
    "import"
  );

  const result = await upsertReconcileRows([
    excelRowToReconcileFields({
      matchPercent: 72,
      puesto: "QA Reconcile Test",
      empresa: "TestCo",
      linkedinUrl: `https://www.linkedin.com/jobs/view/${jobId}/`,
      canal: "Easy Apply",
      estado: "Enviada",
      proximoPaso: "Gmail Empleo/En proceso",
      fechaAplicacion: "2026-07-27",
      jobId,
    }),
  ]);

  assert.equal(result.inserted, 0);
  assert.equal(result.updated, 1);
  assert.equal(result.skipped, 0);

  const updated = await getApplicationById(created.id);
  assert.ok(updated);
  assert.equal(updated!.estado, "Enviada");
  assert.equal(updated!.proximoPaso, "Gmail Empleo/En proceso");
  assert.equal(updated!.fechaAplicacion, "2026-07-27");
  assert.equal(updated!.updatedBy, "reconcile");

  try {
    const { getDb } = await import("../../src/db/client.js");
    await getDb().collection("applications").deleteOne({ _id: new ObjectId(created.id) });
  } finally {
    await disconnect();
  }
});
