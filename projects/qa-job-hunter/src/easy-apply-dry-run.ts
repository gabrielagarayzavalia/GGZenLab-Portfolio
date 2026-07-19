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
// - Next bloqueado por required → captura campos, cierra sesión (exit 3)

import { chromium, type Browser, type Locator, type Page } from "playwright";
import {
  APPLICATION_SUMMARY,
  COVER_LETTER_DEFAULT,
} from "./apply/canonical-text.js";
import {
  clickEasyApply,
  detectPageApplySignal,
  findEasyApplyControl,
} from "./apply/detect-apply.js";
import {
  captureRequiredFields,
  dismissSaveOrDiscard,
  fillPseudoAnswers,
  hasBlockingEmptyFields,
  isNextDisabled,
  logCapturedFields,
  RequiredFieldsBlockedError,
  saveRequiredFieldsDump,
} from "./apply/fill-answers.js";
import {
  clickButtonOrLink,
  cssPrimaryActions,
  findButtonOrLink,
  MODAL_LABELS,
  resolveApplyScope,
} from "./apply/modal-controls.js";
import {
  ensureQueueFromMatched,
  isFinalStatus,
  loadQueue,
  markEnviadaIfAllowed,
  nextPending,
  rebuildQueueFromMatched,
  toApplyJob,
  updateQueueRow,
  APPLY_QUEUE_PATH,
  type QueueRow,
} from "./apply/apply-queue.js";
import { ensureDirs, resolveSessionPath } from "./apply/paths.js";
import { setApplicationStatus } from "./application-status.js";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

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

async function maybeFillOptionalTexts(page: Page): Promise<void> {
  const root = page
    .locator(".jobs-easy-apply-modal, [role='dialog'], .jobs-easy-apply-content, main")
    .first();
  if (!(await root.isVisible({ timeout: 1500 }).catch(() => false))) return;
  const areas = root.locator("textarea");
  const n = await areas.count();
  for (let i = 0; i < n; i++) {
    const area = areas.nth(i);
    if (!(await area.isVisible().catch(() => false))) continue;
    const current = (await area.inputValue().catch(() => "")).trim();
    if (current) continue;
    const label = ((await area.getAttribute("aria-label")) ?? "").toLowerCase();
    const text = /summary|resumen|message|mensaje/i.test(label)
      ? APPLICATION_SUMMARY
      : COVER_LETTER_DEFAULT;
    await area.fill(text);
  }
}

async function maybeAnswerYesNo(page: Page): Promise<void> {
  const yes = page.getByText(/^Yes$|^Sí$/i).first();
  if (await yes.isVisible({ timeout: 800 }).catch(() => false)) {
    await yes.click();
  }
}

async function stopForRequiredFields(
  page: Page,
  jobId: string,
  url: string
): Promise<never> {
  const fields = await captureRequiredFields(page);
  const dumpPath = saveRequiredFieldsDump(jobId, url, fields);
  logCapturedFields(fields);
  console.error(`   Dump → ${dumpPath}`);
  console.error("   Completá opciones en src/apply/fill-answers.ts (PSEUDO_ANSWERS) y reintentá.");
  updateQueueRow(jobId, {
    status: "pendiente",
    easyApply: "yes",
    reason: `STOP: required fields (${fields.length}) — ver required-fields-${jobId}.json`,
  });
  throw new RequiredFieldsBlockedError(jobId, url, fields, dumpPath);
}

