/**
 * Contrato multi-fuente (B-13 / B-31).
 * IndeedAdapter implementa esto; LinkedIn search legacy aún no migró todo el scrape.
 */

import type { JobListing } from "../types.js";

export type JobSourceId = "linkedin" | "indeed" | "getonboard" | string;

export type JobSourceSearchQuery = {
  /** Texto de búsqueda (ej. "QA Automation"). */
  keywords: string;
  /** Región ISO-ish: AR, etc. */
  region?: string;
  /** Máximo de resultados a devolver. */
  limit?: number;
};

export type JobSourceListing = JobListing & {
  source: JobSourceId;
  externalId: string;
};

export interface JobSourceAdapter {
  readonly source: JobSourceId;
  search(query: JobSourceSearchQuery): Promise<JobSourceListing[]>;
}
