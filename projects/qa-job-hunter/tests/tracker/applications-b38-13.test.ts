import test from "node:test";
import assert from "node:assert/strict";
import { ObjectId } from "mongodb";
import { connect, disconnect } from "../../src/db/client.js";
import {
  createApplication,
  getApplicationById,
  listApplications,
  patchApplication,
  toTrackerApplication,
  type ApplicationDoc,
} from "../../src/db/applications.js";
import { ensureIndexes } from "../../src/db/indexes.js";

const TEST_JOB_ID = `b38-13-test-${Date.now()}`;

test("toTrackerApplication legacy doc sin campos B-38-13", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");
  const legacy: ApplicationDoc = {
    _id: new ObjectId(),
    matchPercent: 75,
    puesto: "QA",
    empresa: "Co",
    linkedinUrl: "https://www.linkedin.com/jobs/view/1/",
    linkedinUrlNorm: "https://www.linkedin.com/jobs/view/1",
    canal: "Easy Apply",
    estado: "Pendiente",
    createdAt: now,
    updatedAt: now,
  };
  const api = toTrackerApplication(legacy);
  assert.equal(api.analysis, undefined);
  assert.equal(api.matchRejected, false);
  assert.equal(api.inLatestAnalysis, false);
});

test("applications B-38-13 round-trip Mongo", async (t) => {
  try {
    await connect();
    await ensureIndexes();
  } catch {
    t.skip("MongoDB no disponible — docker compose up -d");
    return;
  }

  const created = await createApplication(
    {
      jobId: TEST_JOB_ID,
      matchPercent: 88,
      puesto: "QA B38-13 Test",
      empresa: "TestCo",
      linkedinUrl: `https://www.linkedin.com/jobs/view/${TEST_JOB_ID}/`,
      canal: "Easy Apply",
      estado: "Pendiente",
      analysis: {
        location: "Remote",
        summary: "Test snapshot",
        matchedSkills: ["Playwright"],
        analyzedAt: "2026-07-25T12:00:00.000Z",
      },
      matchRejected: true,
      matchRejectedReason: "Test reject",
      matchRejectedAt: "2026-07-25T13:00:00.000Z",
      inLatestAnalysis: true,
      updatedBy: "test",
    },
    "import"
  );

  assert.equal(created.analysis?.summary, "Test snapshot");
  assert.equal(created.matchRejected, true);
  assert.equal(created.inLatestAnalysis, true);

  const fetched = await getApplicationById(created.id);
  assert.ok(fetched);
  assert.equal(fetched!.analysis?.matchedSkills?.[0], "Playwright");

  const patched = await patchApplication(created.id, { estado: "Stand-by", notas: "Revisar" }, "user");
  assert.ok(patched);
  assert.equal(patched!.application.estado, "Stand-by");
  assert.equal(patched!.application.analysis?.summary, "Test snapshot");
  assert.equal(patched!.application.matchRejected, true);

  const listed = await listApplications({
    matchRejected: true,
    minMatchPercent: 70,
    q: "B38-13 Test",
  });
  assert.ok(listed.some((a) => a.id === created.id));

  try {
    const { getDb } = await import("../../src/db/client.js");
    await getDb().collection("applications").deleteOne({ _id: new ObjectId(created.id) });
  } finally {
    await disconnect();
  }
});
