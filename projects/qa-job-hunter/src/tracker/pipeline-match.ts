import type { UpsertApplicationInput } from "../db/applications.js";

/** Subconjunto de qa-job-applied-list MatchResult (`scripts/types.ts`). */
export interface PipelineMatchResult {
  jobId: string;
  company: string;
  title: string;
  url: string;
  gmailId?: string;
  matchPercent: number;
  cvType?: string;
  summary?: string;
  recommendation: "apply" | "apply_manual" | "skip";
  applyType?: "easy_apply" | "external" | "unknown";
  easyApply?: boolean;
}

/** Umbral pipeline/Excel (applied-list sync-excel). */
export const PIPELINE_MIN_MATCH = 65;
/** Umbral previsto dashboard match-jobs (#311); no filtra este sync. */
export const DASHBOARD_MIN_MATCH = 70;

const MAX_NOTA_SUMMARY = 200;

/** Línea corta de summary → notas (sin campo analysis — eso es #312). */
export function notasFromSummary(summary?: string): string | undefined {
  const line = summary?.trim().split("\n")[0]?.trim();
  if (!line) return undefined;
  return line.length > MAX_NOTA_SUMMARY ? `${line.slice(0, MAX_NOTA_SUMMARY - 3)}...` : line;
}

export function canalFromPipelineMatch(m: PipelineMatchResult): string {
  if (m.easyApply || m.applyType === "easy_apply") return "Easy Apply";
  if (m.applyType === "external") return "Externo";
  return "—";
}

export function proximoPasoFromPipelineMatch(m: PipelineMatchResult): string {
  return m.easyApply || m.applyType === "easy_apply"
    ? "Easy Apply automático o revisar"
    : "Apply → portal empresa";
}

/** Mismo filtro que sync-excel.ts en applied-list. */
export function shouldSyncPipelineMatch(m: PipelineMatchResult): boolean {
  if (m.recommendation === "skip" && m.matchPercent < PIPELINE_MIN_MATCH) return false;
  return true;
}

export function pipelineMatchToApplicationInput(m: PipelineMatchResult): UpsertApplicationInput {
  const notas = notasFromSummary(m.summary);
  return {
    jobId: m.jobId,
    gmailId: m.gmailId,
    matchPercent: m.matchPercent,
    puesto: m.title,
    empresa: m.company,
    linkedinUrl: m.url,
    canal: canalFromPipelineMatch(m),
    estado: "Pendiente",
    proximoPaso: proximoPasoFromPipelineMatch(m),
    cvType: m.cvType,
    applyType: m.applyType,
    ...(notas ? { notas } : {}),
    updatedBy: "pipeline",
  };
}
