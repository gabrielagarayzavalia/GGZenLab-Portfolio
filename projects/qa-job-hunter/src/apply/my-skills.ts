/**
 * Skills del candidato para Easy Apply (Sí/No).
 * Mantener alineado con PROFILE.skills en regex-matcher.ts.
 */

export const MY_SKILLS: readonly string[] = [
  "manual testing",
  "functional testing",
  "regression testing",
  "smoke testing",
  "exploratory testing",
  "sanity testing",
  "selenium",
  "playwright",
  "cypress",
  "javascript",
  "typescript",
  "python",
  "testng",
  "junit",
  "mocha",
  "jest",
  "cucumber",
  "gherkin",
  "bdd",
  "postman",
  "rest assured",
  "api testing",
  "xml",
  "jenkins",
  "github actions",
  "gitlab ci",
  "ci/cd",
  "git",
  "github",
  "gitlab",
  "jira",
  "testrail",
  "zephyr",
  "agile",
  "scrum",
  "kanban",
  "sql",
  "windows",
  "linux",
  "qa leadership",
  "test planning",
  "test cases",
  "mobile testing",
  "rest api",
];

/** Patrones → skill canónica (para detectar la pregunta). */
const SKILL_HINTS: { label: string; patterns: RegExp[]; knownIf: "list" | "automation" | "coding" | "leadership" }[] =
  [
    { label: "manual testing", patterns: [/manual test/i, /testing manual/i, /pruebas manuales/i], knownIf: "list" },
    { label: "functional testing", patterns: [/functional test/i, /pruebas funcionales/i], knownIf: "list" },
    { label: "regression testing", patterns: [/regression/i, /regresi[oó]n/i], knownIf: "list" },
    { label: "selenium", patterns: [/selenium/i], knownIf: "list" },
    { label: "playwright", patterns: [/playwright/i], knownIf: "list" },
    { label: "cypress", patterns: [/cypress/i], knownIf: "list" },
    { label: "python", patterns: [/python/i], knownIf: "list" },
    { label: "javascript", patterns: [/javascript/i, /\bjs\b/i], knownIf: "list" },
    { label: "typescript", patterns: [/typescript/i], knownIf: "list" },
    { label: "java", patterns: [/\bjava\b(?!\s*script)/i], knownIf: "list" },
    { label: "api testing", patterns: [/api test/i, /rest api/i, /rest assured/i], knownIf: "list" },
    { label: "postman", patterns: [/postman/i], knownIf: "list" },
    { label: "xml", patterns: [/\bxml\b/i], knownIf: "list" },
    { label: "tosca", patterns: [/\btosca\b/i], knownIf: "list" },
    { label: "apache", patterns: [/\bapache\b/i], knownIf: "list" },
    { label: "bdd", patterns: [/\bbdd\b/i, /cucumber/i, /gherkin/i], knownIf: "list" },
    { label: "ci/cd", patterns: [/ci\/cd/i, /jenkins/i, /github actions/i, /gitlab ci/i], knownIf: "list" },
    { label: "agile", patterns: [/\bagile\b/i, /\bscrum\b/i, /\bkanban\b/i], knownIf: "list" },
    { label: "jira", patterns: [/\bjira\b/i], knownIf: "list" },
    { label: "sql", patterns: [/\bsql\b/i], knownIf: "list" },
    { label: "mobile testing", patterns: [/mobile test/i, /app(?:lication)? test/i], knownIf: "list" },
    { label: "testng", patterns: [/testng/i], knownIf: "list" },
    { label: "junit", patterns: [/junit/i], knownIf: "list" },
    { label: "mocha", patterns: [/\bmocha\b/i], knownIf: "list" },
    { label: "jest", patterns: [/\bjest\b/i], knownIf: "list" },
    { label: "git", patterns: [/\bgit\b(?!\s*hub|\s*lab)/i], knownIf: "list" },
    {
      label: "automation",
      patterns: [/test automation/i, /automation (testing|experience|skills?)/i, /automatizaci[oó]n/i],
      knownIf: "automation",
    },
    {
      label: "qa leadership",
      patterns: [/qa lead/i, /test lead/i, /team lead/i, /liderazgo/i],
      knownIf: "leadership",
    },
    {
      label: "performance testing",
      patterns: [/performance test/i, /jmeter/i, /load test/i],
      knownIf: "list",
    },
    {
      label: "istqb",
      patterns: [/istqb/i],
      knownIf: "list",
    },
    {
      label: "data quality frameworks",
      patterns: [/deequ/i, /great expectations/i, /data quality framework/i],
      knownIf: "list",
    },
  ];

const AUTOMATION_TOOLS = ["selenium", "playwright", "cypress", "testng", "junit", "mocha", "jest", "cucumber"];

const SKILL_QUESTION_RE =
  /experience|skill|proficien|familiar|worked with|knowledge of|do you (have|know|use)|have you|are you|conoc[eé]|experiencia|domin[aá]|sab[eé]s?|trabajaste|usaste|manej[aá]s?/i;

function listHas(skill: string): boolean {
  const s = skill.toLowerCase();
  return MY_SKILLS.some((m) => m === s || m.includes(s) || s.includes(m));
}

function candidateKnows(label: string, knownIf: (typeof SKILL_HINTS)[0]["knownIf"]): boolean {
  if (knownIf === "automation") {
    return AUTOMATION_TOOLS.some((t) => listHas(t)) || listHas("automation");
  }
  if (knownIf === "coding") {
    return ["python", "javascript", "typescript", "java"].some((t) => listHas(t));
  }
  if (knownIf === "leadership") {
    return listHas("qa leadership") || listHas("test planning");
  }
  return listHas(label);
}

export type SkillYesNoResolution = {
  skill: string;
  answerYes: boolean;
};

/**
 * Si el texto es una pregunta de skill reconocida → Sí/No según MY_SKILLS.
 * null = no es pregunta de skill conocida (no tocar).
 */
export function resolveSkillYesNo(questionText: string): SkillYesNoResolution | null {
  const text = questionText.replace(/\s+/g, " ").trim();
  if (text.length < 4) return null;

  // Preferir hints tipados
  for (const hint of SKILL_HINTS) {
    if (!hint.patterns.some((p) => p.test(text))) continue;
    // Evitar falsos positivos en campos que no son skill (salary, location, etc.)
    if (!SKILL_QUESTION_RE.test(text) && text.length > 80) continue;
    return {
      skill: hint.label,
      answerYes: candidateKnows(hint.label, hint.knownIf),
    };
  }

  // Match directo contra la lista (ej. "Playwright?")
  for (const skill of MY_SKILLS) {
    const re = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (!re.test(text)) continue;
    if (!SKILL_QUESTION_RE.test(text) && text.length > 40) continue;
    return { skill, answerYes: true };
  }

  return null;
}
