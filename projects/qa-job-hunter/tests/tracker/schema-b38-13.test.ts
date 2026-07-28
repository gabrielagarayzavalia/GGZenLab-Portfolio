import test from "node:test";
import assert from "node:assert/strict";
import type { JobMatch } from "../../src/types.js";
import {
  analysisSnapshotFromJobMatch,
  normalizeFeedbackFields,
  type AnalysisSnapshot,
  type DashboardMatchJob,
} from "../../src/types/dashboard-match.js";
import type { TrackerApplication } from "../../src/types/tracker-application.js";

const legacyApplication: TrackerApplication = {
  id: "507f1f77bcf86cd799439011",
  matchPercent: 85,
  puesto: "QA Engineer",
  empresa: "Acme",
  linkedinUrl: "https://www.linkedin.com/jobs/view/123/",
  canal: "Easy Apply",
  estado: "Pendiente",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

test("TrackerApplication legacy sin campos B-38-13 es válido", () => {
  assert.equal(legacyApplication.analysis, undefined);
  assert.equal(legacyApplication.matchRejected, undefined);
  assert.equal(legacyApplication.inLatestAnalysis, undefined);
});

test("TrackerApplication acepta analysis y feedback opcionales", () => {
  const analysis: AnalysisSnapshot = {
    location: "Remote",
    modality: "Remote",
    matchedSkills: ["Playwright"],
    summary: "Buen fit",
    analyzedAt: "2026-07-25T12:00:00.000Z",
  };
  const app: TrackerApplication = {
    ...legacyApplication,
    analysis,
    matchRejected: true,
    matchRejectedReason: "Rol no QA",
    matchRejectedAt: "2026-07-25T13:00:00.000Z",
    inLatestAnalysis: true,
  };
  assert.equal(app.analysis?.summary, "Buen fit");
  assert.equal(app.matchRejected, true);
});

test("normalizeFeedbackFields defaults seguros", () => {
  assert.deepEqual(normalizeFeedbackFields({}), {
    matchRejected: false,
    inLatestAnalysis: false,
    matchRejectedReason: undefined,
    matchRejectedAt: undefined,
  });
  assert.equal(normalizeFeedbackFields({ matchRejected: true }).matchRejected, true);
});

test("analysisSnapshotFromJobMatch mapea JobMatch", () => {
  const job: JobMatch = {
    id: "123",
    title: "QA",
    company: "Co",
    location: "AR",
    modality: "Remote",
    datePosted: "1d",
    url: "https://example.com",
    description: "JD",
    searchTerm: "qa",
    source: "linkedin",
    externalId: "ext-1",
    matchPercent: 90,
    matchedSkills: ["TS"],
    gaps: ["AWS"],
    cvSuggestions: ["Destacar API"],
    summary: "Strong match",
  };
  const snap = analysisSnapshotFromJobMatch(job, {
    analyzedAt: "2026-07-25T10:00:00.000Z",
    runId: "abc123",
  });
  assert.equal(snap.location, "AR");
  assert.equal(snap.source, "linkedin");
  assert.deepEqual(snap.matchedSkills, ["TS"]);
  assert.equal(snap.runId, "abc123");
});

test("DashboardMatchJob shape mínimo", () => {
  const row: DashboardMatchJob = {
    id: "1",
    title: "QA",
    company: "Co",
    url: "https://example.com",
    matchPercent: 80,
    estado: "Pendiente",
    matchRejected: false,
    inLatestAnalysis: true,
    hasAnalysis: false,
  };
  assert.equal(row.hasAnalysis, false);
});
