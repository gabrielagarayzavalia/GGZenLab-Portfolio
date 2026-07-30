// ============================================================
//  regex-matcher.ts — Proveedor de match por reglas (sin LLM)
//  Tercera opción junto a Claude API y Ollama local: no gasta
//  tokens ni requiere modelo, ideal como reaseguro/offline.
// ============================================================

import type { JobListing } from "./types.js";
import { hasParsedJdSections, parseJdSections } from "./jd/parse-sections.js";

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
  location: string;
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
  location: "Buenos Aires, Argentina",
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
const AUTOMATION_JD = /automation|automatiz|selenium|playwright|cypress|sdet/i;
const GIG_SIGNALS = /\b(freelance|freelancer|freelancers|gig|espor[aá]dic)\b/i;
const CONTRACT_EMPLOYMENT = /\bcontract\b(?!\s*(testing|qa|role))/i;
const ENTRY_LEVEL = /\bentry[\s-]?level\b/i;
const HARDWARE_SIGNALS = /smart\s*tv|whale\s*os|zeasn|saphi/i;
const ACCESS_CONTEXT = /subscription|suscripci[oó]n|acceso|access|setup|instal/i;
const GEO_SUBSCRIPTION = /liberty\s+costa\s+rica/i;
const FOREIGN_COUNTRY =
  /\b(costa\s+rica|mexico|m[eé]xico|chile|colombia|per[uú]|uruguay|paraguay|ecuador|bolivia|venezuela|guatemala|honduras|nicaragua|el\s+salvador|panama|panam[aá])\b/i;

// Aísla la JD real, descartando el chrome de LinkedIn que ensucia el regex.
const JD_START_MARKERS = ["About the job", "Acerca del empleo"];
const JD_END_MARKERS = [
  "Set alert for similar jobs", "Put your best foot forward", "See how you compare",
  "Exclusive Job Seeker Insights", "Show Premium Insights", "People also viewed",
  "Looking for talent?", "More jobs",
];

const LINKEDIN_CHROME_LINE =
  /^(?:\d+\s+(?:day|days|week|weeks|month|months)\s+ago(?:\s*[·•|]\s*\d+\s+people\s+clicked\s+apply)?|\d+\s+people\s+clicked\s+apply|Promoted|Responses?\s+managed\s+outside\s+LinkedIn)$/i;

function stripLinkedInChrome(text: string): string {
  const withoutInline = text
    .replace(/\s*[·•|]\s*\d+\s+people\s+clicked\s+apply/gi, "")
    .replace(/\d+\s+(?:days?|weeks?|months?)\s+ago/gi, "")
    .replace(/\d+\s+people\s+clicked\s+apply/gi, "")
    .trim();

  return withoutInline
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !LINKEDIN_CHROME_LINE.test(line))
    .join("\n");
}

function jdSectionsToMatchText(sections: ReturnType<typeof parseJdSections>): string {
  const parts: string[] = [];
  if (sections.requirements.length > 0) {
    parts.push(
      "Requirements:\n" + sections.requirements.map((item) => `• ${item}`).join("\n")
    );
  }
  if (sections.niceToHave.length > 0) {
    parts.push(
      "Nice To Have:\n" + sections.niceToHave.map((item) => `• ${item}`).join("\n")
    );
  }
  return parts.join("\n\n");
}

/** Limpia chrome LinkedIn y preamble antes de regex match (#369). */
export function cleanDescription(desc: string): string {
  let text = stripLinkedInChrome(desc);
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
  text = text.slice(0, cut).replace(/…\s*more\s*$/i, "").trim();

  const parsed = parseJdSections(text);
  if (hasParsedJdSections(parsed)) {
    return jdSectionsToMatchText(parsed);
  }

  return text;
}

interface JobRequirement {
  label: string;
  weight: number;
  sourceLine?: string;
}

const REQUIREMENT_SECTION =
  /(?:^|\n)\s*(?:requirements?|qualifications?|requisitos?|lo que buscamos|must have|what you.?ll need)[:\s]*/i;

