import test from "node:test";
import assert from "node:assert/strict";
import type { JobMatch } from "../../src/types.js";
import type { TrackerApplication } from "../../src/types/tracker-application.js";
import {
  applicationToJobMatch,
  buildApplicationStatusEnvelope,
  buildFeedbackEnvelope,
  composeMatchJobsFromApplications,
  deriveApplicationStatus,
  dashboardJobId,
  isLinkedInJobClosed,
  isVisibleMatchApplication,
  matchesDashboardFilter,
  resolveJobFallback,
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

const jobFallback: JobMatch = {
  id: "1234567890",
  title: "QA Engineer",
  company: "Acme",
  location: "Remote",
  modality: "Remote",
  datePosted: "2d",
  url: "https://www.linkedin.com/jobs/view/1234567890/",
  description: "Full JD from jobs collection",
  searchTerm: "qa automation",
  matchPercent: 85,
  matchedSkills: ["Playwright"],
  gaps: ["AWS"],
  cvSuggestions: ["Destacar API"],
  summary: "Strong match from Mongo jobs",
};

test("dashboardJobId prefiere jobId LinkedIn", () => {
  assert.equal(dashboardJobId(app()), "1234567890");
  assert.equal(dashboardJobId(app({ jobId: undefined })), "507f1f77bcf86cd799439011");
});

test("deriveApplicationStatus mapea estados tracker", () => {
  assert.equal(deriveApplicationStatus(app({ estado: "Pendiente" })), null);
  assert.equal(deriveApplicationStatus(app({ estado: "Enviada" })), "applied");
  assert.equal(deriveApplicationStatus(app({ estado: "A-realizado" })), "applied");
  assert.equal(deriveApplicationStatus(app({ estado: "Borrador abierto" })), "applied");
  assert.equal(deriveApplicationStatus(app({ estado: "Cerrado" })), "not_selected");
  assert.equal(deriveApplicationStatus(app({ estado: "Stand-by" })), "not_applied");
  assert.equal(
    deriveApplicationStatus(app({ estado: "Stand-by", matchRejected: true })),
    null
  );
});

test("matchesDashboardFilter respeta categorías dashboard", () => {
  const pending = app({ estado: "Pendiente" });
  const applied = app({ estado: "Enviada" });
  const notApplied = app({ estado: "Stand-by" });
  const notSelected = app({ estado: "Cerrado" });
  const rejected = app({ matchRejected: true, estado: "Stand-by" });

  assert.equal(matchesDashboardFilter(pending, "unmarked"), true);
  assert.equal(matchesDashboardFilter(applied, "applied"), true);
  assert.equal(matchesDashboardFilter(notApplied, "not_applied"), true);
  assert.equal(matchesDashboardFilter(notSelected, "not_selected"), true);
  assert.equal(matchesDashboardFilter(rejected, "rejected"), true);

  assert.equal(matchesDashboardFilter(applied, "unmarked"), false);
  assert.equal(matchesDashboardFilter(rejected, "applied"), false);
});

test("isLinkedInJobClosed detecta scrape y analysis", () => {
  assert.equal(isLinkedInJobClosed(app({ jobClosed: true })), true);
  assert.equal(isLinkedInJobClosed(app({ analysis: { jobClosed: true } })), true);
  assert.equal(isLinkedInJobClosed(app({ acceptingApplications: false })), true);
  assert.equal(isLinkedInJobClosed(app({ analysis: { acceptingApplications: false } })), true);
  assert.equal(isLinkedInJobClosed(app()), false);
});

test("matchesDashboardFilter closed solo avisos LinkedIn cerrados", () => {
  const linkedInClosed = app({ jobClosed: true, estado: "Pendiente" });
  const userClosed = app({ estado: "Cerrado" });

  assert.equal(matchesDashboardFilter(linkedInClosed, "closed"), true);
  assert.equal(matchesDashboardFilter(userClosed, "closed"), false);
  assert.equal(matchesDashboardFilter(userClosed, "not_selected"), true);
});

test("isVisibleMatchApplication oculta avisos cerrados LinkedIn por defecto", () => {
  const closed = app({ jobClosed: true, matchPercent: 85, inLatestAnalysis: true });
  assert.equal(isVisibleMatchApplication(closed), false);
  assert.equal(isVisibleMatchApplication(closed, { showLinkedInClosed: true }), true);
});

test("isVisibleMatchApplication oculta Duplicado/Descartado y aplica umbral 70", () => {
  assert.equal(isVisibleMatchApplication(app({ matchPercent: 85, inLatestAnalysis: true })), true);
  assert.equal(
    isVisibleMatchApplication(app({ matchPercent: 65, inLatestAnalysis: true })),
    false
  );
  assert.equal(
    isVisibleMatchApplication(app({ matchPercent: 65, estado: "Enviada" })),
    true
  );
  assert.equal(
    isVisibleMatchApplication(app({ matchPercent: 50, matchRejected: true })),
    true
  );
  assert.equal(isVisibleMatchApplication(app({ estado: "Duplicado" })), false);
  assert.equal(isVisibleMatchApplication(app({ estado: "Descartado" })), false);
});

test("applicationToJobMatch propaga jdSections desde analysis (#370)", () => {
  const job = applicationToJobMatch(
    app({
      analysis: {
        description: "JD",
        jdSections: {
          requirements: ["4+ years Manual QA"],
          niceToHave: ["Cursor"],
          whatWeOffer: ["Remote"],
        },
        matchedSkills: ["QA"],
        summary: "Fit",
      },
    })
  );

  assert.equal(job.jdSections?.requirements[0], "4+ years Manual QA");
  assert.equal(job.jdSections?.niceToHave[0], "Cursor");
});

test("applicationToJobMatch usa analysis snapshot", () => {
  const job = applicationToJobMatch(
    app({
      analysis: {
        location: "AR",
        modality: "Hybrid",
        datePosted: "1w",
        description: "JD snapshot",
        searchTerm: "qa",
        matchedSkills: ["TS"],
        gaps: ["K8s"],
        cvSuggestions: ["CI/CD"],
        summary: "Buen fit",
      },
    })
  );

  assert.equal(job.location, "AR");
  assert.equal(job.applicationId, "507f1f77bcf86cd799439011");
  assert.equal(job.description, "JD snapshot");
  assert.deepEqual(job.matchedSkills, ["TS"]);
  assert.equal(job.summary, "Buen fit");
});

test("applicationToJobMatch expone jobClosed en JobMatch", () => {
  const job = applicationToJobMatch(
    app({
      jobClosed: true,
      analysis: { description: "JD", summary: "Ok" },
    })
  );
  assert.equal(job.jobClosed, true);
});

test("applicationToJobMatch fallback jobs Mongo si falta analysis", () => {
  const job = applicationToJobMatch(app({ analysis: undefined }), jobFallback);
  assert.equal(job.description, "Full JD from jobs collection");
  assert.deepEqual(job.matchedSkills, ["Playwright"]);
  assert.equal(job.summary, "Strong match from Mongo jobs");
});

test("resolveJobFallback une por LinkedIn jobId aunque jobs.id sea distinto", () => {
  const mongoJob: JobMatch = {
    ...jobFallback,
    id: "U2VuaW9yIEF1",
    url: "https://www.linkedin.com/jobs/search/?currentJobId=4429844674",
  };
  const fallback = resolveJobFallback(
    app({ jobId: "4429844674", analysis: undefined }),
    new Map(),
    new Map(),
    new Map([["4429844674", mongoJob]])
  );
  assert.equal(fallback?.description, "Full JD from jobs collection");
});

test("applicationToJobMatch stub histórico sin analysis ni fallback", () => {
  const job = applicationToJobMatch(
    app({
      analysis: undefined,
      inLatestAnalysis: false,
      estado: "Enviada",
      matchPercent: 72,
    }),
    null
  );
  assert.equal(job.location, "—");
  assert.match(job.summary, /último análisis/);
});

test("buildFeedbackEnvelope y applicationStatus compatibles con app.js", () => {
  const apps = [
    app({
      matchRejected: true,
      matchRejectedReason: "No QA",
      matchRejectedAt: "2026-07-25T11:00:00.000Z",
      analysis: { searchTerm: "devops" },
    }),
    app({ id: "2", jobId: "999", estado: "Enviada", updatedAt: "2026-07-25T12:00:00.000Z" }),
  ];

  const feedback = buildFeedbackEnvelope(apps);
  assert.equal(feedback.rejectionCount, 1);
  assert.deepEqual(feedback.rejectedJobIds, ["1234567890"]);
  assert.equal(feedback.rejections[0].reason, "No QA");

  const status = buildApplicationStatusEnvelope(apps);
  assert.equal(status.entries.length, 1);
  assert.equal(status.entries[0].status, "applied");
  assert.equal(status.entries[0].jobId, "999");
});

test("composeMatchJobsFromApplications incluye históricos y merge server-side", () => {
  const apps = [
    app({ inLatestAnalysis: true, matchPercent: 88 }),
    app({
      id: "hist-1",
      jobId: "hist-job",
      puesto: "QA histórico",
      empresa: "OldCo",
      matchPercent: 55,
      inLatestAnalysis: false,
      estado: "Enviada",
      analysis: undefined,
    }),
    app({
      id: "hist-2",
      jobId: "rej-job",
      matchPercent: 40,
      inLatestAnalysis: false,
      matchRejected: true,
      estado: "Stand-by",
    }),
    app({ estado: "Duplicado", matchPercent: 90 }),
  ];

  const response = composeMatchJobsFromApplications(
    apps,
    new Map(),
    new Map([[ "hist-job", jobFallback ]]),
    { scrapedAt: "2026-07-25T09:00:00.000Z", totalAnalyzed: 12 }
  );

  assert.equal(response.matchedJobs.length, 3);
  assert.equal(response.jobs.length, 3);
  assert.equal(response.totalAnalyzed, 12);
  assert.equal(response.feedback.rejectionCount, 1);
  assert.equal(response.applicationStatus.entries.length, 1);

  const historical = response.matchedJobs.find((j) => j.id === "hist-job");
  assert.ok(historical);
  assert.equal(historical!.description, "Full JD from jobs collection");

  const rejected = response.matchedJobs.find((j) => j.id === "rej-job");
  assert.ok(rejected);
  assert.match(rejected!.summary, /feedback/);
});

test("composeMatchJobsFromApplications filtra por query filter", () => {
  const apps = [
    app({ estado: "Pendiente" }),
    app({ id: "2", jobId: "2", estado: "Enviada" }),
    app({ id: "3", jobId: "3", matchRejected: true, estado: "Stand-by" }),
  ];

  const appliedOnly = composeMatchJobsFromApplications(
    apps,
    new Map(),
    new Map(),
    { scrapedAt: "2026-07-25T09:00:00.000Z", totalAnalyzed: 3 },
    { filter: "applied" }
  );

  assert.equal(appliedOnly.matchedJobs.length, 1);
  assert.equal(appliedOnly.matchedJobs[0].id, "2");
  assert.equal(appliedOnly.meta?.filter, "applied");
});

test("composeMatchJobsFromApplications oculta cerrados LinkedIn y filter=closed", () => {
  const apps = [
    app({ jobId: "open", inLatestAnalysis: true, matchPercent: 88 }),
    app({
      id: "closed-1",
      jobId: "closed-job",
      jobClosed: true,
      matchPercent: 92,
      inLatestAnalysis: true,
    }),
    app({ id: "2", jobId: "2", estado: "Cerrado", matchPercent: 80 }),
  ];

  const defaultView = composeMatchJobsFromApplications(
    apps,
    new Map(),
    new Map(),
    { scrapedAt: "2026-07-25T09:00:00.000Z", totalAnalyzed: 3 }
  );
  assert.equal(defaultView.matchedJobs.length, 2);
  assert.ok(!defaultView.matchedJobs.some((j) => j.id === "closed-job"));

  const closedOnly = composeMatchJobsFromApplications(
    apps,
    new Map(),
    new Map(),
    { scrapedAt: "2026-07-25T09:00:00.000Z", totalAnalyzed: 3 },
    { filter: "closed" }
  );
  assert.equal(closedOnly.matchedJobs.length, 1);
  assert.equal(closedOnly.matchedJobs[0].id, "closed-job");
  assert.equal(closedOnly.matchedJobs[0].jobClosed, true);
});
