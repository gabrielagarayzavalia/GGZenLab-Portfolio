// ============================================================
//  regex-matcher.ts — Proveedor de match por reglas (sin LLM)
//  Tercera opción junto a Claude API y Ollama local: no gasta
//  tokens ni requiere modelo, ideal como reaseguro/offline.
// ============================================================

import type { JobListing } from "./types.js";

export interface RegexAnalysis {
  matchPercent: number;
  matchedSkills: string[];
  gaps: string[];
  cvSuggestions: string[];
  summary: string;
}

interface RegexProfile {
  skills: string[];
  languages: { es: string; en: string };
  modalityPreference: string;
  experienceYears: { qa: number };
  seniority: string;
}

// Perfil estructurado equivalente a MY_PROFILE de config.ts.
// Editá esta constante si cambian tus skills/seniority.
const PROFILE: RegexProfile = {
  skills: [
    "manual testing", "functional testing", "regression testing", "smoke testing",
    "exploratory testing", "sanity testing", "selenium", "playwright", "cypress",
    "javascript", "typescript", "python", "testng", "junit", "mocha", "jest",
    "cucumber", "gherkin", "bdd", "postman", "rest assured", "api testing",
    "jenkins", "github actions", "gitlab ci", "ci/cd", "git", "github", "gitlab",
    "jira", "testrail", "zephyr", "agile", "scrum", "kanban", "sql", "windows",
    "linux", "qa leadership", "test planning", "test cases", "mobile testing", "rest api",
  ],
  languages: { es: "native", en: "intermediate-high" },
  modalityPreference: "remote",
  experienceYears: { qa: 25 },
  seniority: "senior",
};

const AUTOMATION_TOOLS = ["selenium", "playwright", "cypress", "testng", "junit", "mocha", "jest", "cucumber"];
const CODING_LANGS = ["python", "java", "javascript", "typescript"];

const SKILL_PATTERNS: { label: string; patterns: RegExp[]; weight: number }[] = [
  { label: "manual testing", patterns: [/manual test/i, /testing manual/i, /pruebas manuales/i, /qa manual/i], weight: 2 },
  { label: "functional testing", patterns: [/functional test/i, /pruebas funcionales/i, /casos de prueba/i, /qa funcional/i, /an[aá]lisis funcional/i], weight: 2 },
  { label: "regression testing", patterns: [/regression/i, /regresi[oó]n/i], weight: 1 },
  { label: "istqb", patterns: [/istqb/i], weight: 2 },
  { label: "automation", patterns: [/automation/i, /automatizaci[oó]n/i, /test automation/i], weight: 2 },
  { label: "selenium", patterns: [/selenium/i], weight: 2 },
  { label: "playwright", patterns: [/playwright/i], weight: 2 },
  { label: "cypress", patterns: [/cypress/i], weight: 1 },
  { label: "python", patterns: [/python/i], weight: 2 },
  { label: "javascript", patterns: [/javascript/i, /\bjs\b/i], weight: 2 },
  { label: "typescript", patterns: [/typescript/i], weight: 2 },
  { label: "java", patterns: [/\bjava\b/i], weight: 2 },
  { label: "api testing", patterns: [/api test/i, /rest api/i, /postman/i, /rest assured/i], weight: 2 },
  { label: "postman", patterns: [/postman/i], weight: 1 },
  { label: "bdd", patterns: [/bdd/i, /cucumber/i, /gherkin/i], weight: 1 },
  { label: "ci/cd", patterns: [/ci\/cd/i, /jenkins/i, /github actions/i, /gitlab ci/i], weight: 1 },
  { label: "agile", patterns: [/agile/i, /scrum/i, /kanban/i], weight: 1 },
  { label: "jira", patterns: [/jira/i], weight: 1 },
  { label: "performance testing", patterns: [/performance test/i, /jmeter/i, /load test/i, /estr[eé]s/i], weight: 2 },
  { label: "sql", patterns: [/\bsql\b/i], weight: 1 },
  { label: "sdet", patterns: [/sdet/i, /software development engineer in test/i], weight: 2 },
  { label: "leadership", patterns: [/lead/i, /lider/i, /mentor/i, /team lead/i], weight: 1 },
  { label: "data quality", patterns: [/data quality/i, /calidad de datos/i], weight: 2 },
  { label: "mobile testing", patterns: [/mobile test/i, /app test/i], weight: 1 },
  { label: "ai/ml testing", patterns: [/machine learning/i, /\bllm\b/i, /ai[- ]?(generated|powered|driven)/i, /\bai\s+(testing|test|models?|agents?)\b/i, /non-deterministic/i], weight: 1 },
];

