// Dry-run Easy Apply (modo pruebas): hasta ver Submit, SIN click; Excel sigue pendiente.
//
//   npm run easy-apply:dry-run
//
// Flujo:
// - cerrada/descartada → no tocar
// - Applied en UI (sin Easy Apply) → Excel enviada (salvo final)
// - Sin Easy Apply → Excel sigue pendiente → siguiente
// - Con Easy Apply → dry-run hasta Submit → Excel pendiente
// - Easy Apply visible y modal no abre → STOP (exit 2)
// - Campos sin respuesta → NO show-stopper: Notas + pendiente + resumen; no exit 3
// - Contact precargado → Next sin fill pesado
// - Fallo hard (modal/no-submit stuck) → STOP (exit 4) solo si no hay unanswered soft
//
import path from "path";
import { chromium, type Browser, type Locator, type Page } from "playwright";
import {
  COVER_LETTER_DEFAULT,
  resolveApplicationSummary,
} from "./apply/canonical-text.js";
import {
  clickEasyApply,
  detectJobClosed,
  detectPageApplySignal,
  findEasyApplyControl,
} from "./apply/detect-apply.js";
import {
  captureRequiredFields,
  ensureResumeForRole,
  fillExpectedCompensation,
  fillPseudoAnswers,
  handleSaveDiscardModal,
  hasBlockingEmptyFields,
  inventoryEasyApplyFields,
  isNextDisabled,
  logCapturedFields,
  logFieldInventory,
  saveEasyApplyFieldInventory,
  saveRequiredFieldsDump,
  shouldSkipHeavyFillForPrefill,
  uploadCoverLetterPdf,
  fillApplicationSummary,
  type CapturedField,
} from "./apply/fill-answers.js";
import {
  clickButtonOrLink,
  cssPrimaryActions,
  dismissModalOverlays,
  findButtonOrLink,
  MODAL_LABELS,
  resolveApplyScope,
} from "./apply/modal-controls.js";
import {
  MAXIMIZED_LAUNCH_ARGS,
  maximizeWindow,
  maximizedContextOptions,
  prepareApplyBrowserPage,
  scrollEasyApplyFormToEnd,
  waitForEasyApplyModalReady,
  waitForJobPageReady,
} from "./apply/page-ready.js";
import {
  ensureQueueFromMatched,
  isFinalStatus,
  loadQueue,
  markEnviadaIfAllowed,
  nextPending,
  rebuildQueueFromMatched,
  saveQueue,
  toApplyJob,
  updateQueueRow,
  APPLY_QUEUE_PATH,
  type QueueRow,
} from "./apply/apply-queue.js";
import { ensureDirs, resolveSessionPath, SCREENSHOTS_DIR } from "./apply/paths.js";
import { exportQueueToExcel } from "./apply/post-run.js";
import {
  TIMING,
  ModalPagePerfError,
  ModalPageTimer,
  betweenJobsDelayMs,
  isPerfFailHardEnabled,
  sleep,
  waitForEasyApplyStepSettle,
} from "./apply/timing.js";
import {
  collectUnknownQuestions,
  formatFailedFieldsNotes,
  logRunUnknownQuestions,
  recordJobUnknownQuestions,
  resetRunUnknownQuestions,
  saveRunUnknownQuestionsReport,
} from "./apply/unknown-questions.js";
import { setApplicationStatus } from "./application-status.js";

/** Frena toda la corrida: hay Easy Apply pero no entramos al modal. */
export class EasyApplyModalNotOpenedError extends Error {
  constructor(
    public readonly jobId: string,
    public readonly url: string,
    detail: string
  ) {
    super(
      `STOP: Easy Apply visible pero no se abrió el modal (${detail}). jobId=${jobId} url=${url}`
    );
    this.name = "EasyApplyModalNotOpenedError";
  }
}

/** Primer fallo del dry-run → parar y debuguear (no reintentar / no siguiente job). */
export class DryRunDebugStopError extends Error {
  constructor(
    public readonly jobId: string,
    public readonly url: string,
    detail: string,
    public readonly dumpPath?: string
  ) {
    super(`STOP/DEBUG: ${detail}. jobId=${jobId} url=${url}`);
    this.name = "DryRunDebugStopError";
  }
}

/** Modo prueba: Save/Discard → Discard y salir sin guardar ni enviar. */
export class DryRunDiscardExitError extends Error {
  constructor(
    public readonly jobId: string,
    public readonly url: string
  ) {
    super(
      `STOP dry-run: Save/Discard → Discard (sin guardar ni enviar). jobId=${jobId}`
    );
    this.name = "DryRunDiscardExitError";
  }
}

/**
 * Huella del PASO del modal (no del <main> del aviso).
 * Bug previo: locator "... , main").first() tomaba el job posting → siempre "stuck".
 */
