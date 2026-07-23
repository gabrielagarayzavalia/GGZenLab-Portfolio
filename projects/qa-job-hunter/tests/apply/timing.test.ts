import assert from "node:assert/strict";
import test from "node:test";
import { TIMING, betweenJobsDelayMs } from "../../src/apply/timing.js";

test("TIMING modal/submit más cortos que baseline histórico", () => {
  assert.ok(TIMING.modalStepMs < 1500);
  assert.ok(TIMING.afterSubmitMs < 2500);
  assert.ok(TIMING.networkIdleSoftMs <= 3000);
  assert.ok(TIMING.betweenJobsMinMs < 2000);
});

test("betweenJobsDelayMs en rango anti-ban reducido", () => {
  for (let i = 0; i < 20; i++) {
    const d = betweenJobsDelayMs();
    assert.ok(d >= TIMING.betweenJobsMinMs);
    assert.ok(d <= TIMING.betweenJobsMinMs + TIMING.betweenJobsJitterMs + 1);
  }
});
