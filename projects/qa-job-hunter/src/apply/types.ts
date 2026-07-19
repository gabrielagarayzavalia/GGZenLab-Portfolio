// Tipos del flujo Easy Apply (B17).

export type ApplicationStatus =
  | "submitted"
  | "draft_saved"
  | "blocked"
  | "manual_pending"
  | "skipped_low_match"
  | "not_attempted";

export interface ApplicationRecord {
  jobId: string;
  company: string;
  title: string;
  status: ApplicationStatus;
  reason: string;
  updatedAt: string;
}

// Job normalizado para el flujo de aplicación (mapeado desde JobMatch de src/types.ts).
export interface ApplyJob {
  jobId: string;
  company: string;
  title: string;
  url: string;
  matchPercent: number;
  summary: string;
}
