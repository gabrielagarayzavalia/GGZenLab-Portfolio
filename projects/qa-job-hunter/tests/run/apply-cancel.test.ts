/**
 * process-tree-kill + cancelApplyRun (#324)
 */
import assert from "node:assert/strict";
import test from "node:test";
import { cancelApplyRun, loadApplyRunState } from "../../src/run/apply-runner.js";
import { killProcessTree } from "../../src/run/process-tree-kill.js";

test("killProcessTree con PID inválido → ok false", () => {
  const r = killProcessTree(0);
  assert.equal(r.ok, false);
});

test("cancelApplyRun sin corrida → error", () => {
  const s = loadApplyRunState();
  if (s.status === "running") {
    assert.throws(() => cancelApplyRun(), /No hay/);
  } else {
    assert.throws(() => cancelApplyRun(), /No hay Easy Apply en curso/);
  }
});
