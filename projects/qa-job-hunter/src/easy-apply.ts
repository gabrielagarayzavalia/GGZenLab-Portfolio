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
  isLanguageOnlyShell,
  MODAL_LABELS,
  resolveApplyScope,
} from "./apply/modal-controls.js";
import {
  fillPseudoAnswers,
  handleSaveDiscardModal,
  inventoryEasyApplyFields,
  logFieldInventory,
  saveEasyApplyFieldInventory,
  saveRequiredFieldsDump,
  logCapturedFields,
  hasBlockingEmptyFields,
  hasMandatoryFieldError,
  recoverMandatoryTypeaheadOrClose,
  isCoverOrSummaryLabel,
  isSummaryLabel,
  isCoverLetterLabel,
  hasPrefillValue,
  uploadCoverLetterPdf,
  fillApplicationSummary,
} from "./apply/fill-answers.js";
import {
  COVER_LETTER_DEFAULT,
  resolveApplicationSummary,
} from "./apply/canonical-text.js";
import {
  MAXIMIZED_LAUNCH_ARGS,
  maximizeWindow,
  maximizedContextOptions,
  prepareApplyBrowserPage,
  scrollEasyApplyFormToEnd,
  waitForEasyApplyModalReady,
  waitForJobPageReady,
} from "./apply/page-ready.js";
import { exportQueueToExcel, finishProductiveRun } from "./apply/post-run.js";
import {
  canonicalJobUrl,
  ensureQueueFromMatched,
  isFinalStatus,
  jobIdFromUrl,
  loadQueue,
  markEnviadaIfAllowed,
  toApplyJob,
  updateQueueRow,
} from "./apply/apply-queue.js";
import { handleFailures } from "./apply/failure-handler.js";
import type { ApplicationRecord, ApplyJob } from "./apply/types.js";
import type { AnalysisResult, JobMatch } from "./types.js";
import { setApplicationStatus } from "./application-status.js";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Tras Submit exitoso: Excel/cola → enviada siempre (Done es opcional).
 * Caso 1: sin botón Done sigue contando como enviada.
 */
async function completeSubmitAndDone(
  page: import("playwright").Page,
  job: ApplyJob,
  record: ApplicationRecord
): Promise<ApplicationRecord> {
  await page
    .screenshot({ path: path.join(SCREENSHOTS_DIR, `${job.jobId}-pre-submit.png`) })
    .catch(() => {});

  // Submit ya clickeado → marcar enviada de inmediato (no depender de Done).
  record.status = "submitted";
  record.reason = "Easy Apply enviada (Submit; sincronizando Done…)";
  markEnviadaIfAllowed(job.jobId, record.reason);
  setApplicationStatus(
    { id: job.jobId, title: job.title, company: job.company },
    "applied"
  );

  const clickedDone = await clickButtonOrLink(page, MODAL_LABELS.done, 5000, page);
  if (clickedDone) await sleep(1500);

  const uiConfirmed =
    clickedDone ||
    (await detectAlreadyApplied(page)) ||
    (await page
      .getByText(/Application sent|Application submitted|Solicitud enviada/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false));

  record.reason = clickedDone
    ? "Easy Apply enviada (Submit + Done)"
    : uiConfirmed
      ? "Easy Apply enviada (Submit; Done no visible)"
      : "Easy Apply enviada (Submit; Done no visible — Excel enviada)";
  markEnviadaIfAllowed(job.jobId, record.reason);

  await page
    .screenshot({ path: path.join(SCREENSHOTS_DIR, `${job.jobId}-submitted.png`) })
    .catch(() => {});

  // Intento inmediato a Excel (si el archivo está abierto, finishProductiveRun reintenta).
  exportQueueToExcel();

  return record;
}

