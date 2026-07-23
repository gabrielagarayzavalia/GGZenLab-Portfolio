import assert from "node:assert/strict";
import test from "node:test";
import {
  RESUME_INSIST_MS,
  isCoverAsResumeLabel,
  isPreferredResumeLabel,
  isValidResumeSelection,
  resolveResumeTimeoutOutcome,
} from "../../src/apply/resume-contract.js";

test("RESUME_INSIST_MS es 30s", () => {
  assert.equal(RESUME_INSIST_MS, 30_000);
});

test("isCoverAsResumeLabel: intro/cover", () => {
  assert.equal(isCoverAsResumeLabel("intro-GGZ.pdf"), true);
  assert.equal(isCoverAsResumeLabel("Cover letter QA"), true);
  assert.equal(
    isCoverAsResumeLabel("CV_Gabriela_Garay_Zavalia_QA_Automation.pdf"),
    false
  );
});

test("isValidResumeSelection: rechaza cover y vacío", () => {
  assert.equal(isValidResumeSelection(""), false);
  assert.equal(isValidResumeSelection("intro-GGZ"), false);
  assert.equal(
    isValidResumeSelection("CV_Gabriela_Garay_Zavalia_QA_Automation.pdf"),
    true
  );
});

test("isPreferredResumeLabel: score rol + fallback Eng01", () => {
  assert.equal(
    isPreferredResumeLabel(
      "CV_Gabriela_Garay_Zavalia_QA_Automation.pdf",
      "automation"
    ),
    true
  );
  assert.equal(
    isPreferredResumeLabel("CV_Gabriela_Garay_QA_Analyst.pdf", "automation"),
    false
  );
  assert.equal(isPreferredResumeLabel("Eng01-2026.pdf", "automation"), true);
});

test("resolveResumeTimeoutOutcome: dry_run no avanza", () => {
  const r = resolveResumeTimeoutOutcome(
    "dry_run",
    "Deselect resume Analyst.pdf",
    "automation"
  );
  assert.equal(r.outcome, "timeout_dry");
  assert.equal(r.canAdvance, false);
  assert.match(r.notes, /timeout 30s/i);
  assert.match(r.notes, /automation/i);
});

test("resolveResumeTimeoutOutcome: productive → Notas + no avanzar", () => {
  const r = resolveResumeTimeoutOutcome("productive", "(ninguno)", "analyst");
  assert.equal(r.outcome, "timeout_prod");
  assert.equal(r.canAdvance, false);
  assert.match(r.notes, /pendiente/i);
  assert.match(r.notes, /analyst/i);
});
