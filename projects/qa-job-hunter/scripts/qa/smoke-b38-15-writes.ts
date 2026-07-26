/**
 * Smoke B-38-15 — writes dashboard → Mongo (#314).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const BASE = process.env.DASHBOARD_URL ?? "http://localhost:3847";
const HEADERS = { "Content-Type": "application/json", "X-Tracker-User": "1" };

type Check = { name: string; pass: boolean; detail: string };

async function json(
  url: string,
  init?: RequestInit
): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, body };
}

async function main(): Promise<void> {
  const checks: Check[] = [];
  const started = new Date();

  const health = await fetch(`${BASE}/api/dashboard/match-jobs`, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!health.ok) {
    checks.push({
      name: "Dashboard up",
      pass: false,
      detail: `GET match-jobs HTTP ${health.status}`,
    });
    writeReport(checks, started);
    process.exit(1);
  }
  checks.push({ name: "Dashboard up", pass: true, detail: `HTTP ${health.status}` });

  const rejectProbe = await json(`${BASE}/api/dashboard/reject-match`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ jobId: "__smoke_probe__" }),
  });
  checks.push({
    name: "Ruta reject-match existe",
    pass: rejectProbe.status === 404,
    detail: `HTTP ${rejectProbe.status} (404 esperado sin job)`,
  });

  const list = (await health.json()) as {
    matchedJobs?: Array<{ id: string; applicationId?: string; title?: string }>;
  };
  const job = (list.matchedJobs ?? []).find((j) => j.applicationId);
  if (!job?.applicationId) {
    checks.push({
      name: "Job con applicationId",
      pass: false,
      detail: "Sin jobs con applicationId — npm run tracker:seed",
    });
    writeReport(checks, started);
    process.exit(1);
  }

  const applied = await json(`${BASE}/api/dashboard/application-status`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({
      applicationId: job.applicationId,
      jobId: job.id,
      status: "applied",
    }),
  });
  const appliedEstado = (applied.body.application as { estado?: string } | undefined)?.estado;
  checks.push({
    name: "POST application-status → Enviada",
    pass: applied.status === 200 && appliedEstado === "Enviada",
    detail: `HTTP ${applied.status} estado=${appliedEstado ?? "?"}`,
  });

  const unmark = await json(`${BASE}/api/dashboard/application-status`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({
      applicationId: job.applicationId,
      jobId: job.id,
      status: null,
    }),
  });
  const unmarkEstado = (unmark.body.application as { estado?: string } | undefined)?.estado;
  checks.push({
    name: "Desmarcar desde Enviada → Pendiente",
    pass: unmark.status === 200 && unmarkEstado === "Pendiente",
    detail: `HTTP ${unmark.status} estado=${unmarkEstado ?? "?"}`,
  });

  const reject = await json(`${BASE}/api/dashboard/reject-match`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ jobId: job.id, reason: "smoke B38-15" }),
  });
  const rejected = (reject.body.application as { matchRejected?: boolean } | undefined)?.matchRejected;
  checks.push({
    name: "POST reject-match",
    pass: reject.status === 200 && rejected === true,
    detail: `HTTP ${reject.status} matchRejected=${rejected}`,
  });

  const undo = await json(`${BASE}/api/dashboard/reject-match/${encodeURIComponent(job.id)}`, {
    method: "DELETE",
    headers: HEADERS,
  });
  const undone = (undo.body.application as { matchRejected?: boolean } | undefined)?.matchRejected;
  checks.push({
    name: "DELETE reject-match (undo)",
    pass: undo.status === 200 && undone === false,
    detail: `HTTP ${undo.status} matchRejected=${undone}`,
  });

  const tracker = await json(`${BASE}/api/tracker/applications/${job.applicationId}`, {
    headers: { "X-Tracker-User": "1" },
  });
  const trackerEstado = (tracker.body as { estado?: string; matchRejected?: boolean }).estado;
  const trackerRejected = (tracker.body as { matchRejected?: boolean }).matchRejected;
  checks.push({
    name: "GET tracker coherente post-smoke",
    pass: tracker.status === 200 && trackerEstado === "Pendiente" && trackerRejected === false,
    detail: `estado=${trackerEstado} matchRejected=${trackerRejected}`,
  });

  writeReport(checks, started);
  process.exit(checks.every((c) => c.pass) ? 0 : 1);
}

function writeReport(checks: Check[], started: Date): void {
  const pass = checks.every((c) => c.pass);
  const reportPath = path.join(ROOT, "local", "reports", "b38-15-smoke-writes.md");
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  const lines = [
    "# Smoke B-38-15 — dashboard writes",
    "",
    `**Fecha:** ${started.toISOString()}`,
    `**URL:** ${BASE}`,
    `**Veredicto:** ${pass ? "✅ PASS" : "❌ FAIL"}`,
    "",
    "| Check | Resultado | Detalle |",
    "|-------|-----------|---------|",
    ...checks.map(
      (c) => `| ${c.name} | ${c.pass ? "PASS" : "FAIL"} | ${c.detail.replace(/\|/g, "/")} |`
    ),
    "",
  ];
  fs.writeFileSync(reportPath, lines.join("\n"), "utf-8");
  console.log(lines.join("\n"));
  console.log(`\n📄 Informe: ${reportPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
