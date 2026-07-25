import assert from "node:assert/strict";
import test from "node:test";
import {
  RESUME_ACCEPT_SCORE,
  RESUME_PREFERRED_SCORE,
  extractResumeMatchTokens,
  isResumeAlreadyOnLinkedIn,
  normalizeResumeBlob,
  resumeFilenamesMatch,
  scoreResumeByJobTitle,
  scoreResumeForJob,
} from "../../src/apply/resume-match.js";

test("normalizeResumeBlob: quita .pdf y separadores", () => {
  assert.equal(
    normalizeResumeBlob("CV_Gabriela_QA_Analyst.pdf"),
    "cv gabriela qa analyst"
  );
});

test("extractResumeMatchTokens: QA Analyst", () => {
  assert.deepEqual(extractResumeMatchTokens("Senior QA Analyst"), ["qa", "analyst"]);
});

test("extractResumeMatchTokens: QA Automation", () => {
  assert.deepEqual(extractResumeMatchTokens("QA Automation Engineer"), [
    "qa",
    "automation",
  ]);
});

test("scoreResumeByJobTitle: match parcial Analyst", () => {
  const score = scoreResumeByJobTitle(
    "CV_Gabriela_Garay_QA_Analyst.pdf",
    "QA Analyst"
  );
  assert.ok(score >= RESUME_PREFERRED_SCORE);
});

test("scoreResumeByJobTitle: no confunde Analyst con Automation", () => {
  const analystJob = "QA Analyst";
  assert.ok(
    scoreResumeByJobTitle("CV_QA_Automation.pdf", analystJob) < RESUME_ACCEPT_SCORE
  );
  assert.ok(
    scoreResumeByJobTitle("CV_QA_Analyst.pdf", analystJob) >= RESUME_ACCEPT_SCORE
  );
});

test("scoreResumeByJobTitle: match parcial Automation", () => {
  const score = scoreResumeByJobTitle(
    "CV_Gabriela_Garay_Zavalia_QA_Automation.pdf",
    "QA Automation Engineer"
  );
  assert.ok(score >= RESUME_PREFERRED_SCORE);
});

test("resumeFilenamesMatch: mismo archivo Config y LinkedIn", () => {
  assert.equal(
    resumeFilenamesMatch(
      "CV_Gabriela_QA_Analyst.pdf",
      "CV Gabriela QA Analyst.pdf"
    ),
    true
  );
});

test("isResumeAlreadyOnLinkedIn: sin config retorna false", () => {
  assert.equal(isResumeAlreadyOnLinkedIn("cualquier.pdf"), false);
});