async function stepFingerprint(page: Page): Promise<string> {
  const url = page.url();
  const modal = page
    .locator(".jobs-easy-apply-modal, [data-test-modal].jobs-easy-apply-modal, div[role='dialog']")
    .filter({ hasText: /Apply to|Contact info|Resume|Additional Questions|Review/i })
    .first();

  if (!(await modal.isVisible({ timeout: 2000 }).catch(() => false))) {
    return `${url}|NO_MODAL`;
  }

  const heading = (
    await modal
      .locator("h2, h3, .t-16, [class*='title']")
      .filter({ hasText: /Contact info|Resume|Home address|Additional Questions|Work experience|Review|Questions/i })
      .first()
      .innerText()
      .catch(() => "")
  )
    .trim()
    .slice(0, 80);

  const progress = (
    await modal.locator("progress, [role='progressbar']").first().getAttribute("aria-valuenow").catch(() => "")
  ) ?? "";

  // Footer primary: Next vs Review vs Submit — cambia entre pasos
  const primary =
    (
      await modal
        .locator(
          "button[data-easy-apply-next-button], button[data-live-test-easy-apply-submit-button], button.artdeco-button--primary"
        )
        .last()
        .innerText()
        .catch(() => "")
    )
      .trim()
      .slice(0, 40) || "";

  const bodySlice = (await modal.innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 160);
  return `${url}|h:${heading}|p:${progress}|btn:${primary}|${bodySlice}`;
}

async function maybeFillOptionalTexts(
  page: Page,
  jobTitle = "",
  company = ""
): Promise<"ok" | "resume_timeout"> {
  // CV una sola vez; cover después (nunca dejar intro-GGZ como resume)
  const resume = await ensureResumeForRole(page, jobTitle, company, "dry_run");
  if (resume.outcome === "timeout_dry") {
    console.log("   ✗ Resume timeout 30s (dry-run) — soft stop");
    return "resume_timeout";
  }
  await uploadCoverLetterPdf(page);
  if (resume.outcome !== "ok") {
    const resume2 = await ensureResumeForRole(page, jobTitle, company, "dry_run");
    if (resume2.outcome === "timeout_dry") {
      console.log("   ✗ Resume timeout 30s (dry-run) — soft stop");
      return "resume_timeout";
    }
  }
  await fillApplicationSummary(page, jobTitle, company);
  const root = page
    .locator(".jobs-easy-apply-modal, [role='dialog'], .jobs-easy-apply-content, main")
    .first();
  if (!(await root.isVisible({ timeout: 1500 }).catch(() => false))) return "ok";
  const areas = root.locator("textarea");
  const n = await areas.count();
  const summary = resolveApplicationSummary(jobTitle, company);
  for (let i = 0; i < n; i++) {
    const area = areas.nth(i);
    if (!(await area.isVisible().catch(() => false))) continue;
    const current = (await area.inputValue().catch(() => "")).trim();
    const label = ((await area.getAttribute("aria-label")) ?? "").toLowerCase();
    if (/summary|resumen|message|mensaje/i.test(label)) {
      await area.fill("");
      await area.fill(summary);
      continue;
    }
    if (/cover\s*letter|carta/i.test(label)) {
      if (!current) await area.fill(COVER_LETTER_DEFAULT);
      continue;
    }
  }
  return "ok";
}

async function maybeAnswerYesNo(page: Page): Promise<void> {
  // Skills Sí/No según MY_SKILLS (vía fillPseudoAnswers / answerSkillYesNoQuestions).
  // No clickear Yes genérico a ciegas: puede marcar mal una skill ausente.
  void page;
}

/** Capturas de debug del dry-run → output/apply/screenshots/ */
async function saveDebugScreenshot(
  page: Page,
  jobId: string,
  tag: string
): Promise<string | undefined> {
  ensureDirs();
  const file = path.join(SCREENSHOTS_DIR, `${jobId}-dryrun-${tag}.png`);
  try {
    await page.screenshot({ path: file, fullPage: true });
    console.error(`   📸 Screenshot → ${file}`);
    return file;
  } catch (err) {
    console.error(`   📸 No se pudo guardar screenshot: ${err}`);
    return undefined;
  }
}

function emptyOrPlaceholderValue(value: string): boolean {
  const v = (value || "").trim();
  if (!v) return true;
  return /selecciona|select an option|choose an option|select\b/i.test(v);
}

function labelFromCaptured(f: CapturedField): string {
  return (f.label || f.ariaLabel || f.placeholder || "").replace(/\s+/g, " ").trim();
}

function unansweredLabelsFromFields(fields: CapturedField[]): string[] {
  const empty = fields
    .filter((f) => emptyOrPlaceholderValue(f.value))
    .map(labelFromCaptured)
    .filter(Boolean);
  if (empty.length > 0) return empty;
  return fields.map(labelFromCaptured).filter(Boolean);
}

function mergeUniqueLabels(...groups: string[][]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const g of groups) {
    for (const raw of g) {
      const label = raw.replace(/\s+/g, " ").trim();
      if (label.length < 2) continue;
      const key = label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(label);
    }
  }
  return out;
}