async function tryAdvanceNext(
  page: Page,
  scope: Page | Locator
): Promise<"advanced" | "blocked" | "no_next"> {
  // 1) Rellenar lo conocido ANTES de cualquier Next/Review
  await fillPseudoAnswers(page);

  // 2) Si hay obligatorios vacíos → NO click (evita Save or Discard)
  const blocking = await hasBlockingEmptyFields(page);
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

  const beforeUrl = page.url();
  const advanced =
    (await clickButtonOrLink(scope, MODAL_LABELS.review, 600, page)) ||
    (await clickButtonOrLink(scope, MODAL_LABELS.continue, 800, page)) ||
    (await clickButtonOrLink(scope, MODAL_LABELS.next, 500, page));

  if (!advanced) {
    const cssNext = cssPrimaryActions(scope);
    if (await cssNext.isVisible({ timeout: 400 }).catch(() => false)) {
      // Re-check por si acaso
      if ((await hasBlockingEmptyFields(page)).length > 0) return "blocked";
      await page.keyboard.press("Escape").catch(() => {});
      await sleep(200);
      const ok =
        (await cssNext.click({ timeout: 4000 }).then(() => true).catch(() => false)) ||
        (await cssNext.click({ force: true, timeout: 4000 }).then(() => true).catch(() => false));
      if (!ok) return "blocked";
    } else {
      return "no_next";
    }
  }

  await sleep(1200);

  // Si saltó Save/Discard → descartar y tratar como bloqueado
  if (await dismissSaveOrDiscard(page)) return "blocked";

  if (await isNextDisabled(page)) return "blocked";
  const fields = await captureRequiredFields(page);
  const hasErrors = fields.some((f) => f.errorText);
  if (hasErrors && page.url() === beforeUrl) return "blocked";
  if ((await hasBlockingEmptyFields(page)).length > 0) return "blocked";
  return "advanced";
}

async function dryRunThroughModal(
  page: Page,
  jobId: string,
  jobUrl: string
): Promise<"ok" | "incomplete" | "no_modal"> {
  const scope = await resolveApplyScope(page, 12000);
  if (!scope) {
    console.error("   ✗ Modal/flujo Easy Apply NO visible tras el click");
    console.error(`   URL actual: ${page.url()}`);
    return "no_modal";
  }
  console.log(
    scope === page
      ? "   Flujo Easy Apply abierto (página /apply/ o SDUI)"
      : "   Modal Easy Apply abierto"
  );

  for (let i = 0; i < 10; i++) {
    await maybeFillOptionalTexts(page);
    await maybeAnswerYesNo(page);
    const filled = await fillPseudoAnswers(page);
    if (filled > 0) console.log(`   Pseudo-fill: ${filled} campo(s)`);

    if (await findButtonOrLink(scope, MODAL_LABELS.submit, 1000)) {
      console.log("   Submit visible — DRY-RUN: no click; Excel sigue pendiente.");
      return "ok";
    }

    const step = await tryAdvanceNext(page, scope);
    if (step === "advanced") continue;

    if (step === "blocked" || step === "no_next") {
      // Reintentar fill (ej. Location) y un Next más
      await fillPseudoAnswers(page);
      await sleep(500);
      if (await isNextDisabled(page)) {
        await stopForRequiredFields(page, jobId, jobUrl);
      }
      const retry = await tryAdvanceNext(page, scope);
      if (retry === "advanced") continue;
      await stopForRequiredFields(page, jobId, jobUrl);
    }
  }
  return "incomplete";
}

