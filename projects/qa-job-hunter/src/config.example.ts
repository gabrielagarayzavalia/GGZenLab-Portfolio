// ============================================================
//  config.example.ts — Plantilla. Copiar a src/config.ts
// ============================================================

if (!process.env.LI_EMAIL || !process.env.LI_PASS) {
  console.error("❌ Faltan variables de entorno LI_EMAIL y LI_PASS");
  console.log("\nEjecuta antes de correr el script:");
  console.log("  PowerShell : $env:LI_EMAIL='tu@email.com' ; $env:LI_PASS='tu_password'");
  console.log("  CMD        : set LI_EMAIL=tu@email.com && set LI_PASS=tu_password");
  console.log("  Mac/Linux  : export LI_EMAIL=tu@email.com && export LI_PASS=tu_password\n");
  process.exit(1);
}

export const LINKEDIN_CREDENTIALS = {
  email: process.env.LI_EMAIL,
  password: process.env.LI_PASS,
};

export const SESSION_PATH = "./session/linkedin-session.json";
export const OUTPUT_PATH   = "./output/jobs-result.json";
export const CSV_PATH      = "./output/jobs-result.csv";

export const MIN_MATCH = 70;
export const OLLAMA_URL   = process.env.OLLAMA_URL   ?? "http://localhost:11434";
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "qwen2.5:1.5b";

export const SEARCH_TERMS = [
  "QA Analyst",
  "QA Engineer",
  "Quality Assurance",
  "Quality Analyst",
  "QA Automation Engineer",
  "Senior Test Automation",
  "Software Tester",
];

export const FILTERS = {
  remote: true,
  recentDays: 7,
  maxJobsPerSearch: 10,
};

export const TITLE_KEYWORDS = [
  "qa", "quality assurance", "quality analyst", "test", "tester",
  "testing", "sdet", "automation engineer",
];

export const MY_PROFILE = `
Describe tu perfil aquí para el análisis de match con el LLM.
`;
