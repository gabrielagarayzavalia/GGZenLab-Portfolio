// ============================================================
//  match-utils.ts — Prompt, parser y export compartidos
// ============================================================

import fs from "fs";
import { CSV_PATH, MIN_MATCH, MY_PROFILE } from "./config.js";
import { buildFeedbackLearningBlock, loadFeedback, type MatchFeedbackStore } from "./feedback.js";
import type { JobListing, JobMatch } from "./types.js";

export { MIN_MATCH };

export function buildMatchPrompt(job: JobListing, feedback?: MatchFeedbackStore): string {
  const feedbackBlock = buildFeedbackLearningBlock(feedback ?? loadFeedback());

  return `Eres un experto senior en reclutamiento de QA y Testing con 20 años de experiencia.

Analiza el match entre este perfil profesional y la oferta de empleo. Responde ÚNICAMENTE con JSON válido, sin texto extra.

=== PERFIL DEL CANDIDATO ===
${MY_PROFILE}
${feedbackBlock}
=== OFERTA DE EMPLEO ===
Título: ${job.title}
Empresa: ${job.company}
Ubicación: ${job.location} | Modalidad: ${job.modality}
Descripción:
${job.description.slice(0, 3000)}

=== INSTRUCCIONES ===
Calcula el porcentaje de match siendo estricto pero justo. Considera:
- Skills técnicos que coinciden (peso: 40%)
- Años de experiencia requerida vs disponible (peso: 25%)  
- Metodologías y herramientas (peso: 20%)
- Modalidad de trabajo (peso: 15%)

Responde con este JSON exacto:
{
  "matchPercent": <número entre 0 y 100>,
  "matchedSkills": ["skill1", "skill2", ...],
  "gaps": ["gap1 si existe", ...],
  "cvSuggestions": ["frase1 para agregar al CV", "frase2", "frase3"],
  "summary": "Resumen en 2 oraciones de por qué aplica o no"
}`;
}

export function parseMatchResponse(text: string): {
  matchPercent: number;
  matchedSkills: string[];
  gaps: string[];
  cvSuggestions: string[];
  summary: string;
} {
  try {
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch {
    return {
      matchPercent: 0,
      matchedSkills: [],
      gaps: ["No se pudo analizar"],
      cvSuggestions: [],
      summary: "Error de análisis",
    };
  }
}

export function exportCSV(jobs: JobMatch[]): void {
  const headers = [
    "Match%", "Título", "Empresa", "Ubicación", "Modalidad",
    "Fecha", "Skills Match", "Gaps", "Sugerencias CV", "URL", "Resumen",
  ].join(";");

  const rows = jobs.map((j) => [
    j.matchPercent,
    `"${j.title}"`,
    `"${j.company}"`,
    `"${j.location}"`,
    `"${j.modality}"`,
    `"${j.datePosted}"`,
    `"${j.matchedSkills.join(", ")}"`,
    `"${j.gaps.join(", ")}"`,
    `"${j.cvSuggestions.join(" | ")}"`,
    `"${j.url}"`,
    `"${j.summary}"`,
  ].join(";"));

  fs.writeFileSync(CSV_PATH, [headers, ...rows].join("\n"), "utf-8");
}
