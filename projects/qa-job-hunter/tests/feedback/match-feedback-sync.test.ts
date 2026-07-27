import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  addRejection,
  applicationToMatchRejection,
  buildFeedbackLearningBlock,
  loadFeedbackFromJson,
  mergeFeedbackStores,
  removeRejection,
  type MatchFeedbackStore,
  type MatchRejection,
} from "../../src/feedback.js";
import { syncRejectionFromApplication, syncUndoRejectionFromJobId } from "../../src/feedback-sync.js";
import type { TrackerApplication } from "../../src/types/tracker-application.js";

function app(overrides: Partial<TrackerApplication> = {}): TrackerApplication {
  return {
    id: "507f1f77bcf86cd799439011",
    jobId: "12345",
    matchPercent: 85,
    puesto: "QA Automation",
    empresa: "Acme",
    linkedinUrl: "https://www.linkedin.com/jobs/view/12345/",
    canal: "Easy Apply",
    estado: "Stand-by",
    matchRejected: true,
    matchRejectedReason: "No es QA",
    matchRejectedAt: "2026-07-25T10:00:00.000Z",
    analysis: { searchTerm: "qa automation" },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

test("applicationToMatchRejection mapea campos tracker", () => {
  const rejection = applicationToMatchRejection(app());
  assert.ok(rejection);
  assert.equal(rejection!.jobId, "12345");
  assert.equal(rejection!.title, "QA Automation");
  assert.equal(rejection!.searchTerm, "qa automation");
  assert.equal(rejection!.reason, "No es QA");
});

test("applicationToMatchRejection retorna null si no está rechazado", () => {
  assert.equal(applicationToMatchRejection(app({ matchRejected: false })), null);
});

test("mergeFeedbackStores fusiona por jobId — Mongo gana", () => {
  const json: MatchFeedbackStore = {
    updatedAt: "2026-01-01T00:00:00.000Z",
    rejections: [
      {
        jobId: "1",
        title: "Old",
        company: "Co",
        searchTerm: "qa",
        matchPercent: 80,
        rejectedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        jobId: "2",
        title: "Solo JSON",
        company: "Co",
        searchTerm: "dev",
        matchPercent: 75,
        rejectedAt: "2026-01-02T00:00:00.000Z",
      },
    ],
  };
  const mongo: MatchRejection[] = [
    {
      jobId: "1",
      title: "Nuevo desde Mongo",
      company: "Co",
      searchTerm: "qa lead",
      matchPercent: 90,
      reason: "Falso positivo",
      rejectedAt: "2026-07-25T12:00:00.000Z",
    },
  ];
  const merged = mergeFeedbackStores(json, mongo);
  assert.equal(merged.rejections.length, 2);
  assert.equal(merged.rejections.find((r) => r.jobId === "1")?.title, "Nuevo desde Mongo");
  assert.equal(merged.rejections.find((r) => r.jobId === "2")?.title, "Solo JSON");
});

test("buildFeedbackLearningBlock incluye rechazos fusionados", () => {
  const store = mergeFeedbackStores(
    { updatedAt: "", rejections: [] },
    [
      {
        jobId: "99",
        title: "DevOps Engineer",
        company: "Corp",
        searchTerm: "qa",
        matchPercent: 82,
        reason: "Rol infra",
        rejectedAt: "2026-07-25T12:00:00.000Z",
      },
    ]
  );
  const block = buildFeedbackLearningBlock(store);
  assert.match(block, /FEEDBACK DEL USUARIO/);
  assert.match(block, /DevOps Engineer/);
  assert.match(block, /Rol infra/);
});

test("syncRejectionFromApplication escribe JSON temporal", (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "jh-feedback-"));
  const feedbackPath = path.join(tmpDir, "match-feedback.json");
  const prev = process.env.MATCH_FEEDBACK_PATH;
  process.env.MATCH_FEEDBACK_PATH = feedbackPath;
  t.after(() => {
    if (prev === undefined) delete process.env.MATCH_FEEDBACK_PATH;
    else process.env.MATCH_FEEDBACK_PATH = prev;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  syncRejectionFromApplication(app(), "No es QA");
  const store = loadFeedbackFromJson();
  assert.equal(store.rejections.length, 1);
  assert.equal(store.rejections[0].jobId, "12345");
  assert.equal(store.rejections[0].reason, "No es QA");

  syncUndoRejectionFromJobId("12345");
  assert.equal(loadFeedbackFromJson().rejections.length, 0);
});

test("addRejection y removeRejection actualizan JSON", (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "jh-feedback-"));
  const feedbackPath = path.join(tmpDir, "match-feedback.json");
  const prev = process.env.MATCH_FEEDBACK_PATH;
  process.env.MATCH_FEEDBACK_PATH = feedbackPath;
  t.after(() => {
    if (prev === undefined) delete process.env.MATCH_FEEDBACK_PATH;
    else process.env.MATCH_FEEDBACK_PATH = prev;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  addRejection(
    {
      id: "777",
      title: "PM",
      company: "X",
      searchTerm: "qa",
      matchPercent: 71,
    },
    "No QA"
  );
  assert.equal(loadFeedbackFromJson().rejections[0].jobId, "777");
  removeRejection("777");
  assert.equal(loadFeedbackFromJson().rejections.length, 0);
});