const GAP_LABELS: Record<string, string> = {
  english_fluent: "Inglés fluido requerido",
  hardware_specific: "Hardware específico (Smart TV / plataforma)",
  regional_requirement: "Requisito regional / suscripción geo-restringida",
  gig_freelance: "Contrato freelance/gig (no full-time)",
  entry_level_role: "Rol entry-level vs perfil senior",
  junior_title: "Rol junior vs perfil senior",
  hybrid_modality: "Modalidad híbrida requerida",
  onsite_modality: "Modalidad presencial requerida",
  remote_ok: "Trabajo remoto",
  senior_level: "Nivel senior/lead",
};

function splitLines(text: string): string[] {
  return text.split(/[\n.;]/).map((l) => l.trim()).filter((l) => l.length > 8);
}

function findSourceLine(text: string, patterns: RegExp | RegExp[]): string | undefined {
  const pats = Array.isArray(patterns) ? patterns : [patterns];
  const line = splitLines(text).find((l) => pats.some((p) => p.test(l)));
  return line?.replace(/^[-•*–]\s*/, "").replace(/^\d+[.)]\s*/, "").trim();
}

function skillDisplayText(req: JobRequirement): string {
  if (req.label.startsWith("experience_")) {
    const years = req.label.split("_")[1];
    return `${years} años de experiencia`;
  }
  return GAP_LABELS[req.label] ?? req.label.replace(/_/g, " ");
}

function gapDisplayText(req: JobRequirement): string {
  if (req.sourceLine) {
    return req.sourceLine.length > 120 ? `${req.sourceLine.slice(0, 117)}...` : req.sourceLine;
  }
  return GAP_LABELS[req.label] ?? req.label.replace(/^bullet:/, "").replace(/_/g, " ");
}

function meetsBulletRequirement(sourceLine: string): boolean {
  const lower = sourceLine.toLowerCase();
  if (PROFILE.skills.some((s) => lower.includes(s))) return true;
  if (/qa|quality|testing|tester/i.test(lower) && PROFILE.experienceYears.qa > 0) return true;
  if (/english|ingl[eé]s/i.test(lower) && /intermediate|advanced|fluent|alto|b2|c1/i.test(PROFILE.languages.en)) {
    return true;
  }
  if (/remote|remoto/i.test(lower) && PROFILE.modalityPreference === "remote") return true;
  if (/ux/i.test(lower) && PROFILE.skills.some((s) => /ux|user experience/i.test(s))) return true;
  return false;
}

function extractSkillRequirements(text: string): JobRequirement[] {
  const reqs: JobRequirement[] = [];
  const lines = splitLines(text);

  for (const def of SKILL_PATTERNS) {
    if (!def.patterns.some((p) => p.test(text))) continue;
    let weight = def.weight;
    const line = lines.find((l) => def.patterns.some((p) => p.test(l)));
    if (line && MUST_HAVE_HINTS.test(line)) weight = Math.max(weight, 2);
    else if (line && NICE_HINTS.test(line)) weight = Math.min(weight, 1);
    reqs.push({
      label: def.label,
      weight,
      sourceLine: line ? line.replace(/^[-•*–]\s*/, "").replace(/^\d+[.)]\s*/, "").trim() : undefined,
    });
  }

  const yearsMatch = text.match(/(\d+)\+?\s*(years|a[nñ]os)/i);
  if (yearsMatch) {
    reqs.push({ label: `experience_${yearsMatch[1]}y`, weight: 2, sourceLine: yearsMatch[0] });
  }
  if (/english|ingl[eé]s|fluent english|native english/i.test(text)) {
    reqs.push({
      label: "english_fluent",
      weight: 2,
      sourceLine: findSourceLine(text, [/english|ingl[eé]s|fluent english/i]),
    });
  }
  if (/remote|remoto|work from home/i.test(text)) {
    reqs.push({
      label: "remote_ok",
      weight: 1,
      sourceLine: findSourceLine(text, [/remote|remoto|work from home/i]),
    });
  }
  if (/senior|sr\.?|lead/i.test(text)) {
    reqs.push({
      label: "senior_level",
      weight: 1,
      sourceLine: findSourceLine(text, [/senior|sr\.?|lead/i]),
    });
  }
  return reqs;
}

