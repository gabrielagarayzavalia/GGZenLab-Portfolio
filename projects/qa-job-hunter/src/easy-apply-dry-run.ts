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

import { chromium, type Page } from "playwright";
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
  const dialog = page.getByRole("dialog").first();
  if (!(await dialog.isVisible({ timeout: 1500 }).catch(() => false))) return;
  const areas = dialog.locator("textarea");
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

async function dryRunThroughModal(page: Page): Promise<"ok" | "incomplete" | "no_modal"> {
  // Solo dentro del modal Easy Apply (evitar "Next" del carrusel LinkedIn).
  const dialog = page.getByRole("dialog").first();
  if (!(await dialog.isVisible({ timeout: 8000 }).catch(() => false))) {
    console.error("   ✗ Modal Easy Apply NO visible tras el click");
    return "no_modal";
  }
  console.log("   Modal Easy Apply abierto");

  for (let i = 0; i < 8; i++) {
    await maybeFillOptionalTexts(page);
    await maybeAnswerYesNo(page);

    const submit = dialog
      .getByRole("button", { name: /Submit application|Enviar solicitud/i })
      .first();
    if (await submit.isVisible({ timeout: 1000 }).catch(() => false)) {
      console.log("   Submit visible — DRY-RUN: no click; Excel sigue pendiente.");
      return "ok";
    }

    const review = dialog
      .getByRole("button", { name: /Review your application|Revisar/i })
      .first();
    if (await review.isVisible({ timeout: 800 }).catch(() => false)) {
      await review.click({ timeout: 5000 });
      await sleep(1200);
      continue;
    }

    // Preferir "Continue to next step" — NO aria-label="Next" genérico (carrusel).
    const continueBtn = dialog
      .getByRole("button", { name: /Continue to next step|Continuar|Siguiente/i })
      .first();
    if (await continueBtn.isVisible({ timeout: 800 }).catch(() => false)) {
      await continueBtn.click({ timeout: 5000 });
      await sleep(1200);
      continue;
    }

    const nextInModal = dialog.locator(
      "button[aria-label*='Continue'], button[aria-label*='Continuar'], button:has-text('Next'):not([data-testid*='carousel'])"
    ).first();
    if (await nextInModal.isVisible({ timeout: 500 }).catch(() => false)) {
      await nextInModal.click({ timeout: 5000 }).catch(() => {});
      await sleep(1200);
      continue;
    }

    break;
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

  const result = await dryRunThroughModal(page);
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

  const dismiss = page.locator("button[aria-label='Dismiss'], button[aria-label='Cerrar']").first();
  if (await dismiss.isVisible({ timeout: 800 }).catch(() => false)) {
    await dismiss.click().catch(() => {});
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
  const browser = await chromium.launch({ headless: false, slowMo: 150 });
  const context = await browser.newContext({
    storageState: sessionPath,
    locale: "en-US",
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  let dryOk = 0;
  let enviada = 0;
  let cerrada = 0;
  let skipNoEa = 0;
  const maxJobs = Number(process.env.DRY_RUN_MAX ?? "10");
  const seen = new Set<string>();

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
        console.error("   Dry-run frenado a propósito. Revisá selectores / overlay LinkedIn.");
        await browser.close().catch(() => {});
        process.exit(2);
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

  await browser.close();
  console.log(
    `\nResumen dry-run: dry_ok=${dryOk} enviada=${enviada} cerrada=${cerrada} sin_EA_pendiente=${skipNoEa}`
  );
  console.log(`Excel: ${APPLY_QUEUE_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