const MUST_HAVE_HINTS = /required|must have|mandatory|requerido|indispensable|m[ií]nimo|minimum|essential/i;
const NICE_HINTS = /preferred|nice to have|plus|deseable|valorado|bonus/i;

// Aísla la JD real, descartando el chrome de LinkedIn que ensucia el regex.
const JD_START_MARKERS = ["About the job", "Acerca del empleo"];
const JD_END_MARKERS = [
  "Set alert for similar jobs", "Put your best foot forward", "See how you compare",
  "Exclusive Job Seeker Insights", "Show Premium Insights", "People also viewed",
  "Looking for talent?", "More jobs",
];

function cleanDescription(desc: string): string {
  let text = desc;
  for (const m of JD_START_MARKERS) {
    const i = text.indexOf(m);
    if (i >= 0) {
      text = text.slice(i + m.length);
      break;
    }
  }
  let cut = text.length;
  for (const m of JD_END_MARKERS) {
    const i = text.indexOf(m);
    if (i >= 0 && i < cut) cut = i;
  }
  return text.slice(0, cut).replace(/…\s*more\s*$/i, "").trim();
}

function profileHasSkill(label: string): boolean {
  return PROFILE.skills.some((s) => s.includes(label) || label.includes(s));
}

function extractRequirements(text: string): { label: string; weight: number }[] {
  const reqs: { label: string; weight: number }[] = [];
  const lines = text.split(/[\n.;]/).map((l) => l.trim()).filter((l) => l.length > 8);

  for (const def of SKILL_PATTERNS) {
    if (!def.patterns.some((p) => p.test(text))) continue;
    let weight = def.weight;
    const line = lines.find((l) => def.patterns.some((p) => p.test(l)));
    if (line && MUST_HAVE_HINTS.test(line)) weight = Math.max(weight, 2);
    else if (line && NICE_HINTS.test(line)) weight = Math.min(weight, 1);
    reqs.push({ label: def.label, weight });
  }

  const yearsMatch = text.match(/(\d+)\+?\s*(years|a[nñ]os)/i);
  if (yearsMatch) reqs.push({ label: `experience_${yearsMatch[1]}y`, weight: 2 });
  if (/english|ingl[eé]s|fluent english|native english/i.test(text)) reqs.push({ label: "english_fluent", weight: 2 });
  if (/remote|remoto|work from home/i.test(text)) reqs.push({ label: "remote_ok", weight: 1 });
  if (/senior|sr\.?|lead/i.test(text)) reqs.push({ label: "senior_level", weight: 1 });

  return reqs;
}

function meetsRequirement(label: string): boolean {
  if (label.startsWith("experience_")) {
    return PROFILE.experienceYears.qa >= parseInt(label.split("_")[1], 10);
  }
  if (label === "english_fluent") return /intermediate|advanced|fluent|alto|b2|c1/i.test(PROFILE.languages.en);
  if (label === "remote_ok") return PROFILE.modalityPreference === "remote";
  if (label === "senior_level") return PROFILE.seniority === "senior";
  if (label === "automation") {
    return AUTOMATION_TOOLS.some((t) => PROFILE.skills.includes(t)) || PROFILE.skills.some((s) => /automation|automatiz/i.test(s));
  }
  if (label === "sdet") {
    return AUTOMATION_TOOLS.some((t) => PROFILE.skills.includes(t)) && CODING_LANGS.some((t) => PROFILE.skills.includes(t));
  }
  if (label === "ai/ml testing") return PROFILE.skills.some((s) => /\bai\b|machine learning|\bml\b|\bllm\b/i.test(s));
  if (label === "istqb") return PROFILE.skills.some((s) => /istqb/i.test(s));
  return profileHasSkill(label);
}

function specialFlags(job: JobListing): string[] {
  const flags: string[] = [];
  const blob = `${job.title} ${job.description} ${job.company}`.toLowerCase();
  if (job.company.toLowerCase().includes("quilmes") || /soporte de calidad/i.test(job.title)) {
    flags.push("industry_review: posible QA industrial/GMP, no software puro");
  }
  if (/jpmorgan|kraken|network solutions/i.test(job.company)) {
    flags.push("english_process: proceso corporativo, inglés fluido probable");
  }
  if (/performance|jmeter|load test/i.test(blob)) {
    flags.push("performance_gap: validar experiencia en performance testing");
  }
  if (/data quality|data analyst/i.test(blob)) {
    flags.push("data_domain: rol con componente analítico de datos");
  }
  return flags;
}