function extractBulletRequirements(text: string): JobRequirement[] {
  const parsed = parseJdSections(text);
  let bulletLines: string[];

  if (parsed.requirements.length > 0) {
    bulletLines = parsed.requirements;
  } else {
    const sectionMatch = text.match(REQUIREMENT_SECTION);
    const sectionStart = sectionMatch ? text.indexOf(sectionMatch[0]) + sectionMatch[0].length : 0;
    const sectionText = sectionMatch ? text.slice(sectionStart) : text;
    const lines = sectionText.split(/\n/).map((l) => l.trim()).filter((l) => l.length > 8);
    bulletLines = lines
      .filter((l) => /^[-•*–]\s/.test(l) || /^\d+[.)]\s/.test(l))
      .map((l) => l.replace(/^[-•*–]\s*/, "").replace(/^\d+[.)]\s*/, "").trim());
  }

  const reqs: JobRequirement[] = [];

  for (const sourceLine of bulletLines) {
    if (sourceLine.length < 10) continue;
    const coveredByPattern = SKILL_PATTERNS.some((def) => def.patterns.some((p) => p.test(sourceLine)));
    if (coveredByPattern) continue;

    let weight = 2;
    if (NICE_HINTS.test(sourceLine)) weight = 1;
    else if (MUST_HAVE_HINTS.test(sourceLine)) weight = 2;

    reqs.push({
      label: `bullet:${sourceLine.slice(0, 80).toLowerCase()}`,
      weight,
      sourceLine,
    });
  }
  return reqs;
}

function extractContextRequirements(job: JobListing, text: string): { reqs: JobRequirement[]; caps: number[] } {
  const blob = jobBlob(job, text);
  const reqs: JobRequirement[] = [];
  const caps: number[] = [];

  if (HARDWARE_SIGNALS.test(blob) && ACCESS_CONTEXT.test(blob)) {
    reqs.push({
      label: "hardware_specific",
      weight: 2,
      sourceLine:
        findSourceLine(text, HARDWARE_SIGNALS) ??
        "Acceso a hardware específico (Smart TV / plataforma de streaming)",
    });
    caps.push(45);
  }

  if (isForeignGeo(blob)) {
    reqs.push({
      label: "regional_requirement",
      weight: 2,
      sourceLine:
        findSourceLine(text, GEO_SUBSCRIPTION) ??
        findSourceLine(text, FOREIGN_COUNTRY) ??
        "Requisito regional o suscripción geo-restringida",
    });
    caps.push(40);
  }

  const hasManualOrMobile = /manual\s+test|mobile\s+test|app\s+test/i.test(blob);
  if (hasManualOrMobile && !AUTOMATION_JD.test(blob)) {
    caps.push(55);
  }

  return { reqs, caps };
}

