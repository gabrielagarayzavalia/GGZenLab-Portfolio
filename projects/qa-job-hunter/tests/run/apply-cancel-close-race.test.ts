/**
 * #353 — cancel persiste cancelled aunque close llegue con exit ≠ 0.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const HUNTER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const RUN_DIR = path.join(HUNTER_ROOT, "output", "run");
const APPLY_RUN_STATE_PATH = path.join(RUN_DIR, "apply-run.json");
const APPLY_RUN_LOG_PATH = path.join(RUN_DIR, "apply-run.log");

function fakeChild(pid: number) {
  const child = new EventEmitter() as EventEmitter & {
    pid: number;
    killed: boolean;
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: (sig?: string) => void;
  };
  child.pid = pid;
  child.killed = false;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = () => {
    child.killed = true;
  };
  return child;
}

function cleanupRunArtifacts(): void {
  for (const p of [APPLY_RUN_STATE_PATH, APPLY_RUN_LOG_PATH]) {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}

test("cancel + close con exit ≠ 0 → estado final cancelled", async () => {
  cleanupRunArtifacts();
  const sleeper = spawn(process.execPath, ["-e", "setTimeout(() => {}, 60000)"], {
    stdio: "ignore",
  });
  const child = fakeChild(sleeper.pid ?? process.pid);

  const {
    __testSetSpawnOverride,
    startApplyRun,
    cancelApplyRun,
    loadApplyRunState,
  } = await import("../../src/run/apply-runner.js");

  __testSetSpawnOverride(() => child as never);

  try {
    startApplyRun({ mode: "dry_run", applyMax: 1 });
    const cancelled = cancelApplyRun();
    assert.equal(cancelled.status, "cancelled");
    assert.equal(cancelled.exitCode, null);

    child.emit("close", 1);

    const final = loadApplyRunState();
    assert.equal(final.status, "cancelled");
    assert.equal(final.exitCode, null);
  } finally {
    __testSetSpawnOverride(null);
    try {
      sleeper.kill("SIGKILL");
    } catch {
      /* ignore */
    }
    cleanupRunArtifacts();
  }
});
