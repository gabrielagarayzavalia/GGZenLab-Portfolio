/**
 * Waits calibrados Easy Apply / pipeline (#143 B24).
 * Preferir wait a selector/loader; sleeps fijos solo como settle corto.
 *
 * Criterios:
 * - Acortar: networkidle largo, sleeps 1.5–2.5s post-Next/Submit.
 * - Holgado: delays tipado humano, jitter entre avisos (anti-ban), timeouts de click.
 */

import type { Page } from "playwright";

export const TIMING = {
  /** Post-Next/Review/Continue — antes 1500–2000ms */
  modalStepMs: 550,
  /** Tras click Submit antes de buscar Done — antes 2500ms */
  afterSubmitMs: 900,
  /** Tras Done / banner — antes 1500ms */
  afterDoneMs: 700,
  /** Entre avisos (mín + jitter) — antes 2000 + 0–1500 */
  betweenJobsMinMs: 700,
  betweenJobsJitterMs: 800,
  /** Settle job page tras selectores — antes 600ms */
  jobPageSettleMs: 200,
  /** Settle modal tras loader — antes 400ms */
  modalReadySettleMs: 150,
  /** Tras scroll form — antes 350ms */
  scrollSettleMs: 150,
  /** Soft networkidle (LinkedIn casi nunca “idle”) — antes 15s/8s */
  networkIdleSoftMs: 2500,
  /** Save → reintentar Submit — antes 1000ms */
  afterSaveMs: 450,
  /** Textarea fill → Next — antes 800ms */
  afterTextareaFillMs: 350,
} as const;

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function betweenJobsDelayMs(): number {
  return TIMING.betweenJobsMinMs + Math.random() * TIMING.betweenJobsJitterMs;
}

/** Tras avanzar un paso del modal: loader oculto + settle corto. */
export async function waitForEasyApplyStepSettle(page: Page): Promise<void> {
  await page
    .locator(".jobs-easy-apply-modal .artdeco-loader, [role='dialog'] .artdeco-loader")
    .first()
    .waitFor({ state: "hidden", timeout: 8000 })
    .catch(() => {});
  // Contenido del form vuelve a ser interactivo
  await page
    .locator(
      ".jobs-easy-apply-modal input, .jobs-easy-apply-modal button, [role='dialog'] input, [role='dialog'] button"
    )
    .first()
    .waitFor({ state: "visible", timeout: 8000 })
    .catch(() => {});
  await sleep(TIMING.modalStepMs);
}
