// ============================================================
//  types.ts — Tipos compartidos entre todos los módulos
// ============================================================

export interface JobListing {
  id: string;
  title: string;
  company: string;
  location: string;
  modality: string;       // Remote / Hybrid / On-site
  datePosted: string;
  url: string;
  description: string;
  searchTerm: string;     // Qué búsqueda lo encontró
  /** Origen multi-fuente (B-13 / B-31). Opcional en scrape LinkedIn legacy. */
  source?: string;
  externalId?: string;
}

export interface JobMatch extends JobListing {
  matchPercent: number;
  matchedSkills: string[];
  gaps: string[];
  cvSuggestions: string[];
  summary: string;
}

export interface AnalysisResult {
  scrapedAt: string;
  totalFound: number;
  totalAnalyzed: number;
  matchedJobs: JobMatch[];   // Solo los que tienen 70%+
  skippedJobs: {
    title: string;
    company: string;
    matchPercent: number;
  }[];
}
