import test from "node:test";
import assert from "node:assert/strict";
import {
  canalFromPipelineMatch,
  pipelineMatchToApplicationInput,
  shouldSyncPipelineMatch,
} from "../../src/tracker/pipeline-match.js";
import { isProtectedEstado } from "../../src/tracker/protected-estado.js";
import { isPipelineDualWriteEnabled } from "../../src/tracker/sync-pipeline-matches.js";

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

test("shouldSyncPipelineMatch excluye skip bajo umbral", () => {
  assert.equal(shouldSyncPipelineMatch({ ...baseMatch, recommendation: "skip", matchPercent: 50 }), false);
  assert.equal(shouldSyncPipelineMatch({ ...baseMatch, recommendation: "skip", matchPercent: 70 }), true);
});

test("canalFromPipelineMatch", () => {
  assert.equal(canalFromPipelineMatch(baseMatch), "Easy Apply");
  assert.equal(
    canalFromPipelineMatch({ ...baseMatch, easyApply: false, applyType: "external" }),
    "Externo"
  );
});

test("pipelineMatchToApplicationInput mapea campos core", () => {
  const input = pipelineMatchToApplicationInput(baseMatch);
  assert.equal(input.jobId, "1234567890");
  assert.equal(input.puesto, "QA Engineer");
  assert.equal(input.estado, "Pendiente");
  assert.equal(input.updatedBy, "pipeline");
});

test("isProtectedEstado alinea con Excel", () => {
  assert.equal(isProtectedEstado("Enviada"), true);
  assert.equal(isProtectedEstado("Stand-by"), true);
  assert.equal(isProtectedEstado("Descartado"), true);
  assert.equal(isProtectedEstado("Pendiente"), false);
});

test("isPipelineDualWriteEnabled respeta env", () => {
  const prev = process.env.TRACKER_DUAL_WRITE_PIPELINE;
  process.env.TRACKER_DUAL_WRITE_PIPELINE = "0";
  assert.equal(isPipelineDualWriteEnabled(), false);
  process.env.TRACKER_DUAL_WRITE_PIPELINE = "1";
  assert.equal(isPipelineDualWriteEnabled(), true);
  if (prev === undefined) delete process.env.TRACKER_DUAL_WRITE_PIPELINE;
  else process.env.TRACKER_DUAL_WRITE_PIPELINE = prev;
});
