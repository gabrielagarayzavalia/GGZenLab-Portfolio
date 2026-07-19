// Easy Apply baseline (heurístico) para avisos calificados (>= MIN_MATCH).
// Lee output/jobs-result.json (AnalysisResult.matchedJobs) del pipeline.
// NOTA (B17): esto es el baseline heurístico; el motor de replay parametrizado
// desde grabación es B17-3. Ver docs/easy-apply-flow.md.

import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import {
  APPLICATIONS_PATH,
  MIN_MATCH,
  OUTPUT_PATH,
  SCREENSHOTS_DIR,
  appendLog,
  ensureDirs,
  resolveSessionPath,
} from "./apply/paths.js";
import { resolveCoverLetter } from "./apply/cover-letter.js";
import {
  clickEasyApply,
  detectAlreadyApplied,
  detectPageApplySignal,
  findEasyApplyControl,
} from "./apply/detect-apply.js";
import {
  clickButtonOrLink,
  cssPrimaryActions,
  findButtonOrLink,
  MODAL_LABELS,
  resolveApplyScope,
} from "./apply/modal-controls.js";
import {
  fillPseudoAnswers,
  handleSaveDiscardModal,
} from "./apply/fill-answers.js";
import { finishProductiveRun } from "./apply/post-run.js";
import {
  canonicalJobUrl,
  ensureQueueFromMatched,
  jobIdFromUrl,
  markEnviadaIfAllowed,
  updateQueueRow,
} from "./apply/apply-queue.js";
import { handleFailures } from "./apply/failure-handler.js";
import type { ApplicationRecord, ApplyJob } from "./apply/types.js";
import type { AnalysisResult, JobMatch } from "./types.js";
import { setApplicationStatus } from "./application-status.js";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Tras Submit: Done + Excel enviada. */
async function completeSubmitAndDone(
  page: import("playwright").Page,
  job: ApplyJob,
  record: ApplicationRecord
): Promise<ApplicationRecord> {
  await page
    .screenshot({ path: path.join(SCREENSHOTS_DIR, `${job.jobId}-pre-submit.png`) })
    .catch(() => {});

  let clickedDone = await clickButtonOrLink(page, MODAL_LABELS.done, 5000, page);
  if (clickedDone) await sleep(1500);

  const confirmed =
    clickedDone ||
    (await detectAlreadyApplied(page)) ||
    (await page
      .getByText(/Application sent|Application submitted|Solicitud enviada/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false));

  if (confirmed) {
    record.status = "submitted";
    record.reason = clickedDone
      ? "Easy Apply enviada (Submit + Done)"
      : "Easy Apply enviada (Submit; Done no visible)";
    markEnviadaIfAllowed(job.jobId, record.reason);
    setApplicationStatus(
      { id: job.jobId, title: job.title, company: job.company },
      "applied"
    );
    await page
      .screenshot({ path: path.join(SCREENSHOTS_DIR, `${job.jobId}-submitted.png`) })
      .catch(() => {});
    return record;
  }

  record.status = "blocked";
  record.reason = "Submit sin Done/confirmación — verificar en LinkedIn";
  return record;
}

/** Productivo: Save/Discard → Save → buscar Submit → Done. */
async function afterSaveContinueToSubmit(
  page: import("playwright").Page,
  modal: import("playwright").Page | import("playwright").Locator,
  job: ApplyJob,
  record: ApplicationRecord
): Promise<ApplicationRecord | "continue"> {
  await fillPseudoAnswers(page);
  await sleep(800);

  // Next / Review hasta Submit
  for (let i = 0; i < 6; i++) {
    const submitBtn = await findButtonOrLink(modal, MODAL_LABELS.submit, 1200);
    if (submitBtn) {
      const submitted =
        (await submitBtn.click({ timeout: 4000 }).then(() => true).catch(() => false)) ||
        (await submitBtn.click({ force: true, timeout: 4000 }).then(() => true).catch(() => false));
      if (!submitted) {
        record.status = "blocked";
        record.reason = "Tras Save: Submit visible pero click falló";
        return record;
      }
      await sleep(2500);
      return completeSubmitAndDone(page, job, record);
    }

    const advanced =
      (await clickButtonOrLink(modal, MODAL_LABELS.review, 700, page)) ||
      (await clickButtonOrLink(modal, MODAL_LABELS.continue, 700, page)) ||
      (await clickButtonOrLink(modal, MODAL_LABELS.next, 500, page));
    if (!advanced) break;
    await sleep(1500);

    const sd = await handleSaveDiscardModal(page, "productive");
    if (sd === "saved") {
      await sleep(1000);
      continue;
    }
  }

  record.status = "draft_saved";
  record.reason = "Save/Discard → Save; no se encontró Submit — borrador en LinkedIn";
  updateQueueRow(job.jobId, { status: "pendiente", reason: record.reason });
  return record;
}

