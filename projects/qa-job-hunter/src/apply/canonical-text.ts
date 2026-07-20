// Textos canónicos para Easy Apply (sin mencionar la empresa solicitante).
// Cover letter = PDF upload; summary = texto según rol (Analyst vs Automation).

/** Criterio para elegir CV en el modal si aparece el picker (opcional). */
export const RESUME_LABEL_HINT =
  "Show more / See more si hace falta; radio QA_Analyst vs QA_Automation según el puesto.";

export type ApplyRoleKind = "analyst" | "automation";

/** Nombre de archivo (regex) del CV según rol. */
export const RESUME_FILE_MATCH = {
  analyst: /QA_Analyst|QA[\s_-]*Analyst|Zavalia_QA_Analyst/i,
  /** Incluye CV_Gabriela_Garay_Zavalia_QA_Automation.pdf */
  automation: /QA_Automation|QA[\s_-]*Automation|Zavalia_QA_Automation|Automation\.pdf/i,
} as const;

/**
 * Si no hay match claro Analyst/Automation, usar este CV (no cover letter).
 * Nombre exacto en LinkedIn document picker.
 */
export const RESUME_FALLBACK_FILENAME = "cv-Gabriela A Garay Zavalia - Eng01-2026.pdf";
export const RESUME_FALLBACK_MATCH =
  /cv-Gabriela\s*A\s*Garay\s*Zavalia\s*-\s*Eng01-2026\.pdf|Eng01-2026/i;

/** Score 0–100: qué tan bien matchea un filename/card al rol. */
export function scoreResumeForRole(blob: string, kind: ApplyRoleKind): number {
  const t = blob.replace(/\s+/g, " ");
  if (/intro-GGZ|intro\s*letter|cover\s*letter/i.test(t)) return 0;
  if (kind === "automation") {
    if (/QA_Automation/i.test(t)) return 100;
    if (/QA[\s_-]*Automation/i.test(t)) return 90;
    if (/Zavalia_QA_Automation|Automation\.pdf/i.test(t)) return 80;
    if (/automation/i.test(t) && /\.pdf/i.test(t)) return 50;
    return 0;
  }
  // analyst: excluir Automation salvo que también diga Analyst
  if (/Automation/i.test(t) && !/Analyst/i.test(t)) return 0;
  if (/QA_Analyst/i.test(t)) return 100;
  if (/QA[\s_-]*Analyst/i.test(t)) return 90;
  if (/Zavalia_QA_Analyst/i.test(t)) return 85;
  if (/\bAnalyst\b/i.test(t) && /\.pdf/i.test(t)) return 70;
  if (/QA|Quality/i.test(t) && /\.pdf/i.test(t) && !/Automation/i.test(t)) return 30;
  return 0;
}

/** Cover letter: archivo a subir (upload). Override con COVER_LETTER_PDF. */
export const COVER_LETTER_PDF_DEFAULT =
  "C:\\Users\\gabri\\OneDrive\\Documentos\\0001-CVs\\intro-letter\\intro-GGZ.pdf";

export function resolveCoverLetterPdfPath(): string {
  return process.env.COVER_LETTER_PDF?.trim() || COVER_LETTER_PDF_DEFAULT;
}

/**
 * Fallback texto si el aviso pide cover letter en textarea (sin upload).
 * Preferir siempre el PDF vía uploadCoverLetterPdf.
 */
export const COVER_LETTER_DEFAULT =
  "Please see the attached introduction letter (intro-GGZ.pdf). " +
  "Senior QA professional based in Buenos Aires, available immediately for remote roles.";

/** Resumen para puestos QA Analyst / QA funcional / Quality Assurance (no automation-first). */
export const APPLICATION_SUMMARY_ANALYST =
  "Senior QA Analyst with 25 years of QA experience and 32 years in IT, working daily in English across US-based client " +
  "environments and multicultural teams - as a remote contractor and as Argentina-based staff - with two brief on-site " +
  "assignments in the USA (Pleasanton, CA, Feb-May 2001; Washington, D.C., 2009). Expert in designing and " +
  "executing comprehensive test strategies (functional, regression, E2E, exploratory, UAT, integration) across web, " +
  "back-end and API layers. Deep experience with test management tools (Azure Test Management, TestRail, Zephyr, " +
  "Jira) and agile methodologies. Complementary automation skills with Playwright, Selenium, and Python. Strong " +
  "analytical mindset, meticulous bug tracking and root-cause analysis, and a proven track record of consolidating QA " +
  "processes and acting as product quality referent.";

/** Resumen para puestos QA Automation / SDET / Automation Engineer. */
export const APPLICATION_SUMMARY_AUTOMATION =
  "Senior QA Automation Engineer with 7+ years of dedicated test automation experience on top of 25 years in QA and " +
  "32 years in IT, working daily in English across US-based client environments and multicultural teams - as a remote " +
  "contractor and as Argentina-based staff - with two brief on-site assignments in the USA (Pleasanton, CA, Feb-May " +
  "2001; Washington, D.C., 2009). Hands-on expertise designing and implementing automation frameworks from scratch " +
  "using Playwright (TypeScript / Java), Selenium (C# / Java / JavaScript), and Python + Pandas. Experienced with API " +
  "automation (Postman, SOAP UI, Jest/Node.js), CI/CD pipelines (Jenkins, TeamCity, Azure DevOps, Docker), crossbrowser testing (BrowserStack), and performance testing (JMeter). Proven ability to transform manual regression " +
  "suites into robust automated frameworks and mentor teams on automation best practices.";

/** @deprecated usar resolveApplicationSummary(title) */
export const APPLICATION_SUMMARY = APPLICATION_SUMMARY_ANALYST;

/** Detecta si el aviso es Automation-first o Analyst. */
export function detectApplyRoleKind(title: string, company = ""): ApplyRoleKind {
  const blob = `${title} ${company}`;
  if (
    /automation|automatiz|sdet|playwright|selenium|cypress|test engineer in test|software development engineer in test/i.test(
      blob
    )
  ) {
    return "automation";
  }
  return "analyst";
}

/** Summary a pegar (borra default del modal). */
export function resolveApplicationSummary(title: string, company = ""): string {
  return detectApplyRoleKind(title, company) === "automation"
    ? APPLICATION_SUMMARY_AUTOMATION
    : APPLICATION_SUMMARY_ANALYST;
}
