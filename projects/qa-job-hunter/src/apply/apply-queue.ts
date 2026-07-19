// Cola Easy Apply en CSV (Excel).
// Estados: pendiente | enviada | cerrada | descartada
// Archivo: output/apply/apply-queue.csv (+ sync jobs-result.csv).

import fs from "fs";
import path from "path";
import { APPLY_DIR, MIN_MATCH, OUTPUT_PATH } from "./paths.js";
import type { ApplyJob } from "./types.js";
import type { AnalysisResult, JobMatch } from "../types.js";

/** Estados de postulación en Excel. cerrada/descartada son finales. */
export type QueueStatus = "pendiente" | "enviada" | "cerrada" | "descartada";

export interface QueueRow {
  jobId: string;
  title: string;
  company: string;
  url: string;
  matchPercent: number;
  easyApply: "" | "yes" | "no";
  status: QueueStatus;
  reason: string;
  /** Preguntas nuevas / assessment / hints para el Excel (columna Notas). */
  notes: string;
  updatedAt: string;
}

export const APPLY_QUEUE_PATH = path.join(APPLY_DIR, "apply-queue.csv");

const FINAL_STATUSES: QueueStatus[] = ["cerrada", "descartada"];

const HEADERS = [
  "JobId",
  "Match%",
  "Title",
  "Company",
  "URL",
  "EasyApply",
  "ApplyStatus",
  "Reason",
  "Notes",
  "UpdatedAt",
];

function escapeCell(v: string | number): string {
  const s = String(v ?? "");
  if (/[;"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') inQ = false;
      else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ";") {
      cells.push(cur);
      cur = "";
    } else cur += ch;
  }
  cells.push(cur);
  return cells;
}

/** Normaliza estados legacy (pending/applied/closed/…) al vocabulario actual. */
export function normalizeStatus(raw: string): QueueStatus {
  const s = (raw || "").trim().toLowerCase();
  if (s === "enviada" || s === "applied" || s === "submitted") return "enviada";
  // dry_ok legacy = prueba sin enviar → pendiente
  if (s === "dry_ok" || s === "pendiente" || s === "pending" || s === "blocked" || s === "") {
    return "pendiente";
  }
  if (s === "cerrada" || s === "closed") return "cerrada";
  if (s === "descartada" || s === "discarded" || s === "skipped") return "descartada";
  return "pendiente";
}

export function isFinalStatus(status: QueueStatus): boolean {
  return FINAL_STATUSES.includes(status);
}

/** Preferir currentJobId numérico de LinkedIn; el campo id del scrape a veces es basura. */
export function jobIdFromUrl(url: string): string {
  const m = url.match(/currentJobId=(\d+)/) || url.match(/\/jobs\/view\/(\d+)/);
  return m?.[1] ?? "";
}

export function canonicalJobUrl(url: string, fallbackId?: string): string {
  const id = jobIdFromUrl(url) || (fallbackId && /^\d+$/.test(fallbackId) ? fallbackId : "");
  if (id) return `https://www.linkedin.com/jobs/view/${id}/`;
  return url;
}

export function loadQueue(): QueueRow[] {
  if (!fs.existsSync(APPLY_QUEUE_PATH)) return [];
  const lines = fs.readFileSync(APPLY_QUEUE_PATH, "utf-8").split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  return lines.slice(1).map((line) => {
    const c = parseCsvLine(line);
    const rawStatus = c[6] ?? "pendiente";
    // dry_ok legacy → pendiente (nunca fue enviada)
    const status =
      rawStatus.trim().toLowerCase() === "dry_ok" ? "pendiente" : normalizeStatus(rawStatus);
    // Schema nuevo: Reason;Notes;UpdatedAt — legacy: Reason;UpdatedAt
    const looksLikeIso = (s: string) => /^\d{4}-\d{2}-\d{2}T/.test((s || "").trim());
    let reason = c[7] ?? "";
    let notes = "";
    let updatedAt = c[8] ?? "";
    if (c.length >= 10 || (c[8] && !looksLikeIso(c[8]) && looksLikeIso(c[9] ?? ""))) {
      notes = c[8] ?? "";
      updatedAt = c[9] ?? "";
    } else if (looksLikeIso(c[8] ?? "")) {
      updatedAt = c[8] ?? "";
    } else {
      notes = c[8] ?? "";
      updatedAt = c[9] ?? "";
    }
    return {
      jobId: c[0] ?? "",
      matchPercent: Number(c[1] || 0),
      title: c[2] ?? "",
      company: c[3] ?? "",
      url: c[4] ?? "",
      easyApply: (c[5] as QueueRow["easyApply"]) || "",
      status,
      reason,
      notes,
      updatedAt,
    };
  });
}

export function saveQueue(rows: QueueRow[]): void {
  fs.mkdirSync(APPLY_DIR, { recursive: true });
  const body = [
    HEADERS.join(";"),
    ...rows.map((r) =>
      [
        r.jobId,
        r.matchPercent,
        escapeCell(r.title),
        escapeCell(r.company),
        escapeCell(r.url),
        r.easyApply,
        r.status,
        escapeCell(r.reason),
        escapeCell(r.notes ?? ""),
        r.updatedAt,
      ].join(";")
    ),
  ].join("\n");
  fs.writeFileSync(APPLY_QUEUE_PATH, body, "utf-8");
  syncJobsResultCsv(rows);
}