function extractFitRequirements(job: JobListing, text: string): JobRequirement[] {
  const reqs: JobRequirement[] = [];
  const blob = jobBlob(job, text);
  const modality = (job.modality || "").toLowerCase();
  const title = job.title.toLowerCase();

  if (GIG_SIGNALS.test(blob) || CONTRACT_EMPLOYMENT.test(blob)) {
    reqs.push({
      label: "gig_freelance",
      weight: 2,
      sourceLine: findSourceLine(text, GIG_SIGNALS) ?? "Employment type: freelance/gig contract",
    });
  }

  if (ENTRY_LEVEL.test(blob)) {
    reqs.push({
      label: "entry_level_role",
      weight: 2,
      sourceLine: findSourceLine(text, ENTRY_LEVEL) ?? "Entry-level role",
    });
  }

  if (/\bjr\b|junior|trainee|becari|pasant/i.test(title)) {
    reqs.push({
      label: "junior_title",
      weight: 2,
      sourceLine: `Rol junior: ${job.title}`,
    });
  } else if (/middle|intermediate|semi[\s-]?senior|\bssr\b/i.test(title) && !/\bsr\b|senior/i.test(title)) {
    reqs.push({
      label: "junior_title",
      weight: 1,
      sourceLine: `Rol semi-senior: ${job.title}`,
    });
  }

  if (/hybrid|h[ií]brido/.test(modality)) {
    reqs.push({
      label: "hybrid_modality",
      weight: 1,
      sourceLine: findSourceLine(text, [/hybrid|h[ií]brido/i]) ?? "Modalidad híbrida",
    });
  } else if (/on-?site|presencial/.test(modality) && !/remote|remoto/.test(modality)) {
    reqs.push({
      label: "onsite_modality",
      weight: 2,
      sourceLine: findSourceLine(text, [/on-?site|presencial/i]) ?? "Modalidad presencial",
    });
  }

  return reqs;
}

function mergeRequirements(...lists: JobRequirement[][]): JobRequirement[] {
  const seen = new Map<string, JobRequirement>();
  for (const list of lists) {
    for (const req of list) {
      const existing = seen.get(req.label);
      if (!existing || (req.sourceLine && !existing.sourceLine)) {
        seen.set(req.label, req);
      }
    }
  }
  return [...seen.values()];
}

function extractRequirements(job: JobListing, text: string): JobRequirement[] {
  return mergeRequirements(
    extractSkillRequirements(text),
    extractBulletRequirements(text),
    extractContextRequirements(job, text).reqs,
    extractFitRequirements(job, text),
  );
}

function meetsRequirement(req: JobRequirement): boolean {
  const { label, sourceLine } = req;

  if (label.startsWith("bullet:") && sourceLine) {
    return meetsBulletRequirement(sourceLine);
  }

  if (label.startsWith("experience_")) {
    return PROFILE.experienceYears.qa >= parseInt(label.split("_")[1], 10);
  }
  if (label === "english_fluent") return /intermediate|advanced|fluent|alto|b2|c1/i.test(PROFILE.languages.en);
  if (label === "remote_ok") return PROFILE.modalityPreference === "remote";
  if (label === "senior_level") return PROFILE.seniority === "senior";

  if (label === "gig_freelance" || label === "entry_level_role" || label === "junior_title") {
    return false;
  }
  if (label === "hardware_specific" || label === "regional_requirement") {
    return false;
  }
  if (label === "hybrid_modality") {
    return PROFILE.modalityPreference === "hybrid" || PROFILE.modalityPreference === "onsite";
  }
  if (label === "onsite_modality") {
    return PROFILE.modalityPreference === "onsite";
  }

  if (label === "automation") {
    return AUTOMATION_TOOLS.some((t) => PROFILE.skills.includes(t)) || PROFILE.skills.some((s) => /automation|automatiz/i.test(s));
  }
  if (label === "sdet") {
    return AUTOMATION_TOOLS.some((t) => PROFILE.skills.includes(t)) && CODING_LANGS.some((t) => PROFILE.skills.includes(t));
  }
  if (label === "ai/ml testing") return PROFILE.skills.some((s) => /\bai\b|machine learning|\bml\b|\bllm\b/i.test(s));
  if (label === "istqb") return PROFILE.skills.some((s) => /istqb/i.test(s));
  return PROFILE.skills.some((s) => s.includes(label) || label.includes(s));
}