async function dismissEasyApplyModal(page: Page): Promise<void> {
  if (await clickButtonOrLink(page, MODAL_LABELS.dismiss, 500)) return;
  const dismiss = page
    .locator(
      "button[aria-label='Dismiss'], button[aria-label='Cerrar'], a[aria-label='Dismiss'], a[aria-label='Cerrar']"
    )
    .first();
  if (await dismiss.isVisible({ timeout: 400 }).catch(() => false)) {
    await dismiss.click().catch(() => {});
  }
}

/**
 * Dry-run: campos sin respuesta → Notas + pendiente (no throw / no exit 3).
 * Devuelve labels acumulados para el resumen de corrida.
 */
async function recordUnansweredAndStayPending(
  page: Page,
  jobId: string,
  url: string,
  tag: string,
  priorLabels: string[] = []
): Promise<{ labels: string[]; dumpPath: string }> {
  await saveDebugScreenshot(page, jobId, tag);
  const fields = await captureRequiredFields(page);
  const dumpPath = saveRequiredFieldsDump(jobId, url, fields);
  logCapturedFields(fields);
  const labels = mergeUniqueLabels(priorLabels, unansweredLabelsFromFields(fields));
  const fieldNotes =
    formatFailedFieldsNotes(labels, "Dry-run: campos sin respuesta:") ||
    `Dry-run: campos sin respuesta (${labels.length}) — ver dump`;
  updateQueueRow(jobId, {
    status: "pendiente",
    easyApply: "yes",
    reason: `Dry-run: ${labels.length} campo(s) sin respuesta — pendiente`,
    notes: fieldNotes,
  });
  console.log(`   📝 ${labels.length} campo(s) sin respuesta → Excel Notas (sigue pendiente)`);
  for (const l of labels.slice(0, 12)) console.log(`      · ${l}`);
  if (labels.length > 12) console.log(`      … +${labels.length - 12} más`);
  console.log(`   Dump → ${dumpPath}`);
  await dismissEasyApplyModal(page);
  return { labels, dumpPath };
}