/** Productivo: Save/Discard → Save → buscar Submit → Done. */
async function afterSaveContinueToSubmit(
  page: import("playwright").Page,
  modal: import("playwright").Page | import("playwright").Locator,
  job: ApplyJob,
  record: ApplicationRecord
): Promise<ApplicationRecord | "continue"> {
  await fillPseudoAnswers(page, { jobTitle: job.title, company: job.company });
  await sleep(800);

  // Next / Review hasta Submit
  for (let i = 0; i < 6; i++) {
    const submitBtn = await findButtonOrLink(modal, MODAL_LABELS.submit, 1200);
    if (submitBtn) {
      const submitted =
        (await submitBtn
          .click({ timeout: 4000, noWaitAfter: true })
          .then(() => true)
          .catch(() => false)) ||
        (await submitBtn
          .click({ force: true, timeout: 4000, noWaitAfter: true })
          .then(() => true)
          .catch(() => false));
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

/** Descarta borrador atascado (solo idioma) y reabre Easy Apply una vez. */
async function discardStaleDraftAndReopen(
  page: import("playwright").Page,
  job: ApplyJob
): Promise<"reopened" | "applied" | "failed"> {
  console.log("   ↻ Shell solo-idioma / borrador — Descarto y reabro Easy Apply…");

  await handleSaveDiscardModal(page, "dry_run");
  const discardApp = page
    .getByRole("button", {
      name: /Discard application|Delete draft|Discard|Descartar solicitud|Descartar/i,
    })
    .first();
  if (await discardApp.isVisible({ timeout: 1200 }).catch(() => false)) {
    await discardApp.click({ timeout: 4000 }).catch(() =>
      discardApp.click({ force: true, timeout: 4000 })
    );
    await sleep(800);
    await handleSaveDiscardModal(page, "dry_run");
  }
  await clickButtonOrLink(page, MODAL_LABELS.dismiss, 800, page);
  await page.keyboard.press("Escape").catch(() => {});
  await sleep(600);

  await page.goto(job.url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await waitForJobPageReady(page);

  if (!(await findEasyApplyControl(page, 8000))) {
    const signal = await detectPageApplySignal(page);
    if (signal === "applied") return "applied";
    return "failed";
  }

  const clicked = await clickEasyApply(page);
  if (!clicked || !(await waitForEasyApplyModalReady(page))) return "failed";
  return "reopened";
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
    await waitForJobPageReady(page);

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
          exportQueueToExcel();
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
    if (!(await waitForEasyApplyModalReady(page))) {
      record.status = "blocked";
      record.reason = "Modal Easy Apply no abrió / no terminó de cargar";
      return record;
    }

    let modal = await resolveApplyScope(page, 12000);
    if (!modal) {
      record.status = "blocked";
      record.reason = "Modal Easy Apply no abrió";
      return record;
    }

    let steps = 0;
    const maxSteps = 8;
    let restartedFromStale = false;
    let languageOnlyStreak = 0;

    while (steps < maxSteps) {
      steps++;

      // Scroll hasta el final del form para revelar campos fuera de viewport
      await scrollEasyApplyFormToEnd(page);
      const inventory = await inventoryEasyApplyFields(page);
      const inventoryPath = saveEasyApplyFieldInventory(job.jobId, job.url, steps, inventory);
      logFieldInventory(inventory);
      if (inventory.length > 0) {
        console.log(`   ↳ inventario → ${path.basename(inventoryPath)}`);
      }

      // Borrador atascado: solo "Select language" → descartar y reabrir (1 vez).
      // No usar artdeco-primary genérico: LinkedIn siempre tiene uno y bloqueaba el restart.
      if (isLanguageOnlyShell(inventory)) {
        languageOnlyStreak++;
        const eaAdvance = page.locator(
          "button[data-easy-apply-next-button], button[data-live-test-easy-apply-next-button], button[data-live-test-easy-apply-submit-button]"
        );
        const hasEasyApplyAdvance =
          (await findButtonOrLink(modal, MODAL_LABELS.submit, 500)) ||
          (await findButtonOrLink(modal, MODAL_LABELS.continue, 400)) ||
          (await findButtonOrLink(modal, MODAL_LABELS.next, 300)) ||
          (await findButtonOrLink(page, MODAL_LABELS.submit, 400)) ||
          (await eaAdvance.first().isVisible({ timeout: 400 }).catch(() => false));

        if (languageOnlyStreak >= 2 && !restartedFromStale) {
          restartedFromStale = true;
          const reopen = await discardStaleDraftAndReopen(page, job);
          if (reopen === "applied") {
            record.status = "submitted";
            record.reason = "Application submitted / Applied tras descartar borrador";
            markEnviadaIfAllowed(job.jobId, record.reason);
            setApplicationStatus(
              { id: job.jobId, title: job.title, company: job.company },
              "applied"
            );
            exportQueueToExcel();
            return record;
          }
          if (reopen === "reopened") {
            modal = (await resolveApplyScope(page, 12000)) ?? page;
            steps = 0;
            languageOnlyStreak = 0;
            continue;
          }
          console.log("   ✗ No pude reabrir tras shell idioma — sigo intentando footer EA");
        }

        // En shell idioma: solo clickear controles Easy Apply reales (no primary genérico)
        if (!hasEasyApplyAdvance && languageOnlyStreak >= 2 && restartedFromStale) {
          // ya reiniciamos y seguimos en idioma → cortar
          record.status = "draft_saved";
          record.reason =
            "Borrador LinkedIn solo-idioma tras reopen — completar manual o otra estrategia";
          await page
            .screenshot({ path: path.join(SCREENSHOTS_DIR, `${job.jobId}-language-shell.png`) })
            .catch(() => {});
          return record;
        }
      } else {
        languageOnlyStreak = 0;
      }

      const openTextareas = await page
        .locator(".jobs-easy-apply-modal textarea, [role='dialog'] textarea")
        .count();

      // Solo texto del MODAL (nunca main): "Test Automation" / JD no deben disparar assessment.
      const modalText = await page
        .locator(".jobs-easy-apply-modal, [role='dialog']")
        .first()
        .innerText()
        .catch(() => "");

      // NO usar /\btest\b/: matchea "Test Automation" del perfil y bloquea en falso.
      if (
        /skills assessment|online assessment|coding assessment|assessment required|completar (la |una )?evaluaci[oó]n|\bquiz\b|honeypot|workday assessment/i.test(
          modalText
        )
      ) {
        record.status = "blocked";
        record.reason = "Requiere assessment — completar manualmente";
        await page
          .screenshot({ path: path.join(SCREENSHOTS_DIR, `${job.jobId}-blocked.png`) })
          .catch(() => {});
        return record;
      }

      // Cover letter = PDF upload; summary = texto según Analyst/Automation
      await uploadCoverLetterPdf(page);
      await fillApplicationSummary(page, job.title, job.company);

      if (openTextareas > 0) {
        const letter = resolveCoverLetter(job.jobId, job.company) || COVER_LETTER_DEFAULT;
        const summary = resolveApplicationSummary(job.title, job.company);
        const areas = page.locator(".jobs-easy-apply-modal textarea, [role='dialog'] textarea");
        const count = await areas.count();
        for (let t = 0; t < count; t++) {
          const area = areas.nth(t);
          const current = (await area.inputValue().catch(() => "")).trim();
          const aria = ((await area.getAttribute("aria-label")) ?? "").trim();
          const labelBlob = `${aria} ${(await area.evaluate((n) => {
            const wrap =
              n.closest(".fb-form-element, .jobs-easy-apply-form-element, fieldset, li, div") ??
              n.parentElement;
            const lab = wrap?.querySelector("label, legend, span[class*='label']");
            return (lab?.textContent ?? "").trim();
          }).catch(() => ""))}`;
          if (isSummaryLabel(labelBlob)) {
            await area.fill("");
            await area.fill(summary);
            continue;
          }
          // Cover letter: preferir PDF; textarea solo fallback si vacío
          if (isCoverLetterLabel(labelBlob)) {
            if (!hasPrefillValue(current)) await area.fill(letter);
            continue;
          }
          if (isCoverOrSummaryLabel(labelBlob)) {
            await area.fill("");
            await area.fill(summary);
            continue;
          }
          if (!hasPrefillValue(current)) await area.fill(letter);
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

      await fillPseudoAnswers(page, { jobTitle: job.title, company: job.company });
      // Re-scroll tras rellenar (dropdowns / campos nuevos)
      await scrollEasyApplyFormToEnd(page);

      // Antes de avanzar: si hay mandatorio/typeahead roto → 3 reintentos o cerrar
      if (await hasMandatoryFieldError(page)) {
        const recover = await recoverMandatoryTypeaheadOrClose(page);
        if (recover === "failed_close") {
          record.status = "blocked";
          record.reason =
            "Typeahead obligatorio falló tras 3 intentos — cerré modal; reintentar otra estrategia";
          updateQueueRow(job.jobId, {
            status: "pendiente",
            easyApply: "yes",
            reason: record.reason,
          });
          await page
            .screenshot({ path: path.join(SCREENSHOTS_DIR, `${job.jobId}-typeahead-fail.png`) })
            .catch(() => {});
          return record;
        }
        await fillPseudoAnswers(page, { jobTitle: job.title, company: job.company });
        await scrollEasyApplyFormToEnd(page);
      }

      const submitBtn = await findButtonOrLink(modal, MODAL_LABELS.submit, 1500);

      if (submitBtn) {
        const submitted =
          (await submitBtn
            .click({ timeout: 4000, noWaitAfter: true })
            .then(() => true)
            .catch(() => false)) ||
          (await submitBtn
            .click({ force: true, timeout: 4000, noWaitAfter: true })
            .then(() => true)
            .catch(() => false));
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
        const advanced =
          (await advanceBtn
            .click({ timeout: 4000, noWaitAfter: true })
            .then(() => true)
            .catch(() => false)) ||
          (await advanceBtn
            .click({ force: true, timeout: 4000, noWaitAfter: true })
            .then(() => true)
            .catch(() => false));
        if (!advanced) {
          record.status = "blocked";
          record.reason = "Next/Review visible pero click falló";
          return record;
        }
        await sleep(2000);

        // Tras Next: error mandatorio → recover typeahead (3×) o cerrar
        if (await hasMandatoryFieldError(page)) {
          const recover = await recoverMandatoryTypeaheadOrClose(page);
          if (recover === "failed_close") {
            record.status = "blocked";
            record.reason =
              "Typeahead obligatorio falló tras 3 intentos — cerré modal; reintentar otra estrategia";
            updateQueueRow(job.jobId, {
              status: "pendiente",
              easyApply: "yes",
              reason: record.reason,
            });
            await page
              .screenshot({ path: path.join(SCREENSHOTS_DIR, `${job.jobId}-typeahead-fail.png`) })
              .catch(() => {});
            return record;
          }
          continue;
        }

        const sd = await handleSaveDiscardModal(page, "productive");
        if (sd === "saved") {
          const afterSave = await afterSaveContinueToSubmit(page, modal, job, record);
          if (afterSave !== "continue") return afterSave;
          continue;
        }
        continue;
      }

      // Footer a veces vive fuera del scope del modal → probar page también.
      // En shell solo-idioma NO clickear primary genérico (no avanza y quema pasos).
      if (isLanguageOnlyShell(inventory)) {
        continue;
      }

      const nextBtn = cssPrimaryActions(modal);
      const nextBtnPage = cssPrimaryActions(page);
      const primary =
        (await nextBtn.isVisible({ timeout: 600 }).catch(() => false))
          ? nextBtn
          : (await nextBtnPage.isVisible({ timeout: 600 }).catch(() => false))
            ? nextBtnPage
            : null;
      if (primary) {
        await page.keyboard.press("Escape").catch(() => {});
        const ok =
          (await primary.click({ timeout: 4000 }).then(() => true).catch(() => false)) ||
          (await primary.click({ force: true, timeout: 4000 }).then(() => true).catch(() => false));
        if (ok) {
          await sleep(1500);
          if (await hasMandatoryFieldError(page)) {
            const recover = await recoverMandatoryTypeaheadOrClose(page);
            if (recover === "failed_close") {
              record.status = "blocked";
              record.reason =
                "Typeahead obligatorio falló tras 3 intentos — cerré modal; reintentar otra estrategia";
              updateQueueRow(job.jobId, {
                status: "pendiente",
                easyApply: "yes",
                reason: record.reason,
              });
              return record;
            }
          }
          continue;
        }
      }

      const blocking = await hasBlockingEmptyFields(page);
      if (blocking.length > 0) {
        const recover = await recoverMandatoryTypeaheadOrClose(page);
        if (recover === "failed_close") {
          record.status = "blocked";
          record.reason =
            "Typeahead obligatorio falló tras 3 intentos — cerré modal; reintentar otra estrategia";
          updateQueueRow(job.jobId, {
            status: "pendiente",
            easyApply: "yes",
            reason: record.reason,
          });
          const dump = saveRequiredFieldsDump(job.jobId, job.url, blocking);
          logCapturedFields(blocking);
          record.reason += ` — ver ${path.basename(dump)}`;
          await page
            .screenshot({ path: path.join(SCREENSHOTS_DIR, `${job.jobId}-required.png`) })
            .catch(() => {});
          return record;
        }
        continue;
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

/** Prioriza cola Excel pendiente; fallback matchedJobs. APPLY_MAX limita la corrida. */
function loadJobsForProductiveRun(): ApplyJob[] {
  ensureQueueFromMatched();
  const fromQueue = loadQueue()
    .filter(
      (r) =>
        r.status === "pendiente" &&
        !isFinalStatus(r.status) &&
        r.easyApply !== "no" &&
        /^\d+$/.test(r.jobId)
    )
    .sort((a, b) => b.matchPercent - a.matchPercent)
    .map(toApplyJob);

  const base = fromQueue.length > 0 ? fromQueue : loadMatchedJobs();
  const max = Number(process.env.APPLY_MAX ?? "0");
  if (max > 0) return base.slice(0, max);
  return base;
}

async function main() {
  ensureDirs();

  const toApply = loadJobsForProductiveRun();
  const maxLabel = process.env.APPLY_MAX ? ` (APPLY_MAX=${process.env.APPLY_MAX})` : "";
  console.log(`🚀 Easy Apply PRODUCTIVO — ${toApply.length} aviso(s)${maxLabel}\n`);
  console.log("   ⚠️  Envía postulaciones reales (Submit + Done).");

  if (toApply.length === 0) {
    console.log("No hay avisos pendientes para aplicar. Nada que hacer.");
    return;
  }

  for (const j of toApply) {
    console.log(`   · [${j.matchPercent}%] ${j.company} — ${j.title}`);
  }
  console.log("");

  const sessionPath = resolveSessionPath();
  const browser = await chromium.launch({
    headless: false,
    slowMo: 250,
    args: [...MAXIMIZED_LAUNCH_ARGS],
  });
  const context = await browser.newContext(maximizedContextOptions(sessionPath));
  const page = await prepareApplyBrowserPage(context);
  await maximizeWindow(page);

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
