/**
 * Evidencia B17-01 — grabación real Easy Apply (codegen, UI en inglés).
 *
 * Job observado: 4438016042 (GLOBAL HR CONSULTING).
 * Variante: multistep + radio Sí/No (NO es “simple” 1-clic).
 * CV / resumen / cover: opcionales — en este aviso no aparecieron.
 *
 * IMPORTANTE — jobId destructivo:
 * - Submit real quema el aviso en LinkedIn. Tras apply real, tomar otro job del CSV.
 * - Pruebas: preferir jobs descartados con Easy Apply y STOP antes de Submit.
 *
 * Dry-run (default abajo): avanza hasta ver Submit y NO hace click.
 * Apply real: descomentá el bloque Submit/Done (quema el jobId).
 *
 * Uso: npx tsx recordings/easy-apply/simple-apply.spec.ts
 * (cwd = projects/qa-job-hunter; requiere session/linkedin-session.json)
 */

import { chromium, type Page } from "playwright";
import {
  APPLICATION_SUMMARY,
  COVER_LETTER_DEFAULT,
} from "../../src/apply/canonical-text.js";
import {
  clickButtonOrLink,
  findButtonOrLink,
  MODAL_LABELS,
} from "../../src/apply/modal-controls.js";

const JOB_URL = "https://www.linkedin.com/jobs/view/4438016042/";
const SESSION_PATH = "session/linkedin-session.json";
/** false = dry-run (reutilizable). true = envía y quema el jobId. */
const REAL_SUBMIT = false;

async function maybeFillOptionalTexts(page: Page): Promise<void> {
  const dialog = page.getByRole("dialog").first();
  if (!(await dialog.isVisible({ timeout: 1500 }).catch(() => false))) return;

  // Cover / summary: si hay textareas vacías, rellenar con texto genérico (sin empresa).
  const areas = dialog.locator("textarea");
  const n = await areas.count();
  for (let i = 0; i < n; i++) {
    const area = areas.nth(i);
    if (!(await area.isVisible().catch(() => false))) continue;
    const current = (await area.inputValue().catch(() => "")).trim();
    if (current) continue;
    const label = ((await area.getAttribute("aria-label")) ?? "").toLowerCase();
    const text =
      /summary|resumen|message|mensaje/i.test(label) ? APPLICATION_SUMMARY : COVER_LETTER_DEFAULT;
    await area.fill(text);
  }
}

async function maybeAnswerYesNo(page: Page): Promise<void> {
  // Heurística mínima (B17-2 ampliará con apply-answers.json).
  const yes = page.getByText(/^Sí$|^Yes$/i).first();
  if (await yes.isVisible({ timeout: 800 }).catch(() => false)) {
    await yes.click();
  }
}

async function main() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: SESSION_PATH,
    viewport: { width: 1280, height: 900 },
    locale: "en-US",
  });
  const page = await context.newPage();

  await page.goto(JOB_URL);

  await page.getByRole("link", { name: "Easy Apply to this job" }).click();

  // Secuencia observada en la grabación original (Continue ×3 + radio + Review).
  // Patrón general de prueba: mientras haya Next/Continue, contestar opcionales y avanzar
  // hasta ver Submit — sin clickearlo en dry-run.
  for (let i = 0; i < 8; i++) {
    await maybeFillOptionalTexts(page);
    await maybeAnswerYesNo(page);

    // LinkedIn: Submit/Next/Done pueden ser button o link.
    const dialog = page.getByRole("dialog").first();
    const submit = await findButtonOrLink(dialog, MODAL_LABELS.submit, 1000);
    if (submit) {
      console.log(
        REAL_SUBMIT
          ? "Submit visible — enviando (quema jobId)."
          : "Submit visible — DRY-RUN: no se hace click (job reutilizable)."
      );
      if (REAL_SUBMIT) {
        await submit.click();
        await clickButtonOrLink(page, MODAL_LABELS.done, 5000);
      }
      break;
    }

    if (await clickButtonOrLink(dialog, MODAL_LABELS.review, 800)) continue;
    if (await clickButtonOrLink(dialog, MODAL_LABELS.continue, 800)) continue;
    if (await clickButtonOrLink(dialog, MODAL_LABELS.next, 500)) continue;

    break;
  }

  await context.close();
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
