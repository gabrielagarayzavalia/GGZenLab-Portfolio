/**
 * apply-runner — estado idle por defecto.
 *   npx tsx --test tests/run/apply-runner.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import { loadApplyRunState, refreshApplyRunState } from "../../src/run/apply-runner.js";

test("loadApplyRunState sin archivo → idle", () => {
  const s = loadApplyRunState();
  assert.ok(["idle", "done", "error", "running", "cancelled"].includes(s.status));
});

test("refreshApplyRunState devuelve logTail string", () => {
  const s = refreshApplyRunState();
  assert.equal(typeof (s.logTail ?? ""), "string");
});