function loadMatchedJobs(): ApplyJob[] {
  if (!fs.existsSync(OUTPUT_PATH)) {
    console.error(`❌ Falta ${OUTPUT_PATH}. Ejecutá primero: npm run analyze`);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf-8"));
  // Acepta AnalysisResult { matchedJobs } o un array plano de JobMatch.
  const matches: JobMatch[] = Array.isArray(raw)
    ? raw
    : ((raw as AnalysisResult).matchedJobs ?? []);

  return matches
    .filter((m) => m.matchPercent >= MIN_MATCH)
    .map((m) => {
      const jobId = jobIdFromUrl(m.url) || (/^\d+$/.test(m.id) ? m.id : "");
      return {
        jobId,
        company: m.company,
        title: m.title,
        url: canonicalJobUrl(m.url, jobId),
        matchPercent: m.matchPercent,
        summary: m.summary ?? "",
      };
    })
    .filter((m) => /^\d+$/.test(m.jobId));
}

async function tryEasyApply(
  page: import("playwright").Page,
  job: ApplyJob
): Promise<ApplicationRecord> {
  const record: ApplicationRecord = {
    jobId: job.jobId,
    company: job.company,
    title: job.title,
    status: "not_attempted",
    reason: "",
    updatedAt: new Date().toISOString(),
  };

  try {
    await page.goto(job.url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await sleep(2500);

    // Easy Apply visible manda; applied/closed solo si NO hay link Easy Apply.
    if (!(await findEasyApplyControl(page, 10000))) {
      const signal = await detectPageApplySignal(page);
      if (signal === "applied") {
        record.status = "submitted";
        record.reason = "Application submitted / Applied (sin link Easy Apply)";
        const marked = markEnviadaIfAllowed(job.jobId, record.reason);
        if (marked) {
          setApplicationStatus(
            { id: job.jobId, title: job.title, company: job.company },
            "applied"
          );
        }
        return record;
      }
      if (signal === "closed") {
        record.status = "blocked";
        record.reason = "Aviso cerrado / ya no acepta postulaciones";
        updateQueueRow(job.jobId, {
          status: "cerrada",
          easyApply: "no",
          reason: record.reason,
        });
        return record;
      }
      record.status = "manual_pending";
      record.reason = "Sin Easy Apply en esta visita — Excel sigue pendiente";
      updateQueueRow(job.jobId, {
        status: "pendiente",
        easyApply: "no",
        reason: record.reason,
      });
      return record;
    }

    updateQueueRow(job.jobId, { easyApply: "yes" });
    const clicked = await clickEasyApply(page);
    if (!clicked) {
      record.status = "blocked";
      record.reason = "Easy Apply visible pero click falló";
      return record;
    }
    await sleep(2000);

    const modal = await resolveApplyScope(page, 12000);
    if (!modal) {
      record.status = "blocked";
      record.reason = "Modal Easy Apply no abrió";
      return record;
    }

    let steps = 0;
    const maxSteps = 8;

    while (steps < maxSteps) {
      steps++;

      const openTextareas = await page
        .locator(".jobs-easy-apply-modal textarea, [role='dialog'] textarea, textarea")
        .count();
      const requiredEmpty = await page
        .locator(".jobs-easy-apply-modal input[required]:not([value]), [role='dialog'] input[required]")
        .count();

      const bodyText = await page
        .locator(".jobs-easy-apply-modal, [role='dialog'], main")
        .first()
        .innerText()
        .catch(() => "");

      if (/assessment|evaluaci[oó]n|quiz|test/i.test(bodyText)) {
        record.status = "blocked";
        record.reason = "Requiere assessment — completar manualmente";
        await page
          .screenshot({ path: path.join(SCREENSHOTS_DIR, `${job.jobId}-blocked.png`) })
          .catch(() => {});
        return record;
      }

      if (openTextareas > 0) {
        const letter = resolveCoverLetter(job.jobId, job.company);
        const areas = page.locator(".jobs-easy-apply-modal textarea, [role='dialog'] textarea");
        const count = await areas.count();
        for (let t = 0; t < count; t++) {
          const area = areas.nth(t);
          const current = (await area.inputValue().catch(() => "")).trim();
          if (!current) await area.fill(letter);
        }
        await sleep(800);
        if (
          (await clickButtonOrLink(modal, MODAL_LABELS.review, 800, page)) ||
          (await clickButtonOrLink(modal, MODAL_LABELS.continue, 800, page)) ||
          (await clickButtonOrLink(modal, MODAL_LABELS.next, 500, page))
        ) {
          await sleep(1500);
          continue;
        }
        const nextAfterFill = cssPrimaryActions(modal);
        if (await nextAfterFill.isVisible({ timeout: 800 }).catch(() => false)) {
          await page.keyboard.press("Escape").catch(() => {});
          const ok =
            (await nextAfterFill.click({ timeout: 4000 }).then(() => true).catch(() => false)) ||
            (await nextAfterFill.click({ force: true, timeout: 4000 }).then(() => true).catch(() => false));
          if (ok) {
            await sleep(1500);
            continue;
          }
        }
      }

      await fillPseudoAnswers(page);

      const submitBtn = await findButtonOrLink(modal, MODAL_LABELS.submit, 1500);

      if (submitBtn) {
        const submitted =
          (await submitBtn.click({ timeout: 4000 }).then(() => true).catch(() => false)) ||
          (await submitBtn.click({ force: true, timeout: 4000 }).then(() => true).catch(() => false));
        if (!submitted) {
          record.status = "blocked";
          record.reason = "Submit visible pero click falló (overlay)";
          return record;
        }
        await sleep(2500);
        return completeSubmitAndDone(page, job, record);
      }

      // Orden: Next mientras exista; si no → Review
      const nextEl =
        (await findButtonOrLink(modal, MODAL_LABELS.continue, 700)) ||
        (await findButtonOrLink(modal, MODAL_LABELS.next, 400));
      const reviewEl = nextEl
        ? null
        : await findButtonOrLink(modal, MODAL_LABELS.review, 800);
      const advanceBtn = nextEl ?? reviewEl;
      if (advanceBtn) {
        await advanceBtn.click({ timeout: 4000 }).catch(async () => {
          await advanceBtn.click({ force: true, timeout: 4000 });
        });
        await sleep(2000);

        const sd = await handleSaveDiscardModal(page, "productive");
        if (sd === "saved") {
          const afterSave = await afterSaveContinueToSubmit(page, modal, job, record);
          if (afterSave !== "continue") return afterSave;
          continue;
        }
        continue;
      }

      const nextBtn = cssPrimaryActions(modal);
      if (await nextBtn.isVisible({ timeout: 800 }).catch(() => false)) {
        await page.keyboard.press("Escape").catch(() => {});
        const ok =
          (await nextBtn.click({ timeout: 4000 }).then(() => true).catch(() => false)) ||
          (await nextBtn.click({ force: true, timeout: 4000 }).then(() => true).catch(() => false));
        if (ok) {
          await sleep(1500);
          continue;
        }
      }

      if (requiredEmpty > 0) {
        record.status = "blocked";
        record.reason = "Campos obligatorios sin completar — completar manual";
        return record;
      }

      break;
    }

    record.status = "draft_saved";
    record.reason = `Flujo incompleto tras ${steps} pasos — revisar borrador`;
    await page
      .screenshot({ path: path.join(SCREENSHOTS_DIR, `${job.jobId}-incomplete.png`) })
      .catch(() => {});
  } catch (err) {
    record.status = "blocked";
    record.reason = err instanceof Error ? err.message : String(err);
  }

  return record;
}

async function main() {
  ensureDirs();
  ensureQueueFromMatched();

  const toApply = loadMatchedJobs();
  console.log(`🚀 Easy Apply en ${toApply.length} avisos calificados (>= ${MIN_MATCH}%)\n`);

  if (toApply.length === 0) {
    console.log("No hay avisos calificados para aplicar. Nada que hacer.");
    return;
  }

  const sessionPath = resolveSessionPath();
  const browser = await chromium.launch({ headless: false, slowMo: 250 });
  const context = await browser.newContext({ storageState: sessionPath, locale: "en-US" });
  const page = await context.newPage();

  const applications: ApplicationRecord[] = [];

  for (let i = 0; i < toApply.length; i++) {
    const job = toApply[i];
    process.stdout.write(`[${i + 1}/${toApply.length}] ${job.company} ... `);
    const result = await tryEasyApply(page, job);
    applications.push(result);
    appendLog(`${result.status} | ${job.jobId} | ${job.company} | ${job.title} | ${result.reason}`);
    console.log(result.status);

    try {
      const dismiss = page
        .locator("button[aria-label='Dismiss'], button[aria-label='Cerrar']")
        .first();
      if (await dismiss.isVisible({ timeout: 1000 }).catch(() => false)) await dismiss.click();
    } catch {
      /* ignore */
    }

    await sleep(2000 + Math.random() * 1500);
  }

  fs.writeFileSync(APPLICATIONS_PATH, JSON.stringify(applications, null, 2), "utf-8");
  await browser.close();

  const submitted = applications.filter((a) => a.status === "submitted").length;
  console.log(`\n✅ Enviadas: ${submitted}/${toApply.length}`);

  // Actualizar Excel, mail de pendientes y abrir Excel para revisión manual
  finishProductiveRun();

  const blocked = applications.filter(
    (a) => a.status === "blocked" || a.status === "draft_saved" || a.status === "manual_pending"
  );
  if (blocked.length > 0) {
    handleFailures(
      blocked.map((a) => {
        const job = toApply.find((j) => j.jobId === a.jobId);
        return {
          flow: "easy_apply" as const,
          jobId: a.jobId,
          company: a.company,
          title: a.title,
          url: job?.url ?? "",
          reason: a.reason,
        };
      }),
      { openIde: false }
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
