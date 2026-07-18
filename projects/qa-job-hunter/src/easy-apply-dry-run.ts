// Dry-run Easy Apply sobre la cola CSV: sin Submit.
// Si no hay botón Easy Apply → (si Applied → applied; si no → closed) y sigue al siguiente pending.
//
//   npm run easy-apply:dry-run

import { chromium, type Page } from "playwright";
import {
  APPLICATION_SUMMARY,
  COVER_LETTER_DEFAULT,
} from "./apply/canonical-text.js";
import {
  clickEasyApply,
  detectAlreadyApplied,
  findEasyApplyControl,
} from "./apply/detect-apply.js";
import {
  ensureQueueFromMatched,
  loadQueue,
  rebuildQueueFromMatched,
  nextPending,
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

/** Avanza el modal hasta ver Submit; no lo clickea. */
async function dryRunThroughModal(page: Page): Promise<"dry_ok" | "blocked"> {
  for (let i = 0; i < 8; i++) {
    await maybeFillOptionalTexts(page);
    await maybeAnswerYesNo(page);

    const submit = page
      .getByRole("button", { name: /Submit application|Enviar solicitud/i })
      .first();
    if (await submit.isVisible({ timeout: 1000 }).catch(() => false)) {
      console.log("   Submit visible — DRY-RUN: no se hace click.");
      return "dry_ok";
    }

    const review = page
      .getByRole("button", { name: /Review your application|Revisar/i })
      .first();
    if (await review.isVisible({ timeout: 800 }).catch(() => false)) {
      await review.click();
      await sleep(1200);
      continue;
    }

    const next = page
      .getByRole("button", { name: /Continue to next step|Next|Continuar|Siguiente/i })
      .first();
    if (await next.isVisible({ timeout: 800 }).catch(() => false)) {
      await next.click();
      await sleep(1200);
      continue;
    }

    break;
  }
  return "blocked";
}

async function processJob(
  page: Page,
  row: QueueRow
): Promise<"dry_ok" | "closed" | "applied" | "blocked"> {
  const job = toApplyJob(row);
  console.log(`\n→ [${row.matchPercent}%] ${row.company} — ${row.title}`);
  console.log(`   ${job.url}`);

  await page.goto(job.url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await sleep(2500);

  if (await detectAlreadyApplied(page)) {
    updateQueueRow(row.jobId, {
      status: "applied",
      easyApply: row.easyApply || "yes",
      reason: "Already applied (detectado en página)",
    });
    setApplicationStatus(
      { id: row.jobId, title: row.title, company: row.company },
      "applied"
    );
    console.log("   ✓ Already applied → marcado applied en Excel");
    return "applied";
  }

  const hasEasy = await findEasyApplyControl(page, 6000);
  if (!hasEasy) {
    updateQueueRow(row.jobId, {
      status: "closed",
      easyApply: "no",
      reason: "Sin botón Easy Apply (no Applied) → cerrado",
    });
    console.log("   ✗ Sin Easy Apply → marcado closed; siguiente pendiente");
    return "closed";
  }

  updateQueueRow(row.jobId, { easyApply: "yes", reason: "Easy Apply visible" });

  const clicked = await clickEasyApply(page);
  if (!clicked) {
    updateQueueRow(row.jobId, {
      status: "blocked",
      reason: "Easy Apply visible pero click falló",
    });
    return "blocked";
  }
  await sleep(2000);

  const result = await dryRunThroughModal(page);
  if (result === "dry_ok") {
    updateQueueRow(row.jobId, {
      status: "dry_ok",
      easyApply: "yes",
      reason: "Dry-run hasta Submit (sin enviar)",
    });
    console.log("   ✓ dry_ok");
  } else {
    updateQueueRow(row.jobId, {
      status: "blocked",
      easyApply: "yes",
      reason: "Modal incompleto en dry-run",
    });
    console.log("   ✗ blocked (modal incompleto)");
  }

  // Cerrar modal si quedó abierto
  const dismiss = page.locator("button[aria-label='Dismiss'], button[aria-label='Cerrar']").first();
  if (await dismiss.isVisible({ timeout: 800 }).catch(() => false)) {
    await dismiss.click().catch(() => {});
  }

  return result;
}

async function main() {
  ensureDirs();
  const prior = loadQueue();
  const rows =
    prior.length === 0 || prior.some((r) => !/^\d+$/.test(r.jobId))
      ? rebuildQueueFromMatched()
      : ensureQueueFromMatched();
  console.log(`📋 Cola: ${APPLY_QUEUE_PATH}`);
  console.log(`   Total: ${rows.length} · pending: ${rows.filter((r) => r.status === "pending").length}`);

  const sessionPath = resolveSessionPath();
  const browser = await chromium.launch({ headless: false, slowMo: 150 });
  const context = await browser.newContext({
    storageState: sessionPath,
    locale: "en-US",
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  let dryOk = 0;
  let closed = 0;
  let applied = 0;
  const maxJobs = Number(process.env.DRY_RUN_MAX ?? "10");

  for (let n = 0; n < maxJobs; n++) {
    const row = nextPending(true);
    if (!row) {
      console.log("\nNo hay más pending con Easy Apply posible.");
      break;
    }

    const outcome = await processJob(page, row);
    if (outcome === "dry_ok") {
      dryOk++;
      // Un dry_ok exitoso alcanza; salir (o seguir si DRY_RUN_ALL=1)
      if (process.env.DRY_RUN_ALL !== "1") break;
    } else if (outcome === "closed") closed++;
    else if (outcome === "applied") applied++;

    await sleep(1500 + Math.random() * 1000);
  }

  await browser.close();
  console.log(`\nResumen dry-run: dry_ok=${dryOk} closed=${closed} applied=${applied}`);
  console.log(`Excel cola: ${APPLY_QUEUE_PATH}`);
  console.log(`También sincronizado en output/jobs-result.csv (columnas EasyApply/ApplyStatus).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
