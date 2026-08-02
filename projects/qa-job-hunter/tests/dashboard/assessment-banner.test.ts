/**
 * Banner assessments (#421).
 * Smoke manual: npm run qa:seed-assessment-estados && npm run dashboard
 */
import test from "node:test";
import assert from "node:assert/strict";
import type { TrackerApplication } from "../../src/types/tracker-application.js";
import {
  composeMatchJobsFromApplications,
  computeAssessmentBannerMeta,
} from "../../src/dashboard/match-jobs.js";

function app(overrides: Partial<TrackerApplication> = {}): TrackerApplication {
  return {
    id: "507f1f77bcf86cd799439011",
    jobId: "1234567890",
    matchPercent: 85,
    puesto: "QA Engineer",
    empresa: "Acme",
    linkedinUrl: "https://www.linkedin.com/jobs/view/1234567890/",
    canal: "Easy Apply",
    estado: "Pendiente",
    inLatestAnalysis: true,
    createdAt: "2026-07-20T10:00:00.000Z",
    updatedAt: "2026-07-25T10:00:00.000Z",
    ...overrides,
  };
}

test("computeAssessmentBannerMeta hidden sin historial assessment", () => {
  const meta = computeAssessmentBannerMeta([
    app({ estado: "Enviada" }),
    app({ id: "a2", jobId: "a2-job", estado: "Pendiente" }),
  ]);
  assert.equal(meta.assessmentPendingCount, 0);
  assert.equal(meta.assessmentDoneCount, 0);
  assert.equal(meta.assessmentBanner, "hidden");
});

test("computeAssessmentBannerMeta pending con A-pendiente visible", () => {
  const meta = computeAssessmentBannerMeta([
    app({ estado: "A-pendiente" }),
    app({ id: "a2", jobId: "a2-job", estado: "A-realizado" }),
  ]);
  assert.equal(meta.assessmentPendingCount, 1);
  assert.equal(meta.assessmentDoneCount, 1);
  assert.equal(meta.assessmentBanner, "pending");
});

test("computeAssessmentBannerMeta ok sin pendientes y con A-realizado", () => {
  const meta = computeAssessmentBannerMeta([
    app({ estado: "A-realizado" }),
    app({ id: "a2", jobId: "a2-job", estado: "Enviada" }),
  ]);
  assert.equal(meta.assessmentPendingCount, 0);
  assert.equal(meta.assessmentDoneCount, 1);
  assert.equal(meta.assessmentBanner, "ok");
});

test("computeAssessmentBannerMeta excluye Duplicado y Descartado ocultos", () => {
  const meta = computeAssessmentBannerMeta([
    app({ estado: "Duplicado", matchPercent: 90 }),
    app({ id: "a2", jobId: "a2-job", estado: "Descartado", matchPercent: 90 }),
    app({ id: "a3", jobId: "a3-job", estado: "A-pendiente", matchPercent: 90 }),
  ]);
  assert.equal(meta.assessmentPendingCount, 1);
  assert.equal(meta.assessmentBanner, "pending");
});

test("composeMatchJobsFromApplications expone meta assessment antes de filter", () => {
  const apps = [
    app({ estado: "A-pendiente" }),
    app({ id: "a2", jobId: "a2-job", estado: "Enviada" }),
  ];

  const response = composeMatchJobsFromApplications(
    apps,
    new Map(),
    new Map(),
    { scrapedAt: "2026-07-25T09:00:00.000Z", totalAnalyzed: 2 },
    { filter: "applied" }
  );

  assert.equal(response.meta?.assessmentPendingCount, 1);
  assert.equal(response.meta?.assessmentBanner, "pending");
  assert.equal(response.matchedJobs.length, 1);
  assert.equal(response.matchedJobs[0].estado, "Enviada");
});