// Calibración de prioridad: separa empates según fit real (modalidad, seniority, coding).
function fitModifier(job: JobListing): { delta: number; reasons: string[] } {
  let delta = 0;
  const reasons: string[] = [];
  const modality = (job.modality || "").toLowerCase();
  const title = job.title.toLowerCase();

  if (/remote|remoto/.test(modality)) {
    // preferido, sin penalidad
  } else if (/hybrid|h[ií]brido/.test(modality)) {
    delta -= 6;
    reasons.push("modalidad híbrida");
  } else if (/on-?site|presencial/.test(modality)) {
    delta -= 12;
    reasons.push("modalidad presencial");
  }

  if (/\bjr\b|junior|trainee|becari|pasant/.test(title)) {
    delta -= 20;
    reasons.push("rol junior (sobre-calificada)");
  } else if (/middle|intermediate|semi[\s-]?senior|\bssr\b/.test(title) && !/\bsr\b|senior/.test(title)) {
    delta -= 6;
    reasons.push("rol semi-senior");
  }

  if (/sdet|software development engineer in test/.test(title)) {
    delta -= 6;
    reasons.push("rol SDET, coding intensivo a validar");
  }

  return { delta, reasons };
}

export function analyzeJobRegex(job: JobListing): RegexAnalysis {
  const text = `${job.title}\n${cleanDescription(job.description)}`;
  const requirements = extractRequirements(text);
  const flags = specialFlags(job);

  if (requirements.length === 0) {
    requirements.push(
      { label: "manual testing", weight: 2 },
      { label: "automation", weight: 1 },
      { label: "agile", weight: 1 },
    );
  }

  let covered = 0;
  let total = 0;
  const matchedSkills: string[] = [];
  const gaps: string[] = [];

  for (const req of requirements) {
    total += req.weight;
    if (meetsRequirement(req.label)) {
      covered += req.weight;
      if (!req.label.startsWith("experience_") && req.label !== "remote_ok" && req.label !== "senior_level") {
        matchedSkills.push(req.label);
      }
    } else {
      gaps.push(req.label.replace(/_/g, " "));
    }
  }

  const coveragePercent = total > 0 ? Math.round((covered / total) * 100) : 0;
  const fit = fitModifier(job);
  let matchPercent = Math.max(0, Math.min(100, coveragePercent + fit.delta));

  if (gaps.includes("english fluent") && !flags.some((f) => f.startsWith("english_process"))) {
    matchPercent = Math.min(matchPercent, 55);
  }
  if (flags.some((f) => f.startsWith("industry_review"))) matchPercent = Math.min(matchPercent, 60);
  if (flags.some((f) => f.startsWith("data_domain")) && !meetsRequirement("data quality")) {
    matchPercent = Math.min(matchPercent, 50);
  }

  const uniqueMatched = [...new Set(matchedSkills)];
  const uniqueGaps = [...new Set(gaps)];
  const cvSuggestions = uniqueGaps.slice(0, 3).map((g) => {
    if (g.includes("performance")) return "Destacar experiencia con pruebas de carga/JMeter o no funcionales.";
    if (g.includes("english")) return "Mencionar inglés técnico fluido: documentación, tickets y dailies.";
    if (g.includes("istqb")) return "Aclarar certificación ISTQB (si la tenés) o experiencia equivalente.";
    if (g.includes("data quality")) return "Sumar evidencia de validación de datos / data quality si aplica.";
    return `Agregar evidencia concreta de ${g} en el CV.`;
  });

  const fitNote = fit.reasons.length ? ` Ajuste de fit: ${fit.reasons.join(", ")}.` : "";
  const summary =
    matchPercent >= 70
      ? `Encaje sólido (${matchPercent}%) por regex, foco ${uniqueMatched.slice(0, 3).join(", ") || "QA funcional"}.${fitNote}`
      : `Match ${matchPercent}% por regex. Gaps: ${uniqueGaps.slice(0, 3).join(", ") || "generales"}.${fitNote}`;

  return { matchPercent, matchedSkills: uniqueMatched, gaps: uniqueGaps, cvSuggestions, summary };
}
