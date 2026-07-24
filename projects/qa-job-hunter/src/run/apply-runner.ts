/**
 * Botonera spike (EPIC-JH-UI / #125) — lanzar Easy Apply desde dashboard.
 * Desacoplado de serve-dashboard: solo spawn + estado en output/.
 */

import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const HUNTER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const RUN_DIR = path.join(HUNTER_ROOT, "output", "run");
export const APPLY_RUN_STATE_PATH = path.join(RUN_DIR, "apply-run.json");
export const APPLY_RUN_LOG_PATH = path.join(RUN_DIR, "apply-run.log");

export type ApplyRunMode = "dry_run" | "productive";

export type ApplyRunRequest = {
  mode: ApplyRunMode;
  applyMax?: number;
  jobId?: string;
};

export type ApplyRunState = {
  status: "idle" | "running" | "done" | "error";
  mode?: ApplyRunMode;
  script?: string;
  pid?: number;
  startedAt?: string;
  finishedAt?: string;
  exitCode?: number | null;
  applyMax?: number;
  jobId?: string;
  logTail?: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

function ensureRunDir(): void {
  if (!fs.existsSync(RUN_DIR)) fs.mkdirSync(RUN_DIR, { recursive: true });
}

export function loadApplyRunState(): ApplyRunState {
  ensureRunDir();
  if (!fs.existsSync(APPLY_RUN_STATE_PATH)) return { status: "idle" };
  try {
    return JSON.parse(fs.readFileSync(APPLY_RUN_STATE_PATH, "utf-8")) as ApplyRunState;
  } catch {
    return { status: "idle" };
  }
}

function saveApplyRunState(state: ApplyRunState): void {
  ensureRunDir();
  fs.writeFileSync(APPLY_RUN_STATE_PATH, JSON.stringify(state, null, 2), "utf-8");
}

function tailLog(maxLines = 80): string {
  if (!fs.existsSync(APPLY_RUN_LOG_PATH)) return "";
  const lines = fs.readFileSync(APPLY_RUN_LOG_PATH, "utf-8").split(/\r?\n/);
  return lines.slice(-maxLines).join("\n").trim();
}

function isPidRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Refresca estado si el proceso terminó pero no se actualizó el JSON. */
export function refreshApplyRunState(): ApplyRunState {
  const state = loadApplyRunState();
  if (state.status === "running" && state.pid && !isPidRunning(state.pid)) {
    const next: ApplyRunState = {
      ...state,
      status: state.exitCode === 0 ? "done" : "error",
      finishedAt: state.finishedAt ?? nowIso(),
      logTail: tailLog(),
    };
    saveApplyRunState(next);
    return next;
  }
  if (state.status === "running") {
    return { ...state, logTail: tailLog() };
  }
  return { ...state, logTail: tailLog() };
}

export function startApplyRun(req: ApplyRunRequest): ApplyRunState {
  const current = refreshApplyRunState();
  if (current.status === "running") {
    throw new Error("Ya hay un Easy Apply en curso. Esperá a que termine.");
  }

  const mode = req.mode === "productive" ? "productive" : "dry_run";
  const script = mode === "dry_run" ? "easy-apply:dry-run" : "easy-apply";
  const applyMax =
    req.applyMax != null && Number.isFinite(req.applyMax) && req.applyMax > 0
      ? Math.floor(req.applyMax)
      : undefined;
  const jobId = (req.jobId || "").trim() || undefined;

  ensureRunDir();
  fs.writeFileSync(APPLY_RUN_LOG_PATH, "", "utf-8");

  const env = { ...process.env };
  if (mode === "dry_run") {
    env.DRY_RUN_MAX = String(applyMax ?? env.DRY_RUN_MAX ?? "10");
    delete env.APPLY_MAX;
    delete env.APPLY_JOB_ID;
    if (jobId) env.DRY_RUN_JOB_ID = jobId;
    else delete env.DRY_RUN_JOB_ID;
  } else {
    if (applyMax != null) env.APPLY_MAX = String(applyMax);
    else delete env.APPLY_MAX;
    if (jobId) env.APPLY_JOB_ID = jobId;
    else delete env.APPLY_JOB_ID;
    delete env.DRY_RUN_MAX;
    delete env.DRY_RUN_JOB_ID;
  }

  const logStream = fs.createWriteStream(APPLY_RUN_LOG_PATH, { flags: "a" });
  const child = spawn("npm", ["run", script], {
    cwd: HUNTER_ROOT,
    env,
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout?.on("data", (chunk) => logStream.write(chunk));
  child.stderr?.on("data", (chunk) => logStream.write(chunk));

  const startedAt = nowIso();
  const running: ApplyRunState = {
    status: "running",
    mode,
    script,
    pid: child.pid,
    startedAt,
    applyMax,
    jobId,
  };
  saveApplyRunState(running);

  child.on("close", (code) => {
    const finished: ApplyRunState = {
      ...running,
      status: code === 0 ? "done" : "error",
      finishedAt: nowIso(),
      exitCode: code,
      logTail: tailLog(),
    };
    saveApplyRunState(finished);
    logStream.end();
  });

  child.on("error", (err) => {
    logStream.write(`\n[spawn error] ${err.message}\n`);
    saveApplyRunState({
      ...running,
      status: "error",
      finishedAt: nowIso(),
      exitCode: null,
      logTail: tailLog(),
    });
    logStream.end();
  });

  return running;
}
