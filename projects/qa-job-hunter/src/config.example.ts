// ============================================================
//  config.example.ts — Plantilla. Copiar a src/config.ts
// ============================================================

import { loadDotEnv } from "./load-dotenv.js";

loadDotEnv();

const LOCAL_LI_EMAIL = "";
const LOCAL_LI_PASS = "";

const liEmail = process.env.LI_EMAIL || LOCAL_LI_EMAIL;
const liPass = process.env.LI_PASS || LOCAL_LI_PASS;

if (!liEmail || !liPass) {
  console.error("❌ Faltan credenciales LinkedIn (LI_EMAIL / LI_PASS)");
  console.log("\nCopiá .env.example → .env y completá LI_EMAIL y LI_PASS\n");
  process.exit(1);
}

export const LINKEDIN_CREDENTIALS = {
  email: liEmail,
  password: liPass,
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
