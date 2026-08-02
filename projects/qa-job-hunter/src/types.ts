// ============================================================
//  types.ts — Tipos compartidos entre todos los módulos
// ============================================================

import type { JdSections } from "./jd/parse-sections.js";
<<<<<<< HEAD
import type { TrackerCanal, TrackerEstado } from "./types/tracker-application.js";
=======
>>>>>>> 485a67351a1c543d74c58d9ab3095bdfaa209e4a

export type { JdSections };

export interface JobListing {
  id: string;
  title: string;
  company: string;
  location: string;
  modality: string;       // Remote / Hybrid / On-site
  datePosted: string;
  url: string;
  description: string;
  /** Secciones JD parseadas (#370) — opcional en API/dashboard. */
  jdSections?: JdSections;
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
  /** Mongo `applications._id` — writes dashboard (#314). */
  applicationId?: string;
  /** LinkedIn: aviso cerrado (scrape `jobClosed`). Distinto de estado tracker Cerrado. */
  jobClosed?: boolean;
<<<<<<< HEAD
  /** Estado canónico tracker (columna Excel). Badge lista/detalle (#410). */
  estado?: TrackerEstado;
  /** Canal de postulación (Easy Apply / Externo). */
  canal?: TrackerCanal;
  /** Señal Gmail label Entrevistas-Assessments/Pendientes (#420). */
  assessmentGmailPending?: boolean;
=======
>>>>>>> 485a67351a1c543d74c58d9ab3095bdfaa209e4a
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
