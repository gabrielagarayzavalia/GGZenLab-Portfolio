import type { UpsertApplicationInput } from "../db/applications.js";

/** Subconjunto de qa-job-applied-list MatchResult (sin importar el sibling). */
export interface PipelineMatchResult {
  jobId: string;
  company: string;
  title: string;
  url: string;
  gmailId?: string;
  matchPercent: number;
  cvType?: string;
  recommendation: "apply" | "apply_manual" | "skip";
  applyType?: "easy_apply" | "external" | "unknown";
  easyApply?: boolean;
}

export const PIPELINE_MIN_MATCH = 65;

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
    updatedBy: "pipeline",
  };
}