async function tryAdvanceNext(
  page: Page,
  scope: Page | Locator,
  jobTitle = "",
  company = "",
  opts: { skipFill?: boolean } = {}
): Promise<"advanced" | "blocked" | "no_next" | "stuck" | "discarded_exit" | "resume_timeout"> {
  await scrollEasyApplyFormToEnd(page);
  // 1) Rellenar lo conocido ANTES de cualquier Next/Review (salvo paso ya precargado)
  if (!opts.skipFill) {
    const fill = await fillPseudoAnswers(page, {
      jobTitle,
      company,
      mode: "dry_run",
    });
    if (fill.resumeOutcome === "timeout_dry") return "resume_timeout";
    // Remuneración a menudo bajo "top choice": segundo pase dedicado
    await fillExpectedCompensation(page);
  }

  // 2) Si hay obligatorios vacíos → NO click (evita Save or Discard)
  let blocking = await hasBlockingEmptyFields(page);
  if (blocking.some((f) => /remuneraci|salary|compensation|sueldo|pretendid/i.test(f.label))) {
    await fillExpectedCompensation(page);
    blocking = await hasBlockingEmptyFields(page);
  }
  if (blocking.length > 0) {
    console.log(
      `   ⛔ Next/Review bloqueado: ${blocking.length} campo(s) sin rellenar (no click)`
    );
    for (const f of blocking.slice(0, 6)) {
      console.log(`      · ${f.label}${f.errorText ? ` — ${f.errorText}` : ""}`);
    }
    return "blocked";
  }

  if (await isNextDisabled(page)) return "blocked";

  const beforeFp = await stepFingerprint(page);
  const beforeUrl = page.url();

  // Orden footer: Next/Continue → (si no hay) Review → (luego Submit se detecta en el loop).
  const nextEl =
    (await findButtonOrLink(scope, MODAL_LABELS.continue, 700)) ||
    (await findButtonOrLink(scope, MODAL_LABELS.next, 400));
  const reviewEl = nextEl
    ? null
    : await findButtonOrLink(scope, MODAL_LABELS.review, 800);
  const target = nextEl ?? reviewEl;
  const which = nextEl ? "Next/Continue" : reviewEl ? "Review" : "css-primary";

  if (!target) {
    const cssNext = cssPrimaryActions(scope);
    if (!(await cssNext.isVisible({ timeout: 400 }).catch(() => false))) return "no_next";
    if ((await hasBlockingEmptyFields(page)).length > 0) return "blocked";
    const ok =
      (await cssNext.click({ timeout: 4000 }).then(() => true).catch(() => false)) ||
      (await cssNext.click({ force: true, timeout: 4000 }).then(() => true).catch(() => false));
    if (!ok) return "blocked";
  } else {
    console.log(`   → Click ${which}${opts.skipFill ? " (paso precargado)" : ""}`);
    await dismissModalOverlays(page);
    await target.scrollIntoViewIfNeeded().catch(() => {});
    const ok =
      (await target.click({ timeout: 4000 }).then(() => true).catch(() => false)) ||
      (await target.click({ force: true, timeout: 4000 }).then(() => true).catch(() => false));
    if (!ok) return "blocked";
  }

  await waitForEasyApplyStepSettle(page);

  // Dry-run: Save/Discard → Discard y SALIR (no guardar, no enviar).
  const saveDiscard = await handleSaveDiscardModal(page, "dry_run");
  if (saveDiscard === "discarded") {
    return "discarded_exit";
  }

  // Tras Next LinkedIn suele revelar el paso siguiente (campos nuevos aún vacíos)
  await scrollEasyApplyFormToEnd(page);
  {
    const fillAfter = await fillPseudoAnswers(page, {
      jobTitle,
      company,
      mode: "dry_run",
    });
    if (fillAfter.resumeOutcome === "timeout_dry") return "resume_timeout";
  }
  await fillExpectedCompensation(page);

  if (await isNextDisabled(page)) return "blocked";
  let fields = await captureRequiredFields(page);
  let hasErrors = fields.some((f) => f.errorText);
  if (
    (hasErrors || (await hasBlockingEmptyFields(page)).length > 0) &&
    page.url() === beforeUrl
  ) {
    // Tras Next/Review LinkedIn revela remuneración / textareas debajo del fold
    await fillExpectedCompensation(page);
    const fillRetry = await fillPseudoAnswers(page, {
      jobTitle,
      company,
      mode: "dry_run",
    });
    if (fillRetry.resumeOutcome === "timeout_dry") return "resume_timeout";
    fields = await captureRequiredFields(page);
    hasErrors = fields.some((f) => f.errorText);
  }
  if (hasErrors && page.url() === beforeUrl) return "blocked";
  let blockingAfter = await hasBlockingEmptyFields(page);
  if (blockingAfter.length > 0) {
    const fillBlock = await fillPseudoAnswers(page, {
      jobTitle,
      company,
      mode: "dry_run",
    });
    if (fillBlock.resumeOutcome === "timeout_dry") return "resume_timeout";
    blockingAfter = await hasBlockingEmptyFields(page);
  }
  if (blockingAfter.length > 0) return "blocked";

  // Tras Review, Submit puede aparecer sin cambiar mucho el fingerprint
  if (
    (await findButtonOrLink(scope, MODAL_LABELS.submit, 800)) ||
    (await findButtonOrLink(page, MODAL_LABELS.submit, 600))
  ) {
    console.log("   ✓ Llegamos a pantalla con Submit (vía Review)");
    return "advanced";
  }

  let afterFp = await stepFingerprint(page);
  if (afterFp === beforeFp) {
    // Reintento 1×: a veces el form de CV tarda en aceptar el toggle
    const needResume = page.getByText(
      /se necesita un curr[ií]culum|resume is required|please select a resume/i
    );
    if (await needResume.isVisible({ timeout: 600 }).catch(() => false)) {
      console.log("   ↳ Next stuck + error currículum — re-fill resume y Next 1×");
      const resumeRetry = await ensureResumeForRole(page, jobTitle, company, "dry_run");
      if (resumeRetry.outcome === "timeout_dry") return "resume_timeout";
      await sleep(TIMING.modalStepMs);
      const next2 =
        (await findButtonOrLink(scope, MODAL_LABELS.continue, 500)) ||
        (await findButtonOrLink(scope, MODAL_LABELS.next, 400));
      if (next2) {
        await next2.click({ force: true, timeout: 4000 }).catch(() => {});
        await waitForEasyApplyStepSettle(page);
      }
      afterFp = await stepFingerprint(page);
      if (afterFp !== beforeFp) {
        console.log(`   ✓ Paso avanzó tras re-bind CV`);
        return "advanced";
      }
    }
    // Re-fill + recheck Submit (Review a veces no avanza si faltaba remuneración)
    {
      const fillStuck = await fillPseudoAnswers(page, {
        jobTitle,
        company,
        mode: "dry_run",
      });
      if (fillStuck.resumeOutcome === "timeout_dry") return "resume_timeout";
    }
    if (
      (await findButtonOrLink(scope, MODAL_LABELS.submit, 600)) ||
      (await findButtonOrLink(page, MODAL_LABELS.submit, 500))
    ) {
      console.log("   ✓ Submit visible tras re-fill (mismo fingerprint)");
      return "advanced";
    }
    const reviewAgain = await findButtonOrLink(scope, MODAL_LABELS.review, 500);
    if (reviewAgain && (await hasBlockingEmptyFields(page)).length === 0) {
      console.log("   ↳ Reintento Review 1× tras re-fill");
      await reviewAgain.click({ force: true, timeout: 4000 }).catch(() => {});
      await waitForEasyApplyStepSettle(page);
      if (
        (await findButtonOrLink(scope, MODAL_LABELS.submit, 800)) ||
        (await findButtonOrLink(page, MODAL_LABELS.submit, 600))
      ) {
        console.log("   ✓ Llegamos a Submit tras reintento Review");
        return "advanced";
      }
      afterFp = await stepFingerprint(page);
      if (afterFp !== beforeFp) {
        console.log(`   ✓ Paso avanzó tras reintento Review`);
        return "advanced";
      }
    }
    console.log("   ⛔ Next/Review clickeado pero el paso no cambió");
    console.log(`   fp before: ${beforeFp.slice(0, 120)}`);
    console.log(`   fp after:  ${afterFp.slice(0, 120)}`);
    return "stuck";
  }
  console.log(`   ✓ Paso avanzó vía ${which}`);
  return "advanced";
}