async function processJob(
  page: Page,
  row: QueueRow
): Promise<"dry_ok" | "skip_no_ea" | "enviada" | "cerrada" | "skip_final" | "incomplete"> {
  if (isFinalStatus(row.status)) {
    console.log(`\n↷ Skip ${row.jobId} (estado final: ${row.status})`);
    return "skip_final";
  }

  const job = toApplyJob(row);
  console.log(`\n→ [${row.matchPercent}%] ${row.company} — ${row.title}`);
  console.log(`   ${job.url}`);

  await page.goto(job.url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await sleep(2500);

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
      return "enviada";
    }
    if (signal === "closed") {
      updateQueueRow(row.jobId, {
        status: "cerrada",
        easyApply: "no",
        reason: "Aviso cerrado / ya no acepta postulaciones",
      });
      console.log("   ✗ Aviso cerrado / no acepta → Excel: cerrada; siguiente");
      return "cerrada";
    }
    updateQueueRow(row.jobId, {
      status: "pendiente",
      easyApply: "no",
      reason: "Sin Easy Apply en esta visita — sigue pendiente",
    });
    console.log("   … Sin Easy Apply → Excel sigue pendiente; siguiente");
    return "skip_no_ea";
  }

  updateQueueRow(row.jobId, {
    status: "pendiente",
    easyApply: "yes",
    reason: "Easy Apply visible (dry-run)",
  });

  console.log("   Easy Apply visible — abriendo modal…");
  const clicked = await clickEasyApply(page);
  if (!clicked) {
    updateQueueRow(row.jobId, {
      status: "pendiente",
      reason: "STOP: Easy Apply visible pero click falló",
    });
    throw new EasyApplyModalNotOpenedError(row.jobId, job.url, "click falló");
  }
  await sleep(2000);

  const result = await dryRunThroughModal(page, row.jobId, job.url);
  if (result === "no_modal") {
    updateQueueRow(row.jobId, {
      status: "pendiente",
      easyApply: "yes",
      reason: "STOP: Easy Apply clickeado pero modal no abrió",
    });
    throw new EasyApplyModalNotOpenedError(row.jobId, job.url, "modal no abrió");
  }

  updateQueueRow(row.jobId, {
    status: "pendiente",
    easyApply: "yes",
    reason:
      result === "ok"
        ? "Dry-run OK hasta Submit (sin enviar) — pendiente"
        : "Dry-run incompleto (modal sí abrió) — pendiente",
  });

  if (!(await clickButtonOrLink(page, MODAL_LABELS.dismiss, 500))) {
    const dismiss = page
      .locator(
        "button[aria-label='Dismiss'], button[aria-label='Cerrar'], a[aria-label='Dismiss'], a[aria-label='Cerrar']"
      )
      .first();
    if (await dismiss.isVisible({ timeout: 400 }).catch(() => false)) {
      await dismiss.click().catch(() => {});
    }
  }

  return result === "ok" ? "dry_ok" : "incomplete";
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
  let browser: Browser | null = await chromium.launch({ headless: false, slowMo: 150 });
  const context = await browser.newContext({
    storageState: sessionPath,
    locale: "en-US",
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  const closeSession = async (why: string) => {
    console.error(`\n🔒 Cerrando sesión Playwright (${why})…`);
    await browser?.close().catch(() => {});
    browser = null;
  };

  let dryOk = 0;
  let enviada = 0;
  let cerrada = 0;
  let skipNoEa = 0;
  const maxJobs = Number(process.env.DRY_RUN_MAX ?? "10");
  const seen = new Set<string>();

  try {
    for (let n = 0; n < maxJobs; n++) {
      const row = nextPending(true, seen);
      if (!row) {
        console.log("\nNo hay más pendiente distinto.");
        break;
      }
      seen.add(row.jobId);

      let outcome: Awaited<ReturnType<typeof processJob>>;
      try {
        outcome = await processJob(page, row);
      } catch (err) {
        if (err instanceof EasyApplyModalNotOpenedError) {
          console.error(`\n🛑 ${err.message}`);
          await closeSession("modal no abrió");
          process.exit(2);
        }
        if (err instanceof RequiredFieldsBlockedError) {
          console.error(`\n🛑 ${err.message}`);
          await closeSession("campos obligatorios — esperando tus opciones de relleno");
          process.exit(3);
        }
        throw err;
      }

      if (outcome === "dry_ok") {
        dryOk++;
        if (process.env.DRY_RUN_ALL !== "1") break;
      } else if (outcome === "enviada") enviada++;
      else if (outcome === "cerrada") cerrada++;
      else if (outcome === "skip_no_ea") skipNoEa++;

      await sleep(1500 + Math.random() * 1000);
    }
  } finally {
    if (browser) await browser.close().catch(() => {});
  }

  console.log(
    `\nResumen dry-run: dry_ok=${dryOk} enviada=${enviada} cerrada=${cerrada} sin_EA_pendiente=${skipNoEa}`
  );
  console.log(`Excel: ${APPLY_QUEUE_PATH}`);
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