/** Inicializa o mergea la cola desde matched jobs del pipeline. */
export function ensureQueueFromMatched(): QueueRow[] {
  const existing = loadQueue();
  const byId = new Map(existing.map((r) => [r.jobId, r]));

  if (!fs.existsSync(OUTPUT_PATH)) {
    if (existing.length === 0) {
      throw new Error(`Falta ${OUTPUT_PATH}. Ejecutá npm run analyze primero.`);
    }
    return existing;
  }

  const raw = JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf-8"));
  const matches: JobMatch[] = Array.isArray(raw)
    ? raw
    : ((raw as AnalysisResult).matchedJobs ?? []);

  for (const m of matches.filter((j) => j.matchPercent >= MIN_MATCH)) {
    const id = jobIdFromUrl(m.url) || (/^\d+$/.test(m.id) ? m.id : "");
    if (!id) continue;
    if (byId.has(id)) continue;
    byId.set(id, {
      jobId: id,
      title: m.title,
      company: m.company,
      url: canonicalJobUrl(m.url, id),
      matchPercent: m.matchPercent,
      easyApply: "",
      status: "pendiente",
      reason: "",
      notes: "",
      updatedAt: new Date().toISOString(),
    });
  }

  const rows = [...byId.values()].sort((a, b) => b.matchPercent - a.matchPercent);
  saveQueue(rows);
  return rows;
}

/**
 * Actualiza una fila. No pisa estados finales (cerrada / descartada).
 * Para marcar enviada desde UI Applied, usar markEnviadaIfAllowed.
 */
export function updateQueueRow(
  jobId: string,
  patch: Partial<Pick<QueueRow, "easyApply" | "status" | "reason" | "notes">>
): QueueRow[] {
  const rows = loadQueue();
  const idx = rows.findIndex((r) => r.jobId === jobId);
  if (idx < 0) return rows;

  if (isFinalStatus(rows[idx].status)) {
    // Solo permitir actualizar reason/easyApply, no el status final.
    const { status: _ignore, ...rest } = patch;
    rows[idx] = {
      ...rows[idx],
      ...rest,
      updatedAt: new Date().toISOString(),
    };
    saveQueue(rows);
    return rows;
  }

  rows[idx] = {
    ...rows[idx],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  saveQueue(rows);
  return rows;
}

/** Marca enviada solo si el estado actual no es cerrada/descartada. */
export function markEnviadaIfAllowed(jobId: string, reason: string): boolean {
  const rows = loadQueue();
  const row = rows.find((r) => r.jobId === jobId);
  if (!row) return false;
  if (isFinalStatus(row.status)) return false;
  updateQueueRow(jobId, { status: "enviada", reason, easyApply: row.easyApply || "yes" });
  return true;
}

/**
 * Siguiente pendiente.
 * Orden: easyApply=yes → unknown → no (reintento).
 * `excludeJobIds` evita re-tomar el mismo aviso en la misma corrida.
 */
export function nextPending(
  preferKnownEasyApply = true,
  excludeJobIds: Set<string> = new Set()
): QueueRow | null {
  const rows = loadQueue().filter(
    (r) => r.status === "pendiente" && !excludeJobIds.has(r.jobId)
  );
  if (rows.length === 0) return null;
  if (preferKnownEasyApply) {
    const known = rows.find((r) => r.easyApply === "yes");
    if (known) return known;
    const unknown = rows.find((r) => r.easyApply === "");
    if (unknown) return unknown;
  }
  return rows[0] ?? null;
}

export function toApplyJob(row: QueueRow): ApplyJob {
  return {
    jobId: row.jobId,
    company: row.company,
    title: row.title,
    url: canonicalJobUrl(row.url, row.jobId),
    matchPercent: row.matchPercent,
    summary: "",
  };
}

/** Regenera la cola desde matched (descarta filas con jobId no numérico). */
export function rebuildQueueFromMatched(): QueueRow[] {
  if (fs.existsSync(APPLY_QUEUE_PATH)) fs.unlinkSync(APPLY_QUEUE_PATH);
  return ensureQueueFromMatched();
}

function syncJobsResultCsv(rows: QueueRow[]): void {
  const csvPath = OUTPUT_PATH.replace(/\.json$/i, ".csv");
  if (!fs.existsSync(csvPath)) return;

  const lines = fs.readFileSync(csvPath, "utf-8").split(/\r?\n/);
  if (lines.length === 0) return;

  const headerCells = parseCsvLine(lines[0]);
  let statusIdx = headerCells.findIndex((h) => /^ApplyStatus$/i.test(h.trim()));
  let easyIdx = headerCells.findIndex((h) => /^EasyApply$/i.test(h.trim()));

  if (statusIdx < 0) {
    headerCells.push("EasyApply", "ApplyStatus");
    easyIdx = headerCells.length - 2;
    statusIdx = headerCells.length - 1;
  }

  const byUrlId = new Map<string, QueueRow>();
  for (const r of rows) byUrlId.set(r.jobId, r);

  const out = [headerCells.map(escapeCell).join(";")];
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const cells = parseCsvLine(line);
    while (cells.length < headerCells.length) cells.push("");
    const url = cells.find((c) => c.includes("linkedin.com/jobs")) ?? "";
    const id = jobIdFromUrl(url);
    const q = byUrlId.get(id);
    if (q) {
      cells[easyIdx] = q.easyApply;
      cells[statusIdx] = q.status;
    }
    out.push(cells.map(escapeCell).join(";"));
  }
  fs.writeFileSync(csvPath, out.join("\n"), "utf-8");
}