function pageLabelFromInventory(stepIndex: number, inventory: CapturedField[]): string {
  const first = inventory
    .map((f) => labelFromCaptured(f))
    .find((l) => l.length >= 2);
  if (first && /e-?mail|tel[eé]fono|c[oó]digo del pa[ií]s/i.test(first)) {
    return `paso${stepIndex}-contact`;
  }
  if (inventory.some((f) => /resume|curr[ií]culum|\.pdf/i.test(f.label))) {
    return `paso${stepIndex}-resume`;
  }
  if (inventory.some((f) => /top choice|primera opci[oó]n/i.test(f.label))) {
    return `paso${stepIndex}-top-choice`;
  }
  if (first) return `paso${stepIndex}-${first.slice(0, 28).replace(/\s+/g, "_")}`;
  return `paso${stepIndex}`;
}

async function dryRunThroughModal(
  page: Page,
  jobId: string,
  jobUrl: string,
  jobTitle = "",
  company = "",
  perf?: ModalPageTimer
): Promise<{ outcome: "ok" | "no_modal" | "unanswered"; unansweredLabels: string[] }> {
  if (!(await waitForEasyApplyModalReady(page))) {
    console.error("   ✗ Modal Easy Apply no terminó de cargar");
    console.error(`   URL actual: ${page.url()}`);
    return { outcome: "no_modal", unansweredLabels: [] };
  }

  const scope = await resolveApplyScope(page, 12000);
  if (!scope) {
    console.error("   ✗ Modal/flujo Easy Apply NO visible tras el click");
    console.error(`   URL actual: ${page.url()}`);
    return { outcome: "no_modal", unansweredLabels: [] };
  }
  console.log(
    scope === page
      ? "   Flujo Easy Apply abierto (página /apply/ o SDUI)"
      : "   Modal Easy Apply abierto"
  );

  const unansweredAcc: string[] = [];

  for (let i = 0; i < 10; i++) {
    // Submit primero: tras Review no tocar Follow/CV (evita side-effects y evaluate).
    if (
      (await findButtonOrLink(scope, MODAL_LABELS.submit, 1000)) ||
      (await findButtonOrLink(page, MODAL_LABELS.submit, 800))
    ) {
      perf?.end();
      console.log("   Submit visible — DRY-RUN: no click; Excel sigue pendiente.");
      return { outcome: "ok", unansweredLabels: unansweredAcc };
    }

    await scrollEasyApplyFormToEnd(page);
    const inventory = await inventoryEasyApplyFields(page);
    saveEasyApplyFieldInventory(jobId, jobUrl, i + 1, inventory);
    logFieldInventory(inventory);
    perf?.start(pageLabelFromInventory(i + 1, inventory));

    const unknowns = collectUnknownQuestions(inventory);
    if (unknowns.length > 0) {
      const notes = recordJobUnknownQuestions(jobId, company, jobTitle, unknowns);
      updateQueueRow(jobId, { notes });
      console.log(`   📝 ${unknowns.length} pregunta(s) nueva(s) → Excel Notas`);
    }

    // Vacíos required del inventario → acumular (aunque el paso aún avance)
    const emptyRequired = inventory
      .filter((f) => (f.required || /\*/.test(f.label)) && emptyOrPlaceholderValue(f.value))
      .map(labelFromCaptured);
    unansweredAcc.push(...emptyRequired);

    const skipHeavy = shouldSkipHeavyFillForPrefill(inventory, {
      jobTitle,
      company,
    });
    if (skipHeavy) {
      console.log("   ⚡ Paso precargado / CV OK / sin vacíos — Next sin fill pesado");
    } else {
      const optFill = await maybeFillOptionalTexts(page, jobTitle, company);
      if (optFill === "resume_timeout") {
        perf?.end();
        const notes = [
          "Falla selección CV Easy Apply (timeout 30s):",
          `- job ${jobId}`,
          "- dry-run soft stop (no avanzar wizard a ciegas)",
        ].join("\n");
        updateQueueRow(jobId, {
          status: "pendiente",
          easyApply: "yes",
          reason: "Dry-run: timeout selección CV 30s — pendiente",
          notes,
        });
        unansweredAcc.push("Resume/CV (timeout 30s contrato #208)");
        await saveDebugScreenshot(page, jobId, "resume-timeout");
        await dismissEasyApplyModal(page);
        return { outcome: "unanswered", unansweredLabels: unansweredAcc };
      }
      await maybeAnswerYesNo(page);
      const fill = await fillPseudoAnswers(page, {
        jobTitle,
        company,
        mode: "dry_run",
      });
      if (fill.resumeOutcome === "timeout_dry") {
        perf?.end();
        updateQueueRow(jobId, {
          status: "pendiente",
          easyApply: "yes",
          reason: fill.skipPending?.reason ?? "Dry-run: timeout selección CV 30s",
          notes: fill.skipPending?.notes ?? "",
        });
        unansweredAcc.push("Resume/CV (timeout 30s contrato #208)");
        await saveDebugScreenshot(page, jobId, "resume-timeout");
        await dismissEasyApplyModal(page);
        return { outcome: "unanswered", unansweredLabels: unansweredAcc };
      }
      if (fill.filled > 0) console.log(`   Pseudo-fill: ${fill.filled} campo(s)`);
      await scrollEasyApplyFormToEnd(page);
    }

    // Re-check post-fill (por si Submit apareció al completar el paso)
    if (
      (await findButtonOrLink(scope, MODAL_LABELS.submit, 800)) ||
      (await findButtonOrLink(page, MODAL_LABELS.submit, 600))
    ) {
      perf?.end();
      console.log("   Submit visible — DRY-RUN: no click; Excel sigue pendiente.");
      return { outcome: "ok", unansweredLabels: unansweredAcc };
    }

    const step = await tryAdvanceNext(page, scope, jobTitle, company, {
      skipFill: skipHeavy,
    });
    if (step === "advanced") {
      perf?.end();
      continue;
    }

    if (step === "discarded_exit") {
      perf?.end();
      await saveDebugScreenshot(page, jobId, "discard-exit");
      updateQueueRow(jobId, {
        status: "pendiente",
        easyApply: "yes",
        reason: "Dry-run: Save/Discard → Discard; salió sin guardar ni enviar",
      });
      throw new DryRunDiscardExitError(jobId, jobUrl);
    }

    if (step === "resume_timeout") {
      perf?.end();
      unansweredAcc.push("Resume/CV (timeout 30s contrato #208)");
      const { labels } = await recordUnansweredAndStayPending(
        page,
        jobId,
        jobUrl,
        "resume_timeout",
        unansweredAcc
      );
      updateQueueRow(jobId, {
        status: "pendiente",
        easyApply: "yes",
        reason: "Dry-run: timeout selección CV 30s — pendiente",
        notes: "Falla selección CV Easy Apply (timeout 30s) — soft stop dry-run",
      });
      return { outcome: "unanswered", unansweredLabels: labels };
    }

    // blocked / stuck / no_next → registrar campos, pendiente, NO show-stopper
    console.log(`   ✗ Paso ${i + 1}: ${step} — registro campos sin respuesta (sigue pendiente)`);
    perf?.end();
    const { labels } = await recordUnansweredAndStayPending(
      page,
      jobId,
      jobUrl,
      step,
      unansweredAcc
    );
    return { outcome: "unanswered", unansweredLabels: labels };
  }

  perf?.end();
  await saveDebugScreenshot(page, jobId, "no-submit");
  const fields = await captureRequiredFields(page);
  const dumpPath = saveRequiredFieldsDump(jobId, jobUrl, fields);
  logCapturedFields(fields);
  throw new DryRunDebugStopError(
    jobId,
    jobUrl,
    "no se llegó a Submit tras varios pasos — debug",
    dumpPath
  );
}

