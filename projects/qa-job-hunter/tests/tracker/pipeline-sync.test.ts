import test from "node:test";

import assert from "node:assert/strict";

import {

  canalFromPipelineMatch,

  DASHBOARD_MIN_MATCH,

<<<<<<< HEAD
  isScrapedJobClosed,

  analysisSnapshotFromPipelineMatch,
  matchedSkillsForSnapshot,

=======
>>>>>>> origin/main
  notasFromSummary,

  PIPELINE_MIN_MATCH,

  pipelineMatchToApplicationInput,

<<<<<<< HEAD
  shouldIngestClosedApplication,

=======
>>>>>>> origin/main
  shouldSyncPipelineMatch,

} from "../../src/tracker/pipeline-match.js";

import { isProtectedEstado } from "../../src/tracker/protected-estado.js";

import { isTrackerDualWriteEnabled } from "../../src/tracker/pipeline-sync.js";



const baseMatch = {

  jobId: "1234567890",

  company: "Acme",

  title: "QA Engineer",

  url: "https://www.linkedin.com/jobs/view/1234567890/",

  matchPercent: 80,

  recommendation: "apply" as const,

  easyApply: true,

  applyType: "easy_apply" as const,

};



test("umbrales pipeline 65 vs dashboard 70 documentados", () => {

  assert.equal(PIPELINE_MIN_MATCH, 65);

  assert.equal(DASHBOARD_MIN_MATCH, 70);

});



test("shouldSyncPipelineMatch excluye skip bajo umbral", () => {

  assert.equal(shouldSyncPipelineMatch({ ...baseMatch, recommendation: "skip", matchPercent: 50 }), false);

  assert.equal(shouldSyncPipelineMatch({ ...baseMatch, recommendation: "skip", matchPercent: 70 }), true);

});



<<<<<<< HEAD
const closedScrape = {
  jobId: baseMatch.jobId,
  url: baseMatch.url,
  title: baseMatch.title,
  company: baseMatch.company,
  jobClosed: true,
  acceptingApplications: false,
};

test("isScrapedJobClosed detecta jobClosed y acceptingApplications", () => {
  assert.equal(isScrapedJobClosed(closedScrape), true);
  assert.equal(isScrapedJobClosed({ ...closedScrape, jobClosed: false, acceptingApplications: true }), false);
  assert.equal(isScrapedJobClosed(undefined), false);
});

test("shouldIngestClosedApplication gate insert (#408)", () => {
  // Nuevo + cerrado al scrape → no insertar
  assert.equal(shouldIngestClosedApplication(baseMatch, closedScrape, null), false);
  assert.equal(shouldIngestClosedApplication(baseMatch, closedScrape, undefined), false);

  // Existente + cerrado → update permitido
  assert.equal(
    shouldIngestClosedApplication(baseMatch, closedScrape, { jobId: baseMatch.jobId }),
    true
  );

  // Nuevo + abierto → insertar
  assert.equal(
    shouldIngestClosedApplication(baseMatch, { ...closedScrape, jobClosed: false, acceptingApplications: true }, null),
    true
  );

  // Nuevo sin señal de cierre en scrape → insertar (conservador)
  assert.equal(shouldIngestClosedApplication(baseMatch, undefined, null), true);
});



=======
>>>>>>> origin/main
test("canalFromPipelineMatch", () => {

  assert.equal(canalFromPipelineMatch(baseMatch), "Easy Apply");

  assert.equal(

    canalFromPipelineMatch({ ...baseMatch, easyApply: false, applyType: "external" }),

    "Externo"

  );

});



test("pipelineMatchToApplicationInput mapea campos core y summary", () => {
  const input = pipelineMatchToApplicationInput({
    ...baseMatch,
    matchPercent: 85,
    summary: "Buen match en automation y API testing",
    matchedSkills: ["Playwright", "API testing"],
    gaps: ["AWS"],
    cvSuggestions: ["Destacar CI/CD"],
  });

  assert.equal(input.jobId, "1234567890");
  assert.equal(input.puesto, "QA Engineer");
  assert.equal(input.estado, "Pendiente");
  assert.equal(input.updatedBy, "pipeline");
  assert.equal(input.notas, "Buen match en automation y API testing");
  assert.equal(input.inLatestAnalysis, true);
  assert.equal(input.analysis?.matchedSkills?.[0], "Playwright");
});

test("pipelineMatchToApplicationInput con scrape incluye description", () => {
  const input = pipelineMatchToApplicationInput(
    {
      ...baseMatch,
      matchPercent: 88,
      matchedSkills: ["Selenium"],
      summary: "Fit sólido",
    },
    {
      jobId: "1234567890",
      url: baseMatch.url,
      title: "QA",
      company: "Acme",
      description: "About the job We need a QA engineer with Selenium.",
      location: "Remote",
      modality: "Remote",
      datePosted: "1d",
    }
  );
  assert.match(input.analysis?.description ?? "", /About the job/);
  assert.equal(input.analysis?.location, "Remote");
});

