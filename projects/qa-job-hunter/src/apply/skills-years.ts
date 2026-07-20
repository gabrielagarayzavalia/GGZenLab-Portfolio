/**
 * Años de experiencia por skill para Easy Apply (numeric 0–99).
 * Fuente: OneDrive/Documentos/0001-CVs/ggz-skills-years.xlsx (+ C# = 3).
 * Más específico primero (Selenium C# antes que Selenium genérico).
 */

export type SkillYearsHit = { label: string; years: number };

/** Entradas ordenadas: el primer match gana. */
export const SKILL_YEARS_ENTRIES: readonly {
  label: string;
  years: number;
  patterns: RegExp[];
}[] = [
  { label: "playwright", years: 2, patterns: [/playwright/i] },
  {
    label: "selenium csharp",
    years: 6,
    patterns: [/selenium[\s\S]{0,40}c\s*#|selenium[\s\S]{0,40}csharp|c\s*#[\s\S]{0,40}selenium/i],
  },
  {
    label: "selenium java",
    years: 2,
    patterns: [/selenium[\s\S]{0,40}\bjava\b(?!\s*script)|\bjava\b(?!\s*script)[\s\S]{0,40}selenium/i],
  },
  {
    label: "selenium javascript",
    years: 3,
    patterns: [/selenium[\s\S]{0,40}(javascript|\bjs\b)|(javascript|\bjs\b)[\s\S]{0,40}selenium/i],
  },
  { label: "selenium", years: 6, patterns: [/selenium/i] },
  { label: "python", years: 3, patterns: [/\bpython\b/i] },
  { label: "sql", years: 8, patterns: [/\bsql\b|structured\s*query\s*language/i] },
  { label: "java", years: 2, patterns: [/\bjava\b(?!\s*script)/i] },
  { label: "csharp", years: 3, patterns: [/c\s*#|csharp|c\s*sharp/i] },
  { label: "javascript", years: 3, patterns: [/javascript|\bjs\b(?!\s*x)/i] },
  { label: "typescript", years: 2, patterns: [/typescript|\bts\b/i] },
  { label: "postman", years: 4, patterns: [/postman/i] },
  { label: "swagger", years: 4, patterns: [/swagger|openapi/i] },
  { label: "soap ui", years: 4, patterns: [/soap\s*ui|soapui/i] },
  { label: "jenkins", years: 2, patterns: [/jenkins/i] },
  { label: "teamcity", years: 2, patterns: [/teamcity/i] },
  { label: "azure devops", years: 2, patterns: [/azure\s*devops|\bazdo\b/i] },
  { label: "jmeter", years: 2, patterns: [/jmeter|performance\s*test/i] },
  { label: "browserstack", years: 5, patterns: [/browserstack|cross-?browser/i] },
  { label: "html", years: 13, patterns: [/\bhtml\b/i] },
  { label: "css", years: 13, patterns: [/\bcss\b/i] },
  { label: "xpath", years: 13, patterns: [/xpath/i] },
  { label: "pandas", years: 3, patterns: [/pandas|athena|\bs3\b/i] },
  { label: "claude", years: 1, patterns: [/claude/i] },
  { label: "github copilot", years: 1, patterns: [/copilot/i] },
  { label: "cursor", years: 1, patterns: [/\bcursor\b/i] },
  {
    label: "qa automation",
    years: 12,
    patterns: [/qa\s*automation|test\s*automation|automatizaci[oó]n\s*(de\s*)?pruebas/i],
  },
  {
    label: "testing methodologies",
    years: 25,
    patterns: [/testing\s*(principles|methodolog)|metodolog[ií]as?\s*de\s*testing/i],
  },
  { label: "qa metrics", years: 15, patterns: [/qa\s*metrics|m[eé]tricas\s*(de\s*)?qa/i] },
  {
    label: "test case management",
    years: 25,
    patterns: [/test\s*case\s*management|gesti[oó]n\s*de\s*casos\s*de\s*prueba/i],
  },
  { label: "bug tracking", years: 25, patterns: [/bug\s*tracking|defect\s*tracking|seguimiento\s*de\s*bugs/i] },
  { label: "cypress", years: 2, patterns: [/cypress/i] },
  { label: "git", years: 13, patterns: [/\bgit\b(?!\s*hub|\s*lab)/i] },
  { label: "ci/cd", years: 2, patterns: [/ci\s*\/\s*cd|continuous\s*integration/i] },
] as const;

/**
 * Resuelve años para una pregunta tipo "years of experience with X".
 * null = skill desconocida (dejar pendiente).
 */
export function resolveSkillYears(questionText: string): SkillYearsHit | null {
  const text = questionText.replace(/\s+/g, " ").trim();
  if (text.length < 8) return null;
  // Debe parecer pregunta de años + skill (no Administrative genérico)
  if (!/years?|a[nñ]os?/i.test(text)) return null;
  if (!/experience|experiencia|with|in|using|con|en|usando/i.test(text)) return null;

  for (const entry of SKILL_YEARS_ENTRIES) {
    if (entry.patterns.some((p) => p.test(text))) {
      return { label: entry.label, years: entry.years };
    }
  }
  return null;
}
