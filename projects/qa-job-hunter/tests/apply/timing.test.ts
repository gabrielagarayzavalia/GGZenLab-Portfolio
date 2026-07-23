import assert from "node:assert/strict";
import test from "node:test";
import {
  PERF,
  TIMING,
  ModalPageTimer,
  betweenJobsDelayMs,
  verdictForModalPageMs,
} from "../../src/apply/timing.js";

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

test("verdictForModalPageMs: budget 25s / fail 45s", () => {
  assert.equal(verdictForModalPageMs(10_000), "pass");
  assert.equal(verdictForModalPageMs(25_000), "pass");
  assert.equal(verdictForModalPageMs(25_001), "over_budget");
  assert.equal(verdictForModalPageMs(45_000), "over_budget");
  assert.equal(verdictForModalPageMs(45_001), "fail");
  assert.equal(PERF.modalPageBudgetMs, 25_000);
  assert.equal(PERF.modalPageFailMs, 45_000);
});

test("ModalPageTimer acumula samples sin failHard", () => {
  const t = new ModalPageTimer({ failHard: false });
  t.start("a");
  // forzar duración sintética vía end inmediato (pass)
  t.end();
  assert.ok(t.samples.length >= 1);
  assert.equal(t.samples[0].label, "a");
});
