/**
 * Preguntas Easy Apply sin respuesta conocida → Notas Excel / reporte de corrida.
 * Tras cada ejecución, el usuario define cómo contestarlas.
 */

import fs from "fs";
import path from "path";
import { APPLY_DIR, ensureDirs } from "./paths.js";
import type { CapturedField } from "./fill-answers.js";
import { PSEUDO_ANSWERS, isCoverOrSummaryLabel } from "./fill-answers.js";
import { resolveSkillYesNo } from "./my-skills.js";

/** Campos que ya contestamos o ignoramos a propósito (no pedir reglas). */
const KNOWN_FIELD_RE: RegExp[] = [
  PSEUDO_ANSWERS.locationCity.fieldMatch,
  PSEUDO_ANSWERS.locationCity.hintMatch,
  PSEUDO_ANSWERS.country.fieldMatch,
  PSEUDO_ANSWERS.linkedinProfile.fieldMatch,
  PSEUDO_ANSWERS.portfolio.fieldMatch,
  PSEUDO_ANSWERS.expectedCompensation.fieldMatch,
  PSEUDO_ANSWERS.startAvailability.fieldMatch,
  PSEUDO_ANSWERS.workOrLiveCityFreeText.fieldMatch,
  PSEUDO_ANSWERS.preferredWorkLocation.fieldMatch,
  PSEUDO_ANSWERS.citySelect.fieldMatch,
  PSEUDO_ANSWERS.howDidYouHear.fieldMatch,
  /^(first|last|full)\s*name|nombre|apellido|email|e-?mail|phone|tel[eé]fono|mobile|celular/i,
  /resume|curriculum|cv\b|cover\s*letter|carta de presentaci[oó]n|summary|resumen/i,
  /select language|idioma|language\s*proficiency|english\s*(level|proficiency)|nivel de ingl[eé]s/i,
  /i consent|consent|autorizo|acepto (los |las )?(t[eé]rminos|condiciones)|privacy|privacidad/i,
  /follow (the )?company|seguir (a la )?empresa|mark .+ top choice|top choice/i,
  /years?\s+of\s+experience|a[nñ]os?\s+de\s+experiencia|how many years/i,
  /deequ|great expectations|data quality framework/i,
  /skills assessment|online assessment|coding assessment|honeypot|\bquiz\b/i,
  PSEUDO_ANSWERS.hybridWorkOk.fieldMatch,
  PSEUDO_ANSWERS.programmingScripting.fieldMatch,
  PSEUDO_ANSWERS.phoneCountryCode.fieldMatch,
];

export type UnknownQuestionHit = {
  label: string;
  kind: string;
  required: boolean;
  value: string;
};

export type RunUnknownJob = {
  jobId: string;
  company: string;
  title: string;
  questions: string[];
  extraNotes: string[];
};

const runAccumulator: RunUnknownJob[] = [];

export function resetRunUnknownQuestions(): void {
  runAccumulator.length = 0;
}

export function isKnownFieldLabel(blob: string): boolean {
  const t = blob.replace(/\s+/g, " ").trim();
  if (!t || t.length < 2) return true;
  if (isCoverOrSummaryLabel(t)) return true;
  if (resolveSkillYesNo(t)) return true;
  return KNOWN_FIELD_RE.some((re) => re.test(t));
}

/** Preguntas / campos sin matcher propio (excluye vacíos genéricos ruidosos). */
export function collectUnknownQuestions(fields: CapturedField[]): UnknownQuestionHit[] {
  const out: UnknownQuestionHit[] = [];
  const seen = new Set<string>();

  for (const f of fields) {
    const label = (f.label || f.ariaLabel || f.placeholder || "").replace(/\s+/g, " ").trim();
    if (!label || label.length < 3) continue;
    if (f.scenarioKind === "error") continue;
    if (isKnownFieldLabel(label)) continue;

    // Ruido: botones / labels de UI
    if (/^(next|continue|review|submit|done|back|dismiss|cerrar|guardar|save|discard)/i.test(label)) {
      continue;
    }

    const key = label.toLowerCase().slice(0, 160);
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      label: label.slice(0, 200),
      kind: f.scenarioKind ?? f.tag,
      required: !!f.required,
      value: (f.value || "").slice(0, 80),
    });
  }

  return out;
}

export function formatUnknownNotes(
  unknowns: UnknownQuestionHit[],
  extraNotes: string[] = []
): string {
  const parts: string[] = [];
  for (const e of extraNotes) {
    const t = e.trim();
    if (t) parts.push(t);
  }
  if (unknowns.length > 0) {
    parts.push("Preguntas nuevas (definir respuesta):");
    for (const u of unknowns) {
      const req = u.required ? " [req]" : "";
      const pref = u.value ? ` (prefill: ${u.value})` : "";
      parts.push(`- ${u.label}${req}${pref}`);
    }
  }
  return parts.join("\n").slice(0, 1800);
}

export function recordJobUnknownQuestions(
  jobId: string,
  company: string,
  title: string,
  unknowns: UnknownQuestionHit[],
  extraNotes: string[] = []
): string {
  const questions = unknowns.map((u) => u.label);
  const existing = runAccumulator.find((j) => j.jobId === jobId);
  if (existing) {
    for (const q of questions) {
      if (!existing.questions.includes(q)) existing.questions.push(q);
    }
    for (const n of extraNotes) {
      if (n && !existing.extraNotes.includes(n)) existing.extraNotes.push(n);
    }
  } else if (questions.length > 0 || extraNotes.length > 0) {
    runAccumulator.push({
      jobId,
      company,
      title,
      questions: [...questions],
      extraNotes: [...extraNotes],
    });
  }

  const mergedUnknowns =
    existing != null
      ? existing.questions.map((label) => ({
          label,
          kind: "unknown",
          required: false,
          value: "",
        }))
      : unknowns;
  const extras = existing?.extraNotes ?? extraNotes;
  return formatUnknownNotes(mergedUnknowns.length ? mergedUnknowns : unknowns, extras);
}

export function getRunUnknownQuestions(): RunUnknownJob[] {
  return [...runAccumulator];
}

/** Persiste reporte de corrida + latest para el chat / Excel. */
export function saveRunUnknownQuestionsReport(): string {
  ensureDirs();
  const payload = {
    at: new Date().toISOString(),
    jobs: runAccumulator,
    askUser:
      "Decime cómo contestar cada pregunta nueva (texto / dropdown / Sí-No) para sumarla a PSEUDO_ANSWERS.",
  };
  const file = path.join(APPLY_DIR, `new-questions-${Date.now()}.json`);
  const latest = path.join(APPLY_DIR, "new-questions-latest.json");
  fs.writeFileSync(file, JSON.stringify(payload, null, 2), "utf-8");
  fs.writeFileSync(latest, JSON.stringify(payload, null, 2), "utf-8");
  return latest;
}

export function logRunUnknownQuestions(): void {
  if (runAccumulator.length === 0) {
    console.log("\n📝 Preguntas nuevas: ninguna (todas conocidas o sin form).");
    return;
  }
  console.log("\n📝 Preguntas nuevas de esta corrida (también en Excel → Notas):");
  for (const job of runAccumulator) {
    console.log(`   · ${job.company} — ${job.title} (${job.jobId})`);
    for (const n of job.extraNotes) console.log(`      ! ${n}`);
    for (const q of job.questions) console.log(`      - ${q}`);
  }
  console.log("   → Decime cómo contestarlas para hardcodearlas.");
}