type ProcessJobResult = {
  outcome: "dry_ok" | "dry_unanswered" | "skip_no_ea" | "enviada" | "cerrada" | "skip_final";
  unansweredLabels?: string[];
};

async function processJob(
  page: Page,
  row: QueueRow,
  perf: ModalPageTimer
): Promise<ProcessJobResult> {
  if (isFinalStatus(row.status)) {
    console.log(`\n↷ Skip ${row.jobId} (estado final: ${row.status})`);
    return { outcome: "skip_final" };
  }

  const job = toApplyJob(row);
  console.log(`\n→ [${row.matchPercent}%] ${row.company} — ${row.title}`);
  console.log(`   ${job.url}`);

  await page.goto(job.url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await waitForJobPageReady(page);

  // Banner cerrado primero → Excel cerrada sin esperar Easy Apply.
  if (await detectJobClosed(page)) {
    updateQueueRow(row.jobId, {
      status: "cerrada",
      easyApply: "no",
      reason: "Aviso cerrado / ya no acepta postulaciones",
    });
    console.log("   ✗ No longer accepting applications → Excel: cerrada; siguiente");
    return { outcome: "cerrada" };
  }

  // Easy Apply visible manda: no marcar enviada/cerrada por texto del feed.
  const hasEasy = await findEasyApplyControl(page, 10000);
  if (hasEasy) {
    // sigue abajo al dry-run
  } else {
    const signal = await detectPageApplySignal(page);
    if (signal === "applied") {
      const marked = markEnviadaIfAllowed(
        row.jobId,
        "Application submitted / Applied (sin link Easy Apply)"
      );
      if (marked) {
        setApplicationStatus(
          { id: row.jobId, title: row.title, company: row.company },
          "applied"
        );
        console.log("   ✓ Application submitted / Applied → Excel: enviada");
      } else {
        console.log(`   ↷ Applied en UI pero Excel queda ${row.status} (final)`);
      }
      return { outcome: "enviada" };
    }
    if (signal === "closed") {
      updateQueueRow(row.jobId, {
        status: "cerrada",
        easyApply: "no",
        reason: "Aviso cerrado / ya no acepta postulaciones",
      });
      console.log("   ✗ Aviso cerrado / no acepta → Excel: cerrada; siguiente");
      return { outcome: "cerrada" };
    }
    updateQueueRow(row.jobId, {
      status: "pendiente",
      easyApply: "no",
      reason: "Sin Easy Apply en esta visita — sigue pendiente",
    });
    console.log("   … Sin Easy Apply → Excel sigue pendiente; siguiente");
    return { outcome: "skip_no_ea" };
  }

  updateQueueRow(row.jobId, {
    status: "pendiente",
    easyApply: "yes",
    reason: "Easy Apply visible (dry-run)",
  });

  console.log("   Easy Apply visible — abriendo modal…");
  perf.start("open-modal");
  const clicked = await clickEasyApply(page);
  if (!clicked) {
    perf.end();
    await saveDebugScreenshot(page, row.jobId, "click-failed");
    updateQueueRow(row.jobId, {
      status: "pendiente",
      reason: "STOP: Easy Apply visible pero click falló",
    });
    throw new EasyApplyModalNotOpenedError(row.jobId, job.url, "click falló");
  }
  await waitForEasyApplyStepSettle(page);

  const result = await dryRunThroughModal(
    page,
    row.jobId,
    job.url,
    row.title,
    row.company,
    perf
  );
  if (result.outcome === "no_modal") {
    perf.end();
    await saveDebugScreenshot(page, row.jobId, "no-modal");
    updateQueueRow(row.jobId, {
      status: "pendiente",
      easyApply: "yes",
      reason: "STOP: Easy Apply clickeado pero modal no abrió",
    });
    throw new EasyApplyModalNotOpenedError(row.jobId, job.url, "modal no abrió");
  }

  if (result.outcome === "unanswered") {
    console.log(
      `   ✓ Dry-run soft: ${result.unansweredLabels.length} campo(s) sin respuesta (pendiente)`
    );
    return { outcome: "dry_unanswered", unansweredLabels: result.unansweredLabels };
  }

  // result.outcome === "ok"
  const okPatch: Parameters<typeof updateQueueRow>[1] = {
    status: "pendiente",
    easyApply: "yes",
    reason: "Dry-run OK hasta Submit (sin enviar) — pendiente",
  };
  if (result.unansweredLabels.length > 0) {
    const notes = formatFailedFieldsNotes(
      result.unansweredLabels,
      "Dry-run: campos sin respuesta:"
    );
    if (notes) okPatch.notes = notes;
  }
  updateQueueRow(row.jobId, okPatch);

  await dismissEasyApplyModal(page);

  return { outcome: "dry_ok", unansweredLabels: result.unansweredLabels };
}

async function main() {
  ensureDirs();
  const prior = loadQueue();
  const rows =
    prior.length === 0 || prior.some((r) => !/^\d+$/.test(r.jobId))
      ? rebuildQueueFromMatched()
      : ensureQueueFromMatched();
  console.log(`📋 Cola: ${APPLY_QUEUE_PATH}`);
  console.log(
    `   Total: ${rows.length} · pendiente: ${rows.filter((r) => r.status === "pendiente").length}`
  );

  const sessionPath = resolveSessionPath();
  let browser: Browser | null = await chromium.launch({
    headless: false,
    slowMo: 150,
    args: [...MAXIMIZED_LAUNCH_ARGS],
  });
  const context = await browser.newContext(maximizedContextOptions(sessionPath));
  const page = await prepareApplyBrowserPage(context);
  await maximizeWindow(page);

  const closeSession = async (why: string) => {
    console.error(`\n🔒 Cerrando sesión Playwright (${why})…`);
    await browser?.close().catch(() => {});
    browser = null;
  };

  let dryOk = 0;
  let dryUnanswered = 0;
  let enviada = 0;
  let cerrada = 0;
  let skipNoEa = 0;
  const unansweredByJob: { jobId: string; labels: string[] }[] = [];
  const maxJobs = Number(process.env.DRY_RUN_MAX ?? "10");
  const forceJobId = (process.env.DRY_RUN_JOB_ID ?? "").trim();
  const seen = new Set<string>();
  const perf = new ModalPageTimer();
  resetRunUnknownQuestions();

  try {
    for (let n = 0; n < maxJobs; n++) {
      let row: QueueRow | null = null;
      if (forceJobId && n === 0) {
        // Forzar un jobId concreto (ej. Stefanini 4439867066)
        const q = loadQueue();
        row = q.find((r) => r.jobId === forceJobId) ?? null;
        if (!row) {
          row = {
            jobId: forceJobId,
            matchPercent: 85,
            title: process.env.DRY_RUN_JOB_TITLE ?? "QA Automation (forced dry-run)",
            company: process.env.DRY_RUN_JOB_COMPANY ?? "Forced",
            url: `https://www.linkedin.com/jobs/view/${forceJobId}/`,
            easyApply: "yes",
            status: "pendiente",
            reason: "DRY_RUN_JOB_ID",
            notes: "",
            updatedAt: new Date().toISOString(),
          };
          saveQueue([row, ...q.filter((r) => r.jobId !== forceJobId)]);
        } else if (row.status !== "pendiente") {
          updateQueueRow(forceJobId, { status: "pendiente", reason: "DRY_RUN_JOB_ID reintento" });
          row = loadQueue().find((r) => r.jobId === forceJobId) ?? row;
        }
        console.log(`   🎯 DRY_RUN_JOB_ID=${forceJobId} → ${row.url}`);
      } else {
        row = nextPending(true, seen);
      }
      if (!row) {
        console.log("\nNo hay más pendiente distinto.");
        break;
      }
      seen.add(row.jobId);

      let result: ProcessJobResult;
      try {
        result = await processJob(page, row, perf);
      } catch (err) {
        if (err instanceof ModalPagePerfError) {
          console.error(`\n🛑 ${err.message}`);
          perf.logSummary();
          await closeSession("perf fail >45s por página modal");
          process.exit(6);
        }
        if (err instanceof EasyApplyModalNotOpenedError) {
          console.error(`\n🛑 ${err.message}`);
          await closeSession("modal no abrió — debug");
          process.exit(2);
        }
        if (err instanceof DryRunDiscardExitError) {
          console.error(`\n🛑 ${err.message}`);
          await closeSession("dry-run Discard — sin guardar ni enviar");
          process.exit(5);
        }
        if (err instanceof DryRunDebugStopError) {
          console.error(`\n🛑 ${err.message}`);
          if (err.dumpPath) console.error(`   Dump → ${err.dumpPath}`);
          await closeSession("fallo dry-run — debug (no se sigue al siguiente)");
          process.exit(4);
        }
        console.error(`\n🛑 Error inesperado — frenando para debug:`);
        console.error(err);
        await closeSession("error inesperado");
        process.exit(1);
      }

      const outcome = result.outcome;
      if (outcome === "dry_ok") {
        dryOk++;
        if (result.unansweredLabels?.length) {
          unansweredByJob.push({ jobId: row.jobId, labels: result.unansweredLabels });
        }
        // Default: un éxito y listo (salvo DRY_RUN_ALL=1)
        if (process.env.DRY_RUN_ALL !== "1") break;
      } else if (outcome === "dry_unanswered") {
        dryUnanswered++;
        unansweredByJob.push({
          jobId: row.jobId,
          labels: result.unansweredLabels ?? [],
        });
        // Soft: no frena la sesión; con DRY_RUN_ALL sigue; si no, cierra corrida limpia
        if (process.env.DRY_RUN_ALL !== "1") break;
      } else if (outcome === "enviada") enviada++;
      else if (outcome === "cerrada") cerrada++;
      else if (outcome === "skip_no_ea") skipNoEa++;

      await sleep(betweenJobsDelayMs());
    }
  } finally {
    if (browser) await browser.close().catch(() => {});
  }

  console.log(
    `\nResumen dry-run: dry_ok=${dryOk} unanswered=${dryUnanswered} enviada=${enviada} cerrada=${cerrada} sin_EA_pendiente=${skipNoEa}`
  );
  if (unansweredByJob.length > 0) {
    console.log("\nCampos sin respuesta (dry-run):");
    for (const u of unansweredByJob) {
      console.log(`  · job ${u.jobId}:`);
      for (const l of u.labels.slice(0, 20)) console.log(`      - ${l}`);
    }
  }
  perf.logSummary();
  if (perf.hasFails()) {
    console.error(
      "\n✗ PERF: una o más páginas de modal >45s. Con PERF_TEST=1 el dry-run falla (exit 6)."
    );
    if (isPerfFailHardEnabled()) {
      process.exit(6);
    }
  }
  saveRunUnknownQuestionsReport();
  logRunUnknownQuestions();
  exportQueueToExcel();
  console.log(`Excel: ${APPLY_QUEUE_PATH} (+ Notas; estado pendiente si hubo unanswered)`);
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
