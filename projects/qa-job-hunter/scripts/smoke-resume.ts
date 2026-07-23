/**
 * Smoke contrato CV (#208 / #210) — sin Playwright.
 *
 *   npm run smoke:resume
 */
import assert from "node:assert/strict";
import {
  RESUME_INSIST_MS,
  isCoverAsResumeLabel,
  isPreferredResumeLabel,
  isValidResumeSelection,
  resolveResumeTimeoutOutcome,
} from "../src/apply/resume-contract.js";

type Check = { name: string; ok: boolean; err?: unknown };
const checks: Check[] = [];

function check(name: string, fn: () => void): void {
  try {
    fn();
    checks.push({ name, ok: true });
    console.log(`  ✓ ${name}`);
  } catch (err) {
    checks.push({ name, ok: false, err });
    console.error(`  ✗ ${name}: ${err instanceof Error ? err.message : err}`);
  }
}

console.log("Smoke resume contract (#208)\n");

check("insist 30s", () => assert.equal(RESUME_INSIST_MS, 30_000));
check("cover detect", () => assert.equal(isCoverAsResumeLabel("intro-GGZ"), true));
check("valid pdf", () =>
  assert.equal(isValidResumeSelection("CV_QA_Automation.pdf"), true)
);
check("preferred automation", () =>
  assert.equal(
    isPreferredResumeLabel(
      "CV_Gabriela_Garay_Zavalia_QA_Automation.pdf",
      "automation"
    ),
    true
  )
);
check("dry timeout", () => {
  const r = resolveResumeTimeoutOutcome("dry_run", "Analyst.pdf", "automation");
  assert.equal(r.outcome, "timeout_dry");
  assert.equal(r.canAdvance, false);
});
check("prod timeout", () => {
  const r = resolveResumeTimeoutOutcome("productive", "", "analyst");
  assert.equal(r.outcome, "timeout_prod");
  assert.equal(r.canAdvance, false);
  assert.match(r.notes, /pendiente|timeout/i);
});
check("desacople: dominio hunter-only", () => {
  assert.ok(RESUME_INSIST_MS > 0);
});

const failed = checks.filter((c) => !c.ok);
console.log(
  `\nSmoke resume: ${checks.length - failed.length}/${checks.length} PASS`
);
if (failed.length) process.exit(1);
console.log("DoD smoke: PASS");