function fitFlags(job: JobListing, text: string): string[] {
  const reasons: string[] = [];
  const blob = jobBlob(job, text);
  const modality = (job.modality || "").toLowerCase();
  const title = job.title.toLowerCase();

  if (/hybrid|h[ií]brido/.test(modality)) reasons.push("modalidad híbrida");
  else if (/on-?site|presencial/.test(modality)) reasons.push("modalidad presencial");
  if (GIG_SIGNALS.test(blob) || CONTRACT_EMPLOYMENT.test(blob)) reasons.push("gig/freelance no full-time");
  if (ENTRY_LEVEL.test(blob)) reasons.push("entry-level vs perfil senior");
  if (/\bjr\b|junior|trainee|becari|pasant/.test(title)) reasons.push("rol junior (sobre-calificada)");
  return reasons;
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

function jobBlob(job: JobListing, text: string): string {
  return `${job.title} ${job.company} ${job.location} ${job.modality} ${text}`.toLowerCase();
}

function profileCountry(): string {
  return PROFILE.location.toLowerCase();
}

function isForeignGeo(blob: string): boolean {
  if (FOREIGN_COUNTRY.test(blob) && !profileCountry().includes("argentina")) return true;
  if (GEO_SUBSCRIPTION.test(blob)) return true;
  if (/subscription/i.test(blob) && FOREIGN_COUNTRY.test(blob) && !/argentina|buenos\s+aires/i.test(blob)) {
    return true;
  }
  return false;
}

export function analyzeJobRegex(job: JobListing): RegexAnalysis {
  const text = `${job.title}\n${cleanDescription(job.description)}`;
  let requirements = extractRequirements(job, text);
  const flags = specialFlags(job);

  if (requirements.length === 0) {
    requirements = [
      { label: "manual testing", weight: 2 },
      { label: "automation", weight: 1 },
      { label: "agile", weight: 1 },
    ];
  }

  let covered = 0;
  let total = 0;
  const matchedSkills: string[] = [];
  const gaps: string[] = [];

  for (const req of requirements) {
    total += req.weight;
    if (meetsRequirement(req)) {
      covered += req.weight;
      matchedSkills.push(skillDisplayText(req));
    } else {
      gaps.push(gapDisplayText(req));
    }
  }

  const context = extractContextRequirements(job, text);
  const fitReasons = fitFlags(job, text);

  let matchPercent = total > 0 ? Math.round((covered / total) * 100) : 0;
  if (gaps.length > 0) {
    matchPercent = Math.min(matchPercent, 99);
  }

  if (gaps.some((g) => /english|ingl[eé]s/i.test(g)) && !flags.some((f) => f.startsWith("english_process"))) {
    matchPercent = Math.min(matchPercent, 55);
  }
  if (flags.some((f) => f.startsWith("industry_review"))) matchPercent = Math.min(matchPercent, 60);
  if (flags.some((f) => f.startsWith("data_domain")) && !meetsRequirement({ label: "data quality", weight: 2 })) {
    matchPercent = Math.min(matchPercent, 50);
  }
  for (const cap of context.caps) {
    matchPercent = Math.min(matchPercent, cap);
  }

  const uniqueMatched = [...new Set(matchedSkills)];
  const uniqueGaps = [...new Set(gaps)];
  const cvSuggestions = uniqueGaps.slice(0, 3).map((g) => {
    if (g.includes("performance")) return "Destacar experiencia con pruebas de carga/JMeter o no funcionales.";
    if (/english|ingl[eé]s/i.test(g)) return "Mencionar inglés técnico fluido: documentación, tickets y dailies.";
    if (g.includes("istqb")) return "Aclarar certificación ISTQB (si la tenés) o experiencia equivalente.";
    if (g.includes("data quality")) return "Sumar evidencia de validación de datos / data quality si aplica.";
    return `Agregar evidencia concreta de ${g} en el CV.`;
  });

  const fitNote = fitReasons.length ? ` Ajuste de fit: ${fitReasons.join(", ")}.` : "";
  const summary =
    matchPercent >= 70
      ? `Encaje sólido (${matchPercent}%) por regex, foco ${uniqueMatched.slice(0, 3).join(", ") || "QA funcional"}.${fitNote}`
      : `Match ${matchPercent}% por regex. Gaps: ${uniqueGaps.slice(0, 3).join(", ") || "generales"}.${fitNote}`;

  return { matchPercent, matchedSkills: uniqueMatched, gaps: uniqueGaps, cvSuggestions, summary };
}
