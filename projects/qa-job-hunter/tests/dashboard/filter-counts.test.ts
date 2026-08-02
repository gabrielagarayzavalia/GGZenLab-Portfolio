import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  computeFilterCounts,
  filterVisibleJobs,
  formatFilterCountLabel,
  getJobListBucket,
  isJobVisibleForStateFilters,
} from "../../dashboard/filter-counts.js";

const DASHBOARD_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../dashboard"
);

/** @param {Partial<{ id: string; company: string; title: string; estado?: string; jobClosed?: boolean }>} overrides */
function job(overrides = {}) {
  return {
    id: "j1",
    company: "Acme",
    title: "QA Engineer",
    matchPercent: 80,
    ...overrides,
  };
}

function ctx(overrides = {}) {
  return {
    rejectedIds: new Set(),
    getApplicationStatus: () => null,
    ...overrides,
  };
}

const allFlagsOn = {
  showUnmarked: true,
  showApplied: true,
  showNotApplied: true,
  showNotSelected: true,
  showAssessment: true,
  showAssessmentDone: true,
  showRejected: true,
  showClosed: true,
  showDuplicated: true,
};

const onlyUnmarked = {
  showUnmarked: true,
  showApplied: false,
  showNotApplied: false,
  showNotSelected: false,
  showAssessment: false,
  showAssessmentDone: false,
  showRejected: false,
  showClosed: false,
  showDuplicated: false,
};

test("getJobListBucket asigna bucket único por precedencia", () => {
  const rejected = ctx({ rejectedIds: new Set(["r1"]) });
  assert.equal(getJobListBucket(job({ id: "r1" }), rejected), "rejected");
  assert.equal(getJobListBucket(job({ estado: "Duplicado" }), ctx()), "duplicated");
  assert.equal(getJobListBucket(job({ jobClosed: true }), ctx()), "closed");
  assert.equal(getJobListBucket(job({ estado: "A-realizado" }), ctx()), "assessment_done");
  assert.equal(
    getJobListBucket(
      job({ id: "a1" }),
      ctx({ getApplicationStatus: (id) => (id === "a1" ? "applied" : null) })
    ),
    "applied"
  );
});

test("computeFilterCounts — buckets respetan empresa/puesto sin otros checkboxes", () => {
  const jobs = [
    job({ id: "1", company: "Acme", title: "QA" }),
    job({ id: "2", company: "Acme", title: "SDET" }),
    job({
      id: "3",
      company: "Beta",
      title: "QA",
      estado: "Enviada",
    }),
  ];
  const withStatus = ctx({
    getApplicationStatus: (id) => (id === "3" ? "applied" : null),
  });

  const counts = computeFilterCounts(jobs, allFlagsOn, withStatus, {
    filterCompany: "Acme",
  });

  assert.equal(counts.buckets.unmarked, 2);
  assert.equal(counts.buckets.applied, 0);
  assert.equal(counts.companies.Acme, 2);
  assert.equal(counts.companies.Beta, 1);
  assert.equal(counts.titles["QA"], 1);
  assert.equal(counts.titles.SDET, 1);
});

test("computeFilterCounts — visibleCount coherente con AND empresa+puesto+buckets", () => {
  const jobs = [
    job({ id: "1", company: "Acme", title: "QA" }),
    job({ id: "2", company: "Acme", title: "SDET" }),
    job({ id: "3", company: "Beta", title: "QA" }),
  ];

  const counts = computeFilterCounts(jobs, onlyUnmarked, ctx(), {
    filterCompany: "Acme",
    filterTitle: "QA",
  });

  assert.equal(counts.visibleCount, 1);
  assert.deepEqual(
    filterVisibleJobs(jobs, onlyUnmarked, ctx(), {
      filterCompany: "Acme",
      filterTitle: "QA",
    }).map((j) => j.id),
    ["1"]
  );
});

test("isJobVisibleForStateFilters — OR entre buckets activos", () => {
  const jobs = [
    job({ id: "1" }),
    job({
      id: "2",
      estado: "Enviada",
    }),
  ];
  const withStatus = ctx({
    getApplicationStatus: (id) => (id === "2" ? "applied" : null),
  });

  const visible = filterVisibleJobs(jobs, onlyUnmarked, withStatus);
  assert.deepEqual(visible.map((j) => j.id), ["1"]);

  const both = filterVisibleJobs(
    jobs,
    { ...onlyUnmarked, showApplied: true },
    withStatus
  );
  assert.deepEqual(both.map((j) => j.id), ["1", "2"]);
});

test("formatFilterCountLabel formatea etiqueta", () => {
  assert.equal(formatFilterCountLabel("Sin Clasificar", 45), "Sin Clasificar (45)");
  assert.equal(formatFilterCountLabel("MockCo", 0), "MockCo (0)");
});

test("index.html expone data-filter-label en checkboxes estado", () => {
  const html = fs.readFileSync(path.join(DASHBOARD_DIR, "index.html"), "utf-8");
  for (const bucket of [
    "unmarked",
    "applied",
    "assessment",
    "assessment_done",
    "duplicated",
  ]) {
    assert.match(
      html,
      new RegExp(`data-filter-label="${bucket}"`),
      `missing data-filter-label for ${bucket}`
    );
  }
});

test("app.js importa computeFilterCounts y renderiza contadores", () => {
  const appJs = fs.readFileSync(path.join(DASHBOARD_DIR, "app.js"), "utf-8");
  assert.match(appJs, /from "\.\/filter-counts\.js"/);
  assert.match(appJs, /computeFilterCounts/);
  assert.match(appJs, /renderFilterCounts/);
  assert.match(appJs, /data-testid="dash-visible-count"/);
});

test("isJobVisibleForStateFilters — A-realizado con bucket assessment_done", () => {
  const j = job({ id: "ar", estado: "A-realizado" });
  const flags = { ...allFlagsOn, showAssessmentDone: false, showUnmarked: false };
  assert.equal(isJobVisibleForStateFilters(j, flags, ctx()), false);
  assert.equal(
    isJobVisibleForStateFilters(j, { ...flags, showAssessmentDone: true }, ctx()),
    true
  );
});