test("pipelineMatchToApplicationInput propaga jobClosed desde scrape", () => {
  const input = pipelineMatchToApplicationInput(
    {
      ...baseMatch,
      matchPercent: 88,
      matchedSkills: ["Selenium"],
      summary: "Fit sólido",
    },
    {
      jobId: "1234567890",
      url: baseMatch.url,
      title: "QA",
      company: "Acme",
      description: "About the job We need a QA engineer.",
      jobClosed: true,
      acceptingApplications: false,
    }
  );
  assert.equal(input.jobClosed, true);
  assert.equal(input.acceptingApplications, false);
  assert.equal(input.analysis?.jobClosed, true);
  assert.equal(input.analysis?.acceptingApplications, false);
});

test("pipelineMatchToApplicationInput parsea jdSections desde scrape (#370)", () => {
  const description = `Intro

What We're Looking For
• 4+ years Manual QA
• Advanced English

Nice To Have
• Cursor

What We Offer
• 100% remote`;

  const input = pipelineMatchToApplicationInput(
    { ...baseMatch, matchPercent: 88, matchedSkills: ["QA"] },
    {
      jobId: baseMatch.jobId,
      url: baseMatch.url,
      title: baseMatch.title,
      company: baseMatch.company,
      description,
    }
  );

  assert.ok(input.analysis?.jdSections);
  assert.equal(input.analysis?.jdSections?.requirements.length, 2);
  assert.ok(input.analysis?.jdSections?.requirements.some((b) => /Manual QA/i.test(b)));
  assert.equal(input.analysis?.jdSections?.niceToHave.length, 1);
  assert.equal(input.analysis?.jdSections?.whatWeOffer.length, 1);
});



test("notasFromSummary trunca líneas largas", () => {

  const long = "x".repeat(250);

  const notas = notasFromSummary(long);

  assert.ok(notas && notas.length <= 200);

  assert.ok(notas?.endsWith("..."));

});



test("isProtectedEstado alinea con Excel", () => {

  assert.equal(isProtectedEstado("Enviada"), true);

  assert.equal(isProtectedEstado("Stand-by"), true);

  assert.equal(isProtectedEstado("Descartado"), true);

  assert.equal(isProtectedEstado("Pendiente"), false);

});



test("isTrackerDualWriteEnabled respeta env", () => {

  const prevDw = process.env.TRACKER_DUAL_WRITE;

  const prevLegacy = process.env.TRACKER_DUAL_WRITE_PIPELINE;

  delete process.env.TRACKER_DUAL_WRITE_PIPELINE;

  process.env.TRACKER_DUAL_WRITE = "0";

  assert.equal(isTrackerDualWriteEnabled(), false);

  process.env.TRACKER_DUAL_WRITE = "1";

  assert.equal(isTrackerDualWriteEnabled(), true);

  delete process.env.TRACKER_DUAL_WRITE;

  process.env.TRACKER_DUAL_WRITE_PIPELINE = "0";

  assert.equal(isTrackerDualWriteEnabled(), false);

  if (prevDw === undefined) delete process.env.TRACKER_DUAL_WRITE;

  else process.env.TRACKER_DUAL_WRITE = prevDw;

  if (prevLegacy === undefined) delete process.env.TRACKER_DUAL_WRITE_PIPELINE;

  else process.env.TRACKER_DUAL_WRITE_PIPELINE = prevLegacy;

});

<<<<<<< HEAD
test("matchedSkillsForSnapshot fallback sin labels (#335)", () => {
  const skills = matchedSkillsForSnapshot({
    jobId: "x",
    company: "Co",
    title: "QA",
    url: "https://example.com",
    matchPercent: 100,
    matchedSkills: [],
    gaps: [],
    summary: "Encaje sólido (100%) — CV automation.",
    recommendation: "apply",
    easyApply: true,
  });
  assert.ok(skills?.length);
  assert.match(skills![0], /automation/i);
});

test("analysisSnapshotFromPipelineMatch con summary sin description (#335)", () => {
  const snap = analysisSnapshotFromPipelineMatch(
    {
      jobId: "x",
      company: "Co",
      title: "QA",
      url: "https://example.com",
      matchPercent: 95,
      matchedSkills: ["Playwright"],
      gaps: [],
      summary: "Encaje sólido (95%) — CV automation.",
      recommendation: "apply",
      easyApply: true,
    },
    null
  );
  assert.ok(snap);
  assert.deepEqual(snap?.matchedSkills, ["Playwright"]);
});
=======
>>>>>>> origin/main
